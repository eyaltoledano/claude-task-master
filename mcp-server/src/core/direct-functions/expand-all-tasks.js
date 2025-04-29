/**
 * Direct function wrapper for expandAllTasks using FastMCP sampling.
 */

// Removed: import { expandAllTasks } from '../../../../scripts/modules/task-manager.js';
import { generateTaskFiles } from '../../../../scripts/modules/task-manager.js'; // Keep for generating files
import {
	enableSilentMode,
	disableSilentMode,
	readJSON,
	writeJSON
} from '../../../../scripts/modules/utils.js';
// Removed AI client utils: import { getAnthropicClientForMCP } from '../utils/ai-client-utils.js';
// Import necessary AI prompt/parsing helpers from the correct location
import {
	generateSubtaskPrompt,
	parseSubtasksFromText
} from '../utils/ai-client-utils.js'; // Updated path
// Removed import from ai-services.js
import path from 'path';
import fs from 'fs';

/**
 * Expand all pending tasks with subtasks using FastMCP sampling.
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {number|string} [args.num] - Number of subtasks to generate per task.
 * @param {boolean} [args.research] - Research hint (handled by client LLM).
 * @param {string} [args.prompt] - Additional context to guide subtask generation.
 * @param {boolean} [args.force] - Force regeneration of subtasks.
 * @param {Object} log - Logger object
 * @param {Object} context - Context object containing session for sampling.
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function expandAllTasksDirect(args, log, context = {}) {
	const { session } = context; // Session is needed for sampling
	const { tasksJsonPath, num, research, prompt, force } = args;

	// --- Input Validation ---
	if (!tasksJsonPath) {
		log.error('expandAllTasksDirect called without tasksJsonPath');
		return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'tasksJsonPath is required' }, fromCache: false };
	}
	if (!session || typeof session.llm?.complete !== 'function') {
		const errorMessage = 'FastMCP sampling function (session.llm.complete) is not available.';
		log.error(errorMessage);
		return { success: false, error: { code: 'SAMPLING_UNAVAILABLE', message: errorMessage }, fromCache: false };
	}

	const tasksPath = tasksJsonPath;
	const numSubtasks = num ? parseInt(num, 10) : undefined;
	const additionalContext = prompt || '';
	const forceFlag = force === true;
	const useResearch = research === true; // Note: Research needs to be handled by client LLM

	log.info(`Expanding all tasks via MCP sampling. NumSubtasks=${numSubtasks || 'default'}, Force=${forceFlag}, Research hint: ${useResearch}`);

	try {
		// --- Read Task Data ---
		const data = readJSON(tasksPath);
		if (!data || !Array.isArray(data.tasks)) {
			return { success: false, error: { code: 'INVALID_TASKS_FILE', message: `Invalid tasks data in ${tasksPath}` }, fromCache: false };
		}

		// --- Filter Tasks for Expansion ---
		const tasksToExpand = data.tasks.filter((task) => {
			const isPending = task.status !== 'done' && task.status !== 'completed';
			const hasSubtasks = task.subtasks && task.subtasks.length > 0;
			return isPending && (!hasSubtasks || forceFlag);
		});

		if (tasksToExpand.length === 0) {
			log.info('No eligible pending tasks found for expansion.');
			return { success: true, data: { message: 'No eligible tasks to expand.', tasksExpanded: 0 }, fromCache: false };
		}
		log.info(`Found ${tasksToExpand.length} eligible tasks for expansion.`);

		// --- Start of Refactored Logic ---
		let tasksExpandedCount = 0;
		const totalTasksToProcess = tasksToExpand.length;

		for (let i = 0; i < totalTasksToProcess; i++) {
			const task = tasksToExpand[i];
			const taskIndexInData = data.tasks.findIndex(t => t.id === task.id);
			if (taskIndexInData === -1) continue; // Should not happen, but safeguard

			log.info(`[${i + 1}/${totalTasksToProcess}] Expanding task ${task.id}: ${task.title}`);

			try {
				// 1. Construct Prompt
				const subtaskPrompt = generateSubtaskPrompt(task, numSubtasks, additionalContext);
				if (!subtaskPrompt) {
					log.warn(`Skipping task ${task.id}: Failed to generate subtask prompt.`);
					continue;
				}

				// 2. Call Sampling
				log.info(`   Initiating sampling for task ${task.id}...`);
				const completion = await session.llm.complete(subtaskPrompt);
				const completionText = completion?.content;
				if (!completionText) {
					log.warn(`Skipping task ${task.id}: Received empty completion from sampling.`);
					continue;
				}

				// 3. Parse Completion
				let newSubtasks;
				try {
					newSubtasks = parseSubtasksFromText(completionText);
					if (!Array.isArray(newSubtasks)) throw new Error('Not an array');
				} catch (parseError) {
					log.warn(`Skipping task ${task.id}: Failed to parse subtasks from completion - ${parseError.message}`);
					continue;
				}

				// 4. Update Task Data
				const nextSubtaskId = (data.tasks[taskIndexInData].subtasks?.length || 0) + 1;
				newSubtasks.forEach((subtask, index) => {
					subtask.id = nextSubtaskId + index;
					subtask.status = subtask.status || 'pending';
				});
				data.tasks[taskIndexInData].subtasks = newSubtasks;
				tasksExpandedCount++;
				log.info(`   Successfully generated ${newSubtasks.length} subtasks for task ${task.id}.`);

			} catch (taskError) {
				log.error(`   Error processing task ${task.id}: ${taskError.message}`);
				// Continue to the next task
			}
		} // End loop

		// 5. Save Updated Tasks (only if any were expanded)
		if (tasksExpandedCount > 0) {
			writeJSON(tasksPath, data);
			log.info(`Saved updates to ${tasksPath} after expanding ${tasksExpandedCount} tasks.`);

			// 6. Generate Individual Task Files (in silent mode)
			// Create logger wrapper
			const logWrapper = {
				info: (message, ...args) => log.info(message, ...args),
				warn: (message, ...args) => log.warn(message, ...args),
				error: (message, ...args) => log.error(message, ...args),
				debug: (message, ...args) => log.debug && log.debug(message, ...args),
				success: (message, ...args) => log.info(message, ...args)
			};
			enableSilentMode();
			try {
				await generateTaskFiles(tasksPath, path.dirname(tasksPath), { mcpLog: logWrapper }); // Use wrapper
				log.info('Generated individual task files.');
			} finally {
				disableSilentMode();
			}
		}

		// --- End of Refactored Logic ---

		// 7. Return Success
		return {
			success: true,
			data: {
				message: `Successfully processed ${totalTasksToProcess} eligible tasks. Expanded ${tasksExpandedCount} tasks via sampling.`,
				tasksExpanded: tasksExpandedCount,
				totalEligibleTasks: totalTasksToProcess
			},
			fromCache: false
		};

	} catch (error) {
		log.error(`Error during MCP expandAllTasksDirect: ${error.message}`);
		log.error(error.stack);
		return {
			success: false,
			error: {
				code: 'EXPAND_ALL_SAMPLING_ERROR',
				message: error.message || 'Unknown error during expand all tasks via sampling'
			},
			fromCache: false
		};
	}
}
