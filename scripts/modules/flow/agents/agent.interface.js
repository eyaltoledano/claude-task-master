/**
 * @fileoverview AI Agent Interface - Phase 5 Implementation
 * 
 * Defines the base agent interface and common patterns for AI agent integration.
 * Uses simplified JavaScript patterns with async methods, state management, and streaming support.
 * Based on 2024-2025 research findings for production-ready agent abstraction.
 */

import { EventEmitter } from 'node:events'

/**
 * Agent capability types for task-agent matching
 */
export const AGENT_CAPABILITIES = {
  CODE_GENERATION: 'code_generation',
  CODE_REVIEW: 'code_review',
  PLANNING: 'planning',
  TESTING: 'testing',
  DOCUMENTATION: 'documentation',
  DEBUGGING: 'debugging',
  ARCHITECTURE: 'architecture'
}

/**
 * Agent status types
 */
export const AGENT_STATUS = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  BUSY: 'busy',
  ERROR: 'error',
  OFFLINE: 'offline'
}

/**
 * Custom error types for agent operations
 */
export class AgentError extends Error {
  constructor(message, agentId, agentType, code = 'AGENT_ERROR') {
    super(message)
    this.name = 'AgentError'
    this.agentId = agentId
    this.agentType = agentType
    this.code = code
  }
}

export class AgentTimeoutError extends AgentError {
  constructor(message, agentId, agentType, timeout) {
    super(message, agentId, agentType, 'AGENT_TIMEOUT')
    this.timeout = timeout
  }
}

export class AgentRateLimitError extends AgentError {
  constructor(message, agentId, agentType, retryAfter = null) {
    super(message, agentId, agentType, 'AGENT_RATE_LIMIT')
    this.retryAfter = retryAfter
  }
}

/**
 * Base AI Agent class providing common interface and functionality
 * All agent implementations should extend this class
 */
export class AIAgent extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.id = config.id || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.type = config.type || 'unknown'
    this.name = config.name || this.type
    this.status = AGENT_STATUS.UNINITIALIZED
    this.capabilities = config.capabilities || []
    this.config = { ...config }
    this.state = {}
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      lastUsed: null
    }
  }

  /**
   * Initialize the agent with configuration
   * @param {Object} config - Agent configuration
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(config = {}) {
    this.status = AGENT_STATUS.INITIALIZING
    this.emit('status', { status: this.status, timestamp: new Date().toISOString() })
    
    try {
      // Override in subclasses for provider-specific initialization
      this.config = { ...this.config, ...config }
      await this._doInitialize(config)
      
      this.status = AGENT_STATUS.READY
      this.emit('status', { status: this.status, timestamp: new Date().toISOString() })
      
      return { 
        success: true, 
        agentId: this.id,
        agentType: this.type,
        capabilities: this.capabilities,
        status: this.status
      }
    } catch (error) {
      this.status = AGENT_STATUS.ERROR
      this.emit('error', error)
      throw new AgentError(`Failed to initialize agent: ${error.message}`, this.id, this.type)
    }
  }

  /**
   * Generate code based on task and context
   * @param {Object} task - Task specification
   * @param {Object} context - Execution context
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated code result
   */
  async generateCode(task, context = {}, options = {}) {
    if (this.status !== AGENT_STATUS.READY) {
      throw new AgentError('Agent not ready for code generation', this.id, this.type)
    }

    const startTime = Date.now()
    this.status = AGENT_STATUS.BUSY
    this.metrics.totalRequests++
    this.metrics.lastUsed = new Date().toISOString()

    try {
      this.emit('progress', { 
        type: 'code_generation_start', 
        task: task.id || 'unknown',
        timestamp: new Date().toISOString()
      })

      const result = await this._doGenerateCode(task, context, options)
      
      // Update metrics
      const responseTime = Date.now() - startTime
      this.metrics.successfulRequests++
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + responseTime) / 
        this.metrics.successfulRequests

      if (result.tokens) {
        this.metrics.totalTokens += result.tokens
      }
      if (result.cost) {
        this.metrics.totalCost += result.cost
      }

      this.status = AGENT_STATUS.READY
      this.emit('progress', { 
        type: 'code_generation_complete', 
        task: task.id || 'unknown',
        duration: responseTime,
        timestamp: new Date().toISOString()
      })

      return {
        success: true,
        code: result.code,
        language: result.language || 'javascript',
        explanation: result.explanation,
        metadata: {
          agentId: this.id,
          agentType: this.type,
          generatedAt: new Date().toISOString(),
          responseTime,
          tokens: result.tokens,
          cost: result.cost
        }
      }
    } catch (error) {
      this.metrics.failedRequests++
      this.status = AGENT_STATUS.READY
      this.emit('error', error)
      throw new AgentError(`Code generation failed: ${error.message}`, this.id, this.type)
    }
  }

  /**
   * Execute a task using the agent
   * @param {Object} task - Task to execute
   * @param {Object} sandbox - Sandbox environment
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeTask(task, sandbox = null, options = {}) {
    if (this.status !== AGENT_STATUS.READY) {
      throw new AgentError('Agent not ready for task execution', this.id, this.type)
    }

    const startTime = Date.now()
    this.status = AGENT_STATUS.BUSY
    this.metrics.totalRequests++
    this.metrics.lastUsed = new Date().toISOString()

    try {
      this.emit('progress', { 
        type: 'task_execution_start', 
        task: task.id || 'unknown',
        timestamp: new Date().toISOString()
      })

      const result = await this._doExecuteTask(task, sandbox, options)
      
      const responseTime = Date.now() - startTime
      this.metrics.successfulRequests++
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + responseTime) / 
        this.metrics.successfulRequests

      this.status = AGENT_STATUS.READY
      this.emit('progress', { 
        type: 'task_execution_complete', 
        task: task.id || 'unknown',
        duration: responseTime,
        timestamp: new Date().toISOString()
      })

      return {
        success: true,
        result: result.output,
        metadata: {
          agentId: this.id,
          agentType: this.type,
          executedAt: new Date().toISOString(),
          responseTime
        }
      }
    } catch (error) {
      this.metrics.failedRequests++
      this.status = AGENT_STATUS.READY
      this.emit('error', error)
      throw new AgentError(`Task execution failed: ${error.message}`, this.id, this.type)
    }
  }

  /**
   * Stream responses from the agent (async generator)
   * @param {Object} task - Task specification
   * @param {Object} options - Streaming options
   * @yields {Object} Streaming chunks
   */
  async* streamResponse(task, options = {}) {
    if (this.status !== AGENT_STATUS.READY) {
      throw new AgentError('Agent not ready for streaming', this.id, this.type)
    }

    this.status = AGENT_STATUS.BUSY
    this.emit('progress', { 
      type: 'streaming_start', 
      task: task.id || 'unknown',
      timestamp: new Date().toISOString()
    })

    try {
      const stream = this._doStreamResponse(task, options)
      
      for await (const chunk of stream) {
        this.emit('stream_chunk', { 
          chunk, 
          task: task.id || 'unknown',
          timestamp: new Date().toISOString()
        })
        yield chunk
      }

      this.status = AGENT_STATUS.READY
      this.emit('progress', { 
        type: 'streaming_complete', 
        task: task.id || 'unknown',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      this.status = AGENT_STATUS.READY
      this.emit('error', error)
      throw new AgentError(`Streaming failed: ${error.message}`, this.id, this.type)
    }
  }

  /**
   * Get agent state (for persistence)
   * @returns {Object} Serializable state
   */
  getState() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      status: this.status,
      capabilities: this.capabilities,
      config: this.config,
      state: this.state,
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Set agent state (for recovery)
   * @param {Object} state - State to restore
   */
  setState(state) {
    if (state.id) this.id = state.id
    if (state.type) this.type = state.type
    if (state.name) this.name = state.name
    if (state.status) this.status = state.status
    if (state.capabilities) this.capabilities = state.capabilities
    if (state.config) this.config = state.config
    if (state.state) this.state = state.state
    if (state.metrics) this.metrics = state.metrics
  }

  /**
   * Check agent health and availability
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const healthResult = await this._doHealthCheck()
      return {
        healthy: true,
        agentId: this.id,
        agentType: this.type,
        status: this.status,
        capabilities: this.capabilities,
        metrics: this.metrics,
        details: healthResult
      }
    } catch (error) {
      return {
        healthy: false,
        agentId: this.id,
        agentType: this.type,
        status: this.status,
        error: error.message
      }
    }
  }

  /**
   * Get agent capabilities and metadata
   * @returns {Object} Agent information
   */
  getInfo() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      status: this.status,
      capabilities: this.capabilities,
      metrics: this.metrics,
      config: {
        // Return safe config without sensitive data
        ...this.config,
        apiKey: this.config.apiKey ? '***masked***' : undefined
      }
    }
  }

  // Protected methods to be overridden by subclasses

  /**
   * Provider-specific initialization logic
   * @protected
   */
  async _doInitialize(config) {
    // Override in subclasses
    return { ready: true }
  }

  /**
   * Provider-specific code generation logic
   * @protected
   */
  async _doGenerateCode(task, context, options) {
    throw new Error('_doGenerateCode must be implemented by subclass')
  }

  /**
   * Provider-specific task execution logic
   * @protected
   */
  async _doExecuteTask(task, sandbox, options) {
    throw new Error('_doExecuteTask must be implemented by subclass')
  }

  /**
   * Provider-specific streaming logic
   * @protected
   */
  async* _doStreamResponse(task, options) {
    // Default implementation - override in subclasses
    yield { type: 'error', message: '_doStreamResponse must be implemented by subclass' }
  }

  /**
   * Provider-specific health check logic
   * @protected
   */
  async _doHealthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}

/**
 * Agent configuration schema for validation
 */
export const AgentConfigSchema = {
  id: { type: 'string', optional: true },
  type: { type: 'string', required: true },
  name: { type: 'string', optional: true },
  capabilities: { type: 'array', optional: true },
  apiKey: { type: 'string', optional: true },
  baseUrl: { type: 'string', optional: true },
  model: { type: 'string', optional: true },
  timeout: { type: 'number', optional: true, default: 30000 },
  maxRetries: { type: 'number', optional: true, default: 3 },
  temperature: { type: 'number', optional: true, default: 0.7 }
}

/**
 * Validate agent configuration
 * @param {Object} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
export function validateAgentConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Agent config must be an object')
  }

  for (const [key, schema] of Object.entries(AgentConfigSchema)) {
    const value = config[key]
    
    if (schema.required && (value === undefined || value === null)) {
      throw new Error(`Required field '${key}' is missing`)
    }
    
    if (value !== undefined && value !== null) {
      if (schema.type === 'string' && typeof value !== 'string') {
        throw new Error(`Field '${key}' must be a string`)
      }
      if (schema.type === 'number' && typeof value !== 'number') {
        throw new Error(`Field '${key}' must be a number`)
      }
      if (schema.type === 'array' && !Array.isArray(value)) {
        throw new Error(`Field '${key}' must be an array`)
      }
    }
  }
} 