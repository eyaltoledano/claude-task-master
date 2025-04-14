/**
 * update-task-by-id.js
 * Direct function implementation for updating a single task by ID with new information
 */

import { updateTaskById } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import {
	getAnthropicClientForMCP,
	getPerplexityClientForMCP
} from '../utils/ai-client-utils.js';

/**
 * Direct function wrapper for updateTaskById with error handling.
 *
 * @param {Object} args - Command arguments containing id, prompt, useResearch and tasksJsonPath.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateTaskByIdDirect(args, log, context = {}) {
	const { session } = context; // Only extract session, not reportProgress
	// Destructure expected args, including the resolved tasksJsonPath
	const { tasksJsonPath, id, prompt, research } = args;

	try {
		log.info(`Updating task with args: ${JSON.stringify(args)}`);

		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			const errorMessage = 'tasksJsonPath is required but was not provided.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_ARGUMENT', message: errorMessage },
				fromCache: false
			};
		}

		// Check required parameters (id and prompt)
		if (!id) {
			const errorMessage =
				'No task ID specified. Please provide a task ID to update.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_TASK_ID', message: errorMessage },
				fromCache: false
			};
		}

		if (!prompt) {
			const errorMessage =
				'No prompt specified. Please provide a prompt with new information for the task update.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_PROMPT', message: errorMessage },
				fromCache: false
			};
		}

		// Parse taskId - handle both string and number values
		let taskId;
		if (typeof id === 'string') {
			// Handle subtask IDs (e.g., "5.2")
			if (id.includes('.')) {
				taskId = id; // Keep as string for subtask IDs
			} else {
				// Parse as integer for main task IDs
				taskId = parseInt(id, 10);
				if (isNaN(taskId)) {
					const errorMessage = `Invalid task ID: ${id}. Task ID must be a positive integer or subtask ID (e.g., "5.2").`;
					log.error(errorMessage);
					return {
						success: false,
						error: { code: 'INVALID_TASK_ID', message: errorMessage },
						fromCache: false
					};
				}
			}
		} else {
			taskId = id;
		}

		// Use the provided path
		const tasksPath = tasksJsonPath;

		// Get research flag
		const useResearch = research === true;

		// Initialize appropriate AI client based on research flag
		let aiClient;
		try {
			if (useResearch) {
				log.info('Using Perplexity AI for research-backed task update');
				aiClient = await getPerplexityClientForMCP(session, log);
			} else {
				log.info('Using Claude AI for task update');
				aiClient = getAnthropicClientForMCP(session, log);
			}
		} catch (error) {
			log.error(`Failed to initialize AI client: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'AI_CLIENT_ERROR',
					message: `Cannot initialize AI client: ${error.message}`
				},
				fromCache: false
			};
		}

		log.info(
			`Updating task with ID ${taskId} with prompt "${prompt}" and research: ${useResearch}`
		);

		try {
			// Enable silent mode to prevent console logs from interfering with JSON response
			enableSilentMode();

			// Create a logger wrapper that matches what updateTaskById expects
			const logWrapper = {
				info: (message) => log.info(message),
				warn: (message) => log.warn(message),
				error: (message) => log.error(message),
				debug: (message) => log.debug && log.debug(message),
				success: (message) => log.info(message) // Map success to info since many loggers don't have success
			};

			// Execute core updateTaskById function with proper parameters
			await updateTaskById(
				tasksPath,
				taskId,
				prompt,
				useResearch,
				{
					mcpLog: logWrapper, // Use our wrapper object that has the expected method structure
					session
				},
				'json'
			);

			// Since updateTaskById doesn't return a value but modifies the tasks file,
			// we'll return a success message
			return {
				success: true,
				data: {
					message: `Successfully updated task with ID ${taskId} based on the prompt`,
					taskId,
					tasksPath: tasksPath, // Return the used path
					useResearch
				},
				fromCache: false // This operation always modifies state and should never be cached
			};
		} catch (error) {
			log.error(`Error updating task by ID: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'UPDATE_TASK_ERROR',
					message: error.message || 'Unknown error updating task'
				},
				fromCache: false
			};
		} finally {
			// Make sure to restore normal logging even if there's an error
			disableSilentMode();
		}
	} catch (error) {
		// Ensure silent mode is disabled
		disableSilentMode();

		log.error(`Error updating task by ID: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'UPDATE_TASK_ERROR',
				message: error.message || 'Unknown error updating task'
			},
			fromCache: false
		};
	}
}
