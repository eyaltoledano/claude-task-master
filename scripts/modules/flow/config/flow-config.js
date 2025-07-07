/**
 * @fileoverview Flow Configuration Management
 * 
 * Implements modern configuration management with environment validation,
 * secure defaults, and extensible configuration patterns for the Flow module.
 */

import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

/**
 * Configuration schema with validation and defaults
 */
const FlowConfigSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // Providers
  defaultProvider: z.enum(['mock', 'e2b', 'daytona', 'modal', 'fly']).default('mock'),
  providerTimeout: z.number().min(1000).max(300000).default(30000), // 30 seconds
  
  // Agents  
  defaultAgent: z.enum(['mock', 'claude', 'gpt', 'gemini']).default('mock'),
  agentTimeout: z.number().min(1000).max(120000).default(60000), // 60 seconds
  agentMaxRetries: z.number().min(0).max(10).default(3),
  
  // Execution
  executionTimeout: z.number().min(1000).max(3600000).default(300000), // 5 minutes
  maxConcurrentExecutions: z.number().min(1).max(100).default(10),
  cleanupOnExit: z.boolean().default(true),
  
  // Streaming
  streamingEnabled: z.boolean().default(true),
  streamingBatchSize: z.number().min(1).max(1000).default(100),
  streamingFlushInterval: z.number().min(100).max(10000).default(1000),
  
  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  logFormat: z.enum(['json', 'simple', 'detailed']).default('simple'),
  logToFile: z.boolean().default(false),
  logFilePath: z.string().default('.taskmaster/flow/logs/flow.log'),
  
  // Error Handling
  enableRetries: z.boolean().default(true),
  retryBackoffFactor: z.number().min(1).max(10).default(2),
  retryMaxDelay: z.number().min(1000).max(60000).default(30000),
  enableCircuitBreaker: z.boolean().default(true),
  circuitBreakerThreshold: z.number().min(1).max(100).default(10),
  
  // Health Monitoring
  healthCheckInterval: z.number().min(5000).max(300000).default(60000), // 1 minute
  healthCheckTimeout: z.number().min(1000).max(30000).default(5000),
  
  // Storage
  dataDirectory: z.string().default('.taskmaster/flow/data'),
  stateDirectory: z.string().default('.taskmaster/flow/state'),
  cacheEnabled: z.boolean().default(true),
  cacheTtl: z.number().min(60).max(86400).default(3600), // 1 hour
  
  // Security
  enableTelemetry: z.boolean().default(false),
  telemetryEndpoint: z.string().url().optional(),
  
  // Development
  debugMode: z.boolean().default(false),
  verboseLogging: z.boolean().default(false),
  mockDelays: z.boolean().default(true)
})

/**
 * Environment variable mappings
 */
const ENV_MAPPINGS = {
  NODE_ENV: 'nodeEnv',
  FLOW_DEFAULT_PROVIDER: 'defaultProvider',
  FLOW_PROVIDER_TIMEOUT: 'providerTimeout',
  FLOW_DEFAULT_AGENT: 'defaultAgent',
  FLOW_AGENT_TIMEOUT: 'agentTimeout',
  FLOW_AGENT_MAX_RETRIES: 'agentMaxRetries',
  FLOW_EXECUTION_TIMEOUT: 'executionTimeout',
  FLOW_MAX_CONCURRENT: 'maxConcurrentExecutions',
  FLOW_CLEANUP_ON_EXIT: 'cleanupOnExit',
  FLOW_STREAMING_ENABLED: 'streamingEnabled',
  FLOW_LOG_LEVEL: 'logLevel',
  FLOW_LOG_FORMAT: 'logFormat',
  FLOW_LOG_TO_FILE: 'logToFile',
  FLOW_LOG_FILE_PATH: 'logFilePath',
  FLOW_ENABLE_RETRIES: 'enableRetries',
  FLOW_RETRY_BACKOFF: 'retryBackoffFactor',
  FLOW_RETRY_MAX_DELAY: 'retryMaxDelay',
  FLOW_ENABLE_CIRCUIT_BREAKER: 'enableCircuitBreaker',
  FLOW_CIRCUIT_BREAKER_THRESHOLD: 'circuitBreakerThreshold',
  FLOW_HEALTH_CHECK_INTERVAL: 'healthCheckInterval',
  FLOW_DATA_DIR: 'dataDirectory',
  FLOW_STATE_DIR: 'stateDirectory',
  FLOW_CACHE_ENABLED: 'cacheEnabled',
  FLOW_CACHE_TTL: 'cacheTtl',
  FLOW_ENABLE_TELEMETRY: 'enableTelemetry',
  FLOW_TELEMETRY_ENDPOINT: 'telemetryEndpoint',
  FLOW_DEBUG_MODE: 'debugMode',
  FLOW_VERBOSE_LOGGING: 'verboseLogging',
  FLOW_MOCK_DELAYS: 'mockDelays'
}

/**
 * Flow Configuration Manager
 */
export class FlowConfig {
  constructor() {
    this._config = null
    this._configFile = null
  }

  /**
   * Initialize configuration from environment and files
   */
  async initialize(options = {}) {
    const { 
      configFile = '.taskmaster/flow/config.json',
      projectRoot = process.cwd(),
      validate = true 
    } = options

    this._configFile = path.resolve(projectRoot, configFile)
    
    try {
      // Load base configuration
      const baseConfig = this._loadDefaults()
      
      // Override with file configuration if exists
      const fileConfig = await this._loadConfigFile()
      
      // Override with environment variables
      const envConfig = this._loadFromEnvironment()
      
      // Merge configurations (env > file > defaults)
      const merged = {
        ...baseConfig,
        ...fileConfig,
        ...envConfig
      }
      
      // Validate if requested
      if (validate) {
        this._config = FlowConfigSchema.parse(merged)
      } else {
        this._config = merged
      }
      
      // Ensure directories exist
      await this._ensureDirectories()
      
      return {
        success: true,
        config: this._config,
        sources: {
          defaults: Object.keys(baseConfig).length,
          file: Object.keys(fileConfig).length,
          environment: Object.keys(envConfig).length
        }
      }
    } catch (error) {
      throw new ConfigurationError(`Failed to initialize configuration: ${error.message}`, {
        configFile: this._configFile,
        error: error.message
      })
    }
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue = undefined) {
    if (!this._config) {
      throw new ConfigurationError('Configuration not initialized. Call initialize() first.')
    }
    
    const value = key.split('.').reduce((obj, k) => obj?.[k], this._config)
    return value !== undefined ? value : defaultValue
  }

  /**
   * Get all configuration
   */
  getAll() {
    if (!this._config) {
      throw new ConfigurationError('Configuration not initialized. Call initialize() first.')
    }
    return { ...this._config }
  }

  /**
   * Update configuration value (runtime only)
   */
  set(key, value) {
    if (!this._config) {
      throw new ConfigurationError('Configuration not initialized. Call initialize() first.')
    }
    
    const keys = key.split('.')
    const lastKey = keys.pop()
    const target = keys.reduce((obj, k) => {
      if (!obj[k]) obj[k] = {}
      return obj[k]
    }, this._config)
    
    target[lastKey] = value
  }

  /**
   * Save current configuration to file
   */
  async save() {
    if (!this._config || !this._configFile) {
      throw new ConfigurationError('No configuration to save')
    }
    
    try {
      const dir = path.dirname(this._configFile)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      fs.writeFileSync(this._configFile, JSON.stringify(this._config, null, 2))
      return { success: true, file: this._configFile }
    } catch (error) {
      throw new ConfigurationError(`Failed to save configuration: ${error.message}`)
    }
  }

  /**
   * Validate current configuration
   */
  validate() {
    if (!this._config) {
      throw new ConfigurationError('Configuration not initialized')
    }
    
    try {
      return FlowConfigSchema.parse(this._config)
    } catch (error) {
      throw new ConfigurationError(`Configuration validation failed: ${error.message}`)
    }
  }

  /**
   * Get environment-specific configuration template
   */
  static getTemplate(environment = 'development') {
    const templates = {
      development: {
        logLevel: 'debug',
        debugMode: true,
        verboseLogging: true,
        mockDelays: true,
        enableTelemetry: false
      },
      production: {
        logLevel: 'info',
        logToFile: true,
        debugMode: false,
        verboseLogging: false,
        mockDelays: false,
        enableTelemetry: true,
        cleanupOnExit: true
      },
      test: {
        logLevel: 'error',
        debugMode: false,
        verboseLogging: false,
        mockDelays: false,
        enableTelemetry: false,
        healthCheckInterval: 300000 // 5 minutes
      }
    }
    
    return templates[environment] || templates.development
  }

  // Private methods

  _loadDefaults() {
    return FlowConfigSchema.parse({})
  }

  async _loadConfigFile() {
    if (!this._configFile || !fs.existsSync(this._configFile)) {
      return {}
    }
    
    try {
      const content = fs.readFileSync(this._configFile, 'utf8')
      return JSON.parse(content)
    } catch (error) {
      throw new ConfigurationError(`Invalid configuration file: ${error.message}`)
    }
  }

  _loadFromEnvironment() {
    const envConfig = {}
    
    for (const [envKey, configKey] of Object.entries(ENV_MAPPINGS)) {
      const value = process.env[envKey]
      if (value !== undefined) {
        envConfig[configKey] = this._parseEnvironmentValue(value)
      }
    }
    
    return envConfig
  }

  _parseEnvironmentValue(value) {
    // Handle boolean values
    if (value === 'true') return true
    if (value === 'false') return false
    
    // Handle numeric values
    if (/^\d+$/.test(value)) return parseInt(value, 10)
    if (/^\d*\.\d+$/.test(value)) return parseFloat(value)
    
    // Return as string
    return value
  }

  async _ensureDirectories() {
    const dirs = [
      this._config.dataDirectory,
      this._config.stateDirectory,
      path.dirname(this._config.logFilePath)
    ]
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }
}

/**
 * Configuration Error class
 */
export class ConfigurationError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'ConfigurationError'
    this.code = 'FLOW_CONFIG_ERROR'
    this.details = details
    this.isRetryable = false
  }
}

/**
 * Global configuration instance
 */
export const flowConfig = new FlowConfig()

/**
 * Initialize global configuration
 */
export async function initializeFlowConfig(options = {}) {
  return await flowConfig.initialize(options)
}

/**
 * Configuration schema for external validation
 */
export { FlowConfigSchema } 