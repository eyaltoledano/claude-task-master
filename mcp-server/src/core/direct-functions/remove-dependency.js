/**
 * Direct function wrapper for removeDependency
 */

import { removeDependency } from '../../../../scripts/modules/dependency-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for removeDependency with error handling.
 *
 * @param {Object} taskMaster - TaskMaster instance with path resolution
 * @param {Object} args - Command arguments
 * @param {string|number} args.id - Task ID to remove dependency from
 * @param {string|number} args.dependsOn - Task ID to remove as a dependency
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Result object with success status and data/error information
 */
export async function removeDependencyDirect(taskMaster, args, log) {
	// Destructure expected args
	const { id, dependsOn } = args;
	try {
		log.info(`Removing dependency with args: ${JSON.stringify(args)}`);

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

		// Call the core function using the provided path
		await removeDependency(taskMaster.getTasksPath(), taskId, dependencyId);

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
