import fs from 'fs/promises';
import path from 'path';
import { loadASTConfig } from '../../config/ast-config.js';
import { CacheKeyGenerator } from './cache-key-generator.js';

/**
 * AST Cache Cleaner
 *
 * Handles automated cleanup and size management for the AST cache:
 * - Age-based cleanup (expired entries)
 * - Size-based cleanup (LRU eviction)
 * - Orphaned file cleanup
 * - Cache directory maintenance
 */
export class ASTCacheCleaner {
	constructor(cacheRoot = '.taskmaster/ast-cache') {
		this.cacheRoot = cacheRoot;
		this.keyGenerator = new CacheKeyGenerator();
		this.config = null;
		this.isRunning = false;
		this.stats = {
			filesScanned: 0,
			filesDeleted: 0,
			bytesReclaimed: 0,
			lastCleanup: null,
			errors: 0
		};
	}

	/**
	 * Initialize the cache cleaner
	 */
	async initialize() {
		try {
			this.config = await loadASTConfig();
			await this.keyGenerator.initialize();
		} catch (error) {
			console.warn('Failed to initialize AST cache cleaner:', error.message);
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
	 * Run cache cleanup process
	 * @param {object} options - Cleanup options
	 * @returns {Promise<object>} Cleanup results
	 */
	async cleanup(options = {}) {
		if (this.isRunning) {
			return { error: 'Cleanup already in progress' };
		}

		if (!this.config?.enabled) {
			return { skipped: 'Cache disabled' };
		}

		this.isRunning = true;
		this.resetStats();

		try {
			const results = {
				ageCleanup: await this.cleanupByAge(options),
				sizeCleanup: await this.cleanupBySize(options),
				orphanCleanup: await this.cleanupOrphanedFiles(options),
				directoryCleanup: await this.cleanupEmptyDirectories(options)
			};

			this.stats.lastCleanup = new Date().toISOString();

			return {
				success: true,
				stats: this.getStats(),
				details: results
			};
		} catch (error) {
			this.stats.errors++;
			return {
				success: false,
				error: error.message,
				stats: this.getStats()
			};
		} finally {
			this.isRunning = false;
		}
	}

	/**
	 * Clean up cache entries based on age
	 * @param {object} options - Cleanup options
	 * @returns {Promise<object>} Age cleanup results
	 */
	async cleanupByAge(options = {}) {
		const maxAge = this.parseCacheMaxAge(this.config?.cacheMaxAge || '2h');
		const cutoffTime = Date.now() - maxAge;
		const results = {
			filesScanned: 0,
			filesDeleted: 0,
			bytesReclaimed: 0
		};

		try {
			await this.walkCacheDirectory(this.cacheRoot, async (cacheFilePath) => {
				results.filesScanned++;
				this.stats.filesScanned++;

				try {
					const stats = await fs.stat(cacheFilePath);

					// Check if file is older than max age
					if (stats.mtime.getTime() < cutoffTime) {
						const fileSize = stats.size;
						await fs.unlink(cacheFilePath);

						results.filesDeleted++;
						results.bytesReclaimed += fileSize;
						this.stats.filesDeleted++;
						this.stats.bytesReclaimed += fileSize;
					}
				} catch (error) {
					if (error.code !== 'ENOENT') {
						console.warn(
							`Error cleaning file ${cacheFilePath}:`,
							error.message
						);
						this.stats.errors++;
					}
				}
			});
		} catch (error) {
			console.warn('Error during age-based cleanup:', error.message);
			this.stats.errors++;
		}

		return results;
	}

	/**
	 * Clean up cache entries based on total size (LRU eviction)
	 * @param {object} options - Cleanup options
	 * @returns {Promise<object>} Size cleanup results
	 */
	async cleanupBySize(options = {}) {
		const maxSize = this.parseCacheMaxSize(
			this.config?.cacheMaxSize || '100MB'
		);
		const results = {
			totalSize: 0,
			filesScanned: 0,
			filesDeleted: 0,
			bytesReclaimed: 0
		};

		try {
			// Collect all cache files with their metadata
			const cacheFiles = [];

			await this.walkCacheDirectory(this.cacheRoot, async (cacheFilePath) => {
				results.filesScanned++;
				this.stats.filesScanned++;

				try {
					const stats = await fs.stat(cacheFilePath);
					cacheFiles.push({
						path: cacheFilePath,
						size: stats.size,
						mtime: stats.mtime,
						atime: stats.atime
					});
					results.totalSize += stats.size;
				} catch (error) {
					if (error.code !== 'ENOENT') {
						console.warn(`Error stating file ${cacheFilePath}:`, error.message);
						this.stats.errors++;
					}
				}
			});

			// If total size exceeds limit, delete least recently used files
			if (results.totalSize > maxSize) {
				// Sort by access time (least recently used first)
				cacheFiles.sort((a, b) => a.atime.getTime() - b.atime.getTime());

				let currentSize = results.totalSize;
				const targetSize = maxSize * 0.8; // Clean to 80% of limit to avoid frequent cleanups

				for (const file of cacheFiles) {
					if (currentSize <= targetSize) {
						break;
					}

					try {
						await fs.unlink(file.path);
						currentSize -= file.size;
						results.filesDeleted++;
						results.bytesReclaimed += file.size;
						this.stats.filesDeleted++;
						this.stats.bytesReclaimed += file.size;
					} catch (error) {
						if (error.code !== 'ENOENT') {
							console.warn(`Error deleting file ${file.path}:`, error.message);
							this.stats.errors++;
						}
					}
				}
			}
		} catch (error) {
			console.warn('Error during size-based cleanup:', error.message);
			this.stats.errors++;
		}

		return results;
	}

	/**
	 * Clean up orphaned cache files (invalid cache keys)
	 * @param {object} options - Cleanup options
	 * @returns {Promise<object>} Orphan cleanup results
	 */
	async cleanupOrphanedFiles(options = {}) {
		const results = {
			filesScanned: 0,
			filesDeleted: 0,
			bytesReclaimed: 0
		};

		try {
			await this.walkCacheDirectory(this.cacheRoot, async (cacheFilePath) => {
				results.filesScanned++;
				this.stats.filesScanned++;

				try {
					// Extract cache key from file path
					const relativePath = path.relative(this.cacheRoot, cacheFilePath);
					const cacheKey = relativePath.replace(/\.ast$/, '');

					// Check if cache key is valid
					const parsed = this.keyGenerator.parseKey(cacheKey);
					if (!parsed) {
						// Invalid cache key - delete the file
						const stats = await fs.stat(cacheFilePath);
						await fs.unlink(cacheFilePath);

						results.filesDeleted++;
						results.bytesReclaimed += stats.size;
						this.stats.filesDeleted++;
						this.stats.bytesReclaimed += stats.size;
					}
				} catch (error) {
					if (error.code !== 'ENOENT') {
						console.warn(
							`Error checking orphan file ${cacheFilePath}:`,
							error.message
						);
						this.stats.errors++;
					}
				}
			});
		} catch (error) {
			console.warn('Error during orphan cleanup:', error.message);
			this.stats.errors++;
		}

		return results;
	}

	/**
	 * Clean up empty cache directories
	 * @param {object} options - Cleanup options
	 * @returns {Promise<object>} Directory cleanup results
	 */
	async cleanupEmptyDirectories(options = {}) {
		const results = {
			directoriesScanned: 0,
			directoriesDeleted: 0
		};

		try {
			await this.removeEmptyDirectories(this.cacheRoot, results);
		} catch (error) {
			console.warn('Error during directory cleanup:', error.message);
			this.stats.errors++;
		}

		return results;
	}

	/**
	 * Recursively remove empty directories
	 * @param {string} dir - Directory to check
	 * @param {object} results - Results object to update
	 */
	async removeEmptyDirectories(dir, results) {
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });
			results.directoriesScanned++;

			// First, recursively check subdirectories
			for (const entry of entries) {
				if (entry.isDirectory()) {
					const subdirPath = path.join(dir, entry.name);
					await this.removeEmptyDirectories(subdirPath, results);
				}
			}

			// Then check if this directory is now empty (or only contains empty subdirectories)
			const currentEntries = await fs.readdir(dir);
			if (currentEntries.length === 0 && dir !== this.cacheRoot) {
				await fs.rmdir(dir);
				results.directoriesDeleted++;
			}
		} catch (error) {
			if (error.code !== 'ENOENT') {
				console.warn(`Error checking directory ${dir}:`, error.message);
				this.stats.errors++;
			}
		}
	}

	/**
	 * Get cache size statistics
	 * @returns {Promise<object>} Cache size information
	 */
	async getCacheSize() {
		const stats = {
			totalFiles: 0,
			totalSize: 0,
			languages: {},
			branches: {}
		};

		try {
			await this.walkCacheDirectory(this.cacheRoot, async (cacheFilePath) => {
				try {
					const fileStats = await fs.stat(cacheFilePath);
					stats.totalFiles++;
					stats.totalSize += fileStats.size;

					// Parse cache key for additional stats
					const relativePath = path.relative(this.cacheRoot, cacheFilePath);
					const cacheKey = relativePath.replace(/\.ast$/, '');
					const parsed = this.keyGenerator.parseKey(cacheKey);

					if (parsed) {
						// Language stats
						if (!stats.languages[parsed.language]) {
							stats.languages[parsed.language] = { files: 0, size: 0 };
						}
						stats.languages[parsed.language].files++;
						stats.languages[parsed.language].size += fileStats.size;

						// Branch stats
						if (!stats.branches[parsed.branch]) {
							stats.branches[parsed.branch] = { files: 0, size: 0 };
						}
						stats.branches[parsed.branch].files++;
						stats.branches[parsed.branch].size += fileStats.size;
					}
				} catch (error) {
					if (error.code !== 'ENOENT') {
						console.warn(
							`Error getting stats for ${cacheFilePath}:`,
							error.message
						);
					}
				}
			});
		} catch (error) {
			console.warn('Error getting cache size:', error.message);
		}

		return stats;
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
	 * Parse cache max size string to bytes
	 * @param {string} maxSize - Max size string (e.g., '100MB', '1GB')
	 * @returns {number} Max size in bytes
	 */
	parseCacheMaxSize(maxSize) {
		const units = {
			B: 1,
			KB: 1024,
			MB: 1024 * 1024,
			GB: 1024 * 1024 * 1024,
			TB: 1024 * 1024 * 1024 * 1024
		};

		const match = maxSize.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
		if (!match) {
			return 100 * 1024 * 1024; // Default 100MB
		}

		const [, value, unit] = match;
		const normalizedUnit = unit.toUpperCase();
		return Math.floor(parseFloat(value) * units[normalizedUnit]);
	}

	/**
	 * Walk cache directory and execute callback for each cache file
	 * @param {string} dir - Directory to walk
	 * @param {Function} callback - Callback function (cacheFilePath)
	 */
	async walkCacheDirectory(dir, callback) {
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);

				if (entry.isDirectory()) {
					await this.walkCacheDirectory(fullPath, callback);
				} else if (entry.isFile() && entry.name.endsWith('.ast')) {
					await callback(fullPath);
				}
			}
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
	}

	/**
	 * Get cleanup statistics
	 * @returns {object} Cleanup statistics
	 */
	getStats() {
		return {
			...this.stats,
			isRunning: this.isRunning,
			bytesReclaimedFormatted: this.formatBytes(this.stats.bytesReclaimed)
		};
	}

	/**
	 * Reset cleanup statistics
	 */
	resetStats() {
		this.stats = {
			filesScanned: 0,
			filesDeleted: 0,
			bytesReclaimed: 0,
			lastCleanup: this.stats.lastCleanup,
			errors: 0
		};
	}

	/**
	 * Format bytes for human readable display
	 * @param {number} bytes - Number of bytes
	 * @returns {string} Formatted string
	 */
	formatBytes(bytes) {
		if (bytes === 0) return '0 B';

		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const factor = 1024;
		let index = 0;
		let size = bytes;

		while (size >= factor && index < units.length - 1) {
			size /= factor;
			index++;
		}

		return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
	}

	/**
	 * Schedule automatic cleanup
	 * @param {number} intervalMs - Cleanup interval in milliseconds
	 * @returns {object} Timer object that can be cleared
	 */
	scheduleCleanup(intervalMs = 60 * 60 * 1000) {
		// Default: 1 hour
		return setInterval(async () => {
			try {
				await this.cleanup();
			} catch (error) {
				console.warn('Scheduled cleanup error:', error.message);
			}
		}, intervalMs);
	}
}

// Export singleton instance
export const astCacheCleaner = new ASTCacheCleaner();

// Export class for testing
export default ASTCacheCleaner;
