/**
 * @fileoverview File operations with atomic writes and cross-process locking
 */

import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
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
	// In-memory locks are kept as a fallback for cases where file locking fails
	private fileLocks: Map<string, Promise<void>> = new Map();

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
	 * Write JSON file with atomic operation and cross-process locking
	 * Uses proper-lockfile for cross-process safety
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
			await this.performAtomicWrite(filePath, data);
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
	 * Ensure file exists for locking (proper-lockfile requires the file to exist)
	 */
	private async ensureFileExists(filePath: string): Promise<void> {
		try {
			await fs.access(filePath, constants.F_OK);
		} catch {
			// File doesn't exist, create it with empty JSON
			const dir = path.dirname(filePath);
			await fs.mkdir(dir, { recursive: true });
			await fs.writeFile(filePath, '{}', 'utf-8');
		}
	}

	/**
	 * Perform atomic write operation using temporary file
	 */
	private async performAtomicWrite(filePath: string, data: any): Promise<void> {
		const tempPath = `${filePath}.tmp.${process.pid}`;

		try {
			// Write to temp file first
			const content = JSON.stringify(data, null, 2);
			await fs.writeFile(tempPath, content, 'utf-8');

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
	 * Clean up all pending file operations
	 */
	async cleanup(): Promise<void> {
		const locks = Array.from(this.fileLocks.values());
		if (locks.length > 0) {
			await Promise.all(locks);
		}
		this.fileLocks.clear();
	}
}
