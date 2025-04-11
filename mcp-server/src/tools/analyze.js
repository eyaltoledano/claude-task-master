/**
 * tools/analyze.js
 * Tool for analyzing task complexity and generating recommendations
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { analyzeTaskComplexityDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';
import path from 'path';

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
					'Output file path for the report (default: scripts/task-complexity-report.json)'
				),
			model: z
				.string()
				.optional()
				.describe(
					'LLM model to use for analysis (defaults to configured model)'
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
					'Absolute path to the tasks file (default: tasks/tasks.json)'
				),
			research: z
				.boolean()
				.optional()
				.describe('Use Perplexity AI for research-backed complexity analysis'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(
					`Analyzing task complexity with args: ${JSON.stringify(args)}`
				);

				// Get project root from args or session
				const rootFolder =
					args.projectRoot || getProjectRootFromSession(session, log);

				if (!rootFolder) {
					return createErrorResponse(
						'Could not determine project root. Please provide it explicitly or ensure your session contains valid root information.'
					);
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
						`Failed to find tasks.json: ${error.message}`
					);
				}

				const outputPath = args.output
					? path.resolve(rootFolder, args.output)
					: path.resolve(rootFolder, 'scripts', 'task-complexity-report.json');

				const result = await analyzeTaskComplexityDirect(
					{
						tasksJsonPath: tasksJsonPath,
						outputPath: outputPath,
						model: args.model,
						threshold: args.threshold,
						research: args.research
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Task complexity analysis complete: ${result.data.message}`);
					log.info(
						`Report summary: ${JSON.stringify(result.data.reportSummary)}`
					);
				} else {
					log.error(
						`Failed to analyze task complexity: ${result.error.message}`
					);
				}

				return handleApiResult(result, log, 'Error analyzing task complexity');
			} catch (error) {
				log.error(`Error in analyze tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
