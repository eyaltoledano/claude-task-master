/**
 * @fileoverview Path resolution utilities for single tasks.json file
 */

import path from 'node:path';

/**
 * Handles path resolution for the single tasks.json file storage
 */
export class PathResolver {
	private readonly basePath: string;
	private readonly tasksDir: string;
	private readonly tasksFilePath: string;

	constructor(projectPath: string) {
		this.basePath = path.join(projectPath, '.taskmaster');
		this.tasksDir = path.join(this.basePath, 'tasks');
		this.tasksFilePath = path.join(this.tasksDir, 'tasks.json');
	}

	/**
	 * Get the base storage directory path
	 */
	getBasePath(): string {
		return this.basePath;
	}

	/**
	 * Get the tasks directory path
	 */
	getTasksDir(): string {
		return this.tasksDir;
	}

	/**
	 * Get the path to the single tasks.json file
	 * All tags are stored in this one file
	 */
	getTasksPath(): string {
		return this.tasksFilePath;
	}
}
