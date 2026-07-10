/**
 * @fileoverview TaskSearchService
 * Keyword search across tasks and subtasks (title, description, details,
 * test strategy) without consuming AI tokens.
 */

import type { Subtask, Task } from '../../../common/types/index.js';

/**
 * Task fields that can be searched
 */
export const SEARCHABLE_FIELDS = [
	'title',
	'description',
	'details',
	'testStrategy'
] as const;

export type SearchableField = (typeof SEARCHABLE_FIELDS)[number];

/**
 * Options for a task search
 */
export interface TaskSearchOptions {
	/** Restrict matching to these fields (defaults to all searchable fields) */
	fields?: SearchableField[];
}

/**
 * A subtask that matched the query
 */
export interface SubtaskSearchMatch {
	subtask: Subtask;
	/** Fields on the subtask where the query was found */
	matchedFields: SearchableField[];
}

/**
 * A task that matched the query, directly or through its subtasks
 */
export interface TaskSearchMatch {
	task: Task;
	/** Fields on the task itself where the query was found (empty if only subtasks matched) */
	matchedFields: SearchableField[];
	/** Subtasks of this task that matched */
	subtaskMatches: SubtaskSearchMatch[];
}

/**
 * Service for keyword search across tasks and subtasks.
 * Pure logic - takes tasks as input, performs no I/O.
 */
export class TaskSearchService {
	/**
	 * Search tasks (and their subtasks) for a case-insensitive keyword.
	 * A task is included if the query matches one of its searchable fields
	 * or one of its subtasks' searchable fields.
	 */
	search(
		tasks: Task[],
		query: string,
		options: TaskSearchOptions = {}
	): TaskSearchMatch[] {
		const normalizedQuery = query.trim().toLowerCase();
		if (normalizedQuery.length === 0) {
			return [];
		}

		const fields = options.fields?.length
			? options.fields
			: [...SEARCHABLE_FIELDS];

		const matches: TaskSearchMatch[] = [];
		for (const task of tasks) {
			const matchedFields = this.getMatchedFields(task, normalizedQuery, fields);

			const subtaskMatches: SubtaskSearchMatch[] = [];
			for (const subtask of task.subtasks ?? []) {
				const subtaskFields = this.getMatchedFields(
					subtask,
					normalizedQuery,
					fields
				);
				if (subtaskFields.length > 0) {
					subtaskMatches.push({ subtask, matchedFields: subtaskFields });
				}
			}

			if (matchedFields.length > 0 || subtaskMatches.length > 0) {
				matches.push({ task, matchedFields, subtaskMatches });
			}
		}

		return matches;
	}

	private getMatchedFields(
		item: Pick<Task, SearchableField> | Subtask,
		normalizedQuery: string,
		fields: SearchableField[]
	): SearchableField[] {
		return fields.filter((field) => {
			const value = item[field];
			return (
				typeof value === 'string' &&
				value.toLowerCase().includes(normalizedQuery)
			);
		});
	}
}
