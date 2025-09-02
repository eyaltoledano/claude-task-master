/**
 * tools/add-subtask.js
 * Tool for adding subtasks to existing tasks
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { addSubtaskDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';
import i18n from '../../i18n.js';

/**
 * Register the addSubtask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAddSubtaskTool(server) {
	server.addTool({
		name: 'add_subtask',
		description: i18n.t('tools.addSubtask.description'),
		parameters: z.object({
			id: z.string().describe(i18n.t('tools.addSubtask.params.id')),
			taskId: z
				.string()
				.optional()
				.describe(i18n.t('tools.addSubtask.params.taskId')),
			title: z
				.string()
				.optional()
				.describe(i18n.t('tools.addSubtask.params.title')),
			description: z
				.string()
				.optional()
				.describe(i18n.t('tools.addSubtask.params.description')),
			details: z
				.string()
				.optional()
				.describe(i18n.t('tools.addSubtask.params.details')),
			status: z
				.string()
				.optional()
				.describe(i18n.t('tools.addSubtask.params.status')),
			dependencies: z
				.string()
				.optional()
				.describe(i18n.t('tools.addSubtask.params.dependencies')),
			file: z
				.string()
				.optional()
				.describe(i18n.t('tools.addSubtask.params.file')),
			skipGenerate: z
				.boolean()
				.optional()
				.describe(i18n.t('tools.addSubtask.params.skipGenerate')),
			projectRoot: z
				.string()
				.describe(i18n.t('tools.addSubtask.params.projectRoot')),
			tag: z.string().optional().describe(i18n.t('tools.addSubtask.params.tag'))
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
				log.info(i18n.t('tools.addSubtask.logs.addingSubtask', { args: JSON.stringify(args) }));

				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
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

				const result = await addSubtaskDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						taskId: args.taskId,
						title: args.title,
						description: args.description,
						details: args.details,
						status: args.status,
						dependencies: args.dependencies,
						skipGenerate: args.skipGenerate,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(i18n.t('tools.addSubtask.logs.success', { message: result.data.message }));
				} else {
					log.error(i18n.t('tools.addSubtask.logs.failed', { message: result.error.message }));
				}

				return handleApiResult(
					result,
					log,
					i18n.t('tools.addSubtask.logs.error'),
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(i18n.t('tools.addSubtask.logs.toolError', { message: error.message }));
				return createErrorResponse(error.message);
			}
		})
	});
}
