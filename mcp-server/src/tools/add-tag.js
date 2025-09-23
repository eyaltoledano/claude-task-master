/**
 * tools/add-tag.js
 * Tool to create a new tag
 */

import { z } from 'zod';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { addTagDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

/**
 * Register the addTag tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAddTagTool(server) {
	server.addTool({
		name: 'add_tag',
		description: 'Create a new tag for organizing tasks in different contexts',
		parameters: z.object({
			name: z.string().describe('Name of the new tag to create'),
			copyFromCurrent: z
				.boolean()
				.optional()
				.describe(
					'Whether to copy tasks from the current tag (default: false)'
				),
			copyFromTag: z
				.string()
				.optional()
				.describe('Specific tag to copy tasks from'),
			fromBranch: z
				.boolean()
				.optional()
				.describe(
					'Create tag name from current git branch (ignores name parameter)'
				),
			description: z
				.string()
				.optional()
				.describe('Optional description for the tag'),
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
				log.info(`Starting add-tag with args: ${JSON.stringify(args)}`);

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
				const result = await addTagDirect(
					{
						tasksJsonPath: tasksJsonPath,
						name: args.name,
						copyFromCurrent: args.copyFromCurrent,
						copyFromTag: args.copyFromTag,
						fromBranch: args.fromBranch,
						description: args.description,
						projectRoot: args.projectRoot
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error creating tag',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in add-tag tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
