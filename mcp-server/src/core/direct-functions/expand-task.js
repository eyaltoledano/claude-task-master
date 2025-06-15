/**
 * expand-task.js
 * Direct function implementation for expanding a task into subtasks
 */

import expandTask from '../../../../scripts/modules/task-manager/expand-task.js';
import {
	readJSON,
	writeJSON,
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';
import path from 'path';
import fs from 'fs';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for expanding a task into subtasks with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - The ID of the task to expand.
 * @param {number|string} [args.num] - Number of subtasks to generate.
 * @param {boolean} [args.research] - Enable research role for subtask generation.
 * @param {string} [args.prompt] - Additional context to guide subtask generation.
 * @param {boolean} [args.force] - Force expansion even if subtasks exist.
 * @param {string} [args.projectRoot] - Project root directory.
 * @param {Object} log - Logger object
 * @param {Object} context - Context object containing session
 * @param {Object} [context.session] - MCP Session object
 * @returns {Promise<Object>} - Task expansion result { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function expandTaskDirect(args, log, context = {}) {
	const { session } = context; // Extract session
	// Destructure expected args, including projectRoot
	const { tasksJsonPath, id, num, research, prompt, force, projectRoot } = args;

	// Log session root data for debugging
	log.info(
		`Session data in expandTaskDirect: ${JSON.stringify({
			hasSession: !!session,
			sessionKeys: session ? Object.keys(session) : [],
			roots: session?.roots,
			rootsStr: JSON.stringify(session?.roots)
		})}`
	);

	// Check if tasksJsonPath was provided
	if (!tasksJsonPath) {
		log.error('expandTaskDirect called without tasksJsonPath');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'tasksJsonPath is required'
			}
		};
	}

	// Use provided path
	const tasksPath = tasksJsonPath;

	log.info(`[expandTaskDirect] Using tasksPath: ${tasksPath}`);

	// Validate task ID
	const taskId = id ? parseInt(id, 10) : null;
	if (!taskId) {
		log.error('Task ID is required');
		return {
			success: false,
			error: {
				code: 'INPUT_VALIDATION_ERROR',
				message: 'Task ID is required'
			}
		};
	}

	// Process other parameters
	const numSubtasks = num ? parseInt(num, 10) : undefined;
	const useResearch = research === true;
	const additionalContext = prompt || '';
	const forceFlag = force === true;

	try {
		log.info(
			`[expandTaskDirect] Expanding task ${taskId} into ${numSubtasks || 'default'} subtasks. Research: ${useResearch}, Force: ${forceFlag}`
		);

		// Read tasks data
		log.info(`[expandTaskDirect] Attempting to read JSON from: ${tasksPath}`);
		const data = readJSON(tasksPath, projectRoot);
		log.info(
			`[expandTaskDirect] Result of readJSON: ${data ? 'Data read successfully' : 'readJSON returned null or undefined'}`
		);

		if (!data || !data.tasks) {
			log.error(
				`[expandTaskDirect] readJSON failed or returned invalid data for path: ${tasksPath}`
			);
			return {
				success: false,
				error: {
					code: 'INVALID_TASKS_FILE',
					message: `No valid tasks found in ${tasksPath}. readJSON returned: ${JSON.stringify(data)}`
				}
			};
		}

		// Find the specific task
		log.info(`[expandTaskDirect] Searching for task ID ${taskId} in data`);
		const task = data.tasks.find((t) => t.id === taskId);
		log.info(`[expandTaskDirect] Task found: ${task ? 'Yes' : 'No'}`);

		if (!task) {
			return {
				success: false,
				error: {
					code: 'TASK_NOT_FOUND',
					message: `Task with ID ${taskId} not found`
				}
			};
		}

		// Check if task is completed
		if (task.status === 'done' || task.status === 'completed') {
			return {
				success: false,
				error: {
					code: 'TASK_COMPLETED',
					message: `Task ${taskId} is already marked as ${task.status} and cannot be expanded`
				}
			};
		}

		// Check for existing subtasks and force flag
		const hasExistingSubtasks = task.subtasks && task.subtasks.length > 0;
		if (hasExistingSubtasks && !forceFlag) {
			log.info(
				`Task ${taskId} already has ${task.subtasks.length} subtasks. Use --force to overwrite.`
			);
			return {
				success: true,
				data: {
					message: `Task ${taskId} already has subtasks. Expansion skipped.`,
					task,
					subtasksAdded: 0,
					hasExistingSubtasks
				}
			};
		}

		// If force flag is set, clear existing subtasks
		if (hasExistingSubtasks && forceFlag) {
			log.info(
				`Force flag set. Clearing existing subtasks for task ${taskId}.`
			);
			task.subtasks = [];
		}

		// Keep a copy of the task before modification
		const originalTask = JSON.parse(JSON.stringify(task));

		// Tracking subtasks count before expansion
		const subtasksCountBefore = task.subtasks ? task.subtasks.length : 0;

		// Directly modify the data instead of calling the CLI function
		if (!task.subtasks) {
			task.subtasks = [];
		}

		// Save tasks.json with potentially empty subtasks array
		writeJSON(tasksPath, data);

		// Create logger wrapper using the utility
		const mcpLog = createLogWrapper(log);

		let wasSilent; // Declare wasSilent outside the try block
		// Process the request
		try {
			// Enable silent mode to prevent console logs from interfering with JSON response
			wasSilent = isSilentMode(); // Assign inside the try block
			if (!wasSilent) enableSilentMode();

			// Call the core expandTask function with the wrapped logger and projectRoot
			const coreResult = await expandTask(
				tasksPath,
				taskId,
				numSubtasks,
				useResearch,
				additionalContext,
				{
					mcpLog,
					session,
					projectRoot,
					commandName: 'expand-task',
					outputType: 'mcp'
				},
				forceFlag
			);

			// Restore normal logging
			if (!wasSilent && isSilentMode()) disableSilentMode();

			// Read the updated data
			const updatedData = readJSON(tasksPath, projectRoot);
			const updatedTask = updatedData.tasks.find((t) => t.id === taskId);

			// Calculate how many subtasks were added
			const subtasksAdded = updatedTask.subtasks
				? updatedTask.subtasks.length - subtasksCountBefore
				: 0;

			// Return the result, including telemetryData
			log.info(
				`Successfully expanded task ${taskId} with ${subtasksAdded} new subtasks`
			);
			return {
				success: true,
				data: {
					task: coreResult.task,
					subtasksAdded,
					hasExistingSubtasks,
					telemetryData: coreResult.telemetryData,
					tagInfo: coreResult.tagInfo
				}
			};
		} catch (error) {
			// Make sure to restore normal logging even if there's an error
			if (!wasSilent && isSilentMode()) disableSilentMode();

			log.error(`Error expanding task: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'CORE_FUNCTION_ERROR',
					message: error.message || 'Failed to expand task'
				}
			};
		}
	} catch (error) {
		log.error(`Error expanding task: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CORE_FUNCTION_ERROR',
				message: error.message || 'Failed to expand task'
			}
		};
	}
}
