/**
 * tools/parsePRD.js
 * Tool to parse PRD document and generate tasks
 */

import { z } from 'zod';
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
				.describe('Append generated tasks to existing file.'),
			auto: z
				.boolean()
				.optional()
				.default(false)
				.describe('Automatically analyze complexity and expand high-complexity tasks after PRD parsing.'),
			autoThreshold: z
				.preprocess(v => {
					if (v === undefined || v === null || v === '') return 7;
					const n = Number(v);
					return Number.isFinite(n) ? n : 7;
				}, z.number().min(0))
				.optional()
				.default(7)
				.describe('Complexity threshold for auto-expansion (default: 7).')
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

					// Handle auto-expansion if enabled and PRD parsing was successful
					if (args.auto && result.success && result.data) {
						try {
							log.info('Running automatic complexity analysis and expansion...');
							
							// Import the auto workflow function
							const { runAutoComplexityExpansion } = await import('../../../../scripts/modules/task-manager/auto-complexity-expansion.js');
							
							const tasksPath = result.data.tasksPath || result.data.outputPath;
							if (!tasksPath) {
								log.warn('Auto-expansion skipped: tasksPath not found in parse result.');
							} else {
								const parsed = Number(args.autoThreshold);
								const threshold = Number.isFinite(parsed) ? parsed : 7;
								const autoResult = await runAutoComplexityExpansion({
									tasksPath,
									threshold,
									research: !!args.research,
									projectRoot: args.projectRoot,
									tag: resolvedTag
								});
								// Add auto-expansion results to the response
								result.data.autoExpansion = autoResult;
								log.info(`Auto-expansion completed: ${autoResult.expandedTasks} tasks expanded`);
							}
							
						} catch (autoError) {
							log.warn(`Auto-expansion failed: ${autoError.message}`);
							// Don't fail the entire operation, just log the auto-expansion failure
							result.data.autoExpansionError = autoError.message;
						}
					}

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
