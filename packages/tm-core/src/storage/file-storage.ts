/**
 * File-based storage implementation for Task Master
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Task, TaskMetadata } from '../types/index.js';
import { BaseStorage, type StorageStats } from './storage.interface.js';

/**
 * File storage data structure
 */
interface FileStorageData {
	tasks: Task[];
	metadata: TaskMetadata;
}

/**
 * File-based storage implementation using JSON files
 */
export class FileStorage extends BaseStorage {
	private readonly projectPath: string;
	private readonly basePath: string;
	private readonly tasksDir: string;
	private fileLocks: Map<string, Promise<void>> = new Map();

	constructor(projectPath: string, config = {}) {
		super(config);
		this.projectPath = projectPath;
		this.basePath = path.join(projectPath, '.taskmaster');
		this.tasksDir = path.join(this.basePath, 'tasks');
	}

	/**
	 * Initialize storage by creating necessary directories
	 */
	async initialize(): Promise<void> {
		await this.ensureDirectoryExists();
	}

	/**
	 * Close storage and cleanup resources
	 */
	async close(): Promise<void> {
		// Wait for any pending file operations
		const locks = Array.from(this.fileLocks.values());
		if (locks.length > 0) {
			await Promise.all(locks);
		}
		this.fileLocks.clear();
	}

	/**
	 * Get statistics about the storage
	 */
	async getStats(): Promise<StorageStats> {
		const tags = await this.getAllTags();
		let totalTasks = 0;
		let lastModified = '';

		for (const tag of tags) {
			const filePath = this.getTasksPath(tag === 'default' ? undefined : tag);
			try {
				const stats = await fs.stat(filePath);
				const data = await this.readJsonFile(filePath);
				if (data?.tasks) {
					totalTasks += data.tasks.length;
				}
				if (stats.mtime.toISOString() > lastModified) {
					lastModified = stats.mtime.toISOString();
				}
			} catch {
				// Ignore missing files
			}
		}

		return {
			totalTasks,
			totalTags: tags.length,
			lastModified: lastModified || new Date().toISOString()
		};
	}

	/**
	 * Load tasks from file
	 */
	async loadTasks(tag?: string): Promise<Task[]> {
		const filePath = this.getTasksPath(tag);

		try {
			const data = await this.readJsonFile(filePath);
			return data?.tasks || [];
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				return []; // File doesn't exist, return empty array
			}
			throw new Error(`Failed to load tasks: ${error.message}`);
		}
	}

	/**
	 * Save tasks to file
	 */
	async saveTasks(tasks: Task[], tag?: string): Promise<void> {
		const filePath = this.getTasksPath(tag);

		// Ensure directory exists
		await this.ensureDirectoryExists();

		// Create data structure with metadata
		const data: FileStorageData = {
			tasks,
			metadata: {
				version: '1.0.0',
				lastModified: new Date().toISOString(),
				taskCount: tasks.length,
				completedCount: tasks.filter((t) => t.status === 'done').length,
				tags: tag ? [tag] : []
			}
		};

		// Write with file locking
		await this.writeJsonFile(filePath, data);
	}

	/**
	 * Check if tasks file exists
	 */
	async exists(tag?: string): Promise<boolean> {
		const filePath = this.getTasksPath(tag);

		try {
			await fs.access(filePath, fs.constants.F_OK);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get all available tags
	 */
	async getAllTags(): Promise<string[]> {
		try {
			await this.ensureDirectoryExists();
			const files = await fs.readdir(this.tasksDir);

			const tags: string[] = [];

			for (const file of files) {
				if (file.endsWith('.json')) {
					if (file === 'tasks.json') {
						tags.push('default');
					} else if (!file.includes('.backup.')) {
						// Extract tag name from filename (remove .json extension)
						tags.push(file.slice(0, -5));
					}
				}
			}

			return tags;
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				return [];
			}
			throw new Error(`Failed to get tags: ${error.message}`);
		}
	}

	/**
	 * Load metadata from file
	 */
	async loadMetadata(tag?: string): Promise<TaskMetadata | null> {
		const filePath = this.getTasksPath(tag);

		try {
			const data = await this.readJsonFile(filePath);
			return data?.metadata || null;
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				return null;
			}
			throw new Error(`Failed to load metadata: ${error.message}`);
		}
	}

	/**
	 * Save metadata (stored with tasks)
	 */
	async saveMetadata(metadata: TaskMetadata, tag?: string): Promise<void> {
		const tasks = await this.loadTasks(tag);
		const filePath = this.getTasksPath(tag);

		const data: FileStorageData = {
			tasks,
			metadata
		};

		await this.writeJsonFile(filePath, data);
	}

	// ============================================================================
	// Private Helper Methods
	// ============================================================================

	/**
	 * Get the file path for tasks based on tag
	 */
	private getTasksPath(tag?: string): string {
		if (tag) {
			const sanitizedTag = this.sanitizeTag(tag);
			return path.join(this.tasksDir, `${sanitizedTag}.json`);
		}
		return path.join(this.tasksDir, 'tasks.json');
	}

	/**
	 * Ensure the storage directory structure exists
	 */
	private async ensureDirectoryExists(): Promise<void> {
		try {
			await fs.mkdir(this.tasksDir, { recursive: true });
		} catch (error: any) {
			throw new Error(`Failed to create storage directory: ${error.message}`);
		}
	}

	/**
	 * Read and parse JSON file with error handling
	 */
	private async readJsonFile(
		filePath: string
	): Promise<FileStorageData | null> {
		try {
			const content = await fs.readFile(filePath, 'utf-8');
			return JSON.parse(content);
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				throw error; // Re-throw ENOENT for caller to handle
			}
			if (error instanceof SyntaxError) {
				throw new Error(`Invalid JSON in file ${filePath}: ${error.message}`);
			}
			throw new Error(`Failed to read file ${filePath}: ${error.message}`);
		}
	}

	/**
	 * Write JSON file with atomic operation using temp file
	 */
	private async writeJsonFile(
		filePath: string,
		data: FileStorageData
	): Promise<void> {
		// Use file locking to prevent concurrent writes
		const lockKey = filePath;
		const existingLock = this.fileLocks.get(lockKey);

		if (existingLock) {
			await existingLock;
		}

		const lockPromise = this.performWrite(filePath, data);
		this.fileLocks.set(lockKey, lockPromise);

		try {
			await lockPromise;
		} finally {
			this.fileLocks.delete(lockKey);
		}
	}

	/**
	 * Perform the actual write operation
	 */
	private async performWrite(
		filePath: string,
		data: FileStorageData
	): Promise<void> {
		const tempPath = `${filePath}.tmp`;

		try {
			// Write to temp file first
			const content = JSON.stringify(data, null, 2);
			await fs.writeFile(tempPath, content, 'utf-8');

			// Create backup if configured
			if (this.config.autoBackup && (await this.exists())) {
				await this.createBackup(filePath);
			}

			// Atomic rename
			await fs.rename(tempPath, filePath);
		} catch (error: any) {
			// Clean up temp file if it exists
			try {
				await fs.unlink(tempPath);
			} catch {
				// Ignore cleanup errors
			}

			throw new Error(`Failed to write file ${filePath}: ${error.message}`);
		}
	}

	/**
	 * Create a backup of the file
	 */
	private async createBackup(filePath: string): Promise<void> {
		try {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupPath = this.getBackupPath(filePath, timestamp);
			await fs.copyFile(filePath, backupPath);

			// Clean up old backups if needed
			if (this.config.maxBackups) {
				await this.cleanupOldBackups(filePath);
			}
		} catch {
			// Backup failures are non-critical
		}
	}

	/**
	 * Remove old backup files beyond the max limit
	 */
	private async cleanupOldBackups(originalPath: string): Promise<void> {
		const dir = path.dirname(originalPath);
		const basename = path.basename(originalPath, '.json');

		try {
			const files = await fs.readdir(dir);
			const backupFiles = files
				.filter(
					(f) => f.startsWith(`${basename}.backup.`) && f.endsWith('.json')
				)
				.sort()
				.reverse();

			// Remove backups beyond the limit
			const toRemove = backupFiles.slice(this.config.maxBackups!);
			for (const file of toRemove) {
				try {
					await fs.unlink(path.join(dir, file));
				} catch {
					// Ignore individual file deletion errors
				}
			}
		} catch {
			// Cleanup failures are non-critical
		}
	}
}

// Export as default for convenience
export default FileStorage;
