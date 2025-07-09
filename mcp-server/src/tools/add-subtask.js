/**
 * tools/add-subtask.js
 * Tool for adding subtasks to existing tasks
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { addSubtaskDirect } from '../core/task-master-core.js';
import { withTaskMaster } from '../../../src/task-master.js';

/**
 * Register the addSubtask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAddSubtaskTool(server) {
	server.addTool({
		name: 'add_subtask',
		description: 'Add a subtask to an existing task',
		parameters: z.object({
			id: z.string().describe('Parent task ID (required)'),
			taskId: z
				.string()
				.optional()
				.describe('Existing task ID to convert to subtask'),
			title: z
				.string()
				.optional()
				.describe('Title for the new subtask (when creating a new subtask)'),
			description: z
				.string()
				.optional()
				.describe('Description for the new subtask'),
			details: z
				.string()
				.optional()
				.describe('Implementation details for the new subtask'),
			status: z
				.string()
				.optional()
				.describe("Status for the new subtask (default: 'pending')"),
			dependencies: z
				.string()
				.optional()
				.describe('Comma-separated list of dependency IDs for the new subtask'),
			file: z
				.string()
				.optional()
				.describe(
					'Absolute path to the tasks file (default: tasks/tasks.json)'
				),
			tag: z.string().optional().describe('Tag context to operate on'),
			skipGenerate: z
				.boolean()
				.optional()
				.describe('Skip regenerating task files'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withTaskMaster({
			tasksPath: 'file',
			required: ['tasksPath']
		})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(`Adding subtask with args: ${JSON.stringify(args)}`);

				const result = await addSubtaskDirect(
					taskMaster,
					{
						id: args.id,
						taskId: args.taskId,
						title: args.title,
						description: args.description,
						details: args.details,
						status: args.status,
						dependencies: args.dependencies,
						skipGenerate: args.skipGenerate,
						tag: args.tag
					},
					log
				);

				if (result.success) {
					log.info(`Subtask added successfully: ${result.data.message}`);
				} else {
					log.error(`Failed to add subtask: ${result.error.message}`);
				}

				return handleApiResult(
					result,
					log,
					'Error adding subtask',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in add-subtask tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
