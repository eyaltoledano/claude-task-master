import { log, readJSON, isSilentMode, findProjectRoot } from '../utils.js';
import {
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';
import expandTask from './expand-task.js';
import { getDebugFlag, getDefaultSubtasks } from '../config-manager.js';
import { aggregateTelemetry } from '../utils.js';
import chalk from 'chalk';
import boxen from 'boxen';
import { createExpandTracker } from '../../../src/progress/expand-tracker.js';
import {
	displayExpandStart,
	displayExpandSummary
} from '../../../src/ui/expand.js';
import { COMPLEXITY_REPORT_FILE } from '../../../src/constants/paths.js';
import fs from 'fs';
import path from 'path';

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
 * @param {string} [context.projectRoot] - Project root path
 * @param {string} [context.tag] - Tag for the task
 * @param {string} [context.complexityReportPath] - Path to the complexity report file
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
	const {
		session,
		mcpLog,
		projectRoot: providedProjectRoot,
		tag,
		complexityReportPath,
		reportProgress
	} = context;
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
	let parentTracker = null;

	if (!isMCPCall && outputFormat === 'text') {
		loadingIndicator = startLoadingIndicator(
			'Analyzing tasks for expansion...'
		);
	}

	try {
		logger.debug(`Reading tasks from ${tasksPath}`);
		const data = readJSON(tasksPath, projectRoot, tag);
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
		logger.debug(`Found ${tasksToExpandCount} tasks eligible for expansion.`);
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

		// Load complexity report for task scores
		let complexityReport = null;
		try {
			const complexityReportPath = path.join(
				projectRoot,
				COMPLEXITY_REPORT_FILE
			);
			if (fs.existsSync(complexityReportPath)) {
				complexityReport = readJSON(
					complexityReportPath,
					projectRoot,
					data.tag || contextTag
				);
				logger.debug('Loaded complexity report for task scores');
			}
		} catch (error) {
			logger.debug(`Could not load complexity report: ${error.message}`);
		}

		// Create parent tracker for CLI mode
		if (!isMCPCall && outputFormat === 'text') {
			// Display the header before starting the tracker
			displayExpandStart({
				tagName: data.tag || contextTag,
				totalPendingTasks: tasksToExpandCount,
				tasksFilePath: tasksPath,
				numSubtasks: numSubtasks, // Pass the actual numSubtasks (could be undefined)
				explicitSubtasks: Boolean(numSubtasks),
				hasComplexityAnalysis: Boolean(complexityReport),
				force: force,
				research: useResearch,
				customPrompt: additionalContext,
				expandType: 'all'
			});

			parentTracker = createExpandTracker({
				expandType: 'all',
				numTasks: tasksToExpandCount
			});
			parentTracker.start();
		}

		// Report initial progress for MCP
		if (reportProgress) {
			await reportProgress({
				type: 'expand_all_start',
				progress: 0,
				current: 0,
				total: tasksToExpandCount,
				message: `Starting expansion of ${tasksToExpandCount} tasks...`
			});
		}

		// Track completed and in-progress subtasks for fractional progress
		const totalSubtasksProcessed = 0; // Not used in current implementation
		let currentTaskSubtaskProgress = 0;
		let currentTaskExpectedSubtasks = 0;

		// Iterate over the already filtered tasks
		for (const task of tasksToExpand) {
			// Get task analysis and complexity score
			const taskAnalysis = complexityReport?.complexityAnalysis?.find(
				(a) => a.taskId === task.id
			);
			const complexityScore = taskAnalysis?.complexityScore || null;

			// Determine expected subtask count (same logic as in expandTask)
			let expectedSubtasks = 0;
			const explicitNumSubtasks = parseInt(numSubtasks, 10);
			if (!Number.isNaN(explicitNumSubtasks) && explicitNumSubtasks > 0) {
				expectedSubtasks = explicitNumSubtasks;
			} else if (taskAnalysis?.recommendedSubtasks) {
				expectedSubtasks = parseInt(taskAnalysis.recommendedSubtasks, 10);
			} else {
				expectedSubtasks = getDefaultSubtasks(session); // Use config default
			}

			// Update parent tracker with current task and expected subtask count
			if (parentTracker) {
				parentTracker.setCurrentTask(task.id, task.title, expectedSubtasks);
			}

			// Store expected subtasks for MCP progress reporting
			currentTaskExpectedSubtasks = expectedSubtasks;
			currentTaskSubtaskProgress = 0;

			// Report task expansion start for MCP
			if (reportProgress) {
				const currentTaskNumber = expandedCount + 1;
				await reportProgress({
					type: 'task_expansion_start',
					progress: expandedCount / tasksToExpandCount,
					current: expandedCount,
					total: tasksToExpandCount,
					taskId: task.id,
					taskTitle: task.title,
					taskNumber: currentTaskNumber,
					expectedSubtasks: expectedSubtasks,
					message: `Starting expansion of Task ${currentTaskNumber}/${tasksToExpandCount}: ${task.title}`
				});
			}

			try {
				// Create a callback for subtask progress updates (for MCP)
				const onSubtaskProgress = reportProgress
					? async (subtaskCount) => {
							currentTaskSubtaskProgress = subtaskCount;
							// Calculate fractional progress
							const fractionalProgress =
								expandedCount +
								(currentTaskExpectedSubtasks > 0
									? subtaskCount / currentTaskExpectedSubtasks
									: 0);

							await reportProgress({
								type: 'subtask_progress',
								progress: fractionalProgress / tasksToExpandCount,
								current: fractionalProgress,
								total: tasksToExpandCount,
								taskId: task.id,
								taskTitle: task.title,
								subtaskProgress: subtaskCount,
								subtaskTotal: currentTaskExpectedSubtasks,
								message: `Task ${expandedCount + 1}/${tasksToExpandCount}: Generating subtask ${subtaskCount}/${currentTaskExpectedSubtasks}...`
							});
						}
					: null;

				// Call the refactored expandTask function AND capture result
				const result = await expandTask(
					tasksPath,
					task.id,
					numSubtasks,
					useResearch,
					additionalContext,
					{
						...context,
						projectRoot,
						tag: data.tag || tag,
						complexityReportPath,
						parentTracker,
						onSubtaskProgress, // Pass the callback
						isChildOperation: true // Indicate this is called from expandAllTasks
					}, // Pass the whole context object with projectRoot and resolved tag
					force
				);
				expandedCount++;

				// Collect individual telemetry data
				if (result && result.telemetryData) {
					allTelemetryData.push(result.telemetryData);
				}

				// Add expansion line to parent tracker
				if (parentTracker) {
					parentTracker.addExpansionLine(
						task.id,
						task.title,
						result.task?.subtasks?.length || 0,
						'success',
						result.telemetryData,
						complexityScore
					);
				}

				// Report task completion for MCP
				if (reportProgress) {
					const currentTaskNumber = expandedCount;
					await reportProgress({
						type: 'task_expansion_complete',
						progress: expandedCount / tasksToExpandCount,
						current: expandedCount,
						total: tasksToExpandCount,
						taskId: task.id,
						taskTitle: task.title,
						taskNumber: currentTaskNumber,
						subtasksGenerated: result.task?.subtasks?.length || 0,
						telemetryData: result.telemetryData,
						message: `Completed Task ${currentTaskNumber}/${tasksToExpandCount}: ${task.title} (${result.task?.subtasks?.length || 0} subtasks)`
					});
				}

				logger.debug(`Successfully expanded task ${task.id}.`);
			} catch (error) {
				failedCount++;

				// Add error to parent tracker
				if (parentTracker) {
					parentTracker.addError(task.id, error.message);
				}

				// Report task failure for MCP
				if (reportProgress) {
					const currentTaskNumber = expandedCount + failedCount;
					await reportProgress({
						type: 'task_expansion_error',
						progress: currentTaskNumber / tasksToExpandCount,
						current: currentTaskNumber,
						total: tasksToExpandCount,
						taskId: task.id,
						taskTitle: task.title,
						error: error.message,
						message: `Failed to expand Task ${task.id}: ${error.message}`
					});
				}

				logger.error(`Failed to expand task ${task.id}: ${error.message}`);
				// Continue to the next task
			}
		}

		// Stop parent tracker
		if (parentTracker) {
			await parentTracker.stop();
		}

		// --- AGGREGATION AND DISPLAY ---
		logger.debug(
			`Expansion complete: ${expandedCount} expanded, ${failedCount} failed.`
		);

		// Aggregate the collected telemetry data
		const aggregatedTelemetryData = aggregateTelemetry(
			allTelemetryData,
			'expand-all-tasks'
		);

		// Display summary for CLI mode
		if (outputFormat === 'text' && !isMCPCall) {
			const summary = parentTracker ? parentTracker.getSummary() : null;
			displayExpandSummary({
				totalTasksProcessed: tasksToExpandCount,
				totalSubtasksCreated: summary?.totalSubtasksCreated || 0,
				tasksSkipped: 0, // Always 0 due to pre-filtering
				tasksWithErrors: failedCount,
				tasksFilePath: tasksPath,
				elapsedTime: summary?.elapsedTime || 0,
				force: force,
				research: useResearch,
				explicitSubtasks: Boolean(numSubtasks),
				hasComplexityAnalysis: Boolean(complexityReport),
				expandType: 'all',
				errors: summary?.errors || []
			});
		}

		// Display AI usage summary after parent tracker stops
		if (outputFormat === 'text' && aggregatedTelemetryData) {
			displayAiUsageSummary(aggregatedTelemetryData, 'cli');
		}

		// Report final completion for MCP
		if (reportProgress) {
			await reportProgress({
				type: 'expand_all_complete',
				progress: 1,
				current: tasksToExpandCount,
				total: tasksToExpandCount,
				expandedCount: expandedCount,
				failedCount: failedCount,
				telemetryData: aggregatedTelemetryData,
				message: `Expansion complete: ${expandedCount} tasks expanded, ${failedCount} failed`
			});
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

		// Stop parent tracker on error
		if (parentTracker) {
			await parentTracker.stop();
		}

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
