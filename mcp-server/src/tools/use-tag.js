/**
 * tools/use-tag.js
 * Tool to switch to a different tag context
 */

import { z } from 'zod';
import { createErrorResponse, handleApiResult } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { useTagDirect } from '../core/task-master-core.js';

/**
 * Register the useTag tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUseTagTool(server) {
	server.addTool({
		name: 'use_tag',
		description: 'Switch to a different tag context for task operations',
		parameters: z.object({
			name: z.string().describe('Name of the tag to switch to'),
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
				log.info(`Starting use-tag with args: ${JSON.stringify(args)}`);

				// Get tasks.json path from TaskMaster
				log.info(`Using tasks path: ${taskMaster.getTasksPath()}`);

				// Call the direct function
				const result = await useTagDirect(
					taskMaster,
					{ name: args.name },
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error switching tag',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in use-tag tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
