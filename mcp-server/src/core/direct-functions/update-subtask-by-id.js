/**
 * update-subtask-by-id.js
 * Direct function implementation for appending information to a specific subtask using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js'; // Use the factory
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for updateSubtaskById via configured provider.
 *
 * @param {Object} args - Command arguments (id, prompt, research, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }.
 */
export async function updateSubtaskByIdDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id, prompt, research, file } = args; // Added file

	try {
		log.info(`Updating subtask with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			// Warn but don't fail
			log.warn('updateSubtaskByIdDirect called without projectRoot.');
		}
		if (!id) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Subtask ID/Key (id) is required' }, fromCache: false };
		}
		if (!prompt) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Prompt (prompt) is required' }, fromCache: false };
		}
		const subtaskIdStr = String(id);
		// Validation for local provider (dot notation) is handled within LocalTaskManager now.
		// Validation for Jira key format could be added here or in JiraTaskManager if needed.
		// --- End Argument Validation ---

		// Determine provider type implicitly via getTaskProvider
		const useResearch = research === true;

		log.info(`Requesting provider to update subtask ${subtaskIdStr} with prompt "${prompt}" and research: ${useResearch}`);

		try {
			enableSilentMode(); // Consider removing if provider handles output format

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

			// Call the provider's updateSubtask method
			// Assuming signature: updateSubtask(subtaskId, { prompt, useResearch }, options)
			const updateData = { prompt, useResearch }; // Encapsulate update payload
			const updateResult = await provider.updateSubtask(
				subtaskIdStr,
				updateData,
				providerOptions
			);

			disableSilentMode();

			// Check provider result structure
			if (updateResult && updateResult.success && updateResult.data?.subtask) {
				log.info(`Provider successfully updated subtask ${subtaskIdStr}`);
				return {
					success: true,
					data: updateResult.data, // Pass through provider's data
					fromCache: false // State modification
				};
			} else {
				const errorMsg = updateResult?.error?.message || 'Provider failed to update subtask.';
				const errorCode = updateResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error updating subtask by ID ${subtaskIdStr}: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: updateResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error calling provider updateSubtask for ID ${subtaskIdStr}: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_UPDATE_SUBTASK_ERROR',
					message: error.message || `Unknown error updating subtask ${subtaskIdStr}`
				},
				fromCache: false
			};
		} finally {
			if (isSilentMode()) {
				disableSilentMode();
			}
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in updateSubtaskByIdDirect: ${error.message}`);
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
