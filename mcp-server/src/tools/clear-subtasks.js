/**
 * tools/clear-subtasks.js
 * Tool for clearing subtasks from parent tasks
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse
} from './utils.js';
import { clearSubtasksDirect } from '../core/task-master-core.js';
import { withTaskMaster } from '../../../src/task-master.js';

/**
 * Register the clearSubtasks tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerClearSubtasksTool(server) {
	server.addTool({
		name: 'clear_subtasks',
		description: 'Clear subtasks from specified tasks',
		parameters: z
			.object({
				id: z
					.string()
					.optional()
					.describe('Task IDs (comma-separated) to clear subtasks from'),
				all: z.boolean().optional().describe('Clear subtasks from all tasks'),
				file: z
					.string()
					.optional()
					.describe(
						'Absolute path to the tasks file (default: tasks/tasks.json)'
					),
				projectRoot: z
					.string()
					.describe('The directory of the project. Must be an absolute path.'),
				tag: z.string().optional().describe('Tag context to operate on')
			})
			.refine((data) => data.id || data.all, {
				message: "Either 'id' or 'all' parameter must be provided",
				path: ['id', 'all']
			}),
		execute: withTaskMaster({
			tasksPath: 'file',
			required: ['tasksPath']
		})(async (taskMaster, args, { log, session }) => {
			log.info(`Clearing subtasks with args: ${JSON.stringify(args)}`);

			const result = await clearSubtasksDirect(
				{
					tasksJsonPath: taskMaster.getTasksPath(),
					id: args.id,
					all: args.all,
					projectRoot: taskMaster.getProjectRoot(),
					tag: args.tag || 'master'
				},
				log,
				{ session }
			);

			if (result.success) {
				log.info(`Subtasks cleared successfully: ${result.data.message}`);
			} else {
				log.error(`Failed to clear subtasks: ${result.error.message}`);
			}

			return handleApiResult(
				result,
				log,
				'Error clearing subtasks',
				undefined,
				taskMaster.getProjectRoot()
			);
		})
	});
}
