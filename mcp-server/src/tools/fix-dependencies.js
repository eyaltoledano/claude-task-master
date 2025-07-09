/**
 * tools/fix-dependencies.js
 * Tool for automatically fixing invalid task dependencies
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { fixDependenciesDirect } from '../core/task-master-core.js';

/**
 * Register the fixDependencies tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerFixDependenciesTool(server) {
	server.addTool({
		name: 'fix_dependencies',
		description: 'Fix invalid dependencies in tasks automatically',
		parameters: z.object({
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withTaskMaster({
			tasksPath: 'file',
			required: ['tasksPath']
		})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(`Fixing dependencies with args: ${JSON.stringify(args)}`);

				const result = await fixDependenciesDirect(
					taskMaster,
					{
						tag: args.tag
					},
					log
				);

				if (result.success) {
					log.info(`Successfully fixed dependencies: ${result.data.message}`);
				} else {
					log.error(`Failed to fix dependencies: ${result.error.message}`);
				}

				return handleApiResult(
					result,
					log,
					'Error fixing dependencies',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in fixDependencies tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
