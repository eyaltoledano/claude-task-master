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
import { findTasksPath } from '../core/utils/path-utils.js';
import { COMPLEXITY_REPORT_FILE } from '../../../src/constants/paths.js';

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
					`Output file path relative to project root (default: ${COMPLEXITY_REPORT_FILE}).`
				),
			file: z
				.string()
				.optional()
				.describe(
					'Path to the tasks file relative to project root (default: tasks/tasks.json).'
				),
			ids: z
				.string()
				.optional()
				.describe(
					'Comma-separated list of task IDs to analyze specifically (e.g., "1,3,5").'
				),
			from: z.coerce
				.number()
				.int()
				.positive()
				.optional()
				.describe('Starting task ID in a range to analyze.'),
			to: z.coerce
				.number()
				.int()
				.positive()
				.optional()
				.describe('Ending task ID in a range to analyze.'),
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
					tasksJsonPath = findTasksPath(
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
					: path.resolve(args.projectRoot, COMPLEXITY_REPORT_FILE);

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
						projectRoot: args.projectRoot,
						ids: args.ids,
						from: args.from,
						to: args.to
					},
					log,
					{ session }
				);

				// 4. Handle Result
				log.info(
					`${toolName}: Direct function result: success=${result.success}`
				);
				return handleApiResult(
					result,
					log,
					'Error analyzing task complexity',
					undefined,
					args.projectRoot
				);
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
