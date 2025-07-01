/**
 * Hook Executor - safely executes hooks with error handling and timeouts
 */
export class HookExecutor {
	constructor(options = {}) {
		this.defaultTimeout = options.timeout || 30000; // 30 seconds default
		this.maxConcurrentHooks = options.maxConcurrent || 5;
		this.currentExecutions = 0;
	}

	/**
	 * Execute a hook for a specific event
	 */
	async execute(hookInstance, event, context) {
		// Check concurrency limit
		if (this.currentExecutions >= this.maxConcurrentHooks) {
			throw new Error('Maximum concurrent hook executions reached');
		}

		this.currentExecutions++;

		try {
			// Determine which method to call based on event
			const methodName = this.getMethodName(event);
			
			if (!hookInstance[methodName] || typeof hookInstance[methodName] !== 'function') {
				// Hook doesn't implement this event, skip silently
				return { skipped: true, reason: 'method-not-implemented' };
			}

			// Execute with timeout
			const result = await this.executeWithTimeout(
				hookInstance[methodName].bind(hookInstance),
				context,
				this.getTimeout(hookInstance, event)
			);

			return {
				success: true,
				result,
				executionTime: Date.now() - context.startTime
			};

		} catch (error) {
			return {
				success: false,
				error: error.message,
				stack: error.stack,
				executionTime: Date.now() - context.startTime
			};
		} finally {
			this.currentExecutions--;
		}
	}

	/**
	 * Get the method name for an event
	 */
	getMethodName(event) {
		// Convert kebab-case to camelCase and add 'on' prefix
		const camelCase = event.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
		return `on${camelCase.charAt(0).toUpperCase()}${camelCase.slice(1)}`;
	}

	/**
	 * Execute a function with timeout
	 */
	async executeWithTimeout(fn, context, timeout) {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new Error(`Hook execution timed out after ${timeout}ms`));
			}, timeout);

			// Add start time to context
			const contextWithTime = {
				...context,
				startTime: Date.now()
			};

			Promise.resolve(fn(contextWithTime))
				.then(result => {
					clearTimeout(timeoutId);
					resolve(result);
				})
				.catch(error => {
					clearTimeout(timeoutId);
					reject(error);
				});
		});
	}

	/**
	 * Get timeout for a specific hook and event
	 */
	getTimeout(hookInstance, event) {
		// Check if hook specifies custom timeout
		if (hookInstance.timeouts && hookInstance.timeouts[event]) {
			return hookInstance.timeouts[event];
		}
		
		// Check if hook has a general timeout
		if (hookInstance.timeout) {
			return hookInstance.timeout;
		}

		// Use default timeout
		return this.defaultTimeout;
	}

	/**
	 * Get current execution stats
	 */
	getStats() {
		return {
			currentExecutions: this.currentExecutions,
			maxConcurrent: this.maxConcurrentHooks,
			defaultTimeout: this.defaultTimeout
		};
	}
} 