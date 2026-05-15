/**
 * @fileoverview search_tasks MCP tool
 * Search tasks by keyword across title, description, details, testStrategy,
 * and (optionally) subtask titles/descriptions.
 *
 * Implements issue #1453.
 */

import { z } from 'zod';
import { handleApiResult, withToolContext } from '../../shared/utils.js';
import type { ToolContext } from '../../shared/types.js';
import type { Task, TaskStatus, Subtask } from '@tm/core';
import { TASK_STATUSES } from '@tm/core';
import type { FastMCP } from 'fastmcp';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SearchTasksSchema = z.object({
	projectRoot: z
		.string()
		.describe('The directory of the project. Must be an absolute path.'),
	query: z
		.string()
		.min(1)
		.describe('Search query — case-insensitive substring matched against task title, description, details, and testStrategy'),
	status: z
		.string()
		.optional()
		.describe(
			"Filter results by status (e.g., 'pending', 'done') or multiple statuses separated by commas (e.g., 'pending,in-progress')"
		),
	includeSubtasks: z
		.boolean()
		.optional()
		.describe(
			'Also search subtask titles, descriptions, details, and testStrategy fields. Matching subtasks are included in the response.'
		),
	tag: z.string().optional().describe('Tag context to operate on')
});

type SearchTasksArgs = z.infer<typeof SearchTasksSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesQuery(text: string | undefined | null, query: string): boolean {
	if (!text) return false;
	return text.toLowerCase().includes(query);
}

function taskMatchesQuery(task: Task, queryLower: string): boolean {
	return (
		matchesQuery(task.title, queryLower) ||
		matchesQuery(task.description, queryLower) ||
		matchesQuery(task.details, queryLower) ||
		matchesQuery(task.testStrategy, queryLower)
	);
}

function subtaskMatchesQuery(subtask: Subtask, queryLower: string): boolean {
	return (
		matchesQuery(subtask.title, queryLower) ||
		matchesQuery(subtask.description, queryLower) ||
		matchesQuery(subtask.details, queryLower) ||
		matchesQuery(subtask.testStrategy, queryLower)
	);
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register the search_tasks tool with the MCP server
 */
export function registerSearchTasksTool(server: FastMCP) {
	server.addTool({
		name: 'search_tasks',
		description:
			'Search tasks by keyword across title, description, details, and testStrategy. Optionally also searches subtasks. Returns matching tasks with their IDs and status.',
		parameters: SearchTasksSchema,
		annotations: {
			title: 'Search Tasks',
			readOnlyHint: true
		},
		execute: withToolContext(
			'search-tasks',
			async (args: SearchTasksArgs, { log, tmCore }: ToolContext) => {
				const { projectRoot, query, status, includeSubtasks, tag } = args;

				try {
					log.info(
						`Searching tasks in ${projectRoot} for "${query}"${status ? ` with status: ${status}` : ''}${tag ? ` in tag: ${tag}` : ''}`
					);

					// Validate status values if provided
					if (status) {
						const statuses = status.split(',').map((s) => s.trim());
						const invalid = statuses.filter(
							(s) => !TASK_STATUSES.includes(s as TaskStatus)
						);
						if (invalid.length > 0) {
							return handleApiResult({
								result: {
									success: false,
									error: {
										message: `Invalid status value(s): ${invalid.join(', ')}. Valid values: ${TASK_STATUSES.join(', ')}`
									}
								},
								log,
								projectRoot
							});
						}
					}

					// Fetch all tasks (with subtasks for subtask search)
					const listResult = await tmCore.tasks.list({
						tag,
						includeSubtasks: true
					});

					const queryLower = query.toLowerCase();

					// Parse status filter
					const statusFilter = status
						? status.split(',').map((s) => s.trim() as TaskStatus)
						: undefined;

					// Run search
					interface TaskMatch {
						task: Task;
						matchingSubtasks: Array<{ id: number | string; title: string; status: string; description: string }>;
					}

					const matches: TaskMatch[] = [];

					for (const task of listResult.tasks) {
						if (statusFilter && !statusFilter.includes(task.status)) {
							continue;
						}

						const taskHit = taskMatchesQuery(task, queryLower);

						const matchingSubtasks: Array<{ id: number | string; title: string; status: string; description: string }> =
							includeSubtasks
								? (task.subtasks || [])
										.filter((st) => subtaskMatchesQuery(st, queryLower))
										.map((st) => ({
											id: st.id,
											title: st.title,
											status: st.status,
											description: st.description
										}))
								: [];

						if (taskHit || matchingSubtasks.length > 0) {
							matches.push({
								task,
								matchingSubtasks
							});
						}
					}

					log.info(
						`Search for "${query}" returned ${matches.length} matching task(s) out of ${listResult.total} total`
					);

					return handleApiResult({
						result: {
							success: true,
							data: {
								query,
								matches: matches.map(({ task, matchingSubtasks }) => ({
									id: task.id,
									title: task.title,
									status: task.status,
									priority: task.priority,
									description: task.description,
									matchingSubtasks
								})),
								stats: {
									totalTasksSearched: listResult.total,
									matchCount: matches.length
								}
							}
						},
						log,
						projectRoot,
						tag: listResult.tag
					});
				} catch (error: any) {
					log.error(`Error in search-tasks: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to search tasks: ${error.message}`
							}
						},
						log,
						projectRoot
					});
				}
			}
		)
	});
}
