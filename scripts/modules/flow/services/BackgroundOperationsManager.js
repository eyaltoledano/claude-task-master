/**
 * VibeKit-based Background Operations Manager
 * Replacement for the original BackgroundOperationsManager service using VibeKit SDK
 */

import { EventEmitter } from 'events';

class BackgroundOperationsManager extends EventEmitter {
  constructor() {
    super();
    this.operations = new Map();
    this.operationCounter = 0;
  }

  /**
   * Get all currently running operations
   */
  getRunningOperations() {
    return Array.from(this.operations.values())
      .filter(op => op.status === 'running')
      .map(op => ({
        id: op.id,
        type: op.type,
        status: op.status,
        startTime: op.startTime,
        lastUpdate: op.lastUpdate,
        progress: op.progress,
        phase: op.phase,
        metadata: op.metadata
      }));
  }

  /**
   * Get all operations (running and completed)
   */
  getAllOperations() {
    return Array.from(this.operations.values())
      .map(op => ({
        id: op.id,
        type: op.type,
        status: op.status,
        startTime: op.startTime,
        lastUpdate: op.lastUpdate,
        endTime: op.endTime,
        progress: op.progress,
        phase: op.phase,
        metadata: op.metadata,
        result: op.result,
        error: op.error
      }));
  }

  /**
   * Start a new background operation
   */
  startOperation(type, metadata = {}) {
    const operationId = this.generateOperationId();
    
    const operation = {
      id: operationId,
      type,
      status: 'running',
      startTime: Date.now(),
      lastUpdate: Date.now(),
      metadata,
      progress: 0,
      phase: 'initializing'
    };
    
    this.operations.set(operationId, operation);
    
    // Emit operation started event
    this.emit('operation-started', operationId, operation);
    
    return {
      operationId,
      operation: { ...operation }
    };
  }

  /**
   * Update operation progress
   */
  updateOperation(operationId, updates) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return false;
    }

    // Update operation properties
    Object.assign(operation, updates);
    operation.lastUpdate = Date.now();
    
    // Emit update event if needed
    if (updates.message) {
      this.emit('operation-message', operationId, {
        type: 'progress',
        content: updates.message,
        timestamp: new Date().toISOString(),
        progress: updates.progress,
        phase: updates.phase
      });
    }
    
    return true;
  }

  /**
   * Complete an operation
   */
  completeOperation(operationId, result) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return false;
    }

    operation.status = 'completed';
    operation.endTime = Date.now();
    operation.result = result;
    operation.progress = 100;
    operation.phase = 'completed';
    
    // Emit completion event
    this.emit('operation-completed', operationId, {
      success: true,
      result,
      operation: { ...operation }
    });
    
    // Clean up after delay
    setTimeout(() => {
      this.operations.delete(operationId);
    }, 5 * 60 * 1000); // Keep for 5 minutes
    
    return true;
  }

  /**
   * Fail an operation
   */
  failOperation(operationId, error) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return false;
    }

    operation.status = 'failed';
    operation.endTime = Date.now();
    operation.error = error;
    operation.phase = 'failed';
    
    // Emit completion event with failure
    this.emit('operation-completed', operationId, {
      success: false,
      error,
      operation: { ...operation }
    });
    
    // Clean up after delay
    setTimeout(() => {
      this.operations.delete(operationId);
    }, 10 * 60 * 1000); // Keep failed operations longer for debugging
    
    return true;
  }

  /**
   * Cancel an operation
   */
  cancelOperation(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return false;
    }

    operation.status = 'cancelled';
    operation.endTime = Date.now();
    operation.phase = 'cancelled';
    
    // Emit completion event with cancellation
    this.emit('operation-completed', operationId, {
      success: false,
      cancelled: true,
      operation: { ...operation }
    });
    
    // Clean up immediately for cancelled operations
    setTimeout(() => {
      this.operations.delete(operationId);
    }, 30 * 1000); // Keep for 30 seconds
    
    return true;
  }

  /**
   * Get specific operation status
   */
  getOperation(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return null;
    }

    return {
      id: operation.id,
      type: operation.type,
      status: operation.status,
      startTime: operation.startTime,
      lastUpdate: operation.lastUpdate,
      endTime: operation.endTime,
      progress: operation.progress,
      phase: operation.phase,
      metadata: operation.metadata,
      result: operation.result,
      error: operation.error
    };
  }

  /**
   * Clean up old operations
   */
  cleanup(maxAgeMs = 30 * 60 * 1000) { // 30 minutes default
    const now = Date.now();
    const toDelete = [];
    
    for (const [id, operation] of this.operations.entries()) {
      if (operation.status !== 'running' && 
          operation.endTime && 
          (now - operation.endTime) > maxAgeMs) {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => this.operations.delete(id));
    
    return {
      cleaned: toDelete.length,
      remaining: this.operations.size
    };
  }

  /**
   * Send a message for an operation
   */
  sendOperationMessage(operationId, message) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return false;
    }

    operation.lastUpdate = Date.now();
    
    this.emit('operation-message', operationId, {
      type: message.type || 'info',
      content: message.content || message,
      timestamp: new Date().toISOString(),
      ...message
    });
    
    return true;
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    this.operationCounter++;
    return `vibekit-op-${Date.now()}-${this.operationCounter}`;
  }

  /**
   * Get operation statistics
   */
  getStats() {
    const operations = Array.from(this.operations.values());
    
    return {
      total: operations.length,
      running: operations.filter(op => op.status === 'running').length,
      completed: operations.filter(op => op.status === 'completed').length,
      failed: operations.filter(op => op.status === 'failed').length,
      cancelled: operations.filter(op => op.status === 'cancelled').length
    };
  }
}

// Create and export singleton instance
export const backgroundOperations = new BackgroundOperationsManager(); 