/**
 * @fileoverview Fly.io Provider Error Classes
 * 
 * Defines structured error types for the Fly.io provider.
 * Extends the Flow error system with provider-specific error handling.
 */

import { FlowError } from '../../errors/flow-errors.js'

/**
 * Base Fly.io Error
 * Common error class for all Fly.io provider errors
 */
export class FlyError extends FlowError {
  constructor({ code, message, category, details = {} }) {
    super(message)
    this.name = 'FlyError'
    this.code = code
    this.category = category
    this.provider = 'fly'
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
 * Fly.io Connection Error
 * Represents network, authentication, or API communication errors
 * These errors are typically retryable
 */
export class FlyConnectionError extends FlyError {
  constructor({ code, message, category = 'connection', details = {} }) {
    super({ code, message, category, details })
    this.name = 'FlyConnectionError'
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
 * Fly.io Execution Error
 * Represents errors during code execution or machine operations
 * These errors are typically not retryable
 */
export class FlyExecutionError extends FlyError {
  constructor({ code, message, category = 'execution', details = {} }) {
    super({ code, message, category, details })
    this.name = 'FlyExecutionError'
    this.retryable = false // Execution errors are generally not retryable
  }

  /**
   * Check if this specific execution error might be retryable
   */
  shouldRetry() {
    // Retry machine startup failures
    if (this.code === 'MACHINE_STARTING' || this.code === 'MACHINE_UNAVAILABLE') {
      return true
    }
    
    // Retry resource exhaustion errors
    if (this.code === 'RESOURCE_EXHAUSTED' || this.code === 'RATE_LIMITED') {
      return true
    }
    
    // Don't retry code execution failures
    return false
  }

  /**
   * Get execution context for debugging
   */
  getExecutionContext() {
    return {
      machineId: this.details.resourceId,
      action: this.details.action,
      parameters: this.details.parameters,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Fly.io Resource Error
 * Represents errors with machine resource management
 * May be retryable depending on the specific error
 */
export class FlyResourceError extends FlyError {
  constructor({ code, message, category = 'resource', details = {} }) {
    super({ code, message, category, details })
    this.name = 'FlyResourceError'
    this.retryable = this.determineRetryability()
  }

  /**
   * Determine if this resource error is retryable
   */
  determineRetryability() {
    const nonRetryableCodes = [
      'RESOURCE_NOT_FOUND',
      'INVALID_CONFIGURATION',
      'INSUFFICIENT_PERMISSIONS',
      'MACHINE_LIMIT_EXCEEDED',
      'INVALID_IMAGE',
      'INVALID_REGION'
    ]
    
    return !nonRetryableCodes.includes(this.code)
  }

  /**
   * Get resource information for debugging
   */
  getResourceInfo() {
    return {
      resourceId: this.details.resourceId,
      resourceType: this.details.resourceType || 'machine',
      operation: this.details.operation,
      provider: this.provider
    }
  }
}

/**
 * Fly.io Configuration Error
 * Represents configuration or setup errors
 * These are not retryable and require user intervention
 */
export class FlyConfigurationError extends FlyError {
  constructor({ code, message, category = 'configuration', details = {} }) {
    super({ code, message, category, details })
    this.name = 'FlyConfigurationError'
    this.retryable = false // Configuration errors require user action
  }

  /**
   * Get configuration suggestions for fixing the error
   */
  getConfigurationSuggestions() {
    const suggestions = {
      'MISSING_API_KEY': [
        'Set the FLY_API_TOKEN environment variable',
        'Pass apiKey in the provider configuration',
        'Generate an API token from https://fly.io/user/personal_access_tokens'
      ],
      'INVALID_API_KEY': [
        'Check that your API token is correct',
        'Ensure the API token has not expired',
        'Verify the API token has sufficient permissions'
      ],
      'INVALID_BASE_URL': [
        'Check the baseUrl configuration',
        'Ensure the URL includes the protocol (https://)',
        'Verify the Fly.io API endpoint is accessible'
      ],
      'INVALID_REGION': [
        'Check available regions in your Fly.io account',
        'Verify the region name is spelled correctly',
        'Use fly regions list to see available regions'
      ],
      'INVALID_APP_NAME': [
        'Check that the app name is valid',
        'App names must be lowercase and contain only letters, numbers, and hyphens',
        'Ensure the app exists in your Fly.io account'
      ]
    }

    return suggestions[this.code] || [
      'Check the Fly.io provider configuration',
      'Verify your Fly.io account status',
      'Review the error details for specific guidance'
    ]
  }
}

/**
 * Fly.io Machine Error
 * Represents machine-specific errors
 * May be retryable for transient machine states
 */
export class FlyMachineError extends FlyError {
  constructor({ code, message, category = 'machine', details = {} }) {
    super({ code, message, category, details })
    this.name = 'FlyMachineError'
    this.retryable = this.determineRetryability()
  }

  /**
   * Determine if machine error is retryable
   */
  determineRetryability() {
    const retryableCodes = [
      'MACHINE_STARTING',
      'MACHINE_STOPPING',
      'MACHINE_BUSY',
      'MACHINE_UNAVAILABLE'
    ]
    
    return retryableCodes.includes(this.code)
  }

  /**
   * Get machine state information
   */
  getMachineState() {
    return {
      machineId: this.details.machineId,
      machineName: this.details.machineName,
      state: this.details.state,
      region: this.details.region,
      image: this.details.image
    }
  }
}

/**
 * Create error from API response
 */
export function createErrorFromApiResponse(error, context = {}) {
  const code = error.code || error.type || 'UNKNOWN_ERROR'
  const message = error.message || 'An unknown error occurred'
  const details = { ...context, originalError: error }

  // Map API error codes to appropriate error types
  if (code.includes('AUTH') || code.includes('PERMISSION')) {
    return new FlyConnectionError({
      code,
      message,
      category: 'connection',
      details
    })
  }

  if (code.includes('MACHINE') || code.includes('APP')) {
    return new FlyMachineError({
      code,
      message,
      category: 'machine',
      details
    })
  }

  if (code.includes('EXECUTION') || code.includes('COMMAND')) {
    return new FlyExecutionError({
      code,
      message,
      category: 'execution',
      details
    })
  }

  if (code.includes('CONFIG') || code.includes('SETUP')) {
    return new FlyConfigurationError({
      code,
      message,
      category: 'configuration',
      details
    })
  }

  // Default to connection error for unknown errors
  return new FlyConnectionError({
    code,
    message,
    category: 'connection',
    details
  })
}

/**
 * Create error from HTTP response
 */
export function createErrorFromHttpResponse(response, endpoint, context = {}) {
  const code = `HTTP_${response.status}`
  const message = `HTTP ${response.status}: ${response.statusText}`
  const details = {
    status: response.status,
    statusText: response.statusText,
    endpoint,
    ...context
  }

  if (response.status >= 400 && response.status < 500) {
    return new FlyConnectionError({
      code,
      message,
      category: 'connection',
      details
    })
  }

  if (response.status >= 500) {
    return new FlyConnectionError({
      code,
      message,
      category: 'connection',
      details
    })
  }

  return new FlyError({
    code,
    message,
    category: 'unknown',
    details
  })
} 