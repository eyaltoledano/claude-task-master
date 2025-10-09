/**
 * Type definitions for repository operations
 */
import { Database, Tables } from './database.types.js';

/**
 * Task row from database with optional joined relations
 */
export interface TaskWithRelations extends Tables<'tasks'> {
	document?: {
		id: string;
		document_name: string;
		title: string;
		description: string | null;
	} | null;
}

/**
 * Dependency row with joined display_id
 */
export interface DependencyWithDisplayId {
	task_id: string;
	depends_on_task: {
		display_id: string;
	} | null;
}

/**
 * Task metadata structure
 */
export interface TaskMetadata {
	details?: string;
	testStrategy?: string;
	[key: string]: unknown; // Allow additional fields but be explicit
}

/**
 * Database update payload for tasks
 */
export type TaskDatabaseUpdate =
	Database['public']['Tables']['tasks']['Update'];
/**
 * Configuration for task queries
 */
export interface TaskQueryConfig {
	briefId: string;
	includeSubtasks?: boolean;
	includeDependencies?: boolean;
	includeDocument?: boolean;
}

/**
 * Result of a task fetch operation
 */
export interface TaskFetchResult {
	task: Tables<'tasks'>;
	subtasks: Tables<'tasks'>[];
	dependencies: Map<string, string[]>;
}

/**
 * Task validation errors
 */
export class TaskValidationError extends Error {
	constructor(
		message: string,
		public readonly field: string,
		public readonly value: unknown
	) {
		super(message);
		this.name = 'TaskValidationError';
	}
}

/**
 * Context validation errors
 */
export class ContextValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ContextValidationError';
	}
}
