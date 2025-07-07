/**
 * Task Master Flow - Schema Type Guards
 * Phase 1: Schema & Storage Layer
 * 
 * Runtime type guards for schema validation and type checking.
 */

import { 
  SandboxConfig, 
  SandboxProvider,
  SandboxResourceConfig 
} from './sandbox.schema.js';

import { 
  AgentConfig, 
  AgentProvider,
  AgentModelConfig 
} from './agent.schema.js';

import { 
  ExecutionConfig, 
  ExecutionEnvironment,
  ExecutionResult,
  ExecutionStatus 
} from './execution.schema.js';

import { 
  FlowMetadata, 
  SchemaVersion,
  SystemInfo 
} from './metadata.schema.js';

import { validateSchema } from './validation.js';

/**
 * Check if data is a valid SandboxConfig
 * 
 * @param {unknown} data - Data to check
 * @returns {boolean} True if data is valid SandboxConfig
 */
export const isSandboxConfig = (data) => {
  try {
    // Quick structural check first
    if (!data || typeof data !== 'object') return false;
    if (!data.provider || !data.resources) return false;
    
    // More detailed validation would require running the full schema
    // For performance, we do basic checks here
    return typeof data.provider === 'string' && 
           typeof data.resources === 'object' &&
           typeof data.resources.cpu === 'number' &&
           typeof data.resources.memory === 'number';
  } catch {
    return false;
  }
};

/**
 * Check if data is a valid AgentConfig
 * 
 * @param {unknown} data - Data to check
 * @returns {boolean} True if data is valid AgentConfig
 */
export const isAgentConfig = (data) => {
  try {
    if (!data || typeof data !== 'object') return false;
    if (!data.provider || !data.model) return false;
    
    return typeof data.provider === 'string' && 
           typeof data.model === 'object' &&
           typeof data.model.name === 'string';
  } catch {
    return false;
  }
};

/**
 * Check if data is a valid ExecutionConfig
 * 
 * @param {unknown} data - Data to check
 * @returns {boolean} True if data is valid ExecutionConfig
 */
export const isExecutionConfig = (data) => {
  try {
    if (!data || typeof data !== 'object') return false;
    if (!data.taskId || !data.sandbox || !data.agent) return false;
    
    return typeof data.taskId === 'string' &&
           isSandboxConfig(data.sandbox) &&
           isAgentConfig(data.agent);
  } catch {
    return false;
  }
};

/**
 * Check if data is a valid FlowMetadata
 * 
 * @param {unknown} data - Data to check
 * @returns {boolean} True if data is valid FlowMetadata
 */
export const isFlowMetadata = (data) => {
  try {
    if (!data || typeof data !== 'object') return false;
    if (!data.id || !data.type || !data.schemaVersion || !data.audit) return false;
    
    return typeof data.id === 'string' &&
           typeof data.type === 'string' &&
           typeof data.schemaVersion === 'object' &&
           typeof data.audit === 'object';
  } catch {
    return false;
  }
};

/**
 * Check if provider string is valid
 * 
 * @param {unknown} provider - Provider to check
 * @param {string} type - Type of provider ('sandbox' or 'agent')
 * @returns {boolean} True if provider is valid
 */
export const isValidProvider = (provider, type = 'sandbox') => {
  if (typeof provider !== 'string') return false;
  
  if (type === 'sandbox') {
    return ['mock', 'e2b', 'northflank', 'modal'].includes(provider);
  } else if (type === 'agent') {
    return ['mock', 'claude', 'codex', 'gemini', 'claude-code'].includes(provider);
  }
  
  return false;
};

/**
 * Check if execution status is valid
 * 
 * @param {unknown} status - Status to check
 * @returns {boolean} True if status is valid
 */
export const isValidExecutionStatus = (status) => {
  if (typeof status !== 'string') return false;
  
  return [
    'pending', 'queued', 'running', 'completed', 
    'failed', 'cancelled', 'timeout'
  ].includes(status);
};

/**
 * Check if schema version is valid
 * 
 * @param {unknown} version - Version to check
 * @returns {boolean} True if version is valid
 */
export const isValidSchemaVersion = (version) => {
  try {
    if (!version || typeof version !== 'object') return false;
    
    return typeof version.major === 'number' &&
           typeof version.minor === 'number' &&
           typeof version.patch === 'number' &&
           version.major >= 0 && version.minor >= 0 && version.patch >= 0;
  } catch {
    return false;
  }
};

/**
 * Check if resource configuration is valid
 * 
 * @param {unknown} resources - Resources to check
 * @returns {boolean} True if resources are valid
 */
export const isValidResourceConfig = (resources) => {
  try {
    if (!resources || typeof resources !== 'object') return false;
    
    const { cpu, memory } = resources;
    
    return typeof cpu === 'number' && cpu > 0 && cpu <= 16 &&
           typeof memory === 'number' && memory >= 128 && memory <= 32768;
  } catch {
    return false;
  }
};

/**
 * Check if model configuration is valid
 * 
 * @param {unknown} model - Model to check
 * @returns {boolean} True if model is valid
 */
export const isValidModelConfig = (model) => {
  try {
    if (!model || typeof model !== 'object') return false;
    if (!model.name || typeof model.name !== 'string') return false;
    
    // Check optional temperature range
    if (model.temperature !== undefined) {
      if (typeof model.temperature !== 'number' || 
          model.temperature < 0 || model.temperature > 2) {
        return false;
      }
    }
    
    // Check optional maxTokens range
    if (model.maxTokens !== undefined) {
      if (typeof model.maxTokens !== 'number' || 
          model.maxTokens < 1 || model.maxTokens > 200000) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if environment variables are valid
 * 
 * @param {unknown} env - Environment variables to check
 * @returns {boolean} True if environment is valid
 */
export const isValidEnvironment = (env) => {
  try {
    if (!env || typeof env !== 'object') return true; // Optional
    
    // Check variables
    if (env.variables && typeof env.variables !== 'object') return false;
    if (env.secrets && typeof env.secrets !== 'object') return false;
    
    // Check that all values are strings
    if (env.variables) {
      for (const [key, value] of Object.entries(env.variables)) {
        if (typeof key !== 'string' || typeof value !== 'string') return false;
      }
    }
    
    if (env.secrets) {
      for (const [key, value] of Object.entries(env.secrets)) {
        if (typeof key !== 'string' || typeof value !== 'string') return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Advanced type guard that validates with full schema
 * 
 * @param {unknown} data - Data to validate
 * @param {S.Schema} schema - Schema to validate against
 * @returns {Promise<boolean>} Promise that resolves to validation result
 */
export const isValidBySchema = async (data, schema) => {
  try {
    const validation = validateSchema(schema, data);
    await validation; // This will throw if validation fails
    return true;
  } catch {
    return false;
  }
};

/**
 * Type guard factory for creating custom guards
 * 
 * @param {S.Schema} schema - Schema to create guard for
 * @param {string} name - Name for the guard
 * @returns {Function} Type guard function
 */
export const createTypeGuard = (schema, name = 'unknown') => {
  return (data) => {
    try {
      // Basic null/undefined check
      if (data == null) return false;
      
      // For complex schemas, we'd need to run full validation
      // For now, return a simplified check
      return typeof data === 'object';
    } catch {
      return false;
    }
  };
};

/**
 * Validate and narrow type in one operation
 * 
 * @param {unknown} data - Data to validate
 * @param {Function} guard - Type guard function
 * @param {string} errorMessage - Error message if validation fails
 * @returns {unknown} Validated data (throws if invalid)
 */
export const assertType = (data, guard, errorMessage = 'Type assertion failed') => {
  if (!guard(data)) {
    throw new TypeError(errorMessage);
  }
  return data;
};

/**
 * Collection of all type guards for easy access
 */
export const typeGuards = {
  isSandboxConfig,
  isAgentConfig,
  isExecutionConfig,
  isFlowMetadata,
  isValidProvider,
  isValidExecutionStatus,
  isValidSchemaVersion,
  isValidResourceConfig,
  isValidModelConfig,
  isValidEnvironment,
  isValidBySchema,
  createTypeGuard,
  assertType
};

/**
 * JSDoc type definitions
 * 
 * @typedef {Function} TypeGuard
 * @property {unknown} data - Data to check
 * @returns {boolean} Whether data matches the type
 */ 