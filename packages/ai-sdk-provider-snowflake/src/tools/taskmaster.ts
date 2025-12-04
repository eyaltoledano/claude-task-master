/**
 * TaskMaster Integration Tools
 * 
 * Provides tools for accessing TaskMaster task information
 * to give the model context about project tasks and progress.
 */

import { z } from 'zod';
import type {
	TaskSummary,
	TaskDetails,
	ListTasksResult,
	CurrentContextResult
} from './types.js';

/**
 * Tool definition type that works with AI SDK
 * Note: Using z.ZodType<TInput, z.ZodTypeDef, unknown> to allow schemas with defaults
 */
export interface ToolDefinition<TInput, TOutput> {
	description: string;
	parameters: z.ZodType<TInput, z.ZodTypeDef, unknown>;
	execute: (input: TInput) => Promise<TOutput>;
}

/**
 * Load tasks from tasks.json file
 */
async function loadTasks(
	projectRoot: string,
	tag?: string,
	fs?: typeof import('fs/promises'),
	path?: typeof import('path')
): Promise<{ tasks: TaskDetails[]; currentTag: string } | null> {
	const fsModule = fs || await import('fs/promises');
	const pathModule = path || await import('path');
	
	const tasksPath = pathModule.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
	
	try {
		const content = await fsModule.readFile(tasksPath, 'utf-8');
		const data = JSON.parse(content);
		
		// Handle tagged task lists format
		if (data.tags) {
			const targetTag = tag || data.currentTag || 'master';
			const tagData = data.tags[targetTag];
			if (tagData?.tasks) {
				return { tasks: tagData.tasks, currentTag: targetTag };
			}
		}
		
		// Legacy format
		if (Array.isArray(data.tasks)) {
			return { tasks: data.tasks, currentTag: 'master' };
		}
		
		// Direct array format
		if (Array.isArray(data)) {
			return { tasks: data, currentTag: 'master' };
		}
		
		return null;
	} catch {
		return null;
	}
}

/**
 * Load current tag from state file
 */
async function loadCurrentTag(projectRoot: string, fs?: typeof import('fs/promises'), path?: typeof import('path')): Promise<string> {
	const fsModule = fs || await import('fs/promises');
	const pathModule = path || await import('path');
	
	const statePath = pathModule.join(projectRoot, '.taskmaster', 'state.json');
	
	try {
		const content = await fsModule.readFile(statePath, 'utf-8');
		const state = JSON.parse(content);
		return state.currentTag || 'master';
	} catch {
		return 'master';
	}
}

/**
 * Convert full task to summary
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
// Note: Using .default() without .optional() - Zod's .default() already handles undefined input
export const listTasksInputSchema = z.object({
	status: z.enum(['all', 'pending', 'in-progress', 'done', 'blocked', 'cancelled']).default('all')
		.describe('Filter tasks by status'),
	tag: z.string().optional()
		.describe('Filter by tag (defaults to current active tag)'),
	withSubtasks: z.boolean().default(false)
		.describe('Include subtask information')
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
	description: 'List TaskMaster tasks with status and priority. Useful for understanding project progress and what needs to be done.',
	parameters: listTasksInputSchema,
	execute: async (input: ListTasksInput): Promise<ListTasksResult> => {
		const { status = 'all', tag, withSubtasks = false } = input;
		const projectRoot = process.env.PROJECT_ROOT || process.cwd();
		const result = await loadTasks(projectRoot, tag);
		
		if (!result) {
			return { tasks: [], totalTasks: 0, tag: tag || 'master' };
		}
		
		let tasks = result.tasks;
		
		// Filter by status
		if (status !== 'all') {
			tasks = tasks.filter(t => t.status === status);
		}
		
		// Convert to summaries
		const summaries: TaskSummary[] = tasks.map(task => {
			const summary = toSummary(task);
			
			if (withSubtasks && task.subtasks) {
				const subtaskStatuses = task.subtasks.reduce((acc, st) => {
					acc[st.status] = (acc[st.status] || 0) + 1;
					return acc;
				}, {} as Record<string, number>);
				
				summary.title = `${task.title} (${task.subtasks.length} subtasks: ${Object.entries(subtaskStatuses).map(([s, c]) => `${c} ${s}`).join(', ')})`;
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
	description: 'Get detailed information about a specific task or subtask by ID. Returns full task details including description, implementation details, and test strategy.',
	parameters: getTaskInputSchema,
	execute: async (input: GetTaskInput): Promise<TaskDetails | null> => {
		const { id } = input;
		const projectRoot = process.env.PROJECT_ROOT || process.cwd();
		const result = await loadTasks(projectRoot);
		
		if (!result) return null;
		
		const parts = id.split('.');
		const taskId = parseInt(parts[0], 10);
		const subtaskId = parts.length > 1 ? parseInt(parts[1], 10) : null;
		
		const task = result.tasks.find(t => Number(t.id) === taskId);
		if (!task) return null;
		
		if (subtaskId !== null && task.subtasks) {
			const subtask = task.subtasks.find(st => Number(st.id) === subtaskId);
			if (subtask) {
				return {
					...subtask,
					id: `${taskId}.${subtaskId}`,
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
			hasSubtasks: Array.isArray(task.subtasks) && task.subtasks.length > 0,
			// Keep subtasks as-is since they already have full details from tasks.json
			subtasks: task.subtasks
		};
	}
};

/**
 * Get Next Task Tool
 */
export const getNextTaskTool: ToolDefinition<GetNextTaskInput, TaskDetails | null> = {
	description: 'Get the next task to work on based on dependencies and priority. Returns the highest priority task with all dependencies satisfied.',
	parameters: getNextTaskInputSchema,
	execute: async (input: GetNextTaskInput): Promise<TaskDetails | null> => {
		const { tag } = input;
		const projectRoot = process.env.PROJECT_ROOT || process.cwd();
		const result = await loadTasks(projectRoot, tag);
		
		if (!result) return null;
		
		const completedIds = new Set(result.tasks.filter(t => t.status === 'done').map(t => String(t.id)));
		const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
		
		const eligible = result.tasks
			.filter(t => {
				if (t.status !== 'pending') return false;
				const deps = t.dependencies || [];
				return deps.every(d => completedIds.has(String(d)));
			})
			.sort((a, b) => {
				const priorityDiff = (priorityOrder[a.priority || 'medium'] || 1) - (priorityOrder[b.priority || 'medium'] || 1);
				if (priorityDiff !== 0) return priorityDiff;
				return Number(a.id) - Number(b.id);
			});
		
		if (eligible.length === 0) return null;
		
		const next = eligible[0];
		return {
			...next,
			id: String(next.id),
			dependencies: (next.dependencies || []).map(String),
			hasSubtasks: Array.isArray(next.subtasks) && next.subtasks.length > 0,
			// Keep subtasks as-is since they already have full details from tasks.json
			subtasks: next.subtasks
		};
	}
};

/**
 * Get Current Context Tool
 */
export const getCurrentContextTool: ToolDefinition<GetCurrentContextInput, CurrentContextResult> = {
	description: 'Get current TaskMaster context (active tag, in-progress tasks, recently completed). Useful for understanding current project state.',
	parameters: getCurrentContextInputSchema,
	execute: async (): Promise<CurrentContextResult> => {
		const projectRoot = process.env.PROJECT_ROOT || process.cwd();
		const currentTag = await loadCurrentTag(projectRoot);
		const result = await loadTasks(projectRoot, currentTag);
		
		if (!result) {
			return { currentTag, inProgressTasks: [], recentlyCompleted: [], projectRoot };
		}
		
		const inProgress = result.tasks.filter(t => t.status === 'in-progress').map(toSummary);
		const completed = result.tasks.filter(t => t.status === 'done').slice(-5).map(toSummary);
		
		return { currentTag: result.currentTag, inProgressTasks: inProgress, recentlyCompleted: completed, projectRoot };
	}
};

export { listTasksTool as listTasks, getTaskTool as getTask, getNextTaskTool as getNextTask, getCurrentContextTool as getCurrentContext };
export default { listTasks: listTasksTool, getTask: getTaskTool, getNextTask: getNextTaskTool, getCurrentContext: getCurrentContextTool };
