/**
 * @fileoverview Simplified Execution Service - Phase 3 Implementation
 * 
 * Provides task orchestration capabilities using standard JavaScript patterns
 * instead of Effect Context.Tag system to avoid compatibility issues.
 * Maintains identical interface and functionality for seamless CLI integration.
 */

import { ProviderRegistry } from "../providers/registry.js"

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

export class ExecutionCancelledError extends ExecutionError {
  constructor(message, taskId, executionId, reason) {
    super(message, taskId, executionId)
    this.name = 'ExecutionCancelledError'
    this.reason = reason
  }
}

/**
 * Task execution state model
 */
export class TaskExecutionState {
  constructor(executionId, taskId, config = {}) {
    this.executionId = executionId
    this.taskId = taskId
    this.config = config
    this.status = 'pending'
    this.phase = 'initializing'
    this.startedAt = null
    this.completedAt = null
    this.error = null
    this.result = null
    this.progress = 0
    this.logs = []
    this.resourceId = null
    this.provider = null
    this.cancelRequested = false
    this.cancelReason = null
  }

  updateStatus(status, phase = null) {
    this.status = status
    if (phase) this.phase = phase
    
    if (status === 'running' && !this.startedAt) {
      this.startedAt = new Date().toISOString()
    }
    
    if (['completed', 'failed', 'cancelled'].includes(status) && !this.completedAt) {
      this.completedAt = new Date().toISOString()
    }
  }

  addLog(message, level = 'info') {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message
    })
  }

  requestCancel(reason = 'User cancellation') {
    this.cancelRequested = true
    this.cancelReason = reason
  }
}

/**
 * Simplified execution service without Effect dependencies
 */
export class SimpleExecutionService {
  constructor() {
    this.executions = new Map()
    this.registry = new ProviderRegistry()
    this.listeners = new Map() // For streaming
  }

  /**
   * Generate unique execution ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Execute a task with full lifecycle management
   */
  async executeTask(config, options = {}) {
    const executionId = this.generateExecutionId()
    const state = new TaskExecutionState(executionId, config.taskId, config)
    
    this.executions.set(executionId, state)
    
    try {
      // Validate configuration
      this.validateTaskConfig(config)
      
      // Initialize execution
      state.updateStatus('pending', 'initializing')
      state.addLog(`Starting execution for task ${config.taskId}`)
      
      // Get provider
      const provider = await this.getProvider(config.provider || 'mock')
      state.provider = provider
      
      // Acquire resources
      state.updateStatus('running', 'acquiring')
      state.addLog('Acquiring execution resources')
      
      const resource = await provider.createResource({
        type: 'task-execution',
        resources: config.resources || { cpu: 1, memory: 512, storage: 1024 },
        tags: { 
          taskId: config.taskId,
          executionId: executionId,
          language: config.language || 'javascript'
        }
      })
      
      state.resourceId = resource.id
      state.addLog(`Resource acquired: ${resource.id}`)
      
      // Execute task
      state.updateStatus('running', 'executing')
      state.addLog('Executing task code')
      
      const result = await this.executeCode(provider, resource, config)
      
      // Complete execution
      state.updateStatus('completed', 'completed')
      state.result = result
      state.progress = 100
      state.addLog('Task execution completed successfully')
      
      // Cleanup resources
      await this.cleanupResources(provider, resource, state)
      
      return {
        executionId,
        taskId: config.taskId,
        status: 'completed',
        result: result,
        duration: new Date() - new Date(state.startedAt),
        logs: state.logs
      }
      
    } catch (error) {
      state.updateStatus('failed', 'failed')
      state.error = error.message
      state.addLog(`Execution failed: ${error.message}`, 'error')
      
      // Cleanup on error
      if (state.resourceId && state.provider) {
        await this.cleanupResources(state.provider, { id: state.resourceId }, state)
      }
      
      throw new ExecutionError(
        `Task execution failed: ${error.message}`,
        config.taskId,
        executionId
      )
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId) {
    const state = this.executions.get(executionId)
    if (!state) {
      throw new ExecutionError(`Execution not found: ${executionId}`, null, executionId)
    }
    
    return {
      executionId: state.executionId,
      taskId: state.taskId,
      status: state.status,
      phase: state.phase,
      progress: state.progress,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      result: state.result,
      error: state.error,
      logs: state.logs,
      resourceId: state.resourceId,
      provider: state.provider?.name || 'unknown'
    }
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId, reason = 'User cancellation') {
    const state = this.executions.get(executionId)
    if (!state) {
      throw new ExecutionError(`Execution not found: ${executionId}`, null, executionId)
    }
    
    if (!['pending', 'running'].includes(state.status)) {
      throw new ExecutionError(
        `Cannot cancel execution in status: ${state.status}`,
        state.taskId,
        executionId
      )
    }
    
    state.requestCancel(reason)
    state.updateStatus('cancelled', 'cancelled')
    state.addLog(`Execution cancelled: ${reason}`, 'warn')
    
    // Cleanup resources
    if (state.resourceId && state.provider) {
      await this.cleanupResources(state.provider, { id: state.resourceId }, state)
    }
    
    return {
      executionId,
      taskId: state.taskId,
      status: 'cancelled',
      reason: reason,
      cancelledAt: state.completedAt
    }
  }

  /**
   * List executions with filtering
   */
  async listExecutions(filter = {}) {
    const executions = Array.from(this.executions.values())
    
    let filtered = executions
    
    if (filter.status) {
      filtered = filtered.filter(e => e.status === filter.status)
    }
    
    if (filter.taskId) {
      filtered = filtered.filter(e => e.taskId === filter.taskId)
    }
    
    if (filter.provider) {
      filtered = filtered.filter(e => e.provider?.name === filter.provider)
    }
    
    return filtered.map(state => ({
      executionId: state.executionId,
      taskId: state.taskId,
      status: state.status,
      phase: state.phase,
      progress: state.progress,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      provider: state.provider?.name || 'unknown'
    }))
  }

  /**
   * Stream execution updates
   */
  async streamExecution(executionId, callback) {
    const state = this.executions.get(executionId)
    if (!state) {
      throw new ExecutionError(`Execution not found: ${executionId}`, null, executionId)
    }
    
    // Add listener for this execution
    if (!this.listeners.has(executionId)) {
      this.listeners.set(executionId, [])
    }
    this.listeners.get(executionId).push(callback)
    
    // Send current state
    callback({
      type: 'status',
      executionId,
      data: await this.getExecutionStatus(executionId)
    })
    
    // Return cleanup function
    return () => {
      const listeners = this.listeners.get(executionId)
      if (listeners) {
        const index = listeners.indexOf(callback)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  /**
   * Execute multiple tasks with concurrency control
   */
  async executeTasks(configs, options = {}) {
    const { maxConcurrency = 3 } = options
    const results = []
    
    // Execute tasks in batches
    for (let i = 0; i < configs.length; i += maxConcurrency) {
      const batch = configs.slice(i, i + maxConcurrency)
      const batchPromises = batch.map(config => this.executeTask(config, options))
      
      const batchResults = await Promise.allSettled(batchPromises)
      results.push(...batchResults)
    }
    
    return results
  }

  /**
   * Helper methods
   */
  
  validateTaskConfig(config) {
    if (!config.taskId) {
      throw new ExecutionError('Task ID is required', config.taskId)
    }
    
    if (!config.code && !config.action) {
      throw new ExecutionError('Either code or action must be specified', config.taskId)
    }
    
    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
      throw new ExecutionError('Timeout must be between 1000ms and 300000ms', config.taskId)
    }
  }

  async getProvider(providerType) {
    // For now, always use mock provider
    // In full implementation, this would use the provider registry
    return {
      name: 'mock',
      createResource: async (config) => ({
        id: `resource_${Date.now()}`,
        state: 'running',
        health: 'healthy',
        createdAt: new Date().toISOString()
      }),
      deleteResource: async (id) => ({ deleted: true })
    }
  }

  async executeCode(provider, resource, config) {
    // Mock code execution
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    // Simulate execution result
    return {
      output: `Executed: ${config.code || config.action}`,
      exitCode: 0,
      duration: 1500,
      logs: ['Task started', 'Code executed successfully', 'Task completed']
    }
  }

  async cleanupResources(provider, resource, state) {
    try {
      if (provider.deleteResource) {
        await provider.deleteResource(resource.id)
        state.addLog(`Resource ${resource.id} cleaned up`)
      }
    } catch (error) {
      state.addLog(`Resource cleanup failed: ${error.message}`, 'warn')
    }
  }
}

/**
 * Export singleton instance
 */
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