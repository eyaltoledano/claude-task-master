/**
 * @fileoverview SQL schema definitions for TaskMaster SQLite storage
 * All table definitions and constraints are defined here as string constants.
 */

// ============================================================================
// Schema Version Table
// ============================================================================

/**
 * Schema version table for tracking migrations
 */
export const SCHEMA_VERSION_TABLE = `
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT
);
`;

// ============================================================================
// Core Task Tables
// ============================================================================

/**
 * Main tasks table
 * Status values: 'pending', 'in-progress', 'done', 'blocked', 'deferred', 'cancelled', 'review', 'completed'
 * Priority values: 'low', 'medium', 'high', 'critical'
 */
export const TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in-progress', 'done', 'blocked', 'deferred', 'cancelled', 'review', 'completed')),
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    details TEXT NOT NULL DEFAULT '',
    test_strategy TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    effort INTEGER,
    actual_effort INTEGER,
    complexity TEXT,
    assignee TEXT,
    expansion_prompt TEXT,
    complexity_reasoning TEXT,
    implementation_approach TEXT,
    tag TEXT NOT NULL DEFAULT 'master',
    recommended_subtasks INTEGER,
    PRIMARY KEY (id, tag)
);
`;

/**
 * Task dependencies table (many-to-many relationship)
 * Links tasks to their dependencies within the same tag context
 */
export const TASK_DEPENDENCIES_TABLE = `
CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id TEXT NOT NULL,
    depends_on_id TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT 'master',
    PRIMARY KEY (task_id, depends_on_id, tag),
    FOREIGN KEY (task_id, tag) REFERENCES tasks(id, tag) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_id, tag) REFERENCES tasks(id, tag) ON DELETE CASCADE
);
`;

/**
 * Task tags/labels table (many-to-many relationship)
 * These are labels attached to tasks, distinct from the context "tag"
 */
export const TASK_TAGS_TABLE = `
CREATE TABLE IF NOT EXISTS task_tags (
    task_id TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    context_tag TEXT NOT NULL DEFAULT 'master',
    PRIMARY KEY (task_id, tag_name, context_tag),
    FOREIGN KEY (task_id, context_tag) REFERENCES tasks(id, tag) ON DELETE CASCADE
);
`;

// ============================================================================
// Subtask Tables
// ============================================================================

/**
 * Subtasks table
 * Subtasks belong to a parent task and have numeric IDs within that parent
 */
export const SUBTASKS_TABLE = `
CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER NOT NULL,
    parent_id TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT 'master',
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in-progress', 'done', 'blocked', 'deferred', 'cancelled', 'review', 'completed')),
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    details TEXT NOT NULL DEFAULT '',
    test_strategy TEXT NOT NULL DEFAULT '',
    acceptance_criteria TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    assignee TEXT,
    PRIMARY KEY (id, parent_id, tag),
    FOREIGN KEY (parent_id, tag) REFERENCES tasks(id, tag) ON DELETE CASCADE
);
`;

/**
 * Subtask dependencies table
 * Links subtasks to other subtasks within the same parent task
 */
export const SUBTASK_DEPENDENCIES_TABLE = `
CREATE TABLE IF NOT EXISTS subtask_dependencies (
    parent_id TEXT NOT NULL,
    subtask_id INTEGER NOT NULL,
    depends_on_subtask_id INTEGER NOT NULL,
    tag TEXT NOT NULL DEFAULT 'master',
    PRIMARY KEY (parent_id, subtask_id, depends_on_subtask_id, tag),
    FOREIGN KEY (subtask_id, parent_id, tag) REFERENCES subtasks(id, parent_id, tag) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_subtask_id, parent_id, tag) REFERENCES subtasks(id, parent_id, tag) ON DELETE CASCADE
);
`;

// ============================================================================
// Metadata Tables
// ============================================================================

/**
 * Task metadata table for AI-generated implementation guidance
 * Stores JSON blobs for complex nested data structures
 */
export const TASK_METADATA_TABLE = `
CREATE TABLE IF NOT EXISTS task_metadata (
    task_id TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT 'master',
    relevant_files TEXT,
    codebase_patterns TEXT,
    existing_infrastructure TEXT,
    scope_boundaries TEXT,
    technical_constraints TEXT,
    acceptance_criteria TEXT,
    skills TEXT,
    category TEXT,
    user_metadata TEXT,
    PRIMARY KEY (task_id, tag),
    FOREIGN KEY (task_id, tag) REFERENCES tasks(id, tag) ON DELETE CASCADE
);
`;

/**
 * Tag metadata table for context/tag-level information
 * Stores metadata about each tag/context (like project name, version, etc.)
 */
export const TAG_METADATA_TABLE = `
CREATE TABLE IF NOT EXISTS tag_metadata (
    tag TEXT PRIMARY KEY,
    description TEXT,
    project_name TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// ============================================================================
// Indexes
// ============================================================================

/**
 * Index for faster task lookups by tag
 */
export const TASKS_TAG_INDEX = `
CREATE INDEX IF NOT EXISTS idx_tasks_tag ON tasks(tag);
`;

/**
 * Index for faster task lookups by status
 */
export const TASKS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
`;

/**
 * Index for faster task lookups by priority
 */
export const TASKS_PRIORITY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
`;

/**
 * Index for faster subtask lookups by parent
 */
export const SUBTASKS_PARENT_INDEX = `
CREATE INDEX IF NOT EXISTS idx_subtasks_parent ON subtasks(parent_id, tag);
`;

/**
 * Index for faster subtask lookups by status
 */
export const SUBTASKS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_subtasks_status ON subtasks(status);
`;

/**
 * Index for faster dependency lookups
 */
export const TASK_DEPENDENCIES_INDEX = `
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_id, tag);
`;

/**
 * Index for faster task tag/label lookups
 */
export const TASK_TAGS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_name ON task_tags(tag_name);
`;

// ============================================================================
// All Schema Components
// ============================================================================

/**
 * All table creation statements in order
 */
export const ALL_TABLES = [
	SCHEMA_VERSION_TABLE,
	TASKS_TABLE,
	TASK_DEPENDENCIES_TABLE,
	TASK_TAGS_TABLE,
	SUBTASKS_TABLE,
	SUBTASK_DEPENDENCIES_TABLE,
	TASK_METADATA_TABLE,
	TAG_METADATA_TABLE
];

/**
 * All index creation statements
 */
export const ALL_INDEXES = [
	TASKS_TAG_INDEX,
	TASKS_STATUS_INDEX,
	TASKS_PRIORITY_INDEX,
	SUBTASKS_PARENT_INDEX,
	SUBTASKS_STATUS_INDEX,
	TASK_DEPENDENCIES_INDEX,
	TASK_TAGS_INDEX
];

/**
 * Complete initial schema (tables + indexes)
 */
export const COMPLETE_SCHEMA = [...ALL_TABLES, ...ALL_INDEXES];

// ============================================================================
// Schema Version
// ============================================================================

/**
 * Current schema version number
 * Increment this when adding migrations
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Schema version descriptions
 */
export const SCHEMA_VERSION_DESCRIPTIONS: Record<number, string> = {
	1: 'Initial schema with tasks, subtasks, dependencies, and metadata tables'
};
