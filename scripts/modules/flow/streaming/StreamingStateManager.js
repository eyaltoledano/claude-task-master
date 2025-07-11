/**
 * Simple StreamingStateManager implementation
 * Provides basic operation management for the Flow TUI
 */

class StreamingStateManager {
  constructor() {
    this.operations = new Map();
    this.configs = new Map();
    this.onStateChange = null;
    
    // Initialize default operation configs
    this.initializeConfigs();
  }
  
  initializeConfigs() {
    // Expand task operation config
    this.configs.set('expand_task', {
      title: 'Expanding Task',
      description: 'Breaking down task into subtasks...',
      thinkingMessages: [
        'Analyzing task complexity...',
        'Determining optimal subtask structure...',
        'Generating detailed implementation steps...',
        'Reviewing task dependencies...',
        'Finalizing subtask breakdown...'
      ]
    });
    
    // Parse PRD operation config
    this.configs.set('parse_prd', {
      title: 'Parsing PRD',
      description: 'Converting PRD into actionable tasks...',
      thinkingMessages: [
        'Reading PRD document...',
        'Identifying key requirements...',
        'Structuring task hierarchy...',
        'Generating task descriptions...',
        'Finalizing task list...'
      ]
    });
    
    // Analyze complexity operation config
    this.configs.set('analyze_complexity', {
      title: 'Analyzing Complexity',
      description: 'Evaluating task complexity scores...',
      thinkingMessages: [
        'Examining task requirements...',
        'Calculating complexity scores...',
        'Identifying expansion candidates...',
        'Generating complexity report...'
      ]
    });
    
    // Expand all operation config
    this.configs.set('expand_all', {
      title: 'Expanding All Tasks',
      description: 'Breaking down multiple tasks...',
      thinkingMessages: [
        'Processing task queue...',
        'Expanding high-complexity tasks...',
        'Generating subtask structures...',
        'Updating task relationships...'
      ]
    });
  }
  
  getOperationConfig(operationType) {
    return this.configs.get(operationType) || {
      title: 'Processing',
      description: 'Working on operation...',
      thinkingMessages: ['Processing request...']
    };
  }
  
  async startOperation(operationType, { execute }) {
    const operationId = `${operationType}_${Date.now()}`;
    
    const operation = {
      id: operationId,
      type: operationType,
      status: 'running',
      startTime: Date.now()
    };
    
    this.operations.set(operationId, operation);
    this.notifyStateChange();
    
    try {
      // Create signal for cancellation
      const controller = new AbortController();
      operation.controller = controller;
      
      // Create callbacks for the operation
      const callbacks = {
        onThinking: (message) => {
          operation.thinkingMessage = message;
          this.notifyStateChange();
        },
        onProgress: (progress) => {
          operation.progress = progress;
          this.notifyStateChange();
        }
      };
      
      // Execute the operation
      const result = await execute(controller.signal, callbacks);
      
      operation.status = 'completed';
      operation.result = result;
      operation.endTime = Date.now();
      
      this.notifyStateChange();
      
      // Clean up operation after delay
      setTimeout(() => {
        this.operations.delete(operationId);
        this.notifyStateChange();
      }, 1000);
      
      return result;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error.message;
      operation.endTime = Date.now();
      
      this.notifyStateChange();
      
      // Clean up failed operation after delay
      setTimeout(() => {
        this.operations.delete(operationId);
        this.notifyStateChange();
      }, 2000);
      
      throw error;
    }
  }
  
  cancel(operationId) {
    if (operationId) {
      const operation = this.operations.get(operationId);
      if (operation && operation.controller) {
        operation.controller.abort();
        operation.status = 'cancelled';
        this.notifyStateChange();
      }
    } else {
      // Cancel all running operations
      for (const operation of this.operations.values()) {
        if (operation.controller && operation.status === 'running') {
          operation.controller.abort();
          operation.status = 'cancelled';
        }
      }
      this.notifyStateChange();
    }
  }
  
  getActiveOperations() {
    return Array.from(this.operations.values());
  }
  
  getCurrentState() {
    const activeOperations = this.getActiveOperations();
    const currentOperation = activeOperations.find(op => 
      op.status === 'running' || op.status === 'completed' || op.status === 'failed' || op.status === 'cancelled'
    );
    
    if (!currentOperation) {
      return {
        state: 'idle',
        operation: null,
        message: '',
        context: {},
        elapsedTime: 0,
        formattedElapsedTime: '0s',
        currentPhase: '',
        phases: [],
        thinkingMessage: '',
        canCancel: false
      };
    }
    
    const elapsedTime = (currentOperation.endTime || Date.now()) - currentOperation.startTime;
    const formattedElapsedTime = this.formatElapsedTime(elapsedTime);
    const config = this.getOperationConfig(currentOperation.type);
    
    // Map internal status to modal state
    const stateMap = {
      'running': 'processing',
      'completed': 'completed',
      'failed': 'error',
      'cancelled': 'cancelled'
    };
    
    const state = stateMap[currentOperation.status] || 'processing';
    
    // Get appropriate message based on state
    let message = '';
    if (state === 'completed') {
      message = `${config.title} completed successfully`;
    } else if (state === 'error') {
      message = `${config.title} failed: ${currentOperation.error || 'Unknown error'}`;
    } else if (state === 'cancelled') {
      message = `${config.title} was cancelled`;
    } else {
      message = currentOperation.thinkingMessage || config.description;
    }
    
    return {
      state,
      operation: currentOperation.type,
      message,
      context: {
        operationType: currentOperation.type,
        error: currentOperation.error ? { message: currentOperation.error } : null
      },
      elapsedTime,
      formattedElapsedTime,
      currentPhase: state === 'processing' ? 'processing' : 'completed',
      phases: [currentOperation.type],
      thinkingMessage: currentOperation.thinkingMessage || '',
      canCancel: currentOperation.status === 'running'
    };
  }
  
  formatElapsedTime(elapsedMs) {
    const seconds = Math.floor(elapsedMs / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange(this.getCurrentState());
    }
  }
}

// Create and export singleton instance
export const streamingStateManager = new StreamingStateManager(); 