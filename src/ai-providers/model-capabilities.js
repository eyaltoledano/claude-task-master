/**
 * src/ai-providers/model-capabilities.js
 * 
 * This file contains metadata about AI model capabilities to help with feature detection
 * and appropriate fallback mechanisms.
 */

import { log } from '../../scripts/modules/utils.js';

/**
 * Models known to have limited or no support for function calling/tool use.
 * This helps the system decide when to use alternative approaches.
 */
export const MODELS_WITHOUT_FUNCTION_CALLING = [
  // Google models
  'gemini-2.5-flash-preview-04-17-thinking',
  'gemini-1.5-flash',
  'gemini-1.0-pro',
  
  // Anthropic models without function calling
  'claude-instant-1.2',
  
  // Add other models as they are identified
];

/**
 * Check if a model is known to have limited or no function calling support.
 * 
 * @param {string} modelId - The model ID to check
 * @returns {boolean} - True if the model is known to have limited function calling support
 */
export function hasLimitedFunctionCalling(modelId) {
  if (!modelId) return false;
  
  // Direct match
  if (MODELS_WITHOUT_FUNCTION_CALLING.includes(modelId)) {
    return true;
  }
  
  // Partial match (for model families)
  for (const limitedModel of MODELS_WITHOUT_FUNCTION_CALLING) {
    if (modelId.includes(limitedModel)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Register a model as having limited function calling support.
 * This is useful when a model is discovered to have issues at runtime.
 * 
 * @param {string} modelId - The model ID to register
 */
export function registerLimitedFunctionCalling(modelId) {
  if (!modelId || MODELS_WITHOUT_FUNCTION_CALLING.includes(modelId)) {
    return;
  }
  
  log('info', `Registering model ${modelId} as having limited function calling support`);
  MODELS_WITHOUT_FUNCTION_CALLING.push(modelId);
}
