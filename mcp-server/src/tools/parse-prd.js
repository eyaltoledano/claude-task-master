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
} from '../core/utils/path-utils.js';

/**
 * Register the parsePRD tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerParsePRDTool(server) {
	server.addTool({
		name: 'parse_prd',
		description:
			"Parse a Product Requirements Document (PRD) text file to automatically generate initial tasks using client-side LLM sampling. Reinitializing the project is not necessary to run this tool. It is recommended to run parse-prd after initializing the project and creating/importing a prd.txt file in the project root's scripts/ directory.",
		parameters: z.object({
			input: z
				.string()
				.optional()
				.describe('Path to the PRD document file (.txt, .md, etc.) relative to project root, or absolute path.'),
			numTasks: z
				.string()
				.optional()
				.default('10')
				.describe(
					'Approximate number of top-level tasks to generate (default: 10). As the agent, if you have enough information, ensure to enter a number of tasks that would logically scale with project complexity. Avoid entering numbers above 50 due to context window limitations.'
				),
			output: z
				.string()
				.optional()
				.describe(
					'Output path for tasks.json file relative to project root, or absolute path (default: tasks/tasks.json)'
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
				.optional()
				.describe('The directory of the project. Must be absolute path. If not provided, derived from session.')
		}),
		execute: async (args, context) => {
			const { log, session } = context;
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

				// Check if PRD path was found
				if (!prdPath) {
					return createErrorResponse(
						'No PRD document found or provided. Please ensure a PRD file exists (e.g., PRD.md or prd.txt) in the project or 'scripts' directory, or provide a valid input file path.'
					);
				}

				// Call the direct function, passing the *full context* object
				// parsePRDDirect will now use context.sample internally
				const result = await parsePRDDirect(
					{
						projectRoot: projectRoot,
						input: prdPath,
						output: tasksJsonPath,
						numTasks: args.numTasks,
						force: args.force,
						append: args.append
					},
					log,
					context
				);

				// Log success/failure from the direct function result
				if (result.success) {
					log.info(`Parse PRD Direct Function successful: ${result.data?.message || 'Completed'}`);
				} else {
					log.error(
						`Parse PRD Direct Function failed: ${result.error?.message || 'Unknown error'}`
					);
				}

				// Format and return the result
				return handleApiResult(result, log, 'Error parsing PRD');
			} catch (error) {
				log.error(`Unhandled error in parse-prd tool execute: ${error.message}`);
				log.error(error.stack);
				return createErrorResponse(`Internal server error during PRD parsing: ${error.message}`);
			}
		}
	});
}
