/**
 * @fileoverview Modal Provider Error Classes
 * 
 * Defines structured error types for the Modal provider.
 * Extends the Flow error system with provider-specific error handling.
 */

import { FlowError } from '../../errors/flow-errors.js'

/**
 * Base Modal Error
 * Common error class for all Modal provider errors
 */
export class ModalError extends FlowError {
  constructor({ code, message, category, details = {} }) {
    super(message)
    this.name = 'ModalError'
    this.code = code
    this.category = category
    this.provider = 'modal'
    this.details = details
    this.retryable = false
  }

  /**
   * Convert error to structured object for logging
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      provider: this.provider,
      retryable: this.retryable,
      details: this.details,
      stack: this.stack
    }
  }
}

/**
 * Modal Connection Error
 * Represents network, authentication, or API communication errors
 * These errors are typically retryable
 */
export class ModalConnectionError extends ModalError {
  constructor({ code, message, category = 'connection', details = {} }) {
    super({ code, message, category, details })
    this.name = 'ModalConnectionError'
    this.retryable = true // Connection errors are generally retryable
  }

  /**
   * Check if this specific error should be retried
   */
  shouldRetry() {
    // Don't retry authentication failures
    if (this.code === 'AUTHENTICATION_FAILED' || this.code === 'HTTP_401') {
      return false
    }
    
    // Don't retry client errors (4xx except 401)
    if (this.code.startsWith('HTTP_4') && this.code !== 'HTTP_401') {
      return false
    }
    
    // Retry timeouts and server errors
    return this.retryable
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(attempt = 1) {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    return Math.min(1000 * (2 ** (attempt - 1)), 30000)
  }
}

/**
 * Modal Execution Error
 * Represents errors during function execution
 * These errors are typically not retryable
 */
export class ModalExecutionError extends ModalError {
  constructor({ code, message, category = 'execution', details = {} }) {
    super({ code, message, category, details })
    this.name = 'ModalExecutionError'
    this.retryable = false // Execution errors are generally not retryable
  }

  /**
   * Check if this specific execution error might be retryable
   */
  shouldRetry() {
    // Retry function startup failures
    if (this.code === 'FUNCTION_STARTING' || this.code === 'FUNCTION_UNAVAILABLE') {
      return true
    }
    
    // Retry resource exhaustion errors
    if (this.code === 'RESOURCE_EXHAUSTED' || this.code === 'RATE_LIMITED') {
      return true
    }
    
    // Don't retry function execution failures
    return false
  }

  /**
   * Get execution context for debugging
   */
  getExecutionContext() {
    return {
      functionId: this.details.resourceId,
      action: this.details.action,
      parameters: this.details.parameters,
      timestamp: new Date().toISOString()
    }
  }
} 