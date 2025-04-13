/**
 * utils.js
 * 
 * Common utility functions for MCP tools
 */

import { findTasksJsonPath } from '../core/utils/path-utils.js';
import { getProjectRootFromSession } from '../core/utils/session-utils.js';
import { execSync } from 'child_process';
import path from 'path';
import logger from '../logger.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { renderTaskContent, renderComplexityReport, renderPrd, renderJsonContent } from '../../../scripts/modules/markdown-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create a success response with optional fromCache flag
 * @param {any} data - The data to include in the response
 * @param {boolean} fromCache - Whether the response was retrieved from cache
 * @returns {Object} Success response object
 */
export function createSuccessResponse(data, fromCache = false) {
  return {
    success: true,
    data,
    fromCache
  };
}

/**
 * Create an error response with optional error code and metadata
 * @param {string} message - Error message
 * @param {Object} options - Additional error options
 * @param {string} [options.code] - Error code
 * @returns {Object} Error response object
 */
export function createErrorResponse(message, options = {}) {
  return {
    success: false,
    error: {
      code: options.code || 'EXECUTION_ERROR',
      message: message || 'An unknown error occurred'
    },
    fromCache: false
  };
}

/**
 * Execute a cached function with proper error handling
 * @param {string} cacheKey - Cache key
 * @param {Function} executeFn - Function to execute
 * @param {Object} cacheOptions - Cache options
 * @param {Object} log - Logger instance
 * @returns {Promise<{result: any, fromCache: boolean}>} Result and cache status
 */
export async function getCachedOrExecute(cacheKey, executeFn, cacheOptions = {}, log) {
  try {
    // Simple implementation without actual caching for now
    const result = await executeFn();
    return { result, fromCache: false };
  } catch (error) {
    log.error(`Error executing function: ${error.message}`);
    throw error;
  }
}

/**
 * Process API result and transform into standard response format
 * @param {Object} result - Result from direct function
 * @param {Object} log - Logger instance
 * @param {string} errorPrefix - Prefix for error messages
 * @returns {Object} Standardized response
 */
export function handleApiResult(result, log, errorPrefix = 'Error') {
  if (!result) {
    log.error(`${errorPrefix}: No result returned`);
    return createErrorResponse(`${errorPrefix}: No result returned`);
  }

  if (!result.success) {
    log.error(`${errorPrefix}: ${result.error?.message || 'Unknown error'}`);
    return result; // Return the error result directly
  }

  return result; // Return success result
}

/**
 * Execute an MCP tool action with standard error handling
 * @param {Object} options - Options for execution
 * @param {Function} options.actionFn - The direct function to call
 * @param {Object} options.args - Arguments to pass to the function
 * @param {Object} options.log - Logger instance
 * @param {string} options.actionName - Name of the action for error messages
 * @param {Function} [options.processResult] - Optional function to process the result
 * @returns {Promise<Object>} Standardized response
 */
export async function executeMCPToolAction(options) {
  const { actionFn, args, log, actionName, processResult } = options;

  try {
    const result = await actionFn(args, log);
    
    // If a custom processor is provided, use it
    if (processResult && typeof processResult === 'function') {
      return processResult(result);
    }
    
    // Otherwise use the standard handler
    return handleApiResult(result, log, `Error executing ${actionName}`);
  } catch (error) {
    log.error(`Error in ${actionName}: ${error.message}`);
    return createErrorResponse(`Error in ${actionName}: ${error.message}`);
  }
}

/**
 * Safely handle long-running operations with proper timeout management
 * This helps prevent connection drops and improves tool reliability
 * 
 * @param {Function} asyncOperation - The async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @param {Object} logger - Optional logger instance
 * @returns {Promise<any>} - Result of the operation
 */
export const safeExecuteOperation = async (asyncOperation, timeoutMs = 30000, logger = console) => {
  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    // Race the operation against the timeout
    return await Promise.race([
      asyncOperation(),
      timeoutPromise
    ]);
  } catch (error) {
    logger.error(`Operation failed: ${error.message}`);
    throw error;
  }
};

/**
 * Format command result for display
 * 
 * @param {Object} result - The result object from the command execution
 * @param {string} type - The type of content ('task', 'complexity-report', 'prd', 'json', etc.)
 * @returns {Object} - Formatted result object with rich text if appropriate
 */
export function formatCommandResultForDisplay(result, type = 'text') {
  if (!result || !result.stdout) {
    return result;
  }

  try {
    // Try to parse as JSON first
    const parsedResult = JSON.parse(result.stdout);

    // If type is explicitly 'json' or result is valid JSON and no specific type,
    // use the JSON renderer
    if (type === 'json' || type === 'text') {
      return { ...result, stdout: renderJsonContent(parsedResult) };
    }

    // For other types that might contain JSON data but need specific formatting,
    // just stringify with pretty printing
    return { ...result, stdout: JSON.stringify(parsedResult, null, 2) };
  } catch (e) {
    // If not JSON, apply rich text formatting based on content type
    if (type === 'task' && result.stdout) {
      return { ...result, stdout: renderTaskContent(result.stdout) };
    } else if (type === 'complexity-report' && result.stdout) {
      return { ...result, stdout: renderComplexityReport(result.stdout) };
    } else if (type === 'prd' && result.stdout) {
      return { ...result, stdout: renderPrd(result.stdout) };
    } else if (type === 'json' && result.stdout) {
      // If explicitly asked for JSON but it's not valid, try to make it pretty anyway
      try {
        return { ...result, stdout: renderJsonContent(result.stdout) };
      } catch (jsonError) {
        // Fall back to original if that fails too
        return result;
      }
    }
    
    // Return original result if no formatting applied
    return result;
  }
}
