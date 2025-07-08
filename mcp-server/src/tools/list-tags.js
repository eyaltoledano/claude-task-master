/**
 * tools/list-tags.js
 * Tool to list all available tags
 */

import { z } from 'zod';
import {
	
	createErrorResponse,
	handleApiResult

} from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { listTagsDirect } from '../core/task-master-core.js';

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
		execute: withTaskMaster({
			tasksPath: 'file',
			required: ['tasksPath']
		})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(`Starting list-tags with args: ${JSON.stringify(args)}`);

				// Use taskMaster.getProjectRoot() directly (guaranteed by withNormalizedProjectRoot)
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

				// Call the direct function
				const result = await listTagsDirect(
					{
						tasksJsonPath: taskMaster.getTasksPath(),
						showMetadata: args.showMetadata,
						projectRoot: taskMaster.getProjectRoot()
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error listing tags',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in list-tags tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
