/**
 * @fileoverview Task file generator service
 * Generates individual markdown task files from tasks.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Task, Subtask, TaskStatus } from '../../../common/types/index.js';
import type { IStorage } from '../../../common/interfaces/storage.interface.js';
import type { ConfigManager } from '../../config/managers/config-manager.js';

/**
 * Options for generating task files
 */
export interface GenerateTaskFilesOptions {
	/** Tag context for the tasks */
	tag?: string;
	/** Output directory for generated files (defaults to tasks directory) */
	outputDir?: string;
}

/**
 * Result of task file generation
 */
export interface GenerateTaskFilesResult {
	success: boolean;
	/** Number of task files successfully generated */
	count: number;
	/** Output directory where files were written */
	directory: string;
	/** Number of orphaned files cleaned up */
	orphanedFilesRemoved: number;
	/** Error message if generation failed completely */
	error?: string;
	/** Individual file write errors (task ID -> error message) */
	fileErrors?: Record<string, string>;
}

/**
 * Service for generating individual task markdown files from tasks.json
 */
export class TaskFileGeneratorService {
	constructor(
		private storage: IStorage,
		private projectPath: string,
		private configManager: ConfigManager
	) {}

	/**
	 * Generate individual task files from storage
	 * - Reads tasks from storage
	 * - Cleans up orphaned task files
	 * - Writes individual markdown files for each task
	 */
	async generateTaskFiles(
		options: GenerateTaskFilesOptions = {}
	): Promise<GenerateTaskFilesResult> {
		const tag = options.tag || this.configManager.getActiveTag();
		const outputDir =
			options.outputDir ||
			path.join(this.projectPath, '.taskmaster', 'tasks');

		try {
			// Ensure output directory exists
			await fs.mkdir(outputDir, { recursive: true });

			// Load tasks from storage
			const tasks = await this.storage.loadTasks(tag);

			if (tasks.length === 0) {
				return {
					success: true,
					count: 0,
					directory: outputDir,
					orphanedFilesRemoved: 0
				};
			}

			// Clean up orphaned task files
			const orphanedCount = await this.cleanupOrphanedFiles(
				outputDir,
				tasks,
				tag
			);

			// Generate task files in parallel with individual error handling
			// This allows partial success - some files can be written even if others fail
			const fileErrors: Record<string, string> = {};
			const results = await Promise.allSettled(
				tasks.map(async (task) => {
					const content = this.formatTaskContent(task, tasks);
					const fileName = this.getTaskFileName(task.id, tag);
					const filePath = path.join(outputDir, fileName);
					await fs.writeFile(filePath, content, 'utf-8');
					return task.id;
				})
			);

			// Count successes and collect errors
			let successCount = 0;
			for (let i = 0; i < results.length; i++) {
				const result = results[i];
				if (result.status === 'fulfilled') {
					successCount++;
				} else {
					const taskId = String(tasks[i].id);
					fileErrors[taskId] = result.reason?.message || 'Unknown error';
				}
			}

			return {
				success: Object.keys(fileErrors).length === 0,
				count: successCount,
				directory: outputDir,
				orphanedFilesRemoved: orphanedCount,
				...(Object.keys(fileErrors).length > 0 && { fileErrors })
			};
		} catch (error: any) {
			return {
				success: false,
				count: 0,
				directory: outputDir,
				orphanedFilesRemoved: 0,
				error: error.message
			};
		}
	}

	/**
	 * Get the filename for a task file
	 * Master tag: task_001.md
	 * Other tags: task_001_tagname.md
	 */
	private getTaskFileName(taskId: string | number, tag: string): string {
		const paddedId = String(taskId).padStart(3, '0');
		return tag === 'master'
			? `task_${paddedId}.md`
			: `task_${paddedId}_${tag}.md`;
	}

	/**
	 * Escape special regex characters in a string
	 */
	private escapeRegExp(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/**
	 * Clean up orphaned task files (files for tasks that no longer exist)
	 * @returns Number of files removed
	 */
	private async cleanupOrphanedFiles(
		outputDir: string,
		tasks: Task[],
		tag: string
	): Promise<number> {
		let removedCount = 0;

		try {
			const files = await fs.readdir(outputDir);
			const validTaskIds = tasks.map((task) => String(task.id));

			// Tag-aware file patterns
			const masterFilePattern = /^task_(\d+)\.md$/;
			const taggedFilePattern = new RegExp(`^task_(\\d+)_${this.escapeRegExp(tag)}\\.md$`);

			// Collect files to remove
			const filesToRemove: string[] = [];

			for (const file of files) {
				let match = null;
				let fileTaskId: string | null = null;

				// Check if file belongs to current tag
				if (tag === 'master') {
					match = file.match(masterFilePattern);
					if (match) {
						fileTaskId = match[1];
					}
				} else {
					match = file.match(taggedFilePattern);
					if (match) {
						fileTaskId = match[1];
					}
				}

				// If this is a task file for the current tag and the task no longer exists
				if (fileTaskId !== null) {
					// Convert to integer for comparison (removes leading zeros)
					const normalizedId = String(parseInt(fileTaskId, 10));
					if (!validTaskIds.includes(normalizedId)) {
						filesToRemove.push(file);
					}
				}
			}

			// Remove files in parallel
			await Promise.all(
				filesToRemove.map(async (file) => {
					const filePath = path.join(outputDir, file);
					await fs.unlink(filePath);
				})
			);
			removedCount = filesToRemove.length;
		} catch (error) {
			// Ignore errors during cleanup - non-critical operation
		}

		return removedCount;
	}

	/**
	 * Format a task into markdown content for the task file
	 * Uses single H1 title with metadata as key-value pairs
	 */
	private formatTaskContent(task: Task, allTasks: Task[]): string {
		// Single H1 title with task ID
		let content = `# Task ID: ${task.id}\n\n`;

		// Metadata as key-value pairs (using bold for keys)
		content += `**Title:** ${task.title}\n\n`;
		content += `**Status:** ${task.status || 'pending'}\n\n`;

		// Format dependencies with status
		if (task.dependencies && task.dependencies.length > 0) {
			const depsWithStatus = this.formatDependenciesWithStatus(
				task.dependencies,
				allTasks
			);
			content += `**Dependencies:** ${depsWithStatus}\n\n`;
		} else {
			content += '**Dependencies:** None\n\n';
		}

		content += `**Priority:** ${task.priority || 'medium'}\n\n`;
		content += `**Description:** ${task.description || ''}\n\n`;

		// Details section
		content += '**Details:**\n\n';
		content += `${task.details || 'No details provided.'}\n\n`;

		// Test Strategy section
		content += '**Test Strategy:**\n\n';
		content += `${task.testStrategy || 'No test strategy provided.'}\n`;

		// Add subtasks if present
		if (task.subtasks && task.subtasks.length > 0) {
			content += '\n## Subtasks\n';
			for (const subtask of task.subtasks) {
				content += this.formatSubtaskContent(subtask, task);
			}
		}

		// Normalize multiple blank lines to single blank lines
		return content.replace(/\n{3,}/g, '\n\n');
	}

	/**
	 * Format a subtask into markdown content
	 */
	private formatSubtaskContent(subtask: Subtask, parentTask: Task): string {
		// H3 for subtask title since H2 is used for sections
		let content = `\n### ${parentTask.id}.${subtask.id}. ${subtask.title}\n\n`;

		// Metadata using bold labels
		content += `**Status:** ${subtask.status || 'pending'}  \n`;

		// Format subtask dependencies
		if (subtask.dependencies && subtask.dependencies.length > 0) {
			const subtaskDeps = subtask.dependencies
				.map((depId) => {
					const depStr = String(depId);
					// Check if it's already a full ID (contains a dot) or is a simple number reference
					// Simple numbers (e.g., 1, '1') are internal subtask refs and need parent prefix
					// Full IDs (e.g., '1.2', '3') with dots are already complete
					if (depStr.includes('.')) {
						return depStr; // Already a full subtask ID like "2.1"
					}
					// Simple number - prefix with parent task ID
					return `${parentTask.id}.${depStr}`;
				})
				.join(', ');
			content += `**Dependencies:** ${subtaskDeps}  \n`;
		} else {
			content += '**Dependencies:** None  \n';
		}

		content += '\n';

		if (subtask.description) {
			content += `${subtask.description}\n`;
		}

		if (subtask.details) {
			content += `\n**Details:**\n\n${subtask.details}\n`;
		}

		return content;
	}

	/**
	 * Format dependencies with their current status
	 */
	private formatDependenciesWithStatus(
		dependencies: (string | number)[],
		allTasks: Task[]
	): string {
		return dependencies
			.map((depId) => {
				const depTask = allTasks.find(
					(t) => String(t.id) === String(depId)
				);
				if (depTask) {
					const statusSymbol = this.getStatusSymbol(depTask.status);
					return `${depId}${statusSymbol}`;
				}
				return String(depId);
			})
			.join(', ');
	}

	/**
	 * Get status symbol for display
	 */
	private getStatusSymbol(status: TaskStatus | undefined): string {
		switch (status) {
			case 'done':
				return ' ✓';
			case 'in-progress':
				return ' ⧖';
			case 'blocked':
				return ' ⛔';
			case 'cancelled':
				return ' ✗';
			case 'deferred':
				return ' ⏸';
			default:
				return '';
		}
	}
}
