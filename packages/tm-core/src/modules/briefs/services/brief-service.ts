/**
 * @fileoverview Brief Service
 * Handles brief lookup, matching, and statistics
 */

import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import { TaskRepository } from '../../tasks/repositories/task-repository.interface.js';
import type { Brief } from '../types.js';

/**
 * Tag statistics with detailed breakdown
 */
export interface TagWithStats {
	name: string;
	isCurrent: boolean;
	taskCount: number;
	completedTasks: number;
	statusBreakdown: Record<string, number>;
	subtaskCounts?: {
		totalSubtasks: number;
		subtasksByStatus: Record<string, number>;
	};
	created?: string;
	description?: string;
	status?: string;
	briefId?: string;
	updatedAt?: string;
}

/**
 * Service for brief-related operations
 */
export class BriefService {
	/**
	 * Find a brief by name or ID with flexible matching
	 */
	async findBrief(
		briefs: Brief[],
		nameOrId: string
	): Promise<Brief | undefined> {
		return briefs.find((brief) => this.matches(brief, nameOrId));
	}

	/**
	 * Match a brief against a query string
	 * Supports: exact name match, partial name match, full ID, last 8 chars of ID
	 */
	private matches(brief: Brief, query: string): boolean {
		const briefName = brief.document?.title || '';

		// Exact match (case-insensitive)
		if (briefName.toLowerCase() === query.toLowerCase()) {
			return true;
		}

		// Partial match
		if (briefName.toLowerCase().includes(query.toLowerCase())) {
			return true;
		}

		// Match by ID (full or last 8 chars)
		if (
			brief.id === query ||
			brief.id.toLowerCase() === query.toLowerCase() ||
			brief.id.slice(-8).toLowerCase() === query.toLowerCase()
		) {
			return true;
		}

		return false;
	}

	/**
	 * Get tags with detailed statistics for all briefs in an organization
	 * Used for API storage to show brief statistics
	 */
	async getTagsWithStats(
		briefs: Brief[],
		currentBriefId: string | undefined,
		repository: TaskRepository,
		_projectId?: string
	): Promise<{
		tags: TagWithStats[];
		currentTag: string | null;
		totalTags: number;
	}> {
		// For each brief, get task counts by querying tasks
		const tagsWithStats = await Promise.all(
			briefs.map(async (brief: Brief) => {
				try {
					// Get all tasks for this brief
					const tasks = await repository.getTasks(brief.id, {});

					// Calculate statistics
					const statusBreakdown: Record<string, number> = {};
					let completedTasks = 0;

					const subtaskCounts = {
						totalSubtasks: 0,
						subtasksByStatus: {} as Record<string, number>
					};

					tasks.forEach((task) => {
						// Count task status
						const status = task.status || 'pending';
						statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

						if (status === 'done') {
							completedTasks++;
						}

						// Count subtasks
						if (task.subtasks && task.subtasks.length > 0) {
							subtaskCounts.totalSubtasks += task.subtasks.length;

							task.subtasks.forEach((subtask) => {
								const subStatus = subtask.status || 'pending';
								subtaskCounts.subtasksByStatus[subStatus] =
									(subtaskCounts.subtasksByStatus[subStatus] || 0) + 1;
							});
						}
					});

					return {
						name:
							brief.document?.title ||
							brief.document?.document_name ||
							brief.id,
						isCurrent: currentBriefId === brief.id,
						taskCount: tasks.length,
						completedTasks,
						statusBreakdown,
						subtaskCounts:
							subtaskCounts.totalSubtasks > 0 ? subtaskCounts : undefined,
						created: brief.createdAt,
						description: brief.document?.description,
						status: brief.status,
						briefId: brief.id,
						updatedAt: brief.updatedAt
					};
				} catch (error) {
					// If we can't get tasks for a brief, return it with 0 tasks
					console.warn(`Failed to get tasks for brief ${brief.id}:`, error);
					return {
						name:
							brief.document?.title ||
							brief.document?.document_name ||
							brief.id,
						isCurrent: currentBriefId === brief.id,
						taskCount: 0,
						completedTasks: 0,
						statusBreakdown: {},
						created: brief.createdAt,
						description: brief.document?.description,
						status: brief.status,
						briefId: brief.id,
						updatedAt: brief.updatedAt
					};
				}
			})
		);

		// Define priority order for brief statuses
		const statusPriority: Record<string, number> = {
			delivering: 1,
			aligned: 2,
			refining: 3,
			draft: 4,
			delivered: 5,
			done: 6,
			archived: 7
		};

		// Sort tags: first by status priority, then by updatedAt (most recent first) within each status
		const sortedTags = tagsWithStats.sort((a, b) => {
			// Get status priorities (default to 999 for unknown statuses)
			const statusA = (a.status || '').toLowerCase();
			const statusB = (b.status || '').toLowerCase();
			const priorityA = statusPriority[statusA] ?? 999;
			const priorityB = statusPriority[statusB] ?? 999;

			// Sort by status priority first
			if (priorityA !== priorityB) {
				return priorityA - priorityB;
			}

			// Within same status, sort by updatedAt (most recent first)
			const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
			const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
			return dateB - dateA; // Descending order (most recent first)
		});

		// Find current brief name
		const currentBrief = briefs.find((b) => b.id === currentBriefId);
		const currentTag = currentBrief
			? currentBrief.document?.title ||
				currentBrief.document?.document_name ||
				null
			: null;

		return {
			tags: sortedTags,
			currentTag,
			totalTags: sortedTags.length
		};
	}

	/**
	 * Validate that a brief was found, throw error if not
	 */
	validateBriefFound(
		brief: Brief | undefined,
		nameOrId: string
	): asserts brief is Brief {
		if (!brief) {
			throw new TaskMasterError(
				`Brief "${nameOrId}" not found in organization`,
				ERROR_CODES.NOT_FOUND
			);
		}
	}
}
