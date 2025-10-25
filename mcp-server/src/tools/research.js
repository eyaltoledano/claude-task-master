/**
 * tools/research.js
 * Tool to perform AI-powered research queries with project context
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot,
	handleAgentLLMDelegation
} from './utils.js';
import { researchDirect } from '../core/task-master-core.js';
import { resolveTag } from '../../../scripts/modules/utils.js';

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
			saveToTask: z
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
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
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
						// The public tool parameter is `saveToTask` but the internal direct
						// function expects `saveTo`. Support both for backward compatibility.
						saveTo: args.saveToTask || args.saveTo,
						saveToFile: args.saveToFile || false,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log,
					{ session }
				);

				// Centralized delegation handling
				const delegation = handleAgentLLMDelegation(result, log, 'research');
				if (delegation.delegated) return delegation.response;

				// If not delegating, proceed with existing result handling
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
