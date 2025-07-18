/**
 * tools/validate-dependencies.js
 * Tool for validating task dependencies
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { validateDependenciesDirect } from '../core/task-master-core.js';

/**
 * Register the validateDependencies tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerValidateDependenciesTool(server) {
	server.addTool({
		name: 'validate_dependencies',
		description:
			'Check tasks for dependency issues (like circular references or links to non-existent tasks) without making changes.',
		parameters: z.object({
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withTaskMaster({
			paths: { tasksPath: 'file' }
		})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(`Validating dependencies with args: ${JSON.stringify(args)}`);

				const result = await validateDependenciesDirect(taskMaster, args, log);

				if (result.success) {
					log.info(
						`Successfully validated dependencies: ${result.data.message}`
					);
				} else {
					log.error(`Failed to validate dependencies: ${result.error.message}`);
				}

				return handleApiResult(
					result,
					log,
					'Error validating dependencies',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in validateDependencies tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
