import { createSyncEngine, databaseConfig } from '../../infra/database/index.js';
import path from 'path';
import fs from 'fs';

/**
 * Sync Command - Handles database synchronization operations
 */
export class SyncCommand {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.tasksJsonPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
    this.options = {
      autoBackup: true,
      logLevel: 'info', // 'debug', 'info', 'warn', 'error'
      ...options
    };
    this.syncEngine = null;
  }

  /**
   * Initialize the sync engine
   */
  async initialize() {
    if (!this.syncEngine) {
      this.syncEngine = await createSyncEngine(
        this.projectRoot,
        this.tasksJsonPath,
        databaseConfig
      );
    }
    return this.syncEngine;
  }

  /**
   * Execute sync operation
   * @param {string} direction - 'auto', 'json-to-db', 'db-to-json', 'force-json', 'force-db'
   * @param {Object} options - Additional sync options
   */
  async execute(direction = 'auto', options = {}) {
    await this.initialize();
    
    const startTime = Date.now();
    this._log('info', `Starting sync operation: ${direction}`);

    try {
      // Pre-sync validation
      await this._validatePreConditions();

      // Create backup if enabled
      if (this.options.autoBackup && fs.existsSync(this.tasksJsonPath)) {
        const backupPath = await this.syncEngine.createJsonBackup();
        this._log('info', `Backup created: ${backupPath}`);
      }

      // Detect conflicts before sync
      const conflicts = await this.syncEngine.detectConflicts();
      if (conflicts.length > 0) {
        this._log('warn', `${conflicts.length} conflicts detected before sync`);
        if (options.abortOnConflicts) {
          throw new Error(`Sync aborted due to ${conflicts.length} conflicts`);
        }
      }

      // Perform sync
      const result = await this.syncEngine.performSync(direction, options);
      
      const duration = Date.now() - startTime;
      this._log('info', `Sync completed in ${duration}ms`);
      
      // Log summary
      this._logSyncSummary(result);

      return {
        success: true,
        result,
        conflicts,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this._log('error', `Sync failed after ${duration}ms: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  /**
   * Get sync status and statistics
   */
  async getStatus() {
    await this.initialize();

    try {
      const conflicts = await this.syncEngine.detectConflicts();
      const dbExists = fs.existsSync(path.join(this.projectRoot, '.taskmaster', 'tasks', 'tasks.db'));
      const jsonExists = fs.existsSync(this.tasksJsonPath);

      let lastSync = null;
      if (dbExists && this.syncEngine.db) {
        const syncMeta = await this.syncEngine.db.getSyncMetadata('tasks_sync', 'global');
        lastSync = syncMeta?.lastSyncAt || null;
      }

      return {
        dbExists,
        jsonExists,
        conflictsCount: conflicts.length,
        conflicts: conflicts.slice(0, 5), // First 5 conflicts for preview
        lastSync,
        recommendedDirection: await this._getRecommendedDirection()
      };

    } catch (error) {
      return {
        error: error.message,
        dbExists: false,
        jsonExists: false,
        conflictsCount: 0
      };
    }
  }

  /**
   * Force sync in a specific direction (for conflict resolution)
   */
  async force(direction, options = {}) {
    const forceDirection = direction.startsWith('force-') ? direction : `force-${direction}`;
    return await this.execute(forceDirection, options);
  }

  /**
   * Dry run - shows what would happen without making changes
   */
  async dryRun(direction = 'auto') {
    await this.initialize();

    try {
      const conflicts = await this.syncEngine.detectConflicts();
      const recommendedDirection = await this._getRecommendedDirection();
      const finalDirection = direction === 'auto' ? recommendedDirection : direction;

      return {
        direction: finalDirection,
        conflictsCount: conflicts.length,
        conflicts,
        changes: this._estimateChanges(conflicts, finalDirection),
        wouldCreateBackup: this.options.autoBackup && fs.existsSync(this.tasksJsonPath)
      };

    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  // ============ PRIVATE METHODS ============

  async _validatePreConditions() {
    // Check if at least one source exists
    const dbExists = fs.existsSync(path.join(this.projectRoot, '.taskmaster', 'tasks', 'tasks.db'));
    const jsonExists = fs.existsSync(this.tasksJsonPath);

    if (!dbExists && !jsonExists) {
      throw new Error('Neither tasks.json nor database exists. Nothing to sync.');
    }

    // Ensure .taskmaster directory structure exists
    const tasksDir = path.dirname(this.tasksJsonPath);
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }
  }

  async _getRecommendedDirection() {
    const dbPath = path.join(this.projectRoot, '.taskmaster', 'tasks', 'tasks.db');
    const jsonExists = fs.existsSync(this.tasksJsonPath);
    const dbExists = fs.existsSync(dbPath);

    if (!jsonExists && dbExists) return 'db-to-json';
    if (jsonExists && !dbExists) return 'json-to-db';

    // Both exist, check modification times
    if (jsonExists && dbExists) {
      const jsonStats = fs.statSync(this.tasksJsonPath);
      const dbStats = fs.statSync(dbPath);
      return jsonStats.mtime > dbStats.mtime ? 'json-to-db' : 'db-to-json';
    }

    return 'json-to-db'; // Default
  }

  _estimateChanges(conflicts, direction) {
    // Simple estimation based on conflicts
    const changes = {
      tagsAffected: 0,
      tasksAffected: 0,
      dependenciesAffected: 0
    };

    for (const conflict of conflicts) {
      switch (conflict.type) {
        case 'tag_conflict':
          changes.tagsAffected++;
          break;
        case 'task_conflict':
          changes.tasksAffected++;
          break;
        case 'dependency_conflict':
          changes.dependenciesAffected++;
          break;
      }
    }

    return changes;
  }

  _logSyncSummary(result) {
    if (!result.success) return;

    const { changes } = result;
    const summary = [];

    if (changes.tagsCreated) summary.push(`${changes.tagsCreated} tags created`);
    if (changes.tagsUpdated) summary.push(`${changes.tagsUpdated} tags updated`);
    if (changes.tasksCreated) summary.push(`${changes.tasksCreated} tasks created`);
    if (changes.tasksUpdated) summary.push(`${changes.tasksUpdated} tasks updated`);
    if (changes.dependenciesCreated) summary.push(`${changes.dependenciesCreated} dependencies created`);
    if (changes.dependenciesRemoved) summary.push(`${changes.dependenciesRemoved} dependencies removed`);

    if (summary.length > 0) {
      this._log('info', `Sync summary: ${summary.join(', ')}`);
    } else {
      this._log('info', 'No changes required - data is already in sync');
    }
  }

  _log(level, message) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.options.logLevel] || 1;
    
    if (levels[level] >= currentLevel) {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      console.log(`[${timestamp}] [SYNC:${level.toUpperCase()}] ${message}`);
    }
  }
}

/**
 * Factory function to create sync command instance
 */
export function createSyncCommand(projectRoot, options = {}) {
  return new SyncCommand(projectRoot, options);
}

/**
 * Quick sync utility function
 */
export async function quickSync(projectRoot, direction = 'auto', options = {}) {
  const syncCmd = createSyncCommand(projectRoot, options);
  return await syncCmd.execute(direction, options);
} 