/**
 * Simplified Flow Configuration focused on VibeKit integration
 * Follows best practices for CLI configuration management
 */

import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

/**
 * VibeKit Flow Configuration Schema
 * Defines the structure and validation for all Flow configuration
 */
const FlowConfigSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // VibeKit Configuration  
  vibekit: z.object({
    enabled: z.boolean().default(true),
    defaultAgent: z.enum(['claude-code', 'codex', 'gemini-cli', 'opencode']).default('claude-code'),
    streamingEnabled: z.boolean().default(true),
    githubIntegration: z.boolean().default(true),
    autoCreatePR: z.boolean().default(false),
    
    // Core VibeKit SDK settings
    sdk: z.object({
      version: z.string().default('latest'),
      timeout: z.number().min(1000).max(600000).default(120000), // 2 minutes
      retryAttempts: z.number().min(0).max(5).default(3),
      baseUrl: z.string().optional(), // For custom VibeKit instances
    }).default({}),
    
    // Environment configurations (sandbox providers)
    environments: z.object({
      e2b: z.object({
        enabled: z.boolean().default(true),
        apiKey: z.string().optional(), // Will use E2B_API_KEY from .env
        templateId: z.string().optional(),
        region: z.string().default('us-east-1'),
        // Additional E2B config can be added here
      }).default({}),
      
      northflank: z.object({
        enabled: z.boolean().default(false),
        apiKey: z.string().optional(), // Will use NORTHFLANK_API_KEY from .env
        projectId: z.string().optional(), // Will use NORTHFLANK_PROJECT_ID from .env
        region: z.string().default('europe-west'),
      }).default({}),
      
      daytona: z.object({
        enabled: z.boolean().default(false),
        apiKey: z.string().optional(), // Will use DAYTONA_API_KEY from .env
        workspaceId: z.string().optional(), // Will use DAYTONA_WORKSPACE_ID from .env
        region: z.string().default('us-central'),
      }).default({})
    }).default({}),
    
    // Telemetry configuration (OpenTelemetry)
    telemetry: z.object({
      enabled: z.boolean().default(false),
      endpoint: z.string().optional(), // Will use VIBEKIT_TELEMETRY_ENDPOINT from .env
      apiKey: z.string().optional(), // Will use VIBEKIT_TELEMETRY_API_KEY from .env
      samplingRate: z.number().min(0).max(1).default(0.1),
      batchSize: z.number().min(1).max(1000).default(100),
      flushInterval: z.number().min(1000).default(30000), // milliseconds
      serviceName: z.string().default('taskmaster-flow'),
      serviceVersion: z.string().default('1.0.0'),
    }).default({}),
    
    // Session management
    sessionManagement: z.object({
      enabled: z.boolean().default(true),
      persistSessions: z.boolean().default(true),
      sessionDir: z.string().default('.taskmaster/flow/sessions'),
      maxSessionAge: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days in ms
      cleanupInterval: z.number().default(24 * 60 * 60 * 1000), // 24 hours in ms
      autoResume: z.boolean().default(true),
    }).default({}),
    
    // Secrets management
    secrets: z.object({
      enabled: z.boolean().default(true),
      provider: z.enum(['env', 'vault', 'aws-secrets']).default('env'),
      encryptionKey: z.string().optional(), // Will use VIBEKIT_ENCRYPTION_KEY from .env
      vaultUrl: z.string().optional(),
      awsRegion: z.string().optional(),
    }).default({}),
    
    // Agent-specific settings (reusing existing Task Master API keys)
    agents: z.object({
      'claude-code': z.object({
        enabled: z.boolean().default(true),
        maxTokens: z.number().min(1).max(32000).default(4000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('claude-3-opus-20240229'),
        provider: z.string().default('anthropic'),
        apiKey: z.string().optional(), // Will use ANTHROPIC_API_KEY from .env
      }).default({}),
      
      codex: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(2000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('gpt-4-turbo-preview'),
        provider: z.string().default('openai'),
        apiKey: z.string().optional(), // Will use OPENAI_API_KEY from .env
      }).default({}),
      
      'gemini-cli': z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(3000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('gemini-1.5-pro'),
        provider: z.string().default('gemini'),
        apiKey: z.string().optional(), // Will use GOOGLE_API_KEY from .env
      }).default({}),
      
      opencode: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(2000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('deepseek-coder-v2'),
        provider: z.string().default('opencode'),
        apiKey: z.string().optional(), // Will use custom OPENCODE_API_KEY from .env
      }).default({})
    }).default({}),
    
    // Working directory configuration
    workingDirectory: z.string().optional(),
    
    // Ask Mode configuration
    askMode: z.object({
      enabled: z.boolean().default(true),
      defaultMode: z.enum(['interactive', 'batch', 'streaming']).default('interactive'),
      timeout: z.number().min(5000).max(300000).default(60000), // 1 minute
      maxQuestions: z.number().min(1).max(50).default(10),
    }).default({}),
    
    // Streaming configuration
    streaming: z.object({
      enabled: z.boolean().default(true),
      bufferSize: z.number().min(1).max(10000).default(1000),
      flushInterval: z.number().min(100).max(5000).default(500), // milliseconds
      compression: z.boolean().default(false),
    }).default({})
  }).default({}),

  // GitHub Integration (enhanced for VibeKit)
  github: z.object({
    enabled: z.boolean().default(true),
    autoDetectRepo: z.boolean().default(true),
    defaultBranch: z.string().default('main'),
    prTemplate: z.string().optional(),
    token: z.string().optional(), // Will use GITHUB_API_KEY from .env
    webhookSecret: z.string().optional(), // Will use GITHUB_WEBHOOK_SECRET from .env
    autoSync: z.boolean().default(false),
    branchPrefix: z.string().default('taskmaster/'),
  }).default({}),

  // Execution Settings
  execution: z.object({
    timeout: z.number().min(1000).max(3600000).default(300000), // 5 minutes
    maxRetries: z.number().min(0).max(5).default(2),
    streamOutput: z.boolean().default(true),
    parallelTasks: z.number().min(1).max(10).default(3),
  }).default({}),

  // Logging
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    enableTelemetry: z.boolean().default(true),
    logFile: z.string().optional(),
    maxLogSize: z.number().default(10 * 1024 * 1024), // 10MB
  }).default({})
});

/**
 * Simple Flow Configuration Manager
 * Implements best practices for CLI configuration management
 */
export class FlowConfigManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.configFile = path.join(this.projectRoot, '.taskmaster', 'flow', 'config.json');
    this.config = null;
  }

  /**
   * Load configuration with precedence: env vars > config file > defaults
   */
  async loadConfig() {
    try {
      // Start with defaults
      let configData = {};

      // Load from config file if it exists
      if (fs.existsSync(this.configFile)) {
        try {
          const fileContent = fs.readFileSync(this.configFile, 'utf8');
          configData = JSON.parse(fileContent);
        } catch (error) {
          console.warn(`⚠️ Invalid config file ${this.configFile}, using defaults:`, error.message);
        }
      }

      // Apply environment variable overrides
      configData = this.applyEnvironmentOverrides(configData);

      // Validate and parse with schema
      this.config = FlowConfigSchema.parse(configData);

      return this.config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Configuration validation failed:');
        error.errors.forEach(err => {
          console.error(`   ${err.path.join('.')}: ${err.message}`);
        });
        throw new Error('Invalid Flow configuration');
      }
      throw error;
    }
  }

  /**
   * Apply environment variable overrides
   * Follows best practice of env vars taking precedence
   * Reuses existing Task Master .env file keys where possible
   */
  applyEnvironmentOverrides(configData) {
    const env = process.env;

    // Environment overrides
    if (env.NODE_ENV) {
      configData.nodeEnv = env.NODE_ENV;
    }

    // VibeKit overrides
    if (!configData.vibekit) configData.vibekit = {};
    
    if (env.VIBEKIT_ENABLED !== undefined) {
      configData.vibekit.enabled = env.VIBEKIT_ENABLED === 'true';
    }
    
    if (env.VIBEKIT_DEFAULT_AGENT) {
      configData.vibekit.defaultAgent = env.VIBEKIT_DEFAULT_AGENT;
    }
    
    if (env.VIBEKIT_STREAMING_ENABLED !== undefined) {
      configData.vibekit.streamingEnabled = env.VIBEKIT_STREAMING_ENABLED === 'true';
    }
    
    if (env.VIBEKIT_GITHUB_INTEGRATION !== undefined) {
      configData.vibekit.githubIntegration = env.VIBEKIT_GITHUB_INTEGRATION === 'true';
    }
    
    if (env.VIBEKIT_WORKING_DIRECTORY) {
      configData.vibekit.workingDirectory = env.VIBEKIT_WORKING_DIRECTORY;
    }

    // VibeKit SDK overrides
    if (!configData.vibekit.sdk) configData.vibekit.sdk = {};
    
    if (env.VIBEKIT_SDK_VERSION) {
      configData.vibekit.sdk.version = env.VIBEKIT_SDK_VERSION;
    }
    
    if (env.VIBEKIT_SDK_TIMEOUT) {
      configData.vibekit.sdk.timeout = parseInt(env.VIBEKIT_SDK_TIMEOUT, 10);
    }
    
    if (env.VIBEKIT_SDK_BASE_URL) {
      configData.vibekit.sdk.baseUrl = env.VIBEKIT_SDK_BASE_URL;
    }
    
    // Telemetry overrides
    if (!configData.vibekit.telemetry) configData.vibekit.telemetry = {};
    
    if (env.VIBEKIT_TELEMETRY_ENABLED !== undefined) {
      configData.vibekit.telemetry.enabled = env.VIBEKIT_TELEMETRY_ENABLED === 'true';
    }
    
    if (env.VIBEKIT_TELEMETRY_ENDPOINT) {
      configData.vibekit.telemetry.endpoint = env.VIBEKIT_TELEMETRY_ENDPOINT;
    }
    
    if (env.VIBEKIT_TELEMETRY_API_KEY) {
      configData.vibekit.telemetry.apiKey = env.VIBEKIT_TELEMETRY_API_KEY;
    }
    
    if (env.VIBEKIT_TELEMETRY_SAMPLING_RATE) {
      configData.vibekit.telemetry.samplingRate = parseFloat(env.VIBEKIT_TELEMETRY_SAMPLING_RATE);
    }
    
    // Session management overrides
    if (!configData.vibekit.sessionManagement) configData.vibekit.sessionManagement = {};
    
    if (env.VIBEKIT_SESSION_ENABLED !== undefined) {
      configData.vibekit.sessionManagement.enabled = env.VIBEKIT_SESSION_ENABLED === 'true';
    }
    
    if (env.VIBEKIT_SESSION_PERSIST !== undefined) {
      configData.vibekit.sessionManagement.persistSessions = env.VIBEKIT_SESSION_PERSIST === 'true';
    }
    
    if (env.VIBEKIT_SESSION_DIR) {
      configData.vibekit.sessionManagement.sessionDir = env.VIBEKIT_SESSION_DIR;
    }

    // Secrets management overrides
    if (!configData.vibekit.secrets) configData.vibekit.secrets = {};
    
    if (env.VIBEKIT_SECRETS_PROVIDER) {
      configData.vibekit.secrets.provider = env.VIBEKIT_SECRETS_PROVIDER;
    }
    
    if (env.VIBEKIT_ENCRYPTION_KEY) {
      configData.vibekit.secrets.encryptionKey = env.VIBEKIT_ENCRYPTION_KEY;
    }

    // Ask Mode overrides
    if (!configData.vibekit.askMode) configData.vibekit.askMode = {};
    
    if (env.VIBEKIT_ASK_MODE_ENABLED !== undefined) {
      configData.vibekit.askMode.enabled = env.VIBEKIT_ASK_MODE_ENABLED === 'true';
    }
    
    if (env.VIBEKIT_ASK_MODE_DEFAULT) {
      configData.vibekit.askMode.defaultMode = env.VIBEKIT_ASK_MODE_DEFAULT;
    }

    // Streaming overrides
    if (!configData.vibekit.streaming) configData.vibekit.streaming = {};
    
    if (env.VIBEKIT_STREAMING_BUFFER_SIZE) {
      configData.vibekit.streaming.bufferSize = parseInt(env.VIBEKIT_STREAMING_BUFFER_SIZE, 10);
    }
    
    if (env.VIBEKIT_STREAMING_COMPRESSION !== undefined) {
      configData.vibekit.streaming.compression = env.VIBEKIT_STREAMING_COMPRESSION === 'true';
    }
    
    // Environment provider overrides (reusing existing Task Master keys)
    if (!configData.vibekit.environments) configData.vibekit.environments = {};
    
    // E2B overrides
    if (!configData.vibekit.environments.e2b) configData.vibekit.environments.e2b = {};
    if (env.E2B_API_KEY) {
      configData.vibekit.environments.e2b.apiKey = env.E2B_API_KEY;
      configData.vibekit.environments.e2b.enabled = true;
    }
    if (env.E2B_TEMPLATE_ID) {
      configData.vibekit.environments.e2b.templateId = env.E2B_TEMPLATE_ID;
    }
    if (env.E2B_REGION) {
      configData.vibekit.environments.e2b.region = env.E2B_REGION;
    }
    
    // Northflank overrides
    if (!configData.vibekit.environments.northflank) configData.vibekit.environments.northflank = {};
    if (env.NORTHFLANK_API_KEY) {
      configData.vibekit.environments.northflank.apiKey = env.NORTHFLANK_API_KEY;
      configData.vibekit.environments.northflank.enabled = true;
    }
    if (env.NORTHFLANK_PROJECT_ID) {
      configData.vibekit.environments.northflank.projectId = env.NORTHFLANK_PROJECT_ID;
    }
    if (env.NORTHFLANK_REGION) {
      configData.vibekit.environments.northflank.region = env.NORTHFLANK_REGION;
    }
    
    // Daytona overrides
    if (!configData.vibekit.environments.daytona) configData.vibekit.environments.daytona = {};
    if (env.DAYTONA_API_KEY) {
      configData.vibekit.environments.daytona.apiKey = env.DAYTONA_API_KEY;
      configData.vibekit.environments.daytona.enabled = true;
    }
    if (env.DAYTONA_WORKSPACE_ID) {
      configData.vibekit.environments.daytona.workspaceId = env.DAYTONA_WORKSPACE_ID;
    }
    if (env.DAYTONA_REGION) {
      configData.vibekit.environments.daytona.region = env.DAYTONA_REGION;
    }

    // Agent API key overrides (reusing existing Task Master keys)
    if (!configData.vibekit.agents) configData.vibekit.agents = {};
    
    // Claude Code agent
    if (!configData.vibekit.agents['claude-code']) configData.vibekit.agents['claude-code'] = {};
    if (env.ANTHROPIC_API_KEY) {
      configData.vibekit.agents['claude-code'].apiKey = env.ANTHROPIC_API_KEY;
      configData.vibekit.agents['claude-code'].enabled = true;
    }
    
    // Codex agent
    if (!configData.vibekit.agents.codex) configData.vibekit.agents.codex = {};
    if (env.OPENAI_API_KEY) {
      configData.vibekit.agents.codex.apiKey = env.OPENAI_API_KEY;
    }
    
    // Gemini CLI agent
    if (!configData.vibekit.agents['gemini-cli']) configData.vibekit.agents['gemini-cli'] = {};
    if (env.GOOGLE_API_KEY) {
      configData.vibekit.agents['gemini-cli'].apiKey = env.GOOGLE_API_KEY;
    }
    
    // OpenCode agent (custom)
    if (!configData.vibekit.agents.opencode) configData.vibekit.agents.opencode = {};
    if (env.OPENCODE_API_KEY) {
      configData.vibekit.agents.opencode.apiKey = env.OPENCODE_API_KEY;
    }

    // GitHub integration overrides (reusing existing Task Master key)
    if (!configData.github) configData.github = {};
    
    if (env.GITHUB_API_KEY) {
      configData.github.token = env.GITHUB_API_KEY;
      configData.github.enabled = true;
    }
    
    if (env.GITHUB_WEBHOOK_SECRET) {
      configData.github.webhookSecret = env.GITHUB_WEBHOOK_SECRET;
    }
    
    if (env.GITHUB_DEFAULT_BRANCH) {
      configData.github.defaultBranch = env.GITHUB_DEFAULT_BRANCH;
    }

    // Execution overrides
    if (!configData.execution) configData.execution = {};
    
    if (env.FLOW_EXECUTION_TIMEOUT) {
      configData.execution.timeout = parseInt(env.FLOW_EXECUTION_TIMEOUT, 10);
    }
    
    if (env.FLOW_MAX_RETRIES) {
      configData.execution.maxRetries = parseInt(env.FLOW_MAX_RETRIES, 10);
    }
    
    if (env.FLOW_PARALLEL_TASKS) {
      configData.execution.parallelTasks = parseInt(env.FLOW_PARALLEL_TASKS, 10);
    }

    // Logging overrides
    if (!configData.logging) configData.logging = {};
    
    if (env.FLOW_LOG_LEVEL) {
      configData.logging.level = env.FLOW_LOG_LEVEL;
    }
    
    if (env.FLOW_LOG_FILE) {
      configData.logging.logFile = env.FLOW_LOG_FILE;
    }

    return configData;
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config = this.config) {
    if (!config) {
      throw new Error('No configuration to save');
    }

    // Ensure directory exists
    const configDir = path.dirname(this.configFile);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Validate before saving
    const validatedConfig = FlowConfigSchema.parse(config);

    // Write to file
    fs.writeFileSync(this.configFile, JSON.stringify(validatedConfig, null, 2));
    
    this.config = validatedConfig;
    return validatedConfig;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get specific configuration value with dot notation
   */
  getValue(path, defaultValue = undefined) {
    if (!this.config) return defaultValue;

    const keys = path.split('.');
    let current = this.config;

    for (const key of keys) {
      if (current === null || current === undefined || !current.hasOwnProperty(key)) {
        return defaultValue;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Update configuration value
   */
  setValue(path, value) {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const keys = path.split('.');
    let current = this.config;

    // Navigate to parent of target key
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    // Set value
    current[keys[keys.length - 1]] = value;

    // Validate updated config
    this.config = FlowConfigSchema.parse(this.config);
    
    return this.config;
  }

  /**
   * Validate configuration and return helpful errors
   */
  validateConfig(config = this.config) {
    if (!config) {
      return { valid: false, errors: ['No configuration provided'] };
    }

    try {
      FlowConfigSchema.parse(config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        return { valid: false, errors };
      }
      return { valid: false, errors: [error.message] };
    }
  }

  /**
   * Get available agent names for validation
   */
  getAvailableAgents() {
    return ['claude-code', 'codex', 'gemini-cli', 'opencode'];
  }

  /**
   * Check if required environment variables are set for VibeKit integration
   * Validates both existing Task Master keys and new VibeKit-specific requirements
   */
  validateEnvironment() {
    const issues = [];
    const warnings = [];

    // Check API keys for enabled agents (reusing Task Master .env keys)
    const agentKeyMap = {
      'claude-code': 'ANTHROPIC_API_KEY',
      'codex': 'OPENAI_API_KEY', 
      'gemini-cli': 'GOOGLE_API_KEY',
      'opencode': 'OPENCODE_API_KEY'
    };

    if (this.config?.vibekit?.agents) {
      for (const [agent, agentConfig] of Object.entries(this.config.vibekit.agents)) {
        if (agentConfig.enabled) {
          const requiredKey = agentKeyMap[agent];
          if (requiredKey && !process.env[requiredKey]) {
            issues.push(`Missing API key: ${requiredKey} (required for ${agent} agent)`);
          }
        }
      }
    }

    // Check sandbox environment provider requirements
    if (this.config?.vibekit?.environments) {
      // E2B is typically required for sandbox execution
      if (this.config.vibekit.environments.e2b?.enabled && !process.env.E2B_API_KEY) {
        issues.push('Missing E2B_API_KEY (required for sandbox execution)');
      }
      
      // Northflank checks
      if (this.config.vibekit.environments.northflank?.enabled) {
        if (!process.env.NORTHFLANK_API_KEY) {
          warnings.push('Missing NORTHFLANK_API_KEY (required for Northflank environment)');
        }
        if (!process.env.NORTHFLANK_PROJECT_ID) {
          warnings.push('Missing NORTHFLANK_PROJECT_ID (recommended for Northflank)');
        }
      }
      
      // Daytona checks
      if (this.config.vibekit.environments.daytona?.enabled) {
        if (!process.env.DAYTONA_API_KEY) {
          warnings.push('Missing DAYTONA_API_KEY (required for Daytona environment)');
        }
        if (!process.env.DAYTONA_WORKSPACE_ID) {
          warnings.push('Missing DAYTONA_WORKSPACE_ID (recommended for Daytona)');
        }
      }
    }

    // Check GitHub integration requirements (reusing Task Master key)
    if (this.config?.vibekit?.githubIntegration || this.config?.github?.enabled) {
      if (!process.env.GITHUB_API_KEY) {
        warnings.push('Missing GITHUB_API_KEY (required for GitHub integration and PR automation)');
      }
    }
    
    // Check telemetry requirements
    if (this.config?.vibekit?.telemetry?.enabled) {
      if (!this.config.vibekit.telemetry.endpoint && !process.env.VIBEKIT_TELEMETRY_ENDPOINT) {
        warnings.push('Missing telemetry endpoint (VIBEKIT_TELEMETRY_ENDPOINT)');
      }
      if (!this.config.vibekit.telemetry.apiKey && !process.env.VIBEKIT_TELEMETRY_API_KEY) {
        warnings.push('Missing telemetry API key (VIBEKIT_TELEMETRY_API_KEY)');
      }
    }

    // Check secrets management requirements
    if (this.config?.vibekit?.secrets?.enabled) {
      if (this.config.vibekit.secrets.provider === 'vault' && !this.config.vibekit.secrets.vaultUrl) {
        warnings.push('Missing vault URL for secrets management');
      }
      if (this.config.vibekit.secrets.provider === 'aws-secrets' && !this.config.vibekit.secrets.awsRegion) {
        warnings.push('Missing AWS region for secrets management');
      }
    }

    // VibeKit-specific validation
    if (this.config?.vibekit?.enabled) {
      // At least one sandbox environment should be available
      const hasEnvironment = this.config.vibekit.environments?.e2b?.enabled ||
                            this.config.vibekit.environments?.northflank?.enabled ||
                            this.config.vibekit.environments?.daytona?.enabled;
      
      if (!hasEnvironment) {
        warnings.push('No sandbox environment enabled (E2B, Northflank, or Daytona required for VibeKit)');
      }

      // At least one agent should be available
      const hasAgent = Object.values(this.config.vibekit.agents || {}).some(agent => agent.enabled);
      
      if (!hasAgent) {
        warnings.push('No AI agent enabled (at least one agent required for VibeKit)');
      }
    }

    return { 
      valid: issues.length === 0,
      issues,
      warnings
    };
  }
}

// Global configuration instance - auto-initializing singleton

/**
 * Simple flowConfig singleton that auto-initializes
 * Provides the same interface as the old flowConfig but with the new implementation
 */
export const flowConfig = {
  _manager: null,
  _initialized: false,

  async _getManager(projectRoot = process.cwd()) {
    if (!this._manager) {
      this._manager = new FlowConfigManager({ projectRoot });
    }
    if (!this._initialized) {
      await this._manager.loadConfig();
      this._initialized = true;
    }
    return this._manager;
  },

  async getValue(path, defaultValue) {
    const manager = await this._getManager();
    return manager.getValue(path, defaultValue);
  },

  async setValue(path, value) {
    const manager = await this._getManager();
    return manager.setValue(path, value);
  },

  async saveConfig() {
    const manager = await this._getManager();
    return manager.saveConfig();
  },

  async getConfig() {
    const manager = await this._getManager();
    return manager.getConfig();
  },

  async initialize(projectRoot) {
    this._manager = new FlowConfigManager({ projectRoot: projectRoot || process.cwd() });
    await this._manager.loadConfig();
    this._initialized = true;
    return this;
  },

  // Legacy methods for backward compatibility
  async get(path, defaultValue) {
    return this.getValue(path, defaultValue);
  },

  async set(path, value) {
    return this.setValue(path, value);
  },

  async save() {
    return this.saveConfig();
  }
};

export { FlowConfigSchema };

/**
 * FlowConfig class - Enhanced interface for VibeKit integration
 * Provides VibeKit-specific configuration methods
 */
export class FlowConfig {
  constructor(projectRoot = process.cwd()) {
    this.manager = new FlowConfigManager({ projectRoot });
    this.loaded = false;
  }

  async ensureLoaded() {
    if (!this.loaded) {
      await this.manager.loadConfig();
      this.loaded = true;
    }
  }

  /**
   * Get VibeKit-specific configuration
   */
  getVibeKitConfig() {
    return this.manager.getValue('vibekit', {});
  }

  /**
   * Get agent configuration
   */
  getAgentConfig(agentType) {
    return this.manager.getValue(`vibekit.agents.${agentType}`, {});
  }

  /**
   * Get environment configuration
   */
  getEnvironmentConfig(envType) {
    return this.manager.getValue(`vibekit.environments.${envType}`, {});
  }

  /**
   * Get GitHub configuration
   */
  getGitHubConfig() {
    return this.manager.getValue('github', {});
  }

  /**
   * Check if VibeKit is enabled
   */
  isVibeKitEnabled() {
    return this.manager.getValue('vibekit.enabled', true);
  }

  /**
   * Get available agents with configuration status
   */
  getAvailableAgents() {
    const vibeKitConfig = this.getVibeKitConfig();
    const agents = vibeKitConfig.agents || {};
    
    return Object.keys(agents).filter(agent => agents[agent].enabled);
  }

  /**
   * Get available environments with configuration status
   */
  getAvailableEnvironments() {
    const vibeKitConfig = this.getVibeKitConfig();
    const environments = vibeKitConfig.environments || {};
    
    return Object.keys(environments).filter(env => environments[env].enabled);
  }

  /**
   * Update VibeKit configuration
   */
  async updateVibeKitConfig(newConfig) {
    await this.ensureLoaded();
    this.manager.setValue('vibekit', { ...this.getVibeKitConfig(), ...newConfig });
    return this.manager.saveConfig();
  }

  /**
   * Get all configuration
   */
  async getConfig() {
    await this.ensureLoaded();
    return this.manager.getConfig();
  }

  /**
   * Save configuration
   */
  async saveConfig() {
    await this.ensureLoaded();
    return this.manager.saveConfig();
  }
}
