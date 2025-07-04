/**
 * Service Mesh for Claude Code Workflow Automation
 * Provides service discovery, circuit breakers, retry logic, and monitoring
 */

import { EventEmitter } from 'events';

export class ServiceMesh extends EventEmitter {
	constructor(config = {}) {
		super();
		
		this.config = {
			retryAttempts: config.retryAttempts || 3,
			circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
			circuitBreakerTimeout: config.circuitBreakerTimeout || 30000,
			healthCheckInterval: config.healthCheckInterval || 5000,
			...config
		};

		// Service registry
		this.services = new Map();
		this.circuitBreakers = new Map();
		this.metrics = new Map();
		
		// Health monitoring
		this.healthCheckInterval = null;
		this.isShuttingDown = false;
	}

	/**
	 * Register a service with the mesh
	 */
	registerService(name, serviceInstance, options = {}) {
		const service = {
			name,
			instance: serviceInstance,
			healthy: true,
			lastHealthCheck: Date.now(),
			failureCount: 0,
			options: {
				enableCircuitBreaker: options.enableCircuitBreaker !== false,
				enableRetry: options.enableRetry !== false,
				healthCheckMethod: options.healthCheckMethod || 'ping',
				...options
			}
		};

		this.services.set(name, service);
		this.metrics.set(name, {
			requests: 0,
			failures: 0,
			successes: 0,
			averageResponseTime: 0,
			lastRequestTime: null
		});

		if (service.options.enableCircuitBreaker) {
			this.circuitBreakers.set(name, {
				state: 'closed', // closed, open, half-open
				failureCount: 0,
				lastFailureTime: null,
				nextAttemptTime: null
			});
		}

		this.emit('service:registered', { name, service });
		return service;
	}

	/**
	 * Call a service method with circuit breaker and retry logic
	 */
	async callService(serviceName, methodName, ...args) {
		const service = this.services.get(serviceName);
		if (!service) {
			throw new Error(`Service '${serviceName}' not found`);
		}

		// Check circuit breaker
		if (service.options.enableCircuitBreaker) {
			const breakerState = await this.checkCircuitBreaker(serviceName);
			if (breakerState === 'open') {
				throw new Error(`Circuit breaker open for service '${serviceName}'`);
			}
		}

		const startTime = Date.now();
		let lastError;

		// Retry logic
		const maxRetries = service.options.enableRetry ? this.config.retryAttempts : 1;
		
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				// Call the service method
				const result = await this.executeServiceCall(service, methodName, args);
				
				// Record success
				await this.recordSuccess(serviceName, Date.now() - startTime);
				
				return result;
			} catch (error) {
				lastError = error;
				
				// Record failure
				await this.recordFailure(serviceName, error);
				
				// If not the last attempt, wait before retry
				if (attempt < maxRetries) {
					const delay = this.calculateRetryDelay(attempt);
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}
		}

		// All retries failed
		throw new Error(`Service call failed after ${maxRetries} attempts: ${lastError.message}`);
	}

	/**
	 * Execute the actual service call
	 */
	async executeServiceCall(service, methodName, args) {
		const method = service.instance[methodName];
		if (typeof method !== 'function') {
			throw new Error(`Method '${methodName}' not found on service '${service.name}'`);
		}

		return await method.apply(service.instance, args);
	}

	/**
	 * Check circuit breaker state
	 */
	async checkCircuitBreaker(serviceName) {
		const breaker = this.circuitBreakers.get(serviceName);
		if (!breaker) return 'closed';

		const now = Date.now();

		switch (breaker.state) {
			case 'closed':
				return 'closed';
				
			case 'open':
				if (now >= breaker.nextAttemptTime) {
					breaker.state = 'half-open';
					this.emit('circuit-breaker:half-open', { serviceName });
					return 'half-open';
				}
				return 'open';
				
			case 'half-open':
				return 'half-open';
				
			default:
				return 'closed';
		}
	}

	/**
	 * Record successful service call
	 */
	async recordSuccess(serviceName, responseTime) {
		const metrics = this.metrics.get(serviceName);
		if (metrics) {
			metrics.requests++;
			metrics.successes++;
			metrics.averageResponseTime = 
				(metrics.averageResponseTime * (metrics.requests - 1) + responseTime) / metrics.requests;
			metrics.lastRequestTime = Date.now();
		}

		// Reset circuit breaker on success
		const breaker = this.circuitBreakers.get(serviceName);
		if (breaker) {
			if (breaker.state === 'half-open') {
				breaker.state = 'closed';
				breaker.failureCount = 0;
				this.emit('circuit-breaker:closed', { serviceName });
			}
		}

		// Reset service failure count
		const service = this.services.get(serviceName);
		if (service) {
			service.failureCount = 0;
			service.healthy = true;
		}
	}

	/**
	 * Record failed service call
	 */
	async recordFailure(serviceName, error) {
		const metrics = this.metrics.get(serviceName);
		if (metrics) {
			metrics.requests++;
			metrics.failures++;
			metrics.lastRequestTime = Date.now();
		}

		// Update circuit breaker
		const breaker = this.circuitBreakers.get(serviceName);
		if (breaker) {
			breaker.failureCount++;
			breaker.lastFailureTime = Date.now();

			if (breaker.failureCount >= this.config.circuitBreakerThreshold) {
				breaker.state = 'open';
				breaker.nextAttemptTime = Date.now() + this.config.circuitBreakerTimeout;
				this.emit('circuit-breaker:open', { serviceName, error });
			}
		}

		// Update service health
		const service = this.services.get(serviceName);
		if (service) {
			service.failureCount++;
			if (service.failureCount >= 3) {
				service.healthy = false;
				this.emit('service:unhealthy', { serviceName, error });
			}
		}
	}

	/**
	 * Calculate retry delay with exponential backoff
	 */
	calculateRetryDelay(attempt) {
		const baseDelay = 1000; // 1 second
		const maxDelay = 30000; // 30 seconds
		const delay = Math.min(baseDelay * (2 ** (attempt - 1)), maxDelay);
		
		// Add jitter to prevent thundering herd
		const jitter = Math.random() * 0.1 * delay;
		return delay + jitter;
	}

	/**
	 * Start health monitoring
	 */
	startHealthMonitoring() {
		if (this.healthCheckInterval) return;

		this.healthCheckInterval = setInterval(async () => {
			if (this.isShuttingDown) return;

			for (const [serviceName, service] of this.services.entries()) {
				try {
					await this.performHealthCheck(serviceName, service);
				} catch (error) {
					console.warn(`Health check failed for service ${serviceName}:`, error.message);
				}
			}
		}, this.config.healthCheckInterval);

		this.emit('health-monitoring:started');
	}

	/**
	 * Perform health check on a service
	 */
	async performHealthCheck(serviceName, service) {
		try {
			const healthMethod = service.options.healthCheckMethod;
			
			if (typeof service.instance[healthMethod] === 'function') {
				await service.instance[healthMethod]();
			} else {
				// Basic connectivity check
				if (typeof service.instance.ping === 'function') {
					await service.instance.ping();
				}
			}

			service.lastHealthCheck = Date.now();
			
			if (!service.healthy) {
				service.healthy = true;
				this.emit('service:recovered', { serviceName });
			}
		} catch (error) {
			service.healthy = false;
			this.emit('service:health-check-failed', { serviceName, error });
		}
	}

	/**
	 * Get service metrics
	 */
	getServiceMetrics(serviceName = null) {
		if (serviceName) {
			return {
				service: this.services.get(serviceName),
				metrics: this.metrics.get(serviceName),
				circuitBreaker: this.circuitBreakers.get(serviceName)
			};
		}

		const allMetrics = {};
		for (const [name] of this.services) {
			allMetrics[name] = this.getServiceMetrics(name);
		}
		return allMetrics;
	}

	/**
	 * Stop health monitoring and shutdown
	 */
	async shutdown() {
		this.isShuttingDown = true;
		
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = null;
		}

		this.emit('service-mesh:shutdown');
	}
}

export default ServiceMesh; 