/**
 * @fileoverview File operations with atomic writes and cross-process locking
 *
 * Uses steno for atomic writes (same pattern as workflow-state-manager.ts)
 * and proper-lockfile for cross-process locking to prevent lost updates.
 */

import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import { Writer } from 'steno';
import type { FileStorageData } from './format-handler.js';

/**
 * File locking configuration for cross-process safety
 */
const LOCK_OPTIONS = {
	stale: 10000, // Consider lock stale after 10 seconds
	retries: {
		retries: 5,
		factor: 2,
		minTimeout: 100,
		maxTimeout: 1000
	},
	realpath: false // Don't resolve symlinks (faster)
};

/**
 * Handles atomic file operations with cross-process locking mechanism
 */
export class FileOperations {
	/** Map of file paths to steno Writers for reuse */
	private writers = new Map<string, Writer>();

	/**
	 * Get or create a steno Writer for a file path
	 */
	private getWriter(filePath: string): Writer {
		let writer = this.writers.get(filePath);
		if (!writer) {
			writer = new Writer(filePath);
			this.writers.set(filePath, writer);
		}
		return writer;
	}

	/**
	 * Read and parse JSON file
	 */
	async readJson(filePath: string): Promise<any> {
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
	 * Write JSON file with atomic operation and cross-process locking.
	 * Uses steno for atomic writes and proper-lockfile for cross-process safety.
	 * WARNING: This replaces the entire file. For concurrent modifications,
	 * use modifyJson() instead to prevent lost updates.
	 */
	async writeJson(
		filePath: string,
		data: FileStorageData | any
	): Promise<void> {
		// Ensure file exists for locking (proper-lockfile requires this)
		await this.ensureFileExists(filePath);

		// Acquire cross-process lock
		let release: (() => Promise<void>) | null = null;
		try {
			release = await lockfile.lock(filePath, LOCK_OPTIONS);

			// Use steno Writer for atomic writes (same pattern as workflow-state-manager)
			const content = JSON.stringify(data, null, 2);
			const writer = this.getWriter(filePath);
			await writer.write(content);
		} finally {
			if (release) {
				try {
					await release();
				} catch {
					// Ignore release errors - lock may have been released already
				}
			}
		}
	}

	/**
	 * Read-modify-write JSON file with cross-process locking.
	 * Uses steno for atomic writes and proper-lockfile for cross-process safety.
	 * Re-reads file inside lock to prevent lost updates from stale snapshots.
	 * @param filePath - Path to the JSON file
	 * @param modifier - Function that receives current data and returns modified data
	 */
	async modifyJson<T = any>(
		filePath: string,
		modifier: (currentData: T) => T | Promise<T>
	): Promise<void> {
		// Ensure file exists for locking (proper-lockfile requires this)
		await this.ensureFileExists(filePath);

		// Acquire cross-process lock
		let release: (() => Promise<void>) | null = null;
		try {
			release = await lockfile.lock(filePath, LOCK_OPTIONS);

			// Re-read file INSIDE lock to get current state
			// This prevents lost updates from stale snapshots
			let currentData: T;
			try {
				const content = await fs.readFile(filePath, 'utf-8');
				currentData = JSON.parse(content);
			} catch {
				// File empty or invalid - start with empty object
				currentData = {} as T;
			}

			// Apply modification
			const newData = await modifier(currentData);

			// Write atomically using steno (same pattern as workflow-state-manager)
			const content = JSON.stringify(newData, null, 2);
			const writer = this.getWriter(filePath);
			await writer.write(content);
		} finally {
			if (release) {
				try {
					await release();
				} catch {
					// Ignore release errors - lock may have been released already
				}
			}
		}
	}

	/**
	 * Ensure file exists for locking (proper-lockfile requires the file to exist).
	 * Uses atomic creation with 'wx' flag to prevent TOCTOU race conditions.
	 */
	private async ensureFileExists(filePath: string): Promise<void> {
		const dir = path.dirname(filePath);
		await fs.mkdir(dir, { recursive: true });
		try {
			// Use 'wx' flag for atomic create - fails if file exists (prevents race)
			await fs.writeFile(filePath, '{}', { flag: 'wx' });
		} catch (err: any) {
			// EEXIST is expected if another process created the file - that's fine
			if (err.code !== 'EEXIST') {
				throw err;
			}
		}
	}

	/**
	 * Check if file exists
	 */
	async exists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath, constants.F_OK);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get file stats
	 */
	async getStats(filePath: string) {
		return fs.stat(filePath);
	}

	/**
	 * Read directory contents
	 */
	async readDir(dirPath: string): Promise<string[]> {
		return fs.readdir(dirPath);
	}

	/**
	 * Create directory recursively
	 */
	async ensureDir(dirPath: string): Promise<void> {
		try {
			await fs.mkdir(dirPath, { recursive: true });
		} catch (error: any) {
			throw new Error(
				`Failed to create directory ${dirPath}: ${error.message}`
			);
		}
	}

	/**
	 * Delete file
	 */
	async deleteFile(filePath: string): Promise<void> {
		try {
			await fs.unlink(filePath);
		} catch (error: any) {
			if (error.code !== 'ENOENT') {
				throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
			}
		}
	}

	/**
	 * Rename/move file
	 */
	async moveFile(oldPath: string, newPath: string): Promise<void> {
		try {
			await fs.rename(oldPath, newPath);
		} catch (error: any) {
			throw new Error(
				`Failed to move file from ${oldPath} to ${newPath}: ${error.message}`
			);
		}
	}

	/**
	 * Copy file
	 */
	async copyFile(srcPath: string, destPath: string): Promise<void> {
		try {
			await fs.copyFile(srcPath, destPath);
		} catch (error: any) {
			throw new Error(
				`Failed to copy file from ${srcPath} to ${destPath}: ${error.message}`
			);
		}
	}

	/**
	 * Clean up resources - releases cached steno Writers
	 * Call this when the FileOperations instance is no longer needed
	 * to prevent memory leaks in long-running processes.
	 */
	async cleanup(): Promise<void> {
		// Clear cached Writers to allow garbage collection
		// Note: steno Writers don't have explicit close methods;
		// they handle file descriptor cleanup internally
		this.writers.clear();
	}
}
