import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import { z } from 'zod';

import { log, readJSON, writeJSON, findTaskById } from '../utils.js';
import { displayBanner } from '../ui.js';
import { validateTaskDependencies } from '../dependency-manager.js';
import { getDebugFlag } from '../config-manager.js';
import updateSingleTaskStatus from './update-single-task-status.js';
import generateTaskFiles from './generate-task-files.js';

export const TASK_STATUSES = Object.freeze({
	PENDING: 'pending',
	IN_PROGRESS: 'in-progress',
	REVIEW: 'review',
	DONE: 'done',
	COMPLETED: 'completed',
	DEFERRED: 'deferred',
	CANCELLED: 'cancelled',
	BLOCKED: 'blocked'
});
export const VALID_TASK_STATUS_VALUES = Object.values(TASK_STATUSES);

// Create the Zod schema for status validation once
const statusSchema = z.enum(VALID_TASK_STATUS_VALUES);

/**
 * Set the status of a task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIdInput - Task ID(s) to update
 * @param {string} newStatusInput - New status
 * @param {Object} options - Additional options (mcpLog for MCP mode)
 * @returns {Object|undefined} Result object in MCP mode, undefined in CLI mode
 */
async function setTaskStatus(
	tasksPath,
	taskIdInput,
	newStatusInput,
	options = {}
) {
	try {
		const normalizedStatus = newStatusInput.trim().toLowerCase();
		const validationResult = statusSchema.safeParse(normalizedStatus);

		if (!validationResult.success) {
			const prettyErrors = validationResult.error.errors
				.map((err) => {
					if (err.code === 'invalid_enum_value') {
						return `Invalid status: "${newStatusInput}". Allowed values are: ${err.options.join(', ')}.`;
					}
					return err.message;
				})
				.join(' ');
			const errorMessage =
				prettyErrors || `Invalid status value: "${newStatusInput}"`;

			log('error', errorMessage);
			if (!options?.mcpLog) {
				console.error(chalk.red(`Error: ${errorMessage}`));
				process.exit(1);
			}
			throw new Error(errorMessage);
		}

		const newStatus = validationResult.data;

		// Determine if we're in MCP mode by checking for mcpLog
		const isMcpMode = !!options?.mcpLog;

		// Only display UI elements if not in MCP mode
		if (!isMcpMode) {
			displayBanner();

			console.log(
				boxen(chalk.white.bold(`Updating Task Status to: ${newStatus}`), {
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round'
				})
			);
		}

		log('info', `Reading tasks from ${tasksPath}...`);
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Handle multiple task IDs (comma-separated)
		const taskIds = taskIdInput.split(',').map((id) => id.trim());
		const updatedTasks = [];

		// Update each task
		for (const id of taskIds) {
			await updateSingleTaskStatus(tasksPath, id, newStatus, data, !isMcpMode);
			updatedTasks.push(id);
		}

		// Write the updated tasks to the file
		writeJSON(tasksPath, data);

		// Validate dependencies after status update
		log('info', 'Validating dependencies after status update...');
		validateTaskDependencies(data.tasks);

		// Generate individual task files
		log('info', 'Regenerating task files...');
		await generateTaskFiles(tasksPath, path.dirname(tasksPath), {
			mcpLog: options.mcpLog
		});

		// Display success message - only in CLI mode
		if (!isMcpMode) {
			for (const id of updatedTasks) {
				const task = findTaskById(data.tasks, id);
				const taskName = task ? task.title : id;

				console.log(
					boxen(
						chalk.white.bold(`Successfully updated task ${id} status:`) +
							'\n' +
							`From: ${chalk.yellow(task ? task.status : 'unknown')}\n` +
							`To:   ${chalk.green(newStatus)}`,
						{ padding: 1, borderColor: 'green', borderStyle: 'round' }
					)
				);
			}
		}

		// Return success value for programmatic use
		return {
			success: true,
			updatedTasks: updatedTasks.map((id) => ({
				id,
				status: newStatus
			}))
		};
	} catch (error) {
		log('error', `Error setting task status: ${error.message}`);

		// Only show error UI in CLI mode
		if (!options?.mcpLog) {
			console.error(chalk.red(`Error: ${error.message}`));

			// Pass session to getDebugFlag
			if (getDebugFlag(options?.session)) {
				// Use getter
				console.error(error);
			}

			process.exit(1);
		} else {
			// In MCP mode, throw the error for the caller to handle
			throw error;
		}
	}
}

export default setTaskStatus;
