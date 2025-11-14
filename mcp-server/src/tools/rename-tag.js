/**
 * tools/rename-tag.js
 * Tool to rename an existing tag
 */

import { z } from 'zod';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { renameTagDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

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
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Starting rename-tag with args: ${JSON.stringify(args)}`);

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
				const result = await renameTagDirect(
					{
						tasksJsonPath: tasksJsonPath,
						oldName: args.oldName,
						newName: args.newName,
						projectRoot: args.projectRoot
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error renaming tag',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in rename-tag tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
