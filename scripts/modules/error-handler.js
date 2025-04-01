/**
 * Centralized error handling module for PRD Generator
 * Provides consistent error handling across the application
 */

import { createLogger } from './logger.js';

// Logger for this module
const logger = createLogger('ErrorHandler');

/**
 * Error categories
 */
export const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  API: 'api',
  NETWORK: 'network',
  STORAGE: 'storage',
  PLUGIN: 'plugin',
  SYSTEM: 'system',
  UNKNOWN: 'unknown'
};

/**
 * Custom error class with enhanced properties
 */
export class TaskMasterError extends Error { // Renamed class
  /**
   * Create a new Task Master error
   * @param {string} message - Error message
   * @param {object} options - Error options
   */
  constructor(message, options = {}) {
    super(message);
    
    this.name = options.name || 'TaskMasterError'; // Renamed default name
    this.code = options.code || 'ERR_UNKNOWN';
    this.category = options.category || ERROR_CATEGORIES.UNKNOWN;
    this.details = options.details || {};
    this.timestamp = options.timestamp || new Date().toISOString();
    this.suggestion = options.suggestion || null;
    this.originalError = options.originalError || null;
    this.isRetryable = options.isRetryable || false;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TaskMasterError); // Use new class name
    }
  }

  /**
   * Convert error to a plain object
   * @returns {object} - Plain object representation
   */
  toObject() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      details: this.details,
      timestamp: this.timestamp,
      suggestion: this.suggestion,
      stack: this.stack,
      isRetryable: this.isRetryable
    };
  }

  /**
   * Convert error to a JSON string
   * @returns {string} - JSON string representation
   */
  toJSON() {
    return JSON.stringify(this.toObject());
  }

  /**
   * Get a user-friendly error message
   * @returns {string} - User-friendly error message
   */
  getUserMessage() {
    let message = this.message;
    
    if (this.suggestion) {
      message += `\n\nSuggestion: ${this.suggestion}`;
    }
    
    return message;
  }
}

/**
 * Error handler class
 */
export class ErrorHandler {
  /**
   * Create a new error handler
   */
  constructor() {
    this.errorListeners = [];
  }

  /**
   * Handle an error
   * @param {Error} error - Original error
   * @param {object} options - Error handling options
   * @returns {TaskMasterError} - Enhanced error
   */
  handle(error, options = {}) {
    // If already a TaskMasterError, just return it
    if (error instanceof TaskMasterError) {
      // Log the error
      this._logError(error);
      
      // Notify listeners
      this._notifyListeners(error);
      
      return error;
    }
    
    // Create an enhanced error
    const enhancedError = new TaskMasterError(
      options.message || error.message,
      {
        name: options.name || error.name,
        code: options.code || 'ERR_UNKNOWN',
        category: options.category || ERROR_CATEGORIES.UNKNOWN,
        details: options.details || {},
        suggestion: options.suggestion || null,
        originalError: error,
        isRetryable: options.isRetryable || false
      }
    );
    
    // Log the error
    this._logError(enhancedError);
    
    // Notify listeners
    this._notifyListeners(enhancedError);
    
    return enhancedError;
  }

  /**
   * Create a specific type of error
   * @param {string} message - Error message
   * @param {object} options - Error options
   * @returns {TaskMasterError} - Enhanced error
   */
  create(message, options = {}) {
    const error = new TaskMasterError(message, options);
    
    // Log the error
    this._logError(error);
    
    // Notify listeners
    this._notifyListeners(error);
    
    return error;
  }

  /**
   * Add an error listener
   * @param {Function} listener - Listener function
   */
  addListener(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    
    this.errorListeners.push(listener);
  }

  /**
   * Remove an error listener
   * @param {Function} listener - Listener function
   * @returns {boolean} - Whether the listener was removed
   */
  removeListener(listener) {
    const index = this.errorListeners.indexOf(listener);
    
    if (index === -1) {
      return false;
    }
    
    this.errorListeners.splice(index, 1);
    return true;
  }

  /**
   * Log an error
   * @param {TaskMasterError} error - Error to log
   * @private
   */
  _logError(error) {
    logger.error(error.message, {
      name: error.name,
      code: error.code,
      category: error.category,
      details: error.details,
      suggestion: error.suggestion,
      stack: error.stack
    });
  }

  /**
   * Notify listeners about an error
   * @param {TaskMasterError} error - Error to notify about
   * @private
   */
  _notifyListeners(error) {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (listenerError) {
        logger.error(`Error in error listener: ${listenerError.message}`);
      }
    }
  }

  /**
   * Create a validation error
   * @param {string} message - Error message
   * @param {object} details - Validation details
   * @returns {TaskMasterError} - Validation error
   */
  createValidationError(message, details = {}) {
    return this.create(message, {
      name: 'ValidationError',
      code: 'ERR_VALIDATION',
      category: ERROR_CATEGORIES.VALIDATION,
      details,
      suggestion: details.suggestion || 'Check the provided input values'
    });
  }

  /**
   * Create an API error
   * @param {string} message - Error message
   * @param {object} details - API details
   * @returns {TaskMasterError} - API error
   */
  createAPIError(message, details = {}) {
    return this.create(message, {
      name: 'APIError',
      code: details.code || 'ERR_API',
      category: ERROR_CATEGORIES.API,
      details,
      suggestion: details.suggestion || 'Check your API credentials and try again',
      isRetryable: details.isRetryable || false
    });
  }

  /**
   * Create a storage error
   * @param {string} message - Error message
   * @param {object} details - Storage details
   * @returns {TaskMasterError} - Storage error
   */
  createStorageError(message, details = {}) {
    return this.create(message, {
      name: 'StorageError',
      code: details.code || 'ERR_STORAGE',
      category: ERROR_CATEGORIES.STORAGE,
      details,
      suggestion: details.suggestion || 'Check file permissions or storage configuration'
    });
  }

  /**
   * Create a plugin error
   * @param {string} message - Error message
   * @param {object} details - Plugin details
   * @returns {TaskMasterError} - Plugin error
   */
  createPluginError(message, details = {}) {
    return this.create(message, {
      name: 'PluginError',
      code: details.code || 'ERR_PLUGIN',
      category: ERROR_CATEGORIES.PLUGIN,
      details,
      suggestion: details.suggestion || 'Check the plugin configuration or logs'
    });
  }
}

// Create a default instance
const errorHandler = new ErrorHandler();

export default errorHandler; 