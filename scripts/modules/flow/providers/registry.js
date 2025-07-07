/**
 * @fileoverview Provider Registry
 * 
 * Manages registration, loading, and selection of sandbox providers.
 * Implements dynamic provider loading with configuration-driven selection.
 * Based on VibeKit patterns and Task Master Phase 7 architecture.
 * 
 * Key features:
 * - Factory-based provider instantiation
 * - Configuration validation
 * - Provider capabilities querying
 * - Health checking
 * - Fallback mechanisms
 */

/**
 * Built-in provider definitions
 * These are available by default based on VibeKit supported runtimes
 */
export const availableProviders = {
  mock: {
    name: "Mock Provider",
    type: "mock",
    factory: () => import("./mock/index.js").then(m => m.MockProviderFactory),
    config: {
      name: "mock",
      type: "mock",
      authentication: {
        type: "none",
        credentials: {}
      },
      features: ["testing", "development", "simulation", "multi-language"]
    },
    metadata: {
      description: "Mock provider for testing and development with realistic behavior simulation",
      stability: "stable",
      documentation: "Built-in mock provider supporting all languages for development"
    }
  },
  
  e2b: {
    name: "E2B Sandbox",
    type: "e2b", 
    factory: () => import("./e2b/index.js").then(m => m.E2BProviderFactory),
    config: {
      name: "e2b",
      type: "e2b",
      apiEndpoint: "https://api.e2b.dev",
      authentication: {
        type: "api_key",
        envKey: "E2B_API_KEY",
        credentials: {
          apiKey: process.env.E2B_API_KEY || ""
        }
      },
      features: ["code-execution", "filesystem", "networking", "ai-sandbox", "container-isolation"]
    },
    metadata: {
      description: "E2B AI-focused sandbox platform with container isolation",
      stability: "stable",
      documentation: "https://docs.e2b.dev"
    }
  },
  
  daytona: {
    name: "Daytona Workspaces",
    type: "daytona",
    factory: () => import("./daytona/index.js").then(m => m.DaytonaProviderFactory),
    config: {
      name: "daytona",
      type: "daytona",
      apiEndpoint: "https://api.daytona.io",
      authentication: {
        type: "api_key",
        envKey: "DAYTONA_API_KEY",
        credentials: {
          apiKey: process.env.DAYTONA_API_KEY || ""
        }
      },
      features: ["cloud-workspaces", "persistent-storage", "git-integration", "vscode-integration", "full-linux"]
    },
    metadata: {
      description: "Daytona cloud-based development environments with full Linux support",
      stability: "stable",
      documentation: "https://docs.daytona.io"
    }
  },
  
  modal: {
    name: "Modal Labs",
    type: "modal",
    factory: () => import("./modal/index.js").then(m => m.ModalProviderFactory),
    config: {
      name: "modal",
      type: "modal",
      apiEndpoint: "https://api.modal.com",
      authentication: {
        type: "api_key",
        envKey: "MODAL_API_KEY",
        credentials: {
          apiKey: process.env.MODAL_API_KEY || ""
        }
      },
      features: ["serverless", "gpu-compute", "auto-scaling", "persistent-storage", "high-performance"]
    },
    metadata: {
      description: "Modal serverless compute platform with GPU support and auto-scaling",
      stability: "stable", 
      documentation: "https://modal.com/docs"
    }
  },
  
  fly: {
    name: "Fly.io",
    type: "fly",
    factory: () => import("./fly/index.js").then(m => m.FlyProviderFactory),
    config: {
      name: "fly",
      type: "fly",
      apiEndpoint: "https://api.machines.dev",
      authentication: {
        type: "api_key",
        envKey: "FLY_API_TOKEN",
        credentials: {
          apiKey: process.env.FLY_API_TOKEN || ""
        }
      },
      features: ["global-edge", "microservices", "auto-scaling", "networking", "database-integration"]
    },
    metadata: {
      description: "Fly.io global edge compute platform with auto-scaling",
      stability: "stable",
      documentation: "https://fly.io/docs"
    }
  }
}

/**
 * Registry configuration
 */
export const registryConfig = {
  defaultProvider: "mock",
  fallbackProvider: "mock",
  enableFallback: true,
  healthCheckInterval: 30000, // 30 seconds
  providerTimeout: 10000,     // 10 seconds
  retryAttempts: 3
}

/**
 * Provider Registry Class
 * Manages provider instances and lifecycle
 */
export class ProviderRegistry {
  constructor() {
    this.loadedProviders = new Map()
    this.providerFactories = new Map()
    this.healthStatus = new Map()
    this.lastHealthCheck = new Map()
  }

  /**
   * Load provider factory
   */
  async loadProviderFactory(providerKey) {
    if (this.providerFactories.has(providerKey)) {
      return this.providerFactories.get(providerKey)
    }

    const providerDef = availableProviders[providerKey]
    if (!providerDef) {
      throw new Error(`Provider '${providerKey}' not found in registry`)
    }

    try {
      const factory = await providerDef.factory()
      this.providerFactories.set(providerKey, factory)
      return factory
    } catch (error) {
      throw new Error(`Failed to load provider '${providerKey}': ${error.message}`)
    }
  }

  /**
   * Create provider instance
   */
  async createProvider(providerKey, config = {}) {
    const factory = await this.loadProviderFactory(providerKey)
    const providerConfig = {
      ...availableProviders[providerKey].config,
      ...config
    }

    return factory.create(providerConfig)
  }

  /**
   * Get provider capabilities
   */
  async getProviderCapabilities(providerKey) {
    const factory = await this.loadProviderFactory(providerKey)
    return factory.capabilities()
  }

  /**
   * Check provider health
   */
  async checkProviderHealth(providerKey, config = {}) {
    try {
      const factory = await this.loadProviderFactory(providerKey)
      const healthResult = await factory.healthCheck(config)
      
      this.healthStatus.set(providerKey, healthResult)
      this.lastHealthCheck.set(providerKey, new Date().toISOString())
      
      return healthResult
    } catch (error) {
      const healthResult = {
        success: false,
        provider: providerKey,
        status: 'unhealthy',
        error: error.message,
        checkedAt: new Date().toISOString()
      }
      
      this.healthStatus.set(providerKey, healthResult)
      this.lastHealthCheck.set(providerKey, new Date().toISOString())
      
      return healthResult
    }
  }

  /**
   * List all available providers
   */
  getAvailableProviders() {
    return Object.keys(availableProviders).map(key => ({
      key,
      ...availableProviders[key],
      isLoaded: this.providerFactories.has(key),
      healthStatus: this.healthStatus.get(key),
      lastHealthCheck: this.lastHealthCheck.get(key)
    }))
  }

  /**
   * Get provider definition
   */
  getProviderDefinition(providerKey) {
    const providerDef = availableProviders[providerKey]
    if (!providerDef) {
      throw new Error(`Provider '${providerKey}' not found in registry`)
    }
    return providerDef
  }

  /**
   * Check if provider is available
   */
  isProviderAvailable(providerKey) {
    return providerKey in availableProviders
  }

  /**
   * Get provider authentication requirements
   */
  getProviderAuthRequirements(providerKey) {
    const providerDef = this.getProviderDefinition(providerKey)
    return providerDef.config.authentication
  }

  /**
   * Validate provider configuration
   */
  validateProviderConfig(providerKey, config) {
    const providerDef = this.getProviderDefinition(providerKey)
    const authConfig = providerDef.config.authentication
    
    const errors = []

    // Check authentication requirements
    if (authConfig.type === 'api_key') {
      const apiKey = config.apiKey || 
                   config.credentials?.apiKey || 
                   (authConfig.envKey ? process.env[authConfig.envKey] : null)
      
      if (!apiKey) {
        errors.push(`Missing API key for ${providerKey}. Set ${authConfig.envKey} environment variable or provide apiKey in config.`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    }
  }

  /**
   * Get provider configuration with defaults
   */
  getProviderConfig(providerKey, userConfig = {}) {
    const providerDef = this.getProviderDefinition(providerKey)
    
    return {
      ...providerDef.config,
      ...userConfig,
      provider: providerKey,
      type: providerDef.type
    }
  }

  /**
   * Check health of all providers
   */
  async checkAllProvidersHealth() {
    const results = []
    
    for (const providerKey of Object.keys(availableProviders)) {
      try {
        const health = await this.checkProviderHealth(providerKey)
        results.push({
          provider: providerKey,
          ...health
        })
      } catch (error) {
        results.push({
          provider: providerKey,
          success: false,
          status: 'error',
          error: error.message,
          checkedAt: new Date().toISOString()
        })
      }
    }
    
    return results
  }

  /**
   * Get recommended provider based on features
   */
  getRecommendedProvider(requiredFeatures = []) {
    if (requiredFeatures.length === 0) {
      return registryConfig.defaultProvider
    }

    for (const [key, providerDef] of Object.entries(availableProviders)) {
      const hasAllFeatures = requiredFeatures.every(feature =>
        providerDef.config.features.includes(feature)
      )
      
      if (hasAllFeatures) {
        return key
      }
    }

    return registryConfig.fallbackProvider
  }

  /**
   * Cleanup loaded providers
   */
  async cleanup() {
    this.loadedProviders.clear()
    this.providerFactories.clear()
    this.healthStatus.clear()
    this.lastHealthCheck.clear()
  }
}

/**
 * Global registry instance
 */
export const globalRegistry = new ProviderRegistry()

/**
 * Convenience functions
 */

/**
 * Get provider factory
 */
export async function getProviderFactory(providerKey) {
  return globalRegistry.loadProviderFactory(providerKey)
}

/**
 * Create provider instance
 */
export async function createProvider(providerKey, config = {}) {
  return globalRegistry.createProvider(providerKey, config)
}

/**
 * Get provider capabilities
 */
export async function getProviderCapabilities(providerKey) {
  return globalRegistry.getProviderCapabilities(providerKey)
}

/**
 * Check provider health
 */
export async function checkProviderHealth(providerKey, config = {}) {
  return globalRegistry.checkProviderHealth(providerKey, config)
}

/**
 * List all providers
 */
export function listAvailableProviders() {
  return globalRegistry.getAvailableProviders()
}

/**
 * Get provider configuration with validation
 */
export function getProviderConfigWithValidation(providerKey, userConfig = {}) {
  const config = globalRegistry.getProviderConfig(providerKey, userConfig)
  const validation = globalRegistry.validateProviderConfig(providerKey, config)
  
  return {
    config,
    validation
  }
} 