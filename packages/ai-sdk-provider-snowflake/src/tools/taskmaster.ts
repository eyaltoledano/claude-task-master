/**
 * TaskMaster Integration Tools - Read-only task context for AI models
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type {
	TaskSummary,
	TaskDetails,
	ListTasksResult,
	CurrentContextResult,
	ToolDefinition
} from './types.js';
import { getProjectRoot } from '../config/index.js';

/** Priority order for task sorting */
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Load tasks from tasks.json, handling all format variants
 */
async function loadTasks(projectRoot: string, tag?: string): Promise<{ tasks: TaskDetails[]; currentTag: string } | null> {
	const tasksPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');

	try {
		const data = JSON.parse(await fs.readFile(tasksPath, 'utf-8'));

		// Tagged format: { tags: { master: { tasks: [...] } } }
		if (data.tags) {
			const targetTag = tag || data.currentTag || 'master';
			const tagData = data.tags[targetTag];
			if (tagData?.tasks) return { tasks: tagData.tasks, currentTag: targetTag };
		}

		// Legacy format: { tasks: [...] }
		if (Array.isArray(data.tasks)) return { tasks: data.tasks, currentTag: 'master' };

		// Direct array format: [...]
		if (Array.isArray(data)) return { tasks: data, currentTag: 'master' };

		return null;
	} catch {
		return null;
	}
}

/**
 * Load current tag from state file
 */
async function loadCurrentTag(projectRoot: string): Promise<string> {
	try {
		const state = JSON.parse(await fs.readFile(path.join(projectRoot, '.taskmaster', 'state.json'), 'utf-8'));
		return state.currentTag || 'master';
	} catch {
		return 'master';
	}
}

/**
 * Convert task to summary format
 */
function toSummary(task: TaskDetails): TaskSummary {
	return {
		id: String(task.id),
		title: task.title,
		status: task.status,
		priority: task.priority || 'medium',
		dependencies: (task.dependencies || []).map(String),
		hasSubtasks: Array.isArray(task.subtasks) && task.subtasks.length > 0
	};
}

// Input Schemas
export const listTasksInputSchema = z.object({
	status: z.enum(['all', 'pending', 'in-progress', 'done', 'blocked', 'cancelled']).default('all').describe('Filter tasks by status'),
	tag: z.string().optional().describe('Filter by tag (defaults to current active tag)'),
	withSubtasks: z.boolean().default(false).describe('Include subtask information')
});

export const getTaskInputSchema = z.object({
	id: z.string().describe('Task ID (e.g., "5" or "5.2" for subtask)')
});

export const getNextTaskInputSchema = z.object({
	tag: z.string().optional().describe('Tag context (defaults to current active tag)')
});

export const getCurrentContextInputSchema = z.object({});

type ListTasksInput = z.infer<typeof listTasksInputSchema>;
type GetTaskInput = z.infer<typeof getTaskInputSchema>;
type GetNextTaskInput = z.infer<typeof getNextTaskInputSchema>;
type GetCurrentContextInput = z.infer<typeof getCurrentContextInputSchema>;

/**
 * List Tasks Tool
 */
export const listTasksTool: ToolDefinition<ListTasksInput, ListTasksResult> = {
	description: 'List TaskMaster tasks with status and priority. Useful for understanding project progress.',
	parameters: listTasksInputSchema,
	execute: async (input: ListTasksInput): Promise<ListTasksResult> => {
		const { status = 'all', tag, withSubtasks = false } = input;
		const result = await loadTasks(getProjectRoot(), tag);

		if (!result) return { tasks: [], totalTasks: 0, tag: tag || 'master' };

		const tasks = status === 'all' ? result.tasks : result.tasks.filter((t) => t.status === status);

		const summaries = tasks.map((task) => {
			const summary = toSummary(task);
			if (withSubtasks && task.subtasks?.length) {
				const counts = task.subtasks.reduce((acc, st) => {
					acc[st.status] = (acc[st.status] || 0) + 1;
					return acc;
				}, {} as Record<string, number>);
				summary.title = `${task.title} (${task.subtasks.length} subtasks: ${Object.entries(counts).map(([s, c]) => `${c} ${s}`).join(', ')})`;
			}
			return summary;
		});

		return { tasks: summaries, totalTasks: summaries.length, tag: result.currentTag };
	}
};

/**
 * Get Task Tool
 */
export const getTaskTool: ToolDefinition<GetTaskInput, TaskDetails | null> = {
	description: 'Get detailed information about a specific task or subtask by ID.',
	parameters: getTaskInputSchema,
	execute: async (input: GetTaskInput): Promise<TaskDetails | null> => {
		const result = await loadTasks(getProjectRoot());
		if (!result) return null;

		const [taskIdStr, subtaskIdStr] = input.id.split('.');
		const taskId = parseInt(taskIdStr, 10);
		const task = result.tasks.find((t) => Number(t.id) === taskId);
		if (!task) return null;

		// Return subtask if requested
		if (subtaskIdStr && task.subtasks) {
			const subtask = task.subtasks.find((st) => Number(st.id) === parseInt(subtaskIdStr, 10));
			if (subtask) {
				return {
					...subtask,
					id: `${taskId}.${subtask.id}`,
					dependencies: (subtask.dependencies || []).map(String),
					hasSubtasks: false,
					description: subtask.description || ''
				} as TaskDetails;
			}
			return null;
		}

		return {
			...task,
			id: String(task.id),
			dependencies: (task.dependencies || []).map(String),
			hasSubtasks: Array.isArray(task.subtasks) && task.subtasks.length > 0
		};
	}
};

/**
 * Get Next Task Tool
 */
export const getNextTaskTool: ToolDefinition<GetNextTaskInput, TaskDetails | null> = {
	description: 'Get the next task to work on based on dependencies and priority.',
	parameters: getNextTaskInputSchema,
	execute: async (input: GetNextTaskInput): Promise<TaskDetails | null> => {
		const result = await loadTasks(getProjectRoot(), input.tag);
		if (!result) return null;

		const completedIds = new Set(result.tasks.filter((t) => t.status === 'done').map((t) => String(t.id)));

		const next = result.tasks
			.filter((t) => t.status === 'pending' && (t.dependencies || []).every((d) => completedIds.has(String(d))))
			.sort((a, b) => {
				const priorityDiff = (PRIORITY_ORDER[a.priority || 'medium'] ?? 1) - (PRIORITY_ORDER[b.priority || 'medium'] ?? 1);
				return priorityDiff !== 0 ? priorityDiff : Number(a.id) - Number(b.id);
			})[0];

		if (!next) return null;

		return {
			...next,
			id: String(next.id),
			dependencies: (next.dependencies || []).map(String),
			hasSubtasks: Array.isArray(next.subtasks) && next.subtasks.length > 0
		};
	}
};

/**
 * Get Current Context Tool
 */
export const getCurrentContextTool: ToolDefinition<GetCurrentContextInput, CurrentContextResult> = {
	description: 'Get current TaskMaster context (active tag, in-progress tasks, recently completed).',
	parameters: getCurrentContextInputSchema,
	execute: async (): Promise<CurrentContextResult> => {
		const projectRoot = getProjectRoot();
		const currentTag = await loadCurrentTag(projectRoot);
		const result = await loadTasks(projectRoot, currentTag);

		if (!result) {
			return { currentTag, inProgressTasks: [], recentlyCompleted: [], projectRoot };
		}

		return {
			currentTag: result.currentTag,
			inProgressTasks: result.tasks.filter((t) => t.status === 'in-progress').map(toSummary),
			recentlyCompleted: result.tasks.filter((t) => t.status === 'done').slice(-5).map(toSummary),
			projectRoot
		};
	}
};

export { listTasksTool as listTasks, getTaskTool as getTask, getNextTaskTool as getNextTask, getCurrentContextTool as getCurrentContext };
export default { listTasks: listTasksTool, getTask: getTaskTool, getNextTask: getNextTaskTool, getCurrentContext: getCurrentContextTool };
