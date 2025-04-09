/**
 * tools/validate-dependencies.js
 * Tool for validating task dependencies
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
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
				.optional()
				.describe(
					'Root directory of the project (default: current working directory)'
				)
		}),
		execute: async (args, { log, session, reportProgress }) => {
			try {
				log.info(`Validating dependencies with args: ${JSON.stringify(args)}`);
				await reportProgress({ progress: 0 });

				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				const result = await validateDependenciesDirect(
					{
						projectRoot: rootFolder,
						...args
					},
					log,
					{ reportProgress, mcpLog: log, session }
				);

				await reportProgress({ progress: 100 });

				if (result.success) {
					log.info(
						`Successfully validated dependencies: ${result.data.message}`
					);
				} else {
					log.error(`Failed to validate dependencies: ${result.error.message}`);
				}

				return handleApiResult(result, log, 'Error validating dependencies');
			} catch (error) {
				log.error(`Error in validateDependencies tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
