/**
 * tools/update-task.js
 * Tool to update a single task by ID with new information
 */

import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot,
	validateMcpMetadata
} from '@tm/mcp';
import { z } from 'zod';
import { resolveTag } from '../../../scripts/modules/utils.js';
import { updateTaskByIdDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

/**
 * Register the update-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateTaskTool(server) {
	server.addTool({
		name: 'update_task',
		description:
			'Updates a single task by ID with new information or context provided in the prompt.',
		parameters: z.object({
			id: z
				.string() // ID can be number or string like "1.2"
				.describe(
					"ID of the task (e.g., '15') to update. Subtasks are supported using the update-subtask tool."
				),
			prompt: z
				.string()
				.optional()
				.describe(
					'New information or context to incorporate into the task. Required unless only updating metadata.'
				),
			research: z
				.boolean()
				.optional()
				.describe('Use Perplexity AI for research-backed updates'),
			append: z
				.boolean()
				.optional()
				.describe(
					'Append timestamped information to task details instead of full update'
				),
			metadata: z
				.string()
				.optional()
				.describe(
					'JSON string of metadata to merge into task metadata. Example: \'{"githubIssue": 42, "sprint": "Q1-S3"}\'. Requires TASK_MASTER_ALLOW_METADATA_UPDATES=true in MCP environment.'
				),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		annotations: {
			title: 'Update Task',
			destructiveHint: true
		},
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const toolName = 'update_task';
			try {
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
				log.info(
					`Executing ${toolName} tool with args: ${JSON.stringify(args)}`
				);

				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
					log.info(`${toolName}: Resolved tasks path: ${tasksJsonPath}`);
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
						'Either prompt or metadata must be provided for update-task'
					);
				}

				// Call Direct Function - Include projectRoot and metadata
				const result = await updateTaskByIdDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						prompt: args.prompt,
						research: args.research,
						append: args.append,
						metadata: parsedMetadata,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log,
					{ session }
				);

				// 4. Handle Result
				log.info(
					`${toolName}: Direct function result: success=${result.success}`
				);
				return handleApiResult({
					result,
					log: log,
					errorPrefix: 'Error updating task',
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
