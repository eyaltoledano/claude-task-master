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
 * Load main flow configuration that controls enabled agents and sandboxes
 */
export function loadMainFlowConfig() {
  try {
    const flowConfigPath = path.join(__dirname, '..', '..', 'config', 'flow.json');
    return JSON.parse(fs.readFileSync(flowConfigPath, 'utf-8'));
  } catch (error) {
    console.warn('Error loading main flow config:', error.message);
    return {
      defaultAgent: 'claude-code',
      defaultSandbox: 'e2b',
      enabledAgents: ['claude-code'],
      enabledSandboxes: ['e2b'],
      ui: { showAgentSelector: true, showSandboxSelector: true },
      features: { githubIntegration: true, streamingOutput: true }
    };
  }
}

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
 * Filter enabled agents and sandboxes based on main flow config
 */
function filterEnabledConfigs(allConfigs, enabledList) {
  const filtered = {};
  for (const name of enabledList) {
    if (allConfigs[name]) {
      filtered[name] = {
        ...allConfigs[name],
        enabled: true // Ensure enabled is set to true
      };
    }
  }
  return filtered;
}

/**
 * Load complete Flow configuration
 */
export function loadFlowConfig() {
  try {
    // Load main flow configuration first
    const mainFlowConfig = loadMainFlowConfig();
    
    // Load core configurations
    const vibekit = loadCoreConfig('vibekit');
    const github = loadCoreConfig('github');
    const execution = loadCoreConfig('execution');
    const logging = loadCoreConfig('logging');
    const ast = loadCoreConfig('ast');
    
    // Load ALL agent and sandbox configs
    const allAgents = loadAgentConfigs();
    const allSandboxes = loadSandboxConfigs();
    
    // Filter to only enabled agents and sandboxes based on main flow config
    const enabledAgents = filterEnabledConfigs(allAgents, mainFlowConfig.enabledAgents);
    const enabledSandboxes = filterEnabledConfigs(allSandboxes, mainFlowConfig.enabledSandboxes);
    
    // Combine into full configuration
    const fullConfig = {
      nodeEnv: process.env.NODE_ENV || 'development',
      
      // Main flow settings
      flow: mainFlowConfig,
      
      vibekit: {
        ...vibekit,
        defaultAgent: mainFlowConfig.defaultAgent,
        agents: enabledAgents,
        environments: enabledSandboxes,
        defaultEnvironment: mainFlowConfig.defaultSandbox
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
 * Get available agent names (all agents, not just enabled)
 */
export function getAllAvailableAgents() {
  const allAgents = loadAgentConfigs();
  return Object.keys(allAgents);
}

/**
 * Get available sandbox names (all sandboxes, not just enabled)
 */
export function getAllAvailableSandboxes() {
  const allSandboxes = loadSandboxConfigs();
  return Object.keys(allSandboxes);
}

/**
 * Get enabled agent names based on main flow config
 */
export function getEnabledAgents() {
  const mainConfig = loadMainFlowConfig();
  return mainConfig.enabledAgents;
}

/**
 * Get enabled sandbox names based on main flow config
 */
export function getEnabledSandboxes() {
  const mainConfig = loadMainFlowConfig();
  return mainConfig.enabledSandboxes;
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
