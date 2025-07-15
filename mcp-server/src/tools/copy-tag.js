/**
 * tools/copy-tag.js
 * Tool to copy an existing tag to a new tag
 */

import { z } from 'zod';
import { createErrorResponse, handleApiResult } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { copyTagDirect } from '../core/task-master-core.js';

/**
 * Register the copyTag tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerCopyTagTool(server) {
	server.addTool({
		name: 'copy_tag',
		description:
			'Copy an existing tag to create a new tag with all tasks and metadata',
		parameters: z.object({
			sourceName: z.string().describe('Name of the source tag to copy from'),
			targetName: z.string().describe('Name of the new tag to create'),
			description: z
				.string()
				.optional()
				.describe('Optional description for the new tag'),
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
				log.info(`Starting copy-tag with args: ${JSON.stringify(args)}`);

				// Get tasks.json path from TaskMaster
				log.info(`Using tasks path: ${taskMaster.getTasksPath()}`);

				// Call the direct function
				const result = await copyTagDirect(
					taskMaster,
					{
						sourceName: args.sourceName,
						targetName: args.targetName,
						description: args.description
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error copying tag',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in copy-tag tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
