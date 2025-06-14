/**
 * tools/add-subtask.js
 * Tool for adding subtasks to existing tasks
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { addSubtaskDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

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
			skipGenerate: z
				.boolean()
				.optional()
				.describe('Skip regenerating task files'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Adding subtask with args: ${JSON.stringify(args)}`);

				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				const result = await addSubtaskDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						taskId: args.taskId,
						title: args.title,
						description: args.description,
						details: args.details,
						status: args.status,
						dependencies: args.dependencies,
						skipGenerate: args.skipGenerate,
						projectRoot: args.projectRoot
					},
					log,
					{ session }
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
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in addSubtask tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
