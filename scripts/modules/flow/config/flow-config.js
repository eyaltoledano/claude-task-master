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
    
    // Agent-specific settings
    agents: z.object({
      'claude-code': z.object({
        enabled: z.boolean().default(true),
        maxTokens: z.number().min(1).max(32000).default(4000),
        temperature: z.number().min(0).max(1).default(0.1)
      }).default({}),
      
      codex: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(2000),
        temperature: z.number().min(0).max(1).default(0.1)
      }).default({}),
      
      'gemini-cli': z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(3000),
        temperature: z.number().min(0).max(1).default(0.1)
      }).default({}),
      
      opencode: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(2000),
        temperature: z.number().min(0).max(1).default(0.1)
      }).default({})
    }).default({})
  }).default({}),

  // GitHub Integration
  github: z.object({
    enabled: z.boolean().default(true),
    autoDetectRepo: z.boolean().default(true),
    defaultBranch: z.string().default('main'),
    prTemplate: z.string().optional()
  }).default({}),

  // Execution Settings
  execution: z.object({
    timeout: z.number().min(1000).max(3600000).default(300000), // 5 minutes
    maxRetries: z.number().min(0).max(5).default(2),
    streamOutput: z.boolean().default(true)
  }).default({}),

  // Logging
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    enableTelemetry: z.boolean().default(true)
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

    // Execution overrides
    if (!configData.execution) configData.execution = {};
    
    if (env.FLOW_EXECUTION_TIMEOUT) {
      configData.execution.timeout = parseInt(env.FLOW_EXECUTION_TIMEOUT, 10);
    }
    
    if (env.FLOW_MAX_RETRIES) {
      configData.execution.maxRetries = parseInt(env.FLOW_MAX_RETRIES, 10);
    }

    // Logging overrides
    if (!configData.logging) configData.logging = {};
    
    if (env.FLOW_LOG_LEVEL) {
      configData.logging.level = env.FLOW_LOG_LEVEL;
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
   * Check if required environment variables are set for agents
   */
  validateEnvironment() {
    const issues = [];
    const warnings = [];

    // Check API keys for enabled agents
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
            issues.push(`Missing API key: ${requiredKey} (required for ${agent})`);
          }
        }
      }
    }

    // Check VibeKit requirements
    if (!process.env.E2B_API_KEY) {
      warnings.push('Missing E2B_API_KEY (required for sandbox execution)');
    }

    // Check GitHub integration requirements
    if (this.config?.vibekit?.githubIntegration && !process.env.GITHUB_TOKEN) {
      warnings.push('Missing GITHUB_TOKEN (required for GitHub integration)');
    }

    return { 
      valid: issues.length === 0,
      issues,
      warnings
    };
  }
}

// Global configuration instance for convenience
let globalConfig = null;

/**
 * Get or create global configuration instance
 */
export function getFlowConfig(projectRoot = process.cwd()) {
  if (!globalConfig) {
    globalConfig = new FlowConfigManager({ projectRoot });
  }
  return globalConfig;
}

/**
 * Load and return global configuration
 */
export async function loadFlowConfig(projectRoot = process.cwd()) {
  const configManager = getFlowConfig(projectRoot);
  await configManager.loadConfig();
  return configManager;
}

export { FlowConfigSchema };
