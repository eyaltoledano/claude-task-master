/**
 * VibeKit-based Background Claude Code Service
 * Replacement for the original BackgroundClaudeCode service using VibeKit SDK
 */

import { VibeKitService } from './vibekit.service.js';
import { backgroundOperations } from '../../../shared/services/BackgroundOperationsManager.js';

export class BackgroundClaudeCode {
  constructor(backend) {
    this.backend = backend;
    this.vibeKitService = new VibeKitService({
      defaultAgent: 'claude-code',
      workingDirectory: backend.projectRoot || process.cwd(),
      sessionManagement: {
        enabled: true,
        persistSessions: true
      }
    });
    
    this.activeOperations = new Map();
    this.operationCounter = 0;
  }

  /**
   * Start a background Claude Code query using VibeKit
   * Maintains compatibility with the original BackgroundClaudeCode interface
   */
  async startQuery(prompt, options = {}) {
    try {
      const operationId = this.generateOperationId();
      
      // Create operation tracking
      const operation = {
        id: operationId,
        prompt,
        options,
        startTime: Date.now(),
        status: 'running'
      };
      
      this.activeOperations.set(operationId, operation);
      
      // Register with BackgroundOperationsManager
      backgroundOperations.startOperation('claude-code-query', {
        operationId,
        subtaskId: options.metadata?.subtaskId,
        parentTaskId: options.metadata?.parentTaskId,
        worktreePath: options.metadata?.worktreePath,
        type: options.metadata?.type || 'code-generation'
      });
      
      // Create task context for VibeKit
      const taskContext = {
        sessionId: operationId,
        workingDirectory: options.metadata?.worktreePath || this.vibeKitService.config.workingDirectory,
        agent: 'claude-code',
        ...options.metadata
      };

      // Create callbacks for operation tracking
      const callbacks = {
        onUpdate: (message) => {
          operation.lastMessage = message;
          operation.lastUpdate = Date.now();
          
          // Send message through BackgroundOperationsManager
          backgroundOperations.sendOperationMessage(operationId, {
            type: 'assistant',
            content: message,
            timestamp: new Date().toISOString()
          });
          
          // Call original onMessage if provided
          if (options.onMessage) {
            options.onMessage({
              type: 'assistant',
              content: message,
              timestamp: new Date().toISOString()
            });
          }
        },
        onError: (error) => {
          operation.status = 'failed';
          operation.error = error.message;
          operation.endTime = Date.now();
          
          // Send error message through BackgroundOperationsManager
          backgroundOperations.sendOperationMessage(operationId, {
            type: 'error',
            content: error.message,
            timestamp: new Date().toISOString()
          });
          
          if (options.onError) {
            options.onError(error);
          }
        }
      };

      // Start the VibeKit code generation in the background
      const generatePromise = this.vibeKitService.generateCode({
        prompt,
        mode: 'code',
        callbacks,
        taskContext,
        onProgress: (progressData) => {
          operation.progress = progressData.progress;
          operation.phase = progressData.phase;
          operation.lastUpdate = Date.now();
          
          // Update BackgroundOperationsManager
          backgroundOperations.updateOperation(operationId, {
            progress: progressData.progress,
            phase: progressData.phase,
            message: progressData.message
          });
        }
      });

      // Handle completion asynchronously
      generatePromise.then((result) => {
        operation.status = 'completed';
        operation.result = result;
        operation.endTime = Date.now();
        
        // Notify BackgroundOperationsManager
        backgroundOperations.completeOperation(operationId, result);
        
        // If there's a completion callback, call it
        if (options.onComplete) {
          options.onComplete(operationId, result);
        }
      }).catch((error) => {
        operation.status = 'failed';
        operation.error = error.message;
        operation.endTime = Date.now();
        
        // Notify BackgroundOperationsManager
        backgroundOperations.failOperation(operationId, error.message);
        
        if (options.onError) {
          options.onError(error);
        }
      });

      // Return operation info immediately (background execution)
      return {
        operationId,
        status: 'started',
        message: 'Claude Code session started in background using VibeKit'
      };
      
    } catch (error) {
      console.error('BackgroundClaudeCode startQuery error:', error);
      throw new Error(`Failed to start background Claude Code session: ${error.message}`);
    }
  }

  /**
   * Abort a running operation
   * Maintains compatibility with the original BackgroundClaudeCode interface
   */
  abortOperation(operationId) {
    const operation = this.activeOperations.get(operationId);
    if (operation && operation.status === 'running') {
      operation.status = 'aborted';
      operation.endTime = Date.now();
      
      // Notify BackgroundOperationsManager
      backgroundOperations.cancelOperation(operationId);
      
      // Note: VibeKit SDK doesn't expose direct abort capabilities in the current version
      // This is a placeholder for when that functionality becomes available
      console.log(`Operation ${operationId} marked as aborted`);
      
      return {
        success: true,
        message: `Operation ${operationId} aborted`
      };
    }
    
    return {
      success: false,
      message: `Operation ${operationId} not found or not running`
    };
  }

  /**
   * Get status of an operation
   */
  getOperationStatus(operationId) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return {
        found: false,
        message: 'Operation not found'
      };
    }

    return {
      found: true,
      id: operation.id,
      status: operation.status,
      startTime: operation.startTime,
      lastUpdate: operation.lastUpdate,
      endTime: operation.endTime,
      progress: operation.progress,
      phase: operation.phase,
      lastMessage: operation.lastMessage,
      error: operation.error
    };
  }

  /**
   * Get all active operations
   */
  getActiveOperations() {
    return Array.from(this.activeOperations.values())
      .filter(op => op.status === 'running')
      .map(op => ({
        id: op.id,
        status: op.status,
        startTime: op.startTime,
        lastUpdate: op.lastUpdate,
        progress: op.progress,
        phase: op.phase
      }));
  }

  /**
   * Clean up completed operations older than specified time
   */
  cleanupCompletedOperations(maxAgeMs = 5 * 60 * 1000) { // 5 minutes default
    const now = Date.now();
    const toDelete = [];
    
    for (const [id, operation] of this.activeOperations.entries()) {
      if (operation.status !== 'running' && 
          operation.endTime && 
          (now - operation.endTime) > maxAgeMs) {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => this.activeOperations.delete(id));
    
    return {
      cleaned: toDelete.length,
      remaining: this.activeOperations.size
    };
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    this.operationCounter++;
    return `vibekit-bg-${Date.now()}-${this.operationCounter}`;
  }

  /**
   * Execute a command in the background using VibeKit
   */
  async executeCommand(command, options = {}) {
    try {
      const taskContext = {
        workingDirectory: options.workingDirectory || this.vibeKitService.config.workingDirectory,
        agent: 'claude-code'
      };

      return await this.vibeKitService.executeCommand(command, {
        taskContext,
        timeoutMs: options.timeoutMs,
        background: options.background || false,
        callbacks: options.callbacks
      });
    } catch (error) {
      console.error('BackgroundClaudeCode executeCommand error:', error);
      throw new Error(`Failed to execute command: ${error.message}`);
    }
  }
} 