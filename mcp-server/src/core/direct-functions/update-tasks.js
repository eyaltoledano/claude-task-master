/**
 * update-tasks.js
 * Direct function implementation for updating tasks based on new context/prompt
 */

import { updateTasks } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for updating tasks based on new context/prompt.
 *
 * @param {Object} args - Command arguments containing from, prompt, research and tasksJsonPath.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateTasksDirect(args, log, context = {}) {
	const { session } = context; // Extract session
	const { tasksJsonPath, from, prompt, research } = args;

	// Create the standard logger wrapper
	const logWrapper = {
		info: (message, ...args) => log.info(message, ...args),
		warn: (message, ...args) => log.warn(message, ...args),
		error: (message, ...args) => log.error(message, ...args),
		debug: (message, ...args) => log.debug && log.debug(message, ...args),
		success: (message, ...args) => log.info(message, ...args)
	};

	// --- Input Validation (Keep existing checks) ---
	if (!tasksJsonPath) {
		log.error('updateTasksDirect called without tasksJsonPath');
		return {
			success: false,
			error: { code: 'MISSING_ARGUMENT', message: 'tasksJsonPath is required' },
			fromCache: false
		};
	}
	if (args.id !== undefined && from === undefined) {
		// Keep 'from' vs 'id' check
		const errorMessage =
			"Use 'from' parameter, not 'id', or use 'update_task' tool.";
		log.error(errorMessage);
		return {
			success: false,
			error: { code: 'PARAMETER_MISMATCH', message: errorMessage },
			fromCache: false
		};
	}
	if (!from) {
		log.error('Missing from ID.');
		return {
			success: false,
			error: { code: 'MISSING_FROM_ID', message: 'No from ID specified.' },
			fromCache: false
		};
	}
	if (!prompt) {
		log.error('Missing prompt.');
		return {
			success: false,
			error: { code: 'MISSING_PROMPT', message: 'No prompt specified.' },
			fromCache: false
		};
	}
	let fromId;
	try {
		fromId = parseInt(from, 10);
		if (isNaN(fromId) || fromId <= 0) throw new Error();
	} catch {
		log.error(`Invalid from ID: ${from}`);
		return {
			success: false,
			error: {
				code: 'INVALID_FROM_ID',
				message: `Invalid from ID: ${from}. Must be a positive integer.`
			},
			fromCache: false
		};
	}
	const useResearch = research === true;
	// --- End Input Validation ---

	log.info(`Updating tasks from ID ${fromId}. Research: ${useResearch}`);

	enableSilentMode(); // Enable silent mode
	try {
		// Create logger wrapper using the utility
		const mcpLog = createLogWrapper(log);

		// Execute core updateTasks function, passing session context
		await updateTasks(
			tasksJsonPath,
			fromId,
			prompt,
			useResearch,
			// Pass context with logger wrapper and session
			{ mcpLog, session },
			'json' // Explicitly request JSON format for MCP
		);

		// Since updateTasks modifies file and doesn't return data, create success message
		return {
			success: true,
			data: {
				message: `Successfully initiated update for tasks from ID ${fromId} based on the prompt.`,
				fromId,
				tasksPath: tasksJsonPath,
				useResearch
			},
			fromCache: false // Modifies state
		};
	} catch (error) {
		log.error(`Error executing core updateTasks: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'UPDATE_TASKS_CORE_ERROR',
				message: error.message || 'Unknown error updating tasks'
			},
			fromCache: false
		};
	} finally {
		disableSilentMode(); // Ensure silent mode is disabled
	}
}
