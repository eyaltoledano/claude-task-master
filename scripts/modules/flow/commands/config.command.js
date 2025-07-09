/**
 * Flow Configuration Commands
 * Simplified commands for managing VibeKit Flow configuration
 */

import { FlowConfigManager, loadFlowConfig } from '../src/config/flow-config.js';
import chalk from 'chalk';
import fs from 'fs';

/**
 * Show current Flow configuration
 */
export async function showConfig(options = {}) {
  try {
    const { json = false, projectRoot = process.cwd() } = options;
    
    const configManager = await loadFlowConfig(projectRoot);
    const config = configManager.getConfig();
    
    if (json) {
      console.log(JSON.stringify(config, null, 2));
      return config;
    }

    console.log(chalk.cyan('🔧 Flow VibeKit Configuration'));
    console.log(chalk.gray('─'.repeat(50)));

    // Environment
    console.log(chalk.yellow('\n🌍 Environment:'));
    console.log(`   Node Environment: ${chalk.green(config.nodeEnv)}`);

    // VibeKit Configuration
    console.log(chalk.yellow('\n🤖 VibeKit:'));
    console.log(`   Enabled: ${config.vibekit.enabled ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`   Default Agent: ${chalk.green(config.vibekit.defaultAgent)}`);
    console.log(`   Streaming: ${config.vibekit.streamingEnabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
    console.log(`   GitHub Integration: ${config.vibekit.githubIntegration ? chalk.green('Enabled') : chalk.red('Disabled')}`);
    
    // Agents
    console.log(chalk.yellow('\n👥 Agents:'));
    for (const [agent, agentConfig] of Object.entries(config.vibekit.agents)) {
      const status = agentConfig.enabled ? chalk.green('Enabled') : chalk.gray('Disabled');
      console.log(`   ${agent}: ${status} (tokens: ${agentConfig.maxTokens}, temp: ${agentConfig.temperature})`);
    }

    // Execution Settings
    console.log(chalk.yellow('\n⚡ Execution:'));
    console.log(`   Timeout: ${chalk.cyan(config.execution.timeout)}ms`);
    console.log(`   Max Retries: ${chalk.cyan(config.execution.maxRetries)}`);
    console.log(`   Stream Output: ${config.execution.streamOutput ? chalk.green('Yes') : chalk.red('No')}`);

    // GitHub Settings
    console.log(chalk.yellow('\n📋 GitHub:'));
    console.log(`   Auto Detect Repo: ${config.github.autoDetectRepo ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`   Default Branch: ${chalk.green(config.github.defaultBranch)}`);

    // Environment validation
    const envValidation = configManager.validateEnvironment();
    if (envValidation.issues.length > 0 || envValidation.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Environment Issues:'));
      
      envValidation.issues.forEach(issue => {
        console.log(chalk.red(`   ❌ ${issue}`));
      });
      
      envValidation.warnings.forEach(warning => {
        console.log(chalk.yellow(`   ⚠️  ${warning}`));
      });
    } else {
      console.log(chalk.green('\n✅ Environment: All required settings configured'));
    }

    return config;
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to show configuration: ${error.message}`));
    throw error;
  }
}

/**
 * Validate Flow configuration
 */
export async function validateConfig(options = {}) {
  try {
    const { projectRoot = process.cwd() } = options;
    
    console.log('🔍 Validating Flow configuration...');
    
    const configManager = await loadFlowConfig(projectRoot);
    
    // Validate configuration structure
    const validation = configManager.validateConfig();
    
    if (!validation.valid) {
      console.log(chalk.red('\n❌ Configuration validation failed:'));
      validation.errors.forEach(error => {
        console.log(chalk.red(`   ${error}`));
      });
      return false;
    }
    
    // Validate environment
    const envValidation = configManager.validateEnvironment();
    
    if (!envValidation.valid) {
      console.log(chalk.yellow('\n⚠️  Environment validation issues:'));
      envValidation.issues.forEach(issue => {
        console.log(chalk.red(`   ❌ ${issue}`));
      });
    }
    
    if (envValidation.warnings.length > 0) {
      console.log(chalk.yellow('\n💡 Environment warnings:'));
      envValidation.warnings.forEach(warning => {
        console.log(chalk.yellow(`   ⚠️  ${warning}`));
      });
    }
    
    if (validation.valid && envValidation.valid) {
      console.log(chalk.green('✅ Configuration is valid'));
    }
    
    return validation.valid && envValidation.valid;
    
  } catch (error) {
    console.error(chalk.red(`❌ Validation failed: ${error.message}`));
    return false;
  }
}

/**
 * Set a configuration value
 */
export async function setConfigValue(path, value, options = {}) {
  try {
    const { projectRoot = process.cwd() } = options;
    
    const configManager = await loadFlowConfig(projectRoot);
    
    // Set the value
    configManager.setValue(path, value);
    
    // Save the updated configuration
    await configManager.saveConfig();
    
    console.log(chalk.green(`✅ Updated ${path} = ${value}`));
    
    return configManager.getConfig();
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to set ${path}: ${error.message}`));
    throw error;
  }
}

/**
 * Initialize Flow configuration with defaults
 */
export async function initConfig(options = {}) {
  try {
    const { projectRoot = process.cwd(), force = false } = options;
    
    const configManager = new FlowConfigManager({ projectRoot });
    
    // Check if config exists
    if (!force && configManager.configFile && fs.existsSync(configManager.configFile)) {
      console.log(chalk.yellow('⚠️  Configuration already exists. Use --force to overwrite.'));
      return;
    }
    
    console.log('🚀 Initializing Flow configuration...');
    
    // Load defaults and save
    await configManager.loadConfig();
    await configManager.saveConfig();
    
    console.log(chalk.green(`✅ Configuration initialized: ${configManager.configFile}`));
    
    // Show helpful next steps
    console.log(chalk.gray('\n💡 Next steps:'));
    console.log(chalk.gray('   1. Set required API keys in your .env file'));
    console.log(chalk.gray('   2. Run: task-master flow config --validate'));
    console.log(chalk.gray('   3. Run: task-master flow agents'));
    
    return configManager.getConfig();
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to initialize configuration: ${error.message}`));
    throw error;
  }
}
