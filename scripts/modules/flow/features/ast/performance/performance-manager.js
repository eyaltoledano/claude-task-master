/**
 * Performance Manager for AST System
 *
 * Orchestrates all performance components with CLI integration.
 */

import { EventEmitter } from 'events';
import ResourceMonitor from './resource-monitor.js';
import AdaptiveWorkerPool from './adaptive-worker-pool.js';
import SmartPriorityQueue from './smart-priority-queue.js';
import LazyLoadingManager from './lazy-loading-manager.js';

export class PerformanceManager extends EventEmitter {
	constructor(config = {}) {
		super();

		this.config = {
			enabled: config.enabled !== false,
			autoScale: config.autoScale !== false,
			highLoadThreshold: config.highLoadThreshold || 80,
			memoryThreshold: config.memoryThreshold || '200MB'
		};

		// Component instances
		this.resourceMonitor = null;
		this.workerPool = null;
		this.priorityQueue = null;
		this.lazyLoader = null;

		// System state
		this.isInitialized = false;
		this.currentLoad = 'normal';

		// Performance metrics
		this.globalMetrics = {
			startTime: Date.now(),
			totalTasks: 0,
			completedTasks: 0,
			failedTasks: 0,
			throttlingEvents: 0
		};

		this.activeTasks = new Map();
	}

	/**
	 * Initialize all performance components
	 */
	async initialize(astConfig = {}) {
		if (this.isInitialized) return;

		try {
			// Initialize components
			this.resourceMonitor = new ResourceMonitor({
				cpuThreshold: this.config.highLoadThreshold,
				memoryThreshold: this.config.memoryThreshold
			});

			this.workerPool = new AdaptiveWorkerPool({
				maxConcurrentOperations:
					astConfig.performance?.maxConcurrentOperations || 4,
				dynamicScaling: this.config.autoScale
			});

			this.priorityQueue = new SmartPriorityQueue({
				fairnessRatio: 0.1
			});

			this.lazyLoader = new LazyLoadingManager({
				maxCachedParsers: astConfig.performance?.maxCachedParsers || 4,
				maxCachedASTs: astConfig.performance?.maxCachedASTs || 50
			});

			// Connect components
			await this._connectComponents();

			// Start monitoring
			await this.resourceMonitor.startMonitoring();

			this.isInitialized = true;

			this.emit('performance:initialized', {
				components: [
					'ResourceMonitor',
					'AdaptiveWorkerPool',
					'SmartPriorityQueue',
					'LazyLoadingManager'
				]
			});
		} catch (error) {
			this.emit('performance:initialization-error', { error: error.message });
			throw error;
		}
	}

	/**
	 * Submit a task for AST analysis with intelligent prioritization
	 */
	async submitTask(task, context = {}) {
		if (!this.isInitialized) {
			throw new Error('Performance manager not initialized');
		}

		const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2)}`;

		// Check for critical load throttling
		if (this.currentLoad === 'critical') {
			const analysisDepth = this.resourceMonitor.getRecommendedAnalysisDepth();
			if (analysisDepth === 'disabled') {
				this.globalMetrics.throttlingEvents++;
				return {
					taskId,
					status: 'throttled',
					reason: 'System under critical load - analysis disabled'
				};
			}
		}

		// Enqueue with priority based on file relevance
		const queueTaskId = this.priorityQueue.enqueue(task, context);

		// Track task
		this.activeTasks.set(taskId, {
			queueTaskId,
			task,
			context,
			status: 'queued'
		});

		this.globalMetrics.totalTasks++;

		return { taskId, status: 'queued' };
	}

	/**
	 * Get comprehensive performance statistics
	 */
	getPerformanceStatistics() {
		return {
			system: {
				currentLoad: this.currentLoad,
				uptime: Date.now() - this.globalMetrics.startTime,
				isThrottling: this.currentLoad === 'critical'
			},
			resources: this.resourceMonitor?.getCurrentUsage(),
			workers: this.workerPool?.getPoolStatistics(),
			queue: this.priorityQueue?.getQueueStatistics(),
			cache: this.lazyLoader?.getCacheStatistics(),
			global: this.globalMetrics,
			activeTasks: this.activeTasks.size
		};
	}

	/**
	 * Set performance level manually
	 */
	setPerformanceLevel(level) {
		const validLevels = ['normal', 'moderate', 'high', 'critical'];
		if (!validLevels.includes(level)) {
			throw new Error(
				`Invalid level: ${level}. Valid: ${validLevels.join(', ')}`
			);
		}

		const oldLevel = this.currentLoad;
		this.currentLoad = level;

		if (this.resourceMonitor) {
			const degradationLevel = this._mapLoadToDegradation(level);
			this.resourceMonitor.setDegradationLevel(degradationLevel, 'manual');
		}

		this.emit('performance:level-changed', { oldLevel, newLevel: level });
	}

	/**
	 * Get current performance level
	 */
	getCurrentPerformanceLevel() {
		return {
			level: this.currentLoad,
			analysisDepth:
				this.resourceMonitor?.getRecommendedAnalysisDepth() || 'full',
			concurrency: this.resourceMonitor?.getRecommendedConcurrency() || 4,
			isThrottling: this.currentLoad === 'critical'
		};
	}

	/**
	 * Force cleanup of cached resources
	 */
	async forceCleanup() {
		const cleanedCount = this.lazyLoader
			? this.lazyLoader.scheduleCleanup(0)
			: 0;
		this.emit('performance:forced-cleanup', { cleanedCount });
		return cleanedCount;
	}

	/**
	 * Gracefully shutdown
	 */
	async shutdown() {
		// Shutdown components
		if (this.resourceMonitor) await this.resourceMonitor.stopMonitoring();
		if (this.workerPool) await this.workerPool.shutdown();
		if (this.priorityQueue) this.priorityQueue.clear();
		if (this.lazyLoader) await this.lazyLoader.shutdown();

		this.emit('performance:shutdown', { finalMetrics: this.globalMetrics });
	}

	// Private methods

	async _connectComponents() {
		await this.workerPool.initialize(this.resourceMonitor);
		await this.priorityQueue.initialize();
		await this.lazyLoader.initialize(this.resourceMonitor);

		// Set up event handlers
		this.resourceMonitor.on('degradation:changed', (event) => {
			const newLoad = this._mapDegradationToLoad(event.newLevel);
			if (newLoad !== this.currentLoad) {
				const oldLoad = this.currentLoad;
				this.currentLoad = newLoad;
				this.emit('performance:level-changed', { oldLevel, newLevel: newLoad });
			}
		});

		this.workerPool.on('task:completed', (event) => {
			this.globalMetrics.completedTasks++;
		});

		this.workerPool.on('task:failed', () => {
			this.globalMetrics.failedTasks++;
		});
	}

	_mapLoadToDegradation(load) {
		switch (load) {
			case 'normal':
				return 0;
			case 'moderate':
				return 1;
			case 'high':
				return 2;
			case 'critical':
				return 3;
			default:
				return 0;
		}
	}

	_mapDegradationToLoad(degradation) {
		switch (degradation) {
			case 0:
				return 'normal';
			case 1:
				return 'moderate';
			case 2:
				return 'high';
			case 3:
				return 'critical';
			default:
				return 'normal';
		}
	}
}

/**
 * CLI Commands for Performance Management
 */
export const performanceCommands = {
	/**
	 * Show performance status
	 */
	async status(performanceManager) {
		if (!performanceManager?.isInitialized) {
			console.log('❌ Performance system not initialized');
			return;
		}

		const stats = performanceManager.getPerformanceStatistics();
		const level = performanceManager.getCurrentPerformanceLevel();

		console.log('\n🚀 AST Performance Status\n');

		// System status
		console.log(`📊 System Load: ${stats.system.currentLoad.toUpperCase()}`);
		console.log(`🔄 Analysis Depth: ${level.analysisDepth}`);
		console.log(`⚡ Concurrency: ${level.concurrency}`);
		console.log(`⏱️  Uptime: ${Math.round(stats.system.uptime / 1000)}s`);

		if (stats.system.isThrottling) {
			console.log(
				'🚨 THROTTLING ACTIVE - Analysis reduced due to high system load'
			);
		}

		// Resource usage
		if (stats.resources) {
			console.log('\n💻 Resource Usage:');
			console.log(
				`   CPU: ${stats.resources.cpu.percentage.toFixed(1)}% (threshold: ${stats.resources.cpu.threshold}%)`
			);
			console.log(
				`   Memory: ${(stats.resources.memory.used / 1024 / 1024).toFixed(1)}MB`
			);
			console.log(
				`   Degradation Level: ${stats.resources.degradationLevel}/3`
			);
		}

		// Worker pools
		if (stats.workers) {
			console.log('\n👷 Worker Pools:');
			for (const [language, pool] of Object.entries(stats.workers.pools)) {
				console.log(
					`   ${language}: ${pool.activeWorkers}/${pool.totalWorkers} active (${pool.queuedTasks} queued)`
				);
			}
		}

		// Priority queues
		if (stats.queue) {
			console.log('\n📋 Task Queues:');
			for (const [priority, queue] of Object.entries(stats.queue.queues)) {
				if (queue.queueLength > 0) {
					console.log(`   ${priority}: ${queue.queueLength} tasks`);
				}
			}
		}

		// Cache status
		if (stats.cache) {
			console.log('\n🗄️  Cache Status:');
			console.log(`   Parsers: ${stats.cache.parsers.loaded} loaded`);
			console.log(`   ASTs: ${stats.cache.asts.cached} cached`);
			console.log(`   Cache Hits: ${stats.cache.metrics.cacheHits}`);
			console.log(`   Cache Misses: ${stats.cache.metrics.cacheMisses}`);
		}

		// Global metrics
		console.log('\n📈 Performance Metrics:');
		console.log(`   Total Tasks: ${stats.global.totalTasks}`);
		console.log(`   Completed: ${stats.global.completedTasks}`);
		console.log(`   Failed: ${stats.global.failedTasks}`);
		console.log(`   Active: ${stats.activeTasks}`);
		console.log(`   Throttling Events: ${stats.global.throttlingEvents}`);
	},

	/**
	 * Set performance level
	 */
	async setLevel(performanceManager, level) {
		if (!performanceManager?.isInitialized) {
			console.log('❌ Performance system not initialized');
			return;
		}

		try {
			performanceManager.setPerformanceLevel(level);
			console.log(`✅ Performance level set to: ${level.toUpperCase()}`);

			const currentLevel = performanceManager.getCurrentPerformanceLevel();
			console.log(`🔄 Analysis depth: ${currentLevel.analysisDepth}`);
			console.log(`⚡ Concurrency: ${currentLevel.concurrency}`);
		} catch (error) {
			console.log(`❌ Error: ${error.message}`);
		}
	},

	/**
	 * Force cleanup of caches
	 */
	async cleanup(performanceManager) {
		if (!performanceManager?.isInitialized) {
			console.log('❌ Performance system not initialized');
			return;
		}

		console.log('🧹 Forcing cache cleanup...');
		const cleanedCount = await performanceManager.forceCleanup();
		console.log(`✅ Cleaned up ${cleanedCount} cached resources`);
	},

	/**
	 * Show detailed statistics
	 */
	async stats(performanceManager) {
		if (!performanceManager?.isInitialized) {
			console.log('❌ Performance system not initialized');
			return;
		}

		const stats = performanceManager.getPerformanceStatistics();
		console.log('\n📊 Detailed Performance Statistics\n');
		console.log(JSON.stringify(stats, null, 2));
	}
};

export default PerformanceManager;
