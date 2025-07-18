/**
 * update-tasks.js
 * Direct function implementation for updating tasks based on new context
 */

import path from 'path';
import { updateTasks } from '../../../../scripts/modules/task-manager.js';
import { createLogWrapper } from '../../tools/utils.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for updating tasks based on new context.
 *
 * @param {Object} taskMaster - TaskMaster instance with path resolution
 * @param {Object} args - Command arguments containing from, prompt, and research options. Project root is accessed via the taskMaster instance.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateTasksDirect(taskMaster, args, log, context = {}) {
	const { session } = context;
	const { from, prompt, research, tag } = args;

	// Create the standard logger wrapper
	const logWrapper = createLogWrapper(log);

	// --- Input Validation ---

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

	logWrapper.info(
		`Updating tasks via direct function. From: ${from}, Research: ${research}, File: ${taskMaster.getTasksPath()}, ProjectRoot: ${taskMaster.getProjectRoot()}`
	);

	enableSilentMode(); // Enable silent mode
	try {
		// Call the core updateTasks function
		const result = await updateTasks(
			taskMaster.getTasksPath(),
			from,
			prompt,
			research,
			{
				session,
				mcpLog: logWrapper,
				projectRoot: taskMaster.getProjectRoot(),
				tag
			},
			'json'
		);

		if (result && result.success && Array.isArray(result.updatedTasks)) {
			logWrapper.success(
				`Successfully updated ${result.updatedTasks.length} tasks.`
			);
			return {
				success: true,
				data: {
					message: `Successfully updated ${result.updatedTasks.length} tasks.`,
					tasksPath: taskMaster.getTasksPath(),
					updatedCount: result.updatedTasks.length,
					telemetryData: result.telemetryData,
					tagInfo: result.tagInfo
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
