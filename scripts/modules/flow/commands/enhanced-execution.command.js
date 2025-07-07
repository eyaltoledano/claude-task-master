/**
 * Enhanced VibeKit Execution Commands
 * Uses enhanced provider registry with health monitoring, failover, and advanced error handling
 */

import { enhancedRegistry } from '../providers/enhanced-registry.js';

/**
 * Execute a task using enhanced VibeKit SDK with failover and monitoring
 */
export async function executeTask(taskId, options = {}) {
  let provider;
  
  try {
    console.log(`🚀 Executing task ${taskId} with Enhanced VibeKit...`);
    
    // Get task details
    const { getTask } = await import('../../task-manager/get-task.js');
    const task = await getTask({ id: taskId }, { projectRoot: options.projectRoot });
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Get enhanced provider with health checking and failover
    provider = await enhancedRegistry.getProvider('vibekit', {
      repository: options.repository,
      defaultAgent: options.agent || 'claude'
    });

    console.log(`🤖 Using agent: ${options.agent || 'claude'}`);

    // Execute task with enhanced monitoring
    const result = await provider.executeTask(task, {
      projectRoot: options.projectRoot,
      branch: options.branch,
      agent: options.agent,
      mode: options.mode || 'code',
      onProgress: (data) => {
        console.log(`📊 Progress: ${data.progress || 0}% - ${data.message || 'Processing...'}`);
        
        // Optional user-provided progress callback
        if (options.onProgress) {
          options.onProgress(data);
        }
      }
    });

    console.log(`✅ Task ${taskId} completed successfully!`);
    console.log(`📝 Summary: ${result.summary || 'No summary available'}`);
    
    if (result.files) {
      console.log(`📁 Files modified: ${result.files.length}`);
      result.files.forEach(file => console.log(`   - ${file}`));
    }

    return result;

  } catch (error) {
    console.error(`❌ Task execution failed: ${error.message}`);
    
    // Show provider diagnostics if available
    if (provider && error.message.includes('unhealthy')) {
      try {
        console.log('\n🔍 Running diagnostics...');
        const diagnostics = await enhancedRegistry.runDiagnostics();
        
        if (diagnostics.recommendations && diagnostics.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          diagnostics.recommendations.forEach(rec => {
            console.log(`   ${rec.type}: ${rec.action}`);
          });
        }
      } catch (diagError) {
        console.warn('⚠️ Could not run diagnostics:', diagError.message);
      }
    }
    
    throw error;
  }
}

/**
 * Generate code using enhanced VibeKit with monitoring and failover
 */
export async function generateCode(prompt, options = {}) {
  try {
    console.log(`🤖 Generating code with ${options.agent || 'claude'}...`);
    
    // Get enhanced provider
    const provider = await enhancedRegistry.getProvider('vibekit', {
      defaultAgent: options.agent || 'claude'
    });

    // Show provider status
    if (options.verbose) {
      const status = enhancedRegistry.getProviderStatus('vibekit');
      console.log(`📊 Provider status: ${status.state?.status || 'unknown'} (uptime: ${status.uptime.toFixed(1)}%)`);
    }

    // Generate code with streaming
    const result = await provider.generateCode(prompt, {
      mode: options.mode || 'code',
      onUpdate: (data) => {
        if (options.stream !== false) {
          // Enhanced streaming with better formatting
          if (data.content) {
            process.stdout.write(data.content);
          } else if (data.delta) {
            process.stdout.write(data.delta);
          }
        }
        
        // Optional user-provided update callback
        if (options.onUpdate) {
          options.onUpdate(data);
        }
      },
      onError: (error) => {
        console.error(`\n❌ Generation error: ${error.message}`);
        
        // Optional user-provided error callback
        if (options.onError) {
          options.onError(error);
        }
      }
    });

    console.log(`\n✅ Code generation completed!`);
    
    if (result.usage) {
      console.log(`📊 Tokens used: ${result.usage.total_tokens || 'unknown'}`);
    }
    
    return result;

  } catch (error) {
    console.error(`❌ Code generation failed: ${error.message}`);
    
    // Suggest alternatives if available
    const statuses = enhancedRegistry.getAllProviderStatuses();
    const healthyProviders = statuses.filter(s => s.state?.status === 'active');
    
    if (healthyProviders.length === 0) {
      console.log('\n💡 No healthy providers available. Try:');
      console.log('   1. Check your API keys');
      console.log('   2. Run: task-master flow health');
      console.log('   3. Run: task-master flow diagnostics');
    }
    
    throw error;
  }
}

/**
 * List available VibeKit agents with enhanced status information
 */
export async function listAgents(options = {}) {
  try {
    // Get provider info and current health
    const providerInfo = enhancedRegistry.getProviderInfo('vibekit');
    const providerStatus = enhancedRegistry.getProviderStatus('vibekit');
    
    if (options.json) {
      const output = {
        provider: 'vibekit',
        agents: providerInfo.agents,
        status: providerStatus,
        timestamp: Date.now()
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log('🤖 Enhanced VibeKit Agents Status:');
    console.log('');
    
    // Show provider health
    const health = providerStatus.state?.status || 'unknown';
    const uptime = providerStatus.uptime || 0;
    const healthIcon = health === 'active' ? '✅' : health === 'failed' ? '❌' : '⚠️';
    
    console.log(`Provider Health: ${healthIcon} ${health} (uptime: ${uptime.toFixed(1)}%)`);
    console.log('');
    
    // Show each agent
    for (const agent of providerInfo.agents) {
      const apiKey = getRequiredApiKey(agent);
      const configured = !!process.env[apiKey];
      const status = configured ? '✅' : '⚠️';
      
      console.log(`${status} ${agent}`);
      console.log(`   API Key: ${apiKey} ${configured ? '(configured)' : '(missing)'}`);
      
      // Show agent-specific configuration if available
      if (configured && options.verbose) {
        try {
          const agentConfig = enhancedRegistry.configManager.getAgentConfig('vibekit', agent);
          console.log(`   Max Tokens: ${agentConfig.maxTokens}`);
          console.log(`   Temperature: ${agentConfig.temperature}`);
        } catch (error) {
          // Ignore config errors
        }
      }
    }
    
    console.log('');
    console.log('Legend: ✅ Ready  ⚠️ Missing API Key');
    
    if (options.verbose) {
      console.log('');
      console.log('For detailed diagnostics: task-master flow diagnostics');
    }

  } catch (error) {
    console.error(`❌ Failed to list agents: ${error.message}`);
    throw error;
  }
}

/**
 * Switch the active provider
 */
export async function switchProvider(providerName, options = {}) {
  try {
    console.log(`🔄 Switching to provider: ${providerName}...`);
    
    const result = await enhancedRegistry.switchProvider(providerName);
    
    console.log(`✅ Successfully switched to provider: ${result}`);
    
    // Show new provider status
    if (options.verbose) {
      const status = enhancedRegistry.getProviderStatus(providerName);
      console.log(`📊 Provider status: ${status.state?.status || 'unknown'}`);
    }
    
    return result;

  } catch (error) {
    console.error(`❌ Failed to switch provider: ${error.message}`);
    
    // Show available providers
    console.log('\n💡 Available providers:');
    const providers = enhancedRegistry.getAvailableProviders();
    providers.forEach(provider => {
      console.log(`   - ${provider}`);
    });
    
    throw error;
  }
}

/**
 * Show provider health status
 */
export async function showProviderHealth(options = {}) {
  try {
    console.log('🏥 Provider Health Status');
    console.log('========================');
    console.log('');
    
    const healthReport = await enhancedRegistry.generateHealthReport();
    
    if (options.json) {
      console.log(JSON.stringify(healthReport, null, 2));
      return;
    }

    // System overview
    console.log('📊 System Overview:');
    console.log(`   Environment: ${healthReport.system.environment}`);
    console.log(`   Active Provider: ${healthReport.system.activeProvider}`);
    console.log(`   Initialized: ${healthReport.system.initialized ? 'Yes' : 'No'}`);
    console.log('');

    // Health summary
    const summary = healthReport.healthReport.summary;
    console.log('🏥 Health Summary:');
    console.log(`   Total Providers: ${summary.totalProviders}`);
    console.log(`   Healthy: ${summary.healthyProviders} ✅`);
    console.log(`   Unhealthy: ${summary.unhealthyProviders} ⚠️`);
    console.log(`   Error: ${summary.errorProviders} ❌`);
    console.log('');

    // Individual provider status
    console.log('📋 Provider Details:');
    for (const [providerName, data] of Object.entries(healthReport.healthReport.providers)) {
      const statusIcon = data.currentHealth.status === 'healthy' ? '✅' : 
                         data.currentHealth.status === 'unhealthy' ? '⚠️' : '❌';
      
      console.log(`   ${statusIcon} ${providerName}:`);
      console.log(`      Status: ${data.currentHealth.status}`);
      console.log(`      Uptime: ${data.uptime.toFixed(1)}%`);
      
      if (data.currentHealth.responseTime) {
        console.log(`      Response Time: ${data.currentHealth.responseTime}ms`);
      }
      
      if (data.currentHealth.reason) {
        console.log(`      Reason: ${data.currentHealth.reason}`);
      }
      
      if (data.statistics) {
        const stats = data.statistics;
        const successRate = stats.totalRequests > 0 ? 
          (stats.successfulRequests / stats.totalRequests * 100).toFixed(1) : 0;
        
        console.log(`      Success Rate: ${successRate}% (${stats.successfulRequests}/${stats.totalRequests})`);
        console.log(`      Avg Response: ${stats.averageResponseTime.toFixed(1)}ms`);
      }
      
      console.log('');
    }

    // Configuration summary
    if (options.verbose && healthReport.configSummary) {
      console.log('⚙️ Configuration:');
      const config = healthReport.configSummary;
      console.log(`   Default Agent: ${config.defaultAgent}`);
      console.log(`   Streaming: ${config.streamingEnabled ? 'Enabled' : 'Disabled'}`);
      console.log(`   GitHub Integration: ${config.githubIntegration ? 'Enabled' : 'Disabled'}`);
      console.log(`   Enabled Agents: ${config.enabledAgents.join(', ')}`);
      console.log('');
    }

  } catch (error) {
    console.error(`❌ Failed to get health status: ${error.message}`);
    throw error;
  }
}

/**
 * Run provider diagnostics
 */
export async function runDiagnostics(providerName, options = {}) {
  try {
    const targetProvider = providerName || 'vibekit';
    
    console.log(`🔍 Running diagnostics for ${targetProvider}...`);
    console.log('');
    
    const diagnostics = await enhancedRegistry.runDiagnostics(targetProvider);
    
    if (options.json) {
      console.log(JSON.stringify(diagnostics, null, 2));
      return;
    }

    console.log('🔍 Diagnostic Results:');
    console.log('=====================');
    console.log('');

    // Test results
    for (const [testName, result] of Object.entries(diagnostics.tests)) {
      const statusIcon = result.status === 'passed' ? '✅' : 
                         result.status === 'failed' ? '❌' : '⚠️';
      
      console.log(`${statusIcon} ${testName}: ${result.status}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.missing && result.missing.length > 0) {
        console.log(`   Missing: ${result.missing.join(', ')}`);
      }
      
      if (result.optional && result.optional.length > 0) {
        console.log(`   Optional: ${result.optional.join(', ')}`);
      }
    }
    
    console.log('');

    // Recommendations
    if (diagnostics.recommendations && diagnostics.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      diagnostics.recommendations.forEach(rec => {
        const priorityIcon = rec.priority === 'high' ? '🔴' : 
                            rec.priority === 'medium' ? '🟡' : '🟢';
        
        console.log(`   ${priorityIcon} ${rec.type}: ${rec.action}`);
      });
      console.log('');
    }

    // Provider status
    if (diagnostics.providerStatus) {
      console.log('📊 Provider Status:');
      const status = diagnostics.providerStatus;
      console.log(`   Status: ${status.state?.status || 'unknown'}`);
      console.log(`   Uptime: ${status.uptime?.toFixed(1) || 0}%`);
      console.log(`   Active: ${status.isActive ? 'Yes' : 'No'}`);
    }

  } catch (error) {
    console.error(`❌ Diagnostics failed: ${error.message}`);
    throw error;
  }
}

/**
 * Reset provider configuration to defaults
 */
export async function resetProviderConfig(options = {}) {
  try {
    console.log('🔄 Resetting provider configuration to defaults...');
    
    if (!options.force) {
      console.warn('⚠️ This will reset all provider configurations to defaults.');
      console.log('💡 Use --force to confirm this action.');
      return;
    }
    
    await enhancedRegistry.configManager.resetToDefaults();
    
    console.log('✅ Provider configuration reset to defaults');
    console.log('💡 You may need to reconfigure your API keys and preferences');

  } catch (error) {
    console.error(`❌ Failed to reset configuration: ${error.message}`);
    throw error;
  }
}

// Helper function to get required API key for each agent
function getRequiredApiKey(agent) {
  switch (agent) {
    case 'claude': return 'ANTHROPIC_API_KEY';
    case 'codex': return 'OPENAI_API_KEY';
    case 'gemini': return 'GOOGLE_API_KEY';
    case 'opencode': return 'OPENCODE_API_KEY';
    default: return 'ANTHROPIC_API_KEY';
  }
} 