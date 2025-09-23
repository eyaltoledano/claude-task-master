/**
 * tools/use-tag.js
 * Tool to switch to a different tag context
 */

import { z } from 'zod';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { useTagDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

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
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Starting use-tag with args: ${JSON.stringify(args)}`);

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
				const result = await useTagDirect(
					{
						tasksJsonPath: tasksJsonPath,
						name: args.name,
						projectRoot: args.projectRoot
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error switching tag',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in use-tag tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
