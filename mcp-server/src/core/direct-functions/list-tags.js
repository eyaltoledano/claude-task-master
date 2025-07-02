/**
 * list-tags.js
 * Direct function implementation for listing all tags
 */

import { tags } from '../../../../scripts/modules/task-manager/tag-management.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for listing all tags with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {boolean} [args.showMetadata=false] - Whether to include metadata in the output
 * @param {string} [args.tasksJsonPath] - Path to the tasks.json file (resolved by tool)
 * @param {string} [args.projectRoot] - Project root path
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context (session)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function listTagsDirect(args, log, context = {}) {
	// Destructure expected args
	const { tasksJsonPath, showMetadata = false, projectRoot } = args;
	const { session } = context;

	// Enable silent mode to prevent console logs from interfering with JSON response
	enableSilentMode();

	// Create logger wrapper using the utility
	const mcpLog = createLogWrapper(log);

	try {
		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('listTagsDirect called without tasksJsonPath');
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}

		log.info('Listing all tags');

		// Prepare options
		const options = {
			showMetadata
		};

		// Call the tags function
		const result = await tags(
			tasksJsonPath,
			options,
			{
				session,
				mcpLog,
				projectRoot
			},
			'json' // outputFormat - use 'json' to suppress CLI UI
		);

		// Transform the result to remove full task data and provide summary info
		const tagsSummary = result.tags.map((tag) => {
			const tasks = tag.tasks || [];

			// Calculate status breakdown
			const statusBreakdown = tasks.reduce((acc, task) => {
				const status = task.status || 'pending';
				acc[status] = (acc[status] || 0) + 1;
				return acc;
			}, {});

			// Calculate subtask counts
			const subtaskCounts = tasks.reduce(
				(acc, task) => {
					if (task.subtasks && task.subtasks.length > 0) {
						acc.totalSubtasks += task.subtasks.length;
						task.subtasks.forEach((subtask) => {
							const subStatus = subtask.status || 'pending';
							acc.subtasksByStatus[subStatus] =
								(acc.subtasksByStatus[subStatus] || 0) + 1;
						});
					}
					return acc;
				},
				{ totalSubtasks: 0, subtasksByStatus: {} }
			);

			return {
				name: tag.name,
				isCurrent: tag.isCurrent,
				taskCount: tasks.length,
				completedTasks: tag.completedTasks,
				statusBreakdown,
				subtaskCounts,
				created: tag.created,
				description: tag.description
			};
		});

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				tags: tagsSummary,
				currentTag: result.currentTag,
				totalTags: result.totalTags,
				message: `Found ${result.totalTags} tag(s)`
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in listTagsDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: error.code || 'LIST_TAGS_ERROR',
				message: error.message
			}
		};
	}
}
