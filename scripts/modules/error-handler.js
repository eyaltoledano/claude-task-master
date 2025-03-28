/**
 * Error Handler Module
 * 
 * Provides centralized error handling functionality for the application with
 * consistent error capture, logging, and presentation to users.
 */

import chalk from 'chalk';
import { log } from './logger.js';
import { CONFIG } from './config.js';

// Error severity levels
export const ERROR_SEVERITY = {
  INFO: 'info',        // Informational message, not a true error
  WARNING: 'warning',  // Non-critical error that doesn't stop execution
  ERROR: 'error',      // Standard error that may stop current operation
  FATAL: 'fatal'       // Critical error that should stop application
};

// Error categories for better organization and handling
export const ERROR_CATEGORY = {
  INPUT: 'input',           // User input errors
  FILE_SYSTEM: 'filesystem', // File read/write errors
  NETWORK: 'network',       // Network/API connection errors
  API: 'api',               // API response errors
  APPLICATION: 'application', // General application errors
  VALIDATION: 'validation', // Data validation errors
  STATE: 'state',           // State persistence/recovery errors
  CONFIGURATION: 'configuration', // Configuration errors
  COMMAND: 'command'        // Command execution errors
};

// Factory for creating standardized error objects
export function createError(message, options = {}) {
  const timestamp = new Date().toISOString();
  
  return {
    message,
    timestamp,
    severity: options.severity || ERROR_SEVERITY.ERROR,
    category: options.category || ERROR_CATEGORY.APPLICATION,
    code: options.code || 'ERR_UNKNOWN',
    context: options.context || {},
    source: options.source || 'unknown',
    suggestion: options.suggestion || null,
    originalError: options.originalError || null
  };
}

/**
 * Format an error message for console output
 * @param {Object} error - Error object from createError
 * @param {boolean} verbose - Whether to show detailed error information
 * @returns {string} Formatted error message for display
 */
export function formatErrorMessage(error, verbose = false) {
  let output = '';
  
  // Color based on severity
  const colorFn = {
    [ERROR_SEVERITY.INFO]: chalk.blue,
    [ERROR_SEVERITY.WARNING]: chalk.yellow,
    [ERROR_SEVERITY.ERROR]: chalk.red,
    [ERROR_SEVERITY.FATAL]: chalk.bgRed.white
  }[error.severity] || chalk.red;
  
  // Format header
  const header = `[${error.severity.toUpperCase()}] ${error.message}`;
  output += colorFn(header) + '\n';
  
  // Add suggestion if available
  if (error.suggestion) {
    output += chalk.green(`Suggestion: ${error.suggestion}`) + '\n';
  }
  
  // Add more details in verbose mode
  if (verbose) {
    output += chalk.gray(`Category: ${error.category}`) + '\n';
    output += chalk.gray(`Code: ${error.code}`) + '\n';
    output += chalk.gray(`Source: ${error.source}`) + '\n';
    output += chalk.gray(`Time: ${error.timestamp}`) + '\n';
    
    // Add context if available
    if (Object.keys(error.context).length > 0) {
      output += chalk.gray('Context:') + '\n';
      for (const [key, value] of Object.entries(error.context)) {
        output += chalk.gray(`  ${key}: ${JSON.stringify(value)}`) + '\n';
      }
    }
    
    // Add original error if available
    if (error.originalError) {
      output += chalk.gray('Original Error:') + '\n';
      output += chalk.gray(`  ${error.originalError.stack || error.originalError.message || error.originalError}`) + '\n';
    }
  }
  
  return output;
}

/**
 * The main error handler class for centralizing error management
 */
export class ErrorHandler {
  constructor() {
    this.errors = [];
    this.verbose = CONFIG.debug || false;
  }
  
  /**
   * Handle an error
   * @param {Object|Error|string} error - Error to handle
   * @param {Object} options - Additional options
   * @returns {Object} Standardized error object
   */
  handle(error, options = {}) {
    // Normalize the error to our standard format
    let standardError;
    
    if (typeof error === 'string') {
      standardError = createError(error, options);
    } else if (error instanceof Error) {
      standardError = createError(
        error.message,
        {
          ...options,
          originalError: error
        }
      );
    } else if (typeof error === 'object') {
      standardError = { ...error, ...options };
    } else {
      standardError = createError('Unknown error occurred', options);
    }
    
    // Log the error
    this.logError(standardError);
    
    // Store the error
    this.errors.push(standardError);
    
    // Display the error if needed
    if (options.display !== false) {
      this.displayError(standardError);
    }
    
    // Throw the error if needed
    if (options.throw === true) {
      if (standardError.originalError) {
        throw standardError.originalError;
      } else {
        const throwableError = new Error(standardError.message);
        throwableError.code = standardError.code;
        throwableError.context = standardError.context;
        throw throwableError;
      }
    }
    
    return standardError;
  }
  
  /**
   * Log an error using the logger module
   * @param {Object} error - Standardized error object
   */
  logError(error) {
    const severity = error.severity || ERROR_SEVERITY.ERROR;
    const message = `[${error.code}] ${error.message}`;
    
    switch (severity) {
      case ERROR_SEVERITY.INFO:
        log('info', message);
        break;
      case ERROR_SEVERITY.WARNING:
        log('warn', message);
        break;
      case ERROR_SEVERITY.ERROR:
      case ERROR_SEVERITY.FATAL:
        log('error', message);
        break;
      default:
        log('error', message);
    }
    
    // Log additional context in debug mode
    if (CONFIG.debug) {
      log('debug', `Error context: ${JSON.stringify({
        category: error.category,
        code: error.code,
        context: error.context,
        timestamp: error.timestamp
      })}`);
      
      if (error.originalError && error.originalError.stack) {
        log('debug', `Original error stack: ${error.originalError.stack}`);
      }
    }
  }
  
  /**
   * Display an error to the user
   * @param {Object} error - Standardized error object
   */
  displayError(error) {
    const formattedMessage = formatErrorMessage(error, this.verbose);
    console.error(formattedMessage);
  }
  
  /**
   * Get all recorded errors
   * @returns {Array} List of all errors
   */
  getErrors() {
    return [...this.errors];
  }
  
  /**
   * Clear all recorded errors
   */
  clearErrors() {
    this.errors = [];
  }
  
  /**
   * Set verbosity level for error display
   * @param {boolean} verbose - Whether to show detailed error information
   */
  setVerbose(verbose) {
    this.verbose = verbose;
  }
}

/**
 * Create a singleton instance for the application to use
 */
export const errorHandler = new ErrorHandler();

/**
 * Helper function to handle file system errors
 * @param {Error} error - Original error
 * @param {string} operation - File operation being performed
 * @param {string} filePath - Path to file
 * @param {Object} options - Additional options
 * @returns {Object} Standardized error object
 */
export function handleFileSystemError(error, operation, filePath, options = {}) {
  const message = `Error ${operation} file: ${filePath}`;
  
  const suggestion = error.code === 'ENOENT' 
    ? 'Check if the file exists and the path is correct'
    : error.code === 'EACCES'
    ? 'Check file permissions'
    : error.code === 'EISDIR'
    ? 'The path points to a directory, not a file'
    : null;
  
  return errorHandler.handle(error, {
    message,
    category: ERROR_CATEGORY.FILE_SYSTEM,
    code: `FS_${error.code || 'ERROR'}`,
    context: { operation, filePath },
    suggestion,
    ...options
  });
}

/**
 * Helper function to handle API errors
 * @param {Error} error - Original error
 * @param {string} service - API service name
 * @param {Object} options - Additional options
 * @returns {Object} Standardized error object
 */
export function handleApiError(error, service, options = {}) {
  let message = `Error calling ${service} API`;
  let code = 'API_ERROR';
  let suggestion = null;
  
  // Check for network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    message = `Cannot connect to ${service} API`;
    code = 'API_CONNECTION_ERROR';
    suggestion = 'Check your internet connection and try again';
  } 
  // Check for timeout
  else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
    message = `Request to ${service} API timed out`;
    code = 'API_TIMEOUT';
    suggestion = 'The service might be experiencing high load, try again later';
  }
  // Check for authentication errors
  else if (error.status === 401 || error.status === 403) {
    message = `Authentication error with ${service} API`;
    code = 'API_AUTH_ERROR';
    suggestion = 'Check your API key and permissions';
  }
  // Check for rate limiting
  else if (error.status === 429) {
    message = `Rate limit exceeded for ${service} API`;
    code = 'API_RATE_LIMIT';
    suggestion = 'Wait before making more requests';
  }
  
  return errorHandler.handle(error, {
    message,
    category: ERROR_CATEGORY.API,
    code,
    context: { service },
    suggestion,
    ...options
  });
}

/**
 * Helper function to handle command errors
 * @param {Error} error - Original error
 * @param {string} command - Command name
 * @param {Object} options - Additional options
 * @returns {Object} Standardized error object
 */
export function handleCommandError(error, command, options = {}) {
  return errorHandler.handle(error, {
    message: `Error executing command: ${command}`,
    category: ERROR_CATEGORY.COMMAND,
    code: 'CMD_EXECUTION_ERROR',
    context: { command },
    ...options
  });
}

/**
 * Helper function to handle validation errors
 * @param {string} message - Error message
 * @param {string} field - Field that failed validation
 * @param {*} value - Invalid value
 * @param {Object} options - Additional options
 * @returns {Object} Standardized error object
 */
export function handleValidationError(message, field, value, options = {}) {
  return errorHandler.handle(message, {
    severity: ERROR_SEVERITY.WARNING,
    category: ERROR_CATEGORY.VALIDATION,
    code: 'VALIDATION_ERROR',
    context: { field, value },
    ...options
  });
} 