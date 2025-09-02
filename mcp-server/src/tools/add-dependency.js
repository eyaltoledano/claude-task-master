/**
 * tools/add-dependency.js
 * Tool for adding a dependency to a task
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { addDependencyDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';
import i18n from '../../i18n.js';

/**
 * Register the addDependency tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAddDependencyTool(server) {
	server.addTool({
		name: 'add_dependency',
		description: i18n.t('tools.addDependency.description'),
		parameters: z.object({
			id: z.string().describe(i18n.t('tools.addDependency.params.id')),
			dependsOn: z
				.string()
				.describe(i18n.t('tools.addDependency.params.dependsOn')),
			file: z
				.string()
				.optional()
				.describe(i18n.t('tools.addDependency.params.file')),
			projectRoot: z
				.string()
				.describe(i18n.t('tools.addDependency.params.projectRoot')),
			tag: z.string().optional().describe(i18n.t('tools.addDependency.params.tag'))
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(
					i18n.t('tools.addDependency.logs.addingDependency', { id: args.id, dependsOn: args.dependsOn })
				);
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
				} catch (error) {
					log.error(i18n.t('tools.addDependency.logs.errorFindingTasksJson', { message: error.message }));
					return createErrorResponse(
						i18n.t('tools.addDependency.logs.failedToFindTasksJson', { message: error.message })
					);
				}

				// Call the direct function with the resolved path
				const result = await addDependencyDirect(
					{
						// Pass the explicitly resolved path
						tasksJsonPath: tasksJsonPath,
						// Pass other relevant args
						id: args.id,
						dependsOn: args.dependsOn,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log
					// Remove context object
				);

				// Log result
				if (result.success) {
					log.info(i18n.t('tools.addDependency.logs.success', { message: result.data.message }));
				} else {
					log.error(i18n.t('tools.addDependency.logs.failed', { message: result.error.message }));
				}

				// Use handleApiResult to format the response
				return handleApiResult(
					result,
					log,
					i18n.t('tools.addDependency.logs.error'),
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(i18n.t('tools.addDependency.logs.toolError', { message: error.message }));
				return createErrorResponse(error.message);
			}
		})
	});
}
