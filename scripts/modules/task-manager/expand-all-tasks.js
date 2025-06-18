import { log, readJSON, isSilentMode, findProjectRoot } from '../utils.js';
import {
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';
import {
	displayExpandStart,
	displayExpandSummary
} from '../../../src/ui/expand.js';
import expandTask from './expand-task.js';
import { getDebugFlag } from '../config-manager.js';
import { aggregateTelemetry } from '../utils.js';
import chalk from 'chalk';
import boxen from 'boxen';
import { ExpandTracker } from '../../../src/progress/expand-tracker.js';

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
 * @param {Object} [progressTracker] - Optional progress tracker object.
 * @returns {Promise<{success: boolean, expandedCount: number, failedCount: number, skippedCount: number, tasksToExpand: number, telemetryData: Array<Object>}>} - Result summary.
 */
async function expandAllTasks(
	tasksPath,
	numSubtasks, // Keep this signature, expandTask handles defaults
	useResearch = false,
	additionalContext = '',
	force = false, // Keep force here for the filter logic
	context = {},
	outputFormat = 'text', // Assume text default for CLI
	progressTracker = null
) {
	const { session, mcpLog, projectRoot: providedProjectRoot, reportProgress } = context;
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
	const startTime = Date.now();

	// Report initial progress
	if (progressTracker) {
		progressTracker.updateOverallProgress('starting', 'Analyzing tasks for expansion...');
	}
	if (reportProgress) {
		reportProgress({
			type: 'progress',
			operation: 'expand-all',
			stage: 'starting',
			message: 'Analyzing tasks for expansion...',
			progress: 0
		});
	}

	if (!isMCPCall && outputFormat === 'text' && !progressTracker) {
		loadingIndicator = startLoadingIndicator(
			'Analyzing tasks for expansion...'
		);
	}

	try {
		logger.debug(`Reading tasks from ${tasksPath}`);
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

		// Update progress tracker with task count
		if (progressTracker) {
			progressTracker.setTotalTasks(tasksToExpandCount);
			progressTracker.updateOverallProgress('analyzing', `Found ${tasksToExpandCount} tasks to expand`);
		}
		if (reportProgress) {
			reportProgress({
				type: 'progress',
				operation: 'expand-all',
				stage: 'analyzing',
				message: `Found ${tasksToExpandCount} tasks to expand`,
				progress: 10,
				totalTasks: tasksToExpandCount
			});
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

		// Display start UI for CLI mode
		if (outputFormat === 'text') {
			displayExpandStart({
				totalPendingTasks: tasksToExpandCount,
				tasksFilePath: tasksPath,
				numSubtasks: numSubtasks || 'Auto-calculated',
				model: context.model,
				temperature: context.temperature,
				force: force,
				research: useResearch,
				customPrompt: additionalContext || undefined,
				expandType: 'all',
				tagName: context.tagName || context.session?.tagName
			});
		}

		// Iterate over the already filtered tasks
		for (let i = 0; i < tasksToExpand.length; i++) {
			const task = tasksToExpand[i];
			const taskNumber = i + 1;
			
			// Update overall progress
			if (progressTracker) {
				progressTracker.updateOverallProgress(
					'expanding', 
					`Expanding task ${taskNumber}/${tasksToExpandCount}: ${task.title}`
				);
			}
			if (reportProgress) {
				const overallProgress = Math.round(((taskNumber - 1) / tasksToExpandCount) * 80) + 20; // 20-100%
				reportProgress({
					type: 'progress',
					operation: 'expand-all',
					stage: 'expanding',
					message: `Expanding task ${taskNumber}/${tasksToExpandCount}: ${task.title}`,
					progress: overallProgress,
					currentTask: taskNumber,
					totalTasks: tasksToExpandCount
				});
			}
			
			// Start indicator for individual task expansion in CLI mode
			let taskIndicator = null;
			if (!isMCPCall && outputFormat === 'text' && !progressTracker) {
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
					{ ...context, projectRoot, reportProgress }, // Pass the whole context object with projectRoot and reportProgress
					force,
					progressTracker // Pass the progress tracker
				);
				expandedCount++;

				// Collect individual telemetry data
				if (result && result.telemetryData) {
					allTelemetryData.push(result.telemetryData);
				}

				// Update progress tracker with task completion
				if (progressTracker) {
					const subtasksAdded = result.task?.subtasks?.length || 0;
					progressTracker.addExpansionLine(task.id, task.title, subtasksAdded, 'success', result.telemetryData);
				}

				if (taskIndicator) {
					stopLoadingIndicator(taskIndicator, `Task ${task.id} expanded.`);
				}
				logger.debug(`Successfully expanded task ${task.id}.`);
			} catch (error) {
				failedCount++;
				if (taskIndicator) {
					stopLoadingIndicator(
						taskIndicator,
						`Failed to expand task ${task.id}.`,
						false
					);
				}

				// Update progress tracker with error
				if (progressTracker) {
					progressTracker.addExpansionLine(task.id, task.title, 0, 'error', null);
				}

				logger.error(`Failed to expand task ${task.id}: ${error.message}`);
				// Continue to the next task
			}
		}

		// --- AGGREGATION AND DISPLAY ---
		logger.info(
			`Expansion complete: ${expandedCount} expanded, ${failedCount} failed.`
		);

		// Report completion
		if (progressTracker) {
			progressTracker.updateOverallProgress('completed', `Expansion complete: ${expandedCount} expanded, ${failedCount} failed`);
		}
		if (reportProgress) {
			reportProgress({
				type: 'progress',
				operation: 'expand-all',
				stage: 'completed',
				message: `Expansion complete: ${expandedCount} expanded, ${failedCount} failed`,
				progress: 100,
				expandedCount,
				failedCount
			});
		}

		// Aggregate the collected telemetry data
		const aggregatedTelemetryData = aggregateTelemetry(
			allTelemetryData,
			'expand-all-tasks'
		);

		if (outputFormat === 'text') {
			const elapsedTime = Date.now() - startTime;

			// Calculate total subtasks created
			let totalSubtasksCreated = 0;
			for (const telemetryData of allTelemetryData) {
				// Each telemetry data represents one successful task expansion
				// We can estimate subtasks created (typically 5 per task) or use actual count if available
				totalSubtasksCreated += telemetryData.subtasksCreated || 5;
			}

			// Display our custom summary UI with the correct stats
			displayExpandSummary({
				totalTasksProcessed: tasksToExpandCount,
				totalSubtasksCreated: totalSubtasksCreated,
				tasksSkipped: 0, // Always 0 due to pre-filtering (like old "Skipped" stat)
				tasksWithErrors: failedCount,
				tasksFilePath: tasksPath,
				elapsedTime: elapsedTime,
				force: force,
				research: useResearch,
				expandType: 'all',
				errors: failedCount > 0 ? [`${failedCount} tasks failed to expand`] : []
			});
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
		// Report error
		if (progressTracker) {
			progressTracker.updateOverallProgress('error', `Error: ${error.message}`);
		}
		if (reportProgress) {
			reportProgress({
				type: 'error',
				operation: 'expand-all',
				stage: 'error',
				message: `Error: ${error.message}`,
				progress: 0
			});
		}
		
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
