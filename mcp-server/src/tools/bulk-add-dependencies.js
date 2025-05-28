/**
 * tools/bulk-add-dependencies.js
 * Tool for adding dependencies to multiple tasks in bulk
 */
import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession,
	getTasksPathFromSession
} from './tool-utils.js';
import { bulkAddDependenciesDirect } from '../core/direct-functions/bulk-add-dependencies.js';
import { log } from '../../../scripts/modules/log.js';

export function registerBulkAddDependenciesTool(server) {
	server.addTool({
		name: 'bulk_add_dependencies',
		description:
			'Add dependencies to multiple tasks in bulk using range syntax (e.g., "7-10", "1,3-5"). Use this instead of multiple add_dependency calls for efficiency.',
		parameters: z.object({
			taskSpec: z
				.string()
				.describe(
					'Task specification string (e.g., "7-10", "11,12,15-16", "1.1-1.3"). This specifies the tasks that will depend on others.'
				),
			dependencySpec: z
				.string()
				.describe(
					'Dependency specification string (e.g., "1-5", "8,9"). This specifies the tasks that will become prerequisites.'
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
					`[Tool:bulk_add_dependencies] Called with taskSpec: "${params.taskSpec}", dependencySpec: "${params.dependencySpec}", tasksFile: "${tasksPath}", dryRun: ${params.dryRun}`
				);

				const result = await bulkAddDependenciesDirect({
					taskSpec: params.taskSpec,
					dependencySpec: params.dependencySpec,
					tasksFile: tasksPath,
					dryRun: params.dryRun,
					projectRoot
				});

				return handleApiResult(
					result,
					`Bulk dependency addition successful. ${result.message}`,
					`Bulk dependency addition failed. ${result.error}`
				);
			} catch (error) {
				log(
					'error',
					`[Tool:bulk_add_dependencies] Exception during execution: ${error.message}`,
					error
				);
				return createErrorResponse(
					`An unexpected error occurred in bulk_add_dependencies tool: ${
						error.message || 'Unknown error'
					}`
				);
			}
		}
	});
}
