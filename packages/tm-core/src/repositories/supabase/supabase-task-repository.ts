import { SupabaseClient } from '@supabase/supabase-js';
import { Task } from '../../types/index.js';
import { Database, Json } from '../../types/database.types.js';
import { TaskMapper } from '../../mappers/TaskMapper.js';
import { AuthManager } from '../../auth/auth-manager.js';
import { DependencyFetcher } from './dependency-fetcher.js';
import {
	TaskWithRelations,
	TaskDatabaseUpdate
} from '../../types/repository-types.js';
import { z } from 'zod';

// Type for task metadata stored in database
interface TaskMetadata {
	original_id?: string;
	details?: string;
	test_strategy?: string;
	complexity?: number;
	[key: string]: any;
}

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

	async getTasks(_projectId?: string): Promise<Task[]> {
		const briefId = this.getBriefIdOrThrow();

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
			.eq('brief_id', briefId)
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
	 * Extract tasks to a brief
	 * Creates tasks in the target brief from the provided task data
	 */
	async extractTasks(
		targetBriefId: string,
		tasks: any[]
	): Promise<{ success: boolean; count: number; error?: string }> {
		try {
			// Validate that the target brief exists and user has access
			const { data: briefData, error: briefError } = await this.supabase
				.from('brief')
				.select('id, account_id')
				.eq('id', targetBriefId)
				.single();

			if (briefError || !briefData) {
				return {
					success: false,
					count: 0,
					error: 'Target brief not found or you do not have access'
				};
			}

			const accountId = briefData.account_id;
			let totalInserted = 0;

			// Phase 1: Insert parent tasks first
			const parentTasks = this.prepareParentTasks(
				targetBriefId,
				accountId,
				tasks
			);

			const { data: insertedParents, error: parentError } = await this.supabase
				.from('tasks')
				.insert(parentTasks)
				.select('id, metadata');

			if (parentError) {
				return {
					success: false,
					count: 0,
					error: `Failed to extract parent tasks: ${parentError.message}`
				};
			}

			totalInserted += insertedParents?.length || 0;

			// Create mapping from original IDs to actual database UUIDs
			const idMapping = new Map<string, string>();
			insertedParents?.forEach((task) => {
				const metadata = task.metadata as TaskMetadata;
				if (metadata?.original_id) {
					idMapping.set(metadata.original_id, task.id);
				}
			});

			// Phase 2: Prepare and insert subtasks with correct parent_task_id
			const subtaskBatches: any[] = [];
			tasks.forEach((task) => {
				if (task.subtasks && task.subtasks.length > 0) {
					const parentId = idMapping.get(task.id);
					if (parentId) {
						const subtasks = this.prepareSubtasks(
							targetBriefId,
							accountId,
							task.subtasks,
							parentId
						);
						subtaskBatches.push(...subtasks);
					}
				}
			});

			if (subtaskBatches.length > 0) {
				const { data: insertedSubtasks, error: subtaskError } =
					await this.supabase
						.from('tasks')
						.insert(subtaskBatches)
						.select('id, metadata');

				if (subtaskError) {
					console.warn(
						`Warning: Some subtasks could not be created: ${subtaskError.message}`
					);
				} else {
					totalInserted += insertedSubtasks?.length || 0;

					// Update ID mapping with subtask IDs for dependency creation
					insertedSubtasks?.forEach((task) => {
						const metadata = task.metadata as TaskMetadata;
						if (metadata?.original_id) {
							idMapping.set(metadata.original_id, task.id);
						}
					});
				}
			}

			// Phase 3: Handle dependencies if any tasks have them
			const dependenciesToCreate = this.prepareDependencies(tasks, idMapping);

			if (dependenciesToCreate.length > 0) {
				const { error: depError } = await this.supabase
					.from('task_dependencies')
					.insert(dependenciesToCreate);

				if (depError) {
					console.warn(
						`Warning: Some dependencies could not be created: ${depError.message}`
					);
				}
			}

			return {
				success: true,
				count: totalInserted
			};
		} catch (error) {
			return {
				success: false,
				count: 0,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * Prepare parent tasks only (no subtasks)
	 */
	private prepareParentTasks(
		briefId: string,
		accountId: string,
		tasks: any[]
	): any[] {
		return tasks.map((task, index) => ({
			account_id: accountId,
			brief_id: briefId,
			title: task.title || 'Untitled Task',
			description: task.description || '',
			status: this.mapStatusToDatabase(task.status || 'pending'),
			priority: task.priority || 'medium',
			position: index + 1,
			// Store original ID and additional fields in metadata
			metadata: {
				original_id: task.id,
				details: task.details,
				test_strategy: task.testStrategy,
				complexity: task.complexity
			}
		}));
	}

	/**
	 * Prepare subtasks with their parent_task_id (UUID)
	 */
	private prepareSubtasks(
		briefId: string,
		accountId: string,
		subtasks: any[],
		parentTaskId: string
	): any[] {
		return subtasks.map((subtask, index) => ({
			account_id: accountId,
			brief_id: briefId,
			title: subtask.title || 'Untitled Subtask',
			description: subtask.description || '',
			status: this.mapStatusToDatabase(subtask.status || 'pending'),
			priority: subtask.priority || 'medium',
			parent_task_id: parentTaskId,
			subtask_position: index + 1,
			// Store original ID for dependency mapping
			metadata: {
				original_id: subtask.id,
				details: subtask.details,
				test_strategy: subtask.testStrategy,
				complexity: subtask.complexity
			}
		}));
	}

	/**
	 * Prepare task dependencies for insertion
	 */
	private prepareDependencies(
		originalTasks: any[],
		idMapping: Map<string, string>
	): any[] {
		const dependencies: any[] = [];

		// Process dependencies for all tasks (including subtasks)
		const processTaskDependencies = (tasks: any[]) => {
			tasks.forEach((task) => {
				if (task.dependencies && task.dependencies.length > 0) {
					const taskId = idMapping.get(task.id);
					if (taskId) {
						task.dependencies.forEach((depId: string) => {
							const dependsOnId = idMapping.get(depId);
							if (dependsOnId) {
								dependencies.push({
									task_id: taskId,
									depends_on_task_id: dependsOnId
								});
							}
						});
					}
				}

				// Process subtask dependencies too
				if (task.subtasks && task.subtasks.length > 0) {
					processTaskDependencies(task.subtasks);
				}
			});
		};

		processTaskDependencies(originalTasks);
		return dependencies;
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
