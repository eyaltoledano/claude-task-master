/**
 * Flow Configuration Manager
 * Handles loading, saving, and managing Flow configuration
 */

import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { FlowConfigSchema } from '../schemas/flow-config-schema.js';
import { loadFlowConfig, loadMainFlowConfig } from '../flow-config.js';
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
   * Get default configuration from flow.json (simplified structure)
   */
  getDefaultConfig() {
    try {
      // Load the consolidated flow.json directly
      const flowConfig = loadMainFlowConfig();
      
      // Transform the simple flow.json structure into the expected format
      return this.transformFlowConfig(flowConfig);
    } catch (error) {
      console.warn('Failed to load Flow config, using fallback:', error.message);
      return {
        nodeEnv: 'development',
        vibekit: {
          enabled: true,
          defaultAgent: 'claude',
          streamingEnabled: true,
          githubIntegration: true,
          agents: {
            claude: { enabled: true, provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' }
          },
          environments: {
            e2b: { enabled: true, provider: 'e2b', apiKeyEnv: 'E2B_API_KEY' }
          }
        },
        github: { enabled: true, apiKeyEnv: 'GITHUB_API_KEY' },
        execution: { timeout: 300000 },
        logging: { level: 'info' }
      };
    }
  }

  /**
   * Transform the simple flow.json structure into the expected configuration format
   */
  transformFlowConfig(flowConfig) {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      vibekit: {
        enabled: true,
        defaultAgent: flowConfig.defaultAgent || 'claude',
        streamingEnabled: flowConfig.features?.streamingEnabled ?? true,
        githubIntegration: flowConfig.features?.githubIntegration ?? true,
        autoCreatePR: flowConfig.features?.autoCreatePR ?? false,
        agents: this.transformAgents(flowConfig.agents || {}),
        environments: this.transformSandboxes(flowConfig.sandboxes || {}),
        defaultEnvironment: flowConfig.defaultSandbox || 'e2b',
        sessionManagement: {
          enabled: flowConfig.session?.persistSessions ?? true,
          persistSessions: flowConfig.session?.persistSessions ?? true,
          sessionDir: flowConfig.session?.sessionDir || '.taskmaster/flow/sessions',
          maxSessionAge: flowConfig.session?.maxSessionAge || 604800000,
          cleanupInterval: flowConfig.session?.cleanupInterval || 86400000,
          autoResume: flowConfig.session?.autoResume ?? true
        },
        telemetry: {
          enabled: flowConfig.features?.telemetryEnabled ?? false,
          samplingRate: 0.1,
          batchSize: 100,
          flushInterval: 30000,
          serviceName: 'taskmaster-flow',
          serviceVersion: '1.0.0'
        },
        secrets: {
          enabled: flowConfig.features?.secretsManagement ?? true,
          provider: 'env'
        },
        askMode: {
          enabled: true,
          defaultMode: 'interactive',
          timeout: 60000,
          maxQuestions: 10
        },
        streaming: {
          enabled: flowConfig.features?.streamingOutput ?? true,
          bufferSize: 1000,
          flushInterval: 500,
          compression: false
        }
      },
      github: {
        enabled: flowConfig.github?.enabled ?? true,
        autoDetectRepo: flowConfig.github?.autoDetectRepo ?? true,
        defaultBranch: flowConfig.github?.defaultBranch || 'main',
        apiKeyEnv: flowConfig.github?.apiKeyEnv || 'GITHUB_API_KEY',
        autoSync: flowConfig.github?.autoSync ?? false,
        branchPrefix: flowConfig.github?.branchPrefix || 'taskmaster/',
        integration: {
          enabled: true,
          autoCreatePR: flowConfig.github?.autoCreatePR ?? false,
          autoMerge: flowConfig.github?.autoMerge ?? false,
          requireReviews: flowConfig.github?.requireReviews ?? true,
          deleteSourceBranch: flowConfig.github?.deleteSourceBranch ?? false
        },
        pullRequest: {
          assignToCreator: true,
          addLabels: ['taskmaster', 'automated'],
          requestReviewers: [],
          draft: false
        },
        commit: {
          messageTemplate: '[TaskMaster] {task_title}',
          signCommits: false,
          author: {}
        }
      },
      execution: {
        timeout: flowConfig.limits?.timeout || 300000,
        maxRetries: flowConfig.limits?.maxRetries || 2,
        streamOutput: flowConfig.features?.streamingOutput ?? true,
        parallelTasks: flowConfig.limits?.parallelTasks || 3
      },
      logging: {
        level: flowConfig.logging?.level || 'info',
        enableTelemetry: flowConfig.logging?.enableTelemetry ?? false,
        maxLogSize: flowConfig.logging?.maxLogSize || 10485760,
        console: {
          enabled: flowConfig.logging?.console?.enabled ?? true,
          colorize: flowConfig.logging?.console?.colorize ?? true,
          timestamp: flowConfig.logging?.console?.timestamp ?? true,
          format: 'simple'
        },
        file: {
          enabled: flowConfig.logging?.file?.enabled ?? false,
          path: flowConfig.logging?.file?.path || '.taskmaster/logs/flow.log',
          maxSize: flowConfig.logging?.file?.maxSize || '10MB',
          maxFiles: flowConfig.logging?.file?.maxFiles || 5,
          rotateDaily: true
        }
      },
      ast: {
        enabled: false
      }
    };
  }

  /**
   * Transform agents from flow.json format to expected format
   */
  transformAgents(agents) {
    const transformed = {};
    for (const [name, config] of Object.entries(agents)) {
      transformed[name] = {
        name: name,
        displayName: this.getAgentDisplayName(name),
        enabled: config.enabled ?? true,
        maxTokens: config.maxTokens || 4000,
        temperature: config.temperature || 0.1,
        modelName: config.modelName,
        provider: config.provider,
        apiKey: null, // Will be populated from environment
        apiKeyEnv: config.apiKeyEnv,
        description: this.getAgentDescription(name),
        capabilities: this.getAgentCapabilities(name),
        limits: {
          maxTokens: config.maxTokens || 4000,
          contextWindow: this.getAgentContextWindow(name),
          rateLimitRpm: 1000,
          rateLimitTpm: 40000
        },
        features: {
          streaming: true,
          functionCalling: name !== 'opencode',
          codeExecution: name === 'opencode',
          imageAnalysis: ['claude', 'gemini'].includes(name),
          multimodal: ['claude', 'gemini'].includes(name)
        },
        pricing: {
          inputCostPer1kTokens: this.getAgentInputCost(name),
          outputCostPer1kTokens: this.getAgentOutputCost(name),
          currency: 'USD'
        }
      };
    }
    return transformed;
  }

  /**
   * Transform sandboxes from simplified sandboxes.json format to expected format
   */
  transformSandboxes(sandboxes) {
    const transformed = {};
    for (const [name, config] of Object.entries(sandboxes)) {
      transformed[name] = {
        name: name,
        displayName: this.getSandboxDisplayName(name),
        enabled: config.active ?? false,
        rank: config.rank || 999,
        apiKey: null, // Will be populated from environment
        apiKeyEnv: config.apiKeyEnv,
        description: this.getSandboxDescription(name),
        capabilities: ['code-execution', 'file-system', 'network-access'],
        features: {
          persistence: true,
          networking: true,
          customImages: name === 'e2b',
          prebuiltTemplates: name === 'e2b'
        }
      };
    }
    return transformed;
  }

  // Helper methods for agent metadata
  getAgentDisplayName(name) {
    const names = {
      claude: 'Claude Code',
      codex: 'OpenAI Codex',
      gemini: 'Google Gemini',
      opencode: 'OpenCode'
    };
    return names[name] || name;
  }

  getAgentDescription(name) {
    const descriptions = {
      claude: 'Claude 3 Opus optimized for code generation and analysis',
      codex: 'OpenAI\'s GPT-4 Turbo optimized for code generation',
      gemini: 'Google\'s Gemini 1.5 Pro for advanced code generation',
      opencode: 'DeepSeek Coder v2 optimized for code generation and analysis'
    };
    return descriptions[name] || `${name} agent for code generation`;
  }

  getAgentCapabilities(name) {
    const base = ['code-generation', 'code-analysis', 'debugging', 'refactoring', 'documentation'];
    if (['gemini', 'codex'].includes(name)) {
      base.push('explanation');
    }
    if (name === 'gemini') {
      base.push('multimodal');
    }
    return base;
  }

  getAgentContextWindow(name) {
    const windows = {
      claude: 200000,
      codex: 128000,
      gemini: 1000000,
      opencode: 32000
    };
    return windows[name] || 128000;
  }

  getAgentInputCost(name) {
    const costs = {
      claude: 0.015,
      codex: 0.01,
      gemini: 0.0035,
      opencode: 0.0014
    };
    return costs[name] || 0.01;
  }

  getAgentOutputCost(name) {
    const costs = {
      claude: 0.075,
      codex: 0.03,
      gemini: 0.0105,
      opencode: 0.0028
    };
    return costs[name] || 0.03;
  }

  // Helper methods for sandbox metadata
  getSandboxDisplayName(name) {
    const names = {
      e2b: 'E2B',
      northflank: 'Northflank',
      daytona: 'Daytona'
    };
    return names[name] || name;
  }

  getSandboxDescription(name) {
    const descriptions = {
      e2b: 'E2B cloud sandbox environment for secure code execution',
      northflank: 'Northflank cloud platform for application deployment',
      daytona: 'Daytona development environment platform'
    };
    return descriptions[name] || `${name} sandbox environment`;
  }

  /**
   * Load configuration with precedence: env vars > flow.json defaults
   * Simplified to use flow.json as the primary source instead of complex saved config
   */
  async loadConfig() {
    try {
      // Start with defaults from flow.json (simplified structure)
      let configData = this.getDefaultConfig();

      // Apply environment variable overrides (this populates API keys)
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
   * Save configuration to flow.json (simplified structure)
   * Note: API keys are not saved to file, they come from environment variables
   */
  async saveConfig(config = this.config) {
    console.warn('⚠️ Configuration is now managed through flow.json and environment variables.');
    console.warn('   To modify settings, edit: scripts/modules/flow/config/flow.json');
    console.warn('   API keys should be set as environment variables (see apiKeyEnv fields)');
    
    // For now, just validate the current config but don't save to file
    if (config) {
      FlowConfigSchema.parse(config);
      console.log('✅ Current configuration is valid');
    }
    
    return config;
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