/**
 * tools/analyze.js
 * Tool for analyzing task complexity and generating recommendations
 */

import { z } from 'zod';
import path from 'path';
import fs from 'fs'; // Import fs for directory check/creation
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { analyzeTaskComplexityDirect } from '../core/task-master-core.js'; // Assuming core functions are exported via task-master-core.js
import { findTasksJsonPath } from '../core/utils/path-utils.js';

/**
 * Register the analyze_project_complexity tool
 * @param {Object} server - FastMCP server instance
 */
export function registerAnalyzeProjectComplexityTool(server) {
	server.addTool({
		name: 'analyze_project_complexity',
		description:
			'Analyze task complexity and generate expansion recommendations.',
		parameters: z.object({
			threshold: z.coerce // Use coerce for number conversion from string if needed
				.number()
				.int()
				.min(1)
				.max(10)
				.optional()
				.default(5) // Default threshold
				.describe('Complexity score threshold (1-10) to recommend expansion.'),
			research: z
				.boolean()
				.optional()
				.default(false)
				.describe('Use Perplexity AI for research-backed analysis.'),
			output: z
				.string()
				.optional()
				.describe(
					'Output file path relative to project root (default: scripts/task-complexity-report.json).'
				),
			file: z
				.string()
				.optional()
				.describe(
					'Path to the tasks file relative to project root (default: tasks/tasks.json).'
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const toolName = 'analyze_project_complexity'; // Define tool name for logging
			try {
				log.info(
					`Executing ${toolName} tool with args: ${JSON.stringify(args)}`
				);

				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksJsonPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
					log.info(`${toolName}: Resolved tasks path: ${tasksJsonPath}`);
				} catch (error) {
					log.error(`${toolName}: Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json within project root '${args.projectRoot}': ${error.message}`
					);
				}

				const outputPath = args.output
					? path.resolve(args.projectRoot, args.output)
					: path.resolve(
							args.projectRoot,
							'scripts',
							'task-complexity-report.json'
						);

				log.info(`${toolName}: Report output path: ${outputPath}`);

				// Ensure output directory exists
				const outputDir = path.dirname(outputPath);
				try {
					if (!fs.existsSync(outputDir)) {
						fs.mkdirSync(outputDir, { recursive: true });
						log.info(`${toolName}: Created output directory: ${outputDir}`);
					}
				} catch (dirError) {
					log.error(
						`${toolName}: Failed to create output directory ${outputDir}: ${dirError.message}`
					);
					return createErrorResponse(
						`Failed to create output directory: ${dirError.message}`
					);
				}

				// 3. Call Direct Function - Pass projectRoot in first arg object
				const result = await analyzeTaskComplexityDirect(
					{
						tasksJsonPath: tasksJsonPath,
						outputPath: outputPath,
						threshold: args.threshold,
						research: args.research,
						projectRoot: args.projectRoot
					},
					log,
					{ session }
				);

				// 4. Handle Result
				log.info(
					`${toolName}: Direct function result: success=${result.success}`
				);
				return handleApiResult(result, log, 'Error analyzing task complexity');
			} catch (error) {
				log.error(
					`Critical error in ${toolName} tool execute: ${error.message}`
				);
				return createErrorResponse(
					`Internal tool error (${toolName}): ${error.message}`
				);
			}
		})
	});
}
