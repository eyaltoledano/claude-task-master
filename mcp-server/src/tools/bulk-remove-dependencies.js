/**
 * tools/bulk-remove-dependencies.js
 * Tool for removing dependencies from multiple tasks in bulk
 */
import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession,
	getTasksPathFromSession
} from './tool-utils.js';
import { bulkRemoveDependenciesDirect } from '../core/direct-functions/bulk-remove-dependencies.js';
import { log } from '../../../scripts/modules/log.js';

export function registerBulkRemoveDependenciesTool(server) {
	server.addTool({
		name: 'bulk_remove_dependencies',
		description:
			'Remove dependencies from multiple tasks in bulk using range syntax (e.g., "7-10", "1,3-5"). Use this instead of multiple remove_dependency calls for efficiency.',
		parameters: z.object({
			taskSpec: z
				.string()
				.describe(
					'Task specification string (e.g., "7-10", "11,12,15-16", "1.1-1.3"). This specifies the tasks from which dependencies will be removed.'
				),
			dependencySpec: z
				.string()
				.describe(
					'Dependency specification string (e.g., "1-5", "8,9"). This specifies the tasks that will be removed as prerequisites.'
				),
			tasksFile: z
				.string()
				.optional()
				.describe(
					'Optional: Path to the tasks file, relative to the project root. Defaults to "tasks/tasks.json" or the path from session.'
				),
			dryRun: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					'Optional: If true, only validate and show what would be done without making changes. Defaults to false.'
				)
		}),
		execute: async (params, session) => {
			try {
				const projectRoot = getProjectRootFromSession(session);
				const tasksPath =
					params.tasksFile ||
					getTasksPathFromSession(session) ||
					'tasks/tasks.json';

				log(
					'info',
					`[Tool:bulk_remove_dependencies] Called with taskSpec: "${params.taskSpec}", dependencySpec: "${params.dependencySpec}", tasksFile: "${tasksPath}", dryRun: ${params.dryRun}`
				);

				const result = await bulkRemoveDependenciesDirect({
					taskSpec: params.taskSpec,
					dependencySpec: params.dependencySpec,
					tasksFile: tasksPath,
					dryRun: params.dryRun,
					projectRoot
				});

				return handleApiResult(
					result,
					`Bulk dependency removal successful. ${result.message}`,
					`Bulk dependency removal failed. ${result.error}`
				);
			} catch (error) {
				log(
					'error',
					`[Tool:bulk_remove_dependencies] Exception during execution: ${error.message}`,
					error
				);
				return createErrorResponse(
					`An unexpected error occurred in bulk_remove_dependencies tool: ${
						error.message || 'Unknown error'
					}`
				);
			}
		}
	});
}
