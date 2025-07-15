/**
 * tools/rename-tag.js
 * Tool to rename an existing tag
 */

import { z } from 'zod';
import { createErrorResponse, handleApiResult } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { renameTagDirect } from '../core/task-master-core.js';

/**
 * Register the renameTag tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerRenameTagTool(server) {
	server.addTool({
		name: 'rename_tag',
		description: 'Rename an existing tag',
		parameters: z.object({
			oldName: z.string().describe('Current name of the tag to rename'),
			newName: z.string().describe('New name for the tag'),
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
				log.info(`Starting rename-tag with args: ${JSON.stringify(args)}`);

				// Get tasks.json path from TaskMaster
				log.info(`Using tasks path: ${taskMaster.getTasksPath()}`);

				// Call the direct function
				const result = await renameTagDirect(
					taskMaster,
					{ oldName: args.oldName, newName: args.newName },
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error renaming tag',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in rename-tag tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
