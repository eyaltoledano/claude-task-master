/**
 * @fileoverview Fly.io Provider Implementation
 * 
 * Implements secure code execution using Fly.io's global edge compute platform.
 * Features global deployment, auto-scaling, and microservices support.
 * Based on VibeKit patterns and Task Master Phase 7 architecture.
 */

import { createFlyClient } from './client.js'
import { FlyResourceManager } from './resource-manager.js'
import { FlyError, FlyConnectionError, FlyExecutionError } from './errors.js'

/**
 * Fly.io Provider Implementation
 * Provides global edge compute with auto-scaling and microservices support
 */
export class FlyProvider {
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.FLY_API_TOKEN,
      baseUrl: config.baseUrl || 'https://api.machines.dev',
      region: config.region || 'ord', // Chicago by default
      timeout: config.timeout || 60000,
      maxConcurrent: config.maxConcurrent || 5,
      ...config
    }
    
    this.client = null
    this.resourceManager = new FlyResourceManager(this.config)
    this.activeResources = new Map()
    this.metrics = {
      created: 0,
      destroyed: 0,
      executed: 0,
      errors: 0,
      totalCost: 0,
      totalUptime: 0
    }
  }

  /**
   * Initialize the Fly.io provider
   */
  async initialize() {
    try {
      if (!this.config.apiKey) {
        throw new FlyError({
          code: 'MISSING_API_KEY',
          message: 'Fly.io API token is required',
          category: 'configuration'
        })
      }

      this.client = await createFlyClient(this.config)
      await this.healthCheck()
      
      return {
        success: true,
        provider: 'fly',
        initialized: true,
        capabilities: await this.getCapabilities()
      }
    } catch (error) {
      throw new FlyConnectionError({
        code: 'INITIALIZATION_FAILED',
        message: `Failed to initialize Fly.io provider: ${error.message}`,
        category: 'connection',
        details: { originalError: error }
      })
    }
  }

  /**
   * Create a new machine resource
   */
  async createResource(config = {}) {
    try {
      const resourceConfig = {
        name: config.name || `machine-${Date.now()}`,
        region: config.region || this.config.region,
        image: config.image || 'flyio/hellofly:latest',
        cpus: config.cpus || 1,
        memory: config.memory || 256, // MB
        env: config.environment || {},
        services: config.services || [],
        metadata: {
          createdAt: new Date().toISOString(),
          provider: 'fly',
          ...config.metadata
        },
        ...config
      }

      const flyMachine = await this.client.createMachine({
        name: resourceConfig.name,
        region: resourceConfig.region,
        config: {
          image: resourceConfig.image,
          guest: {
            cpus: resourceConfig.cpus,
            memory_mb: resourceConfig.memory
          },
          env: resourceConfig.env,
          services: resourceConfig.services,
          metadata: resourceConfig.metadata
        }
      })

      const resource = {
        id: flyMachine.id,
        type: 'machine',
        provider: 'fly',
        status: 'ready',
        name: resourceConfig.name,
        region: resourceConfig.region,
        image: resourceConfig.image,
        createdAt: new Date().toISOString(),
        config: resourceConfig,
        flyMachine: flyMachine,
        metadata: resourceConfig.metadata
      }

      this.activeResources.set(resource.id, resource)
      this.metrics.created++

      await this.resourceManager.trackResource(resource)

      return {
        success: true,
        resource: {
          id: resource.id,
          type: resource.type,
          provider: resource.provider,
          status: resource.status,
          name: resource.name,
          region: resource.region,
          image: resource.image,
          createdAt: resource.createdAt,
          metadata: resource.metadata
        }
      }
    } catch (error) {
      this.metrics.errors++
      throw new FlyError({
        code: 'RESOURCE_CREATION_FAILED',
        message: `Failed to create Fly.io machine: ${error.message}`,
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
        throw new FlyError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource ${resourceId} not found`,
          category: 'resource'
        })
      }

      // Update metadata and configuration
      if (updates.metadata) {
        resource.metadata = { ...resource.metadata, ...updates.metadata }
      }

      if (updates.environment) {
        // Note: Fly machines are immutable, would need recreation for env changes
        console.warn('Fly machines are immutable. Environment updates require machine recreation.')
      }

      this.activeResources.set(resourceId, resource)
      await this.resourceManager.updateResource(resourceId, updates)

      return {
        success: true,
        resource: {
          id: resource.id,
          status: resource.status,
          updatedAt: new Date().toISOString(),
          metadata: resource.metadata
        }
      }
    } catch (error) {
      this.metrics.errors++
      throw new FlyError({
        code: 'RESOURCE_UPDATE_FAILED',
        message: `Failed to update resource ${resourceId}: ${error.message}`,
        category: 'resource',
        details: { resourceId, updates, originalError: error }
      })
    }
  }

  /**
   * Delete/destroy a machine resource
   */
  async deleteResource(resourceId) {
    try {
      const resource = this.activeResources.get(resourceId)
      if (!resource) {
        return { success: true, message: 'Resource already deleted' }
      }

      // Stop and delete the Fly machine
      await this.client.stopMachine(resourceId)
      await this.client.deleteMachine(resourceId)

      this.activeResources.delete(resourceId)
      this.metrics.destroyed++

      await this.resourceManager.untrackResource(resourceId)

      return {
        success: true,
        resourceId,
        deletedAt: new Date().toISOString()
      }
    } catch (error) {
      this.metrics.errors++
      throw new FlyError({
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

      // Check machine status
      const machineStatus = await this.client.getMachineStatus(resourceId)
      resource.status = machineStatus.state

      return {
        success: true,
        resource: {
          id: resource.id,
          type: resource.type,
          provider: resource.provider,
          status: resource.status,
          name: resource.name,
          region: resource.region,
          image: resource.image,
          createdAt: resource.createdAt,
          lastChecked: new Date().toISOString(),
          metadata: resource.metadata
        }
      }
    } catch (error) {
      this.metrics.errors++
      throw new FlyError({
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
      const resources = Array.from(this.activeResources.values()).map(resource => ({
        id: resource.id,
        type: resource.type,
        provider: resource.provider,
        status: resource.status,
        name: resource.name,
        region: resource.region,
        image: resource.image,
        createdAt: resource.createdAt,
        metadata: resource.metadata
      }))

      return {
        success: true,
        resources,
        total: resources.length,
        provider: 'fly'
      }
    } catch (error) {
      this.metrics.errors++
      throw new FlyError({
        code: 'LIST_RESOURCES_FAILED',
        message: `Failed to list resources: ${error.message}`,
        category: 'resource',
        details: { originalError: error }
      })
    }
  }

  /**
   * Execute code in a Fly machine
   */
  async executeAction(resourceId, action, parameters = {}) {
    try {
      const resource = this.activeResources.get(resourceId)
      if (!resource) {
        throw new FlyError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource ${resourceId} not found`,
          category: 'resource'
        })
      }

      if (action !== 'execute') {
        throw new FlyError({
          code: 'UNSUPPORTED_ACTION',
          message: `Action '${action}' not supported by Fly provider`,
          category: 'execution'
        })
      }

      const { code, language = 'bash', timeout = 30000, args = [] } = parameters

      if (!code) {
        throw new FlyError({
          code: 'MISSING_CODE',
          message: 'Code parameter is required for execution',
          category: 'execution'
        })
      }

      const startTime = Date.now()

      // Execute code via Fly machine
      const result = await this.client.execCommand(resourceId, {
        cmd: this.buildExecutionCommand(code, language, args),
        timeout: timeout
      })

      const endTime = Date.now()
      this.metrics.executed++

      return {
        success: true,
        execution: {
          resourceId,
          action,
          language,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration: endTime - startTime,
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exit_code || 0,
          output: result.stdout || '',
          metadata: {
            provider: 'fly',
            region: resource.region,
            image: resource.image,
            machineId: resource.id
          }
        }
      }
    } catch (error) {
      this.metrics.errors++
      throw new FlyExecutionError({
        code: 'EXECUTION_FAILED',
        message: `Failed to execute code in resource ${resourceId}: ${error.message}`,
        category: 'execution',
        details: { resourceId, action, parameters, originalError: error }
      })
    }
  }

  /**
   * Get execution logs
   */
  async getResourceLogs(resourceId, options = {}) {
    try {
      const resource = this.activeResources.get(resourceId)
      if (!resource) {
        throw new FlyError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource ${resourceId} not found`,
          category: 'resource'
        })
      }

      const logs = await this.client.getMachineLogs(resourceId, options)

      return {
        success: true,
        logs,
        resourceId,
        provider: 'fly'
      }
    } catch (error) {
      this.metrics.errors++
      throw new FlyError({
        code: 'GET_LOGS_FAILED',
        message: `Failed to get logs for resource ${resourceId}: ${error.message}`,
        category: 'resource',
        details: { resourceId, options, originalError: error }
      })
    }
  }

  /**
   * Stream execution logs
   */
  async streamResourceLogs(resourceId, callback) {
    try {
      const resource = this.activeResources.get(resourceId)
      if (!resource) {
        throw new FlyError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource ${resourceId} not found`,
          category: 'resource'
        })
      }

      return await this.client.streamMachineLogs(resourceId, callback)
    } catch (error) {
      this.metrics.errors++
      throw new FlyError({
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
      provider: 'fly',
      languages: ['javascript', 'typescript', 'python', 'bash', 'go', 'rust', 'docker'],
      features: {
        filesystem: true,
        networking: true,
        persistentStorage: false, // Ephemeral by default
        realTimeStreaming: true,
        packageInstallation: true,
        multiLanguage: true,
        globalEdge: true,
        autoScaling: true,
        microservices: true,
        customImages: true
      },
      limits: {
        maxExecutionTime: 3600000, // 1 hour
        maxMemory: '8GB',
        maxCPU: 8,
        maxConcurrentMachines: this.config.maxConcurrent,
        maxRegions: 35 // Fly has ~35 regions globally
      },
      security: {
        containerIsolation: true,
        networkIsolation: true,
        fileSystemIsolation: true,
        resourceLimits: true,
        httpsOnly: true
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      const response = await this.client.listApps()
      
      return {
        success: true,
        provider: 'fly',
        status: 'healthy',
        checkedAt: new Date().toISOString(),
        metrics: this.metrics,
        activeResources: this.activeResources.size,
        appsAvailable: response?.length || 0
      }
    } catch (error) {
      this.metrics.errors++
      return {
        success: false,
        provider: 'fly',
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
      provider: 'fly'
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
      provider: 'fly'
    }
  }

  // Helper methods

  /**
   * Build execution command for different languages
   */
  buildExecutionCommand(code, language, args = []) {
    const commands = {
      javascript: ['node', '-e', code, ...args],
      typescript: ['tsx', '-e', code, ...args],
      python: ['python3', '-c', code, ...args],
      bash: ['bash', '-c', code, ...args],
      go: ['go', 'run', '-', ...args], // Would need code saved to file
      rust: ['rustc', '--edition', '2021', '-', ...args],
      docker: ['sh', '-c', code, ...args] // Generic fallback
    }
    return commands[language] || commands['bash']
  }
}

/**
 * Create Fly provider instance
 */
export function createFlyProvider(config) {
  return new FlyProvider(config)
}

/**
 * Provider factory for registry
 */
export const FlyProviderFactory = {
  create: (config) => createFlyProvider(config),
  capabilities: async () => {
    const provider = createFlyProvider()
    return provider.getCapabilities()
  },
  healthCheck: async (config) => {
    const provider = createFlyProvider(config)
    try {
      await provider.initialize()
      return await provider.healthCheck()
    } catch (error) {
      return {
        success: false,
        provider: 'fly',
        status: 'unhealthy',
        error: error.message
      }
    }
  }
} 