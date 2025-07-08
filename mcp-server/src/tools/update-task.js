/**
 * tools/update-task.js
 * Tool to update a single task by ID with new information
 */

import { z } from 'zod';
import {
	
	handleApiResult,
	createErrorResponse

} from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { updateTaskByIdDirect } from '../core/task-master-core.js';

/**
 * Register the update-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateTaskTool(server) {
	server.addTool({
		name: 'update_task',
		description:
			'Updates a single task by ID with new information or context provided in the prompt.',
		parameters: z.object({
			id: z
				.string() // ID can be number or string like "1.2"
				.describe(
					"ID of the task (e.g., '15') to update. Subtasks are supported using the update-subtask tool."
				),
			prompt: z
				.string()
				.describe('New information or context to incorporate into the task'),
			research: z
				.boolean()
				.optional()
				.describe('Use Perplexity AI for research-backed updates'),
			append: z
				.boolean()
				.optional()
				.describe(
					'Append timestamped information to task details instead of full update'
				),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withTaskMaster({
			tasksPath: 'file',
			required: ['tasksPath']
		})(async (taskMaster, args, { log, session }) => {
			const toolName = 'update_task';
			try {
				log.info(
					`Executing ${toolName} tool with args: ${JSON.stringify(args)}`
				);

				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: taskMaster.getProjectRoot(), file: args.file },
						log
					);
					log.info(`${toolName}: Resolved tasks path: ${tasksJsonPath}`);
				} catch (error) {
					log.error(`${toolName}: Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				// 3. Call Direct Function - Include projectRoot
				const result = await updateTaskByIdDirect(
					{
						tasksJsonPath: taskMaster.getTasksPath(),
						id: args.id,
						prompt: args.prompt,
						research: args.research,
						append: args.append,
						projectRoot: taskMaster.getProjectRoot()
					},
					log,
					{ session }
				);

				// 4. Handle Result
				log.info(
					`${toolName}: Direct function result: success=${result.success}`
				);
				return handleApiResult(
					result,
					log,
					'Error updating task',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(
					`Critical error in ${toolName} tool execute: ${error.message}`
				);
				return createErrorResponse(
					`Internal tool error (${toolName}): ${error.message}`
				);
			}
		})
	});
}
