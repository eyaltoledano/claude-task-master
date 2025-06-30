/**
 * AST Cache System
 * 
 * Complete cache management system for AST parsing results with:
 * - Multi-language support
 * - Git branch isolation  
 * - Intelligent cache key generation
 * - File watching and invalidation
 * - Size and age-based cleanup
 */

// Core cache components
import { ASTCacheManager, astCacheManager } from './cache-manager.js';
import { CacheKeyGenerator, cacheKeyGenerator } from './cache-key-generator.js';
import { ASTFileWatcher, astFileWatcher } from './file-watcher.js';
import ASTCacheCleaner, { astCacheCleaner } from './cache-cleaner.js';

// Export all components
export { 
    ASTCacheManager, 
    astCacheManager,
    CacheKeyGenerator,
    cacheKeyGenerator,
    ASTFileWatcher,
    astFileWatcher,
    ASTCacheCleaner,
    astCacheCleaner
};

/**
 * Initialize the complete AST cache system
 * @param {object} options - Initialization options
 * @returns {Promise<object>} Initialized cache system
 */
export async function initializeASTCache(options = {}) {
    const {
        cacheRoot = '.taskmaster/ast-cache',
        enableWatcher = true,
        enableCleaner = true,
        watcherDebounceDelay = 100,
        cleanupInterval = 60 * 60 * 1000 // 1 hour
    } = options;

    try {
        // Initialize cache manager
        const cacheManager = new ASTCacheManager(cacheRoot);
        await cacheManager.initialize();

        // Initialize file watcher if enabled
        let fileWatcher = null;
        if (enableWatcher) {
            fileWatcher = new ASTFileWatcher();
            await fileWatcher.initialize();
            fileWatcher.setDebounceDelay(watcherDebounceDelay);

            // Connect file watcher to cache invalidation
            fileWatcher.on('cache-invalidate', async (event) => {
                try {
                    await cacheManager.invalidateFile(event.filePath, event.projectRoot);
                } catch (error) {
                    console.warn('Cache invalidation error:', error.message);
                }
            });
        }

        // Initialize cache cleaner if enabled
        let cacheCleaner = null;
        let cleanupTimer = null;
        if (enableCleaner) {
            cacheCleaner = new ASTCacheCleaner(cacheRoot);
            await cacheCleaner.initialize();

            // Schedule automatic cleanup
            cleanupTimer = cacheCleaner.scheduleCleanup(cleanupInterval);
        }

        return {
            cacheManager,
            fileWatcher,
            cacheCleaner,
            cleanupTimer,
            
            // Convenience methods
            async cleanup() {
                return cacheCleaner ? await cacheCleaner.cleanup() : null;
            },

            async startWatching(projectRoot, watchOptions = {}) {
                return fileWatcher ? await fileWatcher.watch(projectRoot, watchOptions) : false;
            },

            async stopWatching(projectRoot) {
                return fileWatcher ? await fileWatcher.stopWatching(projectRoot) : false;
            },

            async getStats() {
                return {
                    cache: cacheManager.getStats(),
                    watcher: fileWatcher ? fileWatcher.getStatus() : null,
                    cleaner: cacheCleaner ? cacheCleaner.getStats() : null
                };
            },

            async shutdown() {
                if (cleanupTimer) {
                    clearInterval(cleanupTimer);
                }
                if (fileWatcher) {
                    await fileWatcher.stopAll();
                }
            }
        };
    } catch (error) {
        throw new Error(`Failed to initialize AST cache system: ${error.message}`);
    }
}

/**
 * Create a simple cache instance for basic usage
 * @param {string} cacheRoot - Cache root directory
 * @returns {Promise<ASTCacheManager>} Initialized cache manager
 */
export async function createSimpleCache(cacheRoot = '.taskmaster/ast-cache') {
    const cacheManager = new ASTCacheManager(cacheRoot);
    await cacheManager.initialize();
    return cacheManager;
}

/**
 * Unified cache interface for easy usage
 * Combines all cache functionality in a single class
 */
export class UnifiedASTCache {
    constructor(options = {}) {
        this.options = {
            cacheRoot: '.taskmaster/ast-cache',
            enableWatcher: true,
            enableCleaner: true,
            ...options
        };
        this.system = null;
    }

    /**
     * Initialize the unified cache system
     */
    async initialize() {
        if (this.system) {
            return this.system;
        }

        this.system = await initializeASTCache(this.options);
        return this.system;
    }

    /**
     * Get cached AST result
     */
    async get(filePath, projectRoot, branch, commitHash) {
        if (!this.system) await this.initialize();
        return this.system.cacheManager.get(filePath, projectRoot, branch, commitHash);
    }

    /**
     * Store AST result in cache
     */
    async set(filePath, projectRoot, astResult, branch, commitHash) {
        if (!this.system) await this.initialize();
        return this.system.cacheManager.set(filePath, projectRoot, astResult, branch, commitHash);
    }

    /**
     * Invalidate cache for a file
     */
    async invalidateFile(filePath, projectRoot, branch) {
        if (!this.system) await this.initialize();
        return this.system.cacheManager.invalidateFile(filePath, projectRoot, branch);
    }

    /**
     * Start watching a project for file changes
     */
    async startWatching(projectRoot, options) {
        if (!this.system) await this.initialize();
        return this.system.startWatching(projectRoot, options);
    }

    /**
     * Stop watching a project
     */
    async stopWatching(projectRoot) {
        if (!this.system) await this.initialize();
        return this.system.stopWatching(projectRoot);
    }

    /**
     * Run cache cleanup
     */
    async cleanup() {
        if (!this.system) await this.initialize();
        return this.system.cleanup();
    }

    /**
     * Get comprehensive cache statistics
     */
    async getStats() {
        if (!this.system) await this.initialize();
        return this.system.getStats();
    }

    /**
     * Shutdown the cache system
     */
    async shutdown() {
        if (this.system) {
            await this.system.shutdown();
            this.system = null;
        }
    }
}

// Export default unified cache instance
export const unifiedASTCache = new UnifiedASTCache();

// Export convenience aliases
export {
    // From cache-manager
    ASTCacheManager as CacheManager,
    astCacheManager as cacheManager,
    
    // From cache-key-generator  
    CacheKeyGenerator as KeyGenerator,
    cacheKeyGenerator as keyGenerator,
    
    // From file-watcher
    ASTFileWatcher as FileWatcher,
    astFileWatcher as fileWatcher,
    
    // From cache-cleaner
    ASTCacheCleaner as CacheCleaner,
    astCacheCleaner as cacheCleaner
}; 