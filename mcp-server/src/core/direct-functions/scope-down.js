/**
 * scope-down.js
 * Direct function implementation for scoping down task complexity
 */

import { scopeDownTask } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for scoping down task complexity with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.id - Comma-separated list of task IDs to scope down
 * @param {string} [args.strength='regular'] - Strength level (light, regular, heavy)
 * @param {string} [args.prompt] - Custom prompt for scoping adjustments
 * @param {string} [args.tasksJsonPath] - Path to the tasks.json file (resolved by tool)
 * @param {boolean} [args.research=false] - Whether to use research capabilities for scoping
 * @param {string} args.projectRoot - Project root path
 * @param {string} [args.tag] - Tag for the task context (optional)
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context (session)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function scopeDownDirect(args, log, context = {}) {
	// Destructure expected args
	const {
		tasksJsonPath,
		id,
		strength = 'regular',
		prompt: customPrompt,
		research = false,
		projectRoot,
		tag
	} = args;
	const { session } = context; // Destructure session from context

	// Enable silent mode to prevent console logs from interfering with JSON response
	enableSilentMode();

	// Create logger wrapper using the utility
	const mcpLog = createLogWrapper(log);

	try {
		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('scopeDownDirect called without tasksJsonPath');
			disableSilentMode(); // Disable before returning
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}

		// Check required parameters
		if (!id) {
			log.error('Missing required parameter: id');
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'MISSING_PARAMETER',
					message: 'The id parameter is required for scoping down tasks'
				}
			};
		}

		// Parse task IDs - convert to numbers as expected by scopeDownTask
		const taskIds = id.split(',').map((taskId) => parseInt(taskId.trim(), 10));

		log.info(
			`Scoping down tasks: ${taskIds.join(', ')}, strength: ${strength}, research: ${research}`
		);

		// Call the scopeDownTask function
		const result = await scopeDownTask(
			tasksJsonPath,
			taskIds,
			strength,
			customPrompt,
			{
				session,
				mcpLog,
				projectRoot,
				commandName: 'scope-down',
				outputType: 'mcp',
				tag,
				research
			},
			'json' // outputFormat
		);

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				updatedTasks: result.updatedTasks,
				tasksUpdated: result.updatedTasks.length,
				message: `Successfully scoped down ${result.updatedTasks.length} task(s)`,
				telemetryData: result.telemetryData
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in scopeDownDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: error.code || 'SCOPE_DOWN_ERROR',
				message: error.message
			}
		};
	}
}
