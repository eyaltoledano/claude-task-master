/**
 * rename-tag.js
 * Direct function implementation for renaming a tag
 */

import { renameTag } from '../../../../scripts/modules/task-manager/tag-management.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for renaming a tag with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.oldName - Current name of the tag to rename
 * @param {string} args.newName - New name for the tag
 * @param {string} [args.tasksJsonPath] - Path to the tasks.json file (resolved by tool)
 * @param {string} [args.projectRoot] - Project root path
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context (session)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function renameTagDirect(args, log, context = {}) {
	// Destructure expected args
	const { tasksJsonPath, oldName, newName, projectRoot } = args;
	const { session } = context;

	// Enable silent mode to prevent console logs from interfering with JSON response
	enableSilentMode();

	// Create logger wrapper using the utility
	const mcpLog = createLogWrapper(log);

	try {
		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('renameTagDirect called without tasksJsonPath');
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
		if (!oldName || typeof oldName !== 'string') {
			log.error('Missing required parameter: oldName');
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'MISSING_PARAMETER',
					message: 'Old tag name is required and must be a string'
				}
			};
		}

		if (!newName || typeof newName !== 'string') {
			log.error('Missing required parameter: newName');
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'MISSING_PARAMETER',
					message: 'New tag name is required and must be a string'
				}
			};
		}

		log.info(`Renaming tag from "${oldName}" to "${newName}"`);

		// Call the renameTag function
		const result = await renameTag(
			tasksJsonPath,
			oldName,
			newName,
			{}, // options (empty for now)
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
				oldName: result.oldName,
				newName: result.newName,
				renamed: result.renamed,
				taskCount: result.taskCount,
				wasCurrentTag: result.wasCurrentTag,
				message: `Successfully renamed tag from "${result.oldName}" to "${result.newName}"`
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in renameTagDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: error.code || 'RENAME_TAG_ERROR',
				message: error.message
			}
		};
	}
}
