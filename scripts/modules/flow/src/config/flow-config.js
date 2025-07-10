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
      ui: { autoStartWithDefaults: false },
      features: { githubIntegration: true, streamingOutput: true }
    };
  }
}

/**
 * Load all agent configurations
 */
export function loadAgentConfigs() {
  try {
    const agentsConfigPath = path.join(__dirname, '..', '..', 'config', 'agents.json');
    const agentsData = JSON.parse(fs.readFileSync(agentsConfigPath, 'utf-8'));
    return agentsData.agents || {};
  } catch (error) {
    console.warn('Error loading agent configs:', error.message);
    return {};
  }
}

/**
 * Load all sandbox configurations
 */
export function loadSandboxConfigs() {
  try {
    const sandboxesConfigPath = path.join(__dirname, '..', '..', 'config', 'sandboxes.json');
    const sandboxesData = JSON.parse(fs.readFileSync(sandboxesConfigPath, 'utf-8'));
    return sandboxesData.sandboxes || {};
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
 * Filter enabled agents and sandboxes based on enabled/active flags
 */
function filterEnabledConfigs(allConfigs) {
  const filtered = {};
  for (const [name, config] of Object.entries(allConfigs)) {
    if (config.enabled || config.active) {
      filtered[name] = {
        ...config,
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
    
    // Load ALL agent and sandbox configs
    const allAgents = loadAgentConfigs();
    const allSandboxes = loadSandboxConfigs();
    
    // Filter to only enabled agents and sandboxes based on their individual enabled/active flags
    const enabledAgents = filterEnabledConfigs(allAgents);
    const enabledSandboxes = filterEnabledConfigs(allSandboxes);
    
    // Get default agent and sandbox (highest rank among enabled)
    const defaultAgent = getDefaultAgent(enabledAgents);
    const defaultSandbox = getDefaultSandbox(enabledSandboxes);
    
    // Combine into full configuration
    const fullConfig = {
      nodeEnv: process.env.NODE_ENV || 'development',
      
      // Main flow settings
      flow: mainFlowConfig,
      
      vibekit: {
        defaultAgent,
        agents: enabledAgents,
        environments: enabledSandboxes,
        defaultEnvironment: defaultSandbox
      },
      
      github: mainFlowConfig.github || {},
      execution: {},
      logging: mainFlowConfig.logging || {},
      ast: {}
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
 * Get default agent (highest rank among enabled agents)
 */
function getDefaultAgent(enabledAgents) {
  const agentRankings = {
    claude: 1,
    codex: 2,
    gemini: 3,
    opencode: 4
  };
  
  const sortedAgents = Object.keys(enabledAgents).sort((a, b) => 
    (agentRankings[a] || 999) - (agentRankings[b] || 999)
  );
  
  return sortedAgents[0] || 'claude';
}

/**
 * Get default sandbox (lowest rank number among active sandboxes)
 */
function getDefaultSandbox(enabledSandboxes) {
  const sortedSandboxes = Object.entries(enabledSandboxes)
    .sort((a, b) => (a[1].rank || 999) - (b[1].rank || 999));
  
  return sortedSandboxes[0]?.[0] || 'e2b';
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
 * Get enabled agent names based on agent configs
 */
export function getEnabledAgents() {
  const allAgents = loadAgentConfigs();
  return Object.keys(filterEnabledConfigs(allAgents));
}

/**
 * Get enabled sandbox names based on sandbox configs  
 */
export function getEnabledSandboxes() {
  const allSandboxes = loadSandboxConfigs();
  return Object.keys(filterEnabledConfigs(allSandboxes));
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
