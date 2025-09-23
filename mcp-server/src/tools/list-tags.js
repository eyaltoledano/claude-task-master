/**
 * tools/list-tags.js
 * Tool to list all available tags
 */

import { z } from 'zod';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { listTagsDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

/**
 * Register the listTags tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerListTagsTool(server) {
	server.addTool({
		name: 'list_tags',
		description: 'List all available tags with task counts and metadata',
		parameters: z.object({
			showMetadata: z
				.boolean()
				.optional()
				.describe('Whether to include metadata in the output (default: false)'),
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
				log.info(`Starting list-tags with args: ${JSON.stringify(args)}`);

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

				// Call the direct function
				const result = await listTagsDirect(
					{
						tasksJsonPath: tasksJsonPath,
						showMetadata: args.showMetadata,
						projectRoot: args.projectRoot
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error listing tags',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in list-tags tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
