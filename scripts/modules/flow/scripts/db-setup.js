#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import Database from 'better-sqlite3';

// Use current directory as project root
const projectPath = process.cwd();
const dbPath = path.join(projectPath, '.taskmaster/tasks/tasks.db');
const dbDir = path.dirname(dbPath);
const tasksJsonPath = path.join(projectPath, '.taskmaster/tasks/tasks.json');

console.log('🚀 Starting local database setup');
console.log('📁 Project path:', projectPath);
console.log('🗄️  Database path:', dbPath);
console.log('📄 Tasks.json path:', tasksJsonPath);

// Check if database already exists
const dbExists = fs.existsSync(dbPath);
if (dbExists) {
  console.log('⚠️  Database already exists - will be overwritten');
} else {
  console.log('📝 Creating new database');
}

// Check if tasks.json exists
const tasksJsonExists = fs.existsSync(tasksJsonPath);
console.log(`📄 Tasks.json: ${tasksJsonExists ? 'found' : 'not found'}`);

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
  console.log('📁 Creating directory:', dbDir);
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log('\n📝 Step 1: Creating optimized database schema...');

// Create complete schema with one SQL command
const createSchemaSQL = `
-- Create complete optimized schema for tagged tasks.json format
CREATE TABLE IF NOT EXISTS sync_log (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    operation text NOT NULL,
    table_name text,
    record_key text,
    details_json text,
    created_at text DEFAULT 'CURRENT_TIMESTAMP'
);

CREATE TABLE IF NOT EXISTS sync_metadata (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    table_name text NOT NULL,
    record_key text NOT NULL,
    last_json_hash text,
    last_db_hash text,
    last_sync_at text DEFAULT 'CURRENT_TIMESTAMP',
    conflict_status text DEFAULT 'none'
);

CREATE UNIQUE INDEX IF NOT EXISTS sync_metadata_table_name_record_key_unique ON sync_metadata (table_name,record_key);

CREATE TABLE IF NOT EXISTS tags (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    name text NOT NULL,
    description text,
    created_at text DEFAULT 'CURRENT_TIMESTAMP',
    updated_at text DEFAULT 'CURRENT_TIMESTAMP',
    metadata_json text
);

CREATE UNIQUE INDEX IF NOT EXISTS tags_name_unique ON tags (name);

CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id integer NOT NULL,
    tag_id integer NOT NULL,
    depends_on_task_id integer NOT NULL,
    depends_on_tag_id integer NOT NULL,
    created_at text DEFAULT 'CURRENT_TIMESTAMP',
    PRIMARY KEY(task_id, tag_id, depends_on_task_id, depends_on_tag_id),
    FOREIGN KEY (task_id,tag_id) REFERENCES tasks(id,tag_id) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (depends_on_task_id,depends_on_tag_id) REFERENCES tasks(id,tag_id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS tasks (
    id integer NOT NULL,
    tag_id integer NOT NULL,
    parent_task_id integer,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending' NOT NULL,
    priority text DEFAULT 'medium',
    details text,
    test_strategy text,
    created_at text DEFAULT 'CURRENT_TIMESTAMP',
    updated_at text DEFAULT 'CURRENT_TIMESTAMP',
    PRIMARY KEY(id, tag_id),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (parent_task_id,tag_id) REFERENCES tasks(id,tag_id) ON UPDATE no action ON DELETE no action
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_tasks_tag_status ON tasks (tag_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_tag_parent ON tasks (tag_id, parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tag_id ON tasks (tag_id, id);
CREATE INDEX IF NOT EXISTS idx_dependencies_tag_task ON task_dependencies (tag_id, task_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_tag_depends ON task_dependencies (depends_on_tag_id, depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_table_key ON sync_metadata (table_name, record_key);
CREATE INDEX IF NOT EXISTS idx_sync_log_operation ON sync_log (operation, table_name);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log (created_at);

-- Create views
CREATE VIEW IF NOT EXISTS tasks_with_tags AS
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

-- Ensure master tag exists
INSERT OR IGNORE INTO tags (name, description, created_at, updated_at, metadata_json)
VALUES (
  'master',
  'Default master tag for tasks',
  DATETIME('now'),
  DATETIME('now'),
  '{"description": "Default master tag for tasks"}'
);

-- Analyze for better performance
ANALYZE;
`;

const createProcess = spawn('sqlite3', [dbPath], {
  input: createSchemaSQL,
  stdio: ['pipe', 'inherit', 'inherit']
});

createProcess.stdin.write(createSchemaSQL);
createProcess.stdin.end();

createProcess.on('error', (err) => {
  console.error('❌ Failed to create schema:', err.message);
  process.exit(1);
});

createProcess.on('close', (createCode) => {
  if (createCode === 0) {
    console.log('✅ Database schema created successfully!');
    
    // Get schema information
    try {
      const db = Database(dbPath, { readonly: true });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
      const views = db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all();
      
      console.log('📊 Schema created:');
      console.log(`   📋 Tables: ${tables.length} (${tables.map(t => t.name).join(', ')})`);
      console.log(`   🔍 Indexes: ${indexes.length}`);
      console.log(`   👁️  Views: ${views.length}`);
      
      db.close();
    } catch (error) {
      console.log('⚠️  Could not read schema info:', error.message);
    }
    
    // Step 2: Sync from JSON if tasks.json exists
    if (tasksJsonExists) {
      console.log('\n📝 Step 2: Syncing data from tasks.json...');
      
      const syncProcess = spawn('node', [
        'scripts/dev.js', 
        'flow', 
        'sync:force', 
        'json-to-db', 
        '--verbose'
      ], {
        stdio: 'inherit',
        cwd: projectPath
      });
      
      syncProcess.on('close', (syncCode) => {
        // Get final database stats
        try {
          const db = Database(dbPath, { readonly: true });
          const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
          
          let totalRows = 0;
          console.log('\n📋 Final database state:');
          for (const table of tables) {
            try {
              const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
              totalRows += count.count;
              if (count.count > 0) {
                console.log(`   • ${table.name}: ${count.count} rows`);
              }
            } catch (e) {
              console.log(`   • ${table.name}: unable to count rows`);
            }
          }
          
          console.log(`\n📈 Total data: ${totalRows} rows across all tables`);
          
          // Show tag information if tags exist
          try {
            const tags = db.prepare("SELECT name FROM tags").all();
            if (tags.length > 0) {
              console.log(`🏷️  Tags: ${tags.map(t => t.name).join(', ')}`);
            }
          } catch (e) {
            // Tags table might not exist or be empty
          }
          
          db.close();
        } catch (error) {
          console.log('⚠️  Could not read final stats:', error.message);
        }
        
        if (syncCode === 0) {
          console.log('\n✅ Database setup completed successfully!');
        } else {
          console.warn(`\n⚠️  Sync completed with warnings (code ${syncCode}), but database is ready`);
          console.log('✅ Database setup completed!');
        }
        console.log('🎯 Database location:', dbPath);
      });
    } else {
      console.log('\nℹ️  No tasks.json found, skipping data sync');
      
      // Still show basic database info
      try {
        const db = Database(dbPath, { readonly: true });
        
        // Check if master tag was created
        const masterTag = db.prepare("SELECT name FROM tags WHERE name = 'master'").get();
        if (masterTag) {
          console.log('🏷️  Master tag created for future tasks');
        }
        
        db.close();
      } catch (error) {
        console.log('⚠️  Could not verify master tag:', error.message);
      }
      
      console.log('\n✅ Database setup completed successfully!');
      console.log('🎯 Database location:', dbPath);
    }
  } else {
    console.error(`❌ Schema creation failed with code ${createCode}`);
    process.exit(createCode);
  }
}); 