/**
 * Retry Manager Module
 * 
 * Provides functionality for retrying failed operations with configurable
 * backoff strategies and circuit breaking.
 */

import { log } from './logger.js';
import { errorHandler, ERROR_CATEGORY } from './error-handler.js';

/**
 * Backoff strategies for retries
 */
export const BACKOFF_STRATEGY = {
  /**
   * Constant delay between retries
   * @param {number} attempt - Current attempt number (starting at 1)
   * @param {number} delay - Base delay in milliseconds
   * @returns {number} Delay in milliseconds
   */
  CONSTANT: (attempt, delay) => delay,
  
  /**
   * Linear increase in delay (delay * attempt)
   * @param {number} attempt - Current attempt number (starting at 1)
   * @param {number} delay - Base delay in milliseconds
   * @returns {number} Delay in milliseconds
   */
  LINEAR: (attempt, delay) => delay * attempt,
  
  /**
   * Exponential increase in delay (delay * 2^(attempt-1))
   * @param {number} attempt - Current attempt number (starting at 1)
   * @param {number} delay - Base delay in milliseconds
   * @returns {number} Delay in milliseconds
   */
  EXPONENTIAL: (attempt, delay) => delay * Math.pow(2, attempt - 1),
  
  /**
   * Exponential increase with jitter (random variation)
   * @param {number} attempt - Current attempt number (starting at 1)
   * @param {number} delay - Base delay in milliseconds
   * @returns {number} Delay in milliseconds
   */
  EXPONENTIAL_JITTER: (attempt, delay) => {
    const expDelay = delay * Math.pow(2, attempt - 1);
    const jitter = 0.2; // 20% jitter
    const randomFactor = 1 - jitter + (Math.random() * jitter * 2);
    return expDelay * randomFactor;
  }
};

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS = {
  maxAttempts: 3,
  delay: 1000,
  backoffStrategy: BACKOFF_STRATEGY.EXPONENTIAL_JITTER,
  retryableErrors: [],
  onRetry: null,
  context: {}
};

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 * @param {Error} error - Error to check
 * @param {Array} retryableErrors - List of retryable error codes or error checker functions
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error, retryableErrors) {
  if (!Array.isArray(retryableErrors) || retryableErrors.length === 0) {
    return true; // Default to retrying all errors if not specified
  }
  
  return retryableErrors.some(retryable => {
    if (typeof retryable === 'function') {
      return retryable(error);
    } else if (typeof retryable === 'string') {
      return error.code === retryable || error.message.includes(retryable);
    } else if (retryable instanceof RegExp) {
      return retryable.test(error.message);
    }
    return false;
  });
}

/**
 * Retry a function with configurable options
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of the function
 */
export async function retry(fn, options = {}) {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let attempt = 1;
  
  while (attempt <= config.maxAttempts) {
    try {
      // Attempt the operation
      return await fn(attempt);
    } catch (error) {
      // Check if we've reached max attempts
      if (attempt >= config.maxAttempts) {
        const finalError = errorHandler.handle(error, {
          message: `Operation failed after ${attempt} attempts`,
          category: ERROR_CATEGORY.APPLICATION,
          code: 'RETRY_EXHAUSTED',
          context: { 
            attempt, 
            maxAttempts: config.maxAttempts,
            ...config.context
          },
          suggestion: 'Check the operation parameters or try again later',
          display: false // Don't display the error yet, just log and return it
        });
        
        throw finalError.originalError || new Error(finalError.message);
      }
      
      // Check if error is retryable
      if (!isRetryableError(error, config.retryableErrors)) {
        const nonRetryableError = errorHandler.handle(error, {
          message: `Operation failed with non-retryable error`,
          category: ERROR_CATEGORY.APPLICATION,
          code: 'NON_RETRYABLE_ERROR',
          context: { 
            attempt,
            ...config.context
          },
          display: false
        });
        
        throw nonRetryableError.originalError || new Error(nonRetryableError.message);
      }
      
      // Calculate delay for next attempt
      const delayMs = config.backoffStrategy(attempt, config.delay);
      
      // Log retry information
      log('info', `Retry attempt ${attempt}/${config.maxAttempts} after ${delayMs}ms delay`);
      
      // Call onRetry callback if provided
      if (typeof config.onRetry === 'function') {
        config.onRetry(error, attempt, delayMs, config.context);
      }
      
      // Wait before next attempt
      await sleep(delayMs);
      
      attempt++;
    }
  }
}

/**
 * Retry manager class for retrying operations with circuit breaking
 */
export class RetryManager {
  /**
   * Create a new RetryManager
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
    this.circuits = new Map(); // Map of circuit breakers by name
  }
  
  /**
   * Execute a function with retry logic
   * @param {Function} fn - Function to execute with retry
   * @param {Object} options - Retry options for this specific call
   * @returns {Promise<any>} Result of the function
   */
  async execute(fn, options = {}) {
    const config = { ...this.options, ...options };
    return retry(fn, config);
  }
  
  /**
   * Get current circuit state
   * @param {string} name - Circuit name
   * @returns {Object|null} Circuit state or null if not found
   */
  getCircuitState(name) {
    if (!this.circuits.has(name)) {
      return null;
    }
    
    return { ...this.circuits.get(name) };
  }
  
  /**
   * Execute a function with circuit breaker pattern
   * @param {string} name - Circuit name
   * @param {Function} fn - Function to execute
   * @param {Object} options - Circuit breaker options
   * @returns {Promise<any>} Result of the function
   */
  async executeWithCircuitBreaker(name, fn, options = {}) {
    const defaultOptions = {
      maxFailures: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenSuccess: 2, // Number of successes in half-open state to close circuit
      onStateChange: null // Callback when circuit state changes
    };
    
    const config = { ...defaultOptions, ...options };
    
    // Initialize circuit if it doesn't exist
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        state: 'closed', // closed, open, half-open
        failures: 0,
        lastFailure: null,
        successes: 0,
        lastStateChange: Date.now()
      });
    }
    
    const circuit = this.circuits.get(name);
    
    // Check if circuit is open
    if (circuit.state === 'open') {
      const now = Date.now();
      const elapsedSinceFailure = now - circuit.lastFailure;
      
      // If reset timeout has passed, move to half-open state
      if (elapsedSinceFailure >= config.resetTimeout) {
        this.updateCircuitState(name, 'half-open', config.onStateChange);
      } else {
        // Circuit is still open, fail fast
        throw new Error(`Circuit '${name}' is open. Retry after ${Math.ceil((config.resetTimeout - elapsedSinceFailure) / 1000)} seconds.`);
      }
    }
    
    try {
      // Execute the function
      const result = await fn();
      
      // Handle success
      if (circuit.state === 'half-open') {
        circuit.successes++;
        
        // If we've reached the required number of successes, close the circuit
        if (circuit.successes >= config.halfOpenSuccess) {
          this.updateCircuitState(name, 'closed', config.onStateChange);
        }
      } else if (circuit.state === 'closed' && circuit.failures > 0) {
        // Reset failures on success in closed state
        circuit.failures = 0;
      }
      
      return result;
    } catch (error) {
      // Handle failure
      circuit.failures++;
      circuit.lastFailure = Date.now();
      
      // If we've reached the maximum failures, open the circuit
      if (circuit.failures >= config.maxFailures) {
        this.updateCircuitState(name, 'open', config.onStateChange);
      }
      
      // If in half-open state, any failure opens the circuit
      if (circuit.state === 'half-open') {
        this.updateCircuitState(name, 'open', config.onStateChange);
      }
      
      // Re-throw the error
      throw error;
    }
  }
  
  /**
   * Update circuit state and call state change callback
   * @param {string} name - Circuit name
   * @param {string} newState - New circuit state
   * @param {Function} onStateChange - Callback when circuit state changes
   */
  updateCircuitState(name, newState, onStateChange) {
    const circuit = this.circuits.get(name);
    const oldState = circuit.state;
    
    // Update circuit state
    circuit.state = newState;
    circuit.lastStateChange = Date.now();
    
    // Reset counters
    if (newState === 'closed') {
      circuit.failures = 0;
      circuit.successes = 0;
    } else if (newState === 'half-open') {
      circuit.successes = 0;
    }
    
    // Log state change
    log('info', `Circuit '${name}' state changed from ${oldState} to ${newState}`);
    
    // Call state change callback if provided
    if (typeof onStateChange === 'function') {
      onStateChange(name, oldState, newState, { ...circuit });
    }
  }
  
  /**
   * Reset a circuit to closed state
   * @param {string} name - Circuit name
   */
  resetCircuit(name) {
    if (this.circuits.has(name)) {
      const circuit = this.circuits.get(name);
      const oldState = circuit.state;
      
      circuit.state = 'closed';
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastStateChange = Date.now();
      
      log('info', `Circuit '${name}' manually reset from ${oldState} to closed`);
    }
  }
  
  /**
   * Reset all circuits to closed state
   */
  resetAllCircuits() {
    for (const name of this.circuits.keys()) {
      this.resetCircuit(name);
    }
  }
}

/**
 * Create a singleton instance for the application to use
 */
export const retryManager = new RetryManager(); 