/**
 * Provider Health Monitoring System
 * Tracks provider health, performs diagnostics, and monitors performance
 */

import { globalRegistry } from './registry.js';

export class ProviderHealthMonitor {
  constructor() {
    this.healthChecks = new Map();
    this.providerStats = new Map();
    this.healthHistory = new Map();
    this.monitoringInterval = null;
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(intervalMs = 30000) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      await this.checkAllProviders();
    }, intervalMs);

    console.log('🔍 Provider health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Perform comprehensive health check on all providers
   */
  async checkAllProviders() {
    const providers = globalRegistry.getAvailableProviders();
    const results = {};

    for (const providerName of providers) {
      try {
        results[providerName] = await this.checkProviderHealth(providerName);
      } catch (error) {
        results[providerName] = {
          status: 'error',
          error: error.message,
          timestamp: Date.now()
        };
      }
    }

    this.updateHealthHistory(results);
    return results;
  }

  /**
   * Check health of a specific provider
   */
  async checkProviderHealth(providerName) {
    const startTime = Date.now();
    
    try {
      // Validate configuration
      const configValidation = globalRegistry.validateProviderConfig(providerName);
      if (!configValidation.valid) {
        return {
          status: 'unhealthy',
          reason: 'configuration',
          missing: configValidation.missing,
          timestamp: Date.now(),
          responseTime: Date.now() - startTime
        };
      }

      // Try to instantiate provider
      const provider = await globalRegistry.getProvider(providerName);
      
      // Perform basic functionality test
      const healthStatus = await this.testProviderBasicFunctionality(provider, providerName);
      
      const responseTime = Date.now() - startTime;
      this.updateProviderStats(providerName, responseTime, healthStatus.status === 'healthy');

      return {
        ...healthStatus,
        responseTime,
        timestamp: Date.now()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateProviderStats(providerName, responseTime, false);
      
      return {
        status: 'error',
        reason: 'instantiation_failed',
        error: error.message,
        responseTime,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Test basic provider functionality
   */
  async testProviderBasicFunctionality(provider, providerName) {
    try {
      // Test VibeKit instantiation
      if (providerName === 'vibekit') {
        const testVibeKit = provider.createVibeKit({
          agent: 'claude'
        });
        
        if (!testVibeKit) {
          return {
            status: 'unhealthy',
            reason: 'vibekit_instantiation_failed'
          };
        }
      }

      return {
        status: 'healthy',
        reason: 'all_checks_passed'
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        reason: 'functionality_test_failed',
        error: error.message
      };
    }
  }

  /**
   * Update provider statistics
   */
  updateProviderStats(providerName, responseTime, success) {
    if (!this.providerStats.has(providerName)) {
      this.providerStats.set(providerName, {
        totalRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0,
        responseTimes: []
      });
    }

    const stats = this.providerStats.get(providerName);
    stats.totalRequests++;
    
    if (success) {
      stats.successfulRequests++;
    }

    stats.responseTimes.push(responseTime);
    if (stats.responseTimes.length > 100) {
      stats.responseTimes.shift(); // Keep only last 100 measurements
    }

    stats.averageResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
    
    this.providerStats.set(providerName, stats);
  }

  /**
   * Update health history
   */
  updateHealthHistory(results) {
    const timestamp = Date.now();
    
    for (const [providerName, health] of Object.entries(results)) {
      if (!this.healthHistory.has(providerName)) {
        this.healthHistory.set(providerName, []);
      }
      
      const history = this.healthHistory.get(providerName);
      history.push({ ...health, timestamp });
      
      // Keep only last 24 hours of history (assuming 30-second intervals)
      if (history.length > 2880) {
        history.shift();
      }
      
      this.healthHistory.set(providerName, history);
    }
  }

  /**
   * Get provider statistics
   */
  getProviderStats(providerName) {
    return this.providerStats.get(providerName) || null;
  }

  /**
   * Get provider health history
   */
  getProviderHealthHistory(providerName, hoursBack = 1) {
    const history = this.healthHistory.get(providerName) || [];
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    
    return history.filter(entry => entry.timestamp >= cutoffTime);
  }

  /**
   * Generate provider health report
   */
  async generateHealthReport() {
    const currentHealth = await this.checkAllProviders();
    const report = {
      timestamp: Date.now(),
      summary: {
        totalProviders: 0,
        healthyProviders: 0,
        unhealthyProviders: 0,
        errorProviders: 0
      },
      providers: {}
    };

    for (const [providerName, health] of Object.entries(currentHealth)) {
      report.summary.totalProviders++;
      
      if (health.status === 'healthy') {
        report.summary.healthyProviders++;
      } else if (health.status === 'unhealthy') {
        report.summary.unhealthyProviders++;
      } else {
        report.summary.errorProviders++;
      }

      const stats = this.getProviderStats(providerName);
      const recentHistory = this.getProviderHealthHistory(providerName, 1);
      
      report.providers[providerName] = {
        currentHealth: health,
        statistics: stats,
        recentHistory: recentHistory.slice(-10), // Last 10 checks
        uptime: this.calculateUptime(providerName)
      };
    }

    return report;
  }

  /**
   * Calculate provider uptime percentage
   */
  calculateUptime(providerName) {
    const history = this.healthHistory.get(providerName) || [];
    if (history.length === 0) return 0;

    const healthyChecks = history.filter(check => check.status === 'healthy').length;
    return (healthyChecks / history.length) * 100;
  }

  /**
   * Run comprehensive provider diagnostics
   */
  async runDiagnostics(providerName) {
    console.log(`🔍 Running comprehensive diagnostics for ${providerName}...`);
    
    const diagnostics = {
      timestamp: Date.now(),
      providerName,
      tests: {}
    };

    // Test 1: Configuration validation
    diagnostics.tests.configuration = this.testConfiguration(providerName);

    // Test 2: Environment variables
    diagnostics.tests.environment = this.testEnvironmentVariables(providerName);

    // Test 3: Provider instantiation
    try {
      diagnostics.tests.instantiation = await this.testProviderInstantiation(providerName);
    } catch (error) {
      diagnostics.tests.instantiation = {
        status: 'failed',
        error: error.message
      };
    }

    // Test 4: Basic functionality
    try {
      const provider = await globalRegistry.getProvider(providerName);
      diagnostics.tests.functionality = await this.testProviderBasicFunctionality(provider, providerName);
    } catch (error) {
      diagnostics.tests.functionality = {
        status: 'failed',
        error: error.message
      };
    }

    // Generate recommendations
    diagnostics.recommendations = this.generateRecommendations(diagnostics.tests);

    return diagnostics;
  }

  /**
   * Test provider configuration
   */
  testConfiguration(providerName) {
    const validation = globalRegistry.validateProviderConfig(providerName);
    return {
      status: validation.valid ? 'passed' : 'failed',
      valid: validation.valid,
      missing: validation.missing || [],
      optional: validation.optional || []
    };
  }

  /**
   * Test environment variables
   */
  testEnvironmentVariables(providerName) {
    const providerInfo = globalRegistry.getProviderInfo(providerName);
    const required = providerInfo.config.authentication.required;
    const optional = providerInfo.config.authentication.optional;

    const results = {
      status: 'passed',
      required: {},
      optional: {}
    };

    for (const envVar of required) {
      const exists = !!process.env[envVar];
      results.required[envVar] = {
        exists,
        configured: exists
      };
      
      if (!exists) {
        results.status = 'failed';
      }
    }

    for (const envVar of optional) {
      results.optional[envVar] = {
        exists: !!process.env[envVar],
        configured: !!process.env[envVar]
      };
    }

    return results;
  }

  /**
   * Test provider instantiation
   */
  async testProviderInstantiation(providerName) {
    try {
      const provider = await globalRegistry.getProvider(providerName);
      return {
        status: 'passed',
        message: 'Provider instantiated successfully'
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(tests) {
    const recommendations = [];

    if (tests.configuration.status === 'failed') {
      recommendations.push({
        type: 'critical',
        issue: 'Missing required configuration',
        action: `Set the following environment variables: ${tests.configuration.missing.join(', ')}`,
        priority: 'high'
      });
    }

    if (tests.environment.status === 'failed') {
      const missingRequired = Object.entries(tests.environment.required)
        .filter(([, config]) => !config.exists)
        .map(([envVar]) => envVar);
      
      if (missingRequired.length > 0) {
        recommendations.push({
          type: 'critical',
          issue: 'Missing required environment variables',
          action: `Configure: ${missingRequired.join(', ')}`,
          priority: 'high'
        });
      }
    }

    if (tests.instantiation.status === 'failed') {
      recommendations.push({
        type: 'error',
        issue: 'Provider instantiation failed',
        action: 'Check configuration and environment variables',
        priority: 'high'
      });
    }

    if (tests.functionality.status === 'unhealthy') {
      recommendations.push({
        type: 'warning',
        issue: 'Provider functionality test failed',
        action: 'Verify provider is properly configured and APIs are accessible',
        priority: 'medium'
      });
    }

    return recommendations;
  }
}

// Global health monitor instance
export const providerHealthMonitor = new ProviderHealthMonitor(); 