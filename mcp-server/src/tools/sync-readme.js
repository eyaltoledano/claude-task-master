/**
 * sync-readme.js
 * MCP tool for syncing tasks to README.md file
 */

import { z } from 'zod';
import { createErrorResponse, createContentResponse } from './utils.js';
import logger from '../logger.js';

/**
 * Register the sync_readme tool
 * @param {Object} server - FastMCP server instance
 */
export function registerSyncReadmeTool(server) {
	server.addTool({
		name: 'sync_readme',
		description: 'Sync the current task list to README.md in the project root with professional formatting',
		parameters: z.object({
			withSubtasks: z.boolean().optional().describe('Include subtasks in the README output (default: false)'),
			status: z.string().optional().describe('Filter tasks by status (e.g., "pending", "done", "in-progress")'),
			tasksPath: z.string().optional().describe('Custom path to tasks.json file (optional)')
		}),
		execute: async (args, { log }) => {
			try {
				const { withSubtasks = false, status, tasksPath } = args;
				
				log.info(`Syncing tasks to README.md with options: withSubtasks=${withSubtasks}, status=${status || 'all'}`);

				// Import the sync-readme module dynamically
				const { syncTasksToReadme } = await import('../../../scripts/modules/sync-readme.js');
				const { findProjectRoot } = await import('../../../scripts/modules/utils.js');

				// Find project root
				const projectRoot = findProjectRoot();
				if (!projectRoot) {
					const errorMsg = 'Could not find project root. Make sure you are in a Task Master project directory.';
					log.error(errorMsg);
					return createErrorResponse(errorMsg, 'PROJECT_ROOT_NOT_FOUND');
				}

				// Prepare options for sync function
				const syncOptions = {
					withSubtasks,
					status,
					tasksPath
				};

				// Execute the sync operation
				const success = await syncTasksToReadme(projectRoot, syncOptions);

				if (success) {
					const resultMessage = `✅ Successfully synced tasks to README.md\n` +
						`📋 Export details: ${withSubtasks ? 'with' : 'without'} subtasks${status ? `, status: ${status}` : ''}\n` +
						`📍 Location: ${projectRoot}/README.md`;
					
					log.info('README sync completed successfully');
					return createContentResponse(resultMessage);
				} else {
					const errorMsg = 'Failed to sync tasks to README.md';
					log.error(errorMsg);
					return createErrorResponse(errorMsg, 'SYNC_FAILED');
				}

			} catch (error) {
				const errorMsg = `Error syncing tasks to README: ${error.message}`;
				log.error(errorMsg, { stack: error.stack });
				return createErrorResponse(errorMsg, 'SYNC_ERROR');
			}
		}
	});
}

export default { registerSyncReadmeTool };
