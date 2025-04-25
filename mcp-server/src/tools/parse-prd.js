/**
 * tools/parsePRD.js
 * Tool to parse PRD document and generate tasks
 */

import { z } from 'zod';
import {
	getProjectRootFromSession,
	handleApiResult,
	createErrorResponse
} from './utils.js';
import { parsePRDDirect } from '../core/task-master-core.js';
import {
	resolveProjectPaths,
	findPRDDocumentPath,
	resolveTasksOutputPath
} from '../core/utils/path-utils.js';

/**
 * Register the parsePRD tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerParsePRDTool(server) {
	server.addTool({
		name: 'parse_prd',
		description:
			"Parse a Product Requirements Document (PRD) text file to automatically generate initial tasks. In MCP mode, agents should first call with mode=\"get_prompt\" to receive a prompt/context, then generate tasks using their own LLM, and finally call again with mode=\"submit_tasks\" and the generated tasks.",
		parameters: z.object({
			input: z
				.string()
				.optional()
				.default('scripts/prd.txt')
				.describe('Absolute path to the PRD document file (.txt, .md, etc.)'),
			numTasks: z
				.string()
				.optional()
				.describe(
					'Approximate number of top-level tasks to generate (default: 10). As the agent, if you have enough information, ensure to enter a number of tasks that would logically scale with project complexity. Avoid entering numbers above 50 due to context window limitations.'
				),
			output: z
				.string()
				.optional()
				.describe(
					'Output path for tasks.json file (default: tasks/tasks.json)'
				),
			force: z
				.boolean()
				.optional()
				.describe('Allow overwriting an existing tasks.json file.'),
			append: z
				.boolean()
				.optional()
				.describe(
					'Append new tasks to existing tasks.json instead of overwriting'
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be absolute path.'),
			mode: z
				.enum(['get_prompt', 'submit_tasks'])
				.optional()
				.describe('MCP agent mode: get_prompt to receive a prompt, submit_tasks to submit generated tasks.'),
			tasks: z
				.array(z.any())
				.optional()
				.describe('Array of generated tasks to insert (agent-in-the-loop mode)')
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Parsing PRD with args: ${JSON.stringify(args)}`);

				// Get project root from args or session
				const rootFolder =
					args.projectRoot || getProjectRootFromSession(session, log);

				if (!rootFolder) {
					return createErrorResponse(
						'Could not determine project root. Please provide it explicitly or ensure your session contains valid root information.'
					);
				}

				// Resolve input (PRD) and output (tasks.json) paths using the utility
				const { projectRoot, prdPath, tasksJsonPath } = resolveProjectPaths(
					rootFolder,
					args,
					log
				);

				// Check if PRD path was found (resolveProjectPaths returns null if not found and not provided)
				if (!prdPath) {
					return createErrorResponse(
						'No PRD document found or provided. Please ensure a PRD file exists (e.g., PRD.md) or provide a valid input file path.'
					);
				}

				// Branch logic for agent-in-the-loop
				const mode = args.mode || (args.tasks ? 'submit_tasks' : 'get_prompt');

				const result = await parsePRDDirect(
					{
						projectRoot: projectRoot,
						input: prdPath,
						output: tasksJsonPath,
						numTasks: args.numTasks,
						force: args.force,
						append: args.append,
						mode,
						tasks: args.tasks
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Successfully parsed PRD: ${result.data.message}`);
				} else {
					log.error(
						`Failed to parse PRD: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult(result, log, 'Error parsing PRD');
			} catch (error) {
				log.error(`Error in parse-prd tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
