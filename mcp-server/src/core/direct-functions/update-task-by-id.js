/**
 * update-task-by-id.js
 * Direct function implementation for updating a single task by ID with new information
 */

import { updateTaskById } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';
import { createTmCore } from '@tm/core';

/**
 * Direct function wrapper for updateTaskById with error handling.
 *
 * @param {Object} args - Command arguments containing id, prompt, useResearch, tasksJsonPath, and projectRoot.
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - Task ID (or subtask ID like "1.2").
 * @param {string} args.prompt - New information/context prompt.
 * @param {boolean} [args.research] - Whether to use research role.
 * @param {boolean} [args.append] - Whether to append timestamped information instead of full update.
 * @param {string} [args.projectRoot] - Project root path.
 * @param {string} [args.tag] - Tag for the task (optional)
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateTaskByIdDirect(args, log, context = {}) {
	const { session } = context;
	// Destructure expected args, including projectRoot
	const { tasksJsonPath, id, prompt, research, append, projectRoot, tag } =
		args;

	const logWrapper = createLogWrapper(log);

	// BRIDGE: Initialize tm-core for storage factory
	let tmCore;
	try {
		tmCore = await createTmCore({
			projectPath: projectRoot || process.cwd()
		});
		logWrapper.info(
			`TmCore initialized with storage type: ${tmCore.config.getStorageConfig().type}`
		);
	} catch (error) {
		logWrapper.error(`Failed to initialize TmCore: ${error.message}`);
		return {
			success: false,
			error: { code: 'TMCORE_INIT_ERROR', message: error.message }
		};
	}

	try {
		logWrapper.info(
			`Updating task by ID via direct function. ID: ${id}, ProjectRoot: ${projectRoot}`
		);

		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			const errorMessage = 'tasksJsonPath is required but was not provided.';
			logWrapper.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_ARGUMENT', message: errorMessage }
			};
		}

		// Check required parameters (id and prompt)
		if (!id) {
			const errorMessage =
				'No task ID specified. Please provide a task ID to update.';
			logWrapper.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_TASK_ID', message: errorMessage }
			};
		}

		if (!prompt) {
			const errorMessage =
				'No prompt specified. Please provide a prompt with new information for the task update.';
			logWrapper.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_PROMPT', message: errorMessage }
			};
		}

		// Parse taskId - handle numeric, alphanumeric, and subtask IDs
		let taskId;
		if (typeof id === 'string') {
			// Keep ID as string - supports numeric (1, 2), alphanumeric (TAS-49, JIRA-123), and subtask IDs (1.2, TAS-49.1)
			taskId = id;
		} else if (typeof id === 'number') {
			// Convert number to string for consistency
			taskId = id;
		} else {
			const errorMessage = `Invalid task ID type: ${typeof id}. Task ID must be a string or number.`;
			logWrapper.error(errorMessage);
			return {
				success: false,
				error: { code: 'INVALID_TASK_ID', message: errorMessage }
			};
		}

		// Use the provided path
		const tasksPath = tasksJsonPath;

		// Get research flag
		const useResearch = research === true;

		logWrapper.info(
			`Updating task with ID ${taskId} with prompt "${prompt}" and research: ${useResearch}`
		);

		const wasSilent = isSilentMode();
		if (!wasSilent) {
			enableSilentMode();
		}

		try {
			// BRIDGE: Check storage type and use different paths
			const storageType = tmCore.tasks.getStorageType();
			logWrapper.info(`Using ${storageType} storage for update operation`);

			if (storageType === 'api') {
				// API STORAGE: Skip old AI logic, send prompt directly to backend
				// The backend API will handle AI processing
				logWrapper.info('API storage detected - sending prompt to backend API');

				// Use updateWithPrompt for AI-powered updates
				await tmCore.tasks.updateWithPrompt(taskId, prompt, tag, {
					useResearch
				});

				logWrapper.success(
					`Successfully sent update prompt for task ${taskId} to API backend`
				);
				return {
					success: true,
					data: {
						message: `Successfully updated task with ID ${taskId} based on the prompt`,
						taskId: taskId,
						tasksPath: tasksPath,
						useResearch: useResearch,
						updated: true
					}
				};
			} else {
				// FILE STORAGE: Use old AI logic with context gathering and fuzzy search
				logWrapper.info('File storage detected - using legacy AI update logic');

				const coreResult = await updateTaskById(
					tasksPath,
					taskId,
					prompt,
					useResearch,
					{
						mcpLog: logWrapper,
						session,
						projectRoot,
						tag,
						commandName: 'update-task',
						outputType: 'mcp'
					},
					'json',
					append || false
				);

				// Check if the core function returned null or an object without success
				if (!coreResult || coreResult.updatedTask === null) {
					const message = `Task ${taskId} was not updated (likely already completed).`;
					logWrapper.info(message);
					return {
						success: true,
						data: {
							message: message,
							taskId: taskId,
							updated: false,
							telemetryData: coreResult?.telemetryData,
							tagInfo: coreResult?.tagInfo
						}
					};
				}

				// Save using tm-core (which will use file storage)
				try {
					logWrapper.info('Saving updated task via tm-core file storage');
					await tmCore.tasks.update(taskId, coreResult.updatedTask, tag);
					logWrapper.info('Task saved successfully via tm-core');
				} catch (storageError) {
					logWrapper.error(
						`Failed to save via tm-core: ${storageError.message}`
					);
					logWrapper.warn('Falling back to legacy file save');
				}

				const successMessage = `Successfully updated task with ID ${taskId} based on the prompt`;
				logWrapper.success(successMessage);
				return {
					success: true,
					data: {
						message: successMessage,
						taskId: taskId,
						tasksPath: tasksPath,
						useResearch: useResearch,
						updated: true,
						updatedTask: coreResult.updatedTask,
						telemetryData: coreResult.telemetryData,
						tagInfo: coreResult.tagInfo
					}
				};
			}
		} catch (error) {
			logWrapper.error(`Error updating task by ID: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'UPDATE_TASK_CORE_ERROR',
					message: error.message || 'Unknown error updating task'
				}
			};
		} finally {
			if (!wasSilent && isSilentMode()) {
				disableSilentMode();
			}
		}
	} catch (error) {
		logWrapper.error(`Setup error in updateTaskByIdDirect: ${error.message}`);
		if (isSilentMode()) disableSilentMode();
		return {
			success: false,
			error: {
				code: 'DIRECT_FUNCTION_SETUP_ERROR',
				message: error.message || 'Unknown setup error'
			}
		};
	}
}
