/**
 * tools/parsePRD.js
 * Tool to parse PRD document and generate tasks
 */

import { z } from 'zod';
import path from 'path';
import { handleApiResult, createErrorResponse } from './utils.js';
import { parsePRDDirect } from '../core/task-master-core.js';

/**
 * Register the parse_prd tool
 * @param {Object} server - FastMCP server instance
 */
export function registerParsePRDTool(server) {
	server.addTool({
		name: 'parse_prd',
		description:
			"Parse a Product Requirements Document (PRD) text file to automatically generate initial tasks. Reinitializing the project is not necessary to run this tool. It is recommended to run parse-prd after initializing the project and creating/importing a prd.txt file in the project root's scripts/ directory.",
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
				.default(false)
				.describe('Overwrite existing output file without prompting.'),
			append: z
				.boolean()
				.optional()
				.default(false)
				.describe('Append generated tasks to existing file.'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: async (args, { log, session }) => {
			const toolName = 'parse_prd';
			try {
				log.info(
					`Executing ${toolName} tool with args: ${JSON.stringify(args)}`
				);

				// 1. Get Project Root
				const rootFolder = args.projectRoot;
				if (!rootFolder || !path.isAbsolute(rootFolder)) {
					log.error(
						`${toolName}: projectRoot is required and must be absolute.`
					);
					return createErrorResponse(
						'projectRoot is required and must be absolute.'
					);
				}
				log.info(`${toolName}: Project root: ${rootFolder}`);

				// 2. Call Direct Function - Pass relevant args including projectRoot
				// Path resolution (input/output) is handled within the direct function now
				const result = await parsePRDDirect(
					{
						// Pass args directly needed by the direct function
						input: args.input, // Pass relative or absolute path
						output: args.output, // Pass relative or absolute path
						numTasks: args.numTasks, // Pass number (direct func handles default)
						force: args.force,
						append: args.append,
						projectRoot: rootFolder
					},
					log,
					{ session } // Pass context object with session
				);

				// 3. Handle Result
				log.info(
					`${toolName}: Direct function result: success=${result.success}`
				);
				return handleApiResult(result, log, 'Error parsing PRD');
			} catch (error) {
				log.error(
					`Critical error in ${toolName} tool execute: ${error.message}`
				);
				return createErrorResponse(
					`Internal tool error (${toolName}): ${error.message}`
				);
			}
		}
	});
}
