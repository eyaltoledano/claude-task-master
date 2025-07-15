/**
 * Watch Manager - Phase 3.1.4
 *
 * Central coordinator for the file watching system that orchestrates the file watcher,
 * change processor, and batch processor. Provides a unified interface for managing
 * file watching with advanced features like git integration and configuration management.
 *
 * Features:
 * - Unified file watching interface
 * - Component coordination and lifecycle management
 * - Configuration-based cache strategy management
 * - Git hook integration for repository events
 * - Performance monitoring and reporting
 * - Graceful shutdown and error recovery
 *
 * @author Task Master Flow
 * @version 3.1.0
 */

import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs-extra';
import { execAsync } from '../../../../utils.js';
import { loadASTConfig } from '../src/config/ast-config.js';
import { createFileWatcher } from './file-watcher.js';
import { createChangeProcessor } from './change-processor.js';
import { createBatchProcessor, BatchStrategy } from './batch-processor.js';

/**
 * Cache strategy options (configurable by user)
 */
export const CacheStrategy = {
	CONSERVATIVE: 'conservative', // Minimal invalidation, slower updates
	BALANCED: 'balanced', // Balanced approach (default)
	AGGRESSIVE: 'aggressive', // Frequent invalidation, faster updates
	IMMEDIATE: 'immediate' // Real-time invalidation, highest resource usage
};

/**
 * Watch states
 */
export const WatchState = {
	STOPPED: 'stopped',
	STARTING: 'starting',
	WATCHING: 'watching',
	PAUSED: 'paused',
	STOPPING: 'stopping',
	ERROR: 'error'
};

/**
 * Central manager for coordinating all file watching components
 */
export class WatchManager extends EventEmitter {
	constructor(projectPath, options = {}) {
		super();

		this.projectPath = path.resolve(projectPath);
		this.options = {
			cacheStrategy: CacheStrategy.BALANCED,
			enableGitIntegration: false, // Disabled by default for safety
			enablePreemptiveAnalysis: true,
			maxConcurrentAnalysis: 3,
			dependencyAnalysisDepth: 3,
			cpuThrottleThreshold: 80,
			batchWindow: 500,
			...options
		};

		this.state = WatchState.STOPPED;
		this.astConfig = null;

		// Component instances
		this.fileWatcher = null;
		this.changeProcessor = null;
		this.batchProcessor = null;

		// Git integration
		this.gitHooksInstalled = false;

		// Statistics and monitoring
		this.stats = {
			startTime: null,
			totalChangesDetected: 0,
			totalChangesProcessed: 0,
			totalBatchesProcessed: 0,
			gitOperationsDetected: 0,
			errorCount: 0,
			lastErrorTime: null
		};

		// Bind event handlers
		this._bindEventHandlers();
	}

	/**
	 * Initialize the watch manager and all components
	 */
	async initialize() {
		if (this.state !== WatchState.STOPPED) {
			console.warn('[WatchManager] Already initialized');
			return false;
		}

		this.state = WatchState.STARTING;

		try {
			console.info(`[WatchManager] Initializing for ${this.projectPath}`);

			// Load AST configuration
			const configResult = await loadASTConfig(this.projectPath);
			this.astConfig = configResult.config;

			// Configure components based on cache strategy
			const componentOptions = this._getComponentOptions();

			// Initialize file watcher
			this.fileWatcher = createFileWatcher(
				this.projectPath,
				componentOptions.fileWatcher
			);
			if (!(await this.fileWatcher.initialize())) {
				throw new Error('Failed to initialize file watcher');
			}

			// Initialize change processor
			this.changeProcessor = createChangeProcessor(
				this.projectPath,
				componentOptions.changeProcessor
			);
			if (!(await this.changeProcessor.initialize())) {
				throw new Error('Failed to initialize change processor');
			}

			// Initialize batch processor
			this.batchProcessor = createBatchProcessor(
				this.projectPath,
				componentOptions.batchProcessor
			);
			if (!(await this.batchProcessor.initialize())) {
				throw new Error('Failed to initialize batch processor');
			}

			// Set up git integration if enabled
			if (this.options.enableGitIntegration) {
				await this._setupGitIntegration();
			}

			console.info('[WatchManager] Initialization complete');
			this.emit('initialized');

			return true;
		} catch (error) {
			this.state = WatchState.ERROR;
			console.error(`[WatchManager] Initialization failed: ${error.message}`);
			this.emit('initializationError', error);
			return false;
		}
	}

	/**
	 * Start file watching
	 */
	async startWatching() {
		if (this.state === WatchState.WATCHING) {
			console.warn('[WatchManager] Already watching');
			return false;
		}

		if (
			this.state !== WatchState.STARTING &&
			this.state !== WatchState.STOPPED
		) {
			await this.initialize();
		}

		try {
			console.info('[WatchManager] Starting file watching');
			this.state = WatchState.STARTING;

			// Start file watcher
			if (!(await this.fileWatcher.startWatching())) {
				throw new Error('Failed to start file watcher');
			}

			this.state = WatchState.WATCHING;
			this.stats.startTime = new Date();

			console.info('[WatchManager] File watching started');
			this.emit('watchingStarted');

			return true;
		} catch (error) {
			this.state = WatchState.ERROR;
			console.error(
				`[WatchManager] Failed to start watching: ${error.message}`
			);
			this.emit('watchingError', error);
			return false;
		}
	}

	/**
	 * Stop file watching
	 */
	async stopWatching() {
		if (this.state === WatchState.STOPPED) {
			console.warn('[WatchManager] Already stopped');
			return false;
		}

		try {
			console.info('[WatchManager] Stopping file watching');
			this.state = WatchState.STOPPING;

			// Stop components in reverse order
			if (this.batchProcessor) {
				await this.batchProcessor.stop();
			}

			if (this.fileWatcher) {
				await this.fileWatcher.stopWatching();
			}

			this.state = WatchState.STOPPED;

			console.info('[WatchManager] File watching stopped');
			this.emit('watchingStopped');

			return true;
		} catch (error) {
			this.state = WatchState.ERROR;
			console.error(`[WatchManager] Failed to stop watching: ${error.message}`);
			this.emit('watchingError', error);
			return false;
		}
	}

	/**
	 * Pause file watching (useful during git operations)
	 */
	async pauseWatching() {
		if (this.state !== WatchState.WATCHING) {
			return false;
		}

		try {
			if (this.fileWatcher) {
				await this.fileWatcher.pauseWatching();
			}

			this.state = WatchState.PAUSED;
			console.debug('[WatchManager] Watching paused');
			this.emit('watchingPaused');

			return true;
		} catch (error) {
			console.error(
				`[WatchManager] Failed to pause watching: ${error.message}`
			);
			return false;
		}
	}

	/**
	 * Resume file watching after pause
	 */
	async resumeWatching() {
		if (this.state !== WatchState.PAUSED) {
			return false;
		}

		try {
			if (this.fileWatcher) {
				await this.fileWatcher.resumeWatching();
			}

			this.state = WatchState.WATCHING;
			console.debug('[WatchManager] Watching resumed');
			this.emit('watchingResumed');

			return true;
		} catch (error) {
			console.error(
				`[WatchManager] Failed to resume watching: ${error.message}`
			);
			return false;
		}
	}

	/**
	 * Update cache strategy configuration
	 */
	async updateCacheStrategy(strategy) {
		if (!Object.values(CacheStrategy).includes(strategy)) {
			throw new Error(`Invalid cache strategy: ${strategy}`);
		}

		this.options.cacheStrategy = strategy;

		// Update component configurations
		const componentOptions = this._getComponentOptions();

		// Update batch processor strategy
		if (this.batchProcessor) {
			this.batchProcessor.options = {
				...this.batchProcessor.options,
				...componentOptions.batchProcessor
			};
		}

		console.info(`[WatchManager] Cache strategy updated to: ${strategy}`);
		this.emit('cacheStrategyUpdated', { strategy });
	}

	/**
	 * Bind event handlers for components
	 */
	_bindEventHandlers() {
		// File watcher events
		this.on('fileWatcherReady', () => {
			this.fileWatcher?.on('fileChange', this._handleFileChange.bind(this));
			this.fileWatcher?.on('batchChanges', this._handleBatchChanges.bind(this));
			this.fileWatcher?.on('gitOperation', this._handleGitOperation.bind(this));
			this.fileWatcher?.on('watchError', this._handleWatchError.bind(this));
		});

		// Change processor events
		this.on('changeProcessorReady', () => {
			this.changeProcessor?.on(
				'changeProcessed',
				this._handleChangeProcessed.bind(this)
			);
			this.changeProcessor?.on(
				'batchProcessed',
				this._handleBatchProcessed.bind(this)
			);
			this.changeProcessor?.on(
				'processingError',
				this._handleProcessingError.bind(this)
			);
		});

		// Batch processor events
		this.on('batchProcessorReady', () => {
			this.batchProcessor?.on(
				'batchProcessed',
				this._handleBatchProcessorResult.bind(this)
			);
		});
	}

	/**
	 * Handle individual file changes
	 */
	async _handleFileChange(changeEvent) {
		try {
			this.stats.totalChangesDetected++;

			// Process the change
			const analysis = await this.changeProcessor.processChange(changeEvent);

			if (analysis) {
				// Add to batch processor
				await this.batchProcessor.addChange(analysis);
			}
		} catch (error) {
			this._handleError('file_change', error);
		}
	}

	/**
	 * Handle batch of file changes
	 */
	async _handleBatchChanges(batchEvent) {
		try {
			const { changes } = batchEvent;

			// Process all changes in the batch
			const results = await this.changeProcessor.processBatchChanges(changes);

			if (results.analyses.length > 0) {
				// Add all analyses to batch processor
				await this.batchProcessor.addChanges(results.analyses);
			}
		} catch (error) {
			this._handleError('batch_changes', error);
		}
	}

	/**
	 * Handle git operations
	 */
	async _handleGitOperation(gitEvent) {
		try {
			this.stats.gitOperationsDetected++;

			console.debug(`[WatchManager] Git operation: ${gitEvent.type}`);

			// Pause watching during certain git operations
			if (gitEvent.type === 'branch-switch') {
				await this.pauseWatching();

				// Resume after a short delay
				setTimeout(async () => {
					await this.resumeWatching();
				}, 1000);
			}

			this.emit('gitOperation', gitEvent);
		} catch (error) {
			this._handleError('git_operation', error);
		}
	}

	/**
	 * Handle individual change processing completion
	 */
	_handleChangeProcessed(event) {
		this.stats.totalChangesProcessed++;
		this.emit('changeProcessed', event);
	}

	/**
	 * Handle batch processing completion
	 */
	_handleBatchProcessed(event) {
		this.stats.totalBatchesProcessed++;
		this.emit('batchProcessed', event);
	}

	/**
	 * Handle batch processor results
	 */
	_handleBatchProcessorResult(event) {
		console.debug(
			`[WatchManager] Batch processor completed: ${event.batchSize} changes`
		);
		this.emit('batchCompleted', event);
	}

	/**
	 * Handle processing errors
	 */
	_handleProcessingError(event) {
		this._handleError('processing', event.error);
	}

	/**
	 * Handle watch errors
	 */
	_handleWatchError(error) {
		this._handleError('watch', error);
	}

	/**
	 * Central error handling
	 */
	_handleError(context, error) {
		this.stats.errorCount++;
		this.stats.lastErrorTime = new Date();

		console.error(`[WatchManager] Error in ${context}: ${error.message}`);
		this.emit('error', { context, error });
	}

	/**
	 * Get component options based on cache strategy
	 */
	_getComponentOptions() {
		const strategy = this.options.cacheStrategy;

		const baseOptions = {
			fileWatcher: {
				batchDelay: this.options.batchWindow,
				maxConcurrentAnalysis: this.options.maxConcurrentAnalysis,
				enableGitIntegration: this.options.enableGitIntegration,
				enablePreemptiveAnalysis: this.options.enablePreemptiveAnalysis,
				cpuThrottleThreshold: this.options.cpuThrottleThreshold
			},
			changeProcessor: {
				enableImpactAnalysis: true,
				enableContentComparison: true,
				dependencyAnalysisDepth: this.options.dependencyAnalysisDepth
			},
			batchProcessor: {
				batchWindow: this.options.batchWindow,
				maxConcurrentBatches: this.options.maxConcurrentAnalysis,
				enableConflictDetection: true,
				enableResourceMonitoring: true
			}
		};

		// Adjust options based on cache strategy
		switch (strategy) {
			case CacheStrategy.CONSERVATIVE:
				baseOptions.fileWatcher.batchDelay = 2000;
				baseOptions.batchProcessor.strategy = BatchStrategy.TIME_BASED;
				baseOptions.batchProcessor.batchWindow = 2000;
				break;

			case CacheStrategy.BALANCED:
				baseOptions.batchProcessor.strategy = BatchStrategy.HYBRID;
				break;

			case CacheStrategy.AGGRESSIVE:
				baseOptions.fileWatcher.batchDelay = 200;
				baseOptions.batchProcessor.strategy = BatchStrategy.DEPENDENCY_BASED;
				baseOptions.batchProcessor.batchWindow = 200;
				break;

			case CacheStrategy.IMMEDIATE:
				baseOptions.fileWatcher.batchDelay = 50;
				baseOptions.batchProcessor.strategy = BatchStrategy.IMMEDIATE;
				baseOptions.batchProcessor.batchWindow = 50;
				break;
		}

		return baseOptions;
	}

	/**
	 * Set up git integration including hooks
	 * SAFE: Only runs if git repo exists, preserves existing hooks
	 */
	async _setupGitIntegration() {
		try {
			const gitDir = path.join(this.projectPath, '.git');

			if (!(await fs.pathExists(gitDir))) {
				console.debug(
					'[WatchManager] No git repository found, skipping git integration'
				);
				return;
			}

			// Install git hooks safely (preserves existing hooks)
			await this._installGitHooks();

			console.debug('[WatchManager] Git integration configured safely');
		} catch (error) {
			console.warn(
				`[WatchManager] Failed to setup git integration: ${error.message}`
			);
			// Git integration is optional - system will work without it
		}
	}

	/**
	 * Install git hooks for file watching integration
	 * SAFELY preserves existing hooks and makes integration optional
	 */
	async _installGitHooks() {
		try {
			const hooksDir = path.join(this.projectPath, '.git', 'hooks');

			// Check if hooks directory exists
			if (!(await fs.pathExists(hooksDir))) {
				await fs.ensureDir(hooksDir);
			}

			// Install hooks safely (preserving existing ones)
			await this._installHookSafely(
				'pre-commit',
				this._generatePreCommitHook()
			);
			await this._installHookSafely(
				'post-commit',
				this._generatePostCommitHook()
			);

			this.gitHooksInstalled = true;
			console.debug('[WatchManager] Git hooks installed safely');
		} catch (error) {
			console.warn(
				`[WatchManager] Failed to install git hooks: ${error.message}`
			);
			// Git hooks are optional - don't fail the entire system
		}
	}

	/**
	 * Safely install a git hook, preserving existing content
	 */
	async _installHookSafely(hookName, hookContent) {
		const hookPath = path.join(this.projectPath, '.git', 'hooks', hookName);
		const taskMasterMarker = '# === TASK MASTER AST INTEGRATION ===';
		const taskMasterEndMarker = '# === END TASK MASTER AST INTEGRATION ===';

		try {
			let existingContent = '';
			let hasExistingHook = false;

			// Check if hook already exists
			if (await fs.pathExists(hookPath)) {
				existingContent = await fs.readFile(hookPath, 'utf8');
				hasExistingHook = true;

				// Check if our integration is already present
				if (existingContent.includes(taskMasterMarker)) {
					console.debug(
						`[WatchManager] Task Master integration already present in ${hookName} hook`
					);
					return;
				}
			}

			let newContent;

			if (hasExistingHook) {
				// Preserve existing hook and append our integration
				newContent =
					existingContent.trimEnd() +
					'\n\n' +
					taskMasterMarker +
					'\n' +
					hookContent +
					'\n' +
					taskMasterEndMarker +
					'\n';
			} else {
				// Create new hook with just our content
				newContent =
					'#!/bin/sh\n\n' +
					taskMasterMarker +
					'\n' +
					hookContent +
					'\n' +
					taskMasterEndMarker +
					'\n';
			}

			await fs.writeFile(hookPath, newContent);
			await fs.chmod(hookPath, '755');

			console.debug(
				`[WatchManager] ${hookName} hook updated with Task Master integration`
			);
		} catch (error) {
			console.warn(
				`[WatchManager] Failed to install ${hookName} hook: ${error.message}`
			);
		}
	}

	/**
	 * Generate pre-commit hook content
	 */
	_generatePreCommitHook() {
		return `# Task Master AST file watching integration
# Temporarily pause file watching during commit operations
if command -v node >/dev/null 2>&1; then
    # Only run if Node.js is available and this is a Task Master project
    if [ -f ".taskmaster/config.json" ]; then
        echo "⏸️  Pausing AST file watching during commit..."
        # Signal could be sent to the watch manager process here
        # For now, just a friendly message
    fi
fi`;
	}

	/**
	 * Generate post-commit hook content
	 */
	_generatePostCommitHook() {
		return `# Task Master AST file watching integration
# Resume file watching after commit operations
if command -v node >/dev/null 2>&1; then
    # Only run if Node.js is available and this is a Task Master project
    if [ -f ".taskmaster/config.json" ]; then
        echo "▶️  Resuming AST file watching after commit..."
        # Signal could be sent to the watch manager process here
        # For now, just a friendly message
    fi
fi`;
	}

	/**
	 * Uninstall Task Master git hooks safely
	 */
	async _uninstallGitHooks() {
		try {
			const hooksDir = path.join(this.projectPath, '.git', 'hooks');
			const taskMasterMarker = '# === TASK MASTER AST INTEGRATION ===';
			const taskMasterEndMarker = '# === END TASK MASTER AST INTEGRATION ===';

			for (const hookName of ['pre-commit', 'post-commit']) {
				const hookPath = path.join(hooksDir, hookName);

				if (await fs.pathExists(hookPath)) {
					const content = await fs.readFile(hookPath, 'utf8');

					// Check if our integration is present
					if (content.includes(taskMasterMarker)) {
						// Remove our section
						const lines = content.split('\n');
						const startIndex = lines.findIndex((line) =>
							line.includes(taskMasterMarker)
						);
						const endIndex = lines.findIndex((line) =>
							line.includes(taskMasterEndMarker)
						);

						if (startIndex !== -1 && endIndex !== -1) {
							// Remove our lines (including markers)
							lines.splice(startIndex, endIndex - startIndex + 1);

							// Clean up any extra blank lines
							while (
								lines.length > 0 &&
								lines[lines.length - 1].trim() === ''
							) {
								lines.pop();
							}

							const cleanedContent = lines.join('\n');

							if (
								cleanedContent.trim() === '#!/bin/sh' ||
								cleanedContent.trim() === ''
							) {
								// If only shebang or empty, remove the file
								await fs.remove(hookPath);
								console.debug(`[WatchManager] Removed empty ${hookName} hook`);
							} else {
								// Write back the cleaned content
								await fs.writeFile(hookPath, cleanedContent + '\n');
								console.debug(
									`[WatchManager] Cleaned Task Master integration from ${hookName} hook`
								);
							}
						}
					}
				}
			}

			this.gitHooksInstalled = false;
			console.debug('[WatchManager] Task Master git hooks uninstalled safely');
		} catch (error) {
			console.warn(
				`[WatchManager] Failed to uninstall git hooks: ${error.message}`
			);
		}
	}

	/**
	 * Get comprehensive statistics
	 */
	getStats() {
		const uptime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;

		return {
			state: this.state,
			uptime,
			cacheStrategy: this.options.cacheStrategy,
			gitHooksInstalled: this.gitHooksInstalled,
			...this.stats,
			components: {
				fileWatcher: this.fileWatcher?.getStats() || null,
				changeProcessor: this.changeProcessor?.getStats() || null,
				batchProcessor: this.batchProcessor?.getStats() || null
			}
		};
	}

	/**
	 * Get current watch state
	 */
	getState() {
		return this.state;
	}

	/**
	 * Check if currently watching
	 */
	isWatching() {
		return this.state === WatchState.WATCHING;
	}

	/**
	 * Graceful shutdown
	 */
	async shutdown() {
		console.info('[WatchManager] Shutting down...');

		try {
			await this.stopWatching();

			// Clean up git hooks if they were installed
			if (this.gitHooksInstalled && this.options.enableGitIntegration) {
				await this._uninstallGitHooks();
			}

			// Clean up any remaining resources
			this.removeAllListeners();

			console.info('[WatchManager] Shutdown complete');
		} catch (error) {
			console.error(`[WatchManager] Error during shutdown: ${error.message}`);
		}
	}
}

/**
 * Create a new watch manager instance
 */
export function createWatchManager(projectPath, options = {}) {
	return new WatchManager(projectPath, options);
}

/**
 * Check if file watching is supported in the current environment
 */
export function isWatchingSupported() {
	try {
		require('chokidar');
		return true;
	} catch (error) {
		return false;
	}
}

export default WatchManager;
