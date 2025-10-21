import { SupabaseClient } from '@supabase/supabase-js';
import { Task } from '../../../../common/types/index.js';
import { Database, Json } from '../../../../common/types/database.types.js';
import { TaskMapper } from '../../../../common/mappers/TaskMapper.js';
import { AuthManager } from '../../../auth/managers/auth-manager.js';
import { DependencyFetcher } from './dependency-fetcher.js';
import {
	TaskWithRelations,
	TaskDatabaseUpdate
} from '../../../../common/types/repository-types.js';
import { LoadTasksOptions } from '../../../../common/interfaces/storage.interface.js';
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
	private dependencyFetcher: DependencyFetcher;
	private authManager: AuthManager;

	constructor(private supabase: SupabaseClient<Database>) {
		this.dependencyFetcher = new DependencyFetcher(supabase);
		this.authManager = AuthManager.getInstance();
	}

	/**
	 * Gets the current brief ID from auth context
	 * @throws {Error} If no brief is selected
	 */
	private getBriefIdOrThrow(): string {
		const context = this.authManager.getContext();
		if (!context?.briefId) {
			throw new Error(
				'No brief selected. Please select a brief first using: tm context brief'
			);
		}
		return context.briefId;
	}

	async getTasks(
		_projectId?: string,
		options?: LoadTasksOptions
	): Promise<Task[]> {
		const briefId = this.getBriefIdOrThrow();

		// Build query with filters
		let query = this.supabase
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
			.eq('brief_id', briefId);

		// Apply status filter at database level if specified
		if (options?.status) {
			const dbStatus = this.mapStatusToDatabase(options.status);
			query = query.eq('status', dbStatus);
		}

		// Apply subtask exclusion at database level if specified
		if (options?.excludeSubtasks) {
			// Only fetch parent tasks (where parent_task_id is null)
			query = query.is('parent_task_id', null);
		}

		// Execute query with ordering
		const { data: tasks, error } = await query
			.order('position', { ascending: true })
			.order('subtask_position', { ascending: true })
			.order('created_at', { ascending: true });

		if (error) {
			throw new Error(`Failed to fetch tasks: ${error.message}`);
		}

		if (!tasks || tasks.length === 0) {
			return [];
		}

		// Type-safe task ID extraction
		const typedTasks = tasks as TaskWithRelations[];
		const taskIds = typedTasks.map((t) => t.id);
		const dependenciesMap =
			await this.dependencyFetcher.fetchDependenciesWithDisplayIds(taskIds);

		// Use mapper to convert to internal format
		return TaskMapper.mapDatabaseTasksToTasks(tasks, dependenciesMap);
	}

	async getTask(_projectId: string, taskId: string): Promise<Task | null> {
		const briefId = this.getBriefIdOrThrow();

		const { data, error } = await this.supabase
			.from('tasks')
			.select('*')
			.eq('brief_id', briefId)
			.eq('display_id', taskId.toUpperCase())
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				return null; // Not found
			}
			throw new Error(`Failed to fetch task: ${error.message}`);
		}

		// Get subtasks if this is a parent task
		const { data: subtasksData } = await this.supabase
			.from('tasks')
			.select('*')
			.eq('parent_task_id', data.id)
			.order('subtask_position', { ascending: true });

		// Get all task IDs (parent + subtasks) to fetch dependencies
		const allTaskIds = [data.id, ...(subtasksData?.map((st) => st.id) || [])];

		// Fetch dependencies using the dedicated fetcher
		const dependenciesByTaskId =
			await this.dependencyFetcher.fetchDependenciesWithDisplayIds(allTaskIds);

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
		const briefId = this.getBriefIdOrThrow();

		// Validate updates using Zod schema
		try {
			TaskUpdateSchema.parse(updates);
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.issues
					.map((err) => `${err.path.join('.')}: ${err.message}`)
					.join(', ');
				throw new Error(`Invalid task update data: ${errorMessages}`);
			}
			throw error;
		}

		// Convert Task fields to database fields with proper typing
		const dbUpdates: TaskDatabaseUpdate = {};

		if (updates.title !== undefined) dbUpdates.title = updates.title;
		if (updates.description !== undefined)
			dbUpdates.description = updates.description;
		if (updates.status !== undefined)
			dbUpdates.status = this.mapStatusToDatabase(updates.status);
		if (updates.priority !== undefined)
			dbUpdates.priority = this.mapPriorityToDatabase(updates.priority);

		// Handle metadata fields (details, testStrategy, etc.)
		// Load existing metadata to preserve fields not being updated
		const { data: existingMetadataRow, error: existingMetadataError } =
			await this.supabase
				.from('tasks')
				.select('metadata')
				.eq('brief_id', briefId)
				.eq('display_id', taskId.toUpperCase())
				.single();

		if (existingMetadataError) {
			throw new Error(
				`Failed to load existing task metadata: ${existingMetadataError.message}`
			);
		}

		const metadata: Record<string, unknown> = {
			...((existingMetadataRow?.metadata as Record<string, unknown>) ?? {})
		};

		if (updates.details !== undefined) metadata.details = updates.details;
		if (updates.testStrategy !== undefined)
			metadata.testStrategy = updates.testStrategy;

		if (Object.keys(metadata).length > 0) {
			dbUpdates.metadata = metadata as Json;
		}

		// Update the task
		const { error } = await this.supabase
			.from('tasks')
			.update(dbUpdates)
			.eq('brief_id', briefId)
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

	/**
	 * Maps internal priority to database priority
	 * Task Master uses 'critical', database uses 'urgent'
	 */
	private mapPriorityToDatabase(
		priority: string
	): Database['public']['Enums']['task_priority'] {
		switch (priority) {
			case 'critical':
				return 'urgent';
			case 'low':
			case 'medium':
			case 'high':
				return priority as Database['public']['Enums']['task_priority'];
			default:
				throw new Error(
					`Invalid task priority: ${priority}. Valid priorities are: low, medium, high, critical`
				);
		}
	}
}
