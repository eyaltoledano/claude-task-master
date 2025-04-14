/**
 * add-dependency.js
 * Direct function implementation for adding a dependency to a task
 */

import { addDependency } from '../../../../scripts/modules/dependency-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for addDependency with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string|number} args.id - Task ID to add dependency to
 * @param {string|number} args.dependsOn - Task ID that will become a dependency
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Result object with success status and data/error information
 */
export async function addDependencyDirect(args, log) {
	// Destructure expected args
	const { tasksJsonPath, id, dependsOn } = args;
	try {
		log.info(`Adding dependency with args: ${JSON.stringify(args)}`);

		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('addDependencyDirect called without tasksJsonPath');
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}

		// Validate required parameters
		if (!id) {
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message: 'Task ID (id) is required'
				}
			};
		}

		if (!dependsOn) {
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message: 'Dependency ID (dependsOn) is required'
				}
			};
		}

		// Use provided path
		const tasksPath = tasksJsonPath;

		// Format IDs for the core function
		const taskId =
			id && id.includes && id.includes('.') ? id : parseInt(id, 10);
		const dependencyId =
			dependsOn && dependsOn.includes && dependsOn.includes('.')
				? dependsOn
				: parseInt(dependsOn, 10);

		log.info(
			`Adding dependency: task ${taskId} will depend on ${dependencyId}`
		);

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		// Call the core function using the provided path
		await addDependency(tasksPath, taskId, dependencyId);

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				message: `Successfully added dependency: Task ${taskId} now depends on ${dependencyId}`,
				taskId: taskId,
				dependencyId: dependencyId
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in addDependencyDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CORE_FUNCTION_ERROR',
				message: error.message
			}
		};
	}
}
