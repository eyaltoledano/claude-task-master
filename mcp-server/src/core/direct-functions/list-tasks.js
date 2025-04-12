/**
 * list-tasks.js
 * Direct function implementation for listing tasks using appropriate provider.
 */

import path from 'path';
import { findTasksJsonPath } from '../utils/path-utils.js';
import { getCachedOrExecute } from '../../tools/utils.js';
// Import the Task Provider Factory
import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
// Utilities for silent mode are likely not needed here anymore if provider handles logging
// import { enableSilentMode, disableSilentMode } from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for listing tasks via the configured provider.
 * Handles caching and provider instantiation.
 * @param {object} args - Arguments containing options like status, withSubtasks, file, projectRoot.
 * @param {object} log - Logger instance.
 * @param {object} [context={}] - Optional context, e.g., { session }.
 * @returns {Promise<object>} - Result object { success, data/error, fromCache }.
 */
export async function listTasksDirect(args, log, context = {}) {
	const { session } = context;
	const { status, withSubtasks, file, projectRoot } = args;

	// Determine provider type for logging/debugging
	const providerType = process.env.TASK_PROVIDER || 'local';

	// Update cache key to include provider type and relevant filters
	const statusFilter = status || 'all';
	const withSubtasksFilter = withSubtasks || false;
	const cacheKey = `getTasks:${projectRoot || 'unknown'}:${providerType}:${file || 'default'}:${statusFilter}:${withSubtasksFilter}`;
	const ttl = 30000; // Cache for 30 seconds

	// Define the action function to call the PROVIDER's getTasks method
	const providerGetTasksAction = async () => {
		try {
			// Get the configured task provider, passing necessary context (e.g., Jira tools)
			// Assuming MCP context/tools are implicitly available or passed via options if needed by factory
			const provider = await getTaskProvider({ /* Pass MCP Jira tools if needed */ });

			// Prepare options for the provider's getTasks method
			const providerOptions = {
				status: status, // Pass original status filter
				withSubtasks: withSubtasks,
				file: file, // Pass file hint if applicable
				projectRoot: projectRoot, // Pass project root
				// Pass logger and session if the provider method expects them
				// mcpLog: log, 
				// session: session 
			};

			log.info(
				`Calling ${providerType} provider.getTasks. Options: ${JSON.stringify(providerOptions)}`
			);

			// Call the provider's getTasks method
			const resultData = await provider.getTasks(providerOptions);

			// Provider should return { tasks: [...] } or similar standard structure
			if (!resultData || !Array.isArray(resultData.tasks)) { 
				log.error('Invalid or empty response structure from provider.getTasks', resultData);
				return {
					success: false,
					error: {
						code: 'INVALID_PROVIDER_RESPONSE',
						message: 'Invalid response structure from provider. Expected { tasks: [...] }.'
					}
				};
			}
			log.info(
				`Provider ${providerType} retrieved ${resultData.tasks.length} tasks`
			);

			return { success: true, data: resultData.tasks }; // Return just the tasks array

		} catch (error) {
			log.error(`Provider getTasks function failed: ${error.message}`);
			console.error(error.stack); // Log stack for debugging server-side
			return {
				success: false,
				error: {
					code: 'PROVIDER_GET_TASKS_ERROR',
					message: error.message || 'Provider failed to get tasks'
				}
			};
		}
	};

	// Use the caching utility
	try {
		// Pass the log object to getCachedOrExecute
		const result = await getCachedOrExecute(cacheKey, ttl, providerGetTasksAction, log);
		log.info(`listTasksDirect completed. From cache: ${result.fromCache}`);
		return result;
	} catch (error) {
		log.error(
			`Unexpected error during getCachedOrExecute for listTasks: ${error.message}`
		);
		console.error(error.stack);
		return {
			success: false,
			error: { code: 'CACHE_UTIL_ERROR', message: error.message },
			fromCache: false // Ensure fromCache is always present
		};
	}
}
