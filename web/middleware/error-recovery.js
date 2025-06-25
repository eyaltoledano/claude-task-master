/**
 * Task Master Web Server - Error Recovery Middleware
 *
 * Implements comprehensive error recovery, retry mechanisms, and circuit breaker patterns
 * to enhance server robustness and prevent cascading failures.
 */

import fs from 'fs/promises';
import { performance } from 'perf_hooks';

/**
 * Circuit Breaker States
 */
const CIRCUIT_STATE = {
	CLOSED: 'CLOSED', // Normal operation
	OPEN: 'OPEN', // Circuit tripped, failing fast
	HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Circuit Breaker Implementation
 * Prevents cascading failures by temporarily blocking failing operations
 */
class CircuitBreaker {
	constructor(options = {}) {
		this.name = options.name || 'unnamed';
		this.failureThreshold = options.failureThreshold || 5;
		this.recoveryTimeout = options.recoveryTimeout || 30000; // 30 seconds
		this.monitoringPeriod = options.monitoringPeriod || 60000; // 1 minute

		this.state = CIRCUIT_STATE.CLOSED;
		this.failureCount = 0;
		this.lastFailureTime = null;
		this.nextAttemptTime = null;
		this.successCount = 0;
		this.totalAttempts = 0;

		// Statistics for monitoring
		this.stats = {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			circuitOpenTime: 0,
			lastReset: Date.now()
		};
	}

	/**
	 * Execute an operation with circuit breaker protection
	 * @param {Function} operation - Async operation to execute
	 * @param {Object} context - Operation context for logging
	 * @returns {Promise} Operation result
	 */
	async execute(operation, context = {}) {
		this.stats.totalRequests++;
		this.totalAttempts++;

		// Fast fail if circuit is open
		if (this.state === CIRCUIT_STATE.OPEN) {
			if (Date.now() < this.nextAttemptTime) {
				const error = new Error(
					`Circuit breaker '${this.name}' is OPEN. Next attempt allowed at ${new Date(this.nextAttemptTime).toISOString()}`
				);
				error.code = 'CIRCUIT_BREAKER_OPEN';
				error.circuitName = this.name;
				error.nextAttemptTime = this.nextAttemptTime;
				throw error;
			} else {
				// Transition to half-open for testing
				this.state = CIRCUIT_STATE.HALF_OPEN;
				console.log(
					`Circuit breaker '${this.name}' transitioning to HALF_OPEN for testing`
				);
			}
		}

		const startTime = performance.now();

		try {
			const result = await operation();
			const duration = performance.now() - startTime;

			// Success - reset circuit breaker
			this.onSuccess(duration, context);
			return result;
		} catch (error) {
			const duration = performance.now() - startTime;
			this.onFailure(error, duration, context);
			throw error;
		}
	}

	/**
	 * Handle successful operation
	 * @param {number} duration - Operation duration in ms
	 * @param {Object} context - Operation context
	 */
	onSuccess(duration, context) {
		this.stats.successfulRequests++;
		this.successCount++;

		if (this.state === CIRCUIT_STATE.HALF_OPEN) {
			console.log(
				`Circuit breaker '${this.name}' test successful, transitioning to CLOSED`
			);
			this.reset();
		} else if (this.state === CIRCUIT_STATE.CLOSED) {
			// Reset failure count on success
			this.failureCount = 0;
		}

		console.log(
			`Circuit breaker '${this.name}' success: ${duration.toFixed(2)}ms`,
			context
		);
	}

	/**
	 * Handle failed operation
	 * @param {Error} error - The error that occurred
	 * @param {number} duration - Operation duration in ms
	 * @param {Object} context - Operation context
	 */
	onFailure(error, duration, context) {
		this.stats.failedRequests++;
		this.failureCount++;
		this.lastFailureTime = Date.now();

		console.error(
			`Circuit breaker '${this.name}' failure #${this.failureCount}: ${error.message} (${duration.toFixed(2)}ms)`,
			context
		);

		// Trip circuit if failure threshold exceeded
		if (this.failureCount >= this.failureThreshold) {
			this.trip();
		}
	}

	/**
	 * Trip the circuit breaker to OPEN state
	 */
	trip() {
		this.state = CIRCUIT_STATE.OPEN;
		this.nextAttemptTime = Date.now() + this.recoveryTimeout;
		this.stats.circuitOpenTime = Date.now();

		console.warn(
			`Circuit breaker '${this.name}' TRIPPED - failing fast until ${new Date(this.nextAttemptTime).toISOString()}`
		);
	}

	/**
	 * Reset circuit breaker to CLOSED state
	 */
	reset() {
		this.state = CIRCUIT_STATE.CLOSED;
		this.failureCount = 0;
		this.successCount = 0;
		this.lastFailureTime = null;
		this.nextAttemptTime = null;
		this.stats.lastReset = Date.now();

		console.log(`Circuit breaker '${this.name}' reset to CLOSED state`);
	}

	/**
	 * Get current circuit breaker status
	 * @returns {Object} Status information
	 */
	getStatus() {
		return {
			name: this.name,
			state: this.state,
			failureCount: this.failureCount,
			successCount: this.successCount,
			totalAttempts: this.totalAttempts,
			lastFailureTime: this.lastFailureTime,
			nextAttemptTime: this.nextAttemptTime,
			stats: { ...this.stats }
		};
	}
}

/**
 * Retry Manager with Exponential Backoff
 * Handles intelligent retry logic with configurable strategies
 */
class RetryManager {
	constructor(options = {}) {
		this.maxRetries = options.maxRetries || 3;
		this.baseDelay = options.baseDelay || 1000; // 1 second
		this.maxDelay = options.maxDelay || 30000; // 30 seconds
		this.backoffMultiplier = options.backoffMultiplier || 2;
		this.jitter = options.jitter !== false; // Add randomness by default

		// Error types that should not be retried
		this.nonRetryableErrors = new Set([
			'CIRCUIT_BREAKER_OPEN',
			'VALIDATION_ERROR',
			'AUTHENTICATION_ERROR',
			'AUTHORIZATION_ERROR',
			'EACCES', // Permission denied
			'ENOTDIR', // Not a directory
			'EISDIR' // Is a directory
		]);
	}

	/**
	 * Execute operation with retry logic
	 * @param {Function} operation - Async operation to retry
	 * @param {Object} context - Operation context
	 * @returns {Promise} Operation result
	 */
	async executeWithRetry(operation, context = {}) {
		let lastError;
		const operationId = context.correlationId || 'unknown';

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				const result = await operation();

				if (attempt > 0) {
					console.log(
						`Retry successful for operation ${operationId} on attempt ${attempt + 1}`
					);
				}

				return result;
			} catch (error) {
				lastError = error;

				// Don't retry on non-retryable errors
				if (this.isNonRetryableError(error)) {
					console.log(
						`Non-retryable error for operation ${operationId}: ${error.message}`
					);
					throw error;
				}

				// Don't retry on last attempt
				if (attempt === this.maxRetries) {
					console.error(
						`Max retries (${this.maxRetries}) exceeded for operation ${operationId}`
					);
					break;
				}

				// Calculate delay with exponential backoff
				const delay = this.calculateDelay(attempt);
				console.warn(
					`Retry ${attempt + 1}/${this.maxRetries} for operation ${operationId} after ${delay}ms: ${error.message}`
				);

				await this.sleep(delay);
			}
		}

		// All retries exhausted
		const exhaustedError = new Error(
			`Operation failed after ${this.maxRetries + 1} attempts: ${lastError.message}`
		);
		exhaustedError.code = 'MAX_RETRIES_EXCEEDED';
		exhaustedError.originalError = lastError;
		exhaustedError.attempts = this.maxRetries + 1;
		throw exhaustedError;
	}

	/**
	 * Check if error should not be retried
	 * @param {Error} error - Error to check
	 * @returns {boolean} True if error should not be retried
	 */
	isNonRetryableError(error) {
		// Check error code
		if (error.code && this.nonRetryableErrors.has(error.code)) {
			return true;
		}

		// Check HTTP status codes (4xx client errors generally shouldn't be retried)
		if (
			error.status >= 400 &&
			error.status < 500 &&
			error.status !== 408 &&
			error.status !== 429
		) {
			return true;
		}

		// Check error message patterns
		if (
			error.message.includes('validation') ||
			error.message.includes('unauthorized') ||
			error.message.includes('forbidden')
		) {
			return true;
		}

		return false;
	}

	/**
	 * Calculate retry delay with exponential backoff and jitter
	 * @param {number} attempt - Current attempt number (0-based)
	 * @returns {number} Delay in milliseconds
	 */
	calculateDelay(attempt) {
		let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
		delay = Math.min(delay, this.maxDelay);

		// Add jitter to prevent thundering herd
		if (this.jitter) {
			delay = delay * (0.5 + Math.random() * 0.5);
		}

		return Math.floor(delay);
	}

	/**
	 * Sleep for specified duration
	 * @param {number} ms - Milliseconds to sleep
	 * @returns {Promise<void>}
	 */
	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Error Context for tracking operation correlation and timing
 */
class ErrorContext {
	constructor(operationName, correlationId = null) {
		this.operationName = operationName;
		this.correlationId = correlationId || this.generateCorrelationId();
		this.startTime = Date.now();
		this.events = [];
	}

	/**
	 * Generate unique correlation ID
	 * @returns {string} Correlation ID
	 */
	generateCorrelationId() {
		return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Add event to context
	 * @param {string} type - Event type
	 * @param {string} message - Event message
	 * @param {Object} data - Additional event data
	 */
	addEvent(type, message, data = {}) {
		this.events.push({
			type,
			message,
			data,
			timestamp: Date.now(),
			elapsed: Date.now() - this.startTime
		});
	}

	/**
	 * Get operation duration
	 * @returns {number} Duration in milliseconds
	 */
	getDuration() {
		return Date.now() - this.startTime;
	}

	/**
	 * Get context summary
	 * @returns {Object} Context summary
	 */
	getSummary() {
		return {
			operationName: this.operationName,
			correlationId: this.correlationId,
			duration: this.getDuration(),
			events: this.events,
			startTime: this.startTime
		};
	}
}

/**
 * Global error recovery configuration
 */
const ERROR_RECOVERY_CONFIG = {
	circuitBreakers: {
		aiService: {
			name: 'ai-service',
			failureThreshold: 5,
			recoveryTimeout: 30000,
			monitoringPeriod: 60000
		},
		fileSystem: {
			name: 'file-system',
			failureThreshold: 3,
			recoveryTimeout: 10000,
			monitoringPeriod: 30000
		},
		tagOperations: {
			name: 'tag-operations',
			failureThreshold: 5,
			recoveryTimeout: 15000,
			monitoringPeriod: 45000
		},
		taskOperations: {
			name: 'task-operations',
			failureThreshold: 5,
			recoveryTimeout: 20000,
			monitoringPeriod: 60000
		}
	},
	retryManager: {
		maxRetries: 3,
		baseDelay: 1000,
		maxDelay: 30000,
		backoffMultiplier: 2,
		jitter: true
	},
	errorTimeout: 30000, // 30 seconds
	maxConcurrentOperations: 50
};

/**
 * Global circuit breakers
 */
const circuitBreakers = {};

/**
 * Initialize circuit breakers
 */
function initializeCircuitBreakers() {
	for (const [key, config] of Object.entries(
		ERROR_RECOVERY_CONFIG.circuitBreakers
	)) {
		circuitBreakers[key] = new CircuitBreaker(config);
	}
}

/**
 * Get or create circuit breaker
 * @param {string} name - Circuit breaker name
 * @returns {CircuitBreaker} Circuit breaker instance
 */
function getCircuitBreaker(name) {
	if (!circuitBreakers[name]) {
		console.warn(`Circuit breaker '${name}' not found, creating default`);
		circuitBreakers[name] = new CircuitBreaker({ name });
	}
	return circuitBreakers[name];
}

/**
 * Global retry manager
 */
const retryManager = new RetryManager(ERROR_RECOVERY_CONFIG.retryManager);

/**
 * Error Recovery Middleware
 * Wraps operations with circuit breakers and retry logic
 */
export function errorRecoveryMiddleware() {
	return async (req, res, next) => {
		const context = new ErrorContext(
			`${req.method} ${req.path}`,
			req.headers['x-correlation-id'] || undefined
		);

		// Attach context to request for use in other middleware
		req.errorContext = context;
		req.correlationId = context.correlationId;

		// Add correlation ID to response headers
		res.setHeader('X-Correlation-ID', context.correlationId);

		context.addEvent('REQUEST_START', 'Request processing started', {
			method: req.method,
			path: req.path,
			userAgent: req.headers['user-agent'],
			ip: req.ip
		});

		// Monitor request completion
		res.on('finish', () => {
			context.addEvent('REQUEST_COMPLETE', 'Request processing completed', {
				statusCode: res.statusCode,
				duration: context.getDuration()
			});

			if (res.statusCode >= 400) {
				console.error(
					`Request failed: ${context.correlationId}`,
					context.getSummary()
				);
			} else {
				console.log(
					`Request completed: ${context.correlationId} (${context.getDuration()}ms)`
				);
			}
		});

		next();
	};
}

/**
 * Create operation wrapper with circuit breaker and retry protection
 * @param {string} circuitBreakerName - Name of circuit breaker to use
 * @param {boolean} enableRetry - Whether to enable retry logic
 * @returns {Function} Operation wrapper
 */
export function createProtectedOperation(
	circuitBreakerName,
	enableRetry = true
) {
	return (operation) => {
		return async (context = {}) => {
			const circuitBreaker = getCircuitBreaker(circuitBreakerName);

			const protectedOperation = () =>
				circuitBreaker.execute(operation, context);

			if (enableRetry) {
				return retryManager.executeWithRetry(protectedOperation, context);
			} else {
				return protectedOperation();
			}
		};
	};
}

/**
 * Enhanced error handling middleware
 * Provides comprehensive error categorization and response formatting
 */
export function enhancedErrorHandler() {
	return (error, req, res, next) => {
		const context =
			req.errorContext || new ErrorContext(`${req.method} ${req.path}`);
		context.addEvent('ERROR', 'Error occurred during request processing', {
			errorType: error.constructor.name,
			errorCode: error.code,
			errorMessage: error.message
		});

		// Circuit breaker errors
		if (error.code === 'CIRCUIT_BREAKER_OPEN') {
			return res.status(503).json({
				error: 'Service Temporarily Unavailable',
				message:
					'Service is experiencing issues and is temporarily unavailable',
				code: 'CIRCUIT_BREAKER_OPEN',
				correlationId: context.correlationId,
				retryAfter: Math.ceil((error.nextAttemptTime - Date.now()) / 1000),
				circuitBreaker: error.circuitName
			});
		}

		// Timeout errors
		if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
			return res.status(408).json({
				error: 'Request Timeout',
				message: 'The request took too long to process',
				code: 'TIMEOUT',
				correlationId: context.correlationId,
				duration: context.getDuration()
			});
		}

		// File system errors
		if (error.code === 'ENOENT') {
			return res.status(404).json({
				error: 'File Not Found',
				message: 'The requested file or resource was not found',
				code: 'FILE_NOT_FOUND',
				correlationId: context.correlationId,
				path: error.path
			});
		}

		if (error.code === 'EACCES') {
			return res.status(403).json({
				error: 'Access Denied',
				message: 'Insufficient permissions to access the resource',
				code: 'ACCESS_DENIED',
				correlationId: context.correlationId
			});
		}

		// Validation errors
		if (
			error.code === 'VALIDATION_ERROR' ||
			error.message.includes('validation')
		) {
			return res.status(400).json({
				error: 'Validation Error',
				message: error.message,
				code: 'VALIDATION_ERROR',
				correlationId: context.correlationId,
				details: error.details || []
			});
		}

		// AI service errors
		if (error.message.includes('AI service') || error.code?.startsWith('AI_')) {
			return res.status(502).json({
				error: 'AI Service Error',
				message: 'AI service is currently unavailable',
				code: 'AI_SERVICE_ERROR',
				correlationId: context.correlationId,
				originalError: error.message
			});
		}

		// Max retries exceeded
		if (error.code === 'MAX_RETRIES_EXCEEDED') {
			return res.status(503).json({
				error: 'Service Unavailable',
				message: 'Operation failed after multiple retry attempts',
				code: 'MAX_RETRIES_EXCEEDED',
				correlationId: context.correlationId,
				attempts: error.attempts,
				originalError: error.originalError?.message
			});
		}

		// Default server error
		console.error(`Unhandled error: ${context.correlationId}`, {
			error: error.message,
			stack: error.stack,
			context: context.getSummary()
		});

		res.status(500).json({
			error: 'Internal Server Error',
			message: 'An unexpected error occurred',
			code: 'INTERNAL_ERROR',
			correlationId: context.correlationId,
			timestamp: new Date().toISOString()
		});
	};
}

/**
 * Get circuit breaker status for monitoring
 * @returns {Object} Status of all circuit breakers
 */
export function getCircuitBreakerStatus() {
	const status = {};
	for (const [name, breaker] of Object.entries(circuitBreakers)) {
		status[name] = breaker.getStatus();
	}
	return status;
}

/**
 * Reset all circuit breakers (for testing or emergency recovery)
 */
export function resetAllCircuitBreakers() {
	for (const breaker of Object.values(circuitBreakers)) {
		breaker.reset();
	}
	console.log('All circuit breakers have been reset');
}

/**
 * Initialize error recovery system
 */
export function initializeErrorRecovery() {
	initializeCircuitBreakers();
	console.log(
		'Error recovery system initialized with circuit breakers:',
		Object.keys(circuitBreakers)
	);
}

// Initialize on module load
initializeErrorRecovery();

export {
	CircuitBreaker,
	RetryManager,
	ErrorContext,
	ERROR_RECOVERY_CONFIG,
	getCircuitBreaker,
	retryManager
};
