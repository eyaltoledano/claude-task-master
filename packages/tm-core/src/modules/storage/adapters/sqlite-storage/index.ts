/**
 * @fileoverview SQLite storage adapter for TaskMaster
 * Provides SQLite-based persistent storage for tasks, subtasks, and metadata.
 */

// Export types
export type {
	SqliteStorageConfig,
	TaskRow,
	SubtaskRow,
	TaskDependencyRow,
	TaskTagRow,
	SubtaskDependencyRow,
	TaskMetadataRow,
	TagMetadataRow,
	SchemaVersionRow,
	TaskQueryResult,
	SubtaskQueryResult,
	TaskInsertData,
	TaskUpdateData,
	SubtaskInsertData,
	SubtaskUpdateData
} from './types.js';

export {
	DEFAULT_SQLITE_CONFIG,
	isValidTaskStatus,
	isValidTaskPriority,
	parseComplexity,
	serializeComplexity
} from './types.js';

// Export schema
export {
	SCHEMA_VERSION_TABLE,
	TASKS_TABLE,
	TASK_DEPENDENCIES_TABLE,
	TASK_TAGS_TABLE,
	SUBTASKS_TABLE,
	SUBTASK_DEPENDENCIES_TABLE,
	TASK_METADATA_TABLE,
	TAG_METADATA_TABLE,
	ALL_TABLES,
	ALL_INDEXES,
	COMPLETE_SCHEMA,
	CURRENT_SCHEMA_VERSION,
	SCHEMA_VERSION_DESCRIPTIONS
} from './schema.js';

// Export database
export {
	SqliteDatabase,
	createDatabase,
	createInMemoryDatabase
} from './database.js';

// Export migrations
export type { Migration } from './migrations.js';
export {
	MigrationRunner,
	ALL_MIGRATIONS,
	validateMigrations,
	createMigration
} from './migrations.js';

// Export JSONL sync
export { JsonlSync } from './jsonl-sync.js';
export type { JsonlTask, JsonlStats, ReadOptions } from './jsonl-sync.js';

// Export storage adapter
export {
	SqliteStorage,
	default as SqliteStorageDefault
} from './sqlite-storage.js';

// Export queries
export {
	// Task operations
	insertTask,
	updateTask,
	deleteTask,
	getTask,
	getTasks,
	getTasksByStatus,
	// Task dependencies
	addTaskDependency,
	removeTaskDependency,
	getTaskDependencies,
	setTaskDependencies,
	// Task labels
	addTaskLabel,
	removeTaskLabel,
	getTaskLabels,
	setTaskLabels,
	// Subtask operations
	insertSubtask,
	updateSubtask,
	deleteSubtask,
	getSubtasks,
	getSubtaskDependencies,
	setSubtaskDependencies,
	// Metadata operations
	getTaskMetadata,
	setTaskMetadata,
	deleteTaskMetadata,
	getTagMetadata,
	setTagMetadata,
	deleteTagMetadata,
	getAllTags,
	// Conversion helpers
	taskRowToTask,
	subtaskRowToSubtask,
	taskToInsertData,
	subtaskToInsertData,
	tagMetadataRowToTaskMetadata,
	// Bulk operations
	loadCompleteTask,
	loadAllTasks,
	saveCompleteTask,
	deleteAllTasksForTag,
	copyTasksToTag,
	getTaskCounts
} from './queries.js';
