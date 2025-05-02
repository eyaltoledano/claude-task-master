/**
 * tools/update-subtask.js
 * Tool to append additional information to a specific subtask
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { updateSubtaskByIdDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';
import path from 'path';

/**
 * Register the update-subtask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateSubtaskTool(server) {
	server.addTool({
		name: 'update_subtask',
		description:
			'Appends timestamped information to a specific subtask without replacing existing content',
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
		execute: async (args, { log, session }) => {
			const toolName = 'update_subtask';
			try {
				log.info(`Updating subtask with args: ${JSON.stringify(args)}`);

				// 1. Get Project Root
				const rootFolder = args.projectRoot;
				if (!rootFolder || !path.isAbsolute(rootFolder)) {
					log.error(
						`${toolName}: projectRoot is required and must be absolute.`
					);
					return createErrorResponse(
						'projectRoot is required and must be absolute.'
					);
				}
				log.info(`${toolName}: Project root: ${rootFolder}`);

				// 2. Resolve Tasks Path
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksJsonPath(
						{ projectRoot: rootFolder, file: args.file },
						log
					);
				} catch (error) {
					log.error(`${toolName}: Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json within project root '${rootFolder}': ${error.message}`
					);
				}

				// 3. Call Direct Function - Include projectRoot
				const result = await updateSubtaskByIdDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						prompt: args.prompt,
						research: args.research,
						projectRoot: rootFolder
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

				return handleApiResult(result, log, 'Error updating subtask');
			} catch (error) {
				log.error(
					`Critical error in ${toolName} tool execute: ${error.message}`
				);
				return createErrorResponse(
					`Internal tool error (${toolName}): ${error.message}`
				);
			}
		}
	});
}
