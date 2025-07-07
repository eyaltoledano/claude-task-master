/**
 * @fileoverview Mock Provider Implementation
 * 
 * Provides a mock implementation of the sandbox provider for testing
 * and development. Simulates realistic provider behaviors without external dependencies.
 * Based on VibeKit patterns and Task Master Phase 7 architecture.
 */

/**
 * Mock error classes for realistic error simulation
 */
export class MockError extends Error {
  constructor({ code, message, category, details = {} }) {
    super(message)
    this.name = 'MockError'
    this.code = code
    this.category = category
    this.details = details
  }
}

export class MockConnectionError extends MockError {
  constructor({ code, message, category, details = {} }) {
    super({ code, message, category, details })
    this.name = 'MockConnectionError'
    this.retryable = true
  }
}

export class MockExecutionError extends MockError {
  constructor({ code, message, category, details = {} }) {
    super({ code, message, category, details })
    this.name = 'MockExecutionError'
    this.retryable = false
  }
}

/**
 * Mock Resource Manager for tracking resources
 */
class MockResourceManager {
  constructor() {
    this.resources = new Map()
    this.executions = new Map()
    this.logs = new Map()
  }

  trackResource(resource) {
    this.resources.set(resource.id, {
      ...resource,
      trackedAt: new Date().toISOString()
    })
    this.addLog(resource.id, 'info', `Resource ${resource.id} tracked`)
  }

  updateResource(resourceId, updates) {
    const resource = this.resources.get(resourceId)
    if (resource) {
      const updatedResource = { ...resource, ...updates, updatedAt: new Date().toISOString() }
      this.resources.set(resourceId, updatedResource)
      this.addLog(resourceId, 'info', `Resource ${resourceId} updated`)
    }
  }

  untrackResource(resourceId) {
    this.resources.delete(resourceId)
    this.executions.delete(resourceId)
    this.logs.delete(resourceId)
  }

  logExecution(resourceId, execution) {
    if (!this.executions.has(resourceId)) {
      this.executions.set(resourceId, [])
    }
    this.executions.get(resourceId).push(execution)
    this.addLog(resourceId, 'info', `Executed ${execution.action} in ${execution.duration}ms`)
  }

  addLog(resourceId, level, message) {
    if (!this.logs.has(resourceId)) {
      this.logs.set(resourceId, [])
    }
    this.logs.get(resourceId).push({
      timestamp: new Date().toISOString(),
      level,
      message,
      provider: 'mock'
    })
  }

  getResourceLogs(resourceId, options = {}) {
    const logs = this.logs.get(resourceId) || []
    if (options.recent) {
      return logs.slice(-10) // Return last 10 logs
    }
    return logs
  }
}

/**
 * Mock Provider Implementation
 * Simulates realistic sandbox provider behavior with code execution capabilities
 */
export class MockProvider {
  constructor(config = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 10,
      defaultTimeout: config.defaultTimeout || 30000,
      simulateLatency: config.simulateLatency !== false,
      failureRate: config.failureRate || 0, // 0-1, chance of random failures
      ...config
    }
    
    this.resourceManager = new MockResourceManager()
    this.activeResources = new Map()
    this.metrics = {
      created: 0,
      destroyed: 0,
      executed: 0,
      errors: 0,
      totalExecutionTime: 0
    }
  }

  /**
   * Initialize the Mock provider
   */
  async initialize() {
    if (this.config.simulateLatency) {
      await this.simulateDelay(100, 300)
    }

    return {
      success: true,
      provider: 'mock',
      initialized: true,
      capabilities: await this.getCapabilities()
    }
  }

  /**
   * Create a new mock sandbox resource
   */
  async createResource(config = {}) {
    try {
      if (this.activeResources.size >= this.config.maxConcurrent) {
        throw new MockError({
          code: 'MAX_RESOURCES_EXCEEDED',
          message: `Maximum concurrent resources (${this.config.maxConcurrent}) exceeded`,
          category: 'resource'
        })
      }

      await this.simulateRandomFailure()
      await this.simulateDelay(200, 800)

      const resource = {
        id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'sandbox',
        provider: 'mock',
        status: 'ready',
        template: config.template || 'mock-default',
        createdAt: new Date().toISOString(),
        config: {
          language: config.language || 'javascript',
          timeout: config.timeout || this.config.defaultTimeout,
          environment: config.environment || {},
          ...config
        },
        metadata: {
          provider: 'mock',
          simulated: true,
          version: '1.0.0',
          ...config.metadata
        }
      }

      this.activeResources.set(resource.id, resource)
      this.metrics.created++
      this.resourceManager.trackResource(resource)

      return {
        success: true,
        resource: {
          id: resource.id,
          type: resource.type,
          provider: resource.provider,
          status: resource.status,
          template: resource.template,
          createdAt: resource.createdAt,
          metadata: resource.metadata
        }
      }
    } catch (error) {
      this.metrics.errors++
      if (error instanceof MockError) {
        throw error
      }
      throw new MockError({
        code: 'RESOURCE_CREATION_FAILED',
        message: `Failed to create mock resource: ${error.message}`,
        category: 'resource',
        details: { config, originalError: error }
      })
    }
  }

  /**
   * Update resource configuration
   */
  async updateResource(resourceId, updates = {}) {
    try {
      const resource = this.activeResources.get(resourceId)
      if (!resource) {
        throw new MockError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource ${resourceId} not found`,
          category: 'resource'
        })
      }

      await this.simulateDelay(100, 300)

      if (updates.metadata) {
        resource.metadata = { ...resource.metadata, ...updates.metadata }
      }

      if (updates.environment) {
        resource.config.environment = { ...resource.config.environment, ...updates.environment }
      }

      resource.updatedAt = new Date().toISOString()
      this.activeResources.set(resourceId, resource)
      this.resourceManager.updateResource(resourceId, updates)

      return {
        success: true,
        resource: {
          id: resource.id,
          status: resource.status,
          updatedAt: resource.updatedAt,
          metadata: resource.metadata
        }
      }
    } catch (error) {
      this.metrics.errors++
      if (error instanceof MockError) {
        throw error
      }
      throw new MockError({
        code: 'RESOURCE_UPDATE_FAILED',
        message: `Failed to update resource ${resourceId}: ${error.message}`,
        category: 'resource',
        details: { resourceId, updates, originalError: error }
      })
    }
  }

  /**
   * Delete a mock resource
   */
  async deleteResource(resourceId) {
    try {
      const resource = this.activeResources.get(resourceId)
      if (!resource) {
        return { success: true, message: 'Resource already deleted' }
      }

      await this.simulateDelay(200, 500)

      this.activeResources.delete(resourceId)
      this.metrics.destroyed++
      this.resourceManager.untrackResource(resourceId)

      return {
        success: true,
        resourceId,
        deletedAt: new Date().toISOString()
      }
    } catch (error) {
      this.metrics.errors++
      throw new MockError({
        code: 'RESOURCE_DELETION_FAILED',
        message: `Failed to delete resource ${resourceId}: ${error.message}`,
        category: 'resource',
        details: { resourceId, originalError: error }
      })
    }
  }

  /**
   * Get resource status
   */
  async getResourceStatus(resourceId) {
    try {
      const resource = this.activeResources.get(resourceId)
      if (!resource) {
        return {
          success: false,
          status: 'not_found',
          message: `Resource ${resourceId} not found`
        }
      }

      await this.simulateDelay(50, 150)

      return {
        success: true,
        resource: {
          id: resource.id,
          type: resource.type,
          provider: resource.provider,
          status: resource.status,
          template: resource.template,
          createdAt: resource.createdAt,
          lastChecked: new Date().toISOString(),
          metadata: resource.metadata
        }
      }
    } catch (error) {
      this.metrics.errors++
      throw new MockError({
        code: 'STATUS_CHECK_FAILED',
        message: `Failed to get status for resource ${resourceId}: ${error.message}`,
        category: 'resource',
        details: { resourceId, originalError: error }
      })
    }
  }

  /**
   * List all resources
   */
  async listResources() {
    try {
      await this.simulateDelay(100, 250)

      const resources = Array.from(this.activeResources.values()).map(resource => ({
        id: resource.id,
        type: resource.type,
        provider: resource.provider,
        status: resource.status,
        template: resource.template,
        createdAt: resource.createdAt,
        metadata: resource.metadata
      }))

      return {
        success: true,
        resources,
        total: resources.length,
        provider: 'mock'
      }
    } catch (error) {
      this.metrics.errors++
      throw new MockError({
        code: 'LIST_RESOURCES_FAILED',
        message: `Failed to list resources: ${error.message}`,
        category: 'resource',
        details: { originalError: error }
      })
    }
  }

  /**
   * Execute code in a mock sandbox
   */
  async executeAction(resourceId, action, parameters = {}) {
    try {
      const resource = this.activeResources.get(resourceId)
      if (!resource) {
        throw new MockError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource ${resourceId} not found`,
          category: 'resource'
        })
      }

      if (action !== 'execute') {
        throw new MockError({
          code: 'UNSUPPORTED_ACTION',
          message: `Action '${action}' not supported by Mock provider`,
          category: 'execution'
        })
      }

      const { code, language = 'javascript', timeout = 30000 } = parameters

      if (!code) {
        throw new MockError({
          code: 'MISSING_CODE',
          message: 'Code parameter is required for execution',
          category: 'execution'
        })
      }

      const startTime = Date.now()
      await this.simulateRandomFailure()
      
      // Simulate execution time
      const executionTime = Math.random() * 2000 + 500 // 500-2500ms
      await this.simulateDelay(executionTime, executionTime + 100)

      const endTime = Date.now()
      this.metrics.executed++
      this.metrics.totalExecutionTime += (endTime - startTime)

      // Mock execution results based on code content
      const result = this.simulateCodeExecution(code, language)

      const execution = {
        resourceId,
        action,
        language,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration: endTime - startTime,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        output: result.stdout,
        metadata: {
          provider: 'mock',
          template: resource.template,
          simulated: true
        }
      }

      this.resourceManager.logExecution(resourceId, execution)

      return {
        success: true,
        execution
      }
    } catch (error) {
      this.metrics.errors++
      if (error instanceof MockError) {
        throw error
      }
      throw new MockExecutionError({
        code: 'EXECUTION_FAILED',
        message: `Failed to execute code in resource ${resourceId}: ${error.message}`,
        category: 'execution',
        details: { resourceId, action, parameters, originalError: error }
      })
    }
  }

  /**
   * Get resource logs
   */
  async getResourceLogs(resourceId, options = {}) {
    try {
      const resource = this.activeResources.get(resourceId)
      if (!resource) {
        throw new MockError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource ${resourceId} not found`,
          category: 'resource'
        })
      }

      await this.simulateDelay(100, 200)

      const logs = this.resourceManager.getResourceLogs(resourceId, options)

      return {
        success: true,
        logs,
        resourceId,
        provider: 'mock'
      }
    } catch (error) {
      this.metrics.errors++
      throw new MockError({
        code: 'GET_LOGS_FAILED',
        message: `Failed to get logs for resource ${resourceId}: ${error.message}`,
        category: 'resource',
        details: { resourceId, options, originalError: error }
      })
    }
  }

  /**
   * Stream resource logs (mock implementation)
   */
  async streamResourceLogs(resourceId, callback) {
    try {
      const resource = this.activeResources.get(resourceId)
      if (!resource) {
        throw new MockError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource ${resourceId} not found`,
          category: 'resource'
        })
      }

      // Simulate streaming with intervals
      const streamInterval = setInterval(async () => {
        try {
          // Generate random log entries
          const logEntry = {
            timestamp: new Date().toISOString(),
            level: ['info', 'debug', 'warn'][Math.floor(Math.random() * 3)],
            message: `Mock log entry ${Date.now()}`,
            provider: 'mock'
          }
          callback(logEntry)
        } catch (error) {
          callback({ 
            type: 'error', 
            message: error.message, 
            timestamp: new Date().toISOString() 
          })
        }
      }, 2000)

      // Return cleanup function
      return () => clearInterval(streamInterval)
    } catch (error) {
      this.metrics.errors++
      throw new MockError({
        code: 'STREAM_LOGS_FAILED',
        message: `Failed to stream logs for resource ${resourceId}: ${error.message}`,
        category: 'resource',
        details: { resourceId, originalError: error }
      })
    }
  }

  /**
   * Get provider capabilities
   */
  async getCapabilities() {
    return {
      provider: 'mock',
      languages: ['javascript', 'typescript', 'python', 'bash', 'go', 'rust'],
      features: {
        filesystem: true,
        networking: true,
        persistentStorage: false,
        realTimeStreaming: true,
        packageInstallation: true,
        multiLanguage: true,
        simulation: true
      },
      limits: {
        maxExecutionTime: this.config.defaultTimeout,
        maxMemory: '4GB',
        maxCPU: 4,
        maxConcurrentSandboxes: this.config.maxConcurrent
      },
      security: {
        containerIsolation: true,
        networkIsolation: true,
        fileSystemIsolation: true,
        resourceLimits: true
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.simulateDelay(50, 150)
      
      // Simulate occasional health check failures
      if (Math.random() < 0.1) { // 10% failure rate
        throw new Error('Simulated health check failure')
      }

      return {
        success: true,
        provider: 'mock',
        status: 'healthy',
        checkedAt: new Date().toISOString(),
        metrics: this.metrics,
        activeResources: this.activeResources.size
      }
    } catch (error) {
      this.metrics.errors++
      return {
        success: false,
        provider: 'mock',
        status: 'unhealthy',
        error: error.message,
        checkedAt: new Date().toISOString(),
        metrics: this.metrics
      }
    }
  }

  /**
   * Get provider metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeResources: this.activeResources.size,
      provider: 'mock',
      averageExecutionTime: this.metrics.executed > 0 
        ? this.metrics.totalExecutionTime / this.metrics.executed 
        : 0
    }
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    const cleanupPromises = Array.from(this.activeResources.keys()).map(
      resourceId => this.deleteResource(resourceId).catch(error => 
        console.warn(`Failed to cleanup resource ${resourceId}:`, error.message)
      )
    )

    await Promise.all(cleanupPromises)
    this.activeResources.clear()

    return {
      success: true,
      cleanedUp: cleanupPromises.length,
      provider: 'mock'
    }
  }

  // Helper methods

  /**
   * Simulate network delay if enabled
   */
  async simulateDelay(min = 100, max = 500) {
    if (!this.config.simulateLatency) return
    
    const delay = Math.random() * (max - min) + min
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  /**
   * Simulate random failures based on failure rate
   */
  async simulateRandomFailure() {
    if (Math.random() < this.config.failureRate) {
      throw new MockConnectionError({
        code: 'SIMULATED_FAILURE',
        message: 'Simulated random failure for testing',
        category: 'connection'
      })
    }
  }

  /**
   * Simulate code execution with realistic outputs
   */
  simulateCodeExecution(code, language) {
    // Simple code analysis for realistic outputs
    if (code.includes('console.log') || code.includes('print')) {
      return {
        stdout: `Mock output for ${language} execution\nCode executed successfully\n`,
        stderr: '',
        exitCode: 0
      }
    }

    if (code.includes('error') || code.includes('throw')) {
      return {
        stdout: '',
        stderr: `Mock error: Simulated execution error\n`,
        exitCode: 1
      }
    }

    if (code.includes('import') || code.includes('require')) {
      return {
        stdout: `Dependencies loaded successfully\nExecution completed\n`,
        stderr: '',
        exitCode: 0
      }
    }

    return {
      stdout: `Mock execution result\nLanguage: ${language}\nExecution completed\n`,
      stderr: '',
      exitCode: 0
    }
  }
}

/**
 * Create Mock provider instance
 */
export function createMockProvider(config) {
  return new MockProvider(config)
}

/**
 * Provider factory for registry
 */
export const MockProviderFactory = {
  create: (config) => createMockProvider(config),
  capabilities: async () => {
    const provider = createMockProvider()
    return provider.getCapabilities()
  },
  healthCheck: async (config) => {
    const provider = createMockProvider(config)
    try {
      await provider.initialize()
      return await provider.healthCheck()
    } catch (error) {
      return {
        success: false,
        provider: 'mock',
        status: 'unhealthy',
        error: error.message
      }
    }
  }
} 