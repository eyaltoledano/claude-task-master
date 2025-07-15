import { watch } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { detectLanguage } from '../language-detector.js';
import { loadASTConfig } from '../../../shared/config/ast-config.js';

/**
 * AST File Watcher
 *
 * Monitors file changes and emits events for cache invalidation.
 * Supports multi-language projects with configurable exclusion patterns.
 */
export class ASTFileWatcher extends EventEmitter {
	constructor() {
		super();
		this.watchers = new Map(); // path -> watcher
		this.config = null;
		this.isWatching = false;
		this.debounceTimers = new Map(); // path -> timer
		this.debounceDelay = 100; // ms
	}

	/**
	 * Initialize the file watcher
	 */
	async initialize() {
		try {
			const configResult = await loadASTConfig();
			this.config = configResult.config;
		} catch (error) {
			console.warn(
				'Failed to load AST config for file watcher:',
				error.message
			);
			this.config = this.getDefaultConfig();
		}
	}

	/**
	 * Get default configuration
	 */
	getDefaultConfig() {
		return {
			enabled: true,
			supportedLanguages: ['javascript', 'typescript', 'python', 'go'],
			excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
		};
	}

	/**
	 * Start watching a directory for file changes
	 * @param {string} projectRoot - Project root directory to watch
	 * @param {object} options - Watch options
	 * @returns {Promise<boolean>} True if watching started successfully
	 */
	async watch(projectRoot, options = {}) {
		if (!this.config?.enabled) {
			return false;
		}

		if (!this.config) {
			await this.initialize();
		}

		try {
			// Stop existing watcher for this path if any
			if (this.watchers.has(projectRoot)) {
				await this.stopWatching(projectRoot);
			}

			const watchOptions = {
				recursive: true,
				...options
			};

			const watcher = watch(
				projectRoot,
				watchOptions,
				(eventType, filename) => {
					this.handleFileChange(eventType, filename, projectRoot);
				}
			);

			watcher.on('error', (error) => {
				console.warn(`File watcher error for ${projectRoot}:`, error.message);
				this.emit('error', { projectRoot, error });
			});

			this.watchers.set(projectRoot, watcher);
			this.isWatching = true;

			this.emit('watching-started', { projectRoot });
			return true;
		} catch (error) {
			console.warn(`Failed to start watching ${projectRoot}:`, error.message);
			this.emit('error', { projectRoot, error });
			return false;
		}
	}

	/**
	 * Stop watching a specific directory
	 * @param {string} projectRoot - Project root directory
	 * @returns {Promise<boolean>} True if watching stopped successfully
	 */
	async stopWatching(projectRoot) {
		const watcher = this.watchers.get(projectRoot);
		if (!watcher) {
			return false;
		}

		try {
			watcher.close();
			this.watchers.delete(projectRoot);

			// Clear any pending debounce timers for this project
			for (const [timerKey, timer] of this.debounceTimers.entries()) {
				if (timerKey.startsWith(projectRoot)) {
					clearTimeout(timer);
					this.debounceTimers.delete(timerKey);
				}
			}

			if (this.watchers.size === 0) {
				this.isWatching = false;
			}

			this.emit('watching-stopped', { projectRoot });
			return true;
		} catch (error) {
			console.warn(`Failed to stop watching ${projectRoot}:`, error.message);
			return false;
		}
	}

	/**
	 * Stop all watchers
	 * @returns {Promise<boolean>} True if all watchers stopped successfully
	 */
	async stopAll() {
		const projectRoots = Array.from(this.watchers.keys());
		let allStopped = true;

		for (const projectRoot of projectRoots) {
			const stopped = await this.stopWatching(projectRoot);
			if (!stopped) {
				allStopped = false;
			}
		}

		return allStopped;
	}

	/**
	 * Handle file change events
	 * @param {string} eventType - Type of file change ('rename' or 'change')
	 * @param {string} filename - Changed filename (relative to watched directory)
	 * @param {string} projectRoot - Project root directory
	 */
	async handleFileChange(eventType, filename, projectRoot) {
		if (!filename) {
			return; // Ignore events without filename
		}

		const filePath = path.join(projectRoot, filename);
		const debounceKey = `${projectRoot}:${filename}`;

		// Clear existing debounce timer
		const existingTimer = this.debounceTimers.get(debounceKey);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Set new debounce timer
		const timer = setTimeout(async () => {
			this.debounceTimers.delete(debounceKey);
			await this.processFileChange(eventType, filePath, projectRoot);
		}, this.debounceDelay);

		this.debounceTimers.set(debounceKey, timer);
	}

	/**
	 * Process file change after debouncing
	 * @param {string} eventType - Type of file change
	 * @param {string} filePath - Full file path
	 * @param {string} projectRoot - Project root directory
	 */
	async processFileChange(eventType, filePath, projectRoot) {
		try {
			const relativePath = path.relative(projectRoot, filePath);

			// Check if file should be excluded
			if (this.shouldExcludeFile(relativePath)) {
				return;
			}

			// Check if file is a supported language
			const language = await this.detectFileLanguage(filePath);
			if (!language || !this.config.supportedLanguages.includes(language)) {
				return;
			}

			// Emit appropriate event based on change type
			const changeEvent = {
				eventType,
				filePath,
				relativePath,
				projectRoot,
				language,
				timestamp: new Date().toISOString()
			};

			if (eventType === 'rename') {
				// File was added, deleted, or renamed
				this.emit('file-renamed', changeEvent);
				this.emit('cache-invalidate', changeEvent);
			} else if (eventType === 'change') {
				// File content was modified
				this.emit('file-changed', changeEvent);
				this.emit('cache-invalidate', changeEvent);
			}

			// Emit general change event
			this.emit('file-event', changeEvent);
		} catch (error) {
			console.warn(
				`Error processing file change for ${filePath}:`,
				error.message
			);
		}
	}

	/**
	 * Check if a file should be excluded from watching
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
		const regexPattern = pattern
			.replace(/\*\*/g, '.*') // ** matches any path
			.replace(/\*/g, '[^/]*') // * matches any filename chars
			.replace(/\?/g, '[^/]') // ? matches single char
			.replace(/\./g, '\\.'); // Escape dots

		return new RegExp(`^${regexPattern}$`);
	}

	/**
	 * Detect language of a file
	 * @param {string} filePath - File path
	 * @returns {Promise<string|null>} Detected language or null
	 */
	async detectFileLanguage(filePath) {
		try {
			return await detectLanguage(filePath);
		} catch {
			return null;
		}
	}

	/**
	 * Get current watching status
	 * @returns {object} Watching status information
	 */
	getStatus() {
		return {
			isWatching: this.isWatching,
			watchedPaths: Array.from(this.watchers.keys()),
			watcherCount: this.watchers.size,
			pendingDebounces: this.debounceTimers.size
		};
	}

	/**
	 * Set debounce delay for file change events
	 * @param {number} delay - Delay in milliseconds
	 */
	setDebounceDelay(delay) {
		this.debounceDelay = Math.max(0, delay);
	}

	/**
	 * Check if a specific path is being watched
	 * @param {string} projectRoot - Project root directory
	 * @returns {boolean} True if path is being watched
	 */
	isWatchingPath(projectRoot) {
		return this.watchers.has(projectRoot);
	}

	/**
	 * Get supported file extensions based on configuration
	 * @returns {string[]} Array of supported file extensions
	 */
	getSupportedExtensions() {
		const extensionMap = {
			javascript: ['.js', '.jsx', '.mjs', '.cjs'],
			typescript: ['.ts', '.tsx', '.mts', '.cts'],
			python: ['.py', '.pyx', '.pyi', '.pyw'],
			go: ['.go'],
			rust: ['.rs'],
			java: ['.java'],
			'c#': ['.cs'],
			php: ['.php', '.php3', '.php4', '.php5', '.phtml'],
			ruby: ['.rb', '.rbw'],
			cpp: ['.cpp', '.cc', '.cxx', '.c++', '.c'],
			'c++': ['.cpp', '.cc', '.cxx', '.c++', '.c'],
			c: ['.c', '.h']
		};

		const extensions = new Set();
		for (const language of this.config?.supportedLanguages || []) {
			const langExtensions = extensionMap[language.toLowerCase()] || [];
			for (const ext of langExtensions) {
				extensions.add(ext);
			}
		}

		return Array.from(extensions);
	}

	/**
	 * Watch multiple directories
	 * @param {string[]} projectRoots - Array of project root directories
	 * @param {object} options - Watch options
	 * @returns {Promise<object>} Results of watching each directory
	 */
	async watchMultiple(projectRoots, options = {}) {
		const results = {};

		for (const projectRoot of projectRoots) {
			results[projectRoot] = await this.watch(projectRoot, options);
		}

		return results;
	}
}

// Export singleton instance
export const astFileWatcher = new ASTFileWatcher();

// Export class for testing
export default ASTFileWatcher;
