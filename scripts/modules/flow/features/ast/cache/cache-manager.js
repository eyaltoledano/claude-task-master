import fs from 'fs/promises';
import path from 'path';
import { CacheKeyGenerator } from './cache-key-generator.js';
import { loadASTConfig } from '../../../shared/config/ast-config.js';

/**
 * AST Cache Manager
 *
 * Manages cached AST parsing results with support for:
 * - Multi-language caching
 * - Git branch isolation
 * - Content-based invalidation
 * - Size and age-based cleanup
 */
export class ASTCacheManager {
	constructor(cacheRoot = '.taskmaster/ast-cache') {
		this.cacheRoot = cacheRoot;
		this.keyGenerator = new CacheKeyGenerator();
		this.config = null;
		this.stats = {
			hits: 0,
			misses: 0,
			writes: 0,
			deletes: 0,
			errors: 0
		};
	}

	/**
	 * Initialize the cache manager
	 */
	async initialize() {
		try {
			const result = await loadASTConfig();
			// loadASTConfig returns { success: true, config: {...} }
			this.config = result.success ? result.config : this.getDefaultConfig();
			await this.keyGenerator.initialize();
			await this.ensureCacheDirectory();
		} catch (error) {
			console.warn('Failed to initialize AST cache manager:', error.message);
			this.config = this.getDefaultConfig();
		}
	}

	/**
	 * Get default configuration
	 */
	getDefaultConfig() {
		return {
			enabled: true,
			cacheMaxAge: '2h',
			cacheMaxSize: '100MB',
			supportedLanguages: ['javascript', 'typescript', 'python', 'go'],
			excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
		};
	}

	/**
	 * Ensure cache directory exists
	 */
	async ensureCacheDirectory() {
		try {
			await fs.mkdir(this.cacheRoot, { recursive: true });
		} catch (error) {
			if (error.code !== 'EEXIST') {
				throw error;
			}
		}
	}

	/**
	 * Get cached AST result for a file
	 * @param {string} filePath - File path
	 * @param {string} projectRoot - Project root directory
	 * @param {string} branch - Git branch name
	 * @param {string} commitHash - Git commit hash (optional)
	 * @returns {Promise<object|null>} Cached AST result or null if not found
	 */
	async get(filePath, projectRoot, branch = 'main', commitHash = null) {
		if (!this.config?.enabled) {
			return null;
		}

		try {
			const cacheKey = await this.keyGenerator.generateKey(
				filePath,
				projectRoot,
				branch,
				commitHash
			);
			if (!cacheKey) {
				return null;
			}

			const cacheFilePath = this.getCacheFilePath(cacheKey);

			// Check if cache file exists
			try {
				await fs.access(cacheFilePath);
			} catch {
				this.stats.misses++;
				return null;
			}

			// Check if cache is expired
			if (await this.isCacheExpired(cacheFilePath)) {
				await this.delete(cacheKey);
				this.stats.misses++;
				return null;
			}

			// Read and parse cache file
			const cacheData = await fs.readFile(cacheFilePath, 'utf8');
			const result = JSON.parse(cacheData);

			// Update access time for LRU
			await this.updateAccessTime(cacheFilePath);

			this.stats.hits++;
			return result;
		} catch (error) {
			this.stats.errors++;
			console.warn('Cache read error:', error.message);
			return null;
		}
	}

	/**
	 * Store AST result in cache
	 * @param {string} filePath - File path
	 * @param {string} projectRoot - Project root directory
	 * @param {object} astResult - AST parsing result
	 * @param {string} branch - Git branch name
	 * @param {string} commitHash - Git commit hash (optional)
	 * @returns {Promise<boolean>} True if successfully cached
	 */
	async set(
		filePath,
		projectRoot,
		astResult,
		branch = 'main',
		commitHash = null
	) {
		if (!this.config?.enabled) {
			return false;
		}

		try {
			const cacheKey = await this.keyGenerator.generateKey(
				filePath,
				projectRoot,
				branch,
				commitHash
			);
			if (!cacheKey) {
				return false;
			}

			const cacheFilePath = this.getCacheFilePath(cacheKey);

			// Ensure cache directory exists
			await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });

			// Create cache entry with metadata
			const cacheEntry = {
				cacheKey,
				filePath,
				branch,
				commitHash,
				timestamp: new Date().toISOString(),
				accessTime: new Date().toISOString(),
				astResult
			};

			// Write to cache file
			await fs.writeFile(
				cacheFilePath,
				JSON.stringify(cacheEntry, null, 2),
				'utf8'
			);

			this.stats.writes++;
			return true;
		} catch (error) {
			this.stats.errors++;
			console.warn('Cache write error:', error.message);
			return false;
		}
	}

	/**
	 * Delete cached result
	 * @param {string} cacheKey - Cache key
	 * @returns {Promise<boolean>} True if successfully deleted
	 */
	async delete(cacheKey) {
		try {
			const cacheFilePath = this.getCacheFilePath(cacheKey);
			await fs.unlink(cacheFilePath);
			this.stats.deletes++;
			return true;
		} catch (error) {
			if (error.code !== 'ENOENT') {
				this.stats.errors++;
				console.warn('Cache delete error:', error.message);
			}
			return false;
		}
	}

	/**
	 * Invalidate cache for a specific file
	 * @param {string} filePath - File path
	 * @param {string} projectRoot - Project root directory
	 * @param {string} branch - Git branch name (optional, if not provided, invalidates all branches)
	 * @returns {Promise<number>} Number of cache entries invalidated
	 */
	async invalidateFile(filePath, projectRoot, branch = null) {
		try {
			const relativePath = path.relative(projectRoot, filePath);
			let invalidatedCount = 0;

			// If branch is specified, invalidate only that branch
			if (branch) {
				const cacheKey = await this.keyGenerator.generateKey(
					filePath,
					projectRoot,
					branch
				);
				if (cacheKey && (await this.delete(cacheKey))) {
					invalidatedCount++;
				}
			} else {
				// Invalidate all branches for this file
				const cacheEntries = await this.findCacheEntriesForFile(relativePath);
				for (const entry of cacheEntries) {
					if (await this.delete(entry.cacheKey)) {
						invalidatedCount++;
					}
				}
			}

			return invalidatedCount;
		} catch (error) {
			console.warn('Cache invalidation error:', error.message);
			return 0;
		}
	}

	/**
	 * Invalidate cache for an entire branch
	 * @param {string} branch - Git branch name
	 * @returns {Promise<number>} Number of cache entries invalidated
	 */
	async invalidateBranch(branch) {
		try {
			let invalidatedCount = 0;
			const cacheEntries = await this.findCacheEntriesForBranch(branch);

			for (const entry of cacheEntries) {
				if (await this.delete(entry.cacheKey)) {
					invalidatedCount++;
				}
			}

			return invalidatedCount;
		} catch (error) {
			console.warn('Branch cache invalidation error:', error.message);
			return 0;
		}
	}

	/**
	 * Clear entire cache
	 * @returns {Promise<boolean>} True if successfully cleared
	 */
	async clear() {
		try {
			await fs.rm(this.cacheRoot, { recursive: true, force: true });
			await this.ensureCacheDirectory();
			this.resetStats();
			return true;
		} catch (error) {
			console.warn('Cache clear error:', error.message);
			return false;
		}
	}

	/**
	 * Get cache statistics
	 * @returns {object} Cache statistics
	 */
	getStats() {
		const hitRate =
			this.stats.hits + this.stats.misses > 0
				? (
						(this.stats.hits / (this.stats.hits + this.stats.misses)) *
						100
					).toFixed(2)
				: '0.00';

		return {
			...this.stats,
			hitRate: `${hitRate}%`
		};
	}

	/**
	 * Reset cache statistics
	 */
	resetStats() {
		this.stats = {
			hits: 0,
			misses: 0,
			writes: 0,
			deletes: 0,
			errors: 0
		};
	}

	/**
	 * Get cache file path for a cache key
	 * @param {string} cacheKey - Cache key
	 * @returns {string} Cache file path
	 */
	getCacheFilePath(cacheKey) {
		return path.join(this.cacheRoot, `${cacheKey}.ast`);
	}

	/**
	 * Check if cache entry is expired
	 * @param {string} cacheFilePath - Cache file path
	 * @returns {Promise<boolean>} True if expired
	 */
	async isCacheExpired(cacheFilePath) {
		try {
			const stats = await fs.stat(cacheFilePath);
			const maxAge = this.parseCacheMaxAge(this.config?.cacheMaxAge || '2h');
			const ageMs = Date.now() - stats.mtime.getTime();
			return ageMs > maxAge;
		} catch {
			return true;
		}
	}

	/**
	 * Parse cache max age string to milliseconds
	 * @param {string} maxAge - Max age string (e.g., '2h', '30m', '1d')
	 * @returns {number} Max age in milliseconds
	 */
	parseCacheMaxAge(maxAge) {
		const units = {
			s: 1000,
			m: 60 * 1000,
			h: 60 * 60 * 1000,
			d: 24 * 60 * 60 * 1000
		};

		const match = maxAge.match(/^(\d+)([smhd])$/);
		if (!match) {
			return 2 * 60 * 60 * 1000; // Default 2 hours
		}

		const [, value, unit] = match;
		return parseInt(value, 10) * units[unit];
	}

	/**
	 * Update access time for LRU tracking
	 * @param {string} cacheFilePath - Cache file path
	 */
	async updateAccessTime(cacheFilePath) {
		try {
			const now = new Date();
			await fs.utimes(cacheFilePath, now, now);
		} catch {
			// Ignore errors - not critical
		}
	}

	/**
	 * Find cache entries for a specific file
	 * @param {string} relativePath - Relative file path
	 * @returns {Promise<Array>} Array of cache entries
	 */
	async findCacheEntriesForFile(relativePath) {
		const entries = [];
		try {
			await this.walkCacheDirectory(
				this.cacheRoot,
				(cacheFilePath, cacheKey) => {
					const parsed = this.keyGenerator.parseKey(cacheKey);
					if (parsed && parsed.relativePath === relativePath) {
						entries.push({ cacheKey, cacheFilePath });
					}
				}
			);
		} catch (error) {
			console.warn('Error finding cache entries for file:', error.message);
		}
		return entries;
	}

	/**
	 * Find cache entries for a specific branch
	 * @param {string} branch - Branch name
	 * @returns {Promise<Array>} Array of cache entries
	 */
	async findCacheEntriesForBranch(branch) {
		const entries = [];
		try {
			await this.walkCacheDirectory(
				this.cacheRoot,
				(cacheFilePath, cacheKey) => {
					const parsed = this.keyGenerator.parseKey(cacheKey);
					if (parsed && parsed.branch === branch) {
						entries.push({ cacheKey, cacheFilePath });
					}
				}
			);
		} catch (error) {
			console.warn('Error finding cache entries for branch:', error.message);
		}
		return entries;
	}

	/**
	 * Walk cache directory and execute callback for each cache file
	 * @param {string} dir - Directory to walk
	 * @param {Function} callback - Callback function (cacheFilePath, cacheKey)
	 */
	async walkCacheDirectory(dir, callback) {
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);

				if (entry.isDirectory()) {
					await this.walkCacheDirectory(fullPath, callback);
				} else if (entry.isFile() && entry.name.endsWith('.ast')) {
					// Extract cache key from file path
					const relativePath = path.relative(this.cacheRoot, fullPath);
					const cacheKey = relativePath.replace(/\.ast$/, '');
					callback(fullPath, cacheKey);
				}
			}
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
	}
}

// Export singleton instance
export const astCacheManager = new ASTCacheManager();

// Export class for testing
export default ASTCacheManager;
