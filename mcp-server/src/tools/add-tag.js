/**
 * tools/add-tag.js
 * Tool to create a new tag
 */

import { z } from 'zod';
import { createErrorResponse, handleApiResult } from './utils.js';
import { addTagDirect } from '../core/task-master-core.js';
import { withTaskMaster } from '../../../src/task-master.js';

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
		execute: withTaskMaster({
			tasksPath: 'file',
			required: ['tasksPath']
		})(async (taskMaster, args, { log, session }) => {
			log.info(`Starting add-tag with args: ${JSON.stringify(args)}`);

			// Call the direct function
			const result = await addTagDirect(
				taskMaster,
				{
					name: args.name,
					copyFromCurrent: args.copyFromCurrent,
					copyFromTag: args.copyFromTag,
					fromBranch: args.fromBranch,
					description: args.description
				},
				log,
				{ session }
			);

			return handleApiResult(
				result,
				log,
				'Error creating tag',
				undefined,
				taskMaster.getProjectRoot()
			);
		})
	});
}
