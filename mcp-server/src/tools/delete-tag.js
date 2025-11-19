/**
 * tools/delete-tag.js
 * Tool to delete an existing tag
 */

import { z } from 'zod';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { deleteTagDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

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
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Starting delete-tag with args: ${JSON.stringify(args)}`);

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

				// Call the direct function (always skip confirmation for MCP)
				const result = await deleteTagDirect(
					{
						tasksJsonPath: tasksJsonPath,
						name: args.name,
						yes: args.yes !== undefined ? args.yes : true, // Default to true for MCP
						projectRoot: args.projectRoot
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error deleting tag',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in delete-tag tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
