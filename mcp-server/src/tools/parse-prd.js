/**
 * tools/parsePRD.js
 * Tool to parse PRD document and generate tasks
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { parsePRDDirect } from '../core/task-master-core.js';

/**
 * Register the parsePRD tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerParsePRDTool(server) {
	server.addTool({
		name: 'parse_prd',
		description:
			'Parse a Product Requirements Document (PRD) text file to automatically generate initial tasks.',
		parameters: z.object({
			input: z
				.string()
				.default('scripts/prd.txt')
				.describe('Absolute path to the PRD document file (.txt, .md, etc.)'),
			numTasks: z
				.string()
				.optional()
				.describe(
					'Approximate number of top-level tasks to generate (default: 10)'
				),
			output: z
				.string()
				.optional()
				.describe(
					'Output absolute path for tasks.json file (default: tasks/tasks.json)'
				),
			force: z
				.boolean()
				.optional()
				.describe('Allow overwriting an existing tasks.json file.'),
			projectRoot: z
				.string()
				.optional()
				.describe(
					'Absolute path to the root directory of the project (default: automatically detected from session or CWD)'
				)
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Parsing PRD with args: ${JSON.stringify(args)}`);

				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				const result = await parsePRDDirect(
					{
						projectRoot: rootFolder,
						...args
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
