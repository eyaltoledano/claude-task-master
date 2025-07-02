/**
 * list-tasks.js
 * Direct function implementation for listing tasks
 */

import { listTasks } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for listTasks with error handling and caching.
 *
 * @param {Object} args - Command arguments (now expecting tasksJsonPath explicitly).
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Task list result { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function listTasksDirect(args, log, context = {}) {
	// Destructure the explicit tasksJsonPath from args
	const { tasksJsonPath, reportPath, status, withSubtasks, projectRoot } = args;
	const { session } = context;

	if (!tasksJsonPath) {
		log.error('listTasksDirect called without tasksJsonPath');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'tasksJsonPath is required'
			}
		};
	}

	// Use the explicit tasksJsonPath for cache key
	const statusFilter = status || 'all';
	const withSubtasksFilter = withSubtasks || false;

	// Define the action function to be executed on cache miss
	const coreListTasksAction = async () => {
		try {
			// Enable silent mode to prevent console logs from interfering with JSON response
			enableSilentMode();

			log.info(
				`Executing core listTasks function for path: ${tasksJsonPath}, filter: ${statusFilter}, subtasks: ${withSubtasksFilter}`
			);
			// Pass the explicit tasksJsonPath to the core function
			const resultData = listTasks(
				tasksJsonPath,
				statusFilter,
				reportPath,
				withSubtasksFilter,
				'json',
				null, // tag
				{ projectRoot, session } // context
			);

			if (!resultData || !resultData.tasks) {
				log.error('Invalid or empty response from listTasks core function');
				return {
					success: false,
					error: {
						code: 'INVALID_CORE_RESPONSE',
						message: 'Invalid or empty response from listTasks core function'
					}
				};
			}

			log.info(
				`Core listTasks function retrieved ${resultData.tasks.length} tasks`
			);

			// Restore normal logging
			disableSilentMode();

			return { success: true, data: resultData };
		} catch (error) {
			// Make sure to restore normal logging even if there's an error
			disableSilentMode();

			log.error(`Core listTasks function failed: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'LIST_TASKS_CORE_ERROR',
					message: error.message || 'Failed to list tasks'
				}
			};
		}
	};

	try {
		const result = await coreListTasksAction();
		log.info('listTasksDirect completed');
		return result;
	} catch (error) {
		log.error(`Unexpected error during listTasks: ${error.message}`);
		console.error(error.stack);
		return {
			success: false,
			error: {
				code: 'UNEXPECTED_ERROR',
				message: error.message
			}
		};
	}
}
