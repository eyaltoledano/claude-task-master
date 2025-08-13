import { sqliteTable, text, integer, primaryKey, foreignKey, unique } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Tags table for context management
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
  metadataJson: text('metadata_json') // Store additional metadata as JSON
});

// Tasks table (handles both tasks and subtasks)
export const tasks = sqliteTable('tasks', {
  id: integer('id').notNull(),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  parentTaskId: integer('parent_task_id'), // NULL for top-level tasks
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  priority: text('priority').default('medium'),
  details: text('details'),
  testStrategy: text('test_strategy'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP')
}, (table) => ({
  pk: primaryKey({ columns: [table.id, table.tagId] }),
  parentRef: foreignKey({
    columns: [table.parentTaskId, table.tagId],
    foreignColumns: [table.id, table.tagId]
  })
}));

// Dependencies table for task relationships
export const taskDependencies = sqliteTable('task_dependencies', {
  taskId: integer('task_id').notNull(),
  tagId: integer('tag_id').notNull(),
  dependsOnTaskId: integer('depends_on_task_id').notNull(),
  dependsOnTagId: integer('depends_on_tag_id').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
}, (table) => ({
  pk: primaryKey({ 
    columns: [table.taskId, table.tagId, table.dependsOnTaskId, table.dependsOnTagId] 
  }),
  taskRef: foreignKey({
    columns: [table.taskId, table.tagId],
    foreignColumns: [tasks.id, tasks.tagId]
  }),
  dependencyRef: foreignKey({
    columns: [table.dependsOnTaskId, table.dependsOnTagId],
    foreignColumns: [tasks.id, tasks.tagId]
  })
}));

// Sync metadata table for tracking changes and conflicts
export const syncMetadata = sqliteTable('sync_metadata', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  recordKey: text('record_key').notNull(), // JSON key identifying the record
  lastJsonHash: text('last_json_hash'), // SHA-256 hash of JSON representation
  lastDbHash: text('last_db_hash'),   // SHA-256 hash of DB representation
  lastSyncAt: text('last_sync_at').default('CURRENT_TIMESTAMP'),
  conflictStatus: text('conflict_status').default('none') // none, json_newer, db_newer, manual_needed
}, (table) => ({
  uniqueRecord: unique().on(table.tableName, table.recordKey)
}));

// Sync log for tracking all changes
export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  operation: text('operation').notNull(), // sync_json_to_db, sync_db_to_json, conflict_detected
  tableName: text('table_name'),
  recordKey: text('record_key'),
  detailsJson: text('details_json'), // JSON with operation details
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
});

// Define relations for better queries
export const tagsRelations = relations(tags, ({ many }) => ({
  tasks: many(tasks)
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  tag: one(tags, {
    fields: [tasks.tagId],
    references: [tags.id]
  }),
  parent: one(tasks, {
    fields: [tasks.parentTaskId, tasks.tagId],
    references: [tasks.id, tasks.tagId]
  }),
  subtasks: many(tasks),
  dependencies: many(taskDependencies, {
    relationName: 'taskDependencies'
  }),
  dependents: many(taskDependencies, {
    relationName: 'taskDependents'
  })
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId, taskDependencies.tagId],
    references: [tasks.id, tasks.tagId],
    relationName: 'taskDependencies'
  }),
  dependsOnTask: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId, taskDependencies.dependsOnTagId],
    references: [tasks.id, tasks.tagId],
    relationName: 'taskDependents'
  })
})); 