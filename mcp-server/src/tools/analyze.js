/**
 * tools/analyze.js
 * Tool for analyzing task complexity and generating recommendations
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { analyzeTaskComplexityDirect } from '../core/direct-functions/analyze-task-complexity.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';
import path from 'path';
import fs from 'fs';

/**
 * Register the analyze tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAnalyzeTool(server) {
	server.addTool({
		name: 'analyze_project_complexity',
		description:
			'Analyze task complexity and generate expansion recommendations',
		parameters: z.object({
			output: z
				.string()
				.optional()
				.describe(
					'Output file path relative to project root (default: scripts/task-complexity-report.json)'
				),
			threshold: z.coerce
				.number()
				.min(1)
				.max(10)
				.optional()
				.describe(
					'Minimum complexity score to recommend expansion (1-10) (default: 5)'
				),
			file: z
				.string()
				.optional()
				.describe(
					'Absolute path to the tasks file in the /tasks folder inside the project root (default: tasks/tasks.json)'
				),
			research: z
				.boolean()
				.optional()
				.default(false)
				.describe('Use research role for complexity analysis'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(
					`Executing analyze_project_complexity tool with args: ${JSON.stringify(args)}`
				);

				const rootFolder = args.projectRoot;
				if (!rootFolder) {
					return createErrorResponse('projectRoot is required.');
				}
				if (!path.isAbsolute(rootFolder)) {
					return createErrorResponse('projectRoot must be an absolute path.');
				}

				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksJsonPath(
						{ projectRoot: rootFolder, file: args.file },
						log
					);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json within project root '${rootFolder}': ${error.message}`
					);
				}

				const outputPath = args.output
					? path.resolve(rootFolder, args.output)
					: path.resolve(rootFolder, 'scripts', 'task-complexity-report.json');

				const outputDir = path.dirname(outputPath);
				try {
					if (!fs.existsSync(outputDir)) {
						fs.mkdirSync(outputDir, { recursive: true });
						log.info(`Created output directory: ${outputDir}`);
					}
				} catch (dirError) {
					log.error(
						`Failed to create output directory ${outputDir}: ${dirError.message}`
					);
					return createErrorResponse(
						`Failed to create output directory: ${dirError.message}`
					);
				}

				const result = await analyzeTaskComplexityDirect(
					{
						tasksJsonPath: tasksJsonPath,
						outputPath: outputPath,
						threshold: args.threshold,
						research: args.research
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Tool analyze_project_complexity finished successfully.`);
				} else {
					log.error(
						`Tool analyze_project_complexity failed: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult(result, log, 'Error analyzing task complexity');
			} catch (error) {
				log.error(`Critical error in analyze tool execute: ${error.message}`);
				return createErrorResponse(`Internal tool error: ${error.message}`);
			}
		}
	});
}
