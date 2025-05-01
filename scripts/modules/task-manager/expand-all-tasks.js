import { log, readJSON, isSilentMode } from '../utils.js';
import { startLoadingIndicator, stopLoadingIndicator } from '../ui.js';
import expandTask from './expand-task.js';
import { getDebugFlag } from '../config-manager.js';

/**
 * Expand all eligible pending or in-progress tasks using the expandTask function.
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} [numSubtasks] - Optional: Target number of subtasks per task.
 * @param {boolean} [useResearch=false] - Whether to use the research AI role.
 * @param {string} [additionalContext=''] - Optional additional context.
 * @param {boolean} [force=false] - Force expansion even if tasks already have subtasks.
 * @param {Object} context - Context object containing session and mcpLog.
 * @param {Object} [context.session] - Session object from MCP.
 * @param {Object} [context.mcpLog] - MCP logger object.
 * @param {string} [outputFormat='text'] - Output format ('text' or 'json'). MCP calls should use 'json'.
 * @returns {Promise<{success: boolean, expandedCount: number, failedCount: number, skippedCount: number, tasksToExpand: number, message?: string}>} - Result summary.
 */
async function expandAllTasks(
	tasksPath,
	numSubtasks, // Keep this signature, expandTask handles defaults
	useResearch = false,
	additionalContext = '',
	force = false, // Keep force here for the filter logic
	context = {},
	outputFormat = 'text' // Assume text default for CLI
) {
	const { session, mcpLog } = context;
	const isMCPCall = !!mcpLog; // Determine if called from MCP

	// Use mcpLog if available, otherwise use the default console log wrapper respecting silent mode
	const logger =
		mcpLog ||
		(outputFormat === 'json'
			? {
					// Basic logger for JSON output mode
					info: (msg) => {},
					warn: (msg) => {},
					error: (msg) => console.error(`ERROR: ${msg}`), // Still log errors
					debug: (msg) => {}
				}
			: {
					// CLI logger respecting silent mode
					info: (msg) => !isSilentMode() && log('info', msg),
					warn: (msg) => !isSilentMode() && log('warn', msg),
					error: (msg) => !isSilentMode() && log('error', msg),
					debug: (msg) =>
						!isSilentMode() && getDebugFlag(session) && log('debug', msg)
				});

	let loadingIndicator = null;
	let expandedCount = 0;
	let failedCount = 0;
	// No skipped count needed now as the filter handles it upfront
	let tasksToExpandCount = 0; // Renamed for clarity

	if (!isMCPCall && outputFormat === 'text') {
		loadingIndicator = startLoadingIndicator(
			'Analyzing tasks for expansion...'
		);
	}

	try {
		logger.info(`Reading tasks from ${tasksPath}`);
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`Invalid tasks data in ${tasksPath}`);
		}

		// --- Restore Original Filtering Logic ---
		const tasksToExpand = data.tasks.filter(
			(task) =>
				(task.status === 'pending' || task.status === 'in-progress') && // Include 'in-progress'
				(!task.subtasks || task.subtasks.length === 0 || force) // Check subtasks/force here
		);
		tasksToExpandCount = tasksToExpand.length; // Get the count from the filtered array
		logger.info(`Found ${tasksToExpandCount} tasks eligible for expansion.`);
		// --- End Restored Filtering Logic ---

		if (loadingIndicator) {
			stopLoadingIndicator(loadingIndicator, 'Analysis complete.');
		}

		if (tasksToExpandCount === 0) {
			logger.info('No tasks eligible for expansion.');
			// --- Fix: Restore success: true and add message ---
			return {
				success: true, // Indicate overall success despite no action
				expandedCount: 0,
				failedCount: 0,
				skippedCount: 0,
				tasksToExpand: 0,
				message: 'No tasks eligible for expansion.'
			};
			// --- End Fix ---
		}

		// Iterate over the already filtered tasks
		for (const task of tasksToExpand) {
			// --- Remove Redundant Check ---
			// The check below is no longer needed as the initial filter handles it
			/*
			if (task.subtasks && task.subtasks.length > 0 && !force) {
				logger.info(
					`Skipping task ${task.id}: Already has subtasks. Use --force to overwrite.`
				);
				skippedCount++;
				continue;
			}
			*/
			// --- End Removed Redundant Check ---

			// Start indicator for individual task expansion in CLI mode
			let taskIndicator = null;
			if (!isMCPCall && outputFormat === 'text') {
				taskIndicator = startLoadingIndicator(`Expanding task ${task.id}...`);
			}

			try {
				// Call the refactored expandTask function
				await expandTask(
					tasksPath,
					task.id,
					numSubtasks, // Pass numSubtasks, expandTask handles defaults/complexity
					useResearch,
					additionalContext,
					context, // Pass the whole context object { session, mcpLog }
					force // Pass the force flag down
				);
				expandedCount++;
				if (taskIndicator) {
					stopLoadingIndicator(taskIndicator, `Task ${task.id} expanded.`);
				}
				logger.info(`Successfully expanded task ${task.id}.`);
			} catch (error) {
				failedCount++;
				if (taskIndicator) {
					stopLoadingIndicator(
						taskIndicator,
						`Failed to expand task ${task.id}.`,
						false
					);
				}
				logger.error(`Failed to expand task ${task.id}: ${error.message}`);
				// Continue to the next task
			}
		}

		// Log final summary (removed skipped count from message)
		logger.info(
			`Expansion complete: ${expandedCount} expanded, ${failedCount} failed.`
		);

		// Return summary (skippedCount is now 0) - Add success: true here as well for consistency
		return {
			success: true, // Indicate overall success
			expandedCount,
			failedCount,
			skippedCount: 0,
			tasksToExpand: tasksToExpandCount
		};
	} catch (error) {
		if (loadingIndicator)
			stopLoadingIndicator(loadingIndicator, 'Error.', false);
		logger.error(`Error during expand all operation: ${error.message}`);
		if (!isMCPCall && getDebugFlag(session)) {
			console.error(error); // Log full stack in debug CLI mode
		}
		// Re-throw error for the caller to handle, the direct function will format it
		throw error; // Let direct function wrapper handle formatting
		/* Original re-throw:
		throw new Error(`Failed to expand all tasks: ${error.message}`);
		*/
	}
}

export default expandAllTasks;
