import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, and, inArray } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import * as schema from './schema.js';

export class SQLiteManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.dbPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.db');
    this.sqlite = null;
    this.db = null;
  }
  
  async initialize() {
    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Initialize SQLite connection
    this.sqlite = new Database(this.dbPath);
    
    // Set SQLite pragmas for better performance and reliability
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');
    this.sqlite.pragma('synchronous = NORMAL');
    
    // Initialize Drizzle
    this.db = drizzle(this.sqlite, { schema });
    
    // Run migrations
    await this.runMigrations();
    
    return this.db;
  }
  
  async runMigrations() {
    // Check if core tables exist first
    const tableExistsQuery = this.sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('tags', 'tasks', 'sync_metadata', 'sync_log')
    `);
    const existingTables = tableExistsQuery.all();
    
    // Debug logging
    if (process.env.DEBUG || process.env.TASKMASTER_DEBUG) {
      console.log('Migration check - existing tables:', existingTables.map(t => t.name));
      console.log('Migration check - table count:', existingTables.length);
    }
    
    // If all core tables exist, skip migrations
    if (existingTables.length >= 4) {
      if (process.env.DEBUG || process.env.TASKMASTER_DEBUG) {
        console.log('Migration check - skipping migrations, all tables exist');
      }
      return;
    }
    
    if (process.env.DEBUG || process.env.TASKMASTER_DEBUG) {
      console.log('Migration check - running migrations');
    }
    
    const migrationsPath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      'migrations'
    );
    
    // Create migrations folder if it doesn't exist
    if (!fs.existsSync(migrationsPath)) {
      fs.mkdirSync(migrationsPath, { recursive: true });
    }
    
    try {
      await migrate(this.db, { migrationsFolder: migrationsPath });
    } catch (error) {
      // Only log migration errors in debug mode
      if (process.env.DEBUG || process.env.TASKMASTER_DEBUG) {
        console.warn('Migration warning:', error.message);
      }
    }
  }
  
  // ============ TAG OPERATIONS ============
  
  async getTags() {
    return await this.db.select().from(schema.tags);
  }
  
  async getTagByName(name) {
    const [tag] = await this.db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.name, name))
      .limit(1);
    return tag;
  }
  
  async createTag(name, description = '', metadata = {}) {
    const [tag] = await this.db.insert(schema.tags).values({
      name,
      description,
      metadataJson: JSON.stringify(metadata),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning();
    return tag;
  }
  
  async updateTag(tagId, updates) {
    const [tag] = await this.db
      .update(schema.tags)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.tags.id, tagId))
      .returning();
    return tag;
  }
  
  async deleteTag(tagId) {
    return await this.db
      .delete(schema.tags)
      .where(eq(schema.tags.id, tagId));
  }
  
  // ============ TASK OPERATIONS ============
  
  async getTasksByTag(tagName) {
    return await this.db
      .select()
      .from(schema.tasks)
      .innerJoin(schema.tags, eq(schema.tasks.tagId, schema.tags.id))
      .where(eq(schema.tags.name, tagName));
  }
  
  async getTasksWithDependencies(tagName) {
    return await this.db
      .select({
        task: schema.tasks,
        tag: schema.tags,
        dependencies: schema.taskDependencies
      })
      .from(schema.tasks)
      .innerJoin(schema.tags, eq(schema.tasks.tagId, schema.tags.id))
      .leftJoin(
        schema.taskDependencies,
        and(
          eq(schema.taskDependencies.taskId, schema.tasks.id),
          eq(schema.taskDependencies.tagId, schema.tasks.tagId)
        )
      )
      .where(eq(schema.tags.name, tagName));
  }
  
  async getTaskById(taskId, tagId) {
    const [task] = await this.db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.id, taskId),
          eq(schema.tasks.tagId, tagId)
        )
      )
      .limit(1);
    return task;
  }
  
  async createTask(tagId, taskData) {
    const [task] = await this.db.insert(schema.tasks).values({
      tagId,
      ...taskData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning();
    return task;
  }
  
  async updateTask(taskId, tagId, updates) {
    const [task] = await this.db
      .update(schema.tasks)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(
          eq(schema.tasks.id, taskId),
          eq(schema.tasks.tagId, tagId)
        )
      )
      .returning();
    return task;
  }
  
  async deleteTask(taskId, tagId) {
    return await this.db
      .delete(schema.tasks)
      .where(
        and(
          eq(schema.tasks.id, taskId),
          eq(schema.tasks.tagId, tagId)
        )
      );
  }
  
  async getTasksByStatus(tagName, statuses) {
    return await this.db
      .select()
      .from(schema.tasks)
      .innerJoin(schema.tags, eq(schema.tasks.tagId, schema.tags.id))
      .where(
        and(
          eq(schema.tags.name, tagName),
          inArray(schema.tasks.status, statuses)
        )
      );
  }
  
  // ============ DEPENDENCY OPERATIONS ============
  
  async addDependency(taskId, tagId, dependsOnTaskId, dependsOnTagId) {
    return await this.db.insert(schema.taskDependencies).values({
      taskId,
      tagId,
      dependsOnTaskId,
      dependsOnTagId,
      createdAt: new Date().toISOString()
    }).returning();
  }
  
  async removeDependency(taskId, tagId, dependsOnTaskId, dependsOnTagId) {
    return await this.db
      .delete(schema.taskDependencies)
      .where(
        and(
          eq(schema.taskDependencies.taskId, taskId),
          eq(schema.taskDependencies.tagId, tagId),
          eq(schema.taskDependencies.dependsOnTaskId, dependsOnTaskId),
          eq(schema.taskDependencies.dependsOnTagId, dependsOnTagId)
        )
      );
  }
  
  async getTaskDependencies(taskId, tagId) {
    return await this.db
      .select()
      .from(schema.taskDependencies)
      .where(
        and(
          eq(schema.taskDependencies.taskId, taskId),
          eq(schema.taskDependencies.tagId, tagId)
        )
      );
  }
  
  // ============ SYNC OPERATIONS ============
  
  async getSyncMetadata(tableName, recordKey) {
    const [metadata] = await this.db
      .select()
      .from(schema.syncMetadata)
      .where(
        and(
          eq(schema.syncMetadata.tableName, tableName),
          eq(schema.syncMetadata.recordKey, recordKey)
        )
      )
      .limit(1);
    return metadata;
  }
  
  async updateSyncMetadata(tableName, recordKey, jsonHash, dbHash, conflictStatus = 'none') {
    return await this.db
      .insert(schema.syncMetadata)
      .values({
        tableName,
        recordKey,
        lastJsonHash: jsonHash,
        lastDbHash: dbHash,
        lastSyncAt: new Date().toISOString(),
        conflictStatus
      })
      .onConflictDoUpdate({
        target: [schema.syncMetadata.tableName, schema.syncMetadata.recordKey],
        set: {
          lastJsonHash: jsonHash,
          lastDbHash: dbHash,
          lastSyncAt: new Date().toISOString(),
          conflictStatus
        }
      });
  }
  
  async logSyncOperation(operation, tableName, recordKey, details = {}) {
    return await this.db.insert(schema.syncLog).values({
      operation,
      tableName,
      recordKey,
      detailsJson: JSON.stringify(details),
      createdAt: new Date().toISOString()
    });
  }
  
  // ============ ADVANCED OPERATIONS ============
  
  async createTaskWithDependencies(tagId, taskData, dependencies = []) {
    return await this.db.transaction(async (tx) => {
      // Create the task
      const [newTask] = await tx.insert(schema.tasks).values({
        tagId,
        ...taskData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).returning();
      
      // Add dependencies if any
      if (dependencies.length > 0) {
        await tx.insert(schema.taskDependencies).values(
          dependencies.map(depId => ({
            taskId: newTask.id,
            tagId: tagId,
            dependsOnTaskId: depId,
            dependsOnTagId: tagId,
            createdAt: new Date().toISOString()
          }))
        );
      }
      
      return newTask;
    });
  }
  
  // Transaction support
  async transaction(callback) {
    return await this.db.transaction(callback);
  }
  
  // Utility methods
  getDrizzleDb() {
    return this.db;
  }
  
  getSqliteDb() {
    return this.sqlite;
  }
  
  close() {
    if (this.sqlite) {
      this.sqlite.close();
      this.sqlite = null;
      this.db = null;
    }
  }
} 