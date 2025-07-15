/**
 * tools/update.js
 * Tool to update tasks based on new context/prompt
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { updateTasksDirect } from '../core/task-master-core.js';

/**
 * Register the update tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateTool(server) {
	server.addTool({
		name: 'update',
		description:
			"Update multiple upcoming tasks (with ID >= 'from' ID) based on new context or changes provided in the prompt. Use 'update_task' instead for a single specific task or 'update_subtask' for subtasks.",
		parameters: z.object({
			from: z
				.string()
				.describe(
					"Task ID from which to start updating (inclusive). IMPORTANT: This tool uses 'from', not 'id'"
				),
			prompt: z
				.string()
				.describe('Explanation of changes or new context to apply'),
			research: z
				.boolean()
				.optional()
				.describe('Use Perplexity AI for research-backed updates'),
			file: z
				.string()
				.optional()
				.describe('Path to the tasks file relative to project root'),
			projectRoot: z
				.string()
				.optional()
				.describe(
					'The directory of the project. (Optional, usually from session)'
				),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withTaskMaster({
			paths: { tasksPath: 'file' }
		})(async (taskMaster, args, { log, session }) => {
			const toolName = 'update';
			const { from, prompt, research, file, projectRoot, tag } = args;

			try {
				log.info(
					`Executing ${toolName} tool with normalized root: ${projectRoot}`
				);

				// Get tasks.json path from TaskMaster
				log.info(`${toolName}: Using tasks path: ${taskMaster.getTasksPath()}`);

				const result = await updateTasksDirect(
					taskMaster,
					{
						from: from,
						prompt: prompt,
						research: research,
						tag: tag
					},
					log,
					{ session }
				);

				log.info(
					`${toolName}: Direct function result: success=${result.success}`
				);
				return handleApiResult(
					result,
					log,
					'Error updating tasks',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(
					`Critical error in ${toolName} tool execute: ${error.message}`
				);
				return createErrorResponse(
					`Internal tool error (${toolName}): ${error.message}`
				);
			}
		})
	});
}
