/**
 * update-task-by-id.js
 * Direct function implementation for updating a single task by ID using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js'; // Use the factory
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for updateTaskById via configured provider.
 *
 * @param {Object} args - Command arguments (id, prompt, research, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }.
 */
export async function updateTaskByIdDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id, prompt, research, file } = args; // Added file

	try {
		log.info(`Updating task by ID with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			// Warn but don't fail
			log.warn('updateTaskByIdDirect called without projectRoot.');
		}
		if (!id) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Task ID/Key (id) is required' }, fromCache: false };
		}
		if (!prompt) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Prompt (prompt) is required' }, fromCache: false };
		}
		// --- End Argument Validation ---

		// Provider type determined within getTaskProvider
		const useResearch = research === true;
		const taskId = String(id); // Keep ID as string for provider flexibility

		log.info(`Requesting provider to update task ${taskId} with prompt "${prompt}" and research: ${useResearch}`);

		try {
			enableSilentMode(); // Consider if needed if provider handles output format

			const logWrapper = {
				info: (message, ...rest) => log.info(message, ...rest),
				warn: (message, ...rest) => log.warn(message, ...rest),
				error: (message, ...rest) => log.error(message, ...rest),
				debug: (message, ...rest) => log.debug && log.debug(message, ...rest),
				success: (message, ...rest) => log.info(message, ...rest)
			};

			const provider = await getTaskProvider();
			const providerOptions = {
				file,
				mcpLog: logWrapper,
				session
			};

			// Call the provider's updateTask method
			// Assuming signature: updateTask(taskId, { prompt, useResearch }, options)
			// Or maybe: updateTask(taskId, prompt, useResearch, options) ?
			// Let's assume the core logic expects an update data object
			const updateData = { prompt, useResearch }; // Encapsulate update payload
			const updateResult = await provider.updateTask(
				taskId,
				updateData, // Pass update data as an object
				providerOptions
			);

			disableSilentMode();

			// Check provider result structure
			if (updateResult && updateResult.success && updateResult.data?.task) {
				log.info(`Provider successfully updated task ${taskId}`);
				return {
					success: true,
					data: updateResult.data, // Pass through provider's data (should contain updated task)
					fromCache: false // State modification
				};
			} else {
				const errorMsg = updateResult?.error?.message || 'Provider failed to update task.';
				log.error(`Provider error updating task by ID ${taskId}: ${errorMsg}`);
				return {
					success: false,
					error: updateResult?.error || { code: 'PROVIDER_ERROR', message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error calling provider updateTask for ID ${taskId}: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_UPDATE_TASK_ERROR',
					message: error.message || `Unknown error updating task ${taskId}`
				},
				fromCache: false
			};
		} finally {
			// Ensure disabled even if inner try/catch fails unexpectedly
			if(isSilentMode()) {
				disableSilentMode();
			}
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in updateTaskByIdDirect: ${error.message}`);
		if (isSilentMode()) {
			disableSilentMode();
		}
		return {
			success: false,
			error: { code: 'DIRECT_FUNCTION_SETUP_ERROR', message: error.message },
			fromCache: false
		};
	}
}
