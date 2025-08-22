/**
 * Core type definitions for Task Master
 */

// ============================================================================
// Type Literals
// ============================================================================

/**
 * Task status values
 */
export type TaskStatus =
	| 'pending'
	| 'in-progress'
	| 'done'
	| 'deferred'
	| 'cancelled'
	| 'blocked'
	| 'review';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task complexity levels
 */
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'very-complex';

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Base task interface
 */
export interface Task {
	id: string;
	title: string;
	description: string;
	status: TaskStatus;
	priority: TaskPriority;
	dependencies: string[];
	details: string;
	testStrategy: string;
	subtasks: Subtask[];

	// Optional enhanced properties
	createdAt?: string;
	updatedAt?: string;
	effort?: number;
	actualEffort?: number;
	tags?: string[];
	assignee?: string;
	complexity?: TaskComplexity;
}

/**
 * Subtask interface extending Task with numeric ID
 */
export interface Subtask extends Omit<Task, 'id' | 'subtasks'> {
	id: number;
	parentId: string;
	subtasks?: never; // Subtasks cannot have their own subtasks
}

/**
 * Task metadata for tracking overall project state
 */
export interface TaskMetadata {
	version: string;
	lastModified: string;
	taskCount: number;
	completedCount: number;
	projectName?: string;
	description?: string;
	tags?: string[];
}

/**
 * Task collection with metadata
 */
export interface TaskCollection {
	tasks: Task[];
	metadata: TaskMetadata;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type for creating a new task (without generated fields)
 */
export type CreateTask = Omit<
	Task,
	'id' | 'createdAt' | 'updatedAt' | 'subtasks'
> & {
	subtasks?: Omit<Subtask, 'id' | 'parentId' | 'createdAt' | 'updatedAt'>[];
};

/**
 * Type for updating a task (all fields optional except ID)
 */
export type UpdateTask = Partial<Omit<Task, 'id'>> & {
	id: string;
};

/**
 * Type for task filters
 */
export interface TaskFilter {
	status?: TaskStatus | TaskStatus[];
	priority?: TaskPriority | TaskPriority[];
	tags?: string[];
	hasSubtasks?: boolean;
	search?: string;
	assignee?: string;
	complexity?: TaskComplexity | TaskComplexity[];
}

/**
 * Type for sort options
 */
export interface TaskSortOptions {
	field: keyof Task;
	direction: 'asc' | 'desc';
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid TaskStatus
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
	return (
		typeof value === 'string' &&
		[
			'pending',
			'in-progress',
			'done',
			'deferred',
			'cancelled',
			'blocked',
			'review'
		].includes(value)
	);
}

/**
 * Type guard to check if a value is a valid TaskPriority
 */
export function isTaskPriority(value: unknown): value is TaskPriority {
	return (
		typeof value === 'string' &&
		['low', 'medium', 'high', 'critical'].includes(value)
	);
}

/**
 * Type guard to check if a value is a valid TaskComplexity
 */
export function isTaskComplexity(value: unknown): value is TaskComplexity {
	return (
		typeof value === 'string' &&
		['simple', 'moderate', 'complex', 'very-complex'].includes(value)
	);
}

/**
 * Type guard to check if an object is a Task
 */
export function isTask(obj: unknown): obj is Task {
	if (!obj || typeof obj !== 'object') return false;
	const task = obj as Record<string, unknown>;

	return (
		typeof task.id === 'string' &&
		typeof task.title === 'string' &&
		typeof task.description === 'string' &&
		isTaskStatus(task.status) &&
		isTaskPriority(task.priority) &&
		Array.isArray(task.dependencies) &&
		typeof task.details === 'string' &&
		typeof task.testStrategy === 'string' &&
		Array.isArray(task.subtasks)
	);
}

/**
 * Type guard to check if an object is a Subtask
 */
export function isSubtask(obj: unknown): obj is Subtask {
	if (!obj || typeof obj !== 'object') return false;
	const subtask = obj as Record<string, unknown>;

	return (
		typeof subtask.id === 'number' &&
		typeof subtask.parentId === 'string' &&
		typeof subtask.title === 'string' &&
		typeof subtask.description === 'string' &&
		isTaskStatus(subtask.status) &&
		isTaskPriority(subtask.priority) &&
		!('subtasks' in subtask)
	);
}

// ============================================================================
// Deprecated Types (for backwards compatibility)
// ============================================================================

/**
 * @deprecated Use TaskStatus instead
 */
export type Status = TaskStatus;

/**
 * @deprecated Use TaskPriority instead
 */
export type Priority = TaskPriority;

/**
 * @deprecated Use TaskComplexity instead
 */
export type Complexity = TaskComplexity;
