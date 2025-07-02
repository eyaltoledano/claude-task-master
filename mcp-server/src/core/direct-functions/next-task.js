/**
 * next-task.js
 * Direct function implementation for finding the next task to work on
 */

import { findNextTask } from '../../../../scripts/modules/task-manager.js';
import {
	readJSON,
	readComplexityReport
} from '../../../../scripts/modules/utils.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for finding the next task to work on with error handling and caching.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Next task result { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function nextTaskDirect(args, log, context = {}) {
	// Destructure expected args
	const { tasksJsonPath, reportPath, projectRoot } = args;
	const { session } = context;

	if (!tasksJsonPath) {
		log.error('nextTaskDirect called without tasksJsonPath');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'tasksJsonPath is required'
			}
		};
	}

	// Define the action function to be executed on cache miss
	const coreNextTaskAction = async () => {
		try {
			// Enable silent mode to prevent console logs from interfering with JSON response
			enableSilentMode();

			log.info(`Finding next task from ${tasksJsonPath}`);

			// Read tasks data using the provided path
			const data = readJSON(tasksJsonPath, projectRoot);
			if (!data || !data.tasks) {
				disableSilentMode(); // Disable before return
				return {
					success: false,
					error: {
						code: 'INVALID_TASKS_FILE',
						message: `No valid tasks found in ${tasksJsonPath}`
					}
				};
			}

			// Read the complexity report
			const complexityReport = readComplexityReport(reportPath);

			// Find the next task
			const nextTask = findNextTask(data.tasks, complexityReport);

			if (!nextTask) {
				log.info(
					'No eligible next task found. All tasks are either completed or have unsatisfied dependencies'
				);
				return {
					success: true,
					data: {
						message:
							'No eligible next task found. All tasks are either completed or have unsatisfied dependencies',
						nextTask: null
					}
				};
			}

			// Check if it's a subtask
			const isSubtask =
				typeof nextTask.id === 'string' && nextTask.id.includes('.');

			const taskOrSubtask = isSubtask ? 'subtask' : 'task';

			const additionalAdvice = isSubtask
				? 'Subtasks can be updated with timestamped details as you implement them. This is useful for tracking progress, marking milestones and insights (of successful or successive falures in attempting to implement the subtask). Research can be used when updating the subtask to collect up-to-date information, and can be helpful to solve a repeating problem the agent is unable to solve. It is a good idea to get-task the parent task to collect the overall context of the task, and to get-task the subtask to collect the specific details of the subtask.'
				: 'Tasks can be updated to reflect a change in the direction of the task, or to reformulate the task per your prompt. Research can be used when updating the task to collect up-to-date information. It is best to update subtasks as you work on them, and to update the task for more high-level changes that may affect pending subtasks or the general direction of the task.';

			// Restore normal logging
			disableSilentMode();

			// Return the next task data with the full tasks array for reference
			log.info(
				`Successfully found next task ${nextTask.id}: ${nextTask.title}. Is subtask: ${isSubtask}`
			);
			return {
				success: true,
				data: {
					nextTask,
					isSubtask,
					nextSteps: `When ready to work on the ${taskOrSubtask}, use set-status to set the status to "in progress" ${additionalAdvice}`
				}
			};
		} catch (error) {
			// Make sure to restore normal logging even if there's an error
			disableSilentMode();

			log.error(`Error finding next task: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'CORE_FUNCTION_ERROR',
					message: error.message || 'Failed to find next task'
				}
			};
		}
	};

	// Use the caching utility
	try {
		const result = await coreNextTaskAction();
		log.info('nextTaskDirect completed.');
		return result;
	} catch (error) {
		log.error(`Unexpected error during nextTask: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'UNEXPECTED_ERROR',
				message: error.message
			}
		};
	}
}
