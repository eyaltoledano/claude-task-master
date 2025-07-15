/**
 * Enhanced Provider Configuration Management
 * 
 * ⚠️ DEPRECATION NOTICE: This provider configuration system is being simplified
 * in favor of the unified flow-config.js. Complex features like profiles,
 * environment management, and dynamic switching are now handled by VibeKit.
 * 
 * Use scripts/modules/flow/src/config/flow-config.js for new configurations.
 */

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Simplified configuration schema for VibeKit providers
// Note: This is now deprecated in favor of flow-config.js
const ProviderConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  activeProvider: z.string().default('vibekit'),
  providers: z.object({
    vibekit: z.object({
      enabled: z.boolean().default(true),
      defaultAgent: z.enum(['claude', 'codex', 'gemini', 'opencode']).default('claude'),
      streamingEnabled: z.boolean().default(true),
      githubIntegration: z.boolean().default(true),
      autoCreatePR: z.boolean().default(false),
      timeout: z.number().min(1000).max(600000).default(300000), // 5 minutes
      maxRetries: z.number().min(0).max(5).default(2),
      
      // Agent-specific configurations (Updated to VibeKit spec)
      agentConfigs: z.object({
        'claude': z.object({
          enabled: z.boolean().default(true),
          maxTokens: z.number().default(4000),
          temperature: z.number().min(0).max(1).default(0.1)
        }).default({}),
        
        codex: z.object({
          enabled: z.boolean().default(false),
          maxTokens: z.number().default(2000),
          temperature: z.number().min(0).max(1).default(0.1)
        }).default({}),
        
                  'gemini': z.object({
          enabled: z.boolean().default(false),
          maxTokens: z.number().default(3000),
          temperature: z.number().min(0).max(1).default(0.1)
        }).default({}),
        
        opencode: z.object({
          enabled: z.boolean().default(false),
          maxTokens: z.number().default(2000),
          temperature: z.number().min(0).max(1).default(0.1)
        }).default({})
      }).default({})
    }).default({})
  }).default({}),
  
  // Environment-specific overrides
  environments: z.object({
    development: z.object({
      logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('debug'),
      enableTelemetry: z.boolean().default(true),
      healthCheckInterval: z.number().default(30000)
    }).default({}),
    
    production: z.object({
      logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
      enableTelemetry: z.boolean().default(false),
      healthCheckInterval: z.number().default(60000)
    }).default({}),
    
    test: z.object({
      logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('error'),
      enableTelemetry: z.boolean().default(false),
      healthCheckInterval: z.number().default(5000)
    }).default({})
  }).default({}),
  
  // User preferences
  preferences: z.object({
    defaultMode: z.enum(['code', 'ask']).default('code'),
    autoSaveEnabled: z.boolean().default(true),
    confirmExecutions: z.boolean().default(true),
    showDetailedErrors: z.boolean().default(true)
  }).default({})
});

export class ProviderConfigManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.configDir = path.join(projectRoot, '.taskmaster/flow/config');
    this.configFile = path.join(this.configDir, 'providers.json');
    this.profilesDir = path.join(this.configDir, 'profiles');
    
    this.currentConfig = null;
    this.watchers = [];
    
    this.ensureConfigDirectory();
  }

  /**
   * Ensure configuration directory exists
   */
  ensureConfigDirectory() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  /**
   * Load configuration from file or create default
   */
  async loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const configData = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        this.currentConfig = ProviderConfigSchema.parse(configData);
      } else {
        this.currentConfig = ProviderConfigSchema.parse({});
        await this.saveConfig();
      }
      
      return this.currentConfig;
    } catch (error) {
      console.warn('⚠️ Invalid provider configuration, using defaults:', error.message);
      this.currentConfig = ProviderConfigSchema.parse({});
      await this.saveConfig();
      return this.currentConfig;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig() {
    if (!this.currentConfig) {
      throw new Error('No configuration loaded');
    }

    try {
      const configJson = JSON.stringify(this.currentConfig, null, 2);
      fs.writeFileSync(this.configFile, configJson, 'utf8');
      console.log('💾 Provider configuration saved');
    } catch (error) {
      console.error('❌ Failed to save provider configuration:', error.message);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.currentConfig;
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig() {
    const env = process.env.NODE_ENV || 'development';
    return this.currentConfig?.environments?.[env] || this.currentConfig.environments.development;
  }

  /**
   * Get provider-specific configuration
   */
  getProviderConfig(providerName = 'vibekit') {
    return this.currentConfig?.providers?.[providerName] || this.currentConfig.providers.vibekit;
  }

  /**
   * Get agent-specific configuration
   */
  getAgentConfig(providerName = 'vibekit', agentName = 'claude') {
    const providerConfig = this.getProviderConfig(providerName);
    return providerConfig?.agentConfigs?.[agentName] || providerConfig.agentConfigs.claude;
  }

  /**
   * Update provider configuration
   */
  async updateProviderConfig(providerName, updates) {
    if (!this.currentConfig) {
      await this.loadConfig();
    }

    const currentProviderConfig = this.getProviderConfig(providerName);
    const updatedConfig = { ...currentProviderConfig, ...updates };

    // Validate the updated configuration
    const providerSchema = ProviderConfigSchema.shape.providers.shape[providerName];
    const validatedConfig = providerSchema.parse(updatedConfig);

    this.currentConfig.providers[providerName] = validatedConfig;
    await this.saveConfig();
    
    return validatedConfig;
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfig(providerName, agentName, updates) {
    if (!this.currentConfig) {
      await this.loadConfig();
    }

    const currentAgentConfig = this.getAgentConfig(providerName, agentName);
    const updatedConfig = { ...currentAgentConfig, ...updates };

    // Validate the updated configuration
    const agentSchema = ProviderConfigSchema.shape.providers.shape[providerName].shape.agentConfigs.shape[agentName];
    const validatedConfig = agentSchema.parse(updatedConfig);

    if (!this.currentConfig.providers[providerName]) {
      this.currentConfig.providers[providerName] = ProviderConfigSchema.shape.providers.shape[providerName].parse({});
    }
    
    if (!this.currentConfig.providers[providerName].agentConfigs) {
      this.currentConfig.providers[providerName].agentConfigs = {};
    }

    this.currentConfig.providers[providerName].agentConfigs[agentName] = validatedConfig;
    await this.saveConfig();
    
    return validatedConfig;
  }

  /**
   * Set active provider
   */
  async setActiveProvider(providerName) {
    if (!this.currentConfig) {
      await this.loadConfig();
    }

    this.currentConfig.activeProvider = providerName;
    await this.saveConfig();
    
    return providerName;
  }

  /**
   * Get active provider
   */
  getActiveProvider() {
    return this.currentConfig?.activeProvider || 'vibekit';
  }

  /**
   * Create configuration profile
   */
  async createProfile(profileName, config) {
    const profilePath = path.join(this.profilesDir, `${profileName}.json`);
    
    // Validate configuration
    const validatedConfig = ProviderConfigSchema.parse(config);
    
    fs.writeFileSync(profilePath, JSON.stringify(validatedConfig, null, 2), 'utf8');
    console.log(`📁 Created configuration profile: ${profileName}`);
    
    return validatedConfig;
  }

  /**
   * Load configuration profile
   */
  async loadProfile(profileName) {
    const profilePath = path.join(this.profilesDir, `${profileName}.json`);
    
    if (!fs.existsSync(profilePath)) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    const validatedConfig = ProviderConfigSchema.parse(profileData);
    
    this.currentConfig = validatedConfig;
    await this.saveConfig();
    
    console.log(`📁 Loaded configuration profile: ${profileName}`);
    return validatedConfig;
  }

  /**
   * List available profiles
   */
  listProfiles() {
    if (!fs.existsSync(this.profilesDir)) {
      return [];
    }

    return fs.readdirSync(this.profilesDir)
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
  }

  /**
   * Delete configuration profile
   */
  async deleteProfile(profileName) {
    const profilePath = path.join(this.profilesDir, `${profileName}.json`);
    
    if (!fs.existsSync(profilePath)) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    fs.unlinkSync(profilePath);
    console.log(`🗑️ Deleted configuration profile: ${profileName}`);
  }

  /**
   * Export current configuration
   */
  async exportConfig(filePath) {
    if (!this.currentConfig) {
      await this.loadConfig();
    }

    const exportData = {
      ...this.currentConfig,
      exportedAt: new Date().toISOString(),
      exportedFrom: this.projectRoot
    };

    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    console.log(`📤 Configuration exported to: ${filePath}`);
  }

  /**
   * Import configuration
   */
  async importConfig(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }

    const importData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Remove export metadata
    const { exportedAt, exportedFrom, ...configData } = importData;
    
    const validatedConfig = ProviderConfigSchema.parse(configData);
    
    this.currentConfig = validatedConfig;
    await this.saveConfig();
    
    console.log(`📥 Configuration imported from: ${filePath}`);
    return validatedConfig;
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults() {
    this.currentConfig = ProviderConfigSchema.parse({});
    await this.saveConfig();
    
    console.log('🔄 Configuration reset to defaults');
    return this.currentConfig;
  }

  /**
   * Validate current configuration
   */
  validateConfig() {
    if (!this.currentConfig) {
      throw new Error('No configuration loaded');
    }

    try {
      ProviderConfigSchema.parse(this.currentConfig);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: error.errors || [error.message]
      };
    }
  }

  /**
   * Watch for configuration changes
   */
  watchConfig(callback) {
    if (!fs.existsSync(this.configFile)) {
      return;
    }

    const watcher = fs.watchFile(this.configFile, async () => {
      try {
        const oldConfig = { ...this.currentConfig };
        await this.loadConfig();
        callback(this.currentConfig, oldConfig);
      } catch (error) {
        console.error('❌ Error reloading configuration:', error.message);
      }
    });

    this.watchers.push(watcher);
    return watcher;
  }

  /**
   * Stop watching configuration
   */
  unwatchConfig() {
    this.watchers.forEach(watcher => {
      fs.unwatchFile(this.configFile, watcher);
    });
    this.watchers = [];
  }

  /**
   * Get configuration summary
   */
  getConfigSummary() {
    if (!this.currentConfig) {
      return null;
    }

    const activeProvider = this.getActiveProvider();
    const providerConfig = this.getProviderConfig(activeProvider);
    const envConfig = this.getEnvironmentConfig();

    return {
      activeProvider,
      defaultAgent: providerConfig.defaultAgent,
      streamingEnabled: providerConfig.streamingEnabled,
      githubIntegration: providerConfig.githubIntegration,
      environment: process.env.NODE_ENV || 'development',
      logLevel: envConfig.logLevel,
      healthCheckInterval: envConfig.healthCheckInterval,
      enabledAgents: Object.entries(providerConfig.agentConfigs)
        .filter(([, config]) => config.enabled)
        .map(([name]) => name),
      availableProfiles: this.listProfiles()
    };
  }
}

// Global configuration manager instance
export const providerConfigManager = new ProviderConfigManager(); 