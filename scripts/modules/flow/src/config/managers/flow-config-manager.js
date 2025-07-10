/**
 * Flow Configuration Manager
 * Handles loading, saving, and managing Flow configuration
 */

import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { FlowConfigSchema } from '../schemas/flow-config-schema.js';
import { loadFlowConfig } from '../flow-config.js';
import { applyEnvironmentOverrides } from '../utils/env-overrides.js';

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
   * Get default configuration from JSON files
   */
  getDefaultConfig() {
    const result = loadFlowConfig();
    if (result.success) {
      return result.config;
    } else {
      console.warn('Failed to load default Flow config, using fallback');
      return {
        nodeEnv: 'development',
        vibekit: {
          enabled: true,
          defaultAgent: 'claude',
          streamingEnabled: true,
          githubIntegration: true,
          agents: {},
          environments: {}
        },
        github: { enabled: true },
        execution: { timeout: 300000 },
        logging: { level: 'info' }
      };
    }
  }

  /**
   * Load configuration with precedence: env vars > config file > defaults
   */
  async loadConfig() {
    try {
      // Start with defaults from JSON files
      let configData = this.getDefaultConfig();

      // Load from config file if it exists
      if (fs.existsSync(this.configFile)) {
        try {
          const fileContent = fs.readFileSync(this.configFile, 'utf8');
          const fileConfig = JSON.parse(fileContent);
          
          // Deep merge file config with defaults
          configData = this.deepMerge(configData, fileConfig);
        } catch (error) {
          console.warn(`⚠️ Invalid config file ${this.configFile}, using defaults:`, error.message);
        }
      }

      // Apply environment variable overrides
      configData = applyEnvironmentOverrides(configData);

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
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
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
    return ['claude', 'codex', 'gemini', 'opencode'];
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
            'claude': 'ANTHROPIC_API_KEY',
      'codex': 'OPENAI_API_KEY',
      'gemini': 'GOOGLE_API_KEY',
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

/**
 * Global configuration instance - auto-initializing singleton
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