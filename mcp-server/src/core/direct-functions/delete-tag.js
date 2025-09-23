/**
 * delete-tag.js
 * Direct function implementation for deleting a tag
 */

import { deleteTag } from '../../../../scripts/modules/task-manager/tag-management.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for deleting a tag with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.name - Name of the tag to delete
 * @param {boolean} [args.yes=false] - Skip confirmation prompts
 * @param {string} [args.tasksJsonPath] - Path to the tasks.json file (resolved by tool)
 * @param {string} [args.projectRoot] - Project root path
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context (session)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function deleteTagDirect(args, log, context = {}) {
	// Destructure expected args
	const { tasksJsonPath, name, yes = false, projectRoot } = args;
	const { session } = context;

	// Enable silent mode to prevent console logs from interfering with JSON response
	enableSilentMode();

	// Create logger wrapper using the utility
	const mcpLog = createLogWrapper(log);

	try {
		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('deleteTagDirect called without tasksJsonPath');
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}

		// Check required parameters
		if (!name || typeof name !== 'string') {
			log.error('Missing required parameter: name');
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'MISSING_PARAMETER',
					message: 'Tag name is required and must be a string'
				}
			};
		}

		log.info(`Deleting tag: ${name}`);

		// Prepare options
		const options = {
			yes // For MCP, we always skip confirmation prompts
		};

		// Call the deleteTag function
		const result = await deleteTag(
			tasksJsonPath,
			name,
			options,
			{
				session,
				mcpLog,
				projectRoot
			},
			'json' // outputFormat - use 'json' to suppress CLI UI
		);

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				tagName: result.tagName,
				deleted: result.deleted,
				tasksDeleted: result.tasksDeleted,
				wasCurrentTag: result.wasCurrentTag,
				switchedToMaster: result.switchedToMaster,
				message: `Successfully deleted tag "${result.tagName}"`
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in deleteTagDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: error.code || 'DELETE_TAG_ERROR',
				message: error.message
			}
		};
	}
}
