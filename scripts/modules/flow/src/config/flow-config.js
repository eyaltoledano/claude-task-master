/**
 * Flow Configuration Loader
 * Loads configuration from organized JSON files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load all agent configurations
 */
export function loadAgentConfigs() {
  const agentsDir = path.join(__dirname, '..', '..', 'config', 'agents');
  const agentConfigs = {};
  
  try {
    const files = fs.readdirSync(agentsDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const agentName = path.basename(file, '.json');
        const configPath = path.join(agentsDir, file);
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        agentConfigs[config.name || agentName] = config;
      }
    }
    
    return agentConfigs;
  } catch (error) {
    console.warn('Error loading agent configs:', error.message);
    return {};
  }
}

/**
 * Load all sandbox configurations
 */
export function loadSandboxConfigs() {
  const sandboxesDir = path.join(__dirname, '..', '..', 'config', 'sandboxes');
  const sandboxConfigs = {};
  
  try {
    const files = fs.readdirSync(sandboxesDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const sandboxName = path.basename(file, '.json');
        const configPath = path.join(sandboxesDir, file);
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        sandboxConfigs[config.name || sandboxName] = config;
      }
    }
    
    return sandboxConfigs;
  } catch (error) {
    console.warn('Error loading sandbox configs:', error.message);
    return {};
  }
}

/**
 * Load core configuration file
 */
export function loadCoreConfig(configName) {
  try {
    const configPath = path.join(__dirname, '..', '..', 'config', 'core', `${configName}.json`);
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    console.warn(`Error loading ${configName} config:`, error.message);
    return {};
  }
}

/**
 * Load complete Flow configuration
 */
export function loadFlowConfig() {
  try {
    // Load core configurations
    const vibekit = loadCoreConfig('vibekit');
    const github = loadCoreConfig('github');
    const execution = loadCoreConfig('execution');
    const logging = loadCoreConfig('logging');
    const ast = loadCoreConfig('ast');
    
    // Load agent and sandbox configs
    const agents = loadAgentConfigs();
    const sandboxes = loadSandboxConfigs();
    
    // Combine into full configuration
    const fullConfig = {
      nodeEnv: process.env.NODE_ENV || 'development',
      
      vibekit: {
        ...vibekit,
        agents,
        environments: sandboxes
      },
      
      github,
      execution,
      logging,
      ast
    };
    
    return {
      success: true,
      config: fullConfig
    };
  } catch (error) {
    console.warn('Error loading Flow config:', error.message);
    return {
      success: false,
      error: error.message,
      config: null
    };
  }
}

/**
 * Get default Flow configuration
 */
export async function getDefaultFlowConfig() {
  const result = loadFlowConfig();
  return result.config;
}

// Re-export from other modules for backward compatibility
export { FlowConfigSchema } from './schemas/flow-config-schema.js';
export { FlowConfigManager, flowConfig, FlowConfig } from './managers/flow-config-manager.js';
export { applyEnvironmentOverrides } from './utils/env-overrides.js';
