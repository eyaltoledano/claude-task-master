/**
 * update-subtask-by-id.js
 * Direct function implementation for appending information to a specific subtask
 */

import { updateSubtaskById } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import {
	getAnthropicClientForMCP,
	getPerplexityClientForMCP
} from '../utils/ai-client-utils.js';

/**
 * Direct function wrapper for updateSubtaskById with error handling.
 *
 * @param {Object} args - Command arguments containing id, prompt, useResearch and tasksJsonPath.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateSubtaskByIdDirect(args, log, context = {}) {
	const { session } = context; // Only extract session, not reportProgress
	const { tasksJsonPath, id, prompt, research } = args;

	try {
		log.info(`Updating subtask with args: ${JSON.stringify(args)}`);

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
				'No subtask ID specified. Please provide a subtask ID to update.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_SUBTASK_ID', message: errorMessage },
				fromCache: false
			};
		}

		if (!prompt) {
			const errorMessage =
				'No prompt specified. Please provide a prompt with information to add to the subtask.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_PROMPT', message: errorMessage },
				fromCache: false
			};
		}

		// Validate subtask ID format
		const subtaskId = id;
		if (typeof subtaskId !== 'string' && typeof subtaskId !== 'number') {
			const errorMessage = `Invalid subtask ID type: ${typeof subtaskId}. Subtask ID must be a string or number.`;
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'INVALID_SUBTASK_ID_TYPE', message: errorMessage },
				fromCache: false
			};
		}

		const subtaskIdStr = String(subtaskId);
		if (!subtaskIdStr.includes('.')) {
			const errorMessage = `Invalid subtask ID format: ${subtaskIdStr}. Subtask ID must be in format "parentId.subtaskId" (e.g., "5.2").`;
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'INVALID_SUBTASK_ID_FORMAT', message: errorMessage },
				fromCache: false
			};
		}

		// Use the provided path
		const tasksPath = tasksJsonPath;

		// Get research flag
		const useResearch = research === true;

		log.info(
			`Updating subtask with ID ${subtaskIdStr} with prompt "${prompt}" and research: ${useResearch}`
		);

		// Initialize the appropriate AI client based on research flag
		try {
			if (useResearch) {
				// Initialize Perplexity client
				await getPerplexityClientForMCP(session);
			} else {
				// Initialize Anthropic client
				await getAnthropicClientForMCP(session);
			}
		} catch (error) {
			log.error(`AI client initialization error: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'AI_CLIENT_ERROR',
					message: error.message || 'Failed to initialize AI client'
				},
				fromCache: false
			};
		}

		try {
			// Enable silent mode to prevent console logs from interfering with JSON response
			enableSilentMode();

			// Create a logger wrapper object to handle logging without breaking the mcpLog[level] calls
			// This ensures outputFormat is set to 'json' while still supporting proper logging
			const logWrapper = {
				info: (message) => log.info(message),
				warn: (message) => log.warn(message),
				error: (message) => log.error(message),
				debug: (message) => log.debug && log.debug(message),
				success: (message) => log.info(message) // Map success to info if needed
			};

			// Execute core updateSubtaskById function
			// Pass both session and logWrapper as mcpLog to ensure outputFormat is 'json'
			const updatedSubtask = await updateSubtaskById(
				tasksPath,
				subtaskIdStr,
				prompt,
				useResearch,
				{
					session,
					mcpLog: logWrapper
				}
			);

			// Restore normal logging
			disableSilentMode();

			// Handle the case where the subtask couldn't be updated (e.g., already marked as done)
			if (!updatedSubtask) {
				return {
					success: false,
					error: {
						code: 'SUBTASK_UPDATE_FAILED',
						message:
							'Failed to update subtask. It may be marked as completed, or another error occurred.'
					},
					fromCache: false
				};
			}

			// Return the updated subtask information
			return {
				success: true,
				data: {
					message: `Successfully updated subtask with ID ${subtaskIdStr}`,
					subtaskId: subtaskIdStr,
					parentId: subtaskIdStr.split('.')[0],
					subtask: updatedSubtask,
					tasksPath,
					useResearch
				},
				fromCache: false // This operation always modifies state and should never be cached
			};
		} catch (error) {
			// Make sure to restore normal logging even if there's an error
			disableSilentMode();
			throw error; // Rethrow to be caught by outer catch block
		}
	} catch (error) {
		// Ensure silent mode is disabled
		disableSilentMode();

		log.error(`Error updating subtask by ID: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'UPDATE_SUBTASK_ERROR',
				message: error.message || 'Unknown error updating subtask'
			},
			fromCache: false
		};
	}
}
