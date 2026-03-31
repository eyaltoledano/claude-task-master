/**
 * @fileoverview SQLite-specific type definitions for TaskMaster storage
 * These types map directly to the SQL schema and database operations.
 */

import type {
	TaskComplexity,
	TaskImplementationMetadata,
	TaskPriority,
	TaskStatus
} from '../../../../common/types/index.js';

// ============================================================================
// Database Row Types (directly map to SQL tables)
// ============================================================================

/**
 * Row type for the schema_version table
 */
export interface SchemaVersionRow {
	version: number;
	applied_at: string;
	description: string | null;
}

/**
 * Row type for the tasks table
 */
export interface TaskRow {
	id: string;
	title: string;
	description: string;
	status: TaskStatus;
	priority: TaskPriority;
	details: string;
	test_strategy: string;
	created_at: string;
	updated_at: string;
	effort: number | null;
	actual_effort: number | null;
	complexity: string | null; // Can be TaskComplexity enum or numeric score (stored as string)
	assignee: string | null;
	expansion_prompt: string | null;
	complexity_reasoning: string | null;
	implementation_approach: string | null;
	tag: string;
	recommended_subtasks: number | null;
}

/**
 * Row type for the task_dependencies table
 */
export interface TaskDependencyRow {
	task_id: string;
	depends_on_id: string;
}

/**
 * Row type for the task_tags table (labels on tasks)
 */
export interface TaskTagRow {
	task_id: string;
	tag_name: string;
}

/**
 * Row type for the subtasks table
 */
export interface SubtaskRow {
	id: number;
	parent_id: string;
	title: string;
	description: string;
	status: TaskStatus;
	priority: TaskPriority;
	details: string;
	test_strategy: string;
	acceptance_criteria: string | null;
	created_at: string;
	updated_at: string;
	assignee: string | null;
}

/**
 * Row type for the subtask_dependencies table
 */
export interface SubtaskDependencyRow {
	parent_id: string;
	subtask_id: number;
	depends_on_subtask_id: number;
}

/**
 * Row type for the task_metadata table (JSON blob storage for AI metadata)
 */
export interface TaskMetadataRow {
	task_id: string;
	relevant_files: string | null; // JSON string
	codebase_patterns: string | null; // JSON string
	existing_infrastructure: string | null; // JSON string
	scope_boundaries: string | null; // JSON string
	technical_constraints: string | null; // JSON string
	acceptance_criteria: string | null; // JSON string
	skills: string | null; // JSON string
	category: string | null;
	user_metadata: string | null; // JSON string for user-defined metadata
}

/**
 * Row type for the tag_metadata table
 */
export interface TagMetadataRow {
	tag: string;
	description: string | null;
	project_name: string | null;
	version: string;
	created_at: string;
	updated_at: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for SQLite storage
 */
export interface SqliteStorageConfig {
	/** Path to the SQLite database file */
	dbPath: string;
	/** Enable WAL mode for better concurrent access (default: true) */
	walMode?: boolean;
	/** Enable foreign key constraints (default: true) */
	foreignKeys?: boolean;
	/** Busy timeout in milliseconds (default: 5000) */
	busyTimeout?: number;
	/** Enable automatic migrations on initialization (default: true) */
	autoMigrate?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_SQLITE_CONFIG: Required<
	Omit<SqliteStorageConfig, 'dbPath'>
> = {
	walMode: true,
	foreignKeys: true,
	busyTimeout: 5000,
	autoMigrate: true
};

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * Result of a task query with joined data
 */
export interface TaskQueryResult extends TaskRow {
	dependencies?: string[];
	tags?: string[];
	subtasks?: SubtaskQueryResult[];
	metadata?: TaskImplementationMetadata;
	user_metadata?: Record<string, unknown>;
}

/**
 * Result of a subtask query with joined data
 */
export interface SubtaskQueryResult extends SubtaskRow {
	dependencies?: number[];
}

/**
 * Insert data for creating a new task
 */
export interface TaskInsertData {
	id: string;
	title: string;
	description: string;
	status: TaskStatus;
	priority: TaskPriority;
	details: string;
	test_strategy: string;
	tag: string;
	effort?: number | null;
	actual_effort?: number | null;
	complexity?: TaskComplexity | number | null;
	assignee?: string | null;
	expansion_prompt?: string | null;
	complexity_reasoning?: string | null;
	implementation_approach?: string | null;
	recommended_subtasks?: number | null;
}

/**
 * Update data for modifying a task
 */
export interface TaskUpdateData {
	title?: string;
	description?: string;
	status?: TaskStatus;
	priority?: TaskPriority;
	details?: string;
	test_strategy?: string;
	effort?: number | null;
	actual_effort?: number | null;
	complexity?: TaskComplexity | number | null;
	assignee?: string | null;
	expansion_prompt?: string | null;
	complexity_reasoning?: string | null;
	implementation_approach?: string | null;
	recommended_subtasks?: number | null;
}

/**
 * Insert data for creating a new subtask
 */
export interface SubtaskInsertData {
	id: number;
	parent_id: string;
	title: string;
	description: string;
	status: TaskStatus;
	priority: TaskPriority;
	details: string;
	test_strategy: string;
	acceptance_criteria?: string | null;
	assignee?: string | null;
}

/**
 * Update data for modifying a subtask
 */
export interface SubtaskUpdateData {
	title?: string;
	description?: string;
	status?: TaskStatus;
	priority?: TaskPriority;
	details?: string;
	test_strategy?: string;
	acceptance_criteria?: string | null;
	assignee?: string | null;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid TaskStatus for SQLite storage
 */
export function isValidTaskStatus(value: unknown): value is TaskStatus {
	return (
		typeof value === 'string' &&
		[
			'pending',
			'in-progress',
			'done',
			'blocked',
			'deferred',
			'cancelled',
			'review',
			'completed'
		].includes(value)
	);
}

/**
 * Check if a value is a valid TaskPriority for SQLite storage
 */
export function isValidTaskPriority(value: unknown): value is TaskPriority {
	return (
		typeof value === 'string' &&
		['low', 'medium', 'high', 'critical'].includes(value)
	);
}

/**
 * Parse complexity value from database string
 */
export function parseComplexity(
	value: string | null
): TaskComplexity | number | undefined {
	if (value === null) {
		return undefined;
	}

	// Guard against empty or whitespace-only strings
	// (Number('') returns 0 which would incorrectly parse empty strings as zero)
	const trimmed = value.trim();
	if (trimmed === '') {
		return undefined;
	}

	// Try parsing as number first
	const numValue = Number(trimmed);
	if (!isNaN(numValue)) {
		return numValue;
	}

	// Check if it's a valid complexity enum
	if (['simple', 'moderate', 'complex', 'very-complex'].includes(trimmed)) {
		return trimmed as TaskComplexity;
	}

	return undefined;
}

/**
 * Serialize complexity value for database storage
 */
export function serializeComplexity(
	value: TaskComplexity | number | null | undefined
): string | null {
	if (value === undefined || value === null) {
		return null;
	}
	return String(value);
}
