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
	const { tasksJsonPath, id, prompt, research, mode, task } = args;

	try {
		log.info(`Updating task with args: ${JSON.stringify(args)}`);

		// --- AGENT-IN-THE-LOOP: PROMPT GENERATION MODE ---
		if (mode === 'get_prompt' || (!task && mode !== 'submit_task')) {
			// Read the current task from tasks.json
			const fs = await import('fs');
			const tasksData = JSON.parse(fs.readFileSync(tasksJsonPath, 'utf8'));
			let currentTask = null;
			if (typeof id === 'string' && id.includes('.')) {
				// Subtask (not supported here, but for completeness)
				const [parentId, subId] = id.split('.').map(Number);
				const parent = tasksData.tasks.find((t) => t.id === parentId);
				if (parent && Array.isArray(parent.subtasks)) {
					currentTask = parent.subtasks.find((st) => st.id === subId);
				}
			} else {
				const taskId = typeof id === 'number' ? id : parseInt(id, 10);
				currentTask = tasksData.tasks.find((t) => t.id === taskId);
			}
			const promptText = `You are to update the following task based on the new information provided. The updated task should be actionable, concise, and follow the Task Master task structure.\n\nCurrent task:\n${JSON.stringify(currentTask, null, 2)}\n\nUpdate prompt: ${prompt}\n\nReturn a single updated task object with fields: title (string), description (string), details (string), testStrategy (string), dependencies (array of numbers), priority (string), status (string, optional).`;
			return {
				success: true,
				data: {
					prompt: promptText,
					currentTask,
					updatePrompt: prompt
				},
				fromCache: false
			};
		}

		// --- AGENT-IN-THE-LOOP: TASK SUBMISSION MODE ---
		if ((mode === 'submit_task' || task) && typeof task === 'object' && task !== null) {
			const t = task;
			const errors = [];
			if (typeof t.title !== 'string' || !t.title.trim()) {
				errors.push(`'title' is required and must be a string.`);
			}
			if (typeof t.description !== 'string') {
				errors.push(`'description' must be a string.`);
			}
			if (typeof t.details !== 'string') {
				errors.push(`'details' must be a string.`);
			}
			if (typeof t.testStrategy !== 'string') {
				errors.push(`'testStrategy' must be a string.`);
			}
			if (!Array.isArray(t.dependencies)) {
				errors.push(`'dependencies' must be an array.`);
			}
			if (typeof t.priority !== 'string') {
				errors.push(`'priority' must be a string.`);
			}
			if (t.status && typeof t.status !== 'string') {
				errors.push(`'status' must be a string if provided.`);
			}
			if (errors.length > 0) {
				return {
					success: false,
					error: {
						code: 'INVALID_TASK',
						message: 'Task validation failed.',
						details: errors
					},
					fromCache: false
				};
			}
			// Update the task in tasks.json
			enableSilentMode();
			const fs = await import('fs');
			const tasksData = JSON.parse(fs.readFileSync(tasksJsonPath, 'utf8'));
			let updated = false;
			if (typeof id === 'string' && id.includes('.')) {
				// Subtask (not supported here, but for completeness)
				const [parentId, subId] = id.split('.').map(Number);
				const parent = tasksData.tasks.find((tk) => tk.id === parentId);
				if (parent && Array.isArray(parent.subtasks)) {
					const idx = parent.subtasks.findIndex((st) => st.id === subId);
					if (idx !== -1) {
						parent.subtasks[idx] = { ...parent.subtasks[idx], ...t };
						updated = true;
					}
				}
			} else {
				const taskId = typeof id === 'number' ? id : parseInt(id, 10);
				const idx = tasksData.tasks.findIndex((tk) => tk.id === taskId);
				if (idx !== -1) {
					tasksData.tasks[idx] = { ...tasksData.tasks[idx], ...t };
					updated = true;
				}
			}
			if (updated) {
				fs.writeFileSync(tasksJsonPath, JSON.stringify(tasksData, null, 2));
				disableSilentMode();
				return {
					success: true,
					data: {
						message: `Successfully updated task with ID ${id} (agent-in-the-loop)`,
						taskId: id,
						tasksPath: tasksJsonPath
					},
					fromCache: false
				};
			} else {
				disableSilentMode();
				return {
					success: false,
					error: {
						code: 'TASK_NOT_FOUND',
						message: `Task with ID ${id} not found.`
					},
					fromCache: false
				};
			}
		}

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
