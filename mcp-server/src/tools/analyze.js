/**
 * tools/analyze.js
 * Tool for analyzing task complexity and generating recommendations
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { analyzeTaskComplexityDirect } from '../core/task-master-core.js';

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
					'Output file path relative to project root (default: complexity-report.json).'
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
		execute: withTaskMaster({
			paths: { tasksPath: 'file', complexityReportPath: 'output' }
		})(async (taskMaster, args, { log, session }) => {
			const toolName = 'analyze_project_complexity'; // Define tool name for logging
			try {
				log.info(
					`Executing ${toolName} tool with args: ${JSON.stringify(args)}`
				);

				const result = await analyzeTaskComplexityDirect(
					taskMaster,
					{
						threshold: args.threshold,
						research: args.research,
						ids: args.ids,
						from: args.from,
						to: args.to
					},
					log,
					{ session }
				);

				log.info(
					`${toolName}: Direct function result: success=${result.success}`
				);
				return handleApiResult(
					result,
					log,
					'Error analyzing task complexity',
					undefined,
					taskMaster.getProjectRoot()
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
