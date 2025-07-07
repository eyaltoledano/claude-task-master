/**
 * @fileoverview Provider Interface for Sandbox Execution Environments
 * 
 * Simplified interface for Phase 2 - Provider Abstraction Layer
 * Avoids Effect Schema complexity while providing the core abstractions needed
 */

import { Effect, Context } from "effect"

// Provider interface tag for Effect Context system
export class SandboxProvider extends Context.Tag("flow/SandboxProvider")() {}

/**
 * Simple helper functions for creating typed configurations
 */

export const createResourceConfig = (options = {}) => ({
  type: options.type || "container",
  resources: {
    cpu: options.resources?.cpu || 1,
    memory: options.resources?.memory || 1024,
    storage: options.resources?.storage || 5000,
    ...options.resources
  },
  networking: {
    externalAccess: options.networking?.externalAccess ?? true,
    ports: options.networking?.ports || [],
    allowedDomains: options.networking?.allowedDomains || [],
    blockedDomains: options.networking?.blockedDomains || [],
    ...options.networking
  },
  security: {
    allowedSyscalls: options.security?.allowedSyscalls || [],
    blockedSyscalls: options.security?.blockedSyscalls || [],
    droppedCapabilities: options.security?.droppedCapabilities || [],
    enableTLS: options.security?.enableTLS ?? true,
    ...options.security
  },
  environment: options.environment || {},
  secrets: options.secrets || {},
  tags: options.tags || {},
})

export const createProviderConfig = (options = {}) => ({
  provider: options.provider || "mock",
  type: options.type || "mock",
  region: options.region || "default",
  credentials: options.credentials || {},
  features: options.features || [],
  limits: {
    maxCpu: options.limits?.maxCpu || 16,
    maxMemory: options.limits?.maxMemory || 32768,
    maxStorage: options.limits?.maxStorage || 100000,
    maxInstances: options.limits?.maxInstances || 10,
    ...options.limits
  },
})

export const createResourceStatus = (options = {}) => ({
  id: options.id || `resource-${Date.now()}`,
  state: options.state || "creating",
  health: options.health || "unknown",
  createdAt: options.createdAt || new Date().toISOString(),
  updatedAt: options.updatedAt || new Date().toISOString(),
  config: options.config || null,
  metrics: options.metrics || null,
  error: options.error || null,
  endpoints: options.endpoints || [],
})

/**
 * Resource state constants
 */
export const ResourceState = {
  CREATING: "creating",
  STARTING: "starting", 
  RUNNING: "running",
  STOPPING: "stopping",
  STOPPED: "stopped",
  ERROR: "error",
  DESTROYED: "destroyed"
}

/**
 * Provider-specific error types using plain JavaScript classes
 */
export class ProviderError extends Error {
  constructor(message, provider, resourceId = null, code = null, retryable = false) {
    super(message)
    this.name = "ProviderError"
    this.provider = provider
    this.resourceId = resourceId
    this.code = code
    this.retryable = retryable
  }
}

export class ResourceNotFoundError extends Error {
  constructor(resourceId, provider) {
    super(`Resource ${resourceId} not found in provider ${provider}`)
    this.name = "ResourceNotFoundError"
    this.resourceId = resourceId
    this.provider = provider
  }
}

export class QuotaExceededError extends Error {
  constructor(resource, current, limit, provider) {
    super(`Quota exceeded for ${resource}: ${current}/${limit} in provider ${provider}`)
    this.name = "QuotaExceededError"
    this.resource = resource
    this.current = current
    this.limit = limit
    this.provider = provider
  }
}

/**
 * Provider capabilities definition
 */
export const createProviderCapabilities = (options = {}) => ({
  name: options.name || "Unknown Provider",
  supportedActions: options.supportedActions || ["create", "delete", "start", "stop"],
  maxCpu: options.maxCpu || 16,
  maxMemory: options.maxMemory || 32768,
  maxStorage: options.maxStorage || 100000,
  networking: {
    externalAccess: options.networking?.externalAccess ?? true,
    ipWhitelisting: options.networking?.ipWhitelisting ?? false,
    ...options.networking
  },
  security: {
    tlsSupport: options.security?.tlsSupport ?? true,
    secretsManagement: options.security?.secretsManagement ?? false,
    ...options.security
  },
  regions: options.regions || ["default"],
  features: options.features || [],
})

/**
 * Provider health status
 */
export const createHealthStatus = (status = "unknown", responseTime = null, error = null) => ({
  status, // "healthy", "degraded", "unhealthy", "unknown"
  responseTime,
  error,
  timestamp: new Date().toISOString()
})

/**
 * Provider action result
 */
export const createActionResult = (success = true, message = "", data = null) => ({
  success,
  message,
  data,
  timestamp: new Date().toISOString()
})

/**
 * Sandbox Provider Interface
 * 
 * This defines the contract that all providers must implement
 */
export const SandboxProviderInterface = {
  /**
   * Create a new resource (sandbox, container, service, etc.)
   */
  createResource: (config) => Effect.succeed(createResourceStatus({
    id: `mock-${Date.now()}`,
    state: ResourceState.CREATING,
    health: "unknown",
    config
  })),

  /**
   * Update an existing resource configuration
   */
  updateResource: (resourceId, updates) => Effect.succeed(createResourceStatus({
    id: resourceId,
    state: ResourceState.RUNNING,
    health: "healthy",
    config: updates
  })),

  /**
   * Delete a resource
   */
  deleteResource: (resourceId) => Effect.succeed(createActionResult(true, `Resource ${resourceId} deleted`)),

  /**
   * Get current resource status
   */
  getResourceStatus: (resourceId) => Effect.succeed(createResourceStatus({
    id: resourceId,
    state: ResourceState.RUNNING,
    health: "healthy"
  })),

  /**
   * List all resources
   */
  listResources: () => Effect.succeed([]),

  /**
   * Execute an action on a resource
   */
  executeAction: (resourceId, action, parameters = {}) => Effect.succeed(createActionResult(true, `Executed ${action} on ${resourceId}`)),

  /**
   * Get provider capabilities
   */
  getCapabilities: () => Effect.succeed(createProviderCapabilities()),

  /**
   * Health check for the provider
   */
  healthCheck: () => Effect.succeed(createHealthStatus("healthy", 100)),

  /**
   * Get resource logs
   */
  getResourceLogs: (resourceId, options = {}) => Effect.succeed({
    logs: [],
    hasMore: false,
    nextToken: null
  }),

  /**
   * Stream resource logs
   */
  streamResourceLogs: (resourceId, callback) => Effect.succeed(() => {}) // Cleanup function
} 