/**
 * Universal File Watcher - Phase 3.1.1
 * 
 * Multi-platform file watching system with intelligent filtering and git integration.
 * Uses chokidar for cross-platform compatibility and performance.
 * 
 * Features:
 * - Language-aware filtering based on project configuration
 * - Git integration for detecting repository operations
 * - Intelligent ignore patterns respecting .gitignore
 * - Batch change detection to avoid thrashing
 * - Resource monitoring and throttling
 * 
 * @author Task Master Flow
 * @version 3.1.0
 */

import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs-extra';
import { EventEmitter } from 'events';
import { execAsync } from '../../utils.js';
import { loadASTConfig } from '../config/ast-config.js';

/**
 * Universal file watcher with intelligent filtering and git integration
 */
export class UniversalFileWatcher extends EventEmitter {
    constructor(projectPath, options = {}) {
        super();
        
        this.projectPath = path.resolve(projectPath);
        this.options = {
            batchDelay: 500,
            maxConcurrentAnalysis: 3,
            enableGitIntegration: true,
            enablePreemptiveAnalysis: true,
            cpuThrottleThreshold: 80,
            ...options
        };
        
        this.watcher = null;
        this.gitWatcher = null;
        this.isWatching = false;
        this.batchTimer = null;
        this.pendingChanges = new Map();
        this.activeAnalysis = new Set();
        this.stats = {
            changesDetected: 0,
            batchesProcessed: 0,
            gitOperationsDetected: 0,
            startTime: null
        };
        
        this.astConfig = null;
        this.supportedExtensions = new Set();
        this.ignorePatterns = [];
    }

    /**
     * Initialize the file watcher with AST configuration
     */
    async initialize() {
        try {
            // Load AST configuration
            this.astConfig = await loadASTConfig(this.projectPath);
            
            // Extract supported extensions from languages
            this.supportedExtensions = this._buildSupportedExtensions(
                this.astConfig.supportedLanguages
            );
            
            // Build ignore patterns
            this.ignorePatterns = await this._buildIgnorePatterns();
            
            console.debug(`[FileWatcher] Initialized for ${this.projectPath}`);
            console.debug(`[FileWatcher] Watching extensions: ${Array.from(this.supportedExtensions).join(', ')}`);
            console.debug(`[FileWatcher] Ignore patterns: ${this.ignorePatterns.length} patterns`);
            
            return true;
        } catch (error) {
            console.error(`[FileWatcher] Initialization failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Start watching files in the project directory
     */
    async startWatching() {
        if (this.isWatching) {
            console.warn('[FileWatcher] Already watching');
            return false;
        }

        if (!this.astConfig) {
            await this.initialize();
        }

        try {
            // Build watch patterns for supported file types
            const watchPatterns = this._buildWatchPatterns();
            
            // Configure chokidar watcher
            this.watcher = chokidar.watch(watchPatterns, {
                cwd: this.projectPath,
                ignored: this.ignorePatterns,
                ignoreInitial: true,
                persistent: true,
                followSymlinks: false,
                atomic: true,
                awaitWriteFinish: {
                    stabilityThreshold: 100,
                    pollInterval: 50
                }
            });

            // Set up event handlers
            this.watcher
                .on('add', (filePath) => this._handleFileChange(filePath, 'add'))
                .on('change', (filePath) => this._handleFileChange(filePath, 'change'))
                .on('unlink', (filePath) => this._handleFileChange(filePath, 'unlink'))
                .on('addDir', (dirPath) => this._handleDirectoryChange(dirPath, 'addDir'))
                .on('unlinkDir', (dirPath) => this._handleDirectoryChange(dirPath, 'unlinkDir'))
                .on('error', (error) => this._handleWatchError(error))
                .on('ready', () => this._handleWatchReady());

            // Set up git watcher if enabled
            if (this.options.enableGitIntegration) {
                await this._setupGitWatcher();
            }

            this.isWatching = true;
            this.stats.startTime = new Date();
            
            console.info(`[FileWatcher] Started watching ${this.projectPath}`);
            this.emit('watchingStarted', { projectPath: this.projectPath });
            
            return true;
        } catch (error) {
            console.error(`[FileWatcher] Failed to start watching: ${error.message}`);
            return false;
        }
    }

    /**
     * Stop watching files
     */
    async stopWatching() {
        if (!this.isWatching) {
            return false;
        }

        try {
            // Clear pending batch operations
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
                this.batchTimer = null;
            }

            // Process any remaining pending changes
            if (this.pendingChanges.size > 0) {
                await this._processBatchChanges();
            }

            // Close watchers
            if (this.watcher) {
                await this.watcher.close();
                this.watcher = null;
            }

            if (this.gitWatcher) {
                await this.gitWatcher.close();
                this.gitWatcher = null;
            }

            this.isWatching = false;
            
            console.info(`[FileWatcher] Stopped watching ${this.projectPath}`);
            this.emit('watchingStopped', { 
                projectPath: this.projectPath,
                stats: this.getStats()
            });
            
            return true;
        } catch (error) {
            console.error(`[FileWatcher] Error stopping watcher: ${error.message}`);
            return false;
        }
    }

    /**
     * Handle individual file changes
     */
    async _handleFileChange(filePath, changeType) {
        if (!this._shouldProcessFile(filePath)) {
            return;
        }

        const absolutePath = path.resolve(this.projectPath, filePath);
        const changeEvent = {
            path: absolutePath,
            relativePath: filePath,
            type: changeType,
            timestamp: new Date(),
            language: this._detectLanguage(filePath),
            size: await this._getFileSize(absolutePath)
        };

        // Add to pending changes for batch processing
        this.pendingChanges.set(filePath, changeEvent);
        this.stats.changesDetected++;

        console.debug(`[FileWatcher] File ${changeType}: ${filePath}`);
        this.emit('fileChange', changeEvent);

        // Schedule batch processing
        this._scheduleBatchProcessing();
    }

    /**
     * Handle directory changes
     */
    async _handleDirectoryChange(dirPath, changeType) {
        const absolutePath = path.resolve(this.projectPath, dirPath);
        
        console.debug(`[FileWatcher] Directory ${changeType}: ${dirPath}`);
        this.emit('directoryChange', {
            path: absolutePath,
            relativePath: dirPath,
            type: changeType,
            timestamp: new Date()
        });
    }

    /**
     * Schedule batch processing of pending changes
     */
    _scheduleBatchProcessing() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }

        this.batchTimer = setTimeout(async () => {
            await this._processBatchChanges();
        }, this.options.batchDelay);
    }

    /**
     * Process accumulated changes as a batch
     */
    async _processBatchChanges() {
        if (this.pendingChanges.size === 0) {
            return;
        }

        const changes = Array.from(this.pendingChanges.values());
        this.pendingChanges.clear();
        this.batchTimer = null;

        try {
            // Check CPU usage before processing
            const cpuUsage = await this._getCPUUsage();
            if (cpuUsage > this.options.cpuThrottleThreshold) {
                console.warn(`[FileWatcher] High CPU usage (${cpuUsage}%), throttling batch processing`);
                // Re-schedule with longer delay
                setTimeout(() => {
                    changes.forEach(change => {
                        this.pendingChanges.set(change.relativePath, change);
                    });
                    this._scheduleBatchProcessing();
                }, 2000);
                return;
            }

            // Limit concurrent analysis
            if (this.activeAnalysis.size >= this.options.maxConcurrentAnalysis) {
                console.debug(`[FileWatcher] Max concurrent analysis reached, queuing changes`);
                // Re-add to pending changes
                changes.forEach(change => {
                    this.pendingChanges.set(change.relativePath, change);
                });
                // Retry after a short delay
                setTimeout(() => this._scheduleBatchProcessing(), 1000);
                return;
            }

            this.stats.batchesProcessed++;
            
            console.debug(`[FileWatcher] Processing batch of ${changes.length} changes`);
            this.emit('batchChanges', {
                changes,
                timestamp: new Date(),
                batchSize: changes.length
            });

            // Mark batch as being processed
            const batchId = `batch-${Date.now()}`;
            this.activeAnalysis.add(batchId);

            // Process changes (this will be handled by the change processor)
            await this._processBatch(changes);

            // Remove from active analysis
            this.activeAnalysis.delete(batchId);

        } catch (error) {
            console.error(`[FileWatcher] Error processing batch changes: ${error.message}`);
            this.emit('batchError', error);
        }
    }

    /**
     * Process a batch of changes (placeholder for integration with change processor)
     */
    async _processBatch(changes) {
        // This will be implemented when integrating with the change processor
        // For now, just emit the batch for other components to handle
        console.debug(`[FileWatcher] Batch processing delegated to change processor`);
    }

    /**
     * Set up git repository watcher for git operations
     */
    async _setupGitWatcher() {
        const gitDir = path.join(this.projectPath, '.git');
        
        if (!await fs.pathExists(gitDir)) {
            console.debug('[FileWatcher] No .git directory found, skipping git integration');
            return;
        }

        try {
            // Watch git files that indicate repository operations
            const gitWatchPatterns = [
                path.join(gitDir, 'HEAD'),
                path.join(gitDir, 'index'),
                path.join(gitDir, 'refs/**'),
                path.join(gitDir, 'logs/**')
            ];

            this.gitWatcher = chokidar.watch(gitWatchPatterns, {
                persistent: true,
                ignoreInitial: true,
                atomic: true
            });

            this.gitWatcher
                .on('change', (filePath) => this._handleGitChange(filePath))
                .on('add', (filePath) => this._handleGitChange(filePath))
                .on('error', (error) => console.error(`[FileWatcher] Git watcher error: ${error.message}`));

            console.debug('[FileWatcher] Git integration enabled');
        } catch (error) {
            console.warn(`[FileWatcher] Failed to setup git watcher: ${error.message}`);
        }
    }

    /**
     * Handle git repository changes
     */
    async _handleGitChange(filePath) {
        try {
            let operationType = 'unknown';
            
            if (filePath.endsWith('HEAD')) {
                operationType = 'branch-switch';
            } else if (filePath.endsWith('index')) {
                operationType = 'staging';
            } else if (filePath.includes('refs/')) {
                operationType = 'ref-update';
            } else if (filePath.includes('logs/')) {
                operationType = 'log-update';
            }

            this.stats.gitOperationsDetected++;
            
            console.debug(`[FileWatcher] Git operation detected: ${operationType}`);
            this.emit('gitOperation', {
                type: operationType,
                filePath,
                timestamp: new Date()
            });

        } catch (error) {
            console.error(`[FileWatcher] Error handling git change: ${error.message}`);
        }
    }

    /**
     * Handle watch errors
     */
    _handleWatchError(error) {
        console.error(`[FileWatcher] Watch error: ${error.message}`);
        this.emit('watchError', error);
    }

    /**
     * Handle watcher ready event
     */
    _handleWatchReady() {
        console.debug('[FileWatcher] Watcher ready');
        this.emit('watchReady');
    }

    /**
     * Build supported file extensions from language configuration
     */
    _buildSupportedExtensions(supportedLanguages) {
        const extensionMap = {
            javascript: ['.js', '.jsx', '.mjs', '.cjs'],
            typescript: ['.ts', '.tsx', '.mts', '.cts'],
            python: ['.py', '.pyx', '.pyi', '.pyw'],
            go: ['.go']
        };

        const extensions = new Set();
        
        for (const language of supportedLanguages) {
            if (extensionMap[language]) {
                extensionMap[language].forEach(ext => extensions.add(ext));
            }
        }

        return extensions;
    }

    /**
     * Build watch patterns for chokidar
     */
    _buildWatchPatterns() {
        const extensions = Array.from(this.supportedExtensions);
        
        if (extensions.length === 0) {
            return ['**/*'];
        }

        // Create glob patterns for the extensions
        if (extensions.length === 1) {
            return [`**/*${extensions[0]}`];
        }

        // Multiple extensions - use glob pattern
        const extPattern = `{${extensions.join(',')}}`;
        return [`**/*${extPattern}`];
    }

    /**
     * Build ignore patterns combining .gitignore and default excludes
     */
    async _buildIgnorePatterns() {
        const patterns = [
            // Default exclude patterns
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.git/**',
            '**/coverage/**',
            '**/.nyc_output/**',
            '**/tmp/**',
            '**/temp/**',
            '**/*.log',
            '**/.DS_Store',
            '**/Thumbs.db'
        ];

        // Add patterns from AST config
        if (this.astConfig?.excludePatterns) {
            patterns.push(...this.astConfig.excludePatterns);
        }

        // Try to read .gitignore
        try {
            const gitignorePath = path.join(this.projectPath, '.gitignore');
            if (await fs.pathExists(gitignorePath)) {
                const gitignore = await fs.readFile(gitignorePath, 'utf8');
                const gitPatterns = gitignore
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'))
                    .map(line => line.startsWith('/') ? line.slice(1) : `**/${line}`);
                
                patterns.push(...gitPatterns);
            }
        } catch (error) {
            console.debug(`[FileWatcher] Could not read .gitignore: ${error.message}`);
        }

        return patterns;
    }

    /**
     * Check if a file should be processed based on extension and patterns
     */
    _shouldProcessFile(filePath) {
        const ext = path.extname(filePath);
        return this.supportedExtensions.has(ext);
    }

    /**
     * Detect programming language from file extension
     */
    _detectLanguage(filePath) {
        const ext = path.extname(filePath);
        
        const languageMap = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.mjs': 'javascript',
            '.cjs': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.mts': 'typescript',
            '.cts': 'typescript',
            '.py': 'python',
            '.pyx': 'python',
            '.pyi': 'python',
            '.pyw': 'python',
            '.go': 'go'
        };

        return languageMap[ext] || 'unknown';
    }

    /**
     * Get file size safely
     */
    async _getFileSize(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get current CPU usage (simplified implementation)
     */
    async _getCPUUsage() {
        try {
            // This is a simplified implementation
            // In production, you might want to use a more sophisticated CPU monitoring library
            const loadavg = require('os').loadavg();
            return Math.min(loadavg[0] * 100 / require('os').cpus().length, 100);
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get watcher statistics
     */
    getStats() {
        const uptime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
        
        return {
            ...this.stats,
            uptime,
            isWatching: this.isWatching,
            pendingChanges: this.pendingChanges.size,
            activeAnalysis: this.activeAnalysis.size,
            supportedExtensions: Array.from(this.supportedExtensions),
            ignorePatternCount: this.ignorePatterns.length
        };
    }

    /**
     * Pause watching (useful during git operations)
     */
    async pauseWatching() {
        if (this.watcher) {
            await this.watcher.unwatch('**/*');
            console.debug('[FileWatcher] Paused watching');
            this.emit('watchingPaused');
        }
    }

    /**
     * Resume watching after pause
     */
    async resumeWatching() {
        if (this.watcher) {
            const watchPatterns = this._buildWatchPatterns();
            this.watcher.add(watchPatterns);
            console.debug('[FileWatcher] Resumed watching');
            this.emit('watchingResumed');
        }
    }
}

/**
 * Create a new file watcher instance
 */
export function createFileWatcher(projectPath, options = {}) {
    return new UniversalFileWatcher(projectPath, options);
}

/**
 * Check if chokidar is available
 */
export function isFileWatchingSupported() {
    try {
        require('chokidar');
        return true;
    } catch (error) {
        return false;
    }
}

export default UniversalFileWatcher; 