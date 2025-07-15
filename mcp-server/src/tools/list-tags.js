/**
 * tools/list-tags.js
 * Tool to list all available tags
 */

import { z } from 'zod';
import { createErrorResponse, handleApiResult } from './utils.js';
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
			paths: { tasksPath: 'file' }
		})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(`Starting list-tags with args: ${JSON.stringify(args)}`);

				// Get tasks.json path from TaskMaster
				log.info(`Using tasks path: ${taskMaster.getTasksPath()}`);

				// Call the direct function
				const result = await listTagsDirect(
					taskMaster,
					{ showMetadata: args.showMetadata },
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
