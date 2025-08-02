import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Service for synchronizing tasks with the file system and CLI
 */
export class TaskSyncService {
	constructor(taskMaster) {
		this.taskMaster = taskMaster;
		this.cache = null;
		this.cacheTimestamp = 0;
		this.cacheTTL = 1000; // 1 second cache TTL
	}

	/**
	 * Get all tasks with caching
	 * @returns {Object} Tasks data
	 */
	getTasks() {
		const now = Date.now();
		
		// Return cached data if still valid
		if (this.cache && (now - this.cacheTimestamp) < this.cacheTTL) {
			return this.cache;
		}

		// Refresh cache
		this.cache = this.taskMaster.tasks;
		this.cacheTimestamp = now;
		
		return this.cache;
	}

	/**
	 * Invalidate the cache
	 */
	invalidateCache() {
		this.cache = null;
		this.cacheTimestamp = 0;
	}

	/**
	 * Set task status using TaskMaster
	 * @param {string} taskId - Task ID
	 * @param {string} status - New status
	 * @returns {Promise<Object>} Result
	 */
	async setTaskStatus(taskId, status) {
		// Invalidate cache since we're modifying data
		this.invalidateCache();
		
		// Use TaskMaster's built-in method if available
		if (this.taskMaster.setTaskStatus) {
			return await this.taskMaster.setTaskStatus(taskId, status);
		}

		// Fallback to CLI command execution
		return await this.executeCommand('set-status', ['--id', taskId, '--status', status]);
	}

	/**
	 * Execute a TaskMaster CLI command
	 * @param {string} command - Command name
	 * @param {Array<string>} args - Command arguments
	 * @returns {Promise<Object>} Command result
	 */
	async executeCommand(command, args = []) {
		return new Promise((resolve, reject) => {
			const cliPath = path.join(process.cwd(), 'bin', 'task-master.js');
			const proc = spawn('node', [cliPath, command, ...args], {
				cwd: process.cwd(),
				env: process.env
			});

			let stdout = '';
			let stderr = '';

			proc.stdout.on('data', (data) => {
				stdout += data.toString();
			});

			proc.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			proc.on('close', (code) => {
				if (code === 0) {
					// Invalidate cache after successful command
					this.invalidateCache();
					resolve({
						success: true,
						output: stdout,
						code
					});
				} else {
					reject(new Error(stderr || `Command failed with code ${code}`));
				}
			});

			proc.on('error', (err) => {
				reject(err);
			});
		});
	}

	/**
	 * Watch tasks file for changes
	 * @param {Function} onChange - Callback when tasks change
	 * @returns {Function} Cleanup function
	 */
	watchTasks(onChange) {
		const tasksPath = this.taskMaster.tasksPath;
		
		if (!tasksPath || !fs.existsSync(tasksPath)) {
			console.warn('Tasks file not found for watching:', tasksPath);
			return () => {};
		}

		let debounceTimer;
		const watcher = fs.watch(tasksPath, (eventType) => {
			// Debounce rapid changes
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				this.invalidateCache();
				onChange(eventType);
			}, 100);
		});

		// Return cleanup function
		return () => {
			clearTimeout(debounceTimer);
			watcher.close();
		};
	}

	/**
	 * Get task by ID
	 * @param {string} id - Task ID
	 * @returns {Object|null} Task object or null
	 */
	getTaskById(id) {
		const tasks = this.getTasks();
		
		// Check main tasks
		const mainTask = tasks.tasks.find(t => t.id === id);
		if (mainTask) return mainTask;

		// Check subtasks
		for (const task of tasks.tasks) {
			if (task.subtasks) {
				const subtask = task.subtasks.find(st => st.id === id);
				if (subtask) return subtask;
			}
		}

		return null;
	}
}