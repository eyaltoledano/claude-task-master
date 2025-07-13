/**
 * tools/expand-task.js
 * Tool to expand a task into subtasks
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { expandTaskDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

/**
 * Register the expand-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerExpandTaskTool(server) {
	server.addTool({
		name: 'expand_task',
		description: 'Expand a task into subtasks for detailed implementation',
		parameters: z.object({
			id: z.string().describe('ID of task to expand'),
			num: z.string().optional().describe('Number of subtasks to generate'),
			research: z
				.boolean()
				.optional()
				.default(false)
				.describe('Use research role for generation'),
			prompt: z
				.string()
				.optional()
				.describe('Additional context for subtask generation'),
			file: z
				.string()
				.optional()
				.describe(
					'Path to the tasks file relative to project root (e.g., tasks/tasks.json)'
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			force: z
				.boolean()
				.optional()
				.default(false)
				.describe('Force expansion even if subtasks exist'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Starting expand-task with args: ${JSON.stringify(args)}`);

				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				const result = await expandTaskDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						num: args.num,
						research: args.research,
						prompt: args.prompt,
						force: args.force,
						projectRoot: args.projectRoot,
						tag: args.tag || 'master'
					},
					log,
					{ session }
				);

				// === BEGIN AGENT_LLM_DELEGATION SIGNAL HANDLING ===
				if (
					result &&
					result.needsAgentDelegation === true &&
					result.pendingInteraction
				) {
					log.info(
						'expand-task tool: Agent delegation signaled by expandTaskDirect. Returning EmbeddedResource structure.'
					);

					// Extract the details needed for agent_llm tool from pendingInteraction.
					// The structure of pendingInteraction from expandTask (core) is:
					// {
					//     type: "agent_llm",
					//     interactionId: ...,
					//     delegatedCallDetails: { originalCommand, role, serviceType, requestParameters }
					// }
					// The 'details' for isAgentLLMPendingInteraction should be this pendingInteraction object itself.
					const pendingInteractionDetailsForAgent = result.pendingInteraction;

					return {
						content: [
							{
								type: 'resource',
								resource: {
									uri: 'agent-llm://pending-interaction',
									mimeType: 'application/json',
									text: JSON.stringify({
										isAgentLLMPendingInteraction: true,
										details: pendingInteractionDetailsForAgent
									})
								}
							}
						],
						isError: false
					};
				}
				// === END AGENT_LLM_DELEGATION SIGNAL HANDLING ===

				// If not delegating, proceed with existing result handling (likely handleApiResult)
				return handleApiResult(
					result,
					log,
					'Error expanding task',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in expand-task tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
