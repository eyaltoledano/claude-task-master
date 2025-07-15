/**
 * Resource Monitor for AST Performance System
 *
 * Tracks system resources (CPU, memory, I/O) and provides threshold-based
 * alerts for graceful degradation of AST analysis performance.
 */

import { EventEmitter } from 'events';
import { cpus, freemem, totalmem } from 'os';
import process from 'process';

export class ResourceMonitor extends EventEmitter {
	constructor(config = {}) {
		super();

		this.config = {
			interval: this._parseDuration(config.interval || '2s'),
			cpuThreshold: this._parsePercentage(config.cpuThreshold || '80%'),
			memoryThreshold: this._parseMemory(config.memoryThreshold || '200MB'),
			ioThreshold: this._parsePercentage(config.ioThreshold || '75%'),
			gracefulDegradation: config.gracefulDegradation !== false,
			historySize: config.historySize || 30 // Keep 30 samples for averaging
		};

		this.isMonitoring = false;
		this.monitoringInterval = null;
		this.degradationLevel = 0; // 0 = normal, 1 = reduced, 2 = minimal, 3 = disabled

		// Resource usage history for averaging
		this.cpuHistory = [];
		this.memoryHistory = [];
		this.ioHistory = [];

		// Performance metrics
		this.metrics = {
			totalSamples: 0,
			degradationTriggers: 0,
			averageResponseTime: 0,
			peakMemoryUsage: 0,
			peakCpuUsage: 0
		};

		// Initial system info
		this.systemInfo = {
			totalCpus: cpus().length,
			totalMemory: totalmem(),
			processStartTime: Date.now()
		};

		this.lastCpuUsage = process.cpuUsage();
		this.lastIOStats = this._getIOStats();
	}

	/**
	 * Start monitoring system resources
	 */
	async startMonitoring() {
		if (this.isMonitoring) {
			return;
		}

		this.isMonitoring = true;
		this.degradationLevel = 0;

		this.monitoringInterval = setInterval(() => {
			this._collectMetrics();
		}, this.config.interval);

		this.emit('monitoring:started', {
			config: this.config,
			systemInfo: this.systemInfo
		});
	}

	/**
	 * Stop monitoring system resources
	 */
	async stopMonitoring() {
		if (!this.isMonitoring) {
			return;
		}

		this.isMonitoring = false;

		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = null;
		}

		this.emit('monitoring:stopped', {
			finalMetrics: this.getPerformanceMetrics()
		});
	}

	/**
	 * Get current system resource usage
	 */
	getCurrentUsage() {
		const cpuUsage = this._getCPUUsage();
		const memoryUsage = this._getMemoryUsage();
		const ioUsage = this._getIOUsage();

		return {
			cpu: {
				percentage: cpuUsage,
				threshold: this.config.cpuThreshold,
				exceeding: cpuUsage > this.config.cpuThreshold
			},
			memory: {
				used: memoryUsage.used,
				total: memoryUsage.total,
				percentage: memoryUsage.percentage,
				threshold: this.config.memoryThreshold,
				exceeding: memoryUsage.used > this.config.memoryThreshold
			},
			io: {
				percentage: ioUsage,
				threshold: this.config.ioThreshold,
				exceeding: ioUsage > this.config.ioThreshold
			},
			degradationLevel: this.degradationLevel,
			timestamp: Date.now()
		};
	}

	/**
	 * Get comprehensive performance metrics
	 */
	getPerformanceMetrics() {
		const currentUsage = this.getCurrentUsage();

		return {
			current: currentUsage,
			averages: {
				cpu: this._calculateAverage(this.cpuHistory),
				memory: this._calculateAverage(this.memoryHistory),
				io: this._calculateAverage(this.ioHistory)
			},
			metrics: {
				...this.metrics,
				uptime: Date.now() - this.systemInfo.processStartTime,
				degradationLevel: this.degradationLevel
			},
			systemInfo: this.systemInfo
		};
	}

	/**
	 * Force a specific degradation level
	 */
	setDegradationLevel(level, reason = 'manual') {
		const oldLevel = this.degradationLevel;
		this.degradationLevel = Math.max(0, Math.min(3, level));

		if (oldLevel !== this.degradationLevel) {
			this.emit('degradation:changed', {
				oldLevel,
				newLevel: this.degradationLevel,
				reason,
				timestamp: Date.now()
			});
		}
	}

	/**
	 * Check if system is under high load
	 */
	isHighLoad() {
		const usage = this.getCurrentUsage();
		return usage.cpu.exceeding || usage.memory.exceeding || usage.io.exceeding;
	}

	/**
	 * Get recommended analysis depth based on current load
	 */
	getRecommendedAnalysisDepth() {
		switch (this.degradationLevel) {
			case 0:
				return 'full'; // Normal operation
			case 1:
				return 'reduced'; // Skip detailed pattern analysis
			case 2:
				return 'minimal'; // Basic parsing only
			case 3:
				return 'disabled'; // No AST analysis
			default:
				return 'full';
		}
	}

	/**
	 * Get recommended concurrency level
	 */
	getRecommendedConcurrency() {
		const baseConcurrency = Math.max(1, this.systemInfo.totalCpus - 1);

		switch (this.degradationLevel) {
			case 0:
				return baseConcurrency;
			case 1:
				return Math.max(1, Math.floor(baseConcurrency * 0.75));
			case 2:
				return Math.max(1, Math.floor(baseConcurrency * 0.5));
			case 3:
				return 0; // No concurrent operations
			default:
				return baseConcurrency;
		}
	}

	// Private methods

	/**
	 * Collect and analyze system metrics
	 */
	_collectMetrics() {
		const cpuUsage = this._getCPUUsage();
		const memoryUsage = this._getMemoryUsage();
		const ioUsage = this._getIOUsage();

		// Update history
		this._updateHistory(this.cpuHistory, cpuUsage);
		this._updateHistory(this.memoryHistory, memoryUsage.percentage);
		this._updateHistory(this.ioHistory, ioUsage);

		// Update peak metrics
		this.metrics.peakCpuUsage = Math.max(this.metrics.peakCpuUsage, cpuUsage);
		this.metrics.peakMemoryUsage = Math.max(
			this.metrics.peakMemoryUsage,
			memoryUsage.used
		);
		this.metrics.totalSamples++;

		// Check thresholds and update degradation level
		if (this.config.gracefulDegradation) {
			this._updateDegradationLevel(cpuUsage, memoryUsage);
		}

		// Emit metrics event
		this.emit('metrics:collected', {
			cpu: cpuUsage,
			memory: memoryUsage,
			io: ioUsage,
			degradationLevel: this.degradationLevel,
			timestamp: Date.now()
		});
	}

	/**
	 * Update degradation level based on resource usage
	 */
	_updateDegradationLevel(cpuUsage, memoryUsage) {
		const cpuExceeding = cpuUsage > this.config.cpuThreshold;
		const memoryExceeding = memoryUsage.used > this.config.memoryThreshold;

		let newLevel = 0;
		if (cpuExceeding && memoryExceeding) {
			newLevel = 3; // Critical load
		} else if (cpuExceeding || memoryExceeding) {
			newLevel = 1; // Moderate load
		}

		if (newLevel !== this.degradationLevel) {
			this.degradationLevel = newLevel;
			this.emit('degradation:changed', {
				newLevel,
				reason: 'resource_pressure',
				timestamp: Date.now()
			});
		}
	}

	/**
	 * Get current CPU usage percentage
	 */
	_getCPUUsage() {
		const currentUsage = process.cpuUsage();
		const diffUsage = process.cpuUsage(this.lastCpuUsage);

		// Calculate CPU percentage
		const totalMicroseconds = diffUsage.user + diffUsage.system;
		const totalMilliseconds = totalMicroseconds / 1000;
		const percentage = (totalMilliseconds / this.config.interval) * 100;

		this.lastCpuUsage = currentUsage;
		return Math.min(100, Math.max(0, percentage));
	}

	/**
	 * Get current memory usage
	 */
	_getMemoryUsage() {
		const memUsage = process.memoryUsage();
		const systemTotal = this.systemInfo.totalMemory;
		const systemFree = freemem();
		const systemUsed = systemTotal - systemFree;

		return {
			used: memUsage.heapUsed,
			total: systemTotal,
			percentage: (systemUsed / systemTotal) * 100,
			heap: memUsage.heapUsed,
			heapTotal: memUsage.heapTotal,
			external: memUsage.external
		};
	}

	/**
	 * Get current I/O usage (simplified estimation)
	 */
	_getIOUsage() {
		// This is a simplified I/O estimation based on available Node.js metrics
		// In a real implementation, you might use platform-specific APIs
		const currentStats = this._getIOStats();
		const timeDiff = Date.now() - this.lastIOStats.timestamp;

		if (timeDiff === 0) return 0;

		// Estimate I/O activity based on timing and file operations
		const activityScore = Math.min(
			100,
			(currentStats.operations / timeDiff) * 1000 * 10
		);

		this.lastIOStats = currentStats;
		return activityScore;
	}

	/**
	 * Get basic I/O statistics
	 */
	_getIOStats() {
		return {
			timestamp: Date.now(),
			operations: Math.random() * 10 // Simplified placeholder
		};
	}

	/**
	 * Update history array with new value
	 */
	_updateHistory(history, value) {
		history.push(value);
		if (history.length > this.config.historySize) {
			history.shift();
		}
	}

	/**
	 * Calculate average from history array
	 */
	_calculateAverage(history) {
		if (history.length === 0) return 0;
		return history.reduce((sum, val) => sum + val, 0) / history.length;
	}

	/**
	 * Parse duration string to milliseconds
	 */
	_parseDuration(duration) {
		if (typeof duration === 'number') return duration;

		const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/);
		if (!match) throw new Error(`Invalid duration: ${duration}`);

		const value = parseFloat(match[1]);
		const unit = match[2] || 'ms';

		switch (unit) {
			case 'ms':
				return value;
			case 's':
				return value * 1000;
			case 'm':
				return value * 60 * 1000;
			case 'h':
				return value * 60 * 60 * 1000;
			default:
				throw new Error(`Invalid duration unit: ${unit}`);
		}
	}

	/**
	 * Parse percentage string to number
	 */
	_parsePercentage(percentage) {
		if (typeof percentage === 'number') return percentage;

		const match = percentage.match(/^(\d+(?:\.\d+)?)%?$/);
		if (!match) throw new Error(`Invalid percentage: ${percentage}`);

		return parseFloat(match[1]);
	}

	/**
	 * Parse memory string to bytes
	 */
	_parseMemory(memory) {
		if (typeof memory === 'number') return memory;

		const match = memory.match(/^(\d+(?:\.\d+)?)(B|KB|MB|GB)?$/i);
		if (!match) throw new Error(`Invalid memory size: ${memory}`);

		const value = parseFloat(match[1]);
		const unit = (match[2] || 'B').toUpperCase();

		switch (unit) {
			case 'B':
				return value;
			case 'KB':
				return value * 1024;
			case 'MB':
				return value * 1024 * 1024;
			case 'GB':
				return value * 1024 * 1024 * 1024;
			default:
				throw new Error(`Invalid memory unit: ${unit}`);
		}
	}
}

export default ResourceMonitor;
