/**
 * @fileoverview Flow Configuration Management
 * 
 * Complete Flow configuration system with embedded defaults, environment validation,
 * and extensible configuration patterns. This is the single source of truth for
 * all Flow configuration.
 */

import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

/**
 * Comprehensive configuration schema with validation and defaults
 */
const FlowConfigSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // Claude Code Integration
  claudeCode: z.object({
    enabled: z.boolean().default(true),
    permissionMode: z.enum(['acceptEdits', 'requireConfirmation', 'denyAll']).default('acceptEdits'),
    defaultMaxTurns: z.number().min(1).max(20).default(3),
    allowedTools: z.array(z.string()).default(['Read', 'Write', 'Bash']),
    systemPrompts: z.object({
      default: z.string().default('You are Claude Code, an AI assistant helping with software development.'),
      subtask: z.string().default('You are Claude Code, helping implement a specific subtask. Focus on the task requirements and context provided.')
    }).default({})
  }).default({}),
  
  // Safety and Validation
  safety: z.object({
    mode: z.enum(['vibe', 'standard', 'strict']).default('standard'),
    modes: z.object({
      vibe: z.object({
        autoLint: z.boolean().default(false),
        autoBuild: z.boolean().default(false),
        requireTests: z.boolean().default(false),
        skipConflictCheck: z.boolean().default(true)
      }).default({}),
      standard: z.object({
        autoLint: z.boolean().default(true),
        autoBuild: z.boolean().default(true),
        requireTests: z.boolean().default(false),
        skipConflictCheck: z.boolean().default(false)
      }).default({}),
      strict: z.object({
        autoLint: z.boolean().default(true),
        autoBuild: z.boolean().default(true),
        requireTests: z.boolean().default(true),
        skipConflictCheck: z.boolean().default(false),
        requireManualApproval: z.boolean().default(true)
      }).default({})
    }).default({}),
    buildValidation: z.object({
      enabled: z.boolean().default(true),
      commands: z.object({
        npm: z.string().default('npm run build'),
        yarn: z.string().default('yarn build'),
        pnpm: z.string().default('pnpm build')
      }).default({}),
      timeout: z.number().min(10000).max(600000).default(120000),
      failOnError: z.boolean().default(true)
    }).default({}),
    lintValidation: z.object({
      enabled: z.boolean().default(true),
      tools: z.array(z.string()).default(['biome', 'eslint', 'prettier']),
      commands: z.object({
        biome: z.string().default('npx biome check .'),
        eslint: z.string().default('npx eslint .'),
        prettier: z.string().default('npx prettier --check .')
      }).default({}),
      timeout: z.number().min(10000).max(300000).default(60000),
      failOnError: z.boolean().default(false),
      autoFix: z.boolean().default(false)
    }).default({})
  }).default({}),
  
  // Theme Configuration
  theme: z.object({
    default: z.enum(['auto', 'light', 'dark']).default('auto')
  }).default({}),
  
  // Worktree Management
  worktrees: z.object({
    maxRecent: z.number().min(1).max(50).default(10)
  }).default({}),
  
  // Task Display
  tasks: z.object({
    defaultView: z.enum(['list', 'tree', 'kanban']).default('list'),
    visibleRows: z.number().min(5).max(100).default(20)
  }).default({}),
  
  // Chat Configuration  
  chat: z.object({
    maxHistory: z.number().min(10).max(1000).default(100),
    streamingEnabled: z.boolean().default(true)
  }).default({}),
  
  // Notification System
  notifications: z.object({
    enabled: z.boolean().default(true),
    channels: z.object({
      app: z.object({
        enabled: z.boolean().default(true),
        duration: z.number().min(1000).max(10000).default(3000)
      }).default({}),
      email: z.object({
        enabled: z.boolean().default(true),
        webhook: z.string().url().nullable().default(null),
        recipient: z.string().email().nullable().default(null),
        events: z.array(z.string()).default(['error', 'pr-created', 'pr-merged', 'checks-failed'])
      }).default({}),
      slack: z.object({
        enabled: z.boolean().default(true),
        webhook: z.string().url().nullable().default(null),
        events: z.array(z.string()).default(['error', 'pr-created', 'pr-merged', 'checks-failed', 'session-completed'])
      }).default({}),
      telegram: z.object({
        enabled: z.boolean().default(true),
        token: z.string().nullable().default(null),
        chatId: z.string().nullable().default(null),
        events: z.array(z.string()).default(['error', 'critical', 'pr-merged'])
      }).default({}),
      whatsapp: z.object({
        enabled: z.boolean().default(false),
        events: z.array(z.string()).default(['critical'])
      }).default({}),
      sms: z.object({
        enabled: z.boolean().default(true),
        service: z.enum(['twilio', 'aws-sns']).default('twilio'),
        events: z.array(z.string()).default(['critical', 'error'])
      }).default({})
    }).default({}),
    escalation: z.object({
      enabled: z.boolean().default(true),
      rules: z.array(z.object({
        trigger: z.string(),
        channels: z.array(z.string())
      })).default([
        { trigger: 'immediate', channels: ['app'] },
        { trigger: '5min', channels: ['app', 'slack'] },
        { trigger: '15min', channels: ['app', 'slack', 'email'] },
        { trigger: 'critical', channels: ['app', 'slack', 'email', 'telegram', 'sms'] }
      ])
    }).default({}),
    templates: z.object({
      prCreated: z.object({
        title: z.string().default('PR Created: {{prNumber}}'),
        message: z.string().default('Pull request #{{prNumber}} has been created for task {{taskId}}'),
        priority: z.enum(['normal', 'high', 'critical']).default('normal')
      }).default({}),
      prMerged: z.object({
        title: z.string().default('PR Merged: {{prNumber}}'),
        message: z.string().default('Pull request #{{prNumber}} has been successfully merged'),
        priority: z.enum(['normal', 'high', 'critical']).default('normal')
      }).default({}),
      checksFailed: z.object({
        title: z.string().default('PR Checks Failed: {{prNumber}}'),
        message: z.string().default('Pull request #{{prNumber}} has failing checks: {{failedChecks}}'),
        priority: z.enum(['normal', 'high', 'critical']).default('high')
      }).default({}),
      sessionCompleted: z.object({
        title: z.string().default('Claude Session Completed'),
        message: z.string().default('Claude Code session completed for task {{taskId}}'),
        priority: z.enum(['normal', 'high', 'critical']).default('normal')
      }).default({}),
      error: z.object({
        title: z.string().default('Error: {{errorType}}'),
        message: z.string().default('An error occurred: {{errorMessage}}'),
        priority: z.enum(['normal', 'high', 'critical']).default('high')
      }).default({}),
      critical: z.object({
        title: z.string().default('Critical Alert: {{alertType}}'),
        message: z.string().default('Critical issue detected: {{alertMessage}}'),
        priority: z.enum(['normal', 'high', 'critical']).default('critical')
      }).default({})
    }).default({}),
    preferences: z.object({
      quietHours: z.object({
        enabled: z.boolean().default(false),
        start: z.string().default('22:00'),
        end: z.string().default('08:00'),
        timezone: z.string().default('local'),
        allowCritical: z.boolean().default(true)
      }).default({}),
      frequency: z.object({
        maxPerHour: z.number().min(1).max(100).default(10),
        maxPerDay: z.number().min(1).max(1000).default(50),
        cooldownMinutes: z.number().min(1).max(60).default(5)
      }).default({}),
      filtering: z.object({
        duplicateWindow: z.string().default('5min'),
        minimumPriority: z.enum(['normal', 'high', 'critical']).default('normal')
      }).default({})
    }).default({})
  }).default({}),
  
  // Conflict Detection
  conflictDetection: z.object({
    checkMergeConflicts: z.boolean().default(true),
    notifyOnConflicts: z.boolean().default(true),
    pauseAutomationOnConflicts: z.boolean().default(true),
    humanInterventionRequired: z.boolean().default(true)
  }).default({}),
  
  // Worktree Lifecycle
  worktreeLifecycle: z.object({
    enabled: z.boolean().default(true),
    autoCleanupOnMerge: z.boolean().default(true),
    preserveUncommitted: z.boolean().default(true),
    backupBeforeCleanup: z.boolean().default(true),
    astCacheInvalidation: z.boolean().default(true),
    taskStatusUpdates: z.boolean().default(true),
    lifecycleEvents: z.object({
      trackPRCreation: z.boolean().default(true),
      trackPRMerge: z.boolean().default(true),
      trackSessionCompletion: z.boolean().default(true),
      trackCleanupRequests: z.boolean().default(true)
    }).default({})
  }).default({}),
  
  // Task Status Integration
  taskStatusIntegration: z.object({
    enabled: z.boolean().default(true),
    autoUpdateOnMerge: z.boolean().default(true),
    addPRReference: z.boolean().default(true),
    updateMetrics: z.boolean().default(true),
    cascadeSubtasks: z.boolean().default(false),
    supportedStatuses: z.array(z.string()).default([
      'pending', 'in-progress', 'done', 'completed', 'review', 'deferred', 'cancelled', 'blocked'
    ]),
    completionStatuses: z.array(z.string()).default(['done', 'completed'])
  }).default({}),
  
  // Branch Awareness
  branchAwareness: z.object({
    enabled: z.boolean().default(true),
    rememberLastBranch: z.boolean().default(true),
    showBranchInStatus: z.boolean().default(true),
    autoDetectBranchSwitch: z.boolean().default(true),
    lastWorkingBranch: z.string().nullable().default(null),
    currentBranch: z.string().default('main'),
    branchHistory: z.array(z.string()).default([]),
    maxHistorySize: z.number().min(1).max(50).default(10),
    lastUpdated: z.string().optional()
  }).default({}),
  
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
  FLOW_MOCK_DELAYS: 'mockDelays',
  FLOW_CLAUDE_CODE_ENABLED: 'claudeCode.enabled',
  FLOW_CLAUDE_CODE_PERMISSION_MODE: 'claudeCode.permissionMode',
  FLOW_SAFETY_MODE: 'safety.mode',
  FLOW_NOTIFICATIONS_ENABLED: 'notifications.enabled',
  FLOW_CONFLICT_DETECTION: 'conflictDetection.checkMergeConflicts',
  FLOW_BRANCH_AWARENESS: 'branchAwareness.enabled'
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