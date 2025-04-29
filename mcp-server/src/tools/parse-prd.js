/**
 * tools/parsePRD.js
 * Tool to parse PRD document and generate tasks
 */

import { z } from 'zod';
import {
	getProjectRootFromSession,
	handleApiResult,
	createErrorResponse
} from './utils.js';
// Import the renamed/simplified direct function for saving/generating files
import { saveTasksAndGenerateFilesDirect } from '../core/task-master-core.js';
import {
	resolveProjectPaths,
} from '../core/utils/path-utils.js';
// Import AI utils needed here now
import {
    _generateParsePRDPrompt,
    parseTasksFromCompletion
} from '../core/utils/ai-client-utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Register the parsePRD tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerParsePRDTool(server) {
	server.addTool({
		name: 'parse_prd',
		description:
			"Parse a Product Requirements Document (PRD) text file to automatically generate initial tasks using client-side LLM sampling. Reinitializing the project is not necessary to run this tool. It is recommended to run parse-prd after initializing the project and creating/importing a prd.txt file in the project root's scripts/ directory.",
		parameters: z.object({
			input: z
				.string()
				.optional()
				.describe('Path to the PRD document file (.txt, .md, etc.) relative to project root, or absolute path.'),
			numTasks: z
				.string()
				.optional()
				.default('10')
				.describe(
					'Approximate number of top-level tasks to generate (default: 10). As the agent, if you have enough information, ensure to enter a number of tasks that would logically scale with project complexity. Avoid entering numbers above 50 due to context window limitations.'
				),
			output: z
				.string()
				.optional()
				.describe(
					'Output path for tasks.json file relative to project root, or absolute path (default: tasks/tasks.json)'
				),
			force: z
				.boolean()
				.optional()
				.describe('Allow overwriting an existing tasks.json file.'),
			append: z
				.boolean()
				.optional()
				.describe(
					'Append new tasks to existing tasks.json instead of overwriting'
				),
			projectRoot: z
				.string()
				.optional()
				.describe('The directory of the project. Must be absolute path. If not provided, derived from session.')
		}),
		execute: async (args, context) => { // Use full context
            const { log, session } = context; // Destructure still okay
			try {
				log.info(`Executing parse_prd tool with args: ${JSON.stringify(args)}`);

				// 1. Resolve Paths
				const rootFolder =
					args.projectRoot || getProjectRootFromSession(session, log);
				if (!rootFolder) {
					return createErrorResponse('Could not determine project root.');
				}
				const { projectRoot, prdPath, tasksJsonPath } = resolveProjectPaths(
					rootFolder,
					args,
					log
				);
				if (!prdPath) {
					return createErrorResponse('No PRD document found or provided.');
				}

                // 2. Read PRD Content
                if (!fs.existsSync(prdPath)) {
                    return createErrorResponse(`Input PRD file not found: ${prdPath}`);
                }
                const prdContent = fs.readFileSync(prdPath, 'utf8');

                // 3. Parse Args
                let numTasks = parseInt(args.numTasks, 10);
                if (isNaN(numTasks)) {
                    log.warn(`Invalid numTasks: ${args.numTasks}. Using 10.`);
                    numTasks = 10;
                }
                const append = args.append === true;
                const force = args.force === true;

                // 4. Build Prompt
                const { systemPrompt, userPrompt } = _generateParsePRDPrompt(prdContent, numTasks, path.basename(prdPath));
                if (!userPrompt) {
                    return createErrorResponse('Failed to generate prompt for PRD parsing.');
                }

                // 5. Call context.sample (Core Change)
                log.info('Initiating client-side LLM sampling via context.sample...');
                let completion;
                try {
                    // Check if context.sample exists *before* calling
                    if (typeof context.sample !== 'function') {
                         throw new Error('FastMCP sampling function (context.sample) is not available on the provided context.');
                    }
                    completion = await context.sample(userPrompt, { system: systemPrompt });
                } catch (sampleError) {
                    log.error(`context.sample failed: ${sampleError.message}`);
                    return createErrorResponse(`Client-side sampling failed: ${sampleError.message}`);
                }

                const completionText = completion?.text;
                if (!completionText) {
                     log.error('Received empty completion from context.sample.');
                     return createErrorResponse('Received empty completion from client LLM.');
                }
                log.info('Received completion from client LLM via context.sample.');

                // 6. Parse Completion
                const newTasksData = parseTasksFromCompletion(completionText);
                if (!newTasksData || !Array.isArray(newTasksData.tasks)) {
                     log.error('Failed to parse valid tasks JSON from LLM completion.');
                     return createErrorResponse('Failed to parse valid tasks JSON from LLM completion.');
                }
                log.info(`Parsed ${newTasksData.tasks.length} new tasks from completion.`);

                // 7. Call Simplified Direct Function to Save/Generate Files
                // Pass only necessary arguments for file operations and merging
                const saveArgs = {
                    tasksJsonPath, // Resolved path
                    projectRoot,
                    newTasksData, // Parsed data from AI
                    append,
                    force
                };
                const result = await saveTasksAndGenerateFilesDirect(saveArgs, log);

                // 8. Handle Result
                return handleApiResult(result, log, 'Error processing parsed PRD tasks');

			} catch (error) {
				log.error(`Unhandled error in parse_prd tool execute: ${error.message}`);
                log.error(error.stack);
				return createErrorResponse(`Internal server error during PRD parsing: ${error.message}`);
			}
		}
	});
}
