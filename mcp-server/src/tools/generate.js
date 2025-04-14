/**
 * tools/generate.js
 * Tool to generate individual task files from tasks.json
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { generateTaskFilesDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';
import path from 'path';

/**
 * Register the generate tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerGenerateTool(server) {
	server.addTool({
		name: 'generate',
		description:
			'Generates individual task files in tasks/ directory based on tasks.json',
		parameters: z.object({
			file: z.string().optional().describe('Absolute path to the tasks file'),
			output: z
				.string()
				.optional()
				.describe('Output directory (default: same directory as tasks file)'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Generating task files with args: ${JSON.stringify(args)}`);

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

				// Determine output directory: use explicit arg or default to tasks.json directory
				const outputDir = args.output
					? path.resolve(rootFolder, args.output) // Resolve relative to root if needed
					: path.dirname(tasksJsonPath);

				const result = await generateTaskFilesDirect(
					{
						// Pass the explicitly resolved paths
						tasksJsonPath: tasksJsonPath,
						outputDir: outputDir
						// No other args specific to this tool
					},
					log
				);

				if (result.success) {
					log.info(`Successfully generated task files: ${result.data.message}`);
				} else {
					log.error(
						`Failed to generate task files: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult(result, log, 'Error generating task files');
			} catch (error) {
				log.error(`Error in generate tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
