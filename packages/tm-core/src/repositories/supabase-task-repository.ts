import { SupabaseClient } from '@supabase/supabase-js';
import { Task } from '../types/index.js';
import { Database } from '../types/database.types.js';
import { TaskMapper } from '../mappers/TaskMapper.js';
import { AuthManager } from '../auth/auth-manager.js';
import { z } from 'zod';

// Zod schema for task status validation
const TaskStatusSchema = z.enum([
	'pending',
	'in-progress',
	'done',
	'review',
	'deferred',
	'cancelled',
	'blocked'
]);

// Zod schema for task updates
const TaskUpdateSchema = z
	.object({
		title: z.string().min(1).optional(),
		description: z.string().optional(),
		status: TaskStatusSchema.optional(),
		priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
		details: z.string().optional(),
		testStrategy: z.string().optional()
	})
	.partial();

export class SupabaseTaskRepository {
	constructor(private supabase: SupabaseClient<Database>) {}

	async getTasks(_projectId?: string): Promise<Task[]> {
		// Get the current context to determine briefId
		const authManager = AuthManager.getInstance();
		const context = authManager.getContext();

		if (!context || !context.briefId) {
			throw new Error(
				'No brief selected. Please select a brief first using: tm context brief'
			);
		}

		// Get all tasks for the brief using the exact query structure
		const { data: tasks, error } = await this.supabase
			.from('tasks')
			.select(`
        *,
        document:document_id (
          id,
          document_name,
          title,
          description
        )
      `)
			.eq('brief_id', context.briefId)
			.order('position', { ascending: true })
			.order('subtask_position', { ascending: true })
			.order('created_at', { ascending: true });

		if (error) {
			throw new Error(`Failed to fetch tasks: ${error.message}`);
		}

		if (!tasks || tasks.length === 0) {
			return [];
		}

		// Get all dependencies for these tasks
		const taskIds = tasks.map((t: any) => t.id);
		const { data: depsData, error: depsError } = await this.supabase
			.from('task_dependencies')
			.select('*')
			.in('task_id', taskIds);

		if (depsError) {
			throw new Error(
				`Failed to fetch task dependencies: ${depsError.message}`
			);
		}

		// Use mapper to convert to internal format
		return TaskMapper.mapDatabaseTasksToTasks(tasks, depsData || []);
	}

	async getTask(_projectId: string, taskId: string): Promise<Task | null> {
		// Get the current context to determine briefId (projectId not used in Supabase context)
		const authManager = AuthManager.getInstance();
		const context = authManager.getContext();

		if (!context || !context.briefId) {
			throw new Error(
				'No brief selected. Please select a brief first using: tm context brief'
			);
		}

		const { data, error } = await this.supabase
			.from('tasks')
			.select('*')
			.eq('brief_id', context.briefId)
			.eq('display_id', taskId.toUpperCase())
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				return null; // Not found
			}
			throw new Error(`Failed to fetch task: ${error.message}`);
		}

		// Get dependencies for this task
		const { data: depsData } = await this.supabase
			.from('task_dependencies')
			.select('*')
			.eq('task_id', taskId);

		// Get subtasks if this is a parent task
		const { data: subtasksData } = await this.supabase
			.from('tasks')
			.select('*')
			.eq('parent_task_id', taskId)
			.order('subtask_position', { ascending: true });

		// Create dependency map
		const dependenciesByTaskId = new Map<string, string[]>();
		if (depsData) {
			dependenciesByTaskId.set(
				taskId,
				depsData.map(
					(d: Database['public']['Tables']['task_dependencies']['Row']) =>
						d.depends_on_task_id
				)
			);
		}

		// Use mapper to convert single task
		return TaskMapper.mapDatabaseTaskToTask(
			data,
			subtasksData || [],
			dependenciesByTaskId
		);
	}

	async updateTask(
		projectId: string,
		taskId: string,
		updates: Partial<Task>
	): Promise<Task> {
		// Get the current context to determine briefId
		const authManager = AuthManager.getInstance();
		const context = authManager.getContext();

		if (!context || !context.briefId) {
			throw new Error(
				'No brief selected. Please select a brief first using: tm context brief'
			);
		}

		// Validate updates using Zod schema
		try {
			TaskUpdateSchema.parse(updates);
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.errors
					.map((err) => `${err.path.join('.')}: ${err.message}`)
					.join(', ');
				throw new Error(`Invalid task update data: ${errorMessages}`);
			}
			throw error;
		}

		// Convert Task fields to database fields - only include fields that actually exist in the database
		const dbUpdates: any = {};

		if (updates.title !== undefined) dbUpdates.title = updates.title;
		if (updates.description !== undefined)
			dbUpdates.description = updates.description;
		if (updates.status !== undefined)
			dbUpdates.status = this.mapStatusToDatabase(updates.status);
		if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
		// Skip fields that don't exist in database schema: details, testStrategy, etc.

		// Update the task
		const { error } = await this.supabase
			.from('tasks')
			.update(dbUpdates)
			.eq('brief_id', context.briefId)
			.eq('display_id', taskId.toUpperCase());

		if (error) {
			throw new Error(`Failed to update task: ${error.message}`);
		}

		// Return the updated task by fetching it
		const updatedTask = await this.getTask(projectId, taskId);
		if (!updatedTask) {
			throw new Error(`Failed to retrieve updated task ${taskId}`);
		}

		return updatedTask;
	}

	/**
	 * Maps internal status to database status
	 */
	private mapStatusToDatabase(
		status: string
	): Database['public']['Enums']['task_status'] {
		switch (status) {
			case 'pending':
				return 'todo';
			case 'in-progress':
			case 'in_progress': // Accept both formats
				return 'in_progress';
			case 'done':
				return 'done';
			default:
				throw new Error(
					`Invalid task status: ${status}. Valid statuses are: pending, in-progress, done`
				);
		}
	}
}
