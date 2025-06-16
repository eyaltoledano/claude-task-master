import { log, readJSON, isSilentMode, findProjectRoot } from '../utils.js';
import {
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';
import expandTask from './expand-task.js';
import { getDebugFlag } from '../config-manager.js';
import { aggregateTelemetry } from '../utils.js';
import chalk from 'chalk';
import boxen from 'boxen';

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
 * @returns {Promise<{success: boolean, expandedCount: number, failedCount: number, skippedCount: number, tasksToExpand: number, telemetryData: Array<Object>}>} - Result summary.
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
	const { session, mcpLog, projectRoot: providedProjectRoot } = context;
	const isMCPCall = !!mcpLog; // Determine if called from MCP

	const projectRoot = providedProjectRoot || findProjectRoot();
	if (!projectRoot) {
		throw new Error('Could not determine project root directory');
	}

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
	let tasksToExpandCount = 0;
	const allTelemetryData = []; // Still collect individual data first

	if (!isMCPCall && outputFormat === 'text') {
		loadingIndicator = startLoadingIndicator(
			'Analyzing tasks for expansion...'
		);
	}

	try {
		logger.info(`Reading tasks from ${tasksPath}`);
		const data = readJSON(tasksPath, projectRoot);
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
				telemetryData: allTelemetryData,
				message: 'No tasks eligible for expansion.'
			};
			// --- End Fix ---
		}

		// Iterate over the already filtered tasks
		for (const task of tasksToExpand) {
			// Start indicator for individual task expansion in CLI mode
			let taskIndicator = null;
			if (!isMCPCall && outputFormat === 'text') {
				taskIndicator = startLoadingIndicator(`Expanding task ${task.id}...`);
			}

			try {
				// Call the refactored expandTask function AND capture result
				const result = await expandTask(
					tasksPath,
					task.id,
					numSubtasks,
					useResearch,
					additionalContext,
					{ ...context, projectRoot }, // Pass the whole context object with projectRoot
					force
				);
				expandedCount++;

				// Collect individual telemetry data
				if (result && result.telemetryData) {
					allTelemetryData.push(result.telemetryData);
				}

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

		// --- AGGREGATION AND DISPLAY ---
		logger.info(
			`Expansion complete: ${expandedCount} expanded, ${failedCount} failed.`
		);

		// Aggregate the collected telemetry data
		const aggregatedTelemetryData = aggregateTelemetry(
			allTelemetryData,
			'expand-all-tasks'
		);

		if (outputFormat === 'text') {
			const summaryContent =
				`${chalk.white.bold('Expansion Summary:')}\n\n` +
				`${chalk.cyan('-')} Attempted: ${chalk.bold(tasksToExpandCount)}\n` +
				`${chalk.green('-')} Expanded:  ${chalk.bold(expandedCount)}\n` +
				// Skipped count is always 0 now due to pre-filtering
				`${chalk.gray('-')} Skipped:   ${chalk.bold(0)}\n` +
				`${chalk.red('-')} Failed:    ${chalk.bold(failedCount)}`;

			console.log(
				boxen(summaryContent, {
					padding: 1,
					margin: { top: 1 },
					borderColor: failedCount > 0 ? 'red' : 'green', // Red if failures, green otherwise
					borderStyle: 'round'
				})
			);
		}

		if (outputFormat === 'text' && aggregatedTelemetryData) {
			displayAiUsageSummary(aggregatedTelemetryData, 'cli');
		}

		// Return summary including the AGGREGATED telemetry data
		return {
			success: true,
			expandedCount,
			failedCount,
			skippedCount: 0,
			tasksToExpand: tasksToExpandCount,
			telemetryData: aggregatedTelemetryData
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
