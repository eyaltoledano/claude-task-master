/**
 * Direct function wrapper for addSubtask
 */

import { addSubtask } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Add a subtask to an existing task
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - Parent task ID
 * @param {string} [args.taskId] - Existing task ID to convert to subtask (optional)
 * @param {string} [args.title] - Title for new subtask (when creating a new subtask)
 * @param {string} [args.description] - Description for new subtask
 * @param {string} [args.details] - Implementation details for new subtask
 * @param {string} [args.status] - Status for new subtask (default: 'pending')
 * @param {string} [args.dependencies] - Comma-separated list of dependency IDs
 * @param {boolean} [args.skipGenerate] - Skip regenerating task files
 * @param {string} [args.mode] - Mode for agent-in-the-loop support
 * @param {Object} [args.subtask] - Subtask object for agent-in-the-loop support
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function addSubtaskDirect(args, log) {
	// Destructure expected args
	const {
		tasksJsonPath,
		id,
		taskId,
		title,
		description,
		details,
		status,
		dependencies: dependenciesStr,
		skipGenerate,
		mode,
		subtask
	} = args;
	try {
		log.info(`Adding subtask with args: ${JSON.stringify(args)}`);

		// --- AGENT-IN-THE-LOOP: PROMPT GENERATION MODE ---
		if (mode === 'get_prompt' || (!subtask && mode !== 'submit_subtask')) {
			const depList = dependenciesStr
				? dependenciesStr.split(',').map((depId) => depId.trim())
				: [];
			const promptText = `You are to generate a new subtask for the following parent task. The subtask should be actionable, concise, and follow the Task Master subtask structure.\n\nParent task ID: ${id}\nTitle: ${title || ''}\nDescription: ${description || ''}\nDependencies: [${depList.join(', ')}]\nStatus: ${status || 'pending'}\n\nReturn a single subtask object with fields: title (string), description (string), details (string), status (string), dependencies (array of numbers or strings).`;
			return {
				success: true,
				data: {
					prompt: promptText,
					parentId: id,
					dependencies: depList,
					status: status || 'pending'
				},
			};
		}

		// --- AGENT-IN-THE-LOOP: SUBTASK SUBMISSION MODE ---
		if ((mode === 'submit_subtask' || subtask) && typeof subtask === 'object' && subtask !== null) {
			const st = subtask;
			const errors = [];
			if (typeof st.title !== 'string' || !st.title.trim()) {
				errors.push(`'title' is required and must be a string.`);
			}
			if (typeof st.description !== 'string') {
				errors.push(`'description' must be a string.`);
			}
			if (typeof st.details !== 'string') {
				errors.push(`'details' must be a string.`);
			}
			if (typeof st.status !== 'string') {
				errors.push(`'status' must be a string.`);
			}
			if (!Array.isArray(st.dependencies)) {
				errors.push(`'dependencies' must be an array.`);
			}
			if (errors.length > 0) {
				return {
					success: false,
					error: {
						code: 'INVALID_SUBTASK',
						message: 'Subtask validation failed.',
						details: errors
					}
				};
			}
			// Insert the subtask using addSubtask
			enableSilentMode();
			const parentId = parseInt(id, 10);
			const generateFiles = !skipGenerate;
			const newSubtaskData = {
				title: st.title,
				description: st.description,
				details: st.details,
				status: st.status,
				dependencies: st.dependencies
			};
			const result = await addSubtask(
				tasksJsonPath,
				parentId,
				null,
				newSubtaskData,
				generateFiles
			);
			disableSilentMode();
			return {
				success: true,
				data: {
					message: `New subtask ${parentId}.${result.id} successfully created`,
					subtask: result
				}
			};
		}

		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('addSubtaskDirect called without tasksJsonPath');
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}

		if (!id) {
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message: 'Parent task ID is required'
				}
			};
		}

		// Either taskId or title must be provided
		if (!taskId && !title) {
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message: 'Either taskId or title must be provided'
				}
			};
		}

		// Use provided path
		const tasksPath = tasksJsonPath;

		// Parse dependencies if provided
		let dependencies = [];
		if (dependenciesStr) {
			dependencies = dependenciesStr.split(',').map((depId) => {
				// Handle both regular IDs and dot notation
				return depId.includes('.') ? depId.trim() : parseInt(depId.trim(), 10);
			});
		}

		// Convert existingTaskId to a number if provided
		const existingTaskId = taskId ? parseInt(taskId, 10) : null;

		// Convert parent ID to a number
		const parentId = parseInt(id, 10);

		// Determine if we should generate files
		const generateFiles = !skipGenerate;

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		// Case 1: Convert existing task to subtask
		if (existingTaskId) {
			log.info(`Converting task ${existingTaskId} to a subtask of ${parentId}`);
			const result = await addSubtask(
				tasksPath,
				parentId,
				existingTaskId,
				null,
				generateFiles
			);

			// Restore normal logging
			disableSilentMode();

			return {
				success: true,
				data: {
					message: `Task ${existingTaskId} successfully converted to a subtask of task ${parentId}`,
					subtask: result
				}
			};
		}
		// Case 2: Create new subtask
		else {
			log.info(`Creating new subtask for parent task ${parentId}`);

			const newSubtaskData = {
				title: title,
				description: description || '',
				details: details || '',
				status: status || 'pending',
				dependencies: dependencies
			};

			const result = await addSubtask(
				tasksPath,
				parentId,
				null,
				newSubtaskData,
				generateFiles
			);

			// Restore normal logging
			disableSilentMode();

			return {
				success: true,
				data: {
					message: `New subtask ${parentId}.${result.id} successfully created`,
					subtask: result
				}
			};
		}
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in addSubtaskDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CORE_FUNCTION_ERROR',
				message: error.message
			}
		};
	}
}
