/**
 * tools/research.js
 * Tool to perform AI-powered research queries with project context
 */

import { z } from 'zod';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { researchDirect } from '../core/task-master-core.js';

/**
 * Register the research tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerResearchTool(server) {
	server.addTool({
		name: 'research',
		description: 'Perform AI-powered research queries with project context',
		parameters: z.object({
			query: z.string().describe('Research query/prompt (required)'),
			taskIds: z
				.string()
				.optional()
				.describe(
					'Comma-separated list of task/subtask IDs for context (e.g., "15,16.2,17")'
				),
			filePaths: z
				.string()
				.optional()
				.describe(
					'Comma-separated list of file paths for context (e.g., "src/api.js,docs/readme.md")'
				),
			customContext: z
				.string()
				.optional()
				.describe('Additional custom context text to include in the research'),
			includeProjectTree: z
				.boolean()
				.optional()
				.describe(
					'Include project file tree structure in context (default: false)'
				),
			detailLevel: z
				.enum(['low', 'medium', 'high'])
				.optional()
				.describe('Detail level for the research response (default: medium)'),
			saveTo: z
				.string()
				.optional()
				.describe(
					'Automatically save research results to specified task/subtask ID (e.g., "15" or "15.2")'
				),
			saveToFile: z
				.boolean()
				.optional()
				.describe(
					'Save research results to .taskmaster/docs/research/ directory (default: false)'
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(
					`Starting research with query: "${args.query.substring(0, 100)}${args.query.length > 100 ? '...' : ''}"`
				);

				// Call the direct function
				const result = await researchDirect(
					{
						query: args.query,
						taskIds: args.taskIds,
						filePaths: args.filePaths,
						customContext: args.customContext,
						includeProjectTree: args.includeProjectTree || false,
						detailLevel: args.detailLevel || 'medium',
						saveTo: args.saveTo,
						saveToFile: args.saveToFile || false,
						projectRoot: args.projectRoot
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error performing research',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in research tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
