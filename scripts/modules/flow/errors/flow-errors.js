/**
 * @fileoverview Flow Error Handling System
 *
 * Implements structured error types, retry mechanisms, circuit breakers,
 * and recovery strategies for robust error handling in the Flow module.
 */

import { EventEmitter } from 'node:events';

/**
 * Base Flow Error class with structured properties
 */
export class FlowError extends Error {
	constructor(message, options = {}) {
		super(message);
		this.name = this.constructor.name;
		this.code = options.code || 'FLOW_ERROR';
		this.isRetryable = options.isRetryable ?? false;
		this.severity = options.severity || 'error';
		this.category = options.category || 'general';
		this.details = options.details || {};
		this.timestamp = new Date().toISOString();
		this.operationId = options.operationId;

		// Preserve stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Convert error to JSON for logging/serialization
	 */
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			isRetryable: this.isRetryable,
			severity: this.severity,
			category: this.category,
			details: this.details,
			timestamp: this.timestamp,
			operationId: this.operationId,
			stack: this.stack
		};
	}

	/**
	 * Create error with context
	 */
	static withContext(message, context = {}) {
		return new FlowError(message, context);
	}
}

/**
 * Configuration related errors
 */
export class ConfigurationError extends FlowError {
	constructor(message, options = {}) {
		super(message, {
			...options,
			code: options.code || 'FLOW_CONFIG_ERROR',
			category: 'configuration',
			isRetryable: false
		});
	}
}

/**
 * Provider related errors
 */
export class ProviderError extends FlowError {
	constructor(message, options = {}) {
		super(message, {
			...options,
			code: options.code || 'FLOW_PROVIDER_ERROR',
			category: 'provider',
			isRetryable: options.isRetryable ?? true
		});
		this.provider = options.provider;
		this.providerId = options.providerId;
	}
}

/**
 * Agent related errors
 */
export class AgentError extends FlowError {
	constructor(message, options = {}) {
		super(message, {
			...options,
			code: options.code || 'FLOW_AGENT_ERROR',
			category: 'agent',
			isRetryable: options.isRetryable ?? true
		});
		this.agentType = options.agentType;
		this.agentId = options.agentId;
	}
}

/**
 * Execution related errors
 */
export class ExecutionError extends FlowError {
	constructor(message, options = {}) {
		super(message, {
			...options,
			code: options.code || 'FLOW_EXECUTION_ERROR',
			category: 'execution',
			isRetryable: options.isRetryable ?? false
		});
		this.executionId = options.executionId;
		this.taskId = options.taskId;
		this.phase = options.phase;
	}
}

/**
 * Execution cancelled error
 */
export class ExecutionCancelledError extends ExecutionError {
	constructor(message, options = {}) {
		super(message, {
			...options,
			code: 'FLOW_EXECUTION_CANCELLED',
			isRetryable: false,
			severity: 'info'
		});
	}
}

/**
 * Timeout related errors
 */
export class TimeoutError extends FlowError {
	constructor(message, options = {}) {
		super(message, {
			...options,
			code: options.code || 'FLOW_TIMEOUT_ERROR',
			category: 'timeout',
			isRetryable: options.isRetryable ?? true
		});
		this.timeoutDuration = options.timeoutDuration;
		this.operation = options.operation;
	}
}

/**
 * Network/Communication related errors
 */
export class NetworkError extends FlowError {
	constructor(message, options = {}) {
		super(message, {
			...options,
			code: options.code || 'FLOW_NETWORK_ERROR',
			category: 'network',
			isRetryable: options.isRetryable ?? true
		});
		this.statusCode = options.statusCode;
		this.endpoint = options.endpoint;
	}
}

/**
 * Validation related errors
 */
export class ValidationError extends FlowError {
	constructor(message, options = {}) {
		super(message, {
			...options,
			code: options.code || 'FLOW_VALIDATION_ERROR',
			category: 'validation',
			isRetryable: false
		});
		this.validationErrors = options.validationErrors || [];
	}
}

/**
 * Circuit Breaker error
 */
export class CircuitBreakerError extends FlowError {
	constructor(message, options = {}) {
		super(message, {
			...options,
			code: 'FLOW_CIRCUIT_BREAKER_OPEN',
			category: 'circuit_breaker',
			isRetryable: true,
			severity: 'warn'
		});
		this.breakerName = options.breakerName;
		this.state = options.state;
	}
}

/**
 * Retry Configuration
 */
export class RetryConfig {
	constructor(options = {}) {
		this.maxAttempts = options.maxAttempts || 3;
		this.baseDelay = options.baseDelay || 1000;
		this.maxDelay = options.maxDelay || 30000;
		this.backoffFactor = options.backoffFactor || 2;
		this.jitter = options.jitter ?? true;
		this.retryableErrors = options.retryableErrors || [];
		this.shouldRetry = options.shouldRetry;
	}

	/**
	 * Calculate delay for attempt
	 */
	getDelay(attempt) {
		let delay = this.baseDelay * this.backoffFactor ** (attempt - 1);

		// Apply max delay
		delay = Math.min(delay, this.maxDelay);

		// Apply jitter to prevent thundering herd
		if (this.jitter) {
			delay = delay * (0.5 + Math.random() * 0.5);
		}

		return Math.floor(delay);
	}

	/**
	 * Check if error should be retried
	 */
	isRetryable(error, attempt) {
		if (attempt >= this.maxAttempts) {
			return false;
		}

		// Use custom retry logic if provided
		if (this.shouldRetry) {
			return this.shouldRetry(error, attempt);
		}

		// Check if error is marked as retryable
		if (error.isRetryable === false) {
			return false;
		}

		// Check against retryable error types
		if (this.retryableErrors.length > 0) {
			return this.retryableErrors.some(
				(errorType) => error instanceof errorType
			);
		}

		// Default: retry if error is marked as retryable
		return error.isRetryable === true;
	}
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker extends EventEmitter {
	constructor(name, options = {}) {
		super();
		this.name = name;
		this.threshold = options.threshold || 10;
		this.timeout = options.timeout || 60000;
		this.resetTimeout = options.resetTimeout || 30000;

		this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
		this.failureCount = 0;
		this.lastFailureTime = null;
		this.nextAttemptTime = null;
	}

	/**
	 * Execute function with circuit breaker protection
	 */
	async execute(fn) {
		if (this.state === 'OPEN') {
			if (Date.now() < this.nextAttemptTime) {
				throw new CircuitBreakerError(
					`Circuit breaker '${this.name}' is OPEN`,
					{ breakerName: this.name, state: this.state }
				);
			}

			// Transition to half-open
			this.state = 'HALF_OPEN';
			this.emit('state_change', { name: this.name, state: this.state });
		}

		try {
			const result = await fn();
			this._onSuccess();
			return result;
		} catch (error) {
			this._onFailure();
			throw error;
		}
	}

	/**
	 * Get current status
	 */
	getStatus() {
		return {
			name: this.name,
			state: this.state,
			failureCount: this.failureCount,
			threshold: this.threshold,
			lastFailureTime: this.lastFailureTime,
			nextAttemptTime: this.nextAttemptTime
		};
	}

	/**
	 * Reset circuit breaker
	 */
	reset() {
		this.state = 'CLOSED';
		this.failureCount = 0;
		this.lastFailureTime = null;
		this.nextAttemptTime = null;
		this.emit('reset', { name: this.name });
	}

	// Private methods

	_onSuccess() {
		this.failureCount = 0;
		if (this.state === 'HALF_OPEN') {
			this.state = 'CLOSED';
			this.emit('state_change', { name: this.name, state: this.state });
		}
	}

	_onFailure() {
		this.failureCount++;
		this.lastFailureTime = Date.now();

		if (this.failureCount >= this.threshold) {
			this.state = 'OPEN';
			this.nextAttemptTime = Date.now() + this.resetTimeout;
			this.emit('state_change', { name: this.name, state: this.state });
		}
	}
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryHandler {
	constructor(config = {}) {
		this.config = new RetryConfig(config);
	}

	/**
	 * Execute function with retry logic
	 */
	async execute(fn, context = {}) {
		let lastError;

		for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
			try {
				const result = await fn();
				return result;
			} catch (error) {
				lastError = error;

				// Check if we should retry
				if (!this.config.isRetryable(error, attempt)) {
					throw error;
				}

				// Don't delay on last attempt
				if (attempt < this.config.maxAttempts) {
					const delay = this.config.getDelay(attempt);
					await this._delay(delay);
				}
			}
		}

		// All attempts failed
		throw new FlowError(
			`Operation failed after ${this.config.maxAttempts} attempts`,
			{
				code: 'FLOW_MAX_RETRIES_EXCEEDED',
				category: 'retry',
				isRetryable: false,
				details: {
					attempts: this.config.maxAttempts,
					lastError: lastError.toJSON ? lastError.toJSON() : lastError.message,
					context
				}
			}
		);
	}

	_delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Error Recovery Manager
 */
export class ErrorRecoveryManager extends EventEmitter {
	constructor() {
		super();
		this.circuitBreakers = new Map();
		this.retryHandlers = new Map();
		this.recoveryStrategies = new Map();
	}

	/**
	 * Register circuit breaker
	 */
	registerCircuitBreaker(name, options = {}) {
		const breaker = new CircuitBreaker(name, options);
		breaker.on('state_change', (event) => {
			this.emit('circuit_breaker_state_change', event);
		});
		this.circuitBreakers.set(name, breaker);
		return breaker;
	}

	/**
	 * Get circuit breaker
	 */
	getCircuitBreaker(name) {
		return this.circuitBreakers.get(name);
	}

	/**
	 * Register retry handler
	 */
	registerRetryHandler(name, config = {}) {
		const handler = new RetryHandler(config);
		this.retryHandlers.set(name, handler);
		return handler;
	}

	/**
	 * Get retry handler
	 */
	getRetryHandler(name) {
		return this.retryHandlers.get(name);
	}

	/**
	 * Register recovery strategy
	 */
	registerRecoveryStrategy(errorType, strategy) {
		this.recoveryStrategies.set(errorType, strategy);
	}

	/**
	 * Execute with error recovery
	 */
	async executeWithRecovery(fn, options = {}) {
		const {
			retryHandler = 'default',
			circuitBreaker,
			recovery = true
		} = options;

		try {
			let operation = fn;

			// Wrap with circuit breaker if specified
			if (circuitBreaker) {
				const breaker = this.getCircuitBreaker(circuitBreaker);
				if (breaker) {
					operation = () => breaker.execute(fn);
				}
			}

			// Wrap with retry handler if specified
			if (retryHandler) {
				const handler = this.getRetryHandler(retryHandler);
				if (handler) {
					operation = () => handler.execute(operation);
				}
			}

			return await operation();
		} catch (error) {
			// Attempt recovery if enabled
			if (recovery) {
				const recovered = await this._attemptRecovery(error, options);
				if (recovered) {
					return recovered;
				}
			}

			throw error;
		}
	}

	/**
	 * Get status of all error handling components
	 */
	getStatus() {
		return {
			circuitBreakers: Array.from(this.circuitBreakers.entries()).map(
				([name, breaker]) => ({
					name,
					...breaker.getStatus()
				})
			),
			retryHandlers: Array.from(this.retryHandlers.keys()),
			recoveryStrategies: Array.from(this.recoveryStrategies.keys())
		};
	}

	// Private methods

	async _attemptRecovery(error, options) {
		const strategy = this.recoveryStrategies.get(error.constructor.name);
		if (strategy) {
			try {
				this.emit('recovery_attempt', { error, strategy: strategy.name });
				const result = await strategy(error, options);
				this.emit('recovery_success', { error, result });
				return result;
			} catch (recoveryError) {
				this.emit('recovery_failed', { error, recoveryError });
			}
		}
		return null;
	}
}

/**
 * Global error recovery manager instance
 */
export const errorRecoveryManager = new ErrorRecoveryManager();

/**
 * Initialize error handling with default configurations
 */
export function initializeErrorHandling(config = {}) {
	// Register default retry handlers
	errorRecoveryManager.registerRetryHandler('default', {
		maxAttempts: config.maxRetries || 3,
		baseDelay: config.retryBaseDelay || 1000,
		maxDelay: config.retryMaxDelay || 30000,
		backoffFactor: config.retryBackoffFactor || 2
	});

	errorRecoveryManager.registerRetryHandler('network', {
		maxAttempts: 5,
		baseDelay: 500,
		maxDelay: 10000,
		retryableErrors: [NetworkError, TimeoutError]
	});

	errorRecoveryManager.registerRetryHandler('agent', {
		maxAttempts: 3,
		baseDelay: 2000,
		maxDelay: 30000,
		retryableErrors: [AgentError, NetworkError]
	});

	// Register default circuit breakers
	errorRecoveryManager.registerCircuitBreaker('provider', {
		threshold: config.circuitBreakerThreshold || 10,
		timeout: 60000,
		resetTimeout: 30000
	});

	errorRecoveryManager.registerCircuitBreaker('agent', {
		threshold: 5,
		timeout: 30000,
		resetTimeout: 15000
	});

	return errorRecoveryManager;
}

/**
 * Utility function to wrap operations with error handling
 */
export async function withErrorHandling(fn, options = {}) {
	return errorRecoveryManager.executeWithRecovery(fn, options);
}

/**
 * Error type constants for easy reference
 */
export const ERROR_TYPES = {
	CONFIGURATION: 'ConfigurationError',
	PROVIDER: 'ProviderError',
	AGENT: 'AgentError',
	EXECUTION: 'ExecutionError',
	EXECUTION_CANCELLED: 'ExecutionCancelledError',
	TIMEOUT: 'TimeoutError',
	NETWORK: 'NetworkError',
	VALIDATION: 'ValidationError',
	CIRCUIT_BREAKER: 'CircuitBreakerError'
};
