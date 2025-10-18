/**
 * tools/generate.js
 * Tool to generate individual task files from tasks.json
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { generateTaskFilesDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';
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
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Generating task files with args: ${JSON.stringify(args)}`);

				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				const outputDir = args.output
					? path.resolve(args.projectRoot, args.output)
					: path.dirname(tasksJsonPath);

				const result = await generateTaskFilesDirect(
					{
						tasksJsonPath: tasksJsonPath,
						outputDir: outputDir,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Successfully generated task files: ${result.data.message}`);
				} else {
					log.error(
						`Failed to generate task files: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult(
					result,
					log,
					'Error generating task files',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in generate tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
