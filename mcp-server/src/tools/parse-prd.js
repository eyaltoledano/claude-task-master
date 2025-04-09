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
				.describe('Allow overwriting an existing tasks.json file.'),
			projectRoot: z
				.string()
				.describe(
					'Absolute path to the root directory of the project. Required - ALWAYS SET THIS TO THE PROJECT ROOT DIRECTORY.'
				)
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Parsing PRD with args: ${JSON.stringify(args)}`);

				// Get project root from session
				let rootFolder = getProjectRootFromSession(session, log);
				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				if (!rootFolder) {
					return createErrorResponse(
						'Could not determine project root. Please provide it explicitly or ensure your session contains valid root information.'
					);
				}

				// Handle auto-detection of paths when not explicitly provided
				let inputPath = args.input;
				let outputPath = args.output;

				// If input not provided, try to auto-detect it
				if (!inputPath) {
					inputPath = findPRDDocumentPath(rootFolder, null, log);
					if (!inputPath) {
						return createErrorResponse(
							'No PRD document found. Please provide a valid input file path.'
						);
					}
					log.info(`Auto-detected PRD document: ${inputPath}`);
				}

				// If output not provided, use default
				if (!outputPath) {
					outputPath = resolveTasksOutputPath(rootFolder, null, log);
					log.info(`Using default tasks output path: ${outputPath}`);
				}

				// Call the direct function with fully resolved parameters
				const result = await parsePRDDirect(
					{
						projectRoot: rootFolder,
						input: inputPath,
						output: outputPath,
						numTasks: args.numTasks,
						force: args.force
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
