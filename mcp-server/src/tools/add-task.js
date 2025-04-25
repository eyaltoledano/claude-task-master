/**
 * tools/add-task.js
 * Tool to add a new task using AI
 */

import { z } from 'zod';
import {
	createErrorResponse,
	createContentResponse,
	getProjectRootFromSession,
	executeTaskMasterCommand,
	handleApiResult
} from './utils.js';
import { addTaskDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';

/**
 * Register the addTask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAddTaskTool(server) {
	server.addTool({
		name: 'add_task',
		description: 'Add a new task using AI. In MCP mode, agents should first call with mode="get_prompt" to receive a prompt/context, then generate a task using their own LLM, and finally call again with mode="submit_task" and the generated task.',
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
				.describe('Whether to use research capabilities for task creation'),
			mode: z
				.enum(['get_prompt', 'submit_task'])
				.optional()
				.describe('MCP agent mode: get_prompt to receive a prompt, submit_task to submit a generated task.'),
			task: z
				.any()
				.optional()
				.describe('Generated task object to insert (agent-in-the-loop mode)')
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Starting add-task with args: ${JSON.stringify(args)}`);

				// Get project root from args or session
				const rootFolder =
					args.projectRoot || getProjectRootFromSession(session, log);

				// Ensure project root was determined
				if (!rootFolder) {
					return createErrorResponse(
						'Could not determine project root. Please provide it explicitly or ensure your session contains valid root information.'
					);
				}

				// Resolve the path to tasks.json
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksJsonPath(
						{ projectRoot: rootFolder, file: args.file },
						log
					);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				// Branch logic for agent-in-the-loop
				const mode = args.mode || (args.task ? 'submit_task' : 'get_prompt');

				const result = await addTaskDirect(
					{
						tasksJsonPath: tasksJsonPath,
						prompt: args.prompt,
						dependencies: args.dependencies,
						priority: args.priority,
						research: args.research,
						mode,
						task: args.task
					},
					log,
					{ session }
				);

				// Return the result
				return handleApiResult(result, log);
			} catch (error) {
				log.error(`Error in add-task tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
