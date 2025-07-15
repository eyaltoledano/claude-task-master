/**
 * tools/update-subtask.js
 * Tool to append additional information to a specific subtask
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { updateSubtaskByIdDirect } from '../core/task-master-core.js';

/**
 * Register the update-subtask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateSubtaskTool(server) {
	server.addTool({
		name: 'update_subtask',
		description:
			'Appends timestamped information to a specific subtask without replacing existing content. If you just want to update the subtask status, use set_task_status instead.',
		parameters: z.object({
			id: z
				.string()
				.describe(
					'ID of the subtask to update in format "parentId.subtaskId" (e.g., "5.2"). Parent ID is the ID of the task that contains the subtask.'
				),
			prompt: z.string().describe('Information to add to the subtask'),
			research: z
				.boolean()
				.optional()
				.describe('Use Perplexity AI for research-backed updates'),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withTaskMaster({
			paths: { tasksPath: 'file' }
		})(async (taskMaster, args, { log, session }) => {
			const toolName = 'update_subtask';
			try {
				log.info(`Updating subtask with args: ${JSON.stringify(args)}`);

				// Get tasks.json path from TaskMaster
				log.info(`${toolName}: Using tasks path: ${taskMaster.getTasksPath()}`);

				const result = await updateSubtaskByIdDirect(
					taskMaster,
					{
						id: args.id,
						prompt: args.prompt,
						research: args.research
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Successfully updated subtask with ID ${args.id}`);
				} else {
					log.error(
						`Failed to update subtask: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult(
					result,
					log,
					'Error updating subtask',
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
