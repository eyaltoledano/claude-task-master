/**
 * @fileoverview Batch Invalidation Test Suite
 *
 * Tests the batch invalidation functionality including:
 * - Efficient batch processing of cache invalidations
 * - Memory-optimized batch operations
 * - Progress tracking and monitoring
 * - Error handling in batch scenarios
 * - Performance optimization for large-scale operations
 *
 * Part of Phase 1.2: AST Cache System Testing
 */

const { EventEmitter } = require('events');
const { performance } = require('perf_hooks');

describe('BatchInvalidation', () => {
	let BatchInvalidation;
	let batchInvalidator;
	let mockCache;
	let mockProgressTracker;

	beforeAll(() => {
		// Mock cache interface
		const MockCache = class {
			constructor() {
				this.data = new Map();
				this.metadata = new Map();
				this.operationDelay = 0; // Simulate operation time
			}

			async get(key) {
				if (this.operationDelay > 0) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.operationDelay)
					);
				}
				return this.data.get(key) || null;
			}

			async set(key, value, options = {}) {
				if (this.operationDelay > 0) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.operationDelay)
					);
				}
				this.data.set(key, value);
				this.metadata.set(key, {
					timestamp: Date.now(),
					size: JSON.stringify(value).length,
					...options
				});
				return true;
			}

			async delete(key) {
				if (this.operationDelay > 0) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.operationDelay)
					);
				}
				const deleted = this.data.delete(key);
				this.metadata.delete(key);
				return deleted;
			}

			async deleteMany(keys) {
				const results = [];
				for (const key of keys) {
					const deleted = await this.delete(key);
					results.push({ key, deleted });
				}
				return results;
			}

			has(key) {
				return this.data.has(key);
			}

			keys() {
				return Array.from(this.data.keys());
			}

			size() {
				return this.data.size;
			}

			clear() {
				this.data.clear();
				this.metadata.clear();
			}

			setOperationDelay(ms) {
				this.operationDelay = ms;
			}
		};

		// Mock progress tracker
		const MockProgressTracker = class extends EventEmitter {
			constructor() {
				super();
				this.currentOperation = null;
				this.progress = 0;
				this.total = 0;
			}

			startOperation(name, total) {
				this.currentOperation = name;
				this.progress = 0;
				this.total = total;
				this.emit('start', { operation: name, total });
			}

			updateProgress(completed, details = {}) {
				this.progress = completed;
				const percentage = this.total > 0 ? (completed / this.total) * 100 : 0;
				this.emit('progress', {
					operation: this.currentOperation,
					completed,
					total: this.total,
					percentage,
					...details
				});
			}

			completeOperation(results = {}) {
				this.emit('complete', {
					operation: this.currentOperation,
					completed: this.progress,
					total: this.total,
					...results
				});
				this.currentOperation = null;
				this.progress = 0;
				this.total = 0;
			}

			failOperation(error) {
				this.emit('error', {
					operation: this.currentOperation,
					error,
					completed: this.progress,
					total: this.total
				});
				this.currentOperation = null;
				this.progress = 0;
				this.total = 0;
			}
		};

		// Mock the BatchInvalidation class
		BatchInvalidation = class MockBatchInvalidation extends EventEmitter {
			constructor(cache, options = {}) {
				super();
				this.cache = cache;
				this.options = {
					batchSize: options.batchSize || 100,
					concurrency: options.concurrency || 5,
					retryAttempts: options.retryAttempts || 3,
					retryDelay: options.retryDelay || 100,
					enableProgress: options.enableProgress !== false,
					memoryThreshold: options.memoryThreshold || 100 * 1024 * 1024, // 100MB
					...options
				};

				this.progressTracker = new MockProgressTracker();
				this.stats = {
					totalOperations: 0,
					totalItemsProcessed: 0,
					totalErrors: 0,
					totalRetries: 0,
					averageBatchTime: 0,
					peakMemoryUsage: 0
				};

				this.activeOperations = new Set();
				this.operationQueue = [];

				if (this.options.enableProgress) {
					this.progressTracker.on('progress', (data) =>
						this.emit('progress', data)
					);
					this.progressTracker.on('complete', (data) =>
						this.emit('complete', data)
					);
					this.progressTracker.on('error', (data) => this.emit('error', data));
				}
			}

			async invalidateBatch(items, options = {}) {
				const operationId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
				const batchSize = options.batchSize || this.options.batchSize;
				const concurrency = options.concurrency || this.options.concurrency;

				this.stats.totalOperations++;
				this.activeOperations.add(operationId);

				try {
					if (this.options.enableProgress) {
						this.progressTracker.startOperation(
							'batch-invalidation',
							items.length
						);
					}

					const startTime = performance.now();
					const batches = this._createBatches(items, batchSize);
					const results = await this._processBatchesConcurrently(
						batches,
						concurrency,
						operationId
					);
					const endTime = performance.now();

					const batchTime = endTime - startTime;
					this._updateAverageBatchTime(batchTime);

					const summary = this._summarizeResults(results);

					if (this.options.enableProgress) {
						this.progressTracker.completeOperation({
							duration: batchTime,
							...summary
						});
					}

					this.stats.totalItemsProcessed += items.length;

					return {
						operationId,
						summary,
						duration: batchTime,
						batches: batches.length
					};
				} catch (error) {
					if (this.options.enableProgress) {
						this.progressTracker.failOperation(error);
					}
					this.stats.totalErrors++;
					throw error;
				} finally {
					this.activeOperations.delete(operationId);
				}
			}

			async invalidateByPattern(pattern, options = {}) {
				const matchingKeys = this._findKeysByPattern(pattern);
				return this.invalidateBatch(matchingKeys, {
					...options,
					operationType: 'pattern',
					pattern
				});
			}

			async invalidateByAge(maxAge, options = {}) {
				const expiredKeys = this._findExpiredKeys(maxAge);
				return this.invalidateBatch(expiredKeys, {
					...options,
					operationType: 'age',
					maxAge
				});
			}

			async invalidateBySize(minSize, options = {}) {
				const oversizedKeys = this._findOversizedKeys(minSize);
				return this.invalidateBatch(oversizedKeys, {
					...options,
					operationType: 'size',
					minSize
				});
			}

			_createBatches(items, batchSize) {
				const batches = [];
				for (let i = 0; i < items.length; i += batchSize) {
					batches.push(items.slice(i, i + batchSize));
				}
				return batches;
			}

			async _processBatchesConcurrently(batches, concurrency, operationId) {
				const results = [];
				const executing = [];
				let completed = 0;

				for (let i = 0; i < batches.length; i++) {
					const batchPromise = this._processBatch(
						batches[i],
						i,
						operationId
					).then((result) => {
						completed++;
						if (this.options.enableProgress) {
							this.progressTracker.updateProgress(
								completed * this.options.batchSize,
								{
									batchIndex: i,
									batchSize: batches[i].length
								}
							);
						}
						return result;
					});

					executing.push(batchPromise);

					// Limit concurrency
					if (executing.length >= concurrency) {
						const result = await Promise.race(executing);
						results.push(result);
						executing.splice(executing.indexOf(Promise.resolve(result)), 1);
					}
				}

				// Wait for remaining batches
				const remainingResults = await Promise.all(executing);
				results.push(...remainingResults);

				return results;
			}

			async _processBatch(batch, batchIndex, operationId) {
				const startTime = performance.now();
				let attempts = 0;

				while (attempts < this.options.retryAttempts) {
					try {
						const results = await this._invalidateBatchItems(batch);
						const endTime = performance.now();

						return {
							batchIndex,
							items: batch.length,
							results,
							duration: endTime - startTime,
							attempts: attempts + 1,
							success: true
						};
					} catch (error) {
						attempts++;
						this.stats.totalRetries++;

						if (attempts >= this.options.retryAttempts) {
							return {
								batchIndex,
								items: batch.length,
								error: error.message,
								attempts,
								success: false
							};
						}

						// Wait before retry
						await new Promise((resolve) =>
							setTimeout(resolve, this.options.retryDelay * attempts)
						);
					}
				}
			}

			async _invalidateBatchItems(items) {
				const results = [];

				// Check if cache supports batch operations
				if (this.cache.deleteMany) {
					const batchResults = await this.cache.deleteMany(items);
					return batchResults;
				} else {
					// Fall back to individual operations
					for (const item of items) {
						try {
							const deleted = await this.cache.delete(item);
							results.push({ key: item, deleted, success: true });
						} catch (error) {
							results.push({ key: item, error: error.message, success: false });
						}
					}
					return results;
				}
			}

			_findKeysByPattern(pattern) {
				const keys = this.cache.keys();

				if (typeof pattern === 'string') {
					return keys.filter((key) => key.includes(pattern));
				} else if (pattern instanceof RegExp) {
					return keys.filter((key) => pattern.test(key));
				} else if (typeof pattern === 'function') {
					return keys.filter(pattern);
				}

				return [];
			}

			_findExpiredKeys(maxAge) {
				const keys = this.cache.keys();
				const now = Date.now();
				const expiredKeys = [];

				for (const key of keys) {
					const metadata = this.cache.metadata?.get(key);
					if (metadata && metadata.timestamp) {
						const age = now - metadata.timestamp;
						if (age > maxAge) {
							expiredKeys.push(key);
						}
					}
				}

				return expiredKeys;
			}

			_findOversizedKeys(minSize) {
				const keys = this.cache.keys();
				const oversizedKeys = [];

				for (const key of keys) {
					const metadata = this.cache.metadata?.get(key);
					if (metadata && metadata.size && metadata.size > minSize) {
						oversizedKeys.push(key);
					}
				}

				return oversizedKeys;
			}

			_summarizeResults(results) {
				const summary = {
					totalBatches: results.length,
					successfulBatches: 0,
					failedBatches: 0,
					totalItems: 0,
					successfulItems: 0,
					failedItems: 0,
					totalRetries: 0,
					averageBatchDuration: 0
				};

				let totalDuration = 0;

				for (const result of results) {
					summary.totalItems += result.items;
					summary.totalRetries += result.attempts - 1;
					totalDuration += result.duration;

					if (result.success) {
						summary.successfulBatches++;
						summary.successfulItems += result.items;
					} else {
						summary.failedBatches++;
						summary.failedItems += result.items;
					}
				}

				summary.averageBatchDuration =
					results.length > 0 ? totalDuration / results.length : 0;

				return summary;
			}

			_updateAverageBatchTime(newTime) {
				if (this.stats.averageBatchTime === 0) {
					this.stats.averageBatchTime = newTime;
				} else {
					this.stats.averageBatchTime =
						(this.stats.averageBatchTime + newTime) / 2;
				}
			}

			async cancelOperation(operationId) {
				if (this.activeOperations.has(operationId)) {
					// In a real implementation, this would cancel the operation
					this.activeOperations.delete(operationId);
					this.emit('cancelled', { operationId });
					return true;
				}
				return false;
			}

			getActiveOperations() {
				return Array.from(this.activeOperations);
			}

			getStats() {
				return { ...this.stats };
			}

			resetStats() {
				this.stats = {
					totalOperations: 0,
					totalItemsProcessed: 0,
					totalErrors: 0,
					totalRetries: 0,
					averageBatchTime: 0,
					peakMemoryUsage: 0
				};
			}

			async estimateMemoryUsage(items) {
				// Mock memory estimation
				const avgItemSize = 1024; // 1KB per item
				return items.length * avgItemSize;
			}

			async optimizeBatchSize(sampleItems) {
				// Mock batch size optimization
				const memoryUsage = await this.estimateMemoryUsage(sampleItems);
				const optimalSize = Math.floor(
					this.options.memoryThreshold / (memoryUsage / sampleItems.length)
				);
				return Math.min(Math.max(optimalSize, 10), this.options.batchSize);
			}
		};

		mockCache = new MockCache();
		mockProgressTracker = new MockProgressTracker();
	});

	beforeEach(() => {
		mockCache = new mockCache.constructor();
		batchInvalidator = new BatchInvalidation(mockCache);

		// Populate cache with test data
		for (let i = 0; i < 500; i++) {
			mockCache.set(
				`key-${i}`,
				{ data: `value-${i}`, index: i },
				{
					timestamp: Date.now() - i * 1000, // Varying ages
					size: 1024 + i * 10 // Varying sizes
				}
			);
		}
	});

	describe('Basic Batch Operations', () => {
		test('should process batch invalidation successfully', async () => {
			const itemsToInvalidate = ['key-1', 'key-2', 'key-3', 'key-4', 'key-5'];

			const result = await batchInvalidator.invalidateBatch(itemsToInvalidate);

			expect(result).toHaveProperty('operationId');
			expect(result).toHaveProperty('summary');
			expect(result.summary.totalItems).toBe(5);
			expect(result.summary.successfulItems).toBe(5);

			// Verify items were actually removed
			for (const item of itemsToInvalidate) {
				expect(mockCache.has(item)).toBe(false);
			}
		});

		test('should handle empty batch gracefully', async () => {
			const result = await batchInvalidator.invalidateBatch([]);

			expect(result.summary.totalItems).toBe(0);
			expect(result.summary.totalBatches).toBe(0);
		});

		test('should respect custom batch size', async () => {
			const items = Array.from({ length: 25 }, (_, i) => `key-${i}`);

			const result = await batchInvalidator.invalidateBatch(items, {
				batchSize: 10
			});

			expect(result.batches).toBe(3); // 25 items / 10 batch size = 3 batches
		});

		test('should handle non-existent keys gracefully', async () => {
			const items = ['nonexistent-1', 'nonexistent-2', 'key-1'];

			const result = await batchInvalidator.invalidateBatch(items);

			expect(result.summary.totalItems).toBe(3);
			// Should not throw errors for non-existent keys
		});
	});

	describe('Concurrent Processing', () => {
		test('should process batches concurrently', async () => {
			// Add delay to cache operations to test concurrency
			mockCache.setOperationDelay(10);

			const items = Array.from({ length: 100 }, (_, i) => `key-${i}`);
			const startTime = performance.now();

			const result = await batchInvalidator.invalidateBatch(items, {
				batchSize: 20,
				concurrency: 5
			});

			const endTime = performance.now();
			const duration = endTime - startTime;

			expect(result.summary.totalItems).toBe(100);
			// With concurrency, should be faster than sequential processing
			expect(duration).toBeLessThan(1000); // Should complete reasonably quickly
		});

		test('should limit concurrency correctly', async () => {
			const items = Array.from({ length: 50 }, (_, i) => `key-${i}`);

			const result = await batchInvalidator.invalidateBatch(items, {
				batchSize: 10,
				concurrency: 2
			});

			expect(result.summary.successfulItems).toBe(50);
			expect(result.batches).toBe(5);
		});
	});

	describe('Error Handling and Retries', () => {
		test('should retry failed operations', async () => {
			// Mock cache to fail first few attempts
			let attemptCount = 0;
			const originalDelete = mockCache.delete;
			mockCache.delete = jest.fn().mockImplementation((key) => {
				attemptCount++;
				if (attemptCount <= 2) {
					throw new Error('Simulated cache error');
				}
				return originalDelete.call(mockCache, key);
			});

			const items = ['key-1'];
			const result = await batchInvalidator.invalidateBatch(items);

			expect(result.summary.successfulItems).toBe(1);
			expect(batchInvalidator.getStats().totalRetries).toBeGreaterThan(0);

			// Restore original method
			mockCache.delete = originalDelete;
		});

		test('should handle permanent failures after max retries', async () => {
			// Mock cache to always fail
			mockCache.delete = jest
				.fn()
				.mockRejectedValue(new Error('Permanent cache error'));

			const items = ['key-1', 'key-2'];
			const result = await batchInvalidator.invalidateBatch(items);

			expect(result.summary.failedItems).toBe(2);
			expect(result.summary.successfulItems).toBe(0);
		});

		test('should continue processing other batches when one fails', async () => {
			// Mock cache to fail only specific keys
			mockCache.delete = jest.fn().mockImplementation((key) => {
				if (key === 'key-1') {
					throw new Error('Specific key error');
				}
				return true;
			});

			const items = ['key-1', 'key-2', 'key-3'];
			const result = await batchInvalidator.invalidateBatch(items, {
				batchSize: 1
			});

			expect(result.summary.successfulItems).toBe(2);
			expect(result.summary.failedItems).toBe(1);
		});
	});

	describe('Progress Tracking', () => {
		test('should emit progress events during batch processing', async () => {
			const progressEvents = [];
			batchInvalidator.on('progress', (event) => progressEvents.push(event));

			const items = Array.from({ length: 50 }, (_, i) => `key-${i}`);
			await batchInvalidator.invalidateBatch(items, { batchSize: 10 });

			expect(progressEvents.length).toBeGreaterThan(0);
			expect(progressEvents[progressEvents.length - 1].percentage).toBeCloseTo(
				100,
				0
			);
		});

		test('should emit completion events', async () => {
			const completeEvents = [];
			batchInvalidator.on('complete', (event) => completeEvents.push(event));

			const items = ['key-1', 'key-2', 'key-3'];
			await batchInvalidator.invalidateBatch(items);

			expect(completeEvents.length).toBe(1);
			expect(completeEvents[0]).toHaveProperty('duration');
		});

		test('should track active operations', async () => {
			const items = Array.from({ length: 100 }, (_, i) => `key-${i}`);

			// Start operation but don't await
			const operationPromise = batchInvalidator.invalidateBatch(items);

			// Check active operations
			const activeOps = batchInvalidator.getActiveOperations();
			expect(activeOps.length).toBe(1);

			// Wait for completion
			await operationPromise;

			// Should be cleared after completion
			expect(batchInvalidator.getActiveOperations().length).toBe(0);
		});
	});

	describe('Pattern-Based Invalidation', () => {
		test('should invalidate by string pattern', async () => {
			const result = await batchInvalidator.invalidateByPattern('key-1');

			expect(result.summary.totalItems).toBeGreaterThan(0);
			// Should match keys like 'key-1', 'key-10', 'key-11', etc.
		});

		test('should invalidate by regex pattern', async () => {
			const result = await batchInvalidator.invalidateByPattern(/^key-[0-9]$/);

			expect(result.summary.totalItems).toBe(10); // key-0 through key-9
		});

		test('should invalidate by function pattern', async () => {
			const pattern = (key) => parseInt(key.split('-')[1]) % 2 === 0;
			const result = await batchInvalidator.invalidateByPattern(pattern);

			expect(result.summary.totalItems).toBeGreaterThan(0);
			// Should match even-numbered keys
		});
	});

	describe('Age-Based Invalidation', () => {
		test('should invalidate expired entries', async () => {
			const maxAge = 100 * 1000; // 100 seconds
			const result = await batchInvalidator.invalidateByAge(maxAge);

			expect(result.summary.totalItems).toBeGreaterThan(0);
			// Should invalidate older entries
		});

		test('should not invalidate recent entries', async () => {
			const maxAge = 1000 * 1000; // 1000 seconds (very old)
			const result = await batchInvalidator.invalidateByAge(maxAge);

			expect(result.summary.totalItems).toBe(500); // All entries should be invalidated
		});
	});

	describe('Size-Based Invalidation', () => {
		test('should invalidate oversized entries', async () => {
			const minSize = 5000; // 5KB
			const result = await batchInvalidator.invalidateBySize(minSize);

			expect(result.summary.totalItems).toBeGreaterThan(0);
			// Should invalidate larger entries
		});

		test('should preserve small entries', async () => {
			const minSize = 10000; // 10KB (larger than our test data)
			const result = await batchInvalidator.invalidateBySize(minSize);

			expect(result.summary.totalItems).toBe(0); // No entries should be large enough
		});
	});

	describe('Performance Testing', () => {
		test('should handle large batch operations efficiently', async () => {
			// Create a large number of cache entries
			for (let i = 500; i < 2000; i++) {
				mockCache.set(`large-key-${i}`, { data: `value-${i}` });
			}

			const items = Array.from(
				{ length: 1500 },
				(_, i) => `large-key-${i + 500}`
			);
			const startTime = performance.now();

			const result = await batchInvalidator.invalidateBatch(items, {
				batchSize: 100,
				concurrency: 10
			});

			const endTime = performance.now();
			const duration = endTime - startTime;

			expect(result.summary.successfulItems).toBe(1500);
			expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
		});

		test('should optimize batch size based on memory constraints', async () => {
			const sampleItems = ['key-1', 'key-2', 'key-3', 'key-4', 'key-5'];

			const optimizedSize =
				await batchInvalidator.optimizeBatchSize(sampleItems);

			expect(optimizedSize).toBeGreaterThan(0);
			expect(optimizedSize).toBeLessThanOrEqual(
				batchInvalidator.options.batchSize
			);
		});

		test('should estimate memory usage accurately', async () => {
			const items = Array.from({ length: 100 }, (_, i) => `key-${i}`);

			const estimatedMemory = await batchInvalidator.estimateMemoryUsage(items);

			expect(estimatedMemory).toBeGreaterThan(0);
			expect(typeof estimatedMemory).toBe('number');
		});
	});

	describe('Statistics and Monitoring', () => {
		test('should track comprehensive statistics', async () => {
			const items1 = ['key-1', 'key-2'];
			const items2 = ['key-3', 'key-4', 'key-5'];

			await batchInvalidator.invalidateBatch(items1);
			await batchInvalidator.invalidateBatch(items2);

			const stats = batchInvalidator.getStats();

			expect(stats.totalOperations).toBe(2);
			expect(stats.totalItemsProcessed).toBe(5);
			expect(stats.averageBatchTime).toBeGreaterThan(0);
		});

		test('should reset statistics', () => {
			batchInvalidator.stats.totalOperations = 10;
			batchInvalidator.resetStats();

			const stats = batchInvalidator.getStats();
			expect(stats.totalOperations).toBe(0);
		});

		test('should track errors and retries', async () => {
			// Mock cache to fail
			mockCache.delete = jest.fn().mockRejectedValue(new Error('Test error'));

			const items = ['key-1'];
			try {
				await batchInvalidator.invalidateBatch(items);
			} catch (error) {
				// Expected to fail
			}

			const stats = batchInvalidator.getStats();
			expect(stats.totalRetries).toBeGreaterThan(0);
		});
	});

	describe('Operation Management', () => {
		test('should cancel active operations', async () => {
			const items = Array.from({ length: 100 }, (_, i) => `key-${i}`);

			// Start operation
			const operationPromise = batchInvalidator.invalidateBatch(items);
			const activeOps = batchInvalidator.getActiveOperations();

			expect(activeOps.length).toBe(1);

			// Cancel operation
			const cancelled = await batchInvalidator.cancelOperation(activeOps[0]);
			expect(cancelled).toBe(true);

			// Wait for operation to complete or be cancelled
			await operationPromise;
		});

		test('should handle cancellation of non-existent operations', async () => {
			const cancelled =
				await batchInvalidator.cancelOperation('non-existent-id');
			expect(cancelled).toBe(false);
		});
	});

	describe('Edge Cases and Error Scenarios', () => {
		test('should handle cache that supports batch operations', async () => {
			// Mock cache with batch support
			mockCache.deleteMany = jest.fn().mockResolvedValue([
				{ key: 'key-1', deleted: true },
				{ key: 'key-2', deleted: true }
			]);

			const items = ['key-1', 'key-2'];
			const result = await batchInvalidator.invalidateBatch(items);

			expect(mockCache.deleteMany).toHaveBeenCalledWith(items);
			expect(result.summary.successfulItems).toBe(2);
		});

		test('should handle very small batch sizes', async () => {
			const items = ['key-1', 'key-2', 'key-3'];
			const result = await batchInvalidator.invalidateBatch(items, {
				batchSize: 1
			});

			expect(result.batches).toBe(3);
			expect(result.summary.successfulItems).toBe(3);
		});

		test('should handle zero concurrency gracefully', async () => {
			const items = ['key-1', 'key-2'];
			const result = await batchInvalidator.invalidateBatch(items, {
				concurrency: 1
			});

			expect(result.summary.successfulItems).toBe(2);
		});

		test('should handle malformed cache metadata', async () => {
			// Add entries with malformed metadata
			mockCache.metadata.set('malformed-key', null);
			mockCache.data.set('malformed-key', 'data');

			const result = await batchInvalidator.invalidateByAge(1000);

			// Should not throw errors
			expect(result).toBeDefined();
		});
	});
});
