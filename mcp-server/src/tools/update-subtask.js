/**
 * tools/update-subtask.js
 * Tool to append additional information to a specific subtask
 */

import { TaskIdSchemaForMcp } from '@tm/core';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot,
	validateMcpMetadata
} from '@tm/mcp';
import { z } from 'zod';
import { resolveTag } from '../../../scripts/modules/utils.js';
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
			id: TaskIdSchemaForMcp.describe(
				'ID of the subtask to update in format "parentId.subtaskId" (e.g., "5.2"). Parent ID is the ID of the task that contains the subtask.'
			),
			prompt: z
				.string()
				.optional()
				.describe(
					'Information to add to the subtask. Required unless only updating metadata.'
				),
			research: z
				.boolean()
				.optional()
				.describe('Use Perplexity AI for research-backed updates'),
			metadata: z
				.string()
				.optional()
				.describe(
					'JSON string of metadata to merge into subtask metadata. Example: \'{"ticketId": "JIRA-456", "reviewed": true}\'. Requires TASK_MASTER_ALLOW_METADATA_UPDATES=true in MCP environment.'
				),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		annotations: {
			title: 'Update Subtask',
			destructiveHint: true
		},
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const toolName = 'update_subtask';

			try {
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
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

				// Validate metadata if provided
				const validationResult = validateMcpMetadata(
					args.metadata,
					createErrorResponse
				);
				if (validationResult.error) {
					return validationResult.error;
				}
				const parsedMetadata = validationResult.parsedMetadata;
				// Validate that at least prompt or metadata is provided
				if (!args.prompt && !parsedMetadata) {
					return createErrorResponse(
						'Either prompt or metadata must be provided for update-subtask'
					);
				}

				const result = await updateSubtaskByIdDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						prompt: args.prompt,
						research: args.research,
						metadata: parsedMetadata,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Successfully updated subtask with ID ${args.id}`);
				} else {
					log.error(
						`Failed to update subtask: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult({
					result,
					log: log,
					errorPrefix: 'Error updating subtask',
					projectRoot: args.projectRoot
				});
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
