/**
 * @fileoverview JSONL synchronization module for SQLite storage
 *
 * SQLite is the local working database, but we sync to JSONL for git-friendly
 * persistence. Every write to SQLite should update the JSONL file.
 *
 * JSONL Format:
 * Each line is a complete task object with metadata fields:
 * - _v: Schema version (for future migrations)
 * - _ts: Last modified timestamp (ISO 8601)
 * - _deleted: Optional soft delete marker
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import type { Task } from '../../../../common/types/index.js';

/**
 * Task with JSONL metadata fields
 */
export interface JsonlTask extends Task {
	/** Schema version for future migrations */
	_v: number;
	/** Last modified timestamp (ISO 8601) */
	_ts: string;
	/** Soft delete marker */
	_deleted?: boolean;
	/** Tag/context the task belongs to */
	_tag?: string;
}

/**
 * File statistics for the JSONL file
 */
export interface JsonlStats {
	/** File size in bytes */
	size: number;
	/** Number of lines (tasks) in the file */
	lineCount: number;
	/** Last modified time */
	modifiedTime: Date;
}

/**
 * Options for reading tasks
 */
export interface ReadOptions {
	/** Include soft-deleted tasks (default: false) */
	includeDeleted?: boolean;
}

/**
 * JSONL synchronization class for git-friendly task persistence
 *
 * Handles reading and writing tasks to a JSONL file where each line
 * is a complete JSON object representing a task with metadata.
 */
export class JsonlSync {
	private readonly jsonlPath: string;
	private readonly schemaVersion = 1;

	/**
	 * Create a new JsonlSync instance
	 * @param jsonlPath - Absolute path to the JSONL file
	 */
	constructor(jsonlPath: string) {
		this.jsonlPath = jsonlPath;
	}

	/**
	 * Read all tasks from the JSONL file
	 *
	 * Uses streaming to handle large files efficiently.
	 *
	 * @param options - Read options
	 * @returns Array of tasks with JSONL metadata
	 */
	async readAll(options: ReadOptions = {}): Promise<JsonlTask[]> {
		const { includeDeleted = false } = options;

		if (!this.exists()) {
			return [];
		}

		const tasks: JsonlTask[] = [];

		const fileStream = fs.createReadStream(this.jsonlPath, {
			encoding: 'utf-8'
		});

		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity
		});

		let lineNumber = 0;
		for await (const line of rl) {
			lineNumber++;
			const trimmedLine = line.trim();

			// Skip empty lines
			if (!trimmedLine) {
				continue;
			}

			try {
				const task = JSON.parse(trimmedLine) as JsonlTask;

				// Filter out deleted tasks unless explicitly requested
				if (!includeDeleted && task._deleted) {
					continue;
				}

				tasks.push(task);
			} catch (error) {
				// Log parse errors but continue reading
				console.error(
					`[JsonlSync] Failed to parse line ${lineNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
				);
			}
		}

		return tasks;
	}

	/**
	 * Write or update a single task in the JSONL file
	 *
	 * If a task with the same ID exists, it replaces that line.
	 * Otherwise, appends the task to the end of the file.
	 *
	 * @param task - The task to write
	 */
	async writeTask(task: Task): Promise<void> {
		const jsonlTask = this.toJsonlTask(task);
		const newLine = JSON.stringify(jsonlTask);

		// If file doesn't exist, just create it with this task
		if (!this.exists()) {
			await this.ensureDirectory();
			await fs.promises.writeFile(this.jsonlPath, newLine + '\n', 'utf-8');
			return;
		}

		// Read all lines and find the matching task
		const lines = await this.readLines();
		let found = false;
		const updatedLines: string[] = [];

		for (const line of lines) {
			const trimmedLine = line.trim();
			if (!trimmedLine) {
				continue;
			}

			try {
				const existingTask = JSON.parse(trimmedLine) as JsonlTask;
				if (existingTask.id === task.id) {
					// Replace this line with the updated task
					updatedLines.push(newLine);
					found = true;
				} else {
					updatedLines.push(trimmedLine);
				}
			} catch {
				// Keep malformed lines to not lose data
				updatedLines.push(trimmedLine);
			}
		}

		// If task wasn't found, append it
		if (!found) {
			updatedLines.push(newLine);
		}

		// Write all lines back
		await this.writeLines(updatedLines);
	}

	/**
	 * Write multiple tasks at once (more efficient than individual writes)
	 *
	 * @param tasks - Array of tasks to write
	 */
	async writeTasks(tasks: Task[]): Promise<void> {
		if (tasks.length === 0) {
			return;
		}

		// Build a map of tasks to write for quick lookup
		const taskMap = new Map<string, Task>();
		for (const task of tasks) {
			taskMap.set(task.id, task);
		}

		// If file doesn't exist, just create it with all tasks
		if (!this.exists()) {
			await this.ensureDirectory();
			const lines = tasks.map((task) => JSON.stringify(this.toJsonlTask(task)));
			await fs.promises.writeFile(
				this.jsonlPath,
				lines.join('\n') + '\n',
				'utf-8'
			);
			return;
		}

		// Read all lines and update matching tasks
		const existingLines = await this.readLines();
		const updatedLines: string[] = [];
		const writtenIds = new Set<string>();

		for (const line of existingLines) {
			const trimmedLine = line.trim();
			if (!trimmedLine) {
				continue;
			}

			try {
				const existingTask = JSON.parse(trimmedLine) as JsonlTask;
				if (taskMap.has(existingTask.id)) {
					// Replace with the new version
					const newTask = taskMap.get(existingTask.id)!;
					updatedLines.push(JSON.stringify(this.toJsonlTask(newTask)));
					writtenIds.add(existingTask.id);
				} else {
					updatedLines.push(trimmedLine);
				}
			} catch {
				// Keep malformed lines
				updatedLines.push(trimmedLine);
			}
		}

		// Append any tasks that weren't found
		for (const task of tasks) {
			if (!writtenIds.has(task.id)) {
				updatedLines.push(JSON.stringify(this.toJsonlTask(task)));
			}
		}

		await this.writeLines(updatedLines);
	}

	/**
	 * Delete a task from the JSONL file
	 *
	 * Removes the line containing the task (hard delete).
	 *
	 * @param taskId - ID of the task to delete
	 */
	async deleteTask(taskId: string): Promise<void> {
		if (!this.exists()) {
			return;
		}

		const lines = await this.readLines();
		const updatedLines: string[] = [];

		for (const line of lines) {
			const trimmedLine = line.trim();
			if (!trimmedLine) {
				continue;
			}

			try {
				const task = JSON.parse(trimmedLine) as JsonlTask;
				// Skip the task we want to delete
				if (task.id !== taskId) {
					updatedLines.push(trimmedLine);
				}
			} catch {
				// Keep malformed lines
				updatedLines.push(trimmedLine);
			}
		}

		await this.writeLines(updatedLines);
	}

	/**
	 * Soft delete a task (mark as deleted but keep in file)
	 *
	 * Useful for preserving history and potential recovery.
	 *
	 * @param taskId - ID of the task to soft delete
	 */
	async softDeleteTask(taskId: string): Promise<void> {
		if (!this.exists()) {
			return;
		}

		const lines = await this.readLines();
		const updatedLines: string[] = [];

		for (const line of lines) {
			const trimmedLine = line.trim();
			if (!trimmedLine) {
				continue;
			}

			try {
				const task = JSON.parse(trimmedLine) as JsonlTask;
				if (task.id === taskId) {
					// Mark as deleted
					task._deleted = true;
					task._ts = new Date().toISOString();
					updatedLines.push(JSON.stringify(task));
				} else {
					updatedLines.push(trimmedLine);
				}
			} catch {
				// Keep malformed lines
				updatedLines.push(trimmedLine);
			}
		}

		await this.writeLines(updatedLines);
	}

	/**
	 * Export all tasks (full rewrite of the file)
	 *
	 * Replaces the entire file content with the provided tasks.
	 * Use this for bulk operations or initial data loading.
	 *
	 * @param tasks - Array of tasks to export
	 */
	async exportAll(tasks: Task[]): Promise<void> {
		await this.ensureDirectory();

		const lines = tasks.map((task) => JSON.stringify(this.toJsonlTask(task)));

		// Write with trailing newline for POSIX compliance
		const content = lines.length > 0 ? lines.join('\n') + '\n' : '';
		await fs.promises.writeFile(this.jsonlPath, content, 'utf-8');
	}

	/**
	 * Export all tasks with their tag information to the JSONL file
	 * This preserves tag context for proper rebuild from JSONL
	 *
	 * @param tasksWithTags - Array of {task, tag} pairs
	 */
	async exportAllWithTags(
		tasksWithTags: Array<{ task: Task; tag: string }>
	): Promise<void> {
		await this.ensureDirectory();

		const lines = tasksWithTags.map(({ task, tag }) =>
			JSON.stringify(this.toJsonlTask(task, tag))
		);

		// Write with trailing newline for POSIX compliance
		const content = lines.length > 0 ? lines.join('\n') + '\n' : '';
		await fs.promises.writeFile(this.jsonlPath, content, 'utf-8');
	}

	/**
	 * Check if the JSONL file exists
	 *
	 * @returns true if the file exists
	 */
	exists(): boolean {
		return fs.existsSync(this.jsonlPath);
	}

	/**
	 * Get file statistics
	 *
	 * @returns File stats or null if file doesn't exist
	 */
	getStats(): JsonlStats | null {
		if (!this.exists()) {
			return null;
		}

		try {
			const stat = fs.statSync(this.jsonlPath);
			const content = fs.readFileSync(this.jsonlPath, 'utf-8');
			const lineCount = content
				.split('\n')
				.filter((line) => line.trim().length > 0).length;

			return {
				size: stat.size,
				lineCount,
				modifiedTime: stat.mtime
			};
		} catch {
			return null;
		}
	}

	/**
	 * Get a single task by ID
	 *
	 * Uses streaming for efficiency - stops reading once task is found.
	 *
	 * @param taskId - ID of the task to find
	 * @returns The task or null if not found
	 */
	async getTask(taskId: string): Promise<JsonlTask | null> {
		if (!this.exists()) {
			return null;
		}

		const fileStream = fs.createReadStream(this.jsonlPath, {
			encoding: 'utf-8'
		});

		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity
		});

		let found: JsonlTask | null = null;

		try {
			for await (const line of rl) {
				const trimmedLine = line.trim();
				if (!trimmedLine) {
					continue;
				}

				try {
					const task = JSON.parse(trimmedLine) as JsonlTask;
					if (task.id === taskId && !task._deleted) {
						found = task;
						break; // Exit loop, finally will close rl
					}
				} catch {
					// Continue to next line
				}
			}
		} finally {
			rl.close();
		}

		return found;
	}

	/**
	 * Get the path to the JSONL file
	 *
	 * @returns Absolute path to the JSONL file
	 */
	getPath(): string {
		return this.jsonlPath;
	}

	/**
	 * Get the current schema version
	 *
	 * @returns Schema version number
	 */
	getSchemaVersion(): number {
		return this.schemaVersion;
	}

	/**
	 * Convert a Task to a JsonlTask with metadata
	 */
	private toJsonlTask(task: Task, tag?: string): JsonlTask {
		const jsonlTask: JsonlTask = {
			...task,
			_v: this.schemaVersion,
			_ts: new Date().toISOString()
		};
		if (tag) {
			jsonlTask._tag = tag;
		}
		return jsonlTask;
	}

	/**
	 * Read all lines from the file
	 */
	private async readLines(): Promise<string[]> {
		const content = await fs.promises.readFile(this.jsonlPath, 'utf-8');
		return content.split('\n');
	}

	/**
	 * Write lines to the file
	 */
	private async writeLines(lines: string[]): Promise<void> {
		const content = lines.length > 0 ? lines.join('\n') + '\n' : '';
		await fs.promises.writeFile(this.jsonlPath, content, 'utf-8');
	}

	/**
	 * Ensure the directory for the JSONL file exists
	 */
	private async ensureDirectory(): Promise<void> {
		const dir = path.dirname(this.jsonlPath);
		await fs.promises.mkdir(dir, { recursive: true });
	}
}
