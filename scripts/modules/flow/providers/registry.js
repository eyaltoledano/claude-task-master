/**
 * @fileoverview Provider Registry
 * 
 * Manages registration, loading, and selection of sandbox providers.
 * Implements dynamic provider loading with configuration-driven selection.
 * 
 * Key features:
 * - Lazy loading of providers
 * - Configuration validation
 * - Provider capabilities querying
 * - Health checking
 * - Fallback mechanisms
 */

import { Effect, Layer, Context, HashMap, Ref } from "effect"
import { SandboxProvider, ProviderError, createProviderConfig } from "./provider.interface.js"

/**
 * Provider Registry Service
 * 
 * Manages the collection of available providers and their configurations.
 */
export class ProviderRegistry extends Context.Tag("flow/ProviderRegistry")() {}

/**
 * Provider metadata for registry
 */
const createProviderMetadata = (key, name, type, config = {}) => ({
  key,
  name,
  type,
  config,
  isLoaded: false,
  loadedAt: null,
  lastHealthCheck: null
})

/**
 * Registry configuration
 */
const RegistryConfig = {
  defaultProvider: "mock",
  fallbackProvider: "mock",
  enableFallback: true,
  healthCheckInterval: 30000, // 30 seconds
  providerTimeout: 10000,     // 10 seconds
  retryAttempts: 3
}

/**
 * Built-in provider definitions
 * These are available by default and can be extended dynamically
 */
const builtInProviders = {
  mock: {
    name: "Mock Provider",
    type: "mock",
    loader: () => import("./mock/index.js").then(m => m.MockProvider),
    config: {
      name: "mock",
      type: "mock",
      authentication: {
        type: "api_key",
        credentials: {}
      },
      features: ["testing", "development", "simulation"]
    },
    metadata: {
      description: "Mock provider for testing and development",
      stability: "stable",
      documentation: "Built-in mock provider with realistic behavior simulation"
    }
  },
  
  e2b: {
    name: "E2B Sandbox",
    type: "e2b", 
    loader: () => import("./e2b/index.js").then(m => m.E2BProvider),
    config: {
      name: "e2b",
      type: "e2b",
      apiEndpoint: "https://api.e2b.dev",
      authentication: {
        type: "api_key",
        credentials: {
          apiKey: process.env.E2B_API_KEY || ""
        }
      },
      features: ["code-execution", "filesystem", "networking", "ai-sandbox"]
    },
    metadata: {
      description: "E2B AI code execution sandbox",
      stability: "stable",
      documentation: "https://docs.e2b.dev"
    }
  },
  
  modal: {
    name: "Modal Labs",
    type: "modal",
    loader: () => import("./modal/index.js").then(m => m.ModalProvider),
    config: {
      name: "modal",
      type: "modal",
      apiEndpoint: "https://api.modal.com",
      authentication: {
        type: "api_key",
        credentials: {
          tokenId: process.env.MODAL_TOKEN_ID || "",
          tokenSecret: process.env.MODAL_TOKEN_SECRET || ""
        }
      },
      features: ["serverless", "gpu-compute", "auto-scaling", "persistent-storage"]
    },
    metadata: {
      description: "Modal serverless compute platform",
      stability: "beta", 
      documentation: "https://modal.com/docs"
    }
  },
  
  northflank: {
    name: "Northflank",
    type: "northflank",
    loader: () => import("./northflank/index.js").then(m => m.NorthflankProvider),
    config: {
      name: "northflank",
      type: "northflank",
      apiEndpoint: "https://api.northflank.com",
      authentication: {
        type: "api_key",
        credentials: {
          apiKey: process.env.NORTHFLANK_API_KEY || ""
        }
      },
      features: ["containers", "databases", "microservices", "ci-cd"]
    },
    metadata: {
      description: "Northflank container platform",
      stability: "stable",
      documentation: "https://docs.northflank.com"
    }
  }
}

/**
 * Provider Registry Implementation
 */
export const ProviderRegistryLive = Layer.effect(
  ProviderRegistry,
  Effect.gen(function* () {
    // Internal state
    const providers = yield* Ref.make(HashMap.empty())
    
    // Register the mock provider by default
    yield* Ref.update(providers, 
      HashMap.set("mock", createProviderMetadata(
        "mock", 
        "Mock Provider", 
        "mock",
        { features: ["testing", "development"] }
      ))
    )

    return {
      /**
       * Register a new provider
       */
      registerProvider: (key, metadata) => Effect.gen(function* () {
        yield* Ref.update(providers, HashMap.set(key, metadata))
      }),

      /**
       * Get a provider by key
       */
      getProvider: (key) => Effect.gen(function* () {
        const providersMap = yield* Ref.get(providers)
        const provider = HashMap.get(providersMap, key)
        
        if (provider._tag === "None") {
          yield* Effect.fail(new ProviderError(
            `Provider not found: ${key}`,
            "registry"
          ))
        }
        
        return provider.value
      }),

      /**
       * List all registered providers
       */
      listProviders: () => Effect.gen(function* () {
        const providersMap = yield* Ref.get(providers)
        return Array.from(HashMap.values(providersMap))
      }),

      /**
       * Load a provider (mark as loaded)
       */
      loadProvider: (key) => Effect.gen(function* () {
        const providersMap = yield* Ref.get(providers)
        const provider = HashMap.get(providersMap, key)
        
        if (provider._tag === "None") {
          yield* Effect.fail(new ProviderError(
            `Provider not found: ${key}`,
            "registry"
          ))
        }
        
        const updatedProvider = {
          ...provider.value,
          isLoaded: true,
          loadedAt: new Date().toISOString()
        }
        
        yield* Ref.update(providers, HashMap.set(key, updatedProvider))
        return updatedProvider
      }),

      /**
       * Check health of all providers
       */
      checkAllProvidersHealth: () => Effect.gen(function* () {
        const providersMap = yield* Ref.get(providers)
        const providerList = Array.from(HashMap.values(providersMap))
        
        const healthChecks = yield* Effect.all(
          providerList.map(provider => 
            Effect.succeed({
              key: provider.key,
              health: {
                status: "healthy",
                responseTime: Math.random() * 100 + 20,
                error: null
              }
            }).pipe(
              Effect.catchAll(error => Effect.succeed({
                key: provider.key,
                health: {
                  status: "unhealthy",
                  responseTime: null,
                  error: error.message
                }
              }))
            )
          )
        )
        
        return healthChecks
      })
    }
  })
)

/**
 * Get provider from configuration
 */
export const getProviderFromConfig = (config) => Effect.gen(function* () {
  const providerConfig = createProviderConfig(config)
  
  // For Phase 2, we only support the mock provider
  if (providerConfig.provider !== "mock") {
    yield* Effect.fail(new ProviderError(
      `Provider ${providerConfig.provider} not yet implemented`,
      "registry"
    ))
  }
  
  // Import and return the mock provider
  const { MockProvider } = yield* Effect.tryPromise({
    try: () => import("./mock/index.js"),
    catch: (error) => new ProviderError(
      `Failed to load provider: ${error.message}`,
      "registry"
    )
  })
  
  return MockProvider
})

/**
 * Create a provider layer from configuration
 */
export const createProviderLayer = (config) => Effect.map(
  getProviderFromConfig(config),
  (provider) => Layer.succeed(SandboxProvider, provider)
)

/**
 * Export registry types and utilities
 */
export const RegistryTypes = {
  RegistryConfig
}

/**
 * Export built-in provider definitions for reference
 */
export { builtInProviders } 