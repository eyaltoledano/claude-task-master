/**
 * update-tasks.js
 * Direct function implementation for updating tasks based on new context/prompt using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js'; // Use the factory
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for updating tasks based on new context/prompt via configured provider.
 *
 * @param {Object} args - Command arguments (from, prompt, research, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }.
 */
export async function updateTasksDirect(args, log, context = {}) {
	const { session } = context;
	// Include 'file' for local provider context
	const { projectRoot, from, prompt, research, file } = args;

	try {
		log.info(`Updating tasks with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			// Warn but don't fail, provider might not need it (e.g., Jira uses key)
			log.warn('updateTasksDirect called without projectRoot.');
		}
		// 'id' is deprecated, use 'from'
		if (args.id !== undefined && from === undefined) {
			return {
				success: false,
				error: { code: 'PARAMETER_MISMATCH', message: "Parameter 'from' is required, not 'id'." },
				fromCache: false
			};
		}
		if (!from) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Start task ID/Key (from) is required' }, fromCache: false };
		}
		if (!prompt) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Prompt (prompt) is required' }, fromCache: false };
		}
		const fromIdStr = String(from);
		// --- End Argument Validation ---

		// Provider type determined within getTaskProvider
		const useResearch = research === true;

		log.info(`Requesting provider to update tasks from ${fromIdStr} with prompt "${prompt}" and research: ${useResearch}`);

		// Create logger wrapper
		const logWrapper = {
			info: (message, ...args) => log.info(message, ...args),
			warn: (message, ...args) => log.warn(message, ...args),
			error: (message, ...args) => log.error(message, ...args),
			debug: (message, ...args) => log.debug && log.debug(message, ...args),
			success: (message, ...args) => log.info(message, ...args)
		};

		try {
			// Consider if silent mode is truly needed here if provider handles logging/output
			enableSilentMode(); 

			const provider = await getTaskProvider();
			const providerOptions = {
				file, // Pass file for local provider
				mcpLog: logWrapper,
				session
			};

			// Call the provider's updateTasks method
			// Assumes provider method signature: updateTasks(fromId, prompt, useResearch, options)
			const updateResult = await provider.updateTasks(
				fromIdStr,
				prompt,
				useResearch,
				providerOptions
			);

			disableSilentMode();

			// Check provider result structure
			if (updateResult && updateResult.success) {
				log.info(`Provider successfully updated tasks: ${updateResult.data?.message || 'Update process completed.'}`);
				return {
					success: true,
					data: updateResult.data || {
						message: `Task update process completed starting from ID ${fromIdStr}.`,
						fromId: fromIdStr
					},
					fromCache: false // State modification
				};
			} else {
				const errorMsg = updateResult?.error?.message || 'Provider failed to update tasks.';
				log.error(`Provider error updating tasks from ID ${fromIdStr}: ${errorMsg}`);
				return {
					success: false,
					error: updateResult?.error || { code: 'PROVIDER_ERROR', message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			// Ensure silent mode is disabled on error
			if (isSilentMode()) {
				disableSilentMode();
			}
			log.error(`Error calling provider updateTasks from ID ${fromIdStr}: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_UPDATE_ERROR',
					message: error.message || `Unknown error updating tasks from ${fromIdStr}`
				},
				fromCache: false
			};
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in updateTasksDirect: ${error.message}`);
		return {
			success: false,
			error: { code: 'DIRECT_FUNCTION_SETUP_ERROR', message: error.message },
			fromCache: false
		};
	}
}
