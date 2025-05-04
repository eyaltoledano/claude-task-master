/**
 * update-tasks.js
 * Direct function implementation for updating tasks based on new context
 */

import path from 'path';
import { updateTasks } from '../../../../scripts/modules/task-manager.js';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for updating tasks based on new context.
 *
 * @param {Object} args - Command arguments containing projectRoot, from, prompt, research options.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateTasksDirect(args, log, context = {}) {
	const { session } = context;
	const { from, prompt, research, file: fileArg, projectRoot } = args;

	// Create the standard logger wrapper
	const logWrapper = createLogWrapper(log);

	// --- Input Validation ---
	if (!projectRoot) {
		logWrapper.error('updateTasksDirect requires a projectRoot argument.');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'projectRoot is required.'
			}
		};
	}

	if (!from) {
		logWrapper.error('updateTasksDirect called without from ID');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'Starting task ID (from) is required'
			}
		};
	}

	if (!prompt) {
		logWrapper.error('updateTasksDirect called without prompt');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'Update prompt is required'
			}
		};
	}

	// Resolve tasks file path
	const tasksFile = fileArg
		? path.resolve(projectRoot, fileArg)
		: path.resolve(projectRoot, 'tasks', 'tasks.json');

	logWrapper.info(
		`Updating tasks via direct function. From: ${from}, Research: ${research}, File: ${tasksFile}, ProjectRoot: ${projectRoot}`
	);

	enableSilentMode(); // Enable silent mode
	try {
		// Call the core updateTasks function
		const result = await updateTasks(
			tasksFile,
			from,
			prompt,
			research,
			{
				session,
				mcpLog: logWrapper,
				projectRoot
			},
			'json'
		);

		// updateTasks returns { success: true, updatedTasks: [...] } on success
		if (result && result.success && Array.isArray(result.updatedTasks)) {
			logWrapper.success(
				`Successfully updated ${result.updatedTasks.length} tasks.`
			);
			return {
				success: true,
				data: {
					message: `Successfully updated ${result.updatedTasks.length} tasks.`,
					tasksFile,
					updatedCount: result.updatedTasks.length
				}
			};
		} else {
			// Handle case where core function didn't return expected success structure
			logWrapper.error(
				'Core updateTasks function did not return a successful structure.'
			);
			return {
				success: false,
				error: {
					code: 'CORE_FUNCTION_ERROR',
					message:
						result?.message ||
						'Core function failed to update tasks or returned unexpected result.'
				}
			};
		}
	} catch (error) {
		logWrapper.error(`Error executing core updateTasks: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'UPDATE_TASKS_CORE_ERROR',
				message: error.message || 'Unknown error updating tasks'
			}
		};
	} finally {
		disableSilentMode(); // Ensure silent mode is disabled
	}
}
