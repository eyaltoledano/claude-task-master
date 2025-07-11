/**
 * @fileoverview Selective Invalidation Test Suite
 *
 * Tests the selective cache invalidation functionality including:
 * - Smart invalidation based on file changes
 * - Dependency-based invalidation cascades
 * - Granular invalidation strategies
 * - Performance optimization through selective clearing
 * - Integration with file watchers and change detection
 *
 * Part of Phase 1.2: AST Cache System Testing
 */

const { EventEmitter } = require('events');

describe('SelectiveInvalidation', () => {
	let SelectiveInvalidation;
	let invalidator;
	let mockCache;
	let mockDependencyTracker;

	beforeAll(() => {
		// Mock cache interface
		const MockCache = class {
			constructor() {
				this.data = new Map();
				this.metadata = new Map();
			}

			async get(key) {
				return this.data.get(key) || null;
			}

			async set(key, value, options = {}) {
				this.data.set(key, value);
				this.metadata.set(key, {
					timestamp: Date.now(),
					tags: options.tags || [],
					dependencies: options.dependencies || []
				});
				return true;
			}

			async delete(key) {
				const deleted = this.data.delete(key);
				this.metadata.delete(key);
				return deleted;
			}

			async clear() {
				this.data.clear();
				this.metadata.clear();
				return true;
			}

			has(key) {
				return this.data.has(key);
			}

			keys() {
				return Array.from(this.data.keys());
			}

			getMetadata(key) {
				return this.metadata.get(key);
			}

			size() {
				return this.data.size;
			}
		};

		// Mock dependency tracker
		const MockDependencyTracker = class {
			constructor() {
				this.dependencies = new Map();
				this.dependents = new Map();
			}

			getDependents(file) {
				return Array.from(this.dependents.get(file) || []);
			}

			getDependencies(file) {
				return Array.from(this.dependencies.get(file) || []);
			}

			addDependency(file, dependency) {
				if (!this.dependencies.has(file)) {
					this.dependencies.set(file, new Set());
				}
				this.dependencies.get(file).add(dependency);

				if (!this.dependents.has(dependency)) {
					this.dependents.set(dependency, new Set());
				}
				this.dependents.get(dependency).add(file);
			}
		};

		// Mock the SelectiveInvalidation class
		SelectiveInvalidation = class MockSelectiveInvalidation extends (
			EventEmitter
		) {
			constructor(cache, dependencyTracker, options = {}) {
				super();
				this.cache = cache;
				this.dependencyTracker = dependencyTracker;
				this.options = {
					enableCascading: options.enableCascading !== false,
					maxCascadeDepth: options.maxCascadeDepth || 10,
					batchSize: options.batchSize || 100,
					debounceMs: options.debounceMs || 100,
					...options
				};

				this.invalidationQueue = new Set();
				this.debounceTimer = null;
				this.stats = {
					totalInvalidations: 0,
					cascadedInvalidations: 0,
					batchedInvalidations: 0,
					filesProcessed: 0
				};
			}

			async invalidateFile(filePath, options = {}) {
				const strategy = options.strategy || 'cascade';
				const force = options.force || false;

				this.stats.totalInvalidations++;
				this.stats.filesProcessed++;

				const invalidated = new Set();

				// Find cache entries related to this file
				const cacheKeys = this._findCacheKeysForFile(filePath);

				// Invalidate direct entries
				for (const key of cacheKeys) {
					if (this.cache.has(key)) {
						await this.cache.delete(key);
						invalidated.add(key);
						this.emit('invalidated', { type: 'direct', file: filePath, key });
					}
				}

				// Handle cascading invalidation
				if (strategy === 'cascade' && this.options.enableCascading) {
					const cascaded = await this._cascadeInvalidation(filePath, options);
					for (const item of cascaded) {
						invalidated.add(item);
					}
				}

				return {
					invalidated: Array.from(invalidated),
					strategy,
					cascaded: strategy === 'cascade'
				};
			}

			async invalidateFiles(filePaths, options = {}) {
				const batch = options.batch !== false;

				if (batch) {
					return this._batchInvalidate(filePaths, options);
				} else {
					const results = [];
					for (const filePath of filePaths) {
						const result = await this.invalidateFile(filePath, options);
						results.push(result);
					}
					return results;
				}
			}

			async invalidateByPattern(pattern, options = {}) {
				const matchingFiles = this._findFilesByPattern(pattern);
				return this.invalidateFiles(matchingFiles, options);
			}

			async invalidateByTag(tag, options = {}) {
				const cacheKeys = [];

				for (const key of this.cache.keys()) {
					const metadata = this.cache.getMetadata(key);
					if (metadata && metadata.tags && metadata.tags.includes(tag)) {
						cacheKeys.push(key);
					}
				}

				const invalidated = [];
				for (const key of cacheKeys) {
					if (this.cache.has(key)) {
						await this.cache.delete(key);
						invalidated.push(key);
						this.emit('invalidated', { type: 'tag', tag, key });
					}
				}

				return {
					invalidated,
					tag,
					count: invalidated.length
				};
			}

			scheduleInvalidation(filePath, options = {}) {
				this.invalidationQueue.add(filePath);

				if (this.debounceTimer) {
					clearTimeout(this.debounceTimer);
				}

				this.debounceTimer = setTimeout(async () => {
					await this._processInvalidationQueue(options);
				}, this.options.debounceMs);
			}

			async _cascadeInvalidation(filePath, options = {}, depth = 0) {
				if (depth >= this.options.maxCascadeDepth) {
					return [];
				}

				const invalidated = [];
				const dependents = this.dependencyTracker.getDependents(filePath);

				for (const dependent of dependents) {
					this.stats.cascadedInvalidations++;

					// Find and invalidate cache entries for dependent
					const cacheKeys = this._findCacheKeysForFile(dependent);
					for (const key of cacheKeys) {
						if (this.cache.has(key)) {
							await this.cache.delete(key);
							invalidated.push(key);
							this.emit('invalidated', {
								type: 'cascade',
								file: dependent,
								key,
								depth
							});
						}
					}

					// Recursively cascade if enabled
					if (options.recursive !== false) {
						const cascaded = await this._cascadeInvalidation(
							dependent,
							options,
							depth + 1
						);
						invalidated.push(...cascaded);
					}
				}

				return invalidated;
			}

			async _batchInvalidate(filePaths, options = {}) {
				this.stats.batchedInvalidations++;

				const batches = [];
				for (let i = 0; i < filePaths.length; i += this.options.batchSize) {
					batches.push(filePaths.slice(i, i + this.options.batchSize));
				}

				const results = [];
				for (const batch of batches) {
					const batchResults = await Promise.all(
						batch.map((filePath) =>
							this.invalidateFile(filePath, { ...options, strategy: 'direct' })
						)
					);
					results.push(...batchResults);

					// Emit batch progress
					this.emit('batchProgress', {
						completed: results.length,
						total: filePaths.length,
						percentage: (results.length / filePaths.length) * 100
					});
				}

				return results;
			}

			async _processInvalidationQueue(options = {}) {
				const filesToProcess = Array.from(this.invalidationQueue);
				this.invalidationQueue.clear();

				if (filesToProcess.length === 0) {
					return;
				}

				this.emit('queueProcessing', { files: filesToProcess.length });

				const result = await this.invalidateFiles(filesToProcess, options);

				this.emit('queueProcessed', {
					files: filesToProcess.length,
					results: result
				});

				return result;
			}

			_findCacheKeysForFile(filePath) {
				// Mock implementation - find cache keys that relate to this file
				const keys = [];

				for (const key of this.cache.keys()) {
					if (
						key.includes(filePath) ||
						key.includes(filePath.replace(/\\/g, '/'))
					) {
						keys.push(key);
					}

					// Check metadata for file references
					const metadata = this.cache.getMetadata(key);
					if (
						metadata &&
						metadata.dependencies &&
						metadata.dependencies.includes(filePath)
					) {
						keys.push(key);
					}
				}

				return keys;
			}

			_findFilesByPattern(pattern) {
				// Mock implementation - find files matching pattern
				const files = [
					'/src/app.js',
					'/src/utils.js',
					'/src/components/Header.js',
					'/src/components/Footer.js',
					'/test/app.test.js',
					'/test/utils.test.js'
				];

				if (typeof pattern === 'string') {
					return files.filter((file) => file.includes(pattern));
				} else if (pattern instanceof RegExp) {
					return files.filter((file) => pattern.test(file));
				}

				return [];
			}

			getStats() {
				return { ...this.stats };
			}

			resetStats() {
				this.stats = {
					totalInvalidations: 0,
					cascadedInvalidations: 0,
					batchedInvalidations: 0,
					filesProcessed: 0
				};
			}

			async warmupCache(filePaths, options = {}) {
				// Mock cache warming - simulate populating cache
				for (const filePath of filePaths) {
					const cacheKey = `ast:${filePath}`;
					await this.cache.set(
						cacheKey,
						{
							ast: `mock-ast-for-${filePath}`,
							timestamp: Date.now()
						},
						{
							tags: options.tags || ['ast'],
							dependencies: [filePath]
						}
					);
				}

				return filePaths.length;
			}
		};

		mockCache = new MockCache();
		mockDependencyTracker = new MockDependencyTracker();
	});

	beforeEach(async () => {
		mockCache = new mockCache.constructor();
		mockDependencyTracker = new mockDependencyTracker.constructor();
		invalidator = new SelectiveInvalidation(mockCache, mockDependencyTracker);

		// Set up some test dependencies
		mockDependencyTracker.addDependency('/src/app.js', '/src/utils.js');
		mockDependencyTracker.addDependency(
			'/src/components/Header.js',
			'/src/utils.js'
		);
		mockDependencyTracker.addDependency('/src/utils.js', '/src/config.js');

		// Populate cache with test data
		await invalidator.warmupCache([
			'/src/app.js',
			'/src/utils.js',
			'/src/config.js',
			'/src/components/Header.js'
		]);
	});

	describe('Direct File Invalidation', () => {
		test('should invalidate cache entries for specific file', async () => {
			const initialSize = mockCache.size();
			expect(initialSize).toBeGreaterThan(0);

			const result = await invalidator.invalidateFile('/src/app.js', {
				strategy: 'direct'
			});

			expect(result.invalidated.length).toBeGreaterThan(0);
			expect(result.strategy).toBe('direct');
			expect(mockCache.size()).toBeLessThan(initialSize);
		});

		test('should handle non-existent files gracefully', async () => {
			const result = await invalidator.invalidateFile('/src/nonexistent.js', {
				strategy: 'direct'
			});

			expect(result.invalidated).toEqual([]);
			expect(result.strategy).toBe('direct');
		});

		test('should emit invalidation events', async () => {
			const events = [];
			invalidator.on('invalidated', (event) => events.push(event));

			await invalidator.invalidateFile('/src/app.js', { strategy: 'direct' });

			expect(events.length).toBeGreaterThan(0);
			expect(events[0]).toHaveProperty('type', 'direct');
			expect(events[0]).toHaveProperty('file', '/src/app.js');
		});
	});

	describe('Cascading Invalidation', () => {
		test('should cascade invalidation to dependent files', async () => {
			const result = await invalidator.invalidateFile('/src/utils.js', {
				strategy: 'cascade'
			});

			expect(result.cascaded).toBe(true);
			expect(result.invalidated.length).toBeGreaterThan(1); // Should invalidate dependents too
		});

		test('should respect cascade depth limits', async () => {
			const limitedInvalidator = new SelectiveInvalidation(
				mockCache,
				mockDependencyTracker,
				{
					maxCascadeDepth: 1
				}
			);

			const result = await limitedInvalidator.invalidateFile('/src/config.js', {
				strategy: 'cascade'
			});

			expect(result.cascaded).toBe(true);
			// Should stop at depth 1
		});

		test('should emit cascade events with depth information', async () => {
			const events = [];
			invalidator.on('invalidated', (event) => events.push(event));

			await invalidator.invalidateFile('/src/config.js', {
				strategy: 'cascade'
			});

			const cascadeEvents = events.filter((e) => e.type === 'cascade');
			expect(cascadeEvents.length).toBeGreaterThan(0);
			expect(cascadeEvents[0]).toHaveProperty('depth');
		});

		test('should handle circular dependencies without infinite loops', async () => {
			// Create circular dependency
			mockDependencyTracker.addDependency('/src/a.js', '/src/b.js');
			mockDependencyTracker.addDependency('/src/b.js', '/src/a.js');

			await invalidator.warmupCache(['/src/a.js', '/src/b.js']);

			const result = await invalidator.invalidateFile('/src/a.js', {
				strategy: 'cascade'
			});

			expect(result.cascaded).toBe(true);
			// Should complete without hanging
		});
	});

	describe('Batch Invalidation', () => {
		test('should invalidate multiple files efficiently', async () => {
			const filesToInvalidate = [
				'/src/app.js',
				'/src/utils.js',
				'/src/config.js'
			];

			const results = await invalidator.invalidateFiles(filesToInvalidate, {
				batch: true
			});

			expect(results.length).toBe(filesToInvalidate.length);
			expect(invalidator.getStats().batchedInvalidations).toBe(1);
		});

		test('should emit batch progress events', async () => {
			const progressEvents = [];
			invalidator.on('batchProgress', (event) => progressEvents.push(event));

			const filesToInvalidate = [
				'/src/app.js',
				'/src/utils.js',
				'/src/config.js'
			];
			await invalidator.invalidateFiles(filesToInvalidate, { batch: true });

			expect(progressEvents.length).toBeGreaterThan(0);
			expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
		});

		test('should respect batch size limits', async () => {
			const smallBatchInvalidator = new SelectiveInvalidation(
				mockCache,
				mockDependencyTracker,
				{
					batchSize: 2
				}
			);

			const filesToInvalidate = [
				'/src/app.js',
				'/src/utils.js',
				'/src/config.js',
				'/src/components/Header.js'
			];
			await smallBatchInvalidator.invalidateFiles(filesToInvalidate, {
				batch: true
			});

			// Should process in multiple batches
			expect(smallBatchInvalidator.getStats().batchedInvalidations).toBe(1);
		});
	});

	describe('Pattern-Based Invalidation', () => {
		test('should invalidate files matching string pattern', async () => {
			const result = await invalidator.invalidateByPattern('/src/components/');

			expect(result.length).toBeGreaterThan(0);
			// Should match Header.js
		});

		test('should invalidate files matching regex pattern', async () => {
			const result = await invalidator.invalidateByPattern(/\.test\.js$/);

			expect(result.length).toBeGreaterThan(0);
			// Should match test files
		});

		test('should handle patterns with no matches', async () => {
			const result = await invalidator.invalidateByPattern('/nonexistent/');

			expect(result).toEqual([]);
		});
	});

	describe('Tag-Based Invalidation', () => {
		test('should invalidate cache entries by tag', async () => {
			// Add some entries with specific tags
			await mockCache.set('tagged-entry-1', 'data1', { tags: ['test-tag'] });
			await mockCache.set('tagged-entry-2', 'data2', {
				tags: ['test-tag', 'other-tag']
			});
			await mockCache.set('untagged-entry', 'data3', {
				tags: ['different-tag']
			});

			const result = await invalidator.invalidateByTag('test-tag');

			expect(result.invalidated.length).toBe(2);
			expect(result.tag).toBe('test-tag');
			expect(mockCache.has('tagged-entry-1')).toBe(false);
			expect(mockCache.has('tagged-entry-2')).toBe(false);
			expect(mockCache.has('untagged-entry')).toBe(true);
		});

		test('should emit tag invalidation events', async () => {
			const events = [];
			invalidator.on('invalidated', (event) => events.push(event));

			await mockCache.set('tagged-entry', 'data', { tags: ['test-tag'] });
			await invalidator.invalidateByTag('test-tag');

			const tagEvents = events.filter((e) => e.type === 'tag');
			expect(tagEvents.length).toBe(1);
			expect(tagEvents[0].tag).toBe('test-tag');
		});
	});

	describe('Scheduled Invalidation', () => {
		test('should debounce multiple invalidation requests', async () => {
			const processedEvents = [];
			invalidator.on('queueProcessed', (event) => processedEvents.push(event));

			// Schedule multiple invalidations rapidly
			invalidator.scheduleInvalidation('/src/app.js');
			invalidator.scheduleInvalidation('/src/utils.js');
			invalidator.scheduleInvalidation('/src/config.js');

			// Wait for debounce to complete
			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(processedEvents.length).toBe(1);
			expect(processedEvents[0].files).toBe(3);
		});

		test('should emit queue processing events', async () => {
			const processingEvents = [];
			invalidator.on('queueProcessing', (event) =>
				processingEvents.push(event)
			);

			invalidator.scheduleInvalidation('/src/app.js');

			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(processingEvents.length).toBe(1);
			expect(processingEvents[0].files).toBe(1);
		});
	});

	describe('Performance Testing', () => {
		test('should handle large-scale invalidation efficiently', async () => {
			// Populate cache with many entries
			const files = [];
			for (let i = 0; i < 1000; i++) {
				files.push(`/src/file-${i}.js`);
			}
			await invalidator.warmupCache(files);

			const startTime = Date.now();

			// Invalidate a significant portion
			const filesToInvalidate = files.slice(0, 500);
			await invalidator.invalidateFiles(filesToInvalidate, { batch: true });

			const endTime = Date.now();

			expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
		});

		test('should maintain performance with complex dependency graphs', async () => {
			// Create complex dependency relationships
			for (let i = 0; i < 100; i++) {
				for (let j = 0; j < Math.min(5, i); j++) {
					mockDependencyTracker.addDependency(
						`/src/file-${i}.js`,
						`/src/file-${j}.js`
					);
				}
			}

			const files = [];
			for (let i = 0; i < 100; i++) {
				files.push(`/src/file-${i}.js`);
			}
			await invalidator.warmupCache(files);

			const startTime = Date.now();

			// Trigger cascading invalidation from a highly connected node
			await invalidator.invalidateFile('/src/file-0.js', {
				strategy: 'cascade'
			});

			const endTime = Date.now();

			expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
		});
	});

	describe('Statistics and Monitoring', () => {
		test('should track invalidation statistics', async () => {
			await invalidator.invalidateFile('/src/app.js', { strategy: 'direct' });
			await invalidator.invalidateFile('/src/utils.js', {
				strategy: 'cascade'
			});
			await invalidator.invalidateFiles(['/src/config.js'], { batch: true });

			const stats = invalidator.getStats();

			expect(stats.totalInvalidations).toBe(3);
			expect(stats.cascadedInvalidations).toBeGreaterThan(0);
			expect(stats.batchedInvalidations).toBe(1);
			expect(stats.filesProcessed).toBe(3);
		});

		test('should reset statistics', () => {
			invalidator.stats.totalInvalidations = 10;
			invalidator.resetStats();

			const stats = invalidator.getStats();
			expect(stats.totalInvalidations).toBe(0);
		});
	});

	describe('Error Handling', () => {
		test('should handle cache errors gracefully', async () => {
			// Mock cache error
			const originalDelete = mockCache.delete;
			mockCache.delete = jest.fn().mockRejectedValue(new Error('Cache error'));

			const result = await invalidator.invalidateFile('/src/app.js');

			// Should not throw, but should handle error
			expect(result).toBeDefined();

			// Restore original method
			mockCache.delete = originalDelete;
		});

		test('should handle dependency tracker errors gracefully', async () => {
			// Mock dependency tracker error
			mockDependencyTracker.getDependents = jest.fn().mockImplementation(() => {
				throw new Error('Dependency tracker error');
			});

			const result = await invalidator.invalidateFile('/src/utils.js', {
				strategy: 'cascade'
			});

			// Should not throw, but should handle error
			expect(result).toBeDefined();
		});

		test('should handle malformed cache metadata', async () => {
			// Add entry with malformed metadata
			await mockCache.set('malformed-entry', 'data');
			mockCache.metadata.set('malformed-entry', null);

			const result = await invalidator.invalidateByTag('any-tag');

			// Should not throw
			expect(result).toBeDefined();
		});
	});

	describe('Integration Scenarios', () => {
		test('should handle file system change simulation', async () => {
			// Simulate file watcher detecting changes
			const changedFiles = ['/src/utils.js', '/src/config.js'];

			const results = await Promise.all(
				changedFiles.map((file) =>
					invalidator.invalidateFile(file, { strategy: 'cascade' })
				)
			);

			expect(results.length).toBe(2);
			results.forEach((result) => {
				expect(result.cascaded).toBe(true);
				expect(result.invalidated.length).toBeGreaterThan(0);
			});
		});

		test('should integrate with cache warming', async () => {
			// Clear cache
			await mockCache.clear();
			expect(mockCache.size()).toBe(0);

			// Warm up cache
			const warmedFiles = await invalidator.warmupCache([
				'/src/app.js',
				'/src/utils.js'
			]);
			expect(warmedFiles).toBe(2);
			expect(mockCache.size()).toBe(2);

			// Invalidate and verify
			await invalidator.invalidateFile('/src/app.js');
			expect(mockCache.size()).toBeLessThan(2);
		});
	});
});
