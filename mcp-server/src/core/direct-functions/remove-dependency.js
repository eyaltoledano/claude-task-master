/**
 * Direct function wrapper for removeDependency
 */

import { removeDependency } from '../../../../scripts/modules/dependency-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Remove a dependency from a task
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string|number} args.id - Task ID to remove dependency from
 * @param {string|number} args.dependsOn - Task ID to remove as a dependency
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function removeDependencyDirect(args, log) {
	// Destructure expected args
	const { tasksJsonPath, id, dependsOn } = args;
	try {
		log.info(`Removing dependency with args: ${JSON.stringify(args)}`);

		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('removeDependencyDirect called without tasksJsonPath');
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
			`Removing dependency: task ${taskId} no longer depends on ${dependencyId}`
		);

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		// Call the core function using the provided tasksPath
		await removeDependency(tasksPath, taskId, dependencyId);

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				message: `Successfully removed dependency: Task ${taskId} no longer depends on ${dependencyId}`,
				taskId: taskId,
				dependencyId: dependencyId
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in removeDependencyDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CORE_FUNCTION_ERROR',
				message: error.message
			}
		};
	}
}
