import { SupabaseClient } from '@supabase/supabase-js';
import { Task } from '../types/index.js';
import { Database } from '../types/database.types.js';
import { TaskMapper } from '../mappers/TaskMapper.js';
import { AuthManager } from '../auth/auth-manager.js';

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

	async getTask(accountId: string, taskId: string): Promise<Task | null> {
		const { data, error } = await this.supabase
			.from('tasks')
			.select('*')
			.eq('account_id', accountId)
			.eq('id', taskId)
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
}
