/**
 * @fileoverview Mock Provider Implementation
 * 
 * Provides a mock implementation of the SandboxProvider interface for testing
 * and development. Simulates realistic provider behaviors without external dependencies.
 */

import { Effect, Layer } from "effect"
import { 
  SandboxProvider, 
  SandboxProviderInterface,
  ResourceState,
  ProviderError,
  ResourceNotFoundError,
  createResourceStatus,
  createActionResult,
  createProviderCapabilities,
  createHealthStatus
} from "../provider.interface.js"

/**
 * In-memory storage for mock resources
 */
class MockResourceStore {
  constructor() {
    this.resources = new Map()
    this.actions = new Map()
    this.logs = new Map()
  }

  addResource(resource) {
    this.resources.set(resource.id, resource)
    this.addLog(resource.id, "info", `Resource ${resource.id} created`)
    return resource
  }

  getResource(id) {
    return this.resources.get(id)
  }

  updateResource(id, updates) {
    const existing = this.resources.get(id)
    if (!existing) return null
    
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() }
    this.resources.set(id, updated)
    this.addLog(id, "info", `Resource ${id} updated`)
    return updated
  }

  deleteResource(id) {
    const resource = this.resources.get(id)
    if (!resource) return false
    
    this.resources.delete(id)
    this.logs.delete(id)
    this.actions.delete(id)
    return true
  }

  listResources() {
    return Array.from(this.resources.values())
  }

  addAction(resourceId, action, result) {
    if (!this.actions.has(resourceId)) {
      this.actions.set(resourceId, [])
    }
    this.actions.get(resourceId).push({
      action,
      result,
      timestamp: new Date().toISOString()
    })
  }

  addLog(resourceId, level, message) {
    if (!this.logs.has(resourceId)) {
      this.logs.set(resourceId, [])
    }
    this.logs.get(resourceId).push({
      timestamp: new Date().toISOString(),
      level,
      message
    })
  }

  getResourceLogs(resourceId) {
    return this.logs.get(resourceId) || []
  }
}

// Global store instance for the mock provider
const mockStore = new MockResourceStore()

/**
 * Mock Provider Implementation
 */
export const MockProvider = {
  ...SandboxProviderInterface,

  /**
   * Create a new mock resource
   */
  createResource: (config) => Effect.gen(function* () {
    const resource = createResourceStatus({
      id: `mock-${Date.now()}`,
      state: ResourceState.CREATING,
      health: "unknown",
      config
    })

    // Simulate async creation
    yield* Effect.sleep("100 millis")
    
    const finalResource = mockStore.addResource({
      ...resource,
      state: ResourceState.RUNNING,
      health: "healthy"
    })

    return finalResource
  }),

  /**
   * Update an existing mock resource
   */
  updateResource: (resourceId, updates) => Effect.gen(function* () {
    const resource = mockStore.getResource(resourceId)
    if (!resource) {
      yield* Effect.fail(new ResourceNotFoundError(resourceId, "mock"))
    }

    const updatedResource = mockStore.updateResource(resourceId, updates)
    return updatedResource
  }),

  /**
   * Delete a mock resource
   */
  deleteResource: (resourceId) => Effect.gen(function* () {
    const success = mockStore.deleteResource(resourceId)
    if (!success) {
      yield* Effect.fail(new ResourceNotFoundError(resourceId, "mock"))
    }

    return createActionResult(true, `Resource ${resourceId} deleted`)
  }),

  /**
   * Get mock resource status
   */
  getResourceStatus: (resourceId) => Effect.gen(function* () {
    const resource = mockStore.getResource(resourceId)
    if (!resource) {
      yield* Effect.fail(new ResourceNotFoundError(resourceId, "mock"))
    }

    return resource
  }),

  /**
   * List all mock resources
   */
  listResources: () => Effect.succeed(mockStore.listResources()),

  /**
   * Execute action on mock resource
   */
  executeAction: (resourceId, action, parameters = {}) => Effect.gen(function* () {
    const resource = mockStore.getResource(resourceId)
    if (!resource) {
      yield* Effect.fail(new ResourceNotFoundError(resourceId, "mock"))
    }

    // Simulate different actions
    let message = `Executed ${action} on ${resourceId}`
    let newState = resource.state

    switch (action) {
      case "start":
        if (resource.state === ResourceState.STOPPED) {
          newState = ResourceState.RUNNING
          message = `Started resource ${resourceId}`
        }
        break
      case "stop":
        if (resource.state === ResourceState.RUNNING) {
          newState = ResourceState.STOPPED
          message = `Stopped resource ${resourceId}`
        }
        break
      case "restart":
        newState = ResourceState.RUNNING
        message = `Restarted resource ${resourceId}`
        break
      case "scale": {
        const replicas = parameters.replicas || 1
        message = `Scaled resource ${resourceId} to ${replicas} replicas`
        break
      }
      default:
        message = `Executed custom action '${action}' on ${resourceId}`
    }

    // Update resource state if it changed
    if (newState !== resource.state) {
      mockStore.updateResource(resourceId, { state: newState })
    }

    const result = createActionResult(true, message, { action, parameters })
    mockStore.addAction(resourceId, action, result)
    mockStore.addLog(resourceId, "info", message)

    return result
  }),

  /**
   * Get mock provider capabilities
   */
  getCapabilities: () => Effect.succeed(createProviderCapabilities({
    name: "Mock Provider",
    supportedActions: ["create", "delete", "start", "stop", "restart", "scale"],
    maxCpu: 16,
    maxMemory: 32768,
    maxStorage: 100000,
    networking: {
      externalAccess: true,
      ipWhitelisting: false
    },
    security: {
      tlsSupport: true,
      secretsManagement: false
    },
    regions: ["mock-region-1", "mock-region-2"],
    features: ["basic-operations", "resource-lifecycle", "action-simulation"]
  })),

  /**
   * Mock provider health check
   */
  healthCheck: () => Effect.gen(function* () {
    // Simulate some latency
    yield* Effect.sleep("50 millis")
    
    return createHealthStatus("healthy", 50)
  }),

  /**
   * Get mock resource logs
   */
  getResourceLogs: (resourceId, options = {}) => Effect.gen(function* () {
    const resource = mockStore.getResource(resourceId)
    if (!resource) {
      yield* Effect.fail(new ResourceNotFoundError(resourceId, "mock"))
    }

    const logs = mockStore.getResourceLogs(resourceId)
    
    return {
      logs,
      hasMore: false,
      nextToken: null
    }
  }),

  /**
   * Stream mock resource logs (simplified)
   */
  streamResourceLogs: (resourceId, callback) => Effect.gen(function* () {
    const resource = mockStore.getResource(resourceId)
    if (!resource) {
      yield* Effect.fail(new ResourceNotFoundError(resourceId, "mock"))
    }

    // Mock streaming by calling callback with existing logs
    const logs = mockStore.getResourceLogs(resourceId)
    logs.forEach(callback)

    // Return cleanup function
    return () => {
      // No cleanup needed for mock
    }
  })
}

/**
 * Create a Layer that provides the MockProvider
 */
export const MockProviderLive = Layer.succeed(SandboxProvider, MockProvider) 