/**
 * tools/update-subtask.js
 * Tool to append additional information to a specific subtask
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { updateSubtaskByIdDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

/**
 * Register the update-subtask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateSubtaskTool(server) {
	server.addTool({
		name: 'update_subtask',
		description:
			'Appends timestamped information to a specific subtask without replacing existing content. If you just want to update the subtask status, use set_task_status instead.',
		parameters: z.object({
			id: z
				.string()
				.describe(
					'ID of the subtask to update in format "parentId.subtaskId" (e.g., "5.2"). Parent ID is the ID of the task that contains the subtask.'
				),
			prompt: z.string().describe('Information to add to the subtask'),
			research: z
				.boolean()
				.optional()
				.describe('Use Perplexity AI for research-backed updates'),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const toolName = 'update_subtask';
			try {
				log.info(`Updating subtask with args: ${JSON.stringify(args)}`);

				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
				} catch (error) {
					log.error(`${toolName}: Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				const result = await updateSubtaskByIdDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						prompt: args.prompt,
						research: args.research,
						projectRoot: args.projectRoot
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
						`update_subtask tool: Agent delegation signaled by ...Direct function. Returning EmbeddedResource structure. Interaction ID: ${result.pendingInteraction.interactionId}`
					);

					const pendingInteractionDetailsForAgent = result.pendingInteraction; // Matching var name from other tools

					return {
						content: [
							{
								type: 'resource',
								resource: {
									uri: 'agent-llm://pending-interaction', // Standard URI
									mimeType: 'application/json',
									text: JSON.stringify({
										isAgentLLMPendingInteraction: true, // Flag for the client
										details: pendingInteractionDetailsForAgent // The propagated pendingInteraction object
									})
								}
							}
						],
						isError: false // This is not an error, but a signal
					};
				}
				// === END AGENT_LLM_DELEGATION SIGNAL HANDLING ===

				if (result.success) {
					log.info(`Successfully updated subtask with ID ${args.id}`);
				} else {
					log.error(
						`Failed to update subtask: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult(
					result,
					log,
					'Error updating subtask',
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
