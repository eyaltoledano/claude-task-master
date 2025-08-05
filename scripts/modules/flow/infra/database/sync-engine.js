import fs from 'fs';
import path from 'path';
import { DataTransformer } from './data-transformer.js';
import { eq } from 'drizzle-orm';
import * as schema from './schema.js';

export class SyncEngine {
  constructor(sqliteManager, tasksJsonPath, config = {}) {
    this.db = sqliteManager;
    this.tasksJsonPath = tasksJsonPath;
    this.config = {
      batchSize: 100,
      logOperations: true,
      validateIntegrity: true,
      retryAttempts: 3,
      retryDelay: 1000,
      conflictResolution: 'timestamp', // 'timestamp', 'manual', 'json_priority', 'db_priority'
      ...config
    };
    this.transformer = new DataTransformer();
  }

  /**
   * Perform synchronization between JSON and SQLite
   * @param {string} direction - 'auto', 'json-to-db', 'db-to-json', 'force-json', 'force-db'
   * @param {Object} options - Additional sync options
   * @returns {Object} - Sync result with statistics
   */
  async performSync(direction = 'auto', options = {}) {
    const startTime = Date.now();
    const result = {
      direction,
      startTime: new Date().toISOString(),
      conflicts: [],
      changes: {
        tagsCreated: 0,
        tagsUpdated: 0,
        tasksCreated: 0,
        tasksUpdated: 0,
        dependenciesCreated: 0,
        dependenciesRemoved: 0
      },
      errors: []
    };

    try {
      await this._logSyncOperation('sync_started', null, null, { direction, options });

      if (direction === 'auto') {
        direction = await this._determineAutoSyncDirection();
      }

      switch (direction) {
        case 'json-to-db':
        case 'force-json':
          await this._syncJsonToDb(result, direction === 'force-json');
          break;
        
        case 'db-to-json':
        case 'force-db':
          await this._syncDbToJson(result, direction === 'force-db');
          break;
        
        default:
          throw new Error(`Invalid sync direction: ${direction}`);
      }

      result.success = true;
      result.duration = Date.now() - startTime;
      result.endTime = new Date().toISOString();

      if (this.config.validateIntegrity && result.success) {
        const validation = await this._validatePostSyncIntegrity();
        result.validation = validation;
        if (!validation.isValid) {
          result.errors.push(...validation.errors);
        }
      }

      await this._logSyncOperation('sync_completed', null, null, result);

    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.duration = Date.now() - startTime;
      result.endTime = new Date().toISOString();

      await this._logSyncOperation('sync_failed', null, null, {
        error: error.message,
        stack: error.stack
      });

      throw error;
    }

    return result;
  }

  /**
   * Detect conflicts between JSON and SQLite data
   * @returns {Array} - Array of conflict objects
   */
  async detectConflicts() {
    const conflicts = [];
    
    try {
      // Read both data sources
      const jsonData = this._readJsonFile();
      const sqliteData = await this._readSqliteData();
      
      // Convert both to comparable format
      const jsonSqliteFormat = this.transformer.jsonToSqlite(jsonData);
      
      // Compare tags
      const tagConflicts = await this._detectTagConflicts(
        jsonSqliteFormat.tags, 
        sqliteData.tags
      );
      conflicts.push(...tagConflicts);
      
      // Compare tasks
      const taskConflicts = await this._detectTaskConflicts(
        jsonSqliteFormat.tasks,
        sqliteData.tasks
      );
      conflicts.push(...taskConflicts);

      // Compare dependencies
      const depConflicts = await this._detectDependencyConflicts(
        jsonSqliteFormat.dependencies,
        sqliteData.dependencies
      );
      conflicts.push(...depConflicts);

    } catch (error) {
      conflicts.push({
        type: 'detection_error',
        message: `Failed to detect conflicts: ${error.message}`,
        error: error.stack
      });
    }

    return conflicts;
  }

  /**
   * Backup the tasks.json file before sync
   * @returns {string} - Path to backup file
   */
  async createJsonBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(path.dirname(this.tasksJsonPath), '..', 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, `tasks-backup-${timestamp}.json`);
    
    if (fs.existsSync(this.tasksJsonPath)) {
      fs.copyFileSync(this.tasksJsonPath, backupPath);
    }
    
    return backupPath;
  }

  // ============ PRIVATE SYNC METHODS ============

  async _syncJsonToDb(result, force = false) {
    if (!fs.existsSync(this.tasksJsonPath)) {
      throw new Error(`JSON file not found: ${this.tasksJsonPath}`);
    }

    const jsonData = this._readJsonFile();
    const sqliteFormat = this.transformer.jsonToSqlite(jsonData);

    // Sync tags
    for (const tagData of sqliteFormat.tags) {
      const existing = await this.db.getTagByName(tagData.name);
      
      if (!existing) {
        await this.db.createTag(tagData.name, tagData.description, JSON.parse(tagData.metadataJson));
        result.changes.tagsCreated++;
      } else if (force || await this._shouldUpdateTag(existing, tagData)) {
        await this.db.updateTag(existing.id, {
          description: tagData.description,
          metadataJson: tagData.metadataJson,
          updatedAt: tagData.updatedAt
        });
        result.changes.tagsUpdated++;
      }
    }

    // Sync tasks
    for (const taskData of sqliteFormat.tasks) {
      const tag = await this.db.getTagByName(taskData.tagName || 'master');
      if (!tag) continue;

      const existing = await this.db.getTaskById(taskData.id, tag.id);
      
      if (!existing) {
        await this.db.createTask(tag.id, taskData);
        result.changes.tasksCreated++;
      } else if (force || await this._shouldUpdateTask(existing, taskData)) {
        await this.db.updateTask(taskData.id, tag.id, taskData);
        result.changes.tasksUpdated++;
      }
    }

    // Sync dependencies
    await this._syncDependencies(sqliteFormat.dependencies, result);

    // Update sync metadata
    await this._updateSyncMetadata('json_to_db', jsonData, sqliteFormat);
  }

  async _syncDbToJson(result, force = false) {
    const sqliteData = await this._readSqliteData();
    const jsonFormat = this.transformer.sqliteToJson(
      sqliteData.tags,
      sqliteData.tasks,
      sqliteData.dependencies
    );

    // Create backup before overwriting
    if (fs.existsSync(this.tasksJsonPath)) {
      await this.createJsonBackup();
    }

    // Write to JSON file
    fs.writeFileSync(this.tasksJsonPath, JSON.stringify(jsonFormat, null, 2));

    // Count changes (simplified for db-to-json)
    result.changes.tagsUpdated = sqliteData.tags.length;
    result.changes.tasksUpdated = sqliteData.tasks.length;

    // Update sync metadata
    await this._updateSyncMetadata('db_to_json', jsonFormat, sqliteData);
  }

  async _syncDependencies(dependenciesData, result) {
    // Clear all existing dependencies first
    console.log(`[SYNC:DEBUG] Clearing all existing dependencies from database...`);
    const drizzleDb = this.db.getDrizzleDb();
    await drizzleDb.delete(schema.taskDependencies);
    
    // Group dependencies by task to avoid duplicates
    const uniqueDependencies = new Map();
    
    for (const dep of dependenciesData) {
      const key = `${dep.taskId}-${dep.dependsOnTaskId}-${dep.tagName}-${dep.dependsOnTagName}`;
      if (!uniqueDependencies.has(key)) {
        uniqueDependencies.set(key, dep);
      }
    }
    
    const uniqueDeps = Array.from(uniqueDependencies.values());
    console.log(`[SYNC:DEBUG] Filtered ${dependenciesData.length} dependencies down to ${uniqueDeps.length} unique dependencies`);
    
    // Add all unique dependencies
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const dep of uniqueDeps) {
      const tag = await this.db.getTagByName(dep.tagName || 'master');
      const dependsOnTag = await this.db.getTagByName(dep.dependsOnTagName || 'master');
      
      if (!tag || !dependsOnTag) {
        console.log(`[SYNC:DEBUG] Skipping dependency - tag not found: ${dep.tagName} or ${dep.dependsOnTagName}`);
        skippedCount++;
        continue;
      }
      
      // Check if both source and target tasks exist
      const sourceTask = await this.db.getTaskById(dep.taskId, tag.id);
      const targetTask = await this.db.getTaskById(dep.dependsOnTaskId, dependsOnTag.id);
      
      if (!sourceTask || !targetTask) {
        console.log(`[SYNC:DEBUG] Skipping dependency - task not found: ${dep.taskId} or ${dep.dependsOnTaskId}`);
        skippedCount++;
        continue;
      }
      
      try {
        await this.db.addDependency(
          dep.taskId,
          tag.id,
          dep.dependsOnTaskId,
          dependsOnTag.id
        );
        addedCount++;
        result.changes.dependenciesCreated++;
      } catch (error) {
        console.log(`[SYNC:ERROR] Failed to add dependency ${dep.taskId}->${dep.dependsOnTaskId}: ${error.message}`);
        skippedCount++;
      }
    }
    
    console.log(`[SYNC:DEBUG] Successfully added ${addedCount} dependencies, skipped ${skippedCount}`);
  }

  // ============ CONFLICT DETECTION ============

  async _detectTagConflicts(jsonTags, dbTags) {
    const conflicts = [];
    const dbTagsByName = {};
    
    for (const tag of dbTags) {
      dbTagsByName[tag.name] = tag;
    }

    for (const jsonTag of jsonTags) {
      const dbTag = dbTagsByName[jsonTag.name];
      
      if (dbTag) {
        const jsonHash = this.transformer.calculateHash(jsonTag);
        const dbHash = this.transformer.calculateHash(dbTag);
        
        if (jsonHash !== dbHash) {
          conflicts.push({
            type: 'tag_conflict',
            tagName: jsonTag.name,
            jsonData: jsonTag,
            dbData: dbTag,
            jsonHash,
            dbHash
          });
        }
      }
    }

    return conflicts;
  }

  async _detectTaskConflicts(jsonTasks, dbTasks) {
    const conflicts = [];
    const dbTasksById = {};
    
    for (const task of dbTasks) {
      const key = `${task.id}-${task.tagId}`;
      dbTasksById[key] = task;
    }

    for (const jsonTask of jsonTasks) {
      const key = `${jsonTask.id}-${jsonTask.tagId}`;
      const dbTask = dbTasksById[key];
      
      if (dbTask) {
        const jsonHash = this.transformer.calculateHash(jsonTask);
        const dbHash = this.transformer.calculateHash(dbTask);
        
        if (jsonHash !== dbHash) {
          conflicts.push({
            type: 'task_conflict',
            taskId: jsonTask.id,
            tagId: jsonTask.tagId,
            jsonData: jsonTask,
            dbData: dbTask,
            jsonHash,
            dbHash
          });
        }
      }
    }

    return conflicts;
  }

  async _detectDependencyConflicts(jsonDeps, dbDeps) {
    const conflicts = [];
    
    const jsonDepSet = new Set(
      jsonDeps.map(d => `${d.taskId}-${d.tagName}-${d.dependsOnTaskId}`)
    );
    const dbDepSet = new Set(
      dbDeps.map(d => `${d.taskId}-${d.tagId}-${d.dependsOnTaskId}`)
    );

    const onlyInJson = [...jsonDepSet].filter(dep => !dbDepSet.has(dep));
    const onlyInDb = [...dbDepSet].filter(dep => !jsonDepSet.has(dep));

    if (onlyInJson.length > 0 || onlyInDb.length > 0) {
      conflicts.push({
        type: 'dependency_conflict',
        onlyInJson,
        onlyInDb
      });
    }

    return conflicts;
  }

  // ============ HELPER METHODS ============

  async _determineAutoSyncDirection() {
    if (!fs.existsSync(this.tasksJsonPath)) {
      return 'db-to-json';
    }

    const jsonStats = fs.statSync(this.tasksJsonPath);
    const dbPath = this.db.dbPath;
    
    if (!fs.existsSync(dbPath)) {
      return 'json-to-db';
    }

    const dbStats = fs.statSync(dbPath);
    
    // Use most recently modified
    return jsonStats.mtime > dbStats.mtime ? 'json-to-db' : 'db-to-json';
  }

  async _shouldUpdateTag(existing, newData) {
    // Simple timestamp-based comparison
    const existingTime = new Date(existing.updatedAt);
    const newTime = new Date(newData.updatedAt);
    return newTime > existingTime;
  }

  async _shouldUpdateTask(existing, newData) {
    // Simple timestamp-based comparison
    const existingTime = new Date(existing.updatedAt);
    const newTime = new Date(newData.updatedAt);
    return newTime > existingTime;
  }

  _readJsonFile() {
    const content = fs.readFileSync(this.tasksJsonPath, 'utf8');
    return JSON.parse(content);
  }

  async _readSqliteData() {
    const tags = await this.db.getTags();
    const tasks = [];
    const dependencies = [];

    for (const tag of tags) {
      const tagTasks = await this.db.getTasksByTag(tag.name);
      const tagDeps = await this.db.getDrizzleDb()
        .select()
        .from(schema.taskDependencies)
        .where(eq(schema.taskDependencies.tagId, tag.id));

      tasks.push(...tagTasks.map(t => ({ ...t.task || t, tagName: tag.name })));
      dependencies.push(...tagDeps.map(d => ({ ...d, tagName: tag.name })));
    }

    return { tags, tasks, dependencies };
  }

  async _updateSyncMetadata(operation, jsonData, sqliteData) {
    const jsonHash = this.transformer.calculateHash(jsonData);
    const dbHash = this.transformer.calculateHash(sqliteData);
    
    await this.db.updateSyncMetadata(
      'tasks_sync',
      'global',
      jsonHash,
      dbHash,
      'none'
    );
  }

  async _validatePostSyncIntegrity() {
    try {
      const jsonData = this._readJsonFile();
      const sqliteData = await this._readSqliteData();
      
      return this.transformer.validateDataIntegrity(jsonData, {
        tags: sqliteData.tags,
        tasks: sqliteData.tasks,
        dependencies: sqliteData.dependencies
      });
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }

  async _logSyncOperation(operation, tableName, recordKey, details) {
    if (!this.config.logOperations) return;
    
    try {
      await this.db.logSyncOperation(operation, tableName, recordKey, details);
    } catch (error) {
      console.warn('Failed to log sync operation:', error.message);
    }
  }
} 