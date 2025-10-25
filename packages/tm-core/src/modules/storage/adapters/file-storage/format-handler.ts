/**
 * @fileoverview Format handler for task storage files
 */

import type { Task, TaskMetadata } from '../../../../common/types/index.js';

export interface FileStorageData {
	tasks: Task[];
	metadata: TaskMetadata;
}

export type FileFormat = 'legacy' | 'standard';

/**
 * Handles format detection and conversion between legacy and standard task file formats
 */
export class FormatHandler {
	/**
	 * Detect the format of the raw data
	 */
	detectFormat(data: any): FileFormat {
		if (!data || typeof data !== 'object') {
			return 'standard';
		}

		const keys = Object.keys(data);

		// Check if this uses the legacy format with tag keys
		// Legacy format has keys that are not 'tasks' or 'metadata'
		const hasLegacyFormat = keys.some(
			(key) => key !== 'tasks' && key !== 'metadata'
		);

		return hasLegacyFormat ? 'legacy' : 'standard';
	}

	/**
	 * Extract tasks from data for a specific tag
	 */
	extractTasks(data: any, tag: string): Task[] {
		if (!data) {
			return [];
		}

		const format = this.detectFormat(data);

		if (format === 'legacy') {
			return this.extractTasksFromLegacy(data, tag);
		}

		return this.extractTasksFromStandard(data);
	}

	/**
	 * Extract tasks from legacy format
	 */
	private extractTasksFromLegacy(data: any, tag: string): Task[] {
		// First check if the requested tag exists
		if (tag in data) {
			const tagData = data[tag];
			return tagData?.tasks || [];
		}

		// If we're looking for 'master' tag but it doesn't exist, try the first available tag
		const availableKeys = Object.keys(data).filter(
			(key) => key !== 'tasks' && key !== 'metadata'
		);
		if (tag === 'master' && availableKeys.length > 0) {
			const firstTag = availableKeys[0];
			const tagData = data[firstTag];
			return tagData?.tasks || [];
		}

		return [];
	}

	/**
	 * Extract tasks from standard format
	 */
	private extractTasksFromStandard(data: any): Task[] {
		return data?.tasks || [];
	}

	/**
	 * Extract metadata from data for a specific tag
	 */
	extractMetadata(data: any, tag: string): TaskMetadata | null {
		if (!data) {
			return null;
		}

		const format = this.detectFormat(data);

		if (format === 'legacy') {
			return this.extractMetadataFromLegacy(data, tag);
		}

		return this.extractMetadataFromStandard(data);
	}

	/**
	 * Extract metadata from legacy format
	 */
	private extractMetadataFromLegacy(
		data: any,
		tag: string
	): TaskMetadata | null {
		if (tag in data) {
			const tagData = data[tag];
			// Generate metadata if not present in legacy format
			if (!tagData?.metadata && tagData?.tasks) {
				return this.generateMetadataFromTasks(tagData.tasks, tag);
			}
			return tagData?.metadata || null;
		}

		// If we're looking for 'master' tag but it doesn't exist, try the first available tag
		const availableKeys = Object.keys(data).filter(
			(key) => key !== 'tasks' && key !== 'metadata'
		);
		if (tag === 'master' && availableKeys.length > 0) {
			const firstTag = availableKeys[0];
			const tagData = data[firstTag];
			if (!tagData?.metadata && tagData?.tasks) {
				return this.generateMetadataFromTasks(tagData.tasks, firstTag);
			}
			return tagData?.metadata || null;
		}

		return null;
	}

	/**
	 * Extract metadata from standard format
	 */
	private extractMetadataFromStandard(data: any): TaskMetadata | null {
		return data?.metadata || null;
	}

	/**
	 * Extract all available tags from the single tasks.json file
	 */
	extractTags(data: any): string[] {
		if (!data) {
			return [];
		}

		const format = this.detectFormat(data);

		if (format === 'legacy') {
			// Return all tag keys from legacy format
			const keys = Object.keys(data);
			return keys.filter((key) => key !== 'tasks' && key !== 'metadata');
		}

		// Standard format - just has 'master' tag
		return ['master'];
	}

	/**
	 * Convert tasks and metadata to the appropriate format for saving
	 */
	convertToSaveFormat(
		tasks: Task[],
		metadata: TaskMetadata,
		existingData: any,
		tag: string
	): any {
		const resolvedTag = tag || 'master';

		// Normalize task IDs to strings
		const normalizedTasks = this.normalizeTasks(tasks);

		// Check if existing file uses legacy format
		if (existingData && this.detectFormat(existingData) === 'legacy') {
			return this.convertToLegacyFormat(normalizedTasks, metadata, resolvedTag);
		}

		// Use standard format for new files
		return this.convertToStandardFormat(normalizedTasks, metadata, tag);
	}

	/**
	 * Convert to legacy format
	 */
	private convertToLegacyFormat(
		tasks: Task[],
		metadata: TaskMetadata,
		tag: string
	): any {
		return {
			[tag]: {
				tasks,
				metadata: {
					...metadata,
					tags: [tag]
				}
			}
		};
	}

	/**
	 * Convert to standard format
	 */
	private convertToStandardFormat(
		tasks: Task[],
		metadata: TaskMetadata,
		tag?: string
	): FileStorageData {
		return {
			tasks,
			metadata: {
				...metadata,
				tags: tag ? [tag] : []
			}
		};
	}

	/**
	 * Normalize task IDs - keep Task IDs as strings, Subtask IDs as numbers
	 */
	private normalizeTasks(tasks: Task[]): Task[] {
		return tasks.map((task) => ({
			...task,
			id: String(task.id), // Task IDs are strings
			dependencies: task.dependencies?.map((dep) => String(dep)) || [],
			subtasks:
				task.subtasks?.map((subtask) => ({
					...subtask,
					id: Number(subtask.id), // Subtask IDs are numbers
					parentId: String(subtask.parentId) // Parent ID is string (Task ID)
				})) || []
		}));
	}

	/**
	 * Generate metadata from tasks when not present
	 */
	private generateMetadataFromTasks(tasks: Task[], tag: string): TaskMetadata {
		return {
			version: '1.0.0',
			lastModified: new Date().toISOString(),
			taskCount: tasks.length,
			completedCount: tasks.filter((t: any) => t.status === 'done').length,
			tags: [tag]
		};
	}
}
