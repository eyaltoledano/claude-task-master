/**
 * update-subtask-by-id.js
 * Direct function implementation for appending information to a specific subtask
 */

import { updateSubtaskById } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';
import { createTmCore } from '@tm/core';

/**
 * Direct function wrapper for updateSubtaskById with error handling.
 *
 * @param {Object} args - Command arguments containing id, prompt, useResearch, tasksJsonPath, and projectRoot.
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - Subtask ID in format "parent.sub".
 * @param {string} args.prompt - Information to append to the subtask.
 * @param {boolean} [args.research] - Whether to use research role.
 * @param {string} [args.projectRoot] - Project root path.
 * @param {string} [args.tag] - Tag for the task (optional)
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateSubtaskByIdDirect(args, log, context = {}) {
	const { session } = context;
	// Destructure expected args, including projectRoot
	const { tasksJsonPath, id, prompt, research, projectRoot, tag } = args;

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
			`Updating subtask by ID via direct function. ID: ${id}, ProjectRoot: ${projectRoot}`
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

		// Basic validation for ID format (e.g., '5.2')
		if (!id || typeof id !== 'string' || !id.includes('.')) {
			const errorMessage =
				'Invalid subtask ID format. Must be in format "parentId.subtaskId" (e.g., "5.2").';
			logWrapper.error(errorMessage);
			return {
				success: false,
				error: { code: 'INVALID_SUBTASK_ID', message: errorMessage }
			};
		}

		if (!prompt) {
			const errorMessage =
				'No prompt specified. Please provide the information to append.';
			logWrapper.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_PROMPT', message: errorMessage }
			};
		}

		// Validate subtask ID format
		const subtaskId = id;
		if (typeof subtaskId !== 'string' && typeof subtaskId !== 'number') {
			const errorMessage = `Invalid subtask ID type: ${typeof subtaskId}. Subtask ID must be a string or number.`;
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'INVALID_SUBTASK_ID_TYPE', message: errorMessage }
			};
		}

		const subtaskIdStr = String(subtaskId);
		if (!subtaskIdStr.includes('.')) {
			const errorMessage = `Invalid subtask ID format: ${subtaskIdStr}. Subtask ID must be in format "parentId.subtaskId" (e.g., "5.2").`;
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'INVALID_SUBTASK_ID_FORMAT', message: errorMessage }
			};
		}

		// Use the provided path
		const tasksPath = tasksJsonPath;
		const useResearch = research === true;

		log.info(
			`Updating subtask with ID ${subtaskIdStr} with prompt "${prompt}" and research: ${useResearch}`
		);

		const wasSilent = isSilentMode();
		if (!wasSilent) {
			enableSilentMode();
		}

		try {
			// BRIDGE: Check storage type and use different paths
			const storageType = tmCore.tasks.getStorageType();
			logWrapper.info(`Using ${storageType} storage for subtask update operation`);

			if (storageType === 'api') {
				// API STORAGE: In API storage, there's no parent/subtask hierarchy
				// TAS-49.1 is just another task with a unique ID, send prompt to backend
				logWrapper.info('API storage detected - sending prompt to backend API for subtask');

				// Use updateWithPrompt for AI-powered updates
				await tmCore.tasks.updateWithPrompt(
					subtaskIdStr,
					prompt,
					tag,
					{ useResearch }
				);

				logWrapper.success(`Successfully sent update prompt for task ${subtaskIdStr} to API backend`);
				return {
					success: true,
					data: {
						message: `Successfully updated subtask with ID ${subtaskIdStr}`,
						subtaskId: subtaskIdStr,
						parentId: subtaskIdStr.split('.')[0],
						tasksPath,
						useResearch
					}
				};
			} else {
				// FILE STORAGE: Has parent/subtask hierarchy, use legacy AI logic
				const parentId = subtaskIdStr.split('.')[0];
				// FILE STORAGE: Use old AI logic with context gathering
				logWrapper.info('File storage detected - using legacy AI update logic');

				const coreResult = await updateSubtaskById(
					tasksPath,
					subtaskIdStr,
					prompt,
					useResearch,
					{
						mcpLog: logWrapper,
						session,
						projectRoot,
						tag,
						commandName: 'update-subtask',
						outputType: 'mcp'
					},
					'json'
				);

				if (!coreResult || coreResult.updatedSubtask === null) {
					const message = `Subtask ${id} or its parent task not found.`;
					logWrapper.error(message);
					return {
						success: false,
						error: { code: 'SUBTASK_NOT_FOUND', message: message }
					};
				}

				// Save parent task using tm-core
				try {
					logWrapper.info(`Loading parent task ${parentId} to save subtask update via tm-core`);

					const parentTask = await tmCore.tasks.get(parentId, tag);
					if (parentTask && parentTask.task) {
						logWrapper.info('Saving parent task via tm-core file storage');
						await tmCore.tasks.update(parentId, parentTask.task, tag);
						logWrapper.info('Parent task with updated subtask saved successfully via tm-core');
					}
				} catch (storageError) {
					logWrapper.error(`Failed to save via tm-core: ${storageError.message}`);
					logWrapper.warn('Falling back to legacy file save');
				}

				const successMessage = `Successfully updated subtask with ID ${subtaskIdStr}`;
				logWrapper.success(successMessage);
				return {
					success: true,
					data: {
						message: `Successfully updated subtask with ID ${subtaskIdStr}`,
						subtaskId: subtaskIdStr,
						parentId: parentId,
						subtask: coreResult.updatedSubtask,
						tasksPath,
						useResearch,
						telemetryData: coreResult.telemetryData,
						tagInfo: coreResult.tagInfo
					}
				};
			}
		} catch (error) {
			logWrapper.error(`Error updating subtask by ID: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'UPDATE_SUBTASK_CORE_ERROR',
					message: error.message || 'Unknown error updating subtask'
				}
			};
		} finally {
			if (!wasSilent && isSilentMode()) {
				disableSilentMode();
			}
		}
	} catch (error) {
		logWrapper.error(
			`Setup error in updateSubtaskByIdDirect: ${error.message}`
		);
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
