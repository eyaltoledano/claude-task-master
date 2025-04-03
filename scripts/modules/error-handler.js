/**
 * error-handler.js
 * Common error handling utilities for Claude Task Master
 */

import chalk from 'chalk';
import { log } from './logger.js';

// Define error categories
export const ERROR_CATEGORIES = {
  SYSTEM: 'system',
  SERVICE: 'service',
  API: 'api',
  VALIDATION: 'validation',
  IO: 'io'
};

/**
 * Create a standardized error object
 * @param {string} message - Error message
 * @param {Object} options - Error options
 * @returns {Error} Enhanced error object
 */
function create(message, options = {}) {
  const error = new Error(message);
  
  // Add additional properties to the error
  error.name = options.name || 'TaskMasterError';
  error.code = options.code || 'ERR_UNKNOWN';
  error.category = options.category || ERROR_CATEGORIES.SYSTEM;
  error.suggestion = options.suggestion || null;
  error.timestamp = new Date().toISOString();
  
  return error;
}

/**
 * Handle an error with consistent logging and enhancement
 * @param {Error} error - Original error
 * @param {Object} options - Options for handling the error
 * @returns {Error} Enhanced error object
 */
function handle(error, options = {}) {
  // Create enhanced error object
  const enhancedError = error.name === 'TaskMasterError' ? error : create(
    options.message || error.message,
    {
      name: options.name || error.name || 'TaskMasterError',
      code: options.code || error.code || 'ERR_UNKNOWN',
      category: options.category || error.category || ERROR_CATEGORIES.SYSTEM,
      suggestion: options.suggestion || error.suggestion || 'Check the logs for more details'
    }
  );
  
  // Copy stack trace if available
  if (error.stack) {
    enhancedError.originalStack = error.stack;
  }
  
  // Log the error
  log('error', `${enhancedError.code}: ${enhancedError.message}`);
  
  if (enhancedError.suggestion) {
    log('info', chalk.yellow(`Suggestion: ${enhancedError.suggestion}`));
  }
  
  // Return the enhanced error for further handling
  return enhancedError;
}

// Export error handler functions
const errorHandler = {
  create,
  handle,
  ERROR_CATEGORIES
};

export default errorHandler; 