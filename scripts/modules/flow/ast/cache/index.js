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
				return fileWatcher
					? await fileWatcher.watch(projectRoot, watchOptions)
					: false;
			},

			async stopWatching(projectRoot) {
				return fileWatcher
					? await fileWatcher.stopWatching(projectRoot)
					: false;
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
		return this.system.cacheManager.get(
			filePath,
			projectRoot,
			branch,
			commitHash
		);
	}

	/**
	 * Store AST result in cache
	 */
	async set(filePath, projectRoot, astResult, branch, commitHash) {
		if (!this.system) await this.initialize();
		return this.system.cacheManager.set(
			filePath,
			projectRoot,
			astResult,
			branch,
			commitHash
		);
	}

	/**
	 * Invalidate cache for a file
	 */
	async invalidateFile(filePath, projectRoot, branch) {
		if (!this.system) await this.initialize();
		return this.system.cacheManager.invalidateFile(
			filePath,
			projectRoot,
			branch
		);
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

/**
 * Phase 3.2: Smart Invalidation - Unified Export
 *
 * Intelligent cache invalidation with content hashing, dependency tracking,
 * selective invalidation strategies, and batch processing
 */

// Import Phase 3.2 components
import { ContentHasher, createContentHasher } from './content-hasher.js';
import {
	DependencyTracker,
	DependencyTypes,
	createDependencyTracker
} from './dependency-tracker.js';
import {
	SelectiveInvalidation,
	InvalidationStrategy,
	ChangeImpact,
	createSelectiveInvalidation
} from './selective-invalidation.js';
import {
	BatchInvalidation,
	BatchStrategy,
	BatchPriority,
	createBatchInvalidation
} from './batch-invalidation.js';

// Re-export Phase 3.2 components
export {
	ContentHasher,
	createContentHasher,
	DependencyTracker,
	DependencyTypes,
	createDependencyTracker,
	SelectiveInvalidation,
	InvalidationStrategy,
	ChangeImpact,
	createSelectiveInvalidation,
	BatchInvalidation,
	BatchStrategy,
	BatchPriority,
	createBatchInvalidation
};

// Note: Cache components from Phase 1.4 would be integrated here
// export * from '../cache-manager.js';

/**
 * Smart invalidation system factory
 * Creates a complete invalidation system with all components configured
 */
export function createSmartInvalidationSystem(options = {}) {
	const {
		contentHasherOptions = {},
		dependencyTrackerOptions = {},
		selectiveInvalidationOptions = {},
		batchInvalidationOptions = {},
		strategy = 'balanced',
		batchStrategy = 'hybrid'
	} = options;

	// Create core components
	const contentHasher = createContentHasher({
		cacheHashes: true,
		normalizeContent: true,
		gitIntegration: false,
		...contentHasherOptions
	});

	const dependencyTracker = createDependencyTracker({
		maxDepth: 5,
		trackTestFiles: true,
		trackDynamicImports: true,
		crossLanguageSupport: true,
		circularDetection: true,
		...dependencyTrackerOptions
	});

	const selectiveInvalidation = createSelectiveInvalidation({
		strategy,
		contentHasher,
		dependencyTracker,
		maxDepth: 5,
		previewMode: false,
		...selectiveInvalidationOptions
	});

	const batchInvalidation = createBatchInvalidation({
		strategy: batchStrategy,
		selectiveInvalidation,
		contentHasher,
		dependencyTracker,
		batchWindow: 500,
		maxBatchSize: 50,
		maxScopeSize: 200,
		maxWaitTime: 5000,
		...batchInvalidationOptions
	});

	// Create unified interface
	const system = {
		// Core components
		contentHasher,
		dependencyTracker,
		selectiveInvalidation,
		batchInvalidation,

		// Unified methods
		async initialize(projectPath, files) {
			console.info('[SmartInvalidation] Initializing invalidation system...');

			// Build dependency graph
			const graphResult = await dependencyTracker.buildDependencyGraph(
				projectPath,
				files
			);

			console.info(
				`[SmartInvalidation] Built dependency graph with ${graphResult.stats.dependenciesFound} dependencies`
			);

			return {
				initialized: true,
				dependencyStats: graphResult.stats,
				files: files.length
			};
		},

		async invalidateFile(filePath, changeData = {}) {
			return await batchInvalidation.queueChange({
				filePath,
				changeType: 'modify',
				...changeData
			});
		},

		async invalidateFiles(changes) {
			return await batchInvalidation.queueChanges(changes);
		},

		async previewInvalidation(changes) {
			return await selectiveInvalidation.previewInvalidation(changes);
		},

		async flushPendingInvalidations() {
			return await batchInvalidation.flushBatches();
		},

		async updateDependencies(filePath, newDependencies) {
			return await dependencyTracker.updateDependencies(
				filePath,
				newDependencies
			);
		},

		getImpactedFiles(changedFiles) {
			return dependencyTracker.getImpactedFiles(changedFiles);
		},

		calculateImpactScore(filePath) {
			return dependencyTracker.calculateImpactScore(filePath);
		},

		async validateContentHash(filePath, expectedHash) {
			return await contentHasher.validateHashConsistency(
				filePath,
				expectedHash
			);
		},

		getBatchStatus() {
			return batchInvalidation.getBatchStatus();
		},

		getStats() {
			return {
				contentHasher: contentHasher.getStats(),
				dependencyTracker: dependencyTracker.getStats(),
				selectiveInvalidation: selectiveInvalidation.getStats(),
				batchInvalidation: batchInvalidation.getStats()
			};
		},

		async cleanup() {
			contentHasher.cleanup();
			dependencyTracker.clear();
			selectiveInvalidation.clearHistory();
			batchInvalidation.cleanup();
		}
	};

	// Forward events from batch invalidation
	batchInvalidation.on('changeQueued', (change) => {
		system.emit?.('changeQueued', change);
	});

	batchInvalidation.on('batchComplete', (result) => {
		system.emit?.('batchComplete', result);
	});

	batchInvalidation.on('batchError', (error) => {
		system.emit?.('batchError', error);
	});

	return system;
}

/**
 * User configuration presets for different performance/accuracy trade-offs
 */
export const InvalidationPresets = {
	/**
	 * Maximum safety - conservative invalidation with comprehensive dependency tracking
	 */
	SAFE: {
		contentHasherOptions: {
			normalizeContent: true,
			cacheHashes: true
		},
		dependencyTrackerOptions: {
			maxDepth: 5,
			trackTestFiles: true,
			trackDynamicImports: true,
			circularDetection: true
		},
		selectiveInvalidationOptions: {
			strategy: 'conservative',
			maxDepth: 5
		},
		batchInvalidationOptions: {
			strategy: 'time_based',
			batchWindow: 1000,
			maxBatchSize: 20
		}
	},

	/**
	 * Balanced performance and accuracy - recommended for most projects
	 */
	BALANCED: {
		contentHasherOptions: {
			normalizeContent: true,
			cacheHashes: true
		},
		dependencyTrackerOptions: {
			maxDepth: 3,
			trackTestFiles: false,
			trackDynamicImports: true,
			circularDetection: false
		},
		selectiveInvalidationOptions: {
			strategy: 'balanced',
			maxDepth: 3
		},
		batchInvalidationOptions: {
			strategy: 'hybrid',
			batchWindow: 500,
			maxBatchSize: 50
		}
	},

	/**
	 * Maximum performance - aggressive caching with minimal invalidation
	 */
	FAST: {
		contentHasherOptions: {
			normalizeContent: false,
			cacheHashes: true
		},
		dependencyTrackerOptions: {
			maxDepth: 2,
			trackTestFiles: false,
			trackDynamicImports: false,
			circularDetection: false
		},
		selectiveInvalidationOptions: {
			strategy: 'aggressive',
			maxDepth: 2
		},
		batchInvalidationOptions: {
			strategy: 'count_based',
			batchWindow: 200,
			maxBatchSize: 100
		}
	},

	/**
	 * Development mode - immediate processing for quick feedback
	 */
	DEVELOPMENT: {
		contentHasherOptions: {
			normalizeContent: true,
			cacheHashes: false
		},
		dependencyTrackerOptions: {
			maxDepth: 3,
			trackTestFiles: true,
			trackDynamicImports: true,
			circularDetection: true
		},
		selectiveInvalidationOptions: {
			strategy: 'balanced',
			previewMode: false
		},
		batchInvalidationOptions: {
			strategy: 'immediate',
			batchWindow: 0
		}
	}
};

/**
 * Create invalidation system with preset configuration
 */
export function createInvalidationSystemWithPreset(
	presetName,
	customOptions = {}
) {
	const preset = InvalidationPresets[presetName];

	if (!preset) {
		throw new Error(
			`Unknown preset: ${presetName}. Available: ${Object.keys(InvalidationPresets).join(', ')}`
		);
	}

	// Merge custom options with preset
	const mergedOptions = {
		...preset,
		...customOptions,
		contentHasherOptions: {
			...preset.contentHasherOptions,
			...customOptions.contentHasherOptions
		},
		dependencyTrackerOptions: {
			...preset.dependencyTrackerOptions,
			...customOptions.dependencyTrackerOptions
		},
		selectiveInvalidationOptions: {
			...preset.selectiveInvalidationOptions,
			...customOptions.selectiveInvalidationOptions
		},
		batchInvalidationOptions: {
			...preset.batchInvalidationOptions,
			...customOptions.batchInvalidationOptions
		}
	};

	return createSmartInvalidationSystem(mergedOptions);
}

/**
 * Configuration validation helper
 */
export function validateInvalidationConfig(config) {
	const errors = [];

	// Import strategy constants for validation
	const validInvalidationStrategies = [
		'conservative',
		'balanced',
		'aggressive',
		'immediate'
	];
	const validBatchStrategies = [
		'time_based',
		'count_based',
		'size_based',
		'hybrid',
		'immediate'
	];

	// Validate strategy values
	if (
		config.strategy &&
		!validInvalidationStrategies.includes(config.strategy)
	) {
		errors.push(`Invalid invalidation strategy: ${config.strategy}`);
	}

	if (
		config.batchStrategy &&
		!validBatchStrategies.includes(config.batchStrategy)
	) {
		errors.push(`Invalid batch strategy: ${config.batchStrategy}`);
	}

	// Validate numeric values
	if (config.maxDepth && (config.maxDepth < 1 || config.maxDepth > 10)) {
		errors.push('maxDepth must be between 1 and 10');
	}

	if (config.batchWindow && config.batchWindow < 0) {
		errors.push('batchWindow must be non-negative');
	}

	if (config.maxBatchSize && config.maxBatchSize < 1) {
		errors.push('maxBatchSize must be positive');
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

// Default export - main factory functions and presets
export default {
	createSmartInvalidationSystem,
	createInvalidationSystemWithPreset,
	InvalidationPresets,
	validateInvalidationConfig
};
