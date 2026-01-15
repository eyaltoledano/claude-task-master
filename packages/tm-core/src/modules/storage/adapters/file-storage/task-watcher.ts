/**
 * @fileoverview Task Watcher service for monitoring .taskmaster directory changes
 * Provides real-time file system monitoring with typed event emission
 */

import { watch, type FSWatcher } from 'chokidar';
import { EventEmitter } from 'node:events';
import { normalize, relative } from 'node:path';

/**
 * Event payload for task file additions
 */
export interface TaskFileAddedEvent {
	type: 'task-file-added';
	filePath: string;
	relativePath: string;
	timestamp: string;
}

/**
 * Event payload for task file changes
 */
export interface TaskFileChangedEvent {
	type: 'task-file-changed';
	filePath: string;
	relativePath: string;
	timestamp: string;
}

/**
 * Event payload for task file deletions
 */
export interface TaskFileDeletedEvent {
	type: 'task-file-deleted';
	filePath: string;
	relativePath: string;
	timestamp: string;
}

/**
 * Event payload for task directory changes
 */
export interface TaskDirectoryChangedEvent {
	type: 'task-directory-changed';
	dirPath: string;
	relativePath: string;
	changeType: 'added' | 'removed';
	timestamp: string;
}

/**
 * Union type of all possible task watcher events
 */
export type TaskWatcherEvent =
	| TaskFileAddedEvent
	| TaskFileChangedEvent
	| TaskFileDeletedEvent
	| TaskDirectoryChangedEvent;

/**
 * Configuration options for TaskWatcher
 */
export interface TaskWatcherOptions {
	/**
	 * Ignore initial add events when watcher starts
	 * @default true
	 */
	ignoreInitial?: boolean;

	/**
	 * Keep the process running while watcher is active
	 * @default true
	 */
	persistent?: boolean;

	/**
	 * Debounce delay in milliseconds for rapid file changes
	 * @default 100
	 */
	debounceDelay?: number;

	/**
	 * File patterns to watch (glob patterns)
	 * @default ['**\/*.json', '**\/*.md', '**\/*.txt']
	 */
	filePatterns?: string[];

	/**
	 * Patterns to ignore
	 * @default ['**\/node_modules/**', '**\/.git/**', '**\/dist/**']
	 */
	ignorePatterns?: string[];
}

/**
 * Task Watcher Service
 * Monitors .taskmaster directory for file system changes and emits typed events
 */
export class TaskWatcher extends EventEmitter {
	private watcher: FSWatcher | null = null;
	private watchPath: string;
	private options: Required<TaskWatcherOptions>;
	private isWatching = false;
	private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

	/**
	 * Create a new TaskWatcher instance
	 * @param taskmasterPath - Path to the .taskmaster directory to watch
	 * @param options - Configuration options
	 */
	constructor(taskmasterPath: string, options: TaskWatcherOptions = {}) {
		super();
		this.watchPath = normalize(taskmasterPath);
		this.options = {
			ignoreInitial: options.ignoreInitial ?? true,
			persistent: options.persistent ?? true,
			debounceDelay: options.debounceDelay ?? 100,
			filePatterns: options.filePatterns ?? [
				'**/*.json',
				'**/*.md',
				'**/*.txt'
			],
			ignorePatterns: options.ignorePatterns ?? [
				'**/node_modules/**',
				'**/.git/**',
				'**/dist/**'
			]
		};
	}

	/**
	 * Start watching the .taskmaster directory
	 */
	public async start(): Promise<void> {
		if (this.isWatching) {
			throw new Error('TaskWatcher is already watching');
		}

		try {
			this.watcher = watch(this.watchPath, {
				ignored: this.options.ignorePatterns,
				ignoreInitial: this.options.ignoreInitial,
				persistent: this.options.persistent,
				depth: 10,
				awaitWriteFinish: {
					stabilityThreshold: 200,
					pollInterval: 100
				}
			});

			this.watcher
				.on('add', (path) => this.handleFileAdded(path))
				.on('change', (path) => this.handleFileChanged(path))
				.on('unlink', (path) => this.handleFileDeleted(path))
				.on('addDir', (path) => this.handleDirectoryAdded(path))
				.on('unlinkDir', (path) => this.handleDirectoryRemoved(path))
				.on('error', (error) => this.handleError(error));

			await new Promise<void>((resolve, reject) => {
				if (!this.watcher) {
					reject(new Error('Watcher failed to initialize'));
					return;
				}

				this.watcher.once('ready', () => {
					this.isWatching = true;
					this.emit('ready');
					resolve();
				});

				const timeout = setTimeout(() => {
					reject(new Error('Watcher initialization timeout'));
				}, 10000);

				this.watcher.once('ready', () => clearTimeout(timeout));
			});
		} catch (error) {
			this.isWatching = false;
			throw new Error(
				`Failed to start TaskWatcher: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Stop watching and cleanup resources
	 */
	public async stop(): Promise<void> {
		if (!this.isWatching || !this.watcher) {
			return;
		}

		try {
			for (const timer of this.debounceTimers.values()) {
				clearTimeout(timer);
			}
			this.debounceTimers.clear();

			await this.watcher.close();
			this.watcher = null;
			this.isWatching = false;
			this.emit('stopped');
		} catch (error) {
			throw new Error(
				`Failed to stop TaskWatcher: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Check if the watcher is currently active
	 */
	public getIsWatching(): boolean {
		return this.isWatching;
	}

	/**
	 * Get the path being watched
	 */
	public getWatchPath(): string {
		return this.watchPath;
	}

	/**
	 * Handle file added events
	 */
	private handleFileAdded(filePath: string): void {
		const normalizedPath = normalize(filePath);

		if (!this.matchesFilePatterns(normalizedPath)) {
			return;
		}

		this.debounce(normalizedPath, () => {
			const event: TaskFileAddedEvent = {
				type: 'task-file-added',
				filePath: normalizedPath,
				relativePath: relative(this.watchPath, normalizedPath),
				timestamp: new Date().toISOString()
			};

			this.emit('task-file-added', event);
			this.emit('change', event);
		});
	}

	/**
	 * Handle file changed events
	 */
	private handleFileChanged(filePath: string): void {
		const normalizedPath = normalize(filePath);

		if (!this.matchesFilePatterns(normalizedPath)) {
			return;
		}

		this.debounce(normalizedPath, () => {
			const event: TaskFileChangedEvent = {
				type: 'task-file-changed',
				filePath: normalizedPath,
				relativePath: relative(this.watchPath, normalizedPath),
				timestamp: new Date().toISOString()
			};

			this.emit('task-file-changed', event);
			this.emit('change', event);
		});
	}

	/**
	 * Handle file deleted events
	 */
	private handleFileDeleted(filePath: string): void {
		const normalizedPath = normalize(filePath);

		if (!this.matchesFilePatterns(normalizedPath)) {
			return;
		}

		this.debounce(normalizedPath, () => {
			const event: TaskFileDeletedEvent = {
				type: 'task-file-deleted',
				filePath: normalizedPath,
				relativePath: relative(this.watchPath, normalizedPath),
				timestamp: new Date().toISOString()
			};

			this.emit('task-file-deleted', event);
			this.emit('change', event);
		});
	}

	/**
	 * Handle directory added events
	 */
	private handleDirectoryAdded(dirPath: string): void {
		const normalizedPath = normalize(dirPath);

		const event: TaskDirectoryChangedEvent = {
			type: 'task-directory-changed',
			dirPath: normalizedPath,
			relativePath: relative(this.watchPath, normalizedPath),
			changeType: 'added',
			timestamp: new Date().toISOString()
		};

		this.emit('task-directory-changed', event);
		this.emit('change', event);
	}

	/**
	 * Handle directory removed events
	 */
	private handleDirectoryRemoved(dirPath: string): void {
		const normalizedPath = normalize(dirPath);

		const event: TaskDirectoryChangedEvent = {
			type: 'task-directory-changed',
			dirPath: normalizedPath,
			relativePath: relative(this.watchPath, normalizedPath),
			changeType: 'removed',
			timestamp: new Date().toISOString()
		};

		this.emit('task-directory-changed', event);
		this.emit('change', event);
	}

	/**
	 * Handle watcher errors
	 */
	private handleError(error: unknown): void {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		this.emit('error', errorObj);
	}

	/**
	 * Debounce file change events to prevent flooding
	 */
	private debounce(key: string, callback: () => void): void {
		const existingTimer = this.debounceTimers.get(key);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		const timer = setTimeout(() => {
			this.debounceTimers.delete(key);
			callback();
		}, this.options.debounceDelay);

		this.debounceTimers.set(key, timer);
	}

	/**
	 * Check if a file path matches the configured file patterns
	 */
	private matchesFilePatterns(filePath: string): boolean {
		const relativePath = relative(this.watchPath, filePath);

		for (const pattern of this.options.filePatterns) {
			// Use placeholder to prevent ** from being affected by * replacement
			const regexPattern = pattern
				.replace(/\./g, '\\.')
				.replace(/\*\*/g, '___DBLSTAR___')
				.replace(/\*/g, '[^/]*')
				.replace(/___DBLSTAR___/g, '.*');

			const regex = new RegExp(`^${regexPattern}$`);
			if (regex.test(relativePath)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Register a handler for task file added events
	 */
	public onTaskFileAdded(handler: (event: TaskFileAddedEvent) => void): this {
		return this.on('task-file-added', handler);
	}

	/**
	 * Register a handler for task file changed events
	 */
	public onTaskFileChanged(
		handler: (event: TaskFileChangedEvent) => void
	): this {
		return this.on('task-file-changed', handler);
	}

	/**
	 * Register a handler for task file deleted events
	 */
	public onTaskFileDeleted(
		handler: (event: TaskFileDeletedEvent) => void
	): this {
		return this.on('task-file-deleted', handler);
	}

	/**
	 * Register a handler for task directory changed events
	 */
	public onTaskDirectoryChanged(
		handler: (event: TaskDirectoryChangedEvent) => void
	): this {
		return this.on('task-directory-changed', handler);
	}

	/**
	 * Register a handler for any change event
	 */
	public onChange(handler: (event: TaskWatcherEvent) => void): this {
		return this.on('change', handler);
	}

	/**
	 * Register a handler for error events
	 */
	public onError(handler: (error: Error) => void): this {
		return this.on('error', handler);
	}

	/**
	 * Register a handler for when the watcher is ready
	 */
	public onReady(handler: () => void): this {
		return this.on('ready', handler);
	}

	/**
	 * Register a handler for when the watcher is stopped
	 */
	public onStopped(handler: () => void): this {
		return this.on('stopped', handler);
	}
}

export default TaskWatcher;
