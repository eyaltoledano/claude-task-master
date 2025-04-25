/**
 * expand-task.js
 * Direct function implementation for expanding a task into subtasks
 */

import { expandTask } from '../../../../scripts/modules/task-manager.js';
import {
	readJSON,
	writeJSON,
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';
import {
	getAnthropicClientForMCP,
	getModelConfig
} from '../utils/ai-client-utils.js';
import path from 'path';
import fs from 'fs';

/**
 * Direct function wrapper for expanding a task into subtasks with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - The ID of the task to expand.
 * @param {number|string} [args.num] - Number of subtasks to generate.
 * @param {boolean} [args.research] - Enable Perplexity AI for research-backed subtask generation.
 * @param {string} [args.prompt] - Additional context to guide subtask generation.
 * @param {boolean} [args.force] - Force expansion even if subtasks exist.
 * @param {string} [args.mode] - The mode for agent-in-the-loop workflow.
 * @param {array} [args.subtasks] - The subtasks to submit.
 * @param {Object} log - Logger object
 * @param {Object} context - Context object containing session and reportProgress
 * @returns {Promise<Object>} - Task expansion result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }
 */
export async function expandTaskDirect(args, log, context = {}) {
	const { session } = context;
	// Destructure expected args
	const { tasksJsonPath, id, num, research, prompt, force, mode, subtasks } = args;

	// Log session root data for debugging
	log.info(
		`Session data in expandTaskDirect: ${JSON.stringify({
			hasSession: !!session,
			sessionKeys: session ? Object.keys(session) : [],
			roots: session?.roots,
			rootsStr: JSON.stringify(session?.roots)
		})}`
	);

	if (!tasksJsonPath) {
		log.error('expandTaskDirect called without tasksJsonPath');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'tasksJsonPath is required'
			},
			fromCache: false
		};
	}

	const tasksPath = tasksJsonPath;
	log.info(`[expandTaskDirect] Using tasksPath: ${tasksPath}`);

	const taskId = id ? parseInt(id, 10) : null;
	if (!taskId) {
		log.error('Task ID is required');
		return {
			success: false,
			error: {
				code: 'INPUT_VALIDATION_ERROR',
				message: 'Task ID is required'
			},
			fromCache: false
		};
	}

	const numSubtasks = num ? parseInt(num, 10) : undefined;
	const useResearch = research === true;
	let additionalContext = prompt || '';
	const forceFlag = force === true;

	// Read tasks data
	const data = readJSON(tasksPath);
	if (!data || !data.tasks) {
		log.error(
			`[expandTaskDirect] readJSON failed or returned invalid data for path: ${tasksPath}`
		);
		return {
			success: false,
			error: {
				code: 'INVALID_TASKS_FILE',
				message: `No valid tasks found in ${tasksPath}. readJSON returned: ${JSON.stringify(data)}`
			},
			fromCache: false
		};
	}

	const task = data.tasks.find((t) => t.id === taskId);
	if (!task) {
		return {
			success: false,
			error: {
				code: 'TASK_NOT_FOUND',
				message: `Task with ID ${taskId} not found`
			},
			fromCache: false
		};
	}

	// --- AGENT-IN-THE-LOOP: PROMPT GENERATION MODE ---
	if (mode === 'get_prompt' || (!subtasks && !forceFlag)) {
		// Use complexity analysis if available
		let taskAnalysis = null;
		try {
			const reportPath = 'scripts/task-complexity-report.json';
			if (fs.existsSync(reportPath)) {
				const report = readJSON(reportPath);
				if (report && report.complexityAnalysis) {
					taskAnalysis = report.complexityAnalysis.find((a) => a.taskId === task.id);
				}
			}
		} catch (error) {
			log.warn(`Could not read complexity analysis: ${error.message}`);
		}

		// Use recommended subtask count and expansion prompt if available
		let subtaskCount = numSubtasks || (taskAnalysis && taskAnalysis.recommendedSubtasks) || 5;
		if (taskAnalysis && taskAnalysis.expansionPrompt && !additionalContext) {
			additionalContext = taskAnalysis.expansionPrompt;
		}

		// Generate the prompt (reuse the same logic as in expandTask)
		const { generateSubtaskPrompt } = await import('../../../../scripts/modules/task-manager.js');
		const promptText = generateSubtaskPrompt(
			task,
			subtaskCount,
			additionalContext,
			taskAnalysis
		);

		return {
			success: true,
			data: {
				prompt: promptText,
				task,
				taskAnalysis,
				suggestedSubtaskCount: subtaskCount
			},
			fromCache: false
		};
	}

	// --- AGENT-IN-THE-LOOP: SUBTASK SUBMISSION MODE ---
	if ((mode === 'submit_subtasks' || subtasks) && Array.isArray(subtasks)) {
		// Validate subtasks structure (basic check)
		if (!Array.isArray(subtasks) || subtasks.length === 0) {
			return {
				success: false,
				error: {
					code: 'INVALID_SUBTASKS',
					message: 'No subtasks provided or subtasks is not an array.'
				},
				fromCache: false
			};
		}

		// --- Robust validation ---
		const errors = [];
		const idSet = new Set();
		const validIds = new Set();
		for (let i = 0; i < subtasks.length; i++) {
			const st = subtasks[i];
			const idx = i + 1;
			if (typeof st !== 'object' || st === null) {
				errors.push(`Subtask at index ${i} is not an object.`);
				continue;
			}
			if (typeof st.id !== 'number') {
				errors.push(`Subtask ${idx}: 'id' must be a number.`);
			} else {
				if (idSet.has(st.id)) {
					errors.push(`Duplicate subtask id: ${st.id}`);
				} else {
					idSet.add(st.id);
					validIds.add(st.id);
				}
			}
			if (typeof st.title !== 'string' || !st.title.trim()) {
				errors.push(`Subtask ${st.id}: 'title' is required and must be a string.`);
			}
			if (typeof st.description !== 'string') {
				errors.push(`Subtask ${st.id}: 'description' must be a string.`);
			}
			if (!Array.isArray(st.dependencies)) {
				errors.push(`Subtask ${st.id}: 'dependencies' must be an array.`);
			}
			if (typeof st.details !== 'string') {
				errors.push(`Subtask ${st.id}: 'details' must be a string.`);
			}
		}
		// Check that dependencies only reference valid subtask IDs
		for (const st of subtasks) {
			if (Array.isArray(st.dependencies)) {
				for (const dep of st.dependencies) {
					if (typeof dep !== 'number' || !validIds.has(dep)) {
						errors.push(`Subtask ${st.id}: dependency '${dep}' is not a valid subtask id in this batch.`);
					}
				}
			}
		}
		if (errors.length > 0) {
			return {
				success: false,
				error: {
					code: 'INVALID_SUBTASKS',
					message: 'Subtask validation failed.',
					details: errors
				},
				fromCache: false
			};
		}
		// --- End validation ---

		const hadExisting = !!(task.subtasks && task.subtasks.length > 0);
		const oldCount = task.subtasks ? task.subtasks.length : 0;
		task.subtasks = subtasks;
		writeJSON(tasksPath, data);
		return {
			success: true,
			data: {
				task,
				subtasksAdded: subtasks.length,
				hadExistingSubtasks: hadExisting,
				oldCount
			},
			fromCache: false
		};
	}

	// --- FALLBACK: LEGACY/CLI LLM GENERATION ---
	// (Current behavior: generate subtasks via LLM)
	try {
		log.info(
			`[expandTaskDirect] Expanding task ${taskId} into ${numSubtasks || 'default'} subtasks. Research: ${useResearch}`
		);

		const hasExistingSubtasks = task.subtasks && task.subtasks.length > 0;
		if (hasExistingSubtasks && !forceFlag) {
			log.info(
				`Task ${taskId} already has ${task.subtasks.length} subtasks. Use --force to overwrite.`
			);
			return {
				success: true,
				data: {
					message: `Task ${taskId} already has subtasks. Expansion skipped.`,
					task,
					subtasksAdded: 0,
					hasExistingSubtasks
				},
				fromCache: false
			};
		}
		if (hasExistingSubtasks && forceFlag) {
			log.info(
				`Force flag set. Clearing existing subtasks for task ${taskId}.`
			);
			task.subtasks = [];
		}
		const subtasksCountBefore = task.subtasks ? task.subtasks.length : 0;
		const backupPath = path.join(path.dirname(tasksPath), 'tasks.json.bak');
		fs.copyFileSync(tasksPath, backupPath);
		if (!task.subtasks) {
			task.subtasks = [];
		}
		writeJSON(tasksPath, data);
		enableSilentMode();
		const { expandTask } = await import('../../../../scripts/modules/task-manager.js');
		const result = await expandTask(
			tasksPath,
			taskId,
			numSubtasks,
			useResearch,
			additionalContext,
			{ mcpLog: log, session }
		);
		disableSilentMode();
		const updatedData = readJSON(tasksPath);
		const updatedTask = updatedData.tasks.find((t) => t.id === taskId);
		const subtasksAdded = updatedTask.subtasks
			? updatedTask.subtasks.length - subtasksCountBefore
			: 0;
		log.info(
			`Successfully expanded task ${taskId} with ${subtasksAdded} new subtasks`
		);
		return {
			success: true,
			data: {
				task: updatedTask,
				subtasksAdded,
				hasExistingSubtasks
			},
			fromCache: false
		};
	} catch (error) {
		disableSilentMode();
		log.error(`Error expanding task: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CORE_FUNCTION_ERROR',
				message: error.message || 'Failed to expand task'
			},
			fromCache: false
		};
	}
}
