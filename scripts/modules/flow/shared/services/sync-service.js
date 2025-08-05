import { createSyncCommand, quickSync } from '../../app/commands/sync-command.js';
import { databaseConfig } from '../../infra/database/index.js';

/**
 * Sync Service - Provides programmatic sync capabilities for automatic execution
 */
export class SyncService {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.config = {
      autoSync: true,
      syncDirection: 'auto',
      silentMode: false,
      retryAttempts: 3,
      retryDelay: 1000,
      ...databaseConfig.sync,
      ...options
    };
    this.syncQueue = [];
    this.isProcessing = false;
    this.lastSyncResult = null;
  }

  /**
   * Auto-sync after operations (main method for post-operation sync)
   * @param {string} operation - The operation that was performed
   * @param {Object} context - Context about the operation
   */
  async syncAfterOperation(operation, context = {}) {
    if (!this.config.autoSync) {
      return { skipped: true, reason: 'Auto-sync disabled' };
    }

    const syncRequest = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      context,
      timestamp: new Date().toISOString(),
      direction: this._determineSyncDirection(operation, context)
    };

    // Add to queue
    this.syncQueue.push(syncRequest);

    // Process queue if not already processing
    if (!this.isProcessing) {
      return await this._processQueue();
    }

    return { queued: true, id: syncRequest.id };
  }

  /**
   * Manual sync execution
   */
  async executeSync(direction = 'auto', options = {}) {
    const mergedOptions = {
      ...this.config,
      ...options,
      logLevel: this.config.silentMode ? 'error' : 'info'
    };

    try {
      const result = await quickSync(this.projectRoot, direction, mergedOptions);
      this.lastSyncResult = result;
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      this.lastSyncResult = errorResult;
      return errorResult;
    }
  }

  /**
   * Get sync status
   */
  async getStatus() {
    const syncCmd = createSyncCommand(this.projectRoot);
    const status = await syncCmd.getStatus();
    
    return {
      ...status,
      queueLength: this.syncQueue.length,
      isProcessing: this.isProcessing,
      lastResult: this.lastSyncResult,
      config: this.config
    };
  }

  /**
   * Configure sync behavior
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Enable/disable auto-sync
   */
  setAutoSync(enabled) {
    this.config.autoSync = enabled;
  }

  /**
   * Clear sync queue
   */
  clearQueue() {
    this.syncQueue = [];
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      length: this.syncQueue.length,
      isProcessing: this.isProcessing,
      nextItems: this.syncQueue.slice(0, 3).map(item => ({
        id: item.id,
        operation: item.operation,
        timestamp: item.timestamp
      }))
    };
  }

  // ============ PRIVATE METHODS ============

  async _processQueue() {
    if (this.isProcessing || this.syncQueue.length === 0) {
      return { processed: false, reason: 'Already processing or queue empty' };
    }

    this.isProcessing = true;

    try {
      // Process all pending sync requests
      const results = [];
      
      while (this.syncQueue.length > 0) {
        const request = this.syncQueue.shift();
        
        try {
          const result = await this._executeSyncRequest(request);
          results.push({ request, result });
          
          // Small delay between syncs to prevent overwhelming
          if (this.syncQueue.length > 0) {
            await this._delay(this.config.retryDelay);
          }
          
        } catch (error) {
          results.push({ 
            request, 
            result: { 
              success: false, 
              error: error.message 
            } 
          });
        }
      }

      return {
        processed: true,
        count: results.length,
        results,
        success: results.every(r => r.result.success)
      };

    } finally {
      this.isProcessing = false;
    }
  }

  async _executeSyncRequest(request) {
    const { direction } = request;
    
    let attempt = 0;
    let lastError;

    while (attempt < this.config.retryAttempts) {
      try {
        const result = await this.executeSync(direction, {
          context: request.context,
          operation: request.operation
        });

        if (result.success) {
          return result;
        }

        lastError = new Error(result.error || 'Sync failed');
        
      } catch (error) {
        lastError = error;
      }

      attempt++;
      
      if (attempt < this.config.retryAttempts) {
        await this._delay(this.config.retryDelay * attempt);
      }
    }

    throw lastError;
  }

  _determineSyncDirection(operation, context) {
    // Smart direction determination based on operation type
    const operationMappings = {
      'task_created': 'json-to-db',
      'task_updated': 'json-to-db', 
      'task_deleted': 'json-to-db',
      'subtask_created': 'json-to-db',
      'subtask_updated': 'json-to-db',
      'dependency_added': 'json-to-db',
      'dependency_removed': 'json-to-db',
      'tag_created': 'json-to-db',
      'tag_updated': 'json-to-db',
      'tag_deleted': 'json-to-db',
      'tasks_imported': 'json-to-db',
      'bulk_update': 'json-to-db',
      
      // Database-first operations
      'db_restore': 'db-to-json',
      'db_migration': 'db-to-json',
      'conflict_resolved': 'auto'
    };

    // Check context for hints
    if (context.preferredDirection) {
      return context.preferredDirection;
    }

    // Use operation mapping or fall back to config default
    return operationMappings[operation] || this.config.syncDirection;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global sync service instance factory
 */
let globalSyncService = null;

export function getSyncService(projectRoot, options = {}) {
  if (!globalSyncService || globalSyncService.projectRoot !== projectRoot) {
    globalSyncService = new SyncService(projectRoot, options);
  }
  return globalSyncService;
}

/**
 * Convenience methods for common sync scenarios
 */
export const SyncTriggers = {
  /**
   * After task operations
   */
  async afterTaskOperation(projectRoot, operation, taskData = {}) {
    const syncService = getSyncService(projectRoot);
    return await syncService.syncAfterOperation(operation, {
      type: 'task',
      taskId: taskData.id,
      tagName: taskData.tag || 'master'
    });
  },

  /**
   * After bulk operations
   */
  async afterBulkOperation(projectRoot, operation, count = 0) {
    const syncService = getSyncService(projectRoot);
    return await syncService.syncAfterOperation(operation, {
      type: 'bulk',
      count
    });
  },

  /**
   * After file operations
   */
  async afterFileOperation(projectRoot, operation, filePath = '') {
    const syncService = getSyncService(projectRoot);
    return await syncService.syncAfterOperation(operation, {
      type: 'file',
      filePath
    });
  },

  /**
   * Manual trigger
   */
  async manual(projectRoot, direction = 'auto', options = {}) {
    const syncService = getSyncService(projectRoot, options);
    return await syncService.executeSync(direction, options);
  }
};

/**
 * Sync middleware for wrapping operations
 */
export function withAutoSync(projectRoot, operation) {
  return async function syncWrapper(fn, context = {}) {
    // Execute the original operation
    const result = await fn();
    
    // Trigger sync after successful operation
    if (result && !result.error) {
      const syncResult = await getSyncService(projectRoot).syncAfterOperation(
        operation,
        { ...context, operationResult: result }
      );
      
      // Attach sync info to result if possible
      if (typeof result === 'object') {
        result._syncResult = syncResult;
      }
    }
    
    return result;
  };
} 