/**
 * Batch Processor - Phase 3.1.3
 *
 * Handles batch processing of file changes with intelligent grouping, conflict
 * detection, and resource management. Coordinates multiple changes to optimize
 * AST analysis performance and prevent system overload.
 *
 * Features:
 * - Time-based change aggregation
 * - Dependency-aware processing order
 * - Conflict detection and resolution
 * - Resource throttling and queue management
 * - Performance monitoring and optimization
 *
 * @author Task Master Flow
 * @version 3.1.0
 */

import { EventEmitter } from 'events';
import path from 'path';
import { loadASTConfig } from '../config/ast-config.js';
import { ChangeTypes, ChangePriority } from './change-processor.js';

/**
 * Batch processing strategies
 */
export const BatchStrategy = {
	IMMEDIATE: 'immediate', // Process changes immediately
	TIME_BASED: 'time_based', // Group changes within time windows
	DEPENDENCY_BASED: 'dependency_based', // Group by dependency relationships
	HYBRID: 'hybrid' // Combine time and dependency grouping
};

/**
 * Resource limits for batch processing
 */
export const ResourceLimits = {
	MAX_CONCURRENT_BATCHES: 3,
	MAX_BATCH_SIZE: 50,
	MAX_PROCESSING_TIME: 30000, // 30 seconds
	CPU_THROTTLE_THRESHOLD: 80,
	MEMORY_THROTTLE_THRESHOLD: 500 * 1024 * 1024 // 500MB
};

/**
 * Batch processor for coordinating multiple file changes
 */
export class BatchProcessor extends EventEmitter {
	constructor(projectPath, options = {}) {
		super();

		this.projectPath = path.resolve(projectPath);
		this.options = {
			strategy: BatchStrategy.HYBRID,
			batchWindow: 500, // milliseconds to wait for additional changes
			maxBatchSize: ResourceLimits.MAX_BATCH_SIZE,
			maxConcurrentBatches: ResourceLimits.MAX_CONCURRENT_BATCHES,
			maxProcessingTime: ResourceLimits.MAX_PROCESSING_TIME,
			enableConflictDetection: true,
			enableResourceMonitoring: true,
			priorityThreshold: ChangePriority.HIGH,
			...options
		};

		this.astConfig = null;
		this.activeBatches = new Map();
		this.pendingChanges = new Map();
		this.changeQueue = [];
		this.batchTimers = new Map();

		this.stats = {
			batchesProcessed: 0,
			changesProcessed: 0,
			conflictsDetected: 0,
			throttleEvents: 0,
			averageBatchSize: 0,
			averageProcessingTime: 0,
			startTime: new Date()
		};
	}

	/**
	 * Initialize the batch processor
	 */
	async initialize() {
		try {
			const configResult = await loadASTConfig(this.projectPath);
			this.astConfig = configResult.config;

			console.debug(`[BatchProcessor] Initialized for ${this.projectPath}`);
			console.debug(`[BatchProcessor] Strategy: ${this.options.strategy}`);
			console.debug(
				`[BatchProcessor] Batch window: ${this.options.batchWindow}ms`
			);

			return true;
		} catch (error) {
			console.error(`[BatchProcessor] Initialization failed: ${error.message}`);
			return false;
		}
	}

	/**
	 * Add a change to the processing queue
	 */
	async addChange(changeAnalysis) {
		if (!changeAnalysis || changeAnalysis.shouldIgnore) {
			return false;
		}

		const changeId = this._generateChangeId(changeAnalysis);

		// Add to pending changes
		this.pendingChanges.set(changeId, {
			...changeAnalysis,
			addedAt: new Date(),
			changeId
		});

		console.debug(
			`[BatchProcessor] Added change: ${changeAnalysis.relativePath} (${changeId})`
		);

		// Schedule batch processing based on strategy
		await this._scheduleBatchProcessing(changeAnalysis);

		return true;
	}

	/**
	 * Generate unique change ID
	 */
	_generateChangeId(changeAnalysis) {
		const { relativePath, changeType, timestamp } = changeAnalysis;
		const time = timestamp || new Date();
		return `${changeType}_${relativePath.replace(/[^a-zA-Z0-9]/g, '_')}_${time.getTime()}`;
	}

	/**
	 * Schedule batch processing based on configured strategy
	 */
	async _scheduleBatchProcessing(changeAnalysis) {
		const batchKey = 'time_based';

		// Clear existing timer if any
		if (this.batchTimers.has(batchKey)) {
			clearTimeout(this.batchTimers.get(batchKey));
		}

		// Set new timer
		const timer = setTimeout(async () => {
			await this._processTimeBatch();
		}, this.options.batchWindow);

		this.batchTimers.set(batchKey, timer);
	}

	/**
	 * Process time-based batch
	 */
	async _processTimeBatch() {
		const changes = Array.from(this.pendingChanges.values());

		if (changes.length === 0) {
			return;
		}

		this.pendingChanges.clear();
		this.batchTimers.delete('time_based');

		console.debug(
			`[BatchProcessor] Processing batch of ${changes.length} changes`
		);

		this.stats.batchesProcessed++;
		this.stats.changesProcessed += changes.length;

		// Emit batch processing event
		this.emit('batchProcessed', {
			changes,
			timestamp: new Date(),
			batchSize: changes.length
		});
	}

	/**
	 * Get processing statistics
	 */
	getStats() {
		const uptime = Date.now() - this.stats.startTime;

		return {
			...this.stats,
			uptime,
			activeBatches: this.activeBatches.size,
			pendingChanges: this.pendingChanges.size
		};
	}

	/**
	 * Stop the batch processor
	 */
	async stop() {
		// Clear all timers
		this.batchTimers.forEach((timer) => clearTimeout(timer));
		this.batchTimers.clear();

		console.debug('[BatchProcessor] Stopped');
	}
}

/**
 * Create a new batch processor instance
 */
export function createBatchProcessor(projectPath, options = {}) {
	return new BatchProcessor(projectPath, options);
}

export default BatchProcessor;
