/**
 * @fileoverview Daytona Provider Error Classes
 * 
 * Defines structured error types for the Daytona provider.
 * Extends the Flow error system with provider-specific error handling.
 */

import { FlowError } from '../../errors/flow-errors.js'

/**
 * Base Daytona Error
 * Common error class for all Daytona provider errors
 */
export class DaytonaError extends FlowError {
  constructor({ code, message, category, details = {} }) {
    super(message)
    this.name = 'DaytonaError'
    this.code = code
    this.category = category
    this.provider = 'daytona'
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
 * Daytona Connection Error
 * Represents network, authentication, or API communication errors
 * These errors are typically retryable
 */
export class DaytonaConnectionError extends DaytonaError {
  constructor({ code, message, category = 'connection', details = {} }) {
    super({ code, message, category, details })
    this.name = 'DaytonaConnectionError'
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
 * Daytona Execution Error
 * Represents errors during code execution or workspace operations
 * These errors are typically not retryable
 */
export class DaytonaExecutionError extends DaytonaError {
  constructor({ code, message, category = 'execution', details = {} }) {
    super({ code, message, category, details })
    this.name = 'DaytonaExecutionError'
    this.retryable = false // Execution errors are generally not retryable
  }

  /**
   * Check if this specific execution error might be retryable
   */
  shouldRetry() {
    // Retry workspace startup failures
    if (this.code === 'WORKSPACE_STARTING' || this.code === 'WORKSPACE_UNAVAILABLE') {
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
      workspaceId: this.details.resourceId,
      action: this.details.action,
      parameters: this.details.parameters,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Daytona Resource Error
 * Represents errors with workspace resource management
 * May be retryable depending on the specific error
 */
export class DaytonaResourceError extends DaytonaError {
  constructor({ code, message, category = 'resource', details = {} }) {
    super({ code, message, category, details })
    this.name = 'DaytonaResourceError'
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
      'WORKSPACE_LIMIT_EXCEEDED',
      'INVALID_PROFILE'
    ]
    
    return !nonRetryableCodes.includes(this.code)
  }

  /**
   * Get resource information for debugging
   */
  getResourceInfo() {
    return {
      resourceId: this.details.resourceId,
      resourceType: this.details.resourceType || 'workspace',
      operation: this.details.operation,
      provider: this.provider
    }
  }
}

/**
 * Daytona Configuration Error
 * Represents configuration or setup errors
 * These are not retryable and require user intervention
 */
export class DaytonaConfigurationError extends DaytonaError {
  constructor({ code, message, category = 'configuration', details = {} }) {
    super({ code, message, category, details })
    this.name = 'DaytonaConfigurationError'
    this.retryable = false // Configuration errors require user action
  }

  /**
   * Get configuration suggestions for fixing the error
   */
  getConfigurationSuggestions() {
    const suggestions = {
      'MISSING_API_KEY': [
        'Set the DAYTONA_API_KEY environment variable',
        'Pass apiKey in the provider configuration',
        'Verify your Daytona account has API access enabled'
      ],
      'INVALID_API_KEY': [
        'Check that your API key is correct',
        'Ensure the API key has not expired',
        'Verify the API key has sufficient permissions'
      ],
      'INVALID_BASE_URL': [
        'Check the baseUrl configuration',
        'Ensure the URL includes the protocol (https://)',
        'Verify the Daytona instance is accessible'
      ],
      'INVALID_REGION': [
        'Check available regions in your Daytona account',
        'Verify the region name is spelled correctly',
        'Ensure your account has access to the specified region'
      ]
    }

    return suggestions[this.code] || [
      'Check the Daytona provider configuration',
      'Verify your Daytona account status',
      'Review the error details for specific guidance'
    ]
  }
}

/**
 * Daytona Workspace Error
 * Represents workspace-specific errors
 * May be retryable for transient workspace states
 */
export class DaytonaWorkspaceError extends DaytonaError {
  constructor({ code, message, category = 'workspace', details = {} }) {
    super({ code, message, category, details })
    this.name = 'DaytonaWorkspaceError'
    this.retryable = this.determineRetryability()
  }

  /**
   * Determine if workspace error is retryable
   */
  determineRetryability() {
    const retryableCodes = [
      'WORKSPACE_STARTING',
      'WORKSPACE_STOPPING',
      'WORKSPACE_BUSY',
      'WORKSPACE_UNAVAILABLE'
    ]
    
    return retryableCodes.includes(this.code)
  }

  /**
   * Get workspace state information
   */
  getWorkspaceState() {
    return {
      workspaceId: this.details.workspaceId,
      workspaceName: this.details.workspaceName,
      status: this.details.status,
      profile: this.details.profile,
      region: this.details.region
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
    return new DaytonaConnectionError({
      code,
      message,
      category: 'connection',
      details
    })
  }

  if (code.includes('WORKSPACE') || code.includes('ENVIRONMENT')) {
    return new DaytonaWorkspaceError({
      code,
      message,
      category: 'workspace',
      details
    })
  }

  if (code.includes('EXECUTION') || code.includes('COMMAND')) {
    return new DaytonaExecutionError({
      code,
      message,
      category: 'execution',
      details
    })
  }

  if (code.includes('CONFIG') || code.includes('SETUP')) {
    return new DaytonaConfigurationError({
      code,
      message,
      category: 'configuration',
      details
    })
  }

  // Default to connection error for unknown errors
  return new DaytonaConnectionError({
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
    return new DaytonaConnectionError({
      code,
      message,
      category: 'connection',
      details
    })
  }

  if (response.status >= 500) {
    return new DaytonaConnectionError({
      code,
      message,
      category: 'connection',
      details
    })
  }

  return new DaytonaError({
    code,
    message,
    category: 'unknown',
    details
  })
} 