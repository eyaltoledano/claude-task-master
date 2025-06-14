/**
 * tools/copy-tag.js
 * Tool to copy an existing tag to a new tag
 */

import { z } from 'zod';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { copyTagDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

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
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Starting copy-tag with args: ${JSON.stringify(args)}`);

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
				const result = await copyTagDirect(
					{
						tasksJsonPath: tasksJsonPath,
						sourceName: args.sourceName,
						targetName: args.targetName,
						description: args.description,
						projectRoot: args.projectRoot
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error copying tag',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in copy-tag tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
