import EventEmitter from 'events';
import path from 'path';

/**
 * Batch processing strategies
 */
export const BatchStrategy = {
	TIME_BASED: 'time_based', // Collect changes for a time window
	COUNT_BASED: 'count_based', // Process after N changes
	SIZE_BASED: 'size_based', // Process based on scope size
	HYBRID: 'hybrid', // Combination of strategies
	IMMEDIATE: 'immediate' // Process each change immediately
};

/**
 * Priority levels for batch processing
 */
export const BatchPriority = {
	CRITICAL: 0, // Process immediately
	HIGH: 1, // Process in next batch
	MEDIUM: 2, // Normal batch processing
	LOW: 3 // Can be delayed
};

/**
 * Batch invalidation manager for efficient handling of multiple changes
 */
export class BatchInvalidation extends EventEmitter {
	constructor(options = {}) {
		super();

		this.strategy = options.strategy || BatchStrategy.HYBRID;
		this.selectiveInvalidation = options.selectiveInvalidation;
		this.contentHasher = options.contentHasher;
		this.dependencyTracker = options.dependencyTracker;

		// Batch configuration
		this.batchWindow = options.batchWindow || 500; // ms
		this.maxBatchSize = options.maxBatchSize || 50;
		this.maxScopeSize = options.maxScopeSize || 200;
		this.maxWaitTime = options.maxWaitTime || 5000; // ms

		// Batch state
		this.pendingChanges = new Map();
		this.processingBatch = false;
		this.batchTimer = null;
		this.lastProcessTime = null;

		// Priority queues
		this.priorityQueues = {
			[BatchPriority.CRITICAL]: [],
			[BatchPriority.HIGH]: [],
			[BatchPriority.MEDIUM]: [],
			[BatchPriority.LOW]: []
		};

		// Deduplication tracking
		this.changeDeduplicator = new Map();
		this.contentHistory = new Map();

		// Statistics
		this.stats = {
			batchesProcessed: 0,
			changesQueued: 0,
			changesDeduped: 0,
			averageBatchSize: 0,
			averageProcessingTime: 0,
			totalInvalidated: 0,
			strategiesUsed: {}
		};
	}

	/**
	 * Queue a change for batch processing
	 */
	async queueChange(changeEvent, options = {}) {
		const priority = options.priority || BatchPriority.MEDIUM;
		const forceImmediate = options.immediate || false;

		try {
			// Normalize change event
			const normalizedChange = await this._normalizeChange(changeEvent);

			// Check for deduplication
			if (this._isDuplicateChange(normalizedChange)) {
				this.stats.changesDeduped++;
				return { queued: false, reason: 'duplicate' };
			}

			// Record change for deduplication
			this._recordChange(normalizedChange);

			this.stats.changesQueued++;

			// Handle critical priority or immediate processing
			if (priority === BatchPriority.CRITICAL || forceImmediate) {
				return await this._processImmediate(normalizedChange);
			}

			// Queue for batch processing
			this.priorityQueues[priority].push(normalizedChange);
			this.pendingChanges.set(normalizedChange.id, normalizedChange);

			// Trigger batch processing based on strategy
			await this._triggerBatchProcessing();

			this.emit('changeQueued', normalizedChange);

			return {
				queued: true,
				id: normalizedChange.id,
				priority,
				estimatedProcessTime: this._estimateProcessTime()
			};
		} catch (error) {
			console.error(
				`[BatchInvalidation] Error queueing change: ${error.message}`
			);
			return { queued: false, error: error.message };
		}
	}

	/**
	 * Queue multiple changes at once
	 */
	async queueChanges(changeEvents, options = {}) {
		const results = [];

		for (const changeEvent of changeEvents) {
			const result = await this.queueChange(changeEvent, options);
			results.push({ change: changeEvent, ...result });
		}

		return results;
	}

	/**
	 * Process all pending changes immediately
	 */
	async flushBatches() {
		if (this.processingBatch) {
			// Wait for current batch to complete
			return new Promise((resolve) => {
				this.once('batchComplete', resolve);
			});
		}

		await this._processBatches();
	}

	/**
	 * Get current batch status
	 */
	getBatchStatus() {
		const totalPending = Object.values(this.priorityQueues).reduce(
			(sum, queue) => sum + queue.length,
			0
		);

		return {
			totalPending,
			processing: this.processingBatch,
			pendingByPriority: {
				critical: this.priorityQueues[BatchPriority.CRITICAL].length,
				high: this.priorityQueues[BatchPriority.HIGH].length,
				medium: this.priorityQueues[BatchPriority.MEDIUM].length,
				low: this.priorityQueues[BatchPriority.LOW].length
			},
			nextProcessTime: this.batchTimer ? Date.now() + this.batchWindow : null,
			stats: this.getStats()
		};
	}

	/**
	 * Cancel pending batches
	 */
	cancelPendingBatches() {
		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
			this.batchTimer = null;
		}

		const cancelledCount = this.pendingChanges.size;

		// Clear all queues
		for (const priority in this.priorityQueues) {
			this.priorityQueues[priority] = [];
		}

		this.pendingChanges.clear();

		this.emit('batchesCancelled', { cancelled: cancelledCount });

		return { cancelled: cancelledCount };
	}

	/**
	 * Normalize change event for consistent processing
	 */
	async _normalizeChange(changeEvent) {
		const id = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		let contentHash = null;
		if (changeEvent.newContent && this.contentHasher) {
			const ext = path.extname(changeEvent.filePath);
			const language = this.contentHasher._detectLanguage(ext);
			contentHash = await this.contentHasher.generateHash(
				changeEvent.filePath,
				changeEvent.newContent,
				language
			);
		}

		return {
			id,
			filePath: changeEvent.filePath,
			changeType: changeEvent.changeType || 'modify',
			oldContent: changeEvent.oldContent,
			newContent: changeEvent.newContent,
			contentHash,
			timestamp: new Date(),
			...changeEvent
		};
	}

	/**
	 * Check if change is a duplicate
	 */
	_isDuplicateChange(change) {
		const key = change.filePath;

		if (!this.changeDeduplicator.has(key)) {
			return false;
		}

		const existing = this.changeDeduplicator.get(key);

		// Check if content hash is the same
		if (change.contentHash && existing.contentHash) {
			return change.contentHash === existing.contentHash;
		}

		// Check if change was very recent (likely duplicate file system event)
		const timeDiff = change.timestamp - existing.timestamp;
		if (timeDiff < 100) {
			// 100ms threshold
			return true;
		}

		return false;
	}

	/**
	 * Record change for deduplication
	 */
	_recordChange(change) {
		this.changeDeduplicator.set(change.filePath, {
			id: change.id,
			contentHash: change.contentHash,
			timestamp: change.timestamp
		});

		// Keep deduplication history limited
		if (this.changeDeduplicator.size > 1000) {
			const oldest = Array.from(this.changeDeduplicator.entries())
				.sort((a, b) => a[1].timestamp - b[1].timestamp)
				.slice(0, 100);

			for (const [key] of oldest) {
				this.changeDeduplicator.delete(key);
			}
		}
	}

	/**
	 * Process change immediately (critical priority)
	 */
	async _processImmediate(change) {
		try {
			const startTime = Date.now();

			if (!this.selectiveInvalidation) {
				throw new Error(
					'Selective invalidation required for immediate processing'
				);
			}

			const result =
				await this.selectiveInvalidation.invalidateByChange(change);

			const processingTime = Date.now() - startTime;

			this.emit('immediateProcessed', { change, result, processingTime });

			return {
				processed: true,
				immediate: true,
				...result,
				processingTime
			};
		} catch (error) {
			console.error(
				`[BatchInvalidation] Error in immediate processing: ${error.message}`
			);
			return { processed: false, error: error.message };
		}
	}

	/**
	 * Trigger batch processing based on strategy
	 */
	async _triggerBatchProcessing() {
		if (this.processingBatch) {
			return; // Already processing
		}

		const totalPending = Object.values(this.priorityQueues).reduce(
			(sum, queue) => sum + queue.length,
			0
		);

		if (totalPending === 0) {
			return; // Nothing to process
		}

		const config = this._getStrategyConfig();
		let shouldProcess = false;

		switch (this.strategy) {
			case BatchStrategy.TIME_BASED:
				shouldProcess = this._shouldProcessTimeBase(config);
				break;
			case BatchStrategy.COUNT_BASED:
				shouldProcess = totalPending >= config.maxCount;
				break;
			case BatchStrategy.SIZE_BASED:
				shouldProcess = await this._shouldProcessSizeBase(config);
				break;
			case BatchStrategy.HYBRID:
				shouldProcess = await this._shouldProcessHybrid(config);
				break;
			case BatchStrategy.IMMEDIATE:
				shouldProcess = true;
				break;
		}

		if (shouldProcess) {
			await this._processBatches();
		} else if (!this.batchTimer && this.strategy !== BatchStrategy.IMMEDIATE) {
			this._scheduleBatchProcessing();
		}
	}

	/**
	 * Get strategy-specific configuration
	 */
	_getStrategyConfig() {
		const configs = {
			[BatchStrategy.TIME_BASED]: {
				timeWindow: this.batchWindow
			},
			[BatchStrategy.COUNT_BASED]: {
				maxCount: this.maxBatchSize
			},
			[BatchStrategy.SIZE_BASED]: {
				maxScope: this.maxScopeSize
			},
			[BatchStrategy.HYBRID]: {
				timeWindow: this.batchWindow,
				maxCount: this.maxBatchSize,
				maxScope: this.maxScopeSize,
				maxWait: this.maxWaitTime
			}
		};

		return configs[this.strategy] || configs[BatchStrategy.HYBRID];
	}

	/**
	 * Check if should process based on time
	 */
	_shouldProcessTimeBase(config) {
		if (!this.lastProcessTime) {
			return true;
		}

		return Date.now() - this.lastProcessTime >= config.timeWindow;
	}

	/**
	 * Check if should process based on estimated scope size
	 */
	async _shouldProcessSizeBase(config) {
		if (!this.selectiveInvalidation) {
			return false;
		}

		try {
			const pendingChanges = Array.from(this.pendingChanges.values());
			const preview =
				await this.selectiveInvalidation.previewInvalidation(pendingChanges);
			const totalScope = preview.reduce(
				(sum, p) => sum + (p.estimatedFiles || 0),
				0
			);

			return totalScope >= config.maxScope;
		} catch (error) {
			console.error(
				`[BatchInvalidation] Error estimating scope: ${error.message}`
			);
			return false;
		}
	}

	/**
	 * Check if should process using hybrid strategy
	 */
	async _shouldProcessHybrid(config) {
		const totalPending = Object.values(this.priorityQueues).reduce(
			(sum, queue) => sum + queue.length,
			0
		);

		// Process if we hit count threshold
		if (totalPending >= config.maxCount) {
			return true;
		}

		// Process if we've been waiting too long
		if (
			this.lastProcessTime &&
			Date.now() - this.lastProcessTime >= config.maxWait
		) {
			return true;
		}

		// Process if estimated scope is large
		return await this._shouldProcessSizeBase(config);
	}

	/**
	 * Schedule batch processing
	 */
	_scheduleBatchProcessing() {
		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
		}

		this.batchTimer = setTimeout(async () => {
			this.batchTimer = null;
			await this._processBatches();
		}, this.batchWindow);
	}

	/**
	 * Process all pending batches
	 */
	async _processBatches() {
		if (this.processingBatch) {
			return; // Already processing
		}

		this.processingBatch = true;
		const startTime = Date.now();

		try {
			// Process by priority
			const results = [];

			for (const priority of [
				BatchPriority.HIGH,
				BatchPriority.MEDIUM,
				BatchPriority.LOW
			]) {
				const queue = this.priorityQueues[priority];

				if (queue.length > 0) {
					const batchResult = await this._processPriorityBatch(queue, priority);
					results.push(...batchResult);
					queue.length = 0; // Clear processed queue
				}
			}

			// Clear processed changes
			for (const result of results) {
				if (result.change && result.change.id) {
					this.pendingChanges.delete(result.change.id);
				}
			}

			const processingTime = Date.now() - startTime;
			this.lastProcessTime = Date.now();

			// Update statistics
			this._updateBatchStats(results.length, processingTime);

			this.emit('batchComplete', {
				results,
				processingTime,
				totalProcessed: results.length
			});

			return results;
		} catch (error) {
			console.error(
				`[BatchInvalidation] Error processing batches: ${error.message}`
			);
			this.emit('batchError', error);
			return [];
		} finally {
			this.processingBatch = false;
		}
	}

	/**
	 * Process a batch of changes with the same priority
	 */
	async _processPriorityBatch(changes, priority) {
		if (!this.selectiveInvalidation) {
			throw new Error('Selective invalidation required for batch processing');
		}

		const results = [];

		// Group changes by file for optimization
		const changesByFile = this._groupChangesByFile(changes);

		// Process each file's changes
		for (const [filePath, fileChanges] of changesByFile.entries()) {
			try {
				// Use the most recent change for each file
				const latestChange = fileChanges[fileChanges.length - 1];

				const result =
					await this.selectiveInvalidation.invalidateByChange(latestChange);

				results.push({
					change: latestChange,
					consolidatedChanges: fileChanges.length,
					priority,
					...result
				});
			} catch (error) {
				console.error(
					`[BatchInvalidation] Error processing ${filePath}: ${error.message}`
				);
				results.push({
					change: fileChanges[0],
					error: error.message,
					priority
				});
			}
		}

		return results;
	}

	/**
	 * Group changes by file path for consolidation
	 */
	_groupChangesByFile(changes) {
		const grouped = new Map();

		for (const change of changes) {
			if (!grouped.has(change.filePath)) {
				grouped.set(change.filePath, []);
			}
			grouped.get(change.filePath).push(change);
		}

		// Sort each group by timestamp
		for (const [filePath, fileChanges] of grouped.entries()) {
			fileChanges.sort((a, b) => a.timestamp - b.timestamp);
		}

		return grouped;
	}

	/**
	 * Estimate processing time for current queue
	 */
	_estimateProcessTime() {
		const totalPending = Object.values(this.priorityQueues).reduce(
			(sum, queue) => sum + queue.length,
			0
		);

		if (totalPending === 0) {
			return 0;
		}

		// Base estimation on historical average
		const avgProcessingTime = this.stats.averageProcessingTime || 100;
		const timeToNextBatch = this.batchTimer ? this.batchWindow : 0;

		return (
			timeToNextBatch + (avgProcessingTime * totalPending) / this.maxBatchSize
		);
	}

	/**
	 * Update batch processing statistics
	 */
	_updateBatchStats(batchSize, processingTime) {
		this.stats.batchesProcessed++;

		// Update average batch size
		this.stats.averageBatchSize =
			(this.stats.averageBatchSize * (this.stats.batchesProcessed - 1) +
				batchSize) /
			this.stats.batchesProcessed;

		// Update average processing time
		this.stats.averageProcessingTime =
			(this.stats.averageProcessingTime * (this.stats.batchesProcessed - 1) +
				processingTime) /
			this.stats.batchesProcessed;

		// Update strategy usage
		if (!this.stats.strategiesUsed[this.strategy]) {
			this.stats.strategiesUsed[this.strategy] = 0;
		}
		this.stats.strategiesUsed[this.strategy]++;
	}

	/**
	 * Get processing statistics
	 */
	getStats() {
		return {
			...this.stats,
			currentStrategy: this.strategy,
			pendingChanges: this.pendingChanges.size,
			lastProcessTime: this.lastProcessTime,
			processingBatch: this.processingBatch
		};
	}

	/**
	 * Reset statistics
	 */
	resetStats() {
		this.stats = {
			batchesProcessed: 0,
			changesQueued: 0,
			changesDeduped: 0,
			averageBatchSize: 0,
			averageProcessingTime: 0,
			totalInvalidated: 0,
			strategiesUsed: {}
		};
	}

	/**
	 * Cleanup resources
	 */
	cleanup() {
		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
			this.batchTimer = null;
		}

		this.cancelPendingBatches();
		this.changeDeduplicator.clear();
		this.contentHistory.clear();
		this.removeAllListeners();
	}
}

/**
 * Create a new batch invalidation instance
 */
export function createBatchInvalidation(options = {}) {
	return new BatchInvalidation(options);
}

export default BatchInvalidation;
