import crypto from 'crypto';
import path from 'path';
import { detectLanguage } from '../language-detector.js';
import { loadASTConfig } from '../../../shared/config/ast-config.js';

/**
 * Generate cache keys for AST parsing results
 *
 * Cache key format: {language}/{branch}-{commitHash}/{relativePath}
 * Example: "javascript/task-97-abc123/src/auth.js"
 */
export class CacheKeyGenerator {
	constructor() {
		this.config = null;
	}

	/**
	 * Initialize the cache key generator with configuration
	 */
	async initialize() {
		try {
			const result = await loadASTConfig();
			// loadASTConfig returns { success: true, config: {...} }
			this.config = result.success ? result.config : this.getDefaultConfig();
		} catch (error) {
			// Fallback to default config if loading fails
			this.config = this.getDefaultConfig();
		}
	}

	/**
	 * Get default configuration
	 */
	getDefaultConfig() {
		return {
			supportedLanguages: ['javascript', 'typescript', 'python', 'go'],
			excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
		};
	}

	/**
	 * Generate a cache key for a file
	 * @param {string} filePath - Absolute or relative file path
	 * @param {string} projectRoot - Project root directory
	 * @param {string} branch - Git branch name (defaults to 'main')
	 * @param {string} commitHash - Git commit hash (optional)
	 * @returns {Promise<string|null>} Cache key or null if file should not be cached
	 */
	async generateKey(filePath, projectRoot, branch = 'main', commitHash = null) {
		if (!this.config) {
			await this.initialize();
		}

		// Get relative path from project root
		const relativePath = path.relative(projectRoot, filePath);

		// Check if file should be excluded
		if (this.shouldExcludeFile(relativePath)) {
			return null;
		}

		// Detect language
		const language = await detectLanguage(filePath);
		if (!language || !this.config.supportedLanguages.includes(language)) {
			return null;
		}

		// Generate commit hash if not provided
		const hash = commitHash || this.generateContentHash(relativePath, branch);

		// Sanitize branch name for filesystem
		const sanitizedBranch = this.sanitizeBranchName(branch);

		// Create cache key
		const cacheKey = `${language}/${sanitizedBranch}-${hash}/${this.sanitizeFileName(relativePath)}`;

		return cacheKey;
	}

	/**
	 * Generate a cache key for content without file system access
	 * @param {string} content - File content
	 * @param {string} language - Programming language
	 * @param {string} relativePath - Relative file path
	 * @param {string} branch - Git branch name
	 * @param {string} commitHash - Git commit hash (optional)
	 * @returns {string} Cache key
	 */
	generateKeyFromContent(
		content,
		language,
		relativePath,
		branch = 'main',
		commitHash = null
	) {
		// Initialize config if not already done
		if (!this.config) {
			this.config = this.getDefaultConfig();
		}

		if (!this.config.supportedLanguages.includes(language)) {
			return null;
		}

		// Generate content-based hash if no commit hash provided
		const hash = commitHash || this.generateContentHashFromContent(content);

		// Sanitize components
		const sanitizedBranch = this.sanitizeBranchName(branch);
		const sanitizedPath = this.sanitizeFileName(relativePath);

		return `${language}/${sanitizedBranch}-${hash}/${sanitizedPath}`;
	}

	/**
	 * Parse a cache key back into its components
	 * @param {string} cacheKey - Cache key to parse
	 * @returns {object|null} Parsed components or null if invalid
	 */
	parseKey(cacheKey) {
		const keyPattern = /^([^\/]+)\/([^-]+)-([^\/]+)\/(.+)$/;
		const match = cacheKey.match(keyPattern);

		if (!match) {
			return null;
		}

		const [, language, branch, hash, relativePath] = match;

		return {
			language,
			branch,
			hash,
			relativePath: this.unsanitizeFileName(relativePath)
		};
	}

	/**
	 * Generate cache keys for multiple files
	 * @param {string[]} filePaths - Array of file paths
	 * @param {string} projectRoot - Project root directory
	 * @param {string} branch - Git branch name
	 * @param {string} commitHash - Git commit hash (optional)
	 * @returns {Promise<Array<{filePath: string, cacheKey: string}>>} Array of file paths and their cache keys
	 */
	async generateKeys(
		filePaths,
		projectRoot,
		branch = 'main',
		commitHash = null
	) {
		const results = [];

		for (const filePath of filePaths) {
			const cacheKey = await this.generateKey(
				filePath,
				projectRoot,
				branch,
				commitHash
			);
			if (cacheKey) {
				results.push({ filePath, cacheKey });
			}
		}

		return results;
	}

	/**
	 * Check if a file should be excluded from caching
	 * @param {string} relativePath - Relative file path
	 * @returns {boolean} True if file should be excluded
	 */
	shouldExcludeFile(relativePath) {
		if (!this.config?.excludePatterns) {
			return false;
		}

		// Convert glob patterns to regex for simple matching
		for (const pattern of this.config.excludePatterns) {
			const regex = this.globToRegex(pattern);
			if (regex.test(relativePath)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Convert glob pattern to regex
	 * @param {string} pattern - Glob pattern
	 * @returns {RegExp} Regular expression
	 */
	globToRegex(pattern) {
		// Simple glob to regex conversion
		const regexPattern = pattern
			.replace(/\*\*/g, '.*') // ** matches any path
			.replace(/\*/g, '[^/]*') // * matches any filename chars
			.replace(/\?/g, '[^/]') // ? matches single char
			.replace(/\./g, '\\.'); // Escape dots

		return new RegExp(`^${regexPattern}$`);
	}

	/**
	 * Sanitize branch name for use in filesystem paths
	 * @param {string} branch - Git branch name
	 * @returns {string} Sanitized branch name
	 */
	sanitizeBranchName(branch) {
		return branch
			.replace(/[\/\\:*?"<>|]/g, '_') // Replace invalid filename chars
			.replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
			.substring(0, 50); // Limit length
	}

	/**
	 * Sanitize file path for use in cache key
	 * @param {string} filePath - File path
	 * @returns {string} Sanitized file path
	 */
	sanitizeFileName(filePath) {
		return filePath
			.replace(/[\\]/g, '/') // Normalize path separators
			.replace(/[:"*?"<>|]/g, '_'); // Replace problematic chars
	}

	/**
	 * Reverse sanitization of file path
	 * @param {string} sanitizedPath - Sanitized file path
	 * @returns {string} Original file path
	 */
	unsanitizeFileName(sanitizedPath) {
		// For simple cases, just return as-is since we mainly normalize slashes
		return sanitizedPath;
	}

	/**
	 * Generate a hash for cache key based on file path and branch
	 * @param {string} relativePath - Relative file path
	 * @param {string} branch - Git branch name
	 * @returns {string} Generated hash
	 */
	generateContentHash(relativePath, branch) {
		const input = `${relativePath}:${branch}:${Date.now()}`;
		return crypto
			.createHash('sha256')
			.update(input)
			.digest('hex')
			.substring(0, 8);
	}

	/**
	 * Generate a hash based on file content
	 * @param {string} content - File content
	 * @returns {string} Content hash
	 */
	generateContentHashFromContent(content) {
		return crypto
			.createHash('sha256')
			.update(content)
			.digest('hex')
			.substring(0, 8);
	}

	/**
	 * Generate cache directory path for a given language and branch
	 * @param {string} language - Programming language
	 * @param {string} branch - Git branch name
	 * @param {string} commitHash - Git commit hash
	 * @param {string} cacheRoot - Cache root directory (default: .taskmaster/ast-cache)
	 * @returns {string} Cache directory path
	 */
	generateCacheDir(
		language,
		branch,
		commitHash,
		cacheRoot = '.taskmaster/ast-cache'
	) {
		const sanitizedBranch = this.sanitizeBranchName(branch);
		return path.join(cacheRoot, language, `${sanitizedBranch}-${commitHash}`);
	}

	/**
	 * Extract language from cache key
	 * @param {string} cacheKey - Cache key
	 * @returns {string|null} Language or null if invalid
	 */
	extractLanguage(cacheKey) {
		const parts = cacheKey.split('/');
		return parts.length > 0 ? parts[0] : null;
	}

	/**
	 * Extract branch and hash from cache key
	 * @param {string} cacheKey - Cache key
	 * @returns {object|null} {branch, hash} or null if invalid
	 */
	extractBranchAndHash(cacheKey) {
		const parsed = this.parseKey(cacheKey);
		return parsed ? { branch: parsed.branch, hash: parsed.hash } : null;
	}
}

// Export singleton instance
export const cacheKeyGenerator = new CacheKeyGenerator();

// Export class for testing
export default CacheKeyGenerator;
