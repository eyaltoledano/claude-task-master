import { Task, TaskTag } from '../../../common/types/index.js';
import { LoadTasksOptions } from '../../../common/interfaces/storage.interface.js';

export interface TaskRepository {
	// Task operations
	getTasks(projectId: string, options?: LoadTasksOptions): Promise<Task[]>;
	getTask(projectId: string, taskId: string): Promise<Task | null>;
	createTask(projectId: string, task: Omit<Task, 'id'>): Promise<Task>;
	updateTask(
		projectId: string,
		taskId: string,
		updates: Partial<Task>
	): Promise<Task>;
	deleteTask(projectId: string, taskId: string): Promise<void>;

	// Tag operations
	getTags(projectId: string): Promise<TaskTag[]>;
	getTag(projectId: string, tagName: string): Promise<TaskTag | null>;
	createTag(projectId: string, tag: TaskTag): Promise<TaskTag>;
	updateTag(
		projectId: string,
		tagName: string,
		updates: Partial<TaskTag>
	): Promise<TaskTag>;
	deleteTag(projectId: string, tagName: string): Promise<void>;

	// Bulk operations
	bulkCreateTasks(
		projectId: string,
		tasks: Omit<Task, 'id'>[]
	): Promise<Task[]>;
	bulkUpdateTasks(
		projectId: string,
		updates: Array<{ id: string; updates: Partial<Task> }>
	): Promise<Task[]>;
	bulkDeleteTasks(projectId: string, taskIds: string[]): Promise<void>;
}
