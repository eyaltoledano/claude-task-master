/**
 * update-subtask-by-id.js
 * Direct function implementation for appending information to a specific subtask
 */

import { updateSubtaskById } from '../../../../scripts/modules/task-manager.js';
import {
	disableSilentMode,
	enableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for updateSubtaskById with error handling.
 *
 * @param {Object} args - Command arguments containing id, prompt, useResearch, tasksJsonPath, and projectRoot.
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - Subtask ID in format "parent.sub".
 * @param {string} [args.prompt] - Information to append to the subtask. Required unless only updating metadata.
 * @param {boolean} [args.research] - Whether to use research role.
 * @param {Object} [args.metadata] - Parsed metadata object to merge into subtask metadata.
 * @param {string} [args.projectRoot] - Project root path.
 * @param {string} [args.tag] - Tag for the task (optional)
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateSubtaskByIdDirect(args, log, context = {}) {
	const { session } = context;
	// Destructure expected args, including projectRoot and metadata
	const { tasksJsonPath, id, prompt, research, metadata, projectRoot, tag } =
		args;

	const logWrapper = createLogWrapper(log);

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

		// Basic validation - ID must be present
		// In API storage, subtask IDs like "HAM-2611" are valid (no dot required)
		// In file storage, subtask IDs must be in format "parentId.subtaskId"
		// The core function handles storage-specific validation
		if (!id || typeof id !== 'string' || !id.trim()) {
			const errorMessage = 'Subtask ID cannot be empty.';
			logWrapper.error(errorMessage);
			return {
				success: false,
				error: { code: 'INVALID_SUBTASK_ID', message: errorMessage }
			};
		}

		// At least prompt or metadata is required (validated in MCP tool layer)
		if (!prompt && !metadata) {
			const errorMessage =
				'No prompt or metadata specified. Please provide information to append or metadata to update.';
			logWrapper.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_PROMPT', message: errorMessage }
			};
		}

		const subtaskIdStr = String(id).trim();

		// Use the provided path
		const tasksPath = tasksJsonPath;
		const useResearch = research === true;

		log.info(
			`Updating subtask with ID ${subtaskIdStr} with prompt "${prompt || '(metadata-only)'}" and research: ${useResearch}`
		);

		const wasSilent = isSilentMode();
		if (!wasSilent) {
			enableSilentMode();
		}

		try {
			// Call legacy script which handles both API and file storage via bridge
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
					outputType: 'mcp',
					metadata
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

			const parentId = subtaskIdStr.split('.')[0];
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
