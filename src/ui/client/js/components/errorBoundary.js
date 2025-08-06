/**
 * Error Boundary System for Vanilla JavaScript
 * Provides error handling, recovery, and graceful degradation for UI components
 *
 * @module ErrorBoundary
 */

class ErrorBoundary {
	/**
	 * Create a new ErrorBoundary instance
	 * @param {Object} options - Configuration options
	 * @param {boolean} options.fallbackUI - Show fallback UI on error (default: true)
	 * @param {boolean} options.logErrors - Log errors to console (default: true)
	 * @param {boolean} options.showErrorDetails - Show error stack in fallback (default: false)
	 * @param {Function} options.onError - Custom error handler callback
	 */
	constructor(options = {}) {
		this.options = {
			fallbackUI: true,
			logErrors: true,
			showErrorDetails: false,
			onError: null,
			...options
		};

		this.errorHandlers = new Map();
		this.componentStates = new Map();
		this.globalErrorHandler = null;
		this.globalUnhandledRejectionHandler = null;
	}

	/**
	 * Wrap a component with error boundary protection
	 * @param {string|Element} selector - CSS selector or DOM element
	 * @param {string} componentName - Name of the component for error messages
	 * @param {Function} renderFn - Optional render function for the component
	 * @returns {string} Unique boundary ID
	 */
	wrap(selector, componentName, renderFn) {
		const element =
			typeof selector === 'string'
				? document.querySelector(selector)
				: selector;

		if (!element) {
			throw new Error(`Element not found: ${selector}`);
		}

		const wrapperId = `error-boundary-${Date.now()}-${Math.random()}`;
		element.setAttribute('data-error-boundary', wrapperId);

		// Save original content
		const originalContent = element.innerHTML;
		this.componentStates.set(wrapperId, {
			componentName,
			originalContent,
			element,
			renderFn,
			errorCount: 0,
			lastError: null
		});

		// Create error handler
		const errorHandler = (error) => {
			this.handleComponentError(wrapperId, error);
		};

		this.errorHandlers.set(wrapperId, errorHandler);

		// Try to render component
		try {
			if (renderFn) {
				renderFn(element);
			}
		} catch (error) {
			this.handleComponentError(wrapperId, error);
		}

		return wrapperId;
	}

	/**
	 * Handle an error in a wrapped component
	 * @private
	 * @param {string} wrapperId - Boundary ID
	 * @param {Error} error - The error that occurred
	 */
	handleComponentError(wrapperId, error) {
		const state = this.componentStates.get(wrapperId);
		if (!state) return;

		state.errorCount++;
		state.lastError = error;

		// Log error
		if (this.options.logErrors) {
			console.error(`Error in component ${state.componentName}:`, error);
		}

		// Show toast notification
		const toastManager =
			(typeof window !== 'undefined' && window.toast) ||
			(typeof global !== 'undefined' && global.toast);
		if (toastManager) {
			toastManager.error(`Error in ${state.componentName}. Click to retry.`, {
				duration: 0,
				actions: [
					{
						label: 'Retry',
						handler: () => this.retry(wrapperId)
					}
				]
			});
		}

		// Render fallback UI
		if (this.options.fallbackUI) {
			this.renderFallback(state);
		}

		// Call custom error handler
		if (this.options.onError) {
			this.options.onError(error, state.componentName);
		}

		// Prevent error propagation
		return true;
	}

	/**
	 * Render fallback UI for a failed component
	 * @private
	 * @param {Object} state - Component state
	 */
	renderFallback(state) {
		const fallback = document.createElement('div');
		fallback.className = 'error-boundary-fallback';
		fallback.innerHTML = `
            <div class="error-message">
                <h3>Something went wrong</h3>
                <p>The ${state.componentName} component encountered an error.</p>
                ${
									this.options.showErrorDetails
										? `
                    <details>
                        <summary>Error details</summary>
                        <pre>${state.lastError?.stack || state.lastError}</pre>
                    </details>
                `
										: ''
								}
                <button class="retry-button" data-boundary="${state.element.getAttribute('data-error-boundary')}">
                    Reload Component
                </button>
            </div>
        `;

		// Clear element and add fallback
		state.element.innerHTML = '';
		state.element.appendChild(fallback);

		// Add retry handler
		const retryBtn = fallback.querySelector('.retry-button');
		if (retryBtn) {
			retryBtn.addEventListener('click', (e) => {
				const boundaryId = e.target.getAttribute('data-boundary');
				this.retry(boundaryId);
			});
		}
	}

	/**
	 * Retry rendering a failed component
	 * @param {string} wrapperId - Boundary ID
	 */
	retry(wrapperId) {
		const state = this.componentStates.get(wrapperId);
		if (!state) return;

		// Reset error state before retry
		const previousErrorCount = state.errorCount;
		state.errorCount = 0;
		state.lastError = null;

		// Restore original content or re-render
		try {
			if (state.renderFn) {
				state.element.innerHTML = '';
				state.renderFn(state.element);
			} else {
				state.element.innerHTML = state.originalContent;
			}

			const toastManager =
				(typeof window !== 'undefined' && window.toast) ||
				(typeof global !== 'undefined' && global.toast);
			if (toastManager) {
				toastManager.info(`${state.componentName} reloaded successfully`);
			}
		} catch (error) {
			// If retry fails, restore previous error count and handle error again
			state.errorCount = previousErrorCount;
			this.handleComponentError(wrapperId, error);
		}
	}

	/**
	 * Attach global error handlers to catch unhandled errors
	 */
	attachGlobalHandlers() {
		// Window error handler
		this.globalErrorHandler = (event) => {
			const { error, message, filename, lineno, colno } = event;

			// Check if error is from a wrapped component
			const target = event.target;
			const boundary =
				target?.closest && target.closest('[data-error-boundary]');

			if (boundary) {
				const boundaryId = boundary.getAttribute('data-error-boundary');
				this.handleComponentError(boundaryId, error || new Error(message));
				event.preventDefault();
				return true;
			}

			// Log uncaught errors
			if (this.options.logErrors) {
				console.error(
					'Uncaught error:',
					error || (message ? new Error(message) : 'Unknown error')
				);
			}
		};

		// Unhandled promise rejection handler
		this.globalUnhandledRejectionHandler = (event) => {
			if (this.options.logErrors) {
				console.error('Unhandled promise rejection:', event.reason);
			}

			const toastManager =
				(typeof window !== 'undefined' && window.toast) ||
				(typeof global !== 'undefined' && global.toast);
			if (toastManager) {
				toastManager.error('An unexpected error occurred');
			}
		};

		window.addEventListener('error', this.globalErrorHandler, true);
		window.addEventListener(
			'unhandledrejection',
			this.globalUnhandledRejectionHandler
		);
	}

	/**
	 * Detach global error handlers
	 */
	detachGlobalHandlers() {
		if (this.globalErrorHandler) {
			window.removeEventListener('error', this.globalErrorHandler, true);
		}
		if (this.globalUnhandledRejectionHandler) {
			window.removeEventListener(
				'unhandledrejection',
				this.globalUnhandledRejectionHandler
			);
		}
	}

	/**
	 * Get error statistics for all wrapped components
	 * @returns {Object} Error statistics
	 */
	getErrorStats() {
		const stats = {
			totalErrors: 0,
			componentErrors: {},
			components: []
		};

		this.componentStates.forEach((state, id) => {
			stats.totalErrors += state.errorCount;
			stats.componentErrors[state.componentName] = state.errorCount;
			stats.components.push({
				id,
				name: state.componentName,
				errorCount: state.errorCount,
				hasError: state.lastError !== null
			});
		});

		return stats;
	}

	/**
	 * Reset all components with errors
	 */
	reset() {
		this.componentStates.forEach((state, id) => {
			if (state.lastError) {
				this.retry(id);
			}
		});
	}

	/**
	 * Clean up and destroy the error boundary
	 */
	destroy() {
		this.detachGlobalHandlers();
		this.errorHandlers.clear();
		this.componentStates.clear();
	}
}

// Create singleton instance for easy access
let errorBoundaryInstance = null;

/**
 * Get or create the global error boundary instance
 * @param {Object} options - Configuration options
 * @returns {ErrorBoundary} Error boundary instance
 */
export function getErrorBoundary(options = {}) {
	if (!errorBoundaryInstance) {
		errorBoundaryInstance = new ErrorBoundary(options);
	}
	return errorBoundaryInstance;
}

// Convenience methods for global instance
export const errorBoundary = {
	wrap: (selector, componentName, renderFn) =>
		getErrorBoundary().wrap(selector, componentName, renderFn),
	retry: (wrapperId) => getErrorBoundary().retry(wrapperId),
	reset: () => getErrorBoundary().reset(),
	getStats: () => getErrorBoundary().getErrorStats(),
	attachGlobalHandlers: () => getErrorBoundary().attachGlobalHandlers(),
	detachGlobalHandlers: () => getErrorBoundary().detachGlobalHandlers(),
	destroy: () => getErrorBoundary().destroy()
};

export default ErrorBoundary;
