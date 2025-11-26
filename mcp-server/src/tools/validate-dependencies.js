/**
 * tools/validate-dependencies.js
 * Tool for validating task dependencies
 */

import { createErrorResponse, handleApiResult, withToolContext } from '@tm/mcp';
import { z } from 'zod';
import { resolveTag } from '../../../scripts/modules/utils.js';
import { validateDependenciesDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

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
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withToolContext(
			'validate-dependencies',
			async (args, { log, session }) => {
				try {
					const resolvedTag = resolveTag({
						projectRoot: args.projectRoot,
						tag: args.tag
					});
					log.info(
						`Validating dependencies with args: ${JSON.stringify(args)}`
					);

					// Use args.projectRoot directly (guaranteed by withToolContext)
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

					const result = await validateDependenciesDirect(
						{
							tasksJsonPath: tasksJsonPath,
							projectRoot: args.projectRoot,
							tag: resolvedTag
						},
						log
					);

					if (result.success) {
						log.info(
							`Successfully validated dependencies: ${result.data.message}`
						);
					} else {
						log.error(
							`Failed to validate dependencies: ${result.error.message}`
						);
					}

					return handleApiResult({
						result,
						log,
						errorPrefix: 'Error validating dependencies',
						projectRoot: args.projectRoot,
						tag: resolvedTag
					});
				} catch (error) {
					log.error(`Error in validateDependencies tool: ${error.message}`);
					return createErrorResponse(error.message);
				}
			}
		)
	});
}
