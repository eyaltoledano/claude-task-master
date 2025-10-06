import { Task, Subtask } from '../types/index.js';
import { Database, Tables } from '../types/database.types.js';

type TaskRow = Tables<'tasks'>;

// Legacy type for backward compatibility
type DependencyRow = Tables<'task_dependencies'> & {
	depends_on_task?: { display_id: string } | null;
	depends_on_task_id?: string;
};

export class TaskMapper {
	/**
	 * Maps database tasks to internal Task format
	 * @param dbTasks - Array of tasks from database
	 * @param dependencies - Either a Map of task_id to display_ids or legacy array format
	 */
	static mapDatabaseTasksToTasks(
		dbTasks: TaskRow[],
		dependencies: Map<string, string[]> | DependencyRow[]
	): Task[] {
		if (!dbTasks || dbTasks.length === 0) {
			return [];
		}

		// Handle both Map and array formats for backward compatibility
		const dependenciesByTaskId =
			dependencies instanceof Map
				? dependencies
				: this.groupDependenciesByTaskId(dependencies);

		// Separate parent tasks and subtasks
		const parentTasks = dbTasks.filter((t) => !t.parent_task_id);
		const subtasksByParentId = this.groupSubtasksByParentId(dbTasks);

		// Map parent tasks with their subtasks
		return parentTasks.map((taskRow) =>
			this.mapDatabaseTaskToTask(
				taskRow,
				subtasksByParentId.get(taskRow.id) || [],
				dependenciesByTaskId
			)
		);
	}

	/**
	 * Maps a single database task to internal Task format
	 */
	static mapDatabaseTaskToTask(
		dbTask: TaskRow,
		dbSubtasks: TaskRow[],
		dependenciesByTaskId: Map<string, string[]>
	): Task {
		// Map subtasks
		const subtasks: Subtask[] = dbSubtasks.map((subtask, index) => ({
			id: subtask.display_id || String(index + 1), // Use display_id if available (API storage), fallback to numeric (file storage)
			parentId: dbTask.id,
			title: subtask.title,
			description: subtask.description || '',
			status: this.mapStatus(subtask.status),
			priority: this.mapPriority(subtask.priority),
			dependencies: dependenciesByTaskId.get(subtask.id) || [],
			details: this.extractMetadataField(subtask.metadata, 'details', ''),
			testStrategy: this.extractMetadataField(
				subtask.metadata,
				'testStrategy',
				''
			),
			createdAt: subtask.created_at,
			updatedAt: subtask.updated_at,
			assignee: subtask.assignee_id || undefined,
			complexity: subtask.complexity ?? undefined
		}));

		return {
			id: dbTask.display_id || dbTask.id, // Use display_id if available
			title: dbTask.title,
			description: dbTask.description || '',
			status: this.mapStatus(dbTask.status),
			priority: this.mapPriority(dbTask.priority),
			dependencies: dependenciesByTaskId.get(dbTask.id) || [],
			details: this.extractMetadataField(dbTask.metadata, 'details', ''),
			testStrategy: this.extractMetadataField(
				dbTask.metadata,
				'testStrategy',
				''
			),
			subtasks,
			createdAt: dbTask.created_at,
			updatedAt: dbTask.updated_at,
			assignee: dbTask.assignee_id || undefined,
			complexity: dbTask.complexity ?? undefined,
			effort: dbTask.estimated_hours || undefined,
			actualEffort: dbTask.actual_hours || undefined
		};
	}

	/**
	 * Groups dependencies by task ID (legacy method for backward compatibility)
	 * @deprecated Use DependencyFetcher.fetchDependenciesWithDisplayIds instead
	 */
	private static groupDependenciesByTaskId(
		dependencies: DependencyRow[]
	): Map<string, string[]> {
		const dependenciesByTaskId = new Map<string, string[]>();

		if (dependencies) {
			for (const dep of dependencies) {
				const deps = dependenciesByTaskId.get(dep.task_id) || [];
				// Handle both old format (UUID string) and new format (object with display_id)
				const dependencyId =
					typeof dep.depends_on_task === 'object'
						? dep.depends_on_task?.display_id
						: dep.depends_on_task_id;
				if (dependencyId) {
					deps.push(dependencyId);
				}
				dependenciesByTaskId.set(dep.task_id, deps);
			}
		}

		return dependenciesByTaskId;
	}

	/**
	 * Groups subtasks by their parent ID
	 */
	private static groupSubtasksByParentId(
		tasks: TaskRow[]
	): Map<string, TaskRow[]> {
		const subtasksByParentId = new Map<string, TaskRow[]>();

		for (const task of tasks) {
			if (task.parent_task_id) {
				const subtasks = subtasksByParentId.get(task.parent_task_id) || [];
				subtasks.push(task);
				subtasksByParentId.set(task.parent_task_id, subtasks);
			}
		}

		// Sort subtasks by subtask_position for each parent
		for (const subtasks of subtasksByParentId.values()) {
			subtasks.sort((a, b) => a.subtask_position - b.subtask_position);
		}

		return subtasksByParentId;
	}

	/**
	 * Maps database status to internal status
	 */
	static mapStatus(
		status: Database['public']['Enums']['task_status']
	): Task['status'] {
		switch (status) {
			case 'todo':
				return 'pending';
			case 'in_progress':
				return 'in-progress';
			case 'done':
				return 'done';
			default:
				return 'pending';
		}
	}

	/**
	 * Maps database priority to internal priority
	 */
	private static mapPriority(
		priority: Database['public']['Enums']['task_priority']
	): Task['priority'] {
		switch (priority) {
			case 'urgent':
				return 'critical';
			default:
				return priority as Task['priority'];
		}
	}

	/**
	 * Safely extracts a field from metadata JSON with runtime type validation
	 * @param metadata The metadata object (could be null or any type)
	 * @param field The field to extract
	 * @param defaultValue Default value if field doesn't exist
	 * @returns The extracted value if it matches the expected type, otherwise defaultValue
	 */
	private static extractMetadataField<T>(
		metadata: unknown,
		field: string,
		defaultValue: T
	): T {
		if (!metadata || typeof metadata !== 'object') {
			return defaultValue;
		}

		const value = (metadata as Record<string, unknown>)[field];

		if (value === undefined) {
			return defaultValue;
		}

		// Runtime type validation: ensure value matches the type of defaultValue
		const expectedType = typeof defaultValue;
		const actualType = typeof value;

		if (expectedType !== actualType) {
			console.warn(
				`Type mismatch in metadata field "${field}": expected ${expectedType}, got ${actualType}. Using default value.`
			);
			return defaultValue;
		}

		return value as T;
	}
}
