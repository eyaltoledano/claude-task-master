/**
 * Enhanced Provider Registry
 * Integrates health monitoring, configuration management, and advanced provider features
 */

import { globalRegistry as baseRegistry } from './registry.js';
import { providerHealthMonitor } from './provider-health.js';
import { providerConfigManager } from './provider-config.js';

export class EnhancedProviderRegistry {
  constructor() {
    this.baseRegistry = baseRegistry;
    this.healthMonitor = providerHealthMonitor;
    this.configManager = providerConfigManager;
    
    this.initialized = false;
    this.activeProviders = new Map();
    this.providerStates = new Map();
    this.failoverChain = [];
    
    this.initializationPromise = this.initialize();
  }

  /**
   * Initialize the enhanced registry
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Load configuration
      await this.configManager.loadConfig();
      
      // Start health monitoring
      const envConfig = this.configManager.getEnvironmentConfig();
      this.healthMonitor.startMonitoring(envConfig.healthCheckInterval);
      
      // Set up failover chain
      this.setupFailoverChain();
      
      // Initialize provider states
      await this.initializeProviderStates();
      
      this.initialized = true;
      console.log('✅ Enhanced Provider Registry initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Provider Registry:', error.message);
      throw error;
    }
  }

  /**
   * Ensure registry is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initializationPromise;
    }
  }

  /**
   * Get provider with enhanced features
   */
  async getProvider(name, config = {}) {
    await this.ensureInitialized();
    
    const providerName = name || this.configManager.getActiveProvider();
    
    // Check provider health first
    const health = await this.healthMonitor.checkProviderHealth(providerName);
    
    if (health.status === 'error' || health.status === 'unhealthy') {
      console.warn(`⚠️ Provider ${providerName} is ${health.status}, attempting failover...`);
      return await this.handleProviderFailure(providerName, config);
    }

    // Get provider configuration
    const providerConfig = this.configManager.getProviderConfig(providerName);
    const mergedConfig = { ...providerConfig, ...config };

    // Get provider from base registry
    const provider = await this.baseRegistry.getProvider(providerName, mergedConfig);
    
    // Wrap provider with enhanced features
    const enhancedProvider = this.wrapProvider(provider, providerName, mergedConfig);
    
    this.activeProviders.set(providerName, enhancedProvider);
    this.updateProviderState(providerName, 'active');
    
    return enhancedProvider;
  }

  /**
   * Wrap provider with enhanced features
   */
  wrapProvider(provider, providerName, config) {
    const self = this;
    
    return new Proxy(provider, {
      get(target, prop) {
        const originalMethod = target[prop];
        
        if (typeof originalMethod !== 'function') {
          return originalMethod;
        }

        return async function(...args) {
          const startTime = Date.now();
          
          try {
            // Log method call
            self.logProviderActivity(providerName, prop, 'start');
            
            // Execute original method
            const result = await originalMethod.apply(target, args);
            
            // Log success
            const responseTime = Date.now() - startTime;
            self.logProviderActivity(providerName, prop, 'success', { responseTime });
            
            return result;
            
          } catch (error) {
            // Log error
            const responseTime = Date.now() - startTime;
            self.logProviderActivity(providerName, prop, 'error', { 
              responseTime, 
              error: error.message 
            });
            
            // Handle retries if configured
            if (config.maxRetries > 0) {
              return await self.retryWithBackoff(
                () => originalMethod.apply(target, args),
                config.maxRetries,
                prop
              );
            }
            
            throw error;
          }
        };
      }
    });
  }

  /**
   * Handle provider failure with failover
   */
  async handleProviderFailure(failedProvider, config) {
    console.log(`🔄 Handling failure for provider: ${failedProvider}`);
    
    this.updateProviderState(failedProvider, 'failed');
    
    // Try failover providers
    for (const fallbackProvider of this.failoverChain) {
      if (fallbackProvider === failedProvider) {
        continue;
      }
      
      try {
        console.log(`🔄 Attempting failover to: ${fallbackProvider}`);
        
        const health = await this.healthMonitor.checkProviderHealth(fallbackProvider);
        
        if (health.status === 'healthy') {
          const provider = await this.baseRegistry.getProvider(fallbackProvider, config);
          
          console.log(`✅ Failover to ${fallbackProvider} successful`);
          this.updateProviderState(fallbackProvider, 'active');
          
          return this.wrapProvider(provider, fallbackProvider, config);
        }
        
      } catch (error) {
        console.warn(`⚠️ Failover to ${fallbackProvider} failed:`, error.message);
        this.updateProviderState(fallbackProvider, 'failed');
      }
    }
    
    throw new Error(`All providers failed. Original error: ${failedProvider} is unavailable`);
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff(operation, maxRetries, operationName) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
                 const delay = Math.min(1000 * (2 ** (attempt - 1)), 10000); // Max 10s delay
        
        if (attempt > 1) {
          console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for ${operationName} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return await operation();
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed for ${operationName}:`, error.message);
      }
    }
    
    throw lastError;
  }

  /**
   * Set up failover chain based on configuration
   */
  setupFailoverChain() {
    const activeProvider = this.configManager.getActiveProvider();
    const allProviders = this.baseRegistry.getAvailableProviders();
    
    // Primary provider first, then others
    this.failoverChain = [activeProvider, ...allProviders.filter(p => p !== activeProvider)];
    
    console.log('🔗 Failover chain established:', this.failoverChain);
  }

  /**
   * Initialize provider states
   */
  async initializeProviderStates() {
    const providers = this.baseRegistry.getAvailableProviders();
    
    for (const provider of providers) {
      this.providerStates.set(provider, {
        status: 'unknown',
        lastCheck: null,
        consecutiveFailures: 0,
        totalRequests: 0,
        successfulRequests: 0,
        lastActivity: null
      });
    }
  }

  /**
   * Update provider state
   */
  updateProviderState(providerName, status) {
    const currentState = this.providerStates.get(providerName) || {};
    
    const updatedState = {
      ...currentState,
      status,
      lastCheck: Date.now(),
      consecutiveFailures: status === 'failed' ? 
        (currentState.consecutiveFailures || 0) + 1 : 0
    };
    
    this.providerStates.set(providerName, updatedState);
  }

  /**
   * Log provider activity
   */
  logProviderActivity(providerName, operation, status, metadata = {}) {
    const state = this.providerStates.get(providerName);
    if (!state) return;

    state.totalRequests++;
    state.lastActivity = Date.now();
    
    if (status === 'success') {
      state.successfulRequests++;
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 ${providerName}.${operation}: ${status}`, metadata);
    }
  }

  /**
   * Get provider status summary
   */
  getProviderStatus(providerName) {
    const state = this.providerStates.get(providerName);
    const health = this.healthMonitor.getProviderStats(providerName);
    
    return {
      name: providerName,
      state: state || null,
      health: health || null,
      isActive: this.activeProviders.has(providerName),
      uptime: this.healthMonitor.calculateUptime(providerName)
    };
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses() {
    const providers = this.baseRegistry.getAvailableProviders();
    return providers.map(provider => this.getProviderStatus(provider));
  }

  /**
   * Switch active provider
   */
  async switchProvider(providerName) {
    await this.ensureInitialized();
    
    // Validate provider exists
    if (!this.baseRegistry.getAvailableProviders().includes(providerName)) {
      throw new Error(`Provider '${providerName}' not found`);
    }
    
    // Check provider health
    const health = await this.healthMonitor.checkProviderHealth(providerName);
    
    if (health.status === 'error') {
      throw new Error(`Cannot switch to unhealthy provider '${providerName}': ${health.error}`);
    }
    
    // Update configuration
    await this.configManager.setActiveProvider(providerName);
    
    // Update failover chain
    this.setupFailoverChain();
    
    console.log(`🔄 Switched active provider to: ${providerName}`);
    
    return providerName;
  }

  /**
   * Run comprehensive diagnostics
   */
  async runDiagnostics(providerName) {
    await this.ensureInitialized();
    
    const targetProvider = providerName || this.configManager.getActiveProvider();
    
    console.log(`🔍 Running comprehensive diagnostics for ${targetProvider}...`);
    
    const diagnostics = await this.healthMonitor.runDiagnostics(targetProvider);
    const providerStatus = this.getProviderStatus(targetProvider);
    const configSummary = this.configManager.getConfigSummary();
    
    return {
      ...diagnostics,
      providerStatus,
      configSummary,
      timestamp: Date.now()
    };
  }

  /**
   * Generate comprehensive health report
   */
  async generateHealthReport() {
    await this.ensureInitialized();
    
    const healthReport = await this.healthMonitor.generateHealthReport();
    const providerStatuses = this.getAllProviderStatuses();
    const configSummary = this.configManager.getConfigSummary();
    
    return {
      timestamp: Date.now(),
      system: {
        initialized: this.initialized,
        activeProvider: this.configManager.getActiveProvider(),
        failoverChain: this.failoverChain,
        environment: process.env.NODE_ENV || 'development'
      },
      healthReport,
      providerStatuses,
      configSummary
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🔄 Shutting down Enhanced Provider Registry...');
    
    // Stop health monitoring
    this.healthMonitor.stopMonitoring();
    
    // Stop configuration watching
    this.configManager.unwatchConfig();
    
    // Clear active providers
    this.activeProviders.clear();
    
    console.log('✅ Enhanced Provider Registry shutdown complete');
  }

  // Delegate methods to base registry
  getAvailableProviders() {
    return this.baseRegistry.getAvailableProviders();
  }

  getProviderInfo(name) {
    return this.baseRegistry.getProviderInfo(name);
  }

  validateProviderConfig(name) {
    return this.baseRegistry.validateProviderConfig(name);
  }
}

// Global enhanced registry instance
export const enhancedRegistry = new EnhancedProviderRegistry(); 