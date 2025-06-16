/**
 * use-tag.js
 * Direct function implementation for switching to a tag
 */

import { useTag } from '../../../../scripts/modules/task-manager/tag-management.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for switching to a tag with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.name - Name of the tag to switch to
 * @param {string} [args.tasksJsonPath] - Path to the tasks.json file (resolved by tool)
 * @param {string} [args.projectRoot] - Project root path
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context (session)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function useTagDirect(args, log, context = {}) {
	// Destructure expected args
	const { tasksJsonPath, name, projectRoot } = args;
	const { session } = context;

	// Enable silent mode to prevent console logs from interfering with JSON response
	enableSilentMode();

	// Create logger wrapper using the utility
	const mcpLog = createLogWrapper(log);

	try {
		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('useTagDirect called without tasksJsonPath');
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

		log.info(`Switching to tag: ${name}`);

		// Call the useTag function
		const result = await useTag(
			tasksJsonPath,
			name,
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
				tagName: result.currentTag,
				switched: result.switched,
				previousTag: result.previousTag,
				taskCount: result.taskCount,
				message: `Successfully switched to tag "${result.currentTag}"`
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in useTagDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: error.code || 'USE_TAG_ERROR',
				message: error.message
			}
		};
	}
}
