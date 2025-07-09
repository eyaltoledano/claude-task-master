/**
 * tools/delete-tag.js
 * Tool to delete an existing tag
 */

import { z } from 'zod';
import { createErrorResponse, handleApiResult } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { deleteTagDirect } from '../core/task-master-core.js';

/**
 * Register the deleteTag tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerDeleteTagTool(server) {
	server.addTool({
		name: 'delete_tag',
		description: 'Delete an existing tag and all its tasks',
		parameters: z.object({
			name: z.string().describe('Name of the tag to delete'),
			yes: z
				.boolean()
				.optional()
				.describe('Skip confirmation prompts (default: true for MCP)'),
			file: z
				.string()
				.optional()
				.describe('Path to the tasks file (default: tasks/tasks.json)'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withTaskMaster({
			tasksPath: 'file',
			required: ['tasksPath']
		})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(`Starting delete-tag with args: ${JSON.stringify(args)}`);

				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: taskMaster.getProjectRoot(), file: args.file },
						log
					);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				// Call the direct function (always skip confirmation for MCP)
				const result = await deleteTagDirect(
					taskMaster,
					{ name: args.name, yes: args.yes !== undefined ? args.yes : true }, // Default to true for MCP
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error deleting tag',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in delete-tag tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
