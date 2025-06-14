import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';

import {
	log,
	readJSON,
	writeJSON,
	findTaskById,
	getCurrentTag,
	ensureTagMetadata
} from '../utils.js';
import { displayBanner } from '../ui.js';
import { validateTaskDependencies } from '../dependency-manager.js';
import { getDebugFlag } from '../config-manager.js';
import updateSingleTaskStatus from './update-single-task-status.js';
import generateTaskFiles from './generate-task-files.js';
import {
	isValidTaskStatus,
	TASK_STATUS_OPTIONS
} from '../../../src/constants/task-status.js';

/**
 * Set the status of a task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIdInput - Task ID(s) to update
 * @param {string} newStatus - New status
 * @param {Object} options - Additional options (mcpLog for MCP mode, projectRoot for tag resolution)
 * @param {string} tag - Optional tag to override current tag resolution
 * @returns {Object|undefined} Result object in MCP mode, undefined in CLI mode
 */
async function setTaskStatus(
	tasksPath,
	taskIdInput,
	newStatus,
	options = {},
	tag = null
) {
	try {
		if (!isValidTaskStatus(newStatus)) {
			throw new Error(
				`Error: Invalid status value: ${newStatus}. Use one of: ${TASK_STATUS_OPTIONS.join(', ')}`
			);
		}
		// Determine if we're in MCP mode by checking for mcpLog
		const isMcpMode = !!options?.mcpLog;

		// Only display UI elements if not in MCP mode
		if (!isMcpMode) {
			console.log(
				boxen(chalk.white.bold(`Updating Task Status to: ${newStatus}`), {
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round'
				})
			);
		}

		log('info', `Reading tasks from ${tasksPath}...`);

		// Read the raw data without tag resolution to preserve tagged structure
		let rawData = readJSON(tasksPath, options.projectRoot); // No tag parameter

		// Handle the case where readJSON returns resolved data with _rawTaggedData
		if (rawData && rawData._rawTaggedData) {
			// Use the raw tagged data and discard the resolved view
			rawData = rawData._rawTaggedData;
		}

		// Determine the current tag
		const currentTag = tag || getCurrentTag(options.projectRoot) || 'master';

		// Ensure the tag exists in the raw data
		if (
			!rawData ||
			!rawData[currentTag] ||
			!Array.isArray(rawData[currentTag].tasks)
		) {
			throw new Error(
				`Invalid tasks file or tag "${currentTag}" not found at ${tasksPath}`
			);
		}

		// Get the tasks for the current tag
		const data = {
			tasks: rawData[currentTag].tasks,
			tag: currentTag,
			_rawTaggedData: rawData
		};

		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Handle multiple task IDs (comma-separated)
		const taskIds = taskIdInput.split(',').map((id) => id.trim());
		const updatedTasks = [];

		// Update each task and capture old status for display
		for (const id of taskIds) {
			// Capture old status before updating
			let oldStatus = 'unknown';

			if (id.includes('.')) {
				// Handle subtask
				const [parentId, subtaskId] = id
					.split('.')
					.map((id) => parseInt(id, 10));
				const parentTask = data.tasks.find((t) => t.id === parentId);
				if (parentTask?.subtasks) {
					const subtask = parentTask.subtasks.find((st) => st.id === subtaskId);
					oldStatus = subtask?.status || 'pending';
				}
			} else {
				// Handle regular task
				const taskId = parseInt(id, 10);
				const task = data.tasks.find((t) => t.id === taskId);
				oldStatus = task?.status || 'pending';
			}

			await updateSingleTaskStatus(tasksPath, id, newStatus, data, !isMcpMode);
			updatedTasks.push({ id, oldStatus, newStatus });
		}

		// Update the raw data structure with the modified tasks
		rawData[currentTag].tasks = data.tasks;

		// Ensure the tag has proper metadata
		ensureTagMetadata(rawData[currentTag], {
			description: `Tasks for ${currentTag} context`
		});

		// Write the updated raw data back to the file
		// The writeJSON function will automatically filter out _rawTaggedData
		writeJSON(tasksPath, rawData);

		// Validate dependencies after status update
		log('info', 'Validating dependencies after status update...');
		validateTaskDependencies(data.tasks);

		// Generate individual task files
		// log('info', 'Regenerating task files...');
		// await generateTaskFiles(tasksPath, path.dirname(tasksPath), {
		// 	mcpLog: options.mcpLog
		// });

		// Display success message - only in CLI mode
		if (!isMcpMode) {
			for (const updateInfo of updatedTasks) {
				const { id, oldStatus, newStatus: updatedStatus } = updateInfo;

				console.log(
					boxen(
						chalk.white.bold(`Successfully updated task ${id} status:`) +
							'\n' +
							`From: ${chalk.yellow(oldStatus)}\n` +
							`To:   ${chalk.green(updatedStatus)}`,
						{ padding: 1, borderColor: 'green', borderStyle: 'round' }
					)
				);
			}
		}

		// Return success value for programmatic use
		return {
			success: true,
			updatedTasks: updatedTasks.map(({ id, oldStatus, newStatus }) => ({
				id,
				oldStatus,
				newStatus
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
