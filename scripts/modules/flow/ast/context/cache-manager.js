import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

/**
 * AST Cache Manager - Handles caching of AST analysis results
 */

// Cache directory structure: .taskmaster/ast-cache/{language}/{branch-commit}/{file-hash}.ast
const CACHE_DIR = '.taskmaster/ast-cache';
const CACHE_VERSION = '1.0';

/**
 * Generate a cache key for a file
 * @param {string} filePath - Full path to the file
 * @param {string} language - Language identifier
 * @param {string} worktreePath - Worktree path for git context
 * @returns {Promise<string>} Cache key
 */
export async function createCacheKey(filePath, language, worktreePath) {
	try {
		// Get file content hash
		const content = await fs.readFile(filePath, 'utf8');
		const contentHash = crypto
			.createHash('sha256')
			.update(content)
			.digest('hex')
			.substring(0, 16);

		// Get git context
		const gitContext = await getGitContext(worktreePath);

		// Create relative path from worktree
		const relativePath = path.relative(worktreePath, filePath);
		const pathHash = crypto
			.createHash('sha256')
			.update(relativePath)
			.digest('hex')
			.substring(0, 8);

		// Format: {language}/{branch-commit}/{pathHash-contentHash}
		return `${language}/${gitContext.branch}-${gitContext.commit}/${pathHash}-${contentHash}`;
	} catch (error) {
		// Fallback to simple hash if git operations fail
		const content = await fs.readFile(filePath, 'utf8');
		const contentHash = crypto
			.createHash('sha256')
			.update(content)
			.digest('hex')
			.substring(0, 16);
		const relativePath = path.relative(worktreePath, filePath);
		const pathHash = crypto
			.createHash('sha256')
			.update(relativePath)
			.digest('hex')
			.substring(0, 8);

		return `${language}/fallback/${pathHash}-${contentHash}`;
	}
}

/**
 * Get git context for cache key generation
 * @param {string} worktreePath - Path to the worktree
 * @returns {Promise<Object>} Git context object
 */
async function getGitContext(worktreePath) {
	try {
		const branch = execSync('git rev-parse --abbrev-ref HEAD', {
			cwd: worktreePath,
			encoding: 'utf8'
		}).trim();

		const commit = execSync('git rev-parse --short HEAD', {
			cwd: worktreePath,
			encoding: 'utf8'
		}).trim();

		return { branch, commit };
	} catch (error) {
		return { branch: 'unknown', commit: 'unknown' };
	}
}

/**
 * Get cached result or execute function and cache the result
 * @param {string} cacheKey - Cache key
 * @param {Function} executeFunction - Function to execute if cache miss
 * @param {Object} options - Cache options
 * @returns {Promise<Object>} Result with fromCache flag
 */
export async function getCachedOrExecute(
	cacheKey,
	executeFunction,
	options = {}
) {
	const projectRoot = options.projectRoot || findProjectRoot(options.filePath);
	const cacheFile = path.join(projectRoot, CACHE_DIR, `${cacheKey}.ast`);

	try {
		// Check if cache file exists and is valid
		if (await fs.pathExists(cacheFile)) {
			const cacheData = await fs.readJson(cacheFile);

			// Check cache age
			if (isCacheValid(cacheData, options.maxAge)) {
				console.debug('[AST Cache] Hit:', cacheKey);
				return {
					...cacheData.result,
					fromCache: true
				};
			} else {
				console.debug('[AST Cache] Expired:', cacheKey);
			}
		}
	} catch (error) {
		console.debug('[AST Cache] Read error:', error.message);
	}

	// Cache miss - execute function
	console.debug('[AST Cache] Miss:', cacheKey);
	const result = await executeFunction();

	// Cache the result
	try {
		await cacheResult(cacheFile, result, options);
	} catch (error) {
		console.warn('[AST Cache] Failed to cache result:', error.message);
	}

	return {
		...result,
		fromCache: false
	};
}

/**
 * Cache a result to disk
 * @param {string} cacheFile - Path to cache file
 * @param {Object} result - Result to cache
 * @param {Object} options - Cache options
 */
async function cacheResult(cacheFile, result, options = {}) {
	const cacheData = {
		version: CACHE_VERSION,
		timestamp: new Date().toISOString(),
		language: options.language,
		filePath: options.filePath,
		result
	};

	await fs.ensureDir(path.dirname(cacheFile));
	await fs.writeJson(cacheFile, cacheData, { spaces: 2 });

	console.debug('[AST Cache] Stored:', path.basename(cacheFile));
}

/**
 * Check if cache data is still valid
 * @param {Object} cacheData - Cached data
 * @param {string} maxAge - Maximum age (e.g., '2h', '30m')
 * @returns {boolean} True if cache is valid
 */
function isCacheValid(cacheData, maxAge) {
	if (!cacheData.timestamp || !maxAge || maxAge === 'disabled') {
		return false;
	}

	try {
		const cacheTime = new Date(cacheData.timestamp);
		const maxAgeMs = parseDuration(maxAge);
		const now = new Date();

		return now - cacheTime < maxAgeMs;
	} catch (error) {
		return false;
	}
}

/**
 * Parse duration string to milliseconds
 * @param {string} duration - Duration string (e.g., '2h', '30m', '24h')
 * @returns {number} Duration in milliseconds
 */
function parseDuration(duration) {
	const match = duration.match(/^(\d+)([smhd])$/);
	if (!match) throw new Error(`Invalid duration format: ${duration}`);

	const [, value, unit] = match;
	const num = parseInt(value, 10);

	switch (unit) {
		case 's':
			return num * 1000;
		case 'm':
			return num * 60 * 1000;
		case 'h':
			return num * 60 * 60 * 1000;
		case 'd':
			return num * 24 * 60 * 60 * 1000;
		default:
			throw new Error(`Unknown duration unit: ${unit}`);
	}
}

/**
 * Find project root by looking for .taskmaster directory
 * @param {string} startPath - Starting path
 * @returns {string} Project root path
 */
function findProjectRoot(startPath) {
	let currentPath = startPath ? path.dirname(startPath) : process.cwd();

	while (currentPath !== path.dirname(currentPath)) {
		if (fs.existsSync(path.join(currentPath, '.taskmaster'))) {
			return currentPath;
		}
		currentPath = path.dirname(currentPath);
	}

	// Fallback to current working directory
	return process.cwd();
}

/**
 * Initialize cache for a new worktree
 * @param {string} worktreePath - Path to the worktree
 * @param {string} projectRoot - Project root path
 */
export async function initializeWorktreeCache(worktreePath, projectRoot) {
	try {
		const cacheDir = path.join(projectRoot, CACHE_DIR);
		await fs.ensureDir(cacheDir);

		console.debug('[AST Cache] Initialized cache for worktree:', worktreePath);
	} catch (error) {
		console.warn(
			'[AST Cache] Failed to initialize worktree cache:',
			error.message
		);
	}
}

/**
 * Clean up cache for a deleted worktree
 * @param {string} worktreePath - Path to the deleted worktree
 * @param {string} projectRoot - Project root path
 */
export async function cleanupWorktreeCache(worktreePath, projectRoot) {
	try {
		// Get git context for the worktree (if still accessible)
		let gitContext;
		try {
			gitContext = await getGitContext(worktreePath);
		} catch (error) {
			console.debug(
				'[AST Cache] Could not get git context for cleanup, skipping'
			);
			return;
		}

		// Remove cache entries for this specific branch-commit combination
		const cacheDir = path.join(projectRoot, CACHE_DIR);
		const languages = ['javascript', 'typescript', 'python', 'go'];

		for (const language of languages) {
			const languageCacheDir = path.join(cacheDir, language);
			if (await fs.pathExists(languageCacheDir)) {
				const branchCommitPattern = `${gitContext.branch}-${gitContext.commit}`;
				const entries = await fs.readdir(languageCacheDir);

				for (const entry of entries) {
					if (entry.startsWith(branchCommitPattern)) {
						const entryPath = path.join(languageCacheDir, entry);
						await fs.remove(entryPath);
						console.debug('[AST Cache] Cleaned up:', entryPath);
					}
				}
			}
		}
	} catch (error) {
		console.warn(
			'[AST Cache] Failed to cleanup worktree cache:',
			error.message
		);
	}
}

/**
 * Validate cache integrity for a worktree
 * @param {string} worktreePath - Path to the worktree
 * @param {string} projectRoot - Project root path
 * @returns {Promise<Object>} Validation results
 */
export async function validateWorktreeCache(worktreePath, projectRoot) {
	const results = {
		valid: 0,
		invalid: 0,
		missing: 0,
		total: 0
	};

	try {
		const cacheDir = path.join(projectRoot, CACHE_DIR);
		if (!(await fs.pathExists(cacheDir))) {
			return results;
		}

		// Count cache entries
		const languages = ['javascript', 'typescript', 'python', 'go'];
		for (const language of languages) {
			const languageCacheDir = path.join(cacheDir, language);
			if (await fs.pathExists(languageCacheDir)) {
				const entries = await fs.readdir(languageCacheDir);
				for (const entry of entries) {
					if (entry.endsWith('.ast')) {
						results.total++;

						try {
							const cacheFile = path.join(languageCacheDir, entry);
							const cacheData = await fs.readJson(cacheFile);

							if (cacheData.version === CACHE_VERSION) {
								results.valid++;
							} else {
								results.invalid++;
							}
						} catch (error) {
							results.invalid++;
						}
					}
				}
			}
		}

		console.debug('[AST Cache] Validation results:', results);
	} catch (error) {
		console.warn('[AST Cache] Failed to validate cache:', error.message);
	}

	return results;
}

/**
 * Clear all AST cache data
 * @param {string} projectRoot - Project root path
 */
export async function clearAllCache(projectRoot) {
	try {
		const cacheDir = path.join(projectRoot, CACHE_DIR);
		if (await fs.pathExists(cacheDir)) {
			await fs.remove(cacheDir);
			console.debug('[AST Cache] Cleared all cache data');
		}
	} catch (error) {
		console.warn('[AST Cache] Failed to clear cache:', error.message);
	}
}

/**
 * Get cache statistics
 * @param {string} projectRoot - Project root path
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats(projectRoot) {
	const stats = {
		totalFiles: 0,
		totalSize: 0,
		languages: {},
		oldestEntry: null,
		newestEntry: null
	};

	try {
		const cacheDir = path.join(projectRoot, CACHE_DIR);
		if (!(await fs.pathExists(cacheDir))) {
			return stats;
		}

		const languages = ['javascript', 'typescript', 'python', 'go'];
		for (const language of languages) {
			const languageCacheDir = path.join(cacheDir, language);
			if (await fs.pathExists(languageCacheDir)) {
				const entries = await fs.readdir(languageCacheDir);
				const languageStats = { files: 0, size: 0 };

				for (const entry of entries) {
					if (entry.endsWith('.ast')) {
						const cacheFile = path.join(languageCacheDir, entry);
						const fileStat = await fs.stat(cacheFile);

						languageStats.files++;
						languageStats.size += fileStat.size;
						stats.totalFiles++;
						stats.totalSize += fileStat.size;

						// Track oldest/newest
						if (!stats.oldestEntry || fileStat.mtime < stats.oldestEntry) {
							stats.oldestEntry = fileStat.mtime;
						}
						if (!stats.newestEntry || fileStat.mtime > stats.newestEntry) {
							stats.newestEntry = fileStat.mtime;
						}
					}
				}

				if (languageStats.files > 0) {
					stats.languages[language] = languageStats;
				}
			}
		}
	} catch (error) {
		console.warn('[AST Cache] Failed to get cache stats:', error.message);
	}

	return stats;
}
