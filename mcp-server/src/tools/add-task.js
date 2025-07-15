/**
 * tools/add-task.js
 * Tool to add a new task using AI
 */

import { z } from 'zod';
import { createErrorResponse, handleApiResult } from './utils.js';
import { addTaskDirect } from '../core/task-master-core.js';
import { withTaskMaster } from '../../../src/task-master.js';

/**
 * Register the addTask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAddTaskTool(server) {
	server.addTool({
		name: 'add_task',
		description: 'Add a new task using AI',
		parameters: z.object({
			prompt: z
				.string()
				.optional()
				.describe(
					'Description of the task to add (required if not using manual fields)'
				),
			title: z
				.string()
				.optional()
				.describe('Task title (for manual task creation)'),
			description: z
				.string()
				.optional()
				.describe('Task description (for manual task creation)'),
			details: z
				.string()
				.optional()
				.describe('Implementation details (for manual task creation)'),
			testStrategy: z
				.string()
				.optional()
				.describe('Test strategy (for manual task creation)'),
			dependencies: z
				.string()
				.optional()
				.describe('Comma-separated list of task IDs this task depends on'),
			priority: z
				.string()
				.optional()
				.describe('Task priority (high, medium, low)'),
			file: z
				.string()
				.optional()
				.describe('Path to the tasks file (default: tasks/tasks.json)'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			research: z
				.boolean()
				.optional()
				.describe('Whether to use research capabilities for task creation')
		}),
		execute: withTaskMaster({
			paths: { tasksPath: 'file' }
		})(async (taskMaster, args, { log, session }) => {
			log.info(`Starting add-task with args: ${JSON.stringify(args)}`);

			// Call the direct function
			const result = await addTaskDirect(
				taskMaster,
				{
					prompt: args.prompt,
					title: args.title,
					description: args.description,
					details: args.details,
					testStrategy: args.testStrategy,
					dependencies: args.dependencies,
					priority: args.priority,
					research: args.research
				},
				log,
				{ session }
			);

			return handleApiResult(
				result,
				log,
				'Error adding task',
				undefined,
				taskMaster.getProjectRoot()
			);
		})
	});
}
