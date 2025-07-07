/**
 * @fileoverview Simplified Execution Service - Phase 3 Implementation with Phase 4 Streaming
 * 
 * Provides task orchestration capabilities using standard JavaScript patterns
 * instead of Effect Context.Tag system to avoid compatibility issues.
 * Enhanced with real-time streaming capabilities for Phase 4.
 */

import { streamingService, MessageFormatter } from "./streaming.service.js"

/**
 * Custom error types for execution engine
 */
export class ExecutionError extends Error {
  constructor(message, taskId, executionId) {
    super(message)
    this.name = 'ExecutionError'
    this.taskId = taskId
    this.executionId = executionId
  }
}

export class ExecutionCancelledError extends Error {
  constructor(message, executionId) {
    super(message)
    this.name = 'ExecutionCancelledError'
    this.executionId = executionId
  }
}

/**
 * Task execution phases
 */
export const EXECUTION_PHASES = {
  INITIALIZING: 'initializing',
  ACQUIRING: 'acquiring',
  EXECUTING: 'executing',
  CLEANING: 'cleaning',
  COMPLETED: 'completed'
}

/**
 * Enhanced execution state model with streaming support
 */
export class ExecutionState {
  constructor(taskId, config) {
    this.executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.taskId = taskId
    this.config = config
    this.status = 'pending'
    this.phase = EXECUTION_PHASES.INITIALIZING
    this.progress = 0
    this.startTime = null
    this.endTime = null
    this.output = []
    this.logs = []
    this.error = null
    this.resources = new Map()
    this.cancelled = false
    this.cancelReason = null
    
    // Streaming support
    this.streamingActive = false
  }

  updateProgress(progress, phase = null, message = null) {
    this.progress = Math.min(100, Math.max(0, progress))
    if (phase) this.phase = phase
    
    // Emit streaming update if active
    if (this.streamingActive) {
      streamingService.updateProgress(this.executionId, this.progress, this.phase, message)
    }
  }

  forceProgress(progress, phase = null, message = null) {
    this.progress = Math.min(100, Math.max(0, progress))
    if (phase) this.phase = phase
    
    // Emit immediate streaming update if active
    if (this.streamingActive) {
      streamingService.forceProgress(this.executionId, this.progress, this.phase, message)
    }
  }

  addLog(level, message, details = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    }
    this.logs.push(logEntry)
    
    // Emit streaming log if active
    if (this.streamingActive) {
      streamingService.emitLog(this.executionId, level, message, details)
    }
  }

  setStatus(status, phase = null) {
    this.status = status
    if (phase) this.phase = phase
    
    // Emit streaming status if active
    if (this.streamingActive) {
      streamingService.emitStatus(this.executionId, status, this.phase)
    }
  }

  setPhase(phase, message = null) {
    this.phase = phase
    
    // Emit streaming phase transition if active
    if (this.streamingActive) {
      streamingService.emitPhase(this.executionId, phase, message)
    }
  }

  setError(error, phase = null) {
    this.error = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }
    
    // Emit streaming error if active
    if (this.streamingActive) {
      streamingService.emitError(this.executionId, error, phase || this.phase)
    }
  }

  startStreaming() {
    if (!this.streamingActive) {
      streamingService.startStream(this.executionId)
      this.streamingActive = true
      
      // Emit current state
      streamingService.emitStatus(this.executionId, this.status, this.phase)
      streamingService.forceProgress(this.executionId, this.progress, this.phase)
    }
  }

  stopStreaming() {
    if (this.streamingActive) {
      streamingService.stopStream(this.executionId)
      this.streamingActive = false
    }
  }
}

/**
 * Simplified execution service with streaming support
 */
export class SimpleExecutionService {
  constructor() {
    this.executions = new Map()
    this.listeners = new Map()
    // Use simplified provider handling for Phase 4
    this.providers = new Map([
      ['mock', { 
        name: 'Mock Provider', 
        type: 'mock',
        ready: true,
        executeAction: async (action) => ({ success: true, output: 'Mock result' })
      }]
    ])
  }

  /**
   * Execute a task with full lifecycle management and streaming
   */
  async executeTask(config, options = {}) {
    const taskId = config.taskId || `task_${Date.now()}`
    const state = new ExecutionState(taskId, config)
    
    this.executions.set(state.executionId, state)
    
    try {
      // Start streaming if requested
      if (options.stream !== false) {
        state.startStreaming()
      }

      state.setStatus('running')
      state.setPhase(EXECUTION_PHASES.INITIALIZING, 'Starting task execution')
      state.addLog("info", `Starting execution for task: ${taskId}`)
      state.updateProgress(5, EXECUTION_PHASES.INITIALIZING, 'Initializing execution environment')
      state.startTime = new Date().toISOString()

      // Phase 1: Resource Acquisition
      state.setPhase(EXECUTION_PHASES.ACQUIRING, 'Acquiring execution resources')
      state.addLog("info", 'Acquiring execution resources')
      await this._simulateWork(200)
      state.updateProgress(25, EXECUTION_PHASES.ACQUIRING, 'Resources acquired successfully')

      // Acquire mock resources
      const provider = this.providers.get('mock')
      if (!provider) {
        throw new Error('Mock provider not available')
      }
      state.resources.set('provider', provider)
      state.resources.set('sandbox', { id: 'mock-sandbox', status: 'ready' })
      state.addLog("info", 'Mock execution environment ready')

      // Phase 2: Code Execution
      state.setPhase(EXECUTION_PHASES.EXECUTING, 'Executing task code')
      state.addLog("info", 'Beginning code execution')
      state.updateProgress(50, EXECUTION_PHASES.EXECUTING, 'Executing user code')

      // Simulate code execution with progress updates
      const steps = [
        { progress: 60, message: 'Parsing code structure' },
        { progress: 70, message: 'Running code validation' },
        { progress: 80, message: 'Executing main code block' },
        { progress: 90, message: 'Processing output' }
      ]

      for (const step of steps) {
        await this._simulateWork(300)
        if (state.cancelled) {
          throw new ExecutionCancelledError('Execution cancelled by user', state.executionId)
        }
        state.updateProgress(step.progress, EXECUTION_PHASES.EXECUTING, step.message)
        state.addLog("info", step.message)
      }

      // Simulate execution output
      const mockOutput = this._generateMockOutput(config)
      state.output.push(mockOutput)
      state.addLog("info", 'Code execution completed successfully')
      state.addLog("debug", 'Output generated', { outputLength: mockOutput.length })

      // Phase 3: Cleanup
      state.setPhase(EXECUTION_PHASES.CLEANING, 'Cleaning up resources')
      state.addLog("info", 'Starting resource cleanup')
      await this._simulateWork(100)
      state.updateProgress(95, EXECUTION_PHASES.CLEANING, 'Releasing resources')

      // Clean up resources
      state.resources.clear()
      state.addLog("info", 'Resources cleaned up successfully')

      // Phase 4: Completion
      state.setPhase(EXECUTION_PHASES.COMPLETED, 'Execution completed')
      state.forceProgress(100, EXECUTION_PHASES.COMPLETED, 'Task execution completed successfully')
      state.setStatus('completed')
      state.endTime = new Date().toISOString()
      state.addLog("info", `Task execution completed in ${this._calculateDuration(state)}ms`)

      return {
        executionId: state.executionId,
        taskId,
        status: 'completed',
        progress: 100,
        output: state.output,
        duration: this._calculateDuration(state),
        logs: state.logs
      }

    } catch (error) {
      state.setStatus('failed')
      state.setError(error)
      state.endTime = new Date().toISOString()
      state.addLog("error", `Execution failed: ${error.message}`)
      
      if (error instanceof ExecutionCancelledError) {
        state.setStatus('cancelled')
        state.addLog("warn", `Execution cancelled: ${error.message}`)
      }

      throw error
    } finally {
      // Always stop streaming when execution ends
      state.stopStreaming()
    }
  }

  /**
   * Get execution status with streaming support
   */
  getExecutionStatus(executionId) {
    const state = this.executions.get(executionId)
    if (!state) {
      throw new Error(`Execution ${executionId} not found`)
    }

    return {
      executionId: state.executionId,
      taskId: state.taskId,
      status: state.status,
      phase: state.phase,
      progress: state.progress,
      startTime: state.startTime,
      endTime: state.endTime,
      output: state.output,
      logs: state.logs,
      error: state.error,
      cancelled: state.cancelled,
      cancelReason: state.cancelReason,
      streamingActive: state.streamingActive,
      duration: state.endTime ? this._calculateDuration(state) : null
    }
  }

  /**
   * Cancel execution with streaming notification
   */
  async cancelExecution(executionId, reason = 'User requested cancellation') {
    const state = this.executions.get(executionId)
    if (!state) {
      throw new Error(`Execution ${executionId} not found`)
    }

    if (state.status === 'completed' || state.status === 'failed' || state.cancelled) {
      throw new Error(`Cannot cancel execution ${executionId}: already ${state.status}`)
    }

    state.cancelled = true
    state.cancelReason = reason
    state.addLog("warn", `Cancellation requested: ${reason}`)
    
    // Note: The actual cancellation will be handled by the execution loop
    return {
      executionId,
      status: 'cancelling',
      reason
    }
  }

  /**
   * Stream execution updates using async iterator
   */
  async* streamExecution(executionId) {
    const state = this.executions.get(executionId)
    if (!state) {
      throw new Error(`Execution ${executionId} not found`)
    }

    // Start streaming if not already active
    if (!state.streamingActive) {
      state.startStreaming()
    }

    // Use the streaming service's async iterator
    try {
      for await (const message of streamingService.streamMessages(executionId)) {
        yield message
      }
    } catch (error) {
      // Handle streaming errors
      throw new Error(`Streaming failed for execution ${executionId}: ${error.message}`)
    }
  }

  /**
   * Subscribe to execution updates
   */
  subscribeToExecution(executionId, listener) {
    return streamingService.subscribe(executionId, listener)
  }

  /**
   * Get execution stream (Node.js Readable)
   */
  getExecutionStream(executionId) {
    const state = this.executions.get(executionId)
    if (!state) {
      throw new Error(`Execution ${executionId} not found`)
    }

    // Start streaming if not already active
    if (!state.streamingActive) {
      state.startStreaming()
    }

    return streamingService.getOutputStream(executionId)
  }

  /**
   * List executions with optional filtering
   */
  listExecutions(filters = {}) {
    const results = []
    
    for (const [executionId, state] of this.executions) {
      if (filters.status && state.status !== filters.status) continue
      if (filters.taskId && state.taskId !== filters.taskId) continue
      
      results.push({
        executionId: state.executionId,
        taskId: state.taskId,
        status: state.status,
        phase: state.phase,
        progress: state.progress,
        startTime: state.startTime,
        endTime: state.endTime,
        cancelled: state.cancelled,
        streamingActive: state.streamingActive,
        duration: state.endTime ? this._calculateDuration(state) : null
      })
    }
    
    return results
  }

  /**
   * Execute multiple tasks with concurrency control
   */
  async executeTasks(configs, options = {}) {
    const maxConcurrency = options.maxConcurrency || 3
    const results = []
    const executing = new Set()

    for (const config of configs) {
      // Wait if we've hit the concurrency limit
      while (executing.size >= maxConcurrency) {
        await Promise.race(executing)
      }

      const promise = this.executeTask(config, options)
        .then(result => {
          executing.delete(promise)
          return result
        })
        .catch(error => {
          executing.delete(promise)
          throw error
        })

      executing.add(promise)
      results.push(promise)
    }

    // Wait for all remaining executions
    return Promise.allSettled(results)
  }

  /**
   * Check if streaming is active for execution
   */
  isStreamingActive(executionId) {
    return streamingService.isStreaming(executionId)
  }

  /**
   * Get list of active streams
   */
  getActiveStreams() {
    return streamingService.getActiveStreams()
  }

  // Private helper methods
  async _simulateWork(ms) {
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  _generateMockOutput(config) {
    if (config.code) {
      return `// Mock execution output for: ${config.taskId}\n// Code: ${config.code}\n// Result: Success\nconsole.log('Hello from ${config.taskId}!');`
    }
    return `Mock execution completed for task: ${config.taskId}`
  }

  _calculateDuration(state) {
    if (!state.startTime || !state.endTime) return null
    return new Date(state.endTime).getTime() - new Date(state.startTime).getTime()
  }

  /**
   * Cleanup service resources
   */
  cleanup() {
    // Stop all active streams
    for (const [executionId] of this.executions) {
      const state = this.executions.get(executionId)
      if (state && state.streamingActive) {
        state.stopStreaming()
      }
    }
    
    // Clean up streaming service
    streamingService.cleanup()
    
    // Clear executions
    this.executions.clear()
    this.listeners.clear()
  }
}

// Singleton instance for the service
export const executionService = new SimpleExecutionService()

/**
 * Create execution service instance
 */
export function createExecutionService() {
  return new SimpleExecutionService()
}

/**
 * For compatibility with Effect-based code
 */
export const ExecutionService = executionService
export const FlowExecutionLive = executionService 