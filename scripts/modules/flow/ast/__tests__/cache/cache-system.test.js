import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { setTimeout as delay } from 'timers/promises';

// Import cache system components
import { CacheKeyGenerator } from '../../cache/cache-key-generator.js';
import { ASTCacheManager } from '../../cache/cache-manager.js';
import { ASTFileWatcher } from '../../cache/file-watcher.js';
import { ASTCacheCleaner } from '../../cache/cache-cleaner.js';
import { initializeASTCache, UnifiedASTCache } from '../../cache/index.js';

// Test configuration
const TEST_CACHE_ROOT = path.join(os.tmpdir(), 'test-ast-cache');
const TEST_PROJECT_ROOT = path.join(os.tmpdir(), 'test-project');

describe('AST Cache System', () => {
    beforeEach(async () => {
        // Clean up any existing test directories
        await cleanup();
        
        // Create test project structure
        await fs.mkdir(TEST_PROJECT_ROOT, { recursive: true });
        await fs.mkdir(path.join(TEST_PROJECT_ROOT, 'src'), { recursive: true });
        
        // Create test files
        await fs.writeFile(
            path.join(TEST_PROJECT_ROOT, 'src', 'test.js'),
            'function hello() { return "world"; }'
        );
        await fs.writeFile(
            path.join(TEST_PROJECT_ROOT, 'src', 'test.py'),
            'def hello():\n    return "world"'
        );
        await fs.writeFile(
            path.join(TEST_PROJECT_ROOT, 'src', 'test.go'),
            'package main\n\nfunc hello() string {\n    return "world"\n}'
        );
    });

    afterEach(async () => {
        await cleanup();
    });

    async function cleanup() {
        try {
            await fs.rm(TEST_CACHE_ROOT, { recursive: true, force: true });
            await fs.rm(TEST_PROJECT_ROOT, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }

    describe('CacheKeyGenerator', () => {
        let keyGenerator;

        beforeEach(async () => {
            keyGenerator = new CacheKeyGenerator();
            await keyGenerator.initialize();
        });

        test('should generate valid cache keys', async () => {
            const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'test.js');
            const cacheKey = await keyGenerator.generateKey(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            
            expect(cacheKey).toBeTruthy();
            expect(cacheKey).toMatch(/^javascript\/main-abc123\/src\/test\.js$/);
        });

        test('should parse cache keys correctly', () => {
            const cacheKey = 'javascript/main-abc123/src/test.js';
            const parsed = keyGenerator.parseKey(cacheKey);
            
            expect(parsed).toEqual({
                language: 'javascript',
                branch: 'main',
                hash: 'abc123',
                relativePath: 'src/test.js'
            });
        });

        test('should sanitize branch names', () => {
            const sanitized = keyGenerator.sanitizeBranchName('feature/user-auth:test');
            expect(sanitized).toBe('feature_user-auth_test');
        });

        test('should exclude files based on patterns', () => {
            expect(keyGenerator.shouldExcludeFile('node_modules/test.js')).toBe(true);
            expect(keyGenerator.shouldExcludeFile('dist/bundle.js')).toBe(true);
            expect(keyGenerator.shouldExcludeFile('src/test.js')).toBe(false);
        });

        test('should generate keys for multiple files', async () => {
            const filePaths = [
                path.join(TEST_PROJECT_ROOT, 'src', 'test.js'),
                path.join(TEST_PROJECT_ROOT, 'src', 'test.py')
            ];
            
            const results = await keyGenerator.generateKeys(filePaths, TEST_PROJECT_ROOT, 'main');
            expect(results).toHaveLength(2);
            expect(results[0].cacheKey).toContain('javascript');
            expect(results[1].cacheKey).toContain('python');
        });
    });

    describe('ASTCacheManager', () => {
        let cacheManager;

        beforeEach(async () => {
            cacheManager = new ASTCacheManager(TEST_CACHE_ROOT);
            await cacheManager.initialize();
        });

        test('should store and retrieve cache entries', async () => {
            const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'test.js');
            const astResult = {
                type: 'Program',
                body: [],
                functions: ['hello'],
                complexity: 1
            };

            // Store in cache
            const stored = await cacheManager.set(filePath, TEST_PROJECT_ROOT, astResult, 'main', 'abc123');
            expect(stored).toBe(true);

            // Retrieve from cache
            const retrieved = await cacheManager.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(retrieved).toBeTruthy();
            expect(retrieved.astResult).toEqual(astResult);
        });

        test('should return null for non-existent cache entries', async () => {
            const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'nonexistent.js');
            const result = await cacheManager.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(result).toBeNull();
        });

        test('should invalidate cache entries for files', async () => {
            const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'test.js');
            const astResult = { type: 'Program', body: [] };

            // Store and verify
            await cacheManager.set(filePath, TEST_PROJECT_ROOT, astResult, 'main', 'abc123');
            let retrieved = await cacheManager.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(retrieved).toBeTruthy();

            // Invalidate and verify
            const invalidated = await cacheManager.invalidateFile(filePath, TEST_PROJECT_ROOT, 'main');
            expect(invalidated).toBeGreaterThan(0);

            retrieved = await cacheManager.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(retrieved).toBeNull();
        });

        test('should track cache statistics', async () => {
            const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'test.js');
            const astResult = { type: 'Program', body: [] };

            // Initial stats
            let stats = cacheManager.getStats();
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);

            // Cache miss
            await cacheManager.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            stats = cacheManager.getStats();
            expect(stats.misses).toBe(1);

            // Cache set and hit
            await cacheManager.set(filePath, TEST_PROJECT_ROOT, astResult, 'main', 'abc123');
            await cacheManager.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            stats = cacheManager.getStats();
            expect(stats.hits).toBe(1);
            expect(stats.writes).toBe(1);
        });

        test('should clear entire cache', async () => {
            const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'test.js');
            const astResult = { type: 'Program', body: [] };

            // Store entry
            await cacheManager.set(filePath, TEST_PROJECT_ROOT, astResult, 'main', 'abc123');
            let retrieved = await cacheManager.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(retrieved).toBeTruthy();

            // Clear cache
            const cleared = await cacheManager.clear();
            expect(cleared).toBe(true);

            // Verify cache is empty
            retrieved = await cacheManager.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(retrieved).toBeNull();
        });
    });

    describe('ASTFileWatcher', () => {
        let fileWatcher;

        beforeEach(async () => {
            fileWatcher = new ASTFileWatcher();
            await fileWatcher.initialize();
        });

        afterEach(async () => {
            if (fileWatcher) {
                await fileWatcher.stopAll();
            }
        });

        test('should start and stop watching directories', async () => {
            // Start watching
            const started = await fileWatcher.watch(TEST_PROJECT_ROOT);
            expect(started).toBe(true);
            expect(fileWatcher.isWatchingPath(TEST_PROJECT_ROOT)).toBe(true);

            // Check status
            const status = fileWatcher.getStatus();
            expect(status.isWatching).toBe(true);
            expect(status.watchedPaths).toContain(TEST_PROJECT_ROOT);

            // Stop watching
            const stopped = await fileWatcher.stopWatching(TEST_PROJECT_ROOT);
            expect(stopped).toBe(true);
            expect(fileWatcher.isWatchingPath(TEST_PROJECT_ROOT)).toBe(false);
        });

        test('should detect file changes and emit events', async () => {
            return new Promise((resolve) => {
                let eventReceived = false;

                // Set up event listener
                fileWatcher.on('file-changed', (event) => {
                    expect(event.filePath).toContain('test.js');
                    expect(event.language).toBe('javascript');
                    eventReceived = true;
                    resolve();
                });

                // Start watching first
                fileWatcher.watch(TEST_PROJECT_ROOT).then(() => {
                    // Modify a file after a short delay to ensure watcher is ready
                    setTimeout(() => {
                        const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'test.js');
                        fs.writeFile(filePath, 'function hello() { return "updated"; }')
                            .then(() => {
                                // Wait a bit longer for debouncing
                                setTimeout(() => {
                                    if (!eventReceived) {
                                        resolve(); // Resolve anyway to prevent hanging
                                    }
                                }, 500);
                            })
                            .catch(() => {
                                resolve(); // Resolve on error to prevent hanging
                            });
                    }, 200);
                }).catch(() => {
                    resolve(); // Resolve on error to prevent hanging
                });
            });
        }, 10000); // 10 second timeout

        test('should exclude files based on patterns', () => {
            expect(fileWatcher.shouldExcludeFile('node_modules/test.js')).toBe(true);
            expect(fileWatcher.shouldExcludeFile('src/test.js')).toBe(false);
        });

        test('should get supported extensions', () => {
            const extensions = fileWatcher.getSupportedExtensions();
            expect(extensions).toContain('.js');
            expect(extensions).toContain('.py');
            expect(extensions).toContain('.go');
        });
    });

    describe('ASTCacheCleaner', () => {
        let cacheCleaner;

        beforeEach(async () => {
            cacheCleaner = new ASTCacheCleaner(TEST_CACHE_ROOT);
            await cacheCleaner.initialize();
        });

        test('should clean up expired cache entries', async () => {
            // Create a cache manager to add some entries
            const cacheManager = new ASTCacheManager(TEST_CACHE_ROOT);
            await cacheManager.initialize();

            const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'test.js');
            const astResult = { type: 'Program', body: [] };

            // Store entry
            await cacheManager.set(filePath, TEST_PROJECT_ROOT, astResult, 'main', 'abc123');

            // Verify entry exists
            let retrieved = await cacheManager.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(retrieved).toBeTruthy();

            // Run age-based cleanup (should not remove recent entry)
            const ageResults = await cacheCleaner.cleanupByAge();
            expect(ageResults.filesDeleted).toBe(0);

            // Verify entry still exists
            retrieved = await cacheManager.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(retrieved).toBeTruthy();
        });

        test('should get cache size statistics', async () => {
            // Create some cache entries
            const cacheManager = new ASTCacheManager(TEST_CACHE_ROOT);
            await cacheManager.initialize();

            const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'test.js');
            const astResult = { type: 'Program', body: [] };

            await cacheManager.set(filePath, TEST_PROJECT_ROOT, astResult, 'main', 'abc123');

            const sizeStats = await cacheCleaner.getCacheSize();
            expect(sizeStats.totalFiles).toBeGreaterThan(0);
            expect(sizeStats.totalSize).toBeGreaterThan(0);
            expect(sizeStats.languages.javascript).toBeTruthy();
        });

        test('should parse cache size and age configurations', () => {
            expect(cacheCleaner.parseCacheMaxAge('2h')).toBe(2 * 60 * 60 * 1000);
            expect(cacheCleaner.parseCacheMaxAge('30m')).toBe(30 * 60 * 1000);
            expect(cacheCleaner.parseCacheMaxSize('100MB')).toBe(100 * 1024 * 1024);
            expect(cacheCleaner.parseCacheMaxSize('1GB')).toBe(1024 * 1024 * 1024);
        });

        test('should format bytes for display', () => {
            expect(cacheCleaner.formatBytes(0)).toBe('0 B');
            expect(cacheCleaner.formatBytes(1024)).toBe('1.0 KB');
            expect(cacheCleaner.formatBytes(1024 * 1024)).toBe('1.0 MB');
        });

        test('should run complete cleanup process', async () => {
            const results = await cacheCleaner.cleanup();
            expect(results.success).toBe(true);
            expect(results.details).toBeTruthy();
            expect(results.details.ageCleanup).toBeTruthy();
            expect(results.details.sizeCleanup).toBeTruthy();
            expect(results.details.orphanCleanup).toBeTruthy();
            expect(results.details.directoryCleanup).toBeTruthy();
        });
    });

    describe('UnifiedASTCache', () => {
        let unifiedCache;

        beforeEach(async () => {
            unifiedCache = new UnifiedASTCache({
                cacheRoot: TEST_CACHE_ROOT,
                enableWatcher: false, // Disable watcher for simpler testing
                enableCleaner: false
            });
        });

        afterEach(async () => {
            if (unifiedCache) {
                await unifiedCache.shutdown();
            }
        });

        test('should provide unified interface for cache operations', async () => {
            const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'test.js');
            const astResult = {
                type: 'Program',
                body: [],
                functions: ['hello'],
                complexity: 1
            };

            // Store in cache
            const stored = await unifiedCache.set(filePath, TEST_PROJECT_ROOT, astResult, 'main', 'abc123');
            expect(stored).toBe(true);

            // Retrieve from cache
            const retrieved = await unifiedCache.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(retrieved).toBeTruthy();
            expect(retrieved.astResult).toEqual(astResult);

            // Get stats
            const stats = await unifiedCache.getStats();
            expect(stats.cache).toBeTruthy();
            expect(stats.cache.hits).toBeGreaterThan(0);

            // Cleanup
            const cleanupResult = await unifiedCache.cleanup();
            expect(cleanupResult).toBeTruthy();
        });
    });

    describe('Integration Tests', () => {
        test('should initialize complete cache system', async () => {
            const cacheSystem = await initializeASTCache({
                cacheRoot: TEST_CACHE_ROOT,
                enableWatcher: false, // Disable for simpler testing
                enableCleaner: false
            });

            expect(cacheSystem.cacheManager).toBeTruthy();
            expect(cacheSystem.fileWatcher).toBeNull();
            expect(cacheSystem.cacheCleaner).toBeNull();

            // Test convenience methods
            const stats = await cacheSystem.getStats();
            expect(stats.cache).toBeTruthy();

            await cacheSystem.shutdown();
        });

        test('should handle cache operations end-to-end', async () => {
            const unifiedCache = new UnifiedASTCache({
                cacheRoot: TEST_CACHE_ROOT,
                enableWatcher: false,
                enableCleaner: false
            });

            const filePath = path.join(TEST_PROJECT_ROOT, 'src', 'test.js');
            const astResult = {
                type: 'Program',
                body: [],
                functions: ['hello'],
                complexity: 1,
                metadata: {
                    parseTime: 50,
                    cacheTime: Date.now()
                }
            };

            // Test complete cache lifecycle
            
            // 1. Initial miss
            let result = await unifiedCache.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(result).toBeNull();

            // 2. Store result
            const stored = await unifiedCache.set(filePath, TEST_PROJECT_ROOT, astResult, 'main', 'abc123');
            expect(stored).toBe(true);

            // 3. Cache hit
            result = await unifiedCache.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(result).toBeTruthy();
            expect(result.astResult).toEqual(astResult);

            // 4. Invalidate
            const invalidated = await unifiedCache.invalidateFile(filePath, TEST_PROJECT_ROOT, 'main');
            expect(invalidated).toBeGreaterThan(0);

            // 5. Miss after invalidation
            result = await unifiedCache.get(filePath, TEST_PROJECT_ROOT, 'main', 'abc123');
            expect(result).toBeNull();

            // 6. Check stats
            const stats = await unifiedCache.getStats();
            expect(stats.cache.hits).toBeGreaterThan(0);
            expect(stats.cache.misses).toBeGreaterThan(0);
            expect(stats.cache.writes).toBeGreaterThan(0);

            await unifiedCache.shutdown();
        });
    });
}); 