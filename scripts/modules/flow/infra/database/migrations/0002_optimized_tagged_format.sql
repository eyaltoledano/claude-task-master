-- Migration: Optimize database for tagged tasks.json format
-- This migration adds performance optimizations and ensures the schema is fully optimized
-- for the new tagged format where tasks.json has tag-based structure

-- Add indexes for better query performance on tagged operations

-- Index for finding tasks by tag and status (common query pattern)
CREATE INDEX IF NOT EXISTS `idx_tasks_tag_status` ON `tasks` (`tag_id`, `status`);

-- Index for finding tasks by tag and parent (for subtask queries)
CREATE INDEX IF NOT EXISTS `idx_tasks_tag_parent` ON `tasks` (`tag_id`, `parent_task_id`);

-- Index for finding tasks by tag and ID (for quick lookups)
CREATE INDEX IF NOT EXISTS `idx_tasks_tag_id` ON `tasks` (`tag_id`, `id`);

-- Index for dependency lookups by tag
CREATE INDEX IF NOT EXISTS `idx_dependencies_tag_task` ON `task_dependencies` (`tag_id`, `task_id`);
CREATE INDEX IF NOT EXISTS `idx_dependencies_tag_depends` ON `task_dependencies` (`depends_on_tag_id`, `depends_on_task_id`);

-- Index for sync metadata operations (common during sync)
CREATE INDEX IF NOT EXISTS `idx_sync_metadata_table_key` ON `sync_metadata` (`table_name`, `record_key`);

-- Index for sync log queries by operation and table
CREATE INDEX IF NOT EXISTS `idx_sync_log_operation` ON `sync_log` (`operation`, `table_name`);
CREATE INDEX IF NOT EXISTS `idx_sync_log_created` ON `sync_log` (`created_at`);

-- Optimize foreign key constraints for better referential integrity
-- Note: These are already in place but ensuring they exist

-- Add check constraints for data validation
-- Ensure status values are valid
-- Note: SQLite doesn't support ALTER TABLE ADD CONSTRAINT for CHECK constraints on existing tables
-- So we'll use triggers instead

-- Trigger to validate task status values
CREATE TRIGGER IF NOT EXISTS `validate_task_status_insert`
BEFORE INSERT ON `tasks`
WHEN NEW.status NOT IN ('pending', 'in-progress', 'done', 'blocked', 'cancelled', 'deferred', 'review')
BEGIN
  SELECT RAISE(ABORT, 'Invalid task status. Must be one of: pending, in-progress, done, blocked, cancelled, deferred, review');
END;

CREATE TRIGGER IF NOT EXISTS `validate_task_status_update`
BEFORE UPDATE ON `tasks`
WHEN NEW.status NOT IN ('pending', 'in-progress', 'done', 'blocked', 'cancelled', 'deferred', 'review')
BEGIN
  SELECT RAISE(ABORT, 'Invalid task status. Must be one of: pending, in-progress, done, blocked, cancelled, deferred, review');
END;

-- Trigger to validate task priority values
CREATE TRIGGER IF NOT EXISTS `validate_task_priority_insert`
BEFORE INSERT ON `tasks`
WHEN NEW.priority NOT IN ('low', 'medium', 'high', 'critical')
BEGIN
  SELECT RAISE(ABORT, 'Invalid task priority. Must be one of: low, medium, high, critical');
END;

CREATE TRIGGER IF NOT EXISTS `validate_task_priority_update`
BEFORE UPDATE ON `tasks`
WHEN NEW.priority NOT IN ('low', 'medium', 'high', 'critical')
BEGIN
  SELECT RAISE(ABORT, 'Invalid task priority. Must be one of: low, medium, high, critical');
END;

-- Trigger to automatically update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS `update_task_timestamp`
AFTER UPDATE ON `tasks`
BEGIN
  UPDATE `tasks` SET `updated_at` = DATETIME('now') WHERE `id` = NEW.id AND `tag_id` = NEW.tag_id;
END;

CREATE TRIGGER IF NOT EXISTS `update_tag_timestamp`
AFTER UPDATE ON `tags`
BEGIN
  UPDATE `tags` SET `updated_at` = DATETIME('now') WHERE `id` = NEW.id;
END;

-- Create view for easier querying of tasks with tag information
CREATE VIEW IF NOT EXISTS `tasks_with_tags` AS
SELECT 
  t.id,
  t.tag_id,
  tg.name as tag_name,
  t.parent_task_id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.details,
  t.test_strategy,
  t.created_at,
  t.updated_at,
  tg.description as tag_description,
  tg.metadata_json as tag_metadata
FROM tasks t
JOIN tags tg ON t.tag_id = tg.id;

-- Create view for task dependencies with tag information
CREATE VIEW IF NOT EXISTS `task_dependencies_with_tags` AS
SELECT 
  td.task_id,
  td.tag_id,
  t1.title as task_title,
  tg1.name as task_tag_name,
  td.depends_on_task_id,
  td.depends_on_tag_id,
  t2.title as depends_on_title,
  tg2.name as depends_on_tag_name,
  td.created_at
FROM task_dependencies td
JOIN tasks t1 ON td.task_id = t1.id AND td.tag_id = t1.tag_id
JOIN tags tg1 ON td.tag_id = tg1.id
JOIN tasks t2 ON td.depends_on_task_id = t2.id AND td.depends_on_tag_id = t2.tag_id
JOIN tags tg2 ON td.depends_on_tag_id = tg2.id;

-- Create indexes on the new views for better performance
CREATE INDEX IF NOT EXISTS `idx_tasks_with_tags_tag_name` ON `tasks` (`tag_id`);
CREATE INDEX IF NOT EXISTS `idx_tasks_with_tags_status` ON `tasks` (`status`);

-- Ensure the master tag exists for backward compatibility
INSERT OR IGNORE INTO `tags` (`name`, `description`, `created_at`, `updated_at`, `metadata_json`)
VALUES (
  'master',
  'Default master tag for tasks',
  DATETIME('now'),
  DATETIME('now'),
  '{"description": "Default master tag for tasks"}'
);

-- Performance optimization: Analyze tables for better query planning
ANALYZE; 