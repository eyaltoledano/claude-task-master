/**
 * Task Master Web Server - Health Monitoring System
 *
 * Implements comprehensive health monitoring, self-healing capabilities,
 * and proactive system monitoring to ensure server reliability.
 */

import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import { getTaskMasterDirectory, getTasksFilePath } from '../utils.js';

/**
 * Health Status Levels
 */
const HEALTH_STATUS = {
	HEALTHY: 'HEALTHY',
	WARNING: 'WARNING',
	CRITICAL: 'CRITICAL',
	UNKNOWN: 'UNKNOWN'
};

/**
 * Health Monitor Configuration
 */
const HEALTH_CONFIG = {
	monitoring: {
		basicCheckInterval: 30000, // 30 seconds - basic health checks
		detailedCheckInterval: 120000, // 2 minutes - detailed system checks
		selfHealingInterval: 60000, // 1 minute - self-healing attempts
		maxCheckDuration: 10000, // 10 seconds - max time for health check
		maxConsecutiveFailures: 3 // Max consecutive failures before critical
	},
	thresholds: {
		memoryUsageWarning: 0.8, // 80% memory usage warning
		memoryUsageCritical: 0.9, // 90% memory usage critical
		responseTimeWarning: 5000, // 5 second response time warning
		responseTimeCritical: 10000, // 10 second response time critical
		diskSpaceWarning: 0.9, // 90% disk usage warning
		diskSpaceCritical: 0.95 // 95% disk usage critical
	},
	selfHealing: {
		memoryCleanupThreshold: 0.8, // Memory threshold for cleanup
		tagRecoveryMaxAttempts: 3, // Max attempts to recover corrupted tags
		staleOperationTimeout: 300000, // 5 minutes - timeout for stale operations
		maxActiveOperations: 100 // Max concurrent operations
	}
};

/**
 * Health Monitor Class
 * Provides comprehensive system monitoring and self-healing capabilities
 */
class HealthMonitor {
	constructor(projectRoot) {
		this.projectRoot = projectRoot;
		this.isMonitoring = false;
		this.healthStatus = HEALTH_STATUS.UNKNOWN;
		this.lastHealthCheck = null;
		this.consecutiveFailures = 0;
		this.activeOperations = new Map();
		this.healthHistory = [];
		this.maxHistorySize = 100;

		// Monitoring intervals
		this.basicCheckInterval = null;
		this.detailedCheckInterval = null;
		this.selfHealingInterval = null;

		// Health metrics
		this.metrics = {
			requestCount: 0,
			successfulRequests: 0,
			failedRequests: 0,
			averageResponseTime: 0,
			lastResponseTime: 0,
			memoryUsage: 0,
			uptime: process.uptime(),
			startTime: Date.now(),
			tagOperations: 0,
			lastTagOperation: null,
			fileSystemErrors: 0,
			lastFileSystemError: null
		};

		// Issues tracking
		this.currentIssues = [];
		this.resolvedIssues = [];
	}

	/**
	 * Start health monitoring
	 * @returns {Promise<void>}
	 */
	async startMonitoring() {
		if (this.isMonitoring) {
			console.log('Health monitoring is already running');
			return;
		}

		this.isMonitoring = true;
		console.log('Starting health monitoring system...');

		try {
			// Perform initial health check
			await this.performHealthCheck();

			// Start monitoring intervals
			this.basicCheckInterval = setInterval(
				() => this.performBasicHealthCheck(),
				HEALTH_CONFIG.monitoring.basicCheckInterval
			);

			this.detailedCheckInterval = setInterval(
				() => this.performDetailedHealthCheck(),
				HEALTH_CONFIG.monitoring.detailedCheckInterval
			);

			this.selfHealingInterval = setInterval(
				() => this.performSelfHealing(),
				HEALTH_CONFIG.monitoring.selfHealingInterval
			);

			console.log('Health monitoring started successfully');
		} catch (error) {
			console.error('Failed to start health monitoring:', error);
			this.isMonitoring = false;
			throw error;
		}
	}

	/**
	 * Stop health monitoring
	 * @returns {Promise<void>}
	 */
	async stopMonitoring() {
		if (!this.isMonitoring) {
			return;
		}

		this.isMonitoring = false;
		console.log('Stopping health monitoring system...');

		// Clear intervals
		if (this.basicCheckInterval) {
			clearInterval(this.basicCheckInterval);
			this.basicCheckInterval = null;
		}

		if (this.detailedCheckInterval) {
			clearInterval(this.detailedCheckInterval);
			this.detailedCheckInterval = null;
		}

		if (this.selfHealingInterval) {
			clearInterval(this.selfHealingInterval);
			this.selfHealingInterval = null;
		}

		console.log('Health monitoring stopped');
	}

	/**
	 * Perform comprehensive health check
	 * @returns {Promise<Object>} Health check result
	 */
	async performHealthCheck() {
		const startTime = performance.now();
		const checkId = `health_${Date.now()}`;

		try {
			console.log(`Performing health check: ${checkId}`);

			const results = await Promise.allSettled([
				this.checkMemoryUsage(),
				this.checkFileSystemHealth(),
				this.checkTagSystemHealth(),
				this.checkOperationalMetrics()
			]);

			const memoryResult =
				results[0].status === 'fulfilled' ? results[0].value : null;
			const fileSystemResult =
				results[1].status === 'fulfilled' ? results[1].value : null;
			const tagSystemResult =
				results[2].status === 'fulfilled' ? results[2].value : null;
			const metricsResult =
				results[3].status === 'fulfilled' ? results[3].value : null;

			// Determine overall health status
			const healthStatus = this.determineHealthStatus({
				memory: memoryResult,
				fileSystem: fileSystemResult,
				tagSystem: tagSystemResult,
				metrics: metricsResult
			});

			const checkDuration = performance.now() - startTime;
			const healthReport = {
				checkId,
				timestamp: new Date().toISOString(),
				duration: checkDuration,
				status: healthStatus,
				checks: {
					memory: memoryResult,
					fileSystem: fileSystemResult,
					tagSystem: tagSystemResult,
					metrics: metricsResult
				},
				issues: [...this.currentIssues],
				metrics: { ...this.metrics }
			};

			// Update health status and history
			this.updateHealthStatus(healthStatus, healthReport);

			// Log health status changes
			if (this.healthStatus !== healthStatus) {
				console.log(
					`Health status changed: ${this.healthStatus} → ${healthStatus}`
				);
			}

			this.lastHealthCheck = healthReport;
			return healthReport;
		} catch (error) {
			const errorDuration = performance.now() - startTime;
			console.error(`Health check failed: ${checkId}`, error);

			const errorReport = {
				checkId,
				timestamp: new Date().toISOString(),
				duration: errorDuration,
				status: HEALTH_STATUS.CRITICAL,
				error: error.message,
				issues: this.currentIssues
			};

			this.updateHealthStatus(HEALTH_STATUS.CRITICAL, errorReport);
			return errorReport;
		}
	}

	/**
	 * Perform basic health check (lightweight)
	 * @returns {Promise<Object>} Basic health check result
	 */
	async performBasicHealthCheck() {
		try {
			const memoryUsage = this.getMemoryUsage();
			const uptime = process.uptime();

			// Update basic metrics
			this.metrics.memoryUsage = memoryUsage.percentage;
			this.metrics.uptime = uptime;

			// Check for immediate issues
			if (
				memoryUsage.percentage > HEALTH_CONFIG.thresholds.memoryUsageCritical
			) {
				this.addIssue(
					'CRITICAL_MEMORY_USAGE',
					`Memory usage critical: ${(memoryUsage.percentage * 100).toFixed(1)}%`
				);
			} else if (
				memoryUsage.percentage > HEALTH_CONFIG.thresholds.memoryUsageWarning
			) {
				this.addIssue(
					'HIGH_MEMORY_USAGE',
					`Memory usage high: ${(memoryUsage.percentage * 100).toFixed(1)}%`
				);
			}

			return {
				status: HEALTH_STATUS.HEALTHY,
				memoryUsage: memoryUsage.percentage,
				uptime,
				activeOperations: this.activeOperations.size
			};
		} catch (error) {
			console.error('Basic health check failed:', error);
			return {
				status: HEALTH_STATUS.WARNING,
				error: error.message
			};
		}
	}

	/**
	 * Perform detailed health check (comprehensive)
	 * @returns {Promise<Object>} Detailed health check result
	 */
	async performDetailedHealthCheck() {
		try {
			return await this.performHealthCheck();
		} catch (error) {
			console.error('Detailed health check failed:', error);
			return {
				status: HEALTH_STATUS.CRITICAL,
				error: error.message
			};
		}
	}

	/**
	 * Perform self-healing operations
	 * @returns {Promise<void>}
	 */
	async performSelfHealing() {
		if (!this.isMonitoring) {
			return;
		}

		console.log('Performing self-healing checks...');
		const healingResults = [];

		try {
			// Memory cleanup if needed
			const memoryUsage = this.getMemoryUsage();
			if (
				memoryUsage.percentage >
				HEALTH_CONFIG.selfHealing.memoryCleanupThreshold
			) {
				const memoryResult = await this.performMemoryCleanup();
				healingResults.push(memoryResult);
			}

			// Clean up stale operations
			const staleResult = await this.cleanupStaleOperations();
			if (staleResult.cleaned > 0) {
				healingResults.push(staleResult);
			}

			// Tag recovery for corrupted contexts
			const tagResult = await this.recoverCorruptedTags();
			if (tagResult.recovered > 0) {
				healingResults.push(tagResult);
			}

			if (healingResults.length > 0) {
				console.log('Self-healing actions completed:', healingResults);
			}
		} catch (error) {
			console.error('Self-healing failed:', error);
			this.addIssue(
				'SELF_HEALING_FAILED',
				`Self-healing error: ${error.message}`
			);
		}
	}

	/**
	 * Check memory usage
	 * @returns {Object} Memory usage information
	 */
	checkMemoryUsage() {
		const memUsage = this.getMemoryUsage();

		let status = HEALTH_STATUS.HEALTHY;
		const issues = [];

		if (memUsage.percentage > HEALTH_CONFIG.thresholds.memoryUsageCritical) {
			status = HEALTH_STATUS.CRITICAL;
			issues.push(
				`Critical memory usage: ${(memUsage.percentage * 100).toFixed(1)}%`
			);
		} else if (
			memUsage.percentage > HEALTH_CONFIG.thresholds.memoryUsageWarning
		) {
			status = HEALTH_STATUS.WARNING;
			issues.push(
				`High memory usage: ${(memUsage.percentage * 100).toFixed(1)}%`
			);
		}

		return {
			status,
			usage: memUsage,
			issues
		};
	}

	/**
	 * Check file system health
	 * @returns {Promise<Object>} File system health information
	 */
	async checkFileSystemHealth() {
		const issues = [];
		let status = HEALTH_STATUS.HEALTHY;

		try {
			// Check if .taskmaster directory exists and is accessible
			const taskMasterDir = getTaskMasterDirectory(this.projectRoot);
			await fs.access(taskMasterDir);

			// Check if tasks.json exists and is readable
			const tasksFilePath = getTasksFilePath(this.projectRoot);
			try {
				await fs.access(tasksFilePath, fs.constants.R_OK | fs.constants.W_OK);

				// Validate tasks.json structure
				const tasksContent = await fs.readFile(tasksFilePath, 'utf8');
				JSON.parse(tasksContent); // Basic JSON validation
			} catch (tasksError) {
				status = HEALTH_STATUS.WARNING;
				issues.push(`Tasks file issue: ${tasksError.message}`);
				this.metrics.fileSystemErrors++;
				this.metrics.lastFileSystemError = Date.now();
			}
		} catch (error) {
			status = HEALTH_STATUS.CRITICAL;
			issues.push(`File system error: ${error.message}`);
			this.metrics.fileSystemErrors++;
			this.metrics.lastFileSystemError = Date.now();
		}

		return {
			status,
			directory: getTaskMasterDirectory(this.projectRoot),
			tasksFile: getTasksFilePath(this.projectRoot),
			issues
		};
	}

	/**
	 * Check tag system health
	 * @returns {Promise<Object>} Tag system health information
	 */
	async checkTagSystemHealth() {
		const issues = [];
		let status = HEALTH_STATUS.HEALTHY;

		try {
			const tasksFilePath = getTasksFilePath(this.projectRoot);
			const tasksContent = await fs.readFile(tasksFilePath, 'utf8');
			const tasksData = JSON.parse(tasksContent);

			// Validate tag structure
			if (!tasksData || typeof tasksData !== 'object') {
				status = HEALTH_STATUS.CRITICAL;
				issues.push('Invalid tasks data structure');
				return { status, issues };
			}

			// Check for at least one tag (should have 'master' at minimum)
			const tags = Object.keys(tasksData);
			if (tags.length === 0) {
				status = HEALTH_STATUS.WARNING;
				issues.push('No tags found in tasks data');
			}

			// Validate each tag structure
			for (const tagName of tags) {
				const tagData = tasksData[tagName];

				if (!tagData.tasks || !Array.isArray(tagData.tasks)) {
					status = HEALTH_STATUS.WARNING;
					issues.push(`Tag '${tagName}' has invalid tasks structure`);
				}

				if (!tagData.metadata || typeof tagData.metadata !== 'object') {
					status = HEALTH_STATUS.WARNING;
					issues.push(`Tag '${tagName}' has invalid metadata structure`);
				}
			}
		} catch (error) {
			status = HEALTH_STATUS.CRITICAL;
			issues.push(`Tag system error: ${error.message}`);
		}

		return {
			status,
			issues
		};
	}

	/**
	 * Check operational metrics
	 * @returns {Object} Operational metrics information
	 */
	checkOperationalMetrics() {
		const issues = [];
		let status = HEALTH_STATUS.HEALTHY;

		// Check response time
		if (
			this.metrics.averageResponseTime >
			HEALTH_CONFIG.thresholds.responseTimeCritical
		) {
			status = HEALTH_STATUS.CRITICAL;
			issues.push(
				`Critical response time: ${this.metrics.averageResponseTime}ms`
			);
		} else if (
			this.metrics.averageResponseTime >
			HEALTH_CONFIG.thresholds.responseTimeWarning
		) {
			status = HEALTH_STATUS.WARNING;
			issues.push(`High response time: ${this.metrics.averageResponseTime}ms`);
		}

		// Check active operations count
		if (
			this.activeOperations.size > HEALTH_CONFIG.selfHealing.maxActiveOperations
		) {
			status = HEALTH_STATUS.WARNING;
			issues.push(
				`High active operations count: ${this.activeOperations.size}`
			);
		}

		return {
			status,
			metrics: { ...this.metrics },
			activeOperations: this.activeOperations.size,
			issues
		};
	}

	/**
	 * Determine overall health status from individual checks
	 * @param {Object} checkResults - Results from individual health checks
	 * @returns {string} Overall health status
	 */
	determineHealthStatus(checkResults) {
		const statuses = Object.values(checkResults)
			.filter((result) => result && result.status)
			.map((result) => result.status);

		if (statuses.includes(HEALTH_STATUS.CRITICAL)) {
			return HEALTH_STATUS.CRITICAL;
		}

		if (statuses.includes(HEALTH_STATUS.WARNING)) {
			return HEALTH_STATUS.WARNING;
		}

		if (statuses.length > 0) {
			return HEALTH_STATUS.HEALTHY;
		}

		return HEALTH_STATUS.UNKNOWN;
	}

	/**
	 * Update health status and track changes
	 * @param {string} newStatus - New health status
	 * @param {Object} healthReport - Health check report
	 */
	updateHealthStatus(newStatus, healthReport) {
		const previousStatus = this.healthStatus;
		this.healthStatus = newStatus;

		// Track consecutive failures
		if (
			newStatus === HEALTH_STATUS.CRITICAL ||
			newStatus === HEALTH_STATUS.WARNING
		) {
			this.consecutiveFailures++;
		} else {
			this.consecutiveFailures = 0;
		}

		// Add to health history
		this.healthHistory.push({
			timestamp: Date.now(),
			status: newStatus,
			previousStatus,
			consecutiveFailures: this.consecutiveFailures,
			checkDuration: healthReport.duration || 0
		});

		// Trim history to max size
		if (this.healthHistory.length > this.maxHistorySize) {
			this.healthHistory.splice(
				0,
				this.healthHistory.length - this.maxHistorySize
			);
		}
	}

	/**
	 * Get current memory usage
	 * @returns {Object} Memory usage information
	 */
	getMemoryUsage() {
		const memUsage = process.memoryUsage();
		const totalMem = memUsage.heapTotal;
		const usedMem = memUsage.heapUsed;
		const externalMem = memUsage.external;

		return {
			heapUsed: usedMem,
			heapTotal: totalMem,
			external: externalMem,
			rss: memUsage.rss,
			percentage: usedMem / totalMem,
			heapUsedMB: Math.round(usedMem / 1024 / 1024),
			heapTotalMB: Math.round(totalMem / 1024 / 1024)
		};
	}

	/**
	 * Perform memory cleanup
	 * @returns {Promise<Object>} Cleanup result
	 */
	async performMemoryCleanup() {
		console.log('Performing memory cleanup...');

		const beforeCleanup = this.getMemoryUsage();

		try {
			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			// Clear resolved issues older than 1 hour
			const oneHourAgo = Date.now() - 3600000;
			this.resolvedIssues = this.resolvedIssues.filter(
				(issue) => issue.resolvedAt > oneHourAgo
			);

			// Trim health history if too large
			if (this.healthHistory.length > this.maxHistorySize) {
				this.healthHistory.splice(
					0,
					this.healthHistory.length - this.maxHistorySize
				);
			}

			const afterCleanup = this.getMemoryUsage();
			const memoryFreed = beforeCleanup.heapUsed - afterCleanup.heapUsed;

			console.log(
				`Memory cleanup completed. Freed: ${Math.round(memoryFreed / 1024 / 1024)}MB`
			);

			return {
				action: 'memory_cleanup',
				beforeUsage: beforeCleanup,
				afterUsage: afterCleanup,
				memoryFreed,
				success: true
			};
		} catch (error) {
			console.error('Memory cleanup failed:', error);
			return {
				action: 'memory_cleanup',
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Clean up stale operations
	 * @returns {Promise<Object>} Cleanup result
	 */
	async cleanupStaleOperations() {
		const now = Date.now();
		const staleTimeout = HEALTH_CONFIG.selfHealing.staleOperationTimeout;
		let cleanedCount = 0;

		for (const [operationId, operation] of this.activeOperations.entries()) {
			if (now - operation.startTime > staleTimeout) {
				console.warn(`Cleaning up stale operation: ${operationId}`);
				this.activeOperations.delete(operationId);
				cleanedCount++;
			}
		}

		if (cleanedCount > 0) {
			console.log(`Cleaned up ${cleanedCount} stale operations`);
		}

		return {
			action: 'cleanup_stale_operations',
			cleaned: cleanedCount,
			remaining: this.activeOperations.size,
			success: true
		};
	}

	/**
	 * Recover corrupted tags
	 * @returns {Promise<Object>} Recovery result
	 */
	async recoverCorruptedTags() {
		let recoveredCount = 0;
		const errors = [];

		try {
			const tasksFilePath = getTasksFilePath(this.projectRoot);

			// Check if tasks file exists
			try {
				await fs.access(tasksFilePath);
			} catch (error) {
				// Create minimal tasks file if missing
				console.log('Creating missing tasks.json file...');

				const tasksDir = path.dirname(tasksFilePath);
				await fs.mkdir(tasksDir, { recursive: true });

				const initialData = {
					master: {
						tasks: [],
						metadata: {
							created: new Date().toISOString(),
							updated: new Date().toISOString(),
							description: 'Tasks for master context'
						}
					}
				};

				await fs.writeFile(tasksFilePath, JSON.stringify(initialData, null, 2));
				recoveredCount++;
			}

			// Validate and repair task structure
			try {
				const tasksContent = await fs.readFile(tasksFilePath, 'utf8');
				const tasksData = JSON.parse(tasksContent);
				let needsRepair = false;

				// Ensure master tag exists
				if (!tasksData.master) {
					console.log('Repairing missing master tag...');
					tasksData.master = {
						tasks: [],
						metadata: {
							created: new Date().toISOString(),
							updated: new Date().toISOString(),
							description: 'Tasks for master context'
						}
					};
					needsRepair = true;
					recoveredCount++;
				}

				// Validate each tag structure
				for (const [tagName, tagData] of Object.entries(tasksData)) {
					if (!tagData || typeof tagData !== 'object') {
						console.log(`Repairing corrupted tag: ${tagName}`);
						tasksData[tagName] = {
							tasks: [],
							metadata: {
								created: new Date().toISOString(),
								updated: new Date().toISOString(),
								description: `Tasks for ${tagName} context`
							}
						};
						needsRepair = true;
						recoveredCount++;
					} else {
						// Ensure required properties exist
						if (!tagData.tasks || !Array.isArray(tagData.tasks)) {
							tagData.tasks = [];
							needsRepair = true;
						}

						if (!tagData.metadata || typeof tagData.metadata !== 'object') {
							tagData.metadata = {
								created: new Date().toISOString(),
								updated: new Date().toISOString(),
								description: `Tasks for ${tagName} context`
							};
							needsRepair = true;
						}
					}
				}

				// Write repaired data back if needed
				if (needsRepair) {
					// Create backup before repair
					const backupPath = `${tasksFilePath}.backup.${Date.now()}`;
					await fs.writeFile(backupPath, tasksContent);
					console.log(`Created backup: ${backupPath}`);

					await fs.writeFile(tasksFilePath, JSON.stringify(tasksData, null, 2));
					console.log('Repaired tasks.json structure');
				}
			} catch (parseError) {
				errors.push(`Failed to parse/repair tasks.json: ${parseError.message}`);
			}
		} catch (error) {
			errors.push(`Tag recovery failed: ${error.message}`);
		}

		return {
			action: 'recover_corrupted_tags',
			recovered: recoveredCount,
			errors,
			success: errors.length === 0
		};
	}

	/**
	 * Add an issue to tracking
	 * @param {string} type - Issue type
	 * @param {string} message - Issue message
	 */
	addIssue(type, message) {
		const existingIssue = this.currentIssues.find(
			(issue) => issue.type === type
		);

		if (!existingIssue) {
			this.currentIssues.push({
				type,
				message,
				firstOccurred: Date.now(),
				lastOccurred: Date.now(),
				occurrenceCount: 1
			});
		} else {
			existingIssue.lastOccurred = Date.now();
			existingIssue.occurrenceCount++;
			existingIssue.message = message; // Update with latest message
		}
	}

	/**
	 * Resolve an issue
	 * @param {string} type - Issue type to resolve
	 */
	resolveIssue(type) {
		const issueIndex = this.currentIssues.findIndex(
			(issue) => issue.type === type
		);

		if (issueIndex !== -1) {
			const resolvedIssue = this.currentIssues.splice(issueIndex, 1)[0];
			resolvedIssue.resolvedAt = Date.now();
			this.resolvedIssues.push(resolvedIssue);
		}
	}

	/**
	 * Track operation start
	 * @param {string} operationId - Operation identifier
	 * @param {string} operationType - Type of operation
	 */
	trackOperationStart(operationId, operationType) {
		this.activeOperations.set(operationId, {
			type: operationType,
			startTime: Date.now()
		});

		this.metrics.requestCount++;
		if (operationType.includes('tag')) {
			this.metrics.tagOperations++;
			this.metrics.lastTagOperation = Date.now();
		}
	}

	/**
	 * Track operation completion
	 * @param {string} operationId - Operation identifier
	 * @param {boolean} success - Whether operation succeeded
	 * @param {number} responseTime - Operation response time
	 */
	trackOperationComplete(operationId, success, responseTime) {
		this.activeOperations.delete(operationId);

		if (success) {
			this.metrics.successfulRequests++;
		} else {
			this.metrics.failedRequests++;
		}

		// Update response time metrics
		this.metrics.lastResponseTime = responseTime;
		if (this.metrics.averageResponseTime === 0) {
			this.metrics.averageResponseTime = responseTime;
		} else {
			// Simple moving average
			this.metrics.averageResponseTime =
				this.metrics.averageResponseTime * 0.9 + responseTime * 0.1;
		}
	}

	/**
	 * Get current health status
	 * @returns {Object} Current health status
	 */
	getHealthStatus() {
		return {
			status: this.healthStatus,
			lastCheck: this.lastHealthCheck,
			consecutiveFailures: this.consecutiveFailures,
			isMonitoring: this.isMonitoring,
			uptime: process.uptime(),
			metrics: { ...this.metrics },
			currentIssues: [...this.currentIssues],
			activeOperations: this.activeOperations.size
		};
	}

	/**
	 * Get health history
	 * @param {number} limit - Number of history entries to return
	 * @returns {Array} Health history entries
	 */
	getHealthHistory(limit = 20) {
		return this.healthHistory.slice(-limit);
	}
}

/**
 * Global health monitor instance
 */
let globalHealthMonitor = null;

/**
 * Initialize health monitor
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<HealthMonitor>} Health monitor instance
 */
export async function initializeHealthMonitor(projectRoot) {
	if (globalHealthMonitor) {
		console.log('Health monitor already initialized');
		return globalHealthMonitor;
	}

	globalHealthMonitor = new HealthMonitor(projectRoot);
	await globalHealthMonitor.startMonitoring();

	console.log('Health monitor initialized successfully');
	return globalHealthMonitor;
}

/**
 * Get health monitor instance
 * @returns {HealthMonitor|null} Health monitor instance
 */
export function getHealthMonitor() {
	return globalHealthMonitor;
}

/**
 * Stop health monitor
 * @returns {Promise<void>}
 */
export async function stopHealthMonitor() {
	if (globalHealthMonitor) {
		await globalHealthMonitor.stopMonitoring();
		globalHealthMonitor = null;
		console.log('Health monitor stopped');
	}
}

/**
 * Health monitoring middleware
 * Tracks request metrics and operation performance
 */
export function healthMonitoringMiddleware() {
	return (req, res, next) => {
		if (!globalHealthMonitor) {
			return next();
		}

		const startTime = Date.now();
		const operationId =
			req.correlationId ||
			`req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const operationType = `${req.method}_${req.path}`;

		// Track operation start
		globalHealthMonitor.trackOperationStart(operationId, operationType);

		// Monitor response completion
		res.on('finish', () => {
			const responseTime = Date.now() - startTime;
			const success = res.statusCode < 400;

			globalHealthMonitor.trackOperationComplete(
				operationId,
				success,
				responseTime
			);
		});

		next();
	};
}

export { HealthMonitor, HEALTH_STATUS, HEALTH_CONFIG };
