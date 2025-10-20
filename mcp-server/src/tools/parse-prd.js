/**
 * tools/parsePRD.js
 * Tool to parse PRD document and generate tasks
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	withNormalizedProjectRoot,
	createErrorResponse,
	checkProgressCapability
} from './utils.js';
import { parsePRDDirect } from '../core/task-master-core.js';
import {
	PRD_FILE,
	TASKMASTER_DOCS_DIR,
	TASKMASTER_TASKS_FILE
} from '../../../src/constants/paths.js';
import { resolveTag } from '../../../scripts/modules/utils.js';

/**
 * Register the parse_prd tool
 * @param {Object} server - FastMCP server instance
 */
export function registerParsePRDTool(server) {
	server.addTool({
		name: 'parse_prd',
		description: `Parse a Product Requirements Document (PRD) text file to automatically generate initial tasks. Reinitializing the project is not necessary to run this tool. It is recommended to run parse-prd after initializing the project and creating/importing a prd.txt file in the project root's ${TASKMASTER_DOCS_DIR} directory.`,

		parameters: z.object({
			input: z
				.string()
				.optional()
				.default(PRD_FILE)
				.describe('Absolute path to the PRD document file (.txt, .md, etc.)'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on'),
			output: z
				.string()
				.optional()
				.describe(
					`Output path for tasks.json file (default: ${TASKMASTER_TASKS_FILE})`
				),
			numTasks: z
				.string()
				.optional()
				.describe(
					'Approximate number of top-level tasks to generate (default: 10). As the agent, if you have enough information, ensure to enter a number of tasks that would logically scale with project complexity. Setting to 0 will allow Taskmaster to determine the appropriate number of tasks based on the complexity of the PRD. Avoid entering numbers above 50 due to context window limitations.'
				),
			force: z
				.boolean()
				.optional()
				.default(false)
				.describe('Overwrite existing output file without prompting.'),
			research: z
				.boolean()
				.optional()
				.describe(
					'Enable Taskmaster to use the research role for potentially more informed task generation. Requires appropriate API key.'
				),
			append: z
				.boolean()
				.optional()
				.describe('Append generated tasks to existing file.')
		}),
		execute: withNormalizedProjectRoot(
			async (args, { log, session, reportProgress }) => {
				try {
					const resolvedTag = resolveTag({
						projectRoot: args.projectRoot,
						tag: args.tag
					});
					const progressCapability = checkProgressCapability(
						reportProgress,
						log
					);
					const result = await parsePRDDirect(
						{
							...args,
							tag: resolvedTag
						},
						log,
						{ session, reportProgress: progressCapability }
					);
					return handleApiResult(
						result,
						log,
						'Error parsing PRD',
						undefined,
						args.projectRoot
					);
				} catch (error) {
					log.error(`Error in parse_prd: ${error.message}`);
					return createErrorResponse(`Failed to parse PRD: ${error.message}`);
				}
			}
		)
	});
}
