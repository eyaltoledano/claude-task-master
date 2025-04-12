/**
 * show-task.js
 * Direct function implementation for showing task details using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js'; // Use the factory
import { getCachedOrExecute } from '../../tools/utils.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for showing task details via configured provider.
 *
 * @param {Object} args - Command arguments (id, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Task details result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }.
 */
export async function showTaskDirect(args, log, context = {}) {
	const { projectRoot, id: taskId, file } = args; // Added file
	const { session } = context;

	if (!projectRoot) {
		log.warn('showTaskDirect called without projectRoot, cache key might be less specific.');
	}
	if (!taskId) {
		log.error('Task ID/Key is required');
		return {
			success: false,
			error: { code: 'MISSING_ARGUMENT', message: 'Task ID/Key (id) is required' },
			fromCache: false
		};
	}

	// Provider type determined within getTaskProvider
	const providerType = process.env.TASK_PROVIDER || 'local';

	// Create logger wrapper for core function
	const logWrapper = {
		info: (message, ...rest) => log.info(message, ...rest),
		warn: (message, ...rest) => log.warn(message, ...rest),
		error: (message, ...rest) => log.error(message, ...rest),
		debug: (message, ...rest) => log.debug && log.debug(message, ...rest),
		success: (message, ...rest) => log.info(message, ...rest)
	};

	// Update cache key
	const cacheKey = `getTask:${projectRoot || 'unknown'}:${providerType}:${file || 'default'}:${taskId}`;

	// Define the action function to call the PROVIDER's getTask method
	const providerGetTaskAction = async () => {
		let resultData;
		try {
			enableSilentMode(); // Consider removing

			const provider = await getTaskProvider();
			const providerOptions = { file, mcpLog: logWrapper, session };

			log.info(`Calling provider.getTask for ID: ${taskId} via ${providerType} provider`);

			// Call the provider's getTask method
			// Assuming signature: getTask(taskId, options)
			resultData = await provider.getTask(taskId, providerOptions);

			if (!resultData) {
				log.warn(`Provider ${providerType} did not find task ${taskId}`);
				return {
					success: false,
					error: { code: 'TASK_NOT_FOUND', message: `Task with ID/Key ${taskId} not found via ${providerType} provider.` }
				};
			}

			log.info(`Provider ${providerType} retrieved task ${taskId}`);
			disableSilentMode();

			// Return the task object found by the provider
			return { success: true, data: { task: resultData } }; // Wrap result in { data: { task: ... } }

		} catch (error) {
			disableSilentMode(); // Ensure disable on error
			log.error(`Error calling provider getTask for ID ${taskId}: ${error.message}`);
			console.error(error.stack);
			const errorCode = (error.message && error.message.toLowerCase().includes('not found')) ? 'TASK_NOT_FOUND' : 'PROVIDER_GET_TASK_ERROR';
			return {
				success: false,
				error: {
					code: errorCode,
					message: error.message || `Failed to get task ${taskId}`
				}
			};
		} finally {
			disableSilentMode();
		}
	};

	// Use the caching utility
	try {
		const result = await getCachedOrExecute({
			cacheKey,
			actionFn: providerGetTaskAction, // Use the new action
			log
		});
		log.info(`showTaskDirect completed for ${taskId}. From cache: ${result.fromCache}`);
		return result;
	} catch (error) {
		disableSilentMode(); // Ensure disabled on unexpected cache util error
		log.error(
			`Unexpected error during getCachedOrExecute for showTask: ${error.message}`
		);
		console.error(error.stack);
		return {
			success: false,
			error: { code: 'CACHE_UTIL_ERROR', message: error.message },
			fromCache: false
		};
	}
}
