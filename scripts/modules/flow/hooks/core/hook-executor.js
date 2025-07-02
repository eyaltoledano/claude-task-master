/**
 * Hook Executor - Handles execution of hook methods with proper error handling and timeouts
 */
export class HookExecutor {
	constructor(options = {}) {
		this.defaultTimeout = options.timeout || 30000; // 30 seconds
		this.maxConcurrent = options.maxConcurrent || 3;
		this.activeExecutions = new Map();
	}

	/**
	 * Execute a hook for a specific event
	 */
	async executeHook(hookInstance, event, context, config = {}) {
		const startTime = Date.now();
		const executionId = `${hookInstance.constructor.name}-${event}-${startTime}`;
		
		try {
			// Check if hook supports this event
			if (!hookInstance.events || !hookInstance.events.includes(event)) {
				return {
					success: false,
					error: `Hook does not support event: ${event}`,
					duration: 0
				};
			}

			// Check concurrent execution limit
			if (this.activeExecutions.size >= this.maxConcurrent) {
				return {
					success: false,
					error: 'Maximum concurrent hook executions reached',
					duration: 0
				};
			}

			// Track active execution
			this.activeExecutions.set(executionId, {
				hookName: hookInstance.constructor.name,
				event,
				startTime
			});

			// Determine timeout
			const timeout = config.timeout || this.defaultTimeout;

			// Execute hook with timeout
			const result = await this.executeWithTimeout(
				hookInstance,
				event,
				context,
				timeout
			);

			const duration = Date.now() - startTime;

			return {
				success: true,
				data: result,
				duration,
				executionId
			};

		} catch (error) {
			const duration = Date.now() - startTime;
			
			return {
				success: false,
				error: error.message,
				duration,
				executionId
			};
		} finally {
			// Clean up tracking
			this.activeExecutions.delete(executionId);
		}
	}

	/**
	 * Execute hook method with timeout protection
	 */
	async executeWithTimeout(hookInstance, event, context, timeout) {
		return new Promise((resolve, reject) => {
			// Set up timeout
			const timeoutId = setTimeout(() => {
				reject(new Error(`Hook execution timed out after ${timeout}ms`));
			}, timeout);

			// Determine which method to call based on event
			const methodName = this.getHookMethodName(event);
			
			if (!hookInstance[methodName] || typeof hookInstance[methodName] !== 'function') {
				clearTimeout(timeoutId);
				resolve(null); // Hook doesn't implement this method, which is okay
				return;
			}

			// Execute the hook method (handle both sync and async methods)
			try {
				const result = hookInstance[methodName](context);
				
				// Check if result is a Promise
				if (result && typeof result.then === 'function') {
					result
						.then((data) => {
							clearTimeout(timeoutId);
							resolve(data);
						})
						.catch((error) => {
							clearTimeout(timeoutId);
							reject(error);
						});
				} else {
					// Synchronous result
					clearTimeout(timeoutId);
					resolve(result);
				}
			} catch (error) {
				clearTimeout(timeoutId);
				reject(error);
			}
		});
	}

	/**
	 * Map event names to hook method names
	 */
	getHookMethodName(event) {
		const eventMethodMap = {
			'pre-launch': 'onPreLaunch',
			'post-worktree': 'onPostWorktree',
			'pre-research': 'onPreResearch',
			'post-research': 'onPostResearch',
			'pre-claude-md': 'onPreClaudeMd',
			'post-claude-md': 'onPostClaudeMd',
			'session-started': 'onSessionStarted',
			'session-message': 'onSessionMessage',
			'session-completed': 'onSessionCompleted',
			'session-failed': 'onSessionFailed',
			'pre-pr': 'onPrePR',
			'pr-created': 'onPrCreated',
			'pr-status-changed': 'onPrStatusChanged',
			'pr-ready-to-merge': 'onPrReadyToMerge',
			'pr-merged': 'onPrMerged',
			'pr-checks-failed': 'onPrChecksFailed'
		};

		return eventMethodMap[event] || `on${this.capitalizeFirst(event.replace(/-/g, ''))}`;
	}

	/**
	 * Capitalize first letter of a string
	 */
	capitalizeFirst(str) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	/**
	 * Get active execution statistics
	 */
	getExecutionStats() {
		return {
			activeExecutions: this.activeExecutions.size,
			maxConcurrent: this.maxConcurrent,
			defaultTimeout: this.defaultTimeout,
			activeHooks: Array.from(this.activeExecutions.values()).map(exec => ({
				hookName: exec.hookName,
				event: exec.event,
				duration: Date.now() - exec.startTime
			}))
		};
	}

	/**
	 * Cancel all active executions
	 */
	async cancelAllExecutions() {
		const activeCount = this.activeExecutions.size;
		this.activeExecutions.clear();
		return { cancelledCount: activeCount };
	}

	/**
	 * Update executor configuration
	 */
	updateConfig(options = {}) {
		if (options.timeout !== undefined) {
			this.defaultTimeout = options.timeout;
		}
		if (options.maxConcurrent !== undefined) {
			this.maxConcurrent = options.maxConcurrent;
		}
	}
} 