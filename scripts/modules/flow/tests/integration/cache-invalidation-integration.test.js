/**
 * @fileoverview Cache Invalidation Integration Test Suite
 * Tests cache behavior during AST-Claude operations and performance optimization
 *
 * Phase 3.1: AST-Claude Integration Testing
 * @author Claude (Task Master Flow Testing)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock implementations for cache and integration components
const mockCacheManager = {
	get: jest.fn(),
	set: jest.fn(),
	delete: jest.fn(),
	clear: jest.fn(),
	has: jest.fn(),
	keys: jest.fn(),
	size: jest.fn(() => 0),
	getStats: jest.fn(() => ({ hits: 0, misses: 0, evictions: 0 }))
};

const mockCacheInvalidator = new EventEmitter();
Object.assign(mockCacheInvalidator, {
	invalidateFile: jest.fn(),
	invalidateDirectory: jest.fn(),
	invalidatePattern: jest.fn(),
	scheduleInvalidation: jest.fn(),
	getInvalidationQueue: jest.fn(() => [])
});

const mockFileSystemWatcher = new EventEmitter();
Object.assign(mockFileSystemWatcher, {
	watchFile: jest.fn(),
	unwatchFile: jest.fn(),
	isWatching: jest.fn(() => false)
});

const mockASTProcessor = {
	parseFile: jest.fn(),
	getCacheKey: jest.fn(),
	shouldCache: jest.fn(() => true),
	getParsingStats: jest.fn(() => ({ totalParsed: 0, cacheHits: 0 }))
};

const mockClaudeService = {
	processContext: jest.fn(),
	getCachedResponse: jest.fn(),
	cacheResponse: jest.fn(),
	invalidateContextCache: jest.fn()
};

const mockDependencyTracker = {
	trackDependency: jest.fn(),
	getDependents: jest.fn(() => []),
	invalidateDependencies: jest.fn(),
	buildDependencyGraph: jest.fn()
};

describe('Cache Invalidation Integration Suite', () => {
	let cacheManager;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Setup cache manager
		cacheManager = {
			cache: mockCacheManager,
			invalidator: mockCacheInvalidator,
			fsWatcher: mockFileSystemWatcher,
			astProcessor: mockASTProcessor,
			claudeService: mockClaudeService,
			dependencyTracker: mockDependencyTracker,
			state: {
				cacheStats: { hits: 0, misses: 0, invalidations: 0 },
				invalidationQueue: new Map(),
				watchedFiles: new Set()
			}
		};

		// Setup default mock implementations
		mockCacheManager.get.mockResolvedValue(null);
		mockCacheManager.set.mockResolvedValue(true);
		mockCacheManager.has.mockReturnValue(false);
		mockCacheManager.keys.mockReturnValue([]);

		mockASTProcessor.parseFile.mockResolvedValue({
			ast: { type: 'Program', body: [] },
			metadata: { lineCount: 10, hash: 'abc123' }
		});

		mockASTProcessor.getCacheKey.mockImplementation(
			(filePath, options = {}) =>
				`ast:${filePath}:${options.language || 'javascript'}:${options.hash || 'default'}`
		);

		mockClaudeService.processContext.mockResolvedValue({
			response: 'Generated response',
			tokenCount: 500
		});

		mockDependencyTracker.getDependents.mockReturnValue([]);
	});

	describe('File-Based Cache Invalidation', () => {
		test('should invalidate AST cache when file is modified', async () => {
			const filePath = '/project/src/component.js';
			const cacheKey = `ast:${filePath}:javascript:abc123`;

			// Setup initial cache
			mockCacheManager.has.mockReturnValueOnce(true);

			await invalidateFileCache(filePath, 'modify');

			expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledWith(
				filePath
			);
			expect(mockCacheManager.delete).toHaveBeenCalledWith(
				expect.stringContaining(filePath)
			);
		});

		test('should handle file deletion with cache cleanup', async () => {
			const filePath = '/project/src/deleted-component.js';
			const relatedKeys = [
				`ast:${filePath}:javascript:abc123`,
				`context:${filePath}:main`,
				`claude:${filePath}:response`
			];

			mockCacheManager.keys.mockReturnValueOnce(relatedKeys);

			await invalidateFileCache(filePath, 'delete');

			expect(mockCacheManager.delete).toHaveBeenCalledTimes(relatedKeys.length);
			relatedKeys.forEach((key) => {
				expect(mockCacheManager.delete).toHaveBeenCalledWith(key);
			});
		});

		test('should handle file creation with dependency tracking', async () => {
			const newFile = '/project/src/new-component.js';
			const dependentFiles = [
				'/project/src/parent-component.js',
				'/project/src/index.js'
			];

			mockDependencyTracker.getDependents.mockReturnValueOnce(dependentFiles);

			await invalidateFileCache(newFile, 'create');

			expect(mockDependencyTracker.trackDependency).toHaveBeenCalledWith(
				newFile
			);
			expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledWith(newFile);

			// Should also invalidate dependent files
			dependentFiles.forEach((file) => {
				expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledWith(file);
			});
		});

		test('should batch invalidations for rapid file changes', async () => {
			const files = [
				'/project/src/file1.js',
				'/project/src/file2.js',
				'/project/src/file3.js'
			];

			const batchInvalidation = createBatchInvalidator(100); // 100ms batch window

			// Trigger rapid changes
			const promises = files.map((file) =>
				batchInvalidation.invalidate(file, 'modify')
			);

			await Promise.all(promises);

			// Should batch the invalidations
			expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledTimes(1);
			expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledWith(files);
		});
	});

	describe('Directory-Based Cache Invalidation', () => {
		test('should invalidate cache for entire directory', async () => {
			const directoryPath = '/project/src/components';
			const cachedFiles = [
				'/project/src/components/Button.js',
				'/project/src/components/Input.js',
				'/project/src/components/Modal.js'
			];

			mockCacheManager.keys.mockReturnValueOnce(
				cachedFiles.map((file) => `ast:${file}:javascript:hash`)
			);

			await invalidateDirectoryCache(directoryPath);

			expect(mockCacheInvalidator.invalidateDirectory).toHaveBeenCalledWith(
				directoryPath
			);
			expect(mockCacheManager.delete).toHaveBeenCalledTimes(cachedFiles.length);
		});

		test('should handle selective directory invalidation', async () => {
			const directoryPath = '/project/src';
			const pattern = '*.component.js';
			const matchingFiles = [
				'/project/src/user.component.js',
				'/project/src/admin.component.js'
			];
			const nonMatchingFiles = [
				'/project/src/utils.js',
				'/project/src/config.js'
			];

			mockCacheManager.keys.mockReturnValueOnce([
				...matchingFiles.map((f) => `ast:${f}:javascript:hash`),
				...nonMatchingFiles.map((f) => `ast:${f}:javascript:hash`)
			]);

			await invalidateDirectoryCacheWithPattern(directoryPath, pattern);

			expect(mockCacheManager.delete).toHaveBeenCalledTimes(
				matchingFiles.length
			);
			matchingFiles.forEach((file) => {
				expect(mockCacheManager.delete).toHaveBeenCalledWith(
					expect.stringContaining(file)
				);
			});
		});

		test('should handle nested directory invalidation', async () => {
			const rootPath = '/project/src';
			const nestedStructure = [
				'/project/src/components/ui/Button.js',
				'/project/src/components/forms/Input.js',
				'/project/src/utils/helpers/format.js',
				'/project/src/services/api/user.js'
			];

			mockCacheManager.keys.mockReturnValueOnce(
				nestedStructure.map((file) => `ast:${file}:javascript:hash`)
			);

			await invalidateNestedDirectoryCache(rootPath, { recursive: true });

			expect(mockCacheManager.delete).toHaveBeenCalledTimes(
				nestedStructure.length
			);
			expect(mockCacheInvalidator.invalidateDirectory).toHaveBeenCalledWith(
				rootPath,
				expect.objectContaining({ recursive: true })
			);
		});
	});

	describe('Dependency-Based Cache Invalidation', () => {
		test('should invalidate dependent files when dependency changes', async () => {
			const changedFile = '/project/src/shared/utils.js';
			const dependentFiles = [
				'/project/src/components/UserList.js',
				'/project/src/components/UserForm.js',
				'/project/src/services/UserService.js'
			];

			mockDependencyTracker.getDependents.mockReturnValueOnce(dependentFiles);

			await invalidateDependencyChain(changedFile);

			expect(mockDependencyTracker.getDependents).toHaveBeenCalledWith(
				changedFile
			);
			expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledWith(
				changedFile
			);

			dependentFiles.forEach((file) => {
				expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledWith(file);
			});
		});

		test('should handle circular dependencies gracefully', async () => {
			const fileA = '/project/src/moduleA.js';
			const fileB = '/project/src/moduleB.js';

			// Setup circular dependency
			mockDependencyTracker.getDependents
				.mockReturnValueOnce([fileB]) // A depends on B
				.mockReturnValueOnce([fileA]); // B depends on A

			const result = await invalidateDependencyChain(fileA);

			expect(result.circularDependencyDetected).toBe(true);
			expect(result.invalidatedFiles).toContain(fileA);
			expect(result.invalidatedFiles).toContain(fileB);
			expect(result.invalidatedFiles).toHaveLength(2); // Should not infinitely loop
		});

		test('should build and use dependency graph for efficient invalidation', async () => {
			const dependencyGraph = {
				'/project/src/base.js': [
					'/project/src/child1.js',
					'/project/src/child2.js'
				],
				'/project/src/child1.js': ['/project/src/grandchild.js'],
				'/project/src/child2.js': [],
				'/project/src/grandchild.js': []
			};

			mockDependencyTracker.buildDependencyGraph.mockReturnValueOnce(
				dependencyGraph
			);

			const result = await invalidateWithDependencyGraph(
				'/project/src/base.js'
			);

			expect(result.totalInvalidated).toBe(4); // base + 2 children + 1 grandchild
			expect(result.dependencyLevels).toBe(3); // base -> child -> grandchild
		});

		test('should optimize invalidation for large dependency trees', async () => {
			const rootFile = '/project/src/core.js';
			const largeDependencyTree = generateLargeDependencyTree(rootFile, 100);

			mockDependencyTracker.buildDependencyGraph.mockReturnValueOnce(
				largeDependencyTree
			);

			const startTime = Date.now();
			const result = await invalidateWithDependencyGraph(rootFile);
			const duration = Date.now() - startTime;

			expect(result.totalInvalidated).toBe(100);
			expect(duration).toBeLessThan(1000); // Should complete within 1 second
		});
	});

	describe('Claude Service Cache Integration', () => {
		test('should invalidate Claude response cache when context changes', async () => {
			const contextFiles = [
				'/project/src/component.js',
				'/project/src/helper.js'
			];
			const claudeContextKey = 'claude:context:user-auth-task';

			mockClaudeService.getCachedResponse.mockReturnValueOnce({
				response: 'Previous response',
				contextHash: 'old-hash'
			});

			await invalidateClaudeContextCache(contextFiles, 'user-auth-task');

			expect(mockClaudeService.invalidateContextCache).toHaveBeenCalledWith(
				expect.stringContaining('user-auth-task')
			);
		});

		test('should coordinate AST and Claude cache invalidation', async () => {
			const filePath = '/project/src/updated-component.js';
			const relatedContexts = [
				'claude:context:implement-feature',
				'claude:context:refactor-code'
			];

			mockCacheManager.keys.mockReturnValueOnce([
				`ast:${filePath}:javascript:hash`,
				...relatedContexts
			]);

			await coordinatedCacheInvalidation(filePath);

			// Should invalidate both AST and Claude caches
			expect(mockCacheManager.delete).toHaveBeenCalledWith(
				expect.stringContaining('ast:')
			);
			relatedContexts.forEach((context) => {
				expect(mockClaudeService.invalidateContextCache).toHaveBeenCalledWith(
					context
				);
			});
		});

		test('should handle Claude context versioning during invalidation', async () => {
			const contextKey = 'claude:context:task-123';
			const versions = ['v1', 'v2', 'v3'];

			const versionedKeys = versions.map((v) => `${contextKey}:${v}`);
			mockCacheManager.keys.mockReturnValueOnce(versionedKeys);

			await invalidateVersionedClaudeCache(contextKey);

			expect(mockCacheManager.delete).toHaveBeenCalledTimes(versions.length);
			versionedKeys.forEach((key) => {
				expect(mockCacheManager.delete).toHaveBeenCalledWith(key);
			});
		});
	});

	describe('Performance and Load Testing', () => {
		test('should handle high-frequency invalidation requests', async () => {
			const invalidationCount = 1000;
			const files = Array.from(
				{ length: invalidationCount },
				(_, i) => `/project/src/file${i}.js`
			);

			const startTime = Date.now();

			// Simulate high-frequency invalidations
			const promises = files.map((file) => invalidateFileCache(file, 'modify'));
			await Promise.all(promises);

			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
			expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledTimes(
				invalidationCount
			);
		});

		test('should optimize memory usage during large cache operations', async () => {
			const largeFileSet = Array.from(
				{ length: 5000 },
				(_, i) => `/project/src/large/file${i}.js`
			);

			mockCacheManager.keys.mockReturnValueOnce(
				largeFileSet.map((file) => `ast:${file}:javascript:hash`)
			);

			const memBefore = process.memoryUsage().heapUsed;

			await invalidateDirectoryCache('/project/src/large');

			const memAfter = process.memoryUsage().heapUsed;
			const memIncrease = memAfter - memBefore;

			expect(memIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
		});

		test('should throttle invalidation operations under high load', async () => {
			const throttleLimit = 100; // Max 100 operations per batch
			const totalOperations = 500;

			const throttledInvalidator = createThrottledInvalidator(throttleLimit);

			const operations = Array.from({ length: totalOperations }, (_, i) =>
				throttledInvalidator.invalidate(`/project/src/file${i}.js`, 'modify')
			);

			const startTime = Date.now();
			await Promise.all(operations);
			const duration = Date.now() - startTime;

			// Should process in batches, taking more time but preventing overload
			expect(duration).toBeGreaterThan(200); // At least 200ms for batching
			expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledTimes(
				Math.ceil(totalOperations / throttleLimit)
			);
		});

		test('should maintain cache statistics during invalidation', async () => {
			const initialStats = { hits: 100, misses: 20, invalidations: 5 };
			mockCacheManager.getStats.mockReturnValue(initialStats);

			await invalidateFileCache('/project/src/component.js', 'modify');

			const updatedStats = await getCacheStatistics();

			expect(updatedStats.invalidations).toBe(initialStats.invalidations + 1);
			expect(updatedStats.totalOperations).toBe(
				initialStats.hits + initialStats.misses + updatedStats.invalidations
			);
		});
	});

	describe('Error Handling and Recovery', () => {
		test('should handle cache corruption during invalidation', async () => {
			const corruptedKey = 'ast:/project/src/corrupted.js:javascript:hash';
			const deleteError = new Error('Cache corruption detected');

			mockCacheManager.delete.mockRejectedValueOnce(deleteError);

			const result = await invalidateFileCache(
				'/project/src/corrupted.js',
				'modify'
			);

			expect(result.success).toBe(false);
			expect(result.error).toMatch(/Cache corruption detected/);
			expect(result.recovered).toBe(true); // Should attempt recovery
		});

		test('should implement retry logic for failed invalidations', async () => {
			const filePath = '/project/src/retry-test.js';

			mockCacheManager.delete
				.mockRejectedValueOnce(new Error('Network timeout'))
				.mockRejectedValueOnce(new Error('Network timeout'))
				.mockResolvedValueOnce(true);

			const result = await invalidateFileWithRetry(filePath, { maxRetries: 3 });

			expect(result.success).toBe(true);
			expect(result.attempts).toBe(3);
			expect(mockCacheManager.delete).toHaveBeenCalledTimes(3);
		});

		test('should isolate invalidation failures to prevent cascade', async () => {
			const files = [
				'/project/src/good1.js',
				'/project/src/failing.js',
				'/project/src/good2.js'
			];

			mockCacheManager.delete
				.mockResolvedValueOnce(true)
				.mockRejectedValueOnce(new Error('Invalidation failed'))
				.mockResolvedValueOnce(true);

			const results = await invalidateMultipleFiles(files);

			expect(results.successful).toHaveLength(2);
			expect(results.failed).toHaveLength(1);
			expect(results.failed[0].file).toBe('/project/src/failing.js');
		});

		test('should provide fallback invalidation strategies', async () => {
			const filePath = '/project/src/fallback-test.js';

			// Primary invalidation fails
			mockCacheInvalidator.invalidateFile.mockRejectedValueOnce(
				new Error('Primary invalidation failed')
			);

			const result = await invalidateWithFallback(filePath);

			expect(result.primaryFailed).toBe(true);
			expect(result.fallbackUsed).toBe(true);
			expect(result.success).toBe(true);
		});
	});

	describe('Integration with File System Events', () => {
		test('should coordinate with file system watcher for real-time invalidation', async () => {
			const filePath = '/project/src/watched.js';

			// Setup file watching
			await setupFileSystemWatcher(filePath);

			// Simulate file change event
			mockFileSystemWatcher.emit('change', filePath, { eventType: 'update' });

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledWith(
				filePath
			);
		});

		test('should debounce rapid file system events', async () => {
			const filePath = '/project/src/rapid-changes.js';
			const debounceTime = 200;

			await setupFileSystemWatcher(filePath, { debounce: debounceTime });

			// Emit rapid changes
			for (let i = 0; i < 5; i++) {
				mockFileSystemWatcher.emit('change', filePath);
				await new Promise((resolve) => setTimeout(resolve, 50));
			}

			// Wait for debounce
			await new Promise((resolve) => setTimeout(resolve, debounceTime + 100));

			// Should only invalidate once due to debouncing
			expect(mockCacheInvalidator.invalidateFile).toHaveBeenCalledTimes(1);
		});

		test('should handle file system watcher failures gracefully', async () => {
			const watchError = new Error('File system access denied');
			mockFileSystemWatcher.watchFile.mockRejectedValueOnce(watchError);

			const result = await setupFileSystemWatcher('/restricted/file.js');

			expect(result.success).toBe(false);
			expect(result.fallbackPolling).toBe(true);
			expect(result.error).toMatch(/File system access denied/);
		});
	});

	// Helper functions for testing
	async function invalidateFileCache(filePath, changeType) {
		try {
			cacheManager.state.cacheStats.invalidations++;

			await cacheManager.invalidator.invalidateFile(filePath);

			const relatedKeys = await cacheManager.cache.keys();
			const fileKeys = relatedKeys.filter((key) => key.includes(filePath));

			for (const key of fileKeys) {
				await cacheManager.cache.delete(key);
			}

			if (changeType === 'create' || changeType === 'modify') {
				const dependents =
					await cacheManager.dependencyTracker.getDependents(filePath);
				for (const dependent of dependents) {
					await cacheManager.invalidator.invalidateFile(dependent);
				}
			}

			return { success: true, invalidatedKeys: fileKeys.length };
		} catch (error) {
			return { success: false, error: error.message, recovered: true };
		}
	}

	async function invalidateDirectoryCache(directoryPath) {
		await cacheManager.invalidator.invalidateDirectory(directoryPath);

		const allKeys = await cacheManager.cache.keys();
		const directoryKeys = allKeys.filter((key) => key.includes(directoryPath));

		for (const key of directoryKeys) {
			await cacheManager.cache.delete(key);
		}

		return { invalidatedKeys: directoryKeys.length };
	}

	async function invalidateDirectoryCacheWithPattern(directoryPath, pattern) {
		const allKeys = await cacheManager.cache.keys();
		const regex = new RegExp(pattern.replace('*', '.*'));

		const matchingKeys = allKeys.filter((key) => {
			const filePath = key.split(':')[1]; // Extract file path from cache key
			return (
				filePath && filePath.includes(directoryPath) && regex.test(filePath)
			);
		});

		for (const key of matchingKeys) {
			await cacheManager.cache.delete(key);
		}

		return { invalidatedKeys: matchingKeys.length };
	}

	async function invalidateNestedDirectoryCache(rootPath, options = {}) {
		await cacheManager.invalidator.invalidateDirectory(rootPath, options);

		const allKeys = await cacheManager.cache.keys();
		const nestedKeys = allKeys.filter((key) => {
			const filePath = key.split(':')[1];
			return filePath && filePath.startsWith(rootPath);
		});

		for (const key of nestedKeys) {
			await cacheManager.cache.delete(key);
		}

		return { invalidatedKeys: nestedKeys.length };
	}

	async function invalidateDependencyChain(filePath) {
		const invalidatedFiles = new Set();
		const queue = [filePath];

		while (queue.length > 0) {
			const currentFile = queue.shift();

			if (invalidatedFiles.has(currentFile)) {
				continue; // Prevent infinite loops
			}

			invalidatedFiles.add(currentFile);
			await cacheManager.invalidator.invalidateFile(currentFile);

			const dependents =
				await cacheManager.dependencyTracker.getDependents(currentFile);
			queue.push(...dependents);
		}

		return {
			invalidatedFiles: Array.from(invalidatedFiles),
			circularDependencyDetected:
				invalidatedFiles.size < queue.length + invalidatedFiles.size
		};
	}

	async function invalidateWithDependencyGraph(rootFile) {
		const graph = await cacheManager.dependencyTracker.buildDependencyGraph();
		const toInvalidate = new Set();
		const queue = [{ file: rootFile, level: 0 }];
		let maxLevel = 0;

		while (queue.length > 0) {
			const { file, level } = queue.shift();

			if (toInvalidate.has(file)) continue;

			toInvalidate.add(file);
			maxLevel = Math.max(maxLevel, level);

			const dependents = graph[file] || [];
			dependents.forEach((dependent) => {
				queue.push({ file: dependent, level: level + 1 });
			});
		}

		for (const file of toInvalidate) {
			await cacheManager.invalidator.invalidateFile(file);
		}

		return {
			totalInvalidated: toInvalidate.size,
			dependencyLevels: maxLevel + 1
		};
	}

	function generateLargeDependencyTree(rootFile, totalFiles) {
		const graph = {};
		const files = [rootFile];

		// Generate file names
		for (let i = 1; i < totalFiles; i++) {
			files.push(`/project/src/file${i}.js`);
		}

		// Build dependency relationships
		files.forEach((file, index) => {
			const dependents = [];
			const dependentCount = Math.min(3, totalFiles - index - 1);

			for (let j = 1; j <= dependentCount; j++) {
				if (index + j < files.length) {
					dependents.push(files[index + j]);
				}
			}

			graph[file] = dependents;
		});

		return graph;
	}

	async function invalidateClaudeContextCache(contextFiles, taskId) {
		const contextKey = `claude:context:${taskId}`;

		// Check if there's a cached response
		const cachedResponse =
			await cacheManager.claudeService.getCachedResponse(contextKey);

		if (cachedResponse) {
			await cacheManager.claudeService.invalidateContextCache(contextKey);
		}

		return { contextKey, invalidated: !!cachedResponse };
	}

	async function coordinatedCacheInvalidation(filePath) {
		const allKeys = await cacheManager.cache.keys();
		const relatedKeys = allKeys.filter((key) => key.includes(filePath));

		for (const key of relatedKeys) {
			if (key.startsWith('ast:')) {
				await cacheManager.cache.delete(key);
			} else if (key.startsWith('claude:')) {
				await cacheManager.claudeService.invalidateContextCache(key);
			}
		}

		return { invalidatedKeys: relatedKeys.length };
	}

	async function invalidateVersionedClaudeCache(contextKey) {
		const allKeys = await cacheManager.cache.keys();
		const versionedKeys = allKeys.filter((key) => key.startsWith(contextKey));

		for (const key of versionedKeys) {
			await cacheManager.cache.delete(key);
		}

		return { invalidatedVersions: versionedKeys.length };
	}

	function createBatchInvalidator(batchWindow) {
		const batches = new Map();

		return {
			async invalidate(filePath, changeType) {
				const batchKey = Math.floor(Date.now() / batchWindow);

				if (!batches.has(batchKey)) {
					batches.set(batchKey, []);

					setTimeout(async () => {
						const files = batches.get(batchKey);
						if (files && files.length > 0) {
							await cacheManager.invalidator.invalidateFile(files);
						}
						batches.delete(batchKey);
					}, batchWindow);
				}

				batches.get(batchKey).push(filePath);
			}
		};
	}

	function createThrottledInvalidator(limit) {
		const queue = [];
		let processing = false;

		return {
			async invalidate(filePath, changeType) {
				queue.push({ filePath, changeType });

				if (!processing) {
					processing = true;
					await processQueue();
					processing = false;
				}
			}
		};

		async function processQueue() {
			while (queue.length > 0) {
				const batch = queue.splice(0, limit);
				const files = batch.map((item) => item.filePath);

				await cacheManager.invalidator.invalidateFile(files);

				if (queue.length > 0) {
					await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay between batches
				}
			}
		}
	}

	async function getCacheStatistics() {
		const stats = cacheManager.cache.getStats();

		return {
			...stats,
			totalOperations: stats.hits + stats.misses + stats.invalidations,
			hitRate: (stats.hits / (stats.hits + stats.misses)) * 100
		};
	}

	async function invalidateFileWithRetry(filePath, options = {}) {
		const { maxRetries = 3, delay = 100 } = options;
		let attempts = 0;

		while (attempts < maxRetries) {
			attempts++;
			try {
				await cacheManager.cache.delete(`ast:${filePath}:javascript:hash`);
				return { success: true, attempts };
			} catch (error) {
				if (attempts === maxRetries) {
					return { success: false, attempts, error: error.message };
				}
				await new Promise((resolve) => setTimeout(resolve, delay * attempts));
			}
		}
	}

	async function invalidateMultipleFiles(files) {
		const successful = [];
		const failed = [];

		for (const file of files) {
			try {
				await cacheManager.cache.delete(`ast:${file}:javascript:hash`);
				successful.push(file);
			} catch (error) {
				failed.push({ file, error: error.message });
			}
		}

		return { successful, failed };
	}

	async function invalidateWithFallback(filePath) {
		try {
			await cacheManager.invalidator.invalidateFile(filePath);
			return { success: true, primaryFailed: false, fallbackUsed: false };
		} catch (error) {
			// Fallback: direct cache deletion
			try {
				await cacheManager.cache.delete(`ast:${filePath}:javascript:hash`);
				return { success: true, primaryFailed: true, fallbackUsed: true };
			} catch (fallbackError) {
				return {
					success: false,
					primaryFailed: true,
					fallbackUsed: true,
					error: fallbackError.message
				};
			}
		}
	}

	async function setupFileSystemWatcher(filePath, options = {}) {
		try {
			await cacheManager.fsWatcher.watchFile(filePath, options);
			cacheManager.state.watchedFiles.add(filePath);

			// Setup event handler
			const handleChange = async (path, event) => {
				if (path === filePath) {
					await cacheManager.invalidator.invalidateFile(path);
				}
			};

			cacheManager.fsWatcher.on('change', handleChange);

			return { success: true, watching: true };
		} catch (error) {
			return {
				success: false,
				fallbackPolling: true,
				error: error.message
			};
		}
	}
});
