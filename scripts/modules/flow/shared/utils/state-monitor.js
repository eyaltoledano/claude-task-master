/**
 * State Management Performance Monitor
 * Tracks re-renders, state changes, and performance metrics
 */

class StateMonitor {
	constructor() {
		this.renderCounts = new Map();
		this.stateChanges = new Map();
		this.performanceMetrics = new Map();
		this.subscriptions = new Map();
		this.isEnabled = false;
	}

	/**
	 * Enable monitoring
	 */
	enable() {
		this.isEnabled = true;
		console.log('[State Monitor] Performance monitoring enabled');
	}

	/**
	 * Disable monitoring
	 */
	disable() {
		this.isEnabled = false;
		console.log('[State Monitor] Performance monitoring disabled');
	}

	/**
	 * Track component render
	 */
	trackRender(componentName) {
		if (!this.isEnabled) return;

		const count = this.renderCounts.get(componentName) || 0;
		this.renderCounts.set(componentName, count + 1);

		// Log excessive renders
		if (count > 0 && count % 10 === 0) {
			console.warn(
				`[State Monitor] ${componentName} has rendered ${count + 1} times`
			);
		}
	}

	/**
	 * Track state changes in Zustand stores
	 */
	trackStateChange(storeName, changedFields, prevState, nextState) {
		if (!this.isEnabled) return;

		const timestamp = performance.now();
		const changes = this.stateChanges.get(storeName) || [];

		changes.push({
			timestamp,
			changedFields,
			changeCount: changedFields.length,
			stateSize: JSON.stringify(nextState).length
		});

		// Keep only last 100 changes to prevent memory leaks
		if (changes.length > 100) {
			changes.shift();
		}

		this.stateChanges.set(storeName, changes);

		// Log frequent state changes
		const recentChanges = changes.filter(
			(change) => timestamp - change.timestamp < 1000 // Last 1 second
		);

		if (recentChanges.length > 5) {
			console.warn(
				`[State Monitor] ${storeName} has ${recentChanges.length} state changes in the last second`
			);
		}
	}

	/**
	 * Subscribe to store changes for monitoring
	 */
	subscribeToStore(store, storeName) {
		if (this.subscriptions.has(storeName)) {
			return; // Already subscribed
		}

		const unsubscribe = store.subscribe((state, prevState) => {
			const changedFields = this.getChangedFields(prevState, state);
			if (changedFields.length > 0) {
				this.trackStateChange(storeName, changedFields, prevState, state);
			}
		});

		this.subscriptions.set(storeName, unsubscribe);
		console.log(`[State Monitor] Subscribed to ${storeName} store`);
	}

	/**
	 * Unsubscribe from store monitoring
	 */
	unsubscribeFromStore(storeName) {
		const unsubscribe = this.subscriptions.get(storeName);
		if (unsubscribe) {
			unsubscribe();
			this.subscriptions.delete(storeName);
			console.log(`[State Monitor] Unsubscribed from ${storeName} store`);
		}
	}

	/**
	 * Get fields that changed between states
	 */
	getChangedFields(prevState, nextState) {
		const changed = [];
		const allKeys = new Set([
			...Object.keys(prevState || {}),
			...Object.keys(nextState || {})
		]);

		for (const key of allKeys) {
			if (prevState?.[key] !== nextState?.[key]) {
				changed.push(key);
			}
		}

		return changed;
	}

	/**
	 * Get render statistics
	 */
	getRenderStats() {
		const stats = {};
		for (const [component, count] of this.renderCounts) {
			stats[component] = count;
		}
		return stats;
	}

	/**
	 * Get state change statistics
	 */
	getStateChangeStats() {
		const stats = {};
		for (const [storeName, changes] of this.stateChanges) {
			const recentChanges = changes.filter(
				(change) => performance.now() - change.timestamp < 60000 // Last minute
			);

			stats[storeName] = {
				totalChanges: changes.length,
				recentChanges: recentChanges.length,
				averageChangeSize:
					recentChanges.reduce((sum, change) => sum + change.changeCount, 0) /
						recentChanges.length || 0
			};
		}
		return stats;
	}

	/**
	 * Get performance summary
	 */
	getPerformanceSummary() {
		return {
			isEnabled: this.isEnabled,
			renderStats: this.getRenderStats(),
			stateChangeStats: this.getStateChangeStats(),
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Reset all monitoring data
	 */
	reset() {
		this.renderCounts.clear();
		this.stateChanges.clear();
		this.performanceMetrics.clear();
		console.log('[State Monitor] All monitoring data reset');
	}

	/**
	 * Generate performance report
	 */
	generateReport() {
		const summary = this.getPerformanceSummary();

		console.group('[State Monitor] Performance Report');
		console.log(
			'Monitoring Status:',
			summary.isEnabled ? 'Enabled' : 'Disabled'
		);

		console.group('Render Statistics:');
		Object.entries(summary.renderStats).forEach(([component, count]) => {
			const level = count > 50 ? 'warn' : count > 20 ? 'info' : 'log';
			console[level](`${component}: ${count} renders`);
		});
		console.groupEnd();

		console.group('State Change Statistics:');
		Object.entries(summary.stateChangeStats).forEach(([store, stats]) => {
			console.log(`${store}:`, {
				total: stats.totalChanges,
				recent: stats.recentChanges,
				avgSize: stats.averageChangeSize.toFixed(2)
			});
		});
		console.groupEnd();

		console.groupEnd();

		return summary;
	}
}

// Global state monitor instance
export const stateMonitor = new StateMonitor();

/**
 * React hook for tracking component renders
 */
export const useRenderTracker = (componentName) => {
	React.useEffect(() => {
		stateMonitor.trackRender(componentName);
	});
};

/**
 * Higher-order component for render tracking
 */
export const withRenderTracking = (Component, componentName) => {
	return React.memo((props) => {
		useRenderTracker(componentName || Component.name);
		return React.createElement(Component, props);
	});
};

/**
 * Store validation utilities
 */
export const storeValidation = {
	/**
	 * Validate store structure
	 */
	validateStore(store, storeName, expectedFields = []) {
		const state = store.getState();
		const issues = [];

		// Check for expected fields
		expectedFields.forEach((field) => {
			if (!(field in state)) {
				issues.push(`Missing expected field: ${field}`);
			}
		});

		// Check for function vs data separation
		const functions = [];
		const data = [];

		Object.entries(state).forEach(([key, value]) => {
			if (typeof value === 'function') {
				functions.push(key);
			} else {
				data.push(key);
			}
		});

		// Warn if actions aren't properly prefixed
		functions.forEach((fn) => {
			if (
				!fn.startsWith('set') &&
				!fn.startsWith('get') &&
				!fn.startsWith('reset') &&
				!fn.startsWith('clear')
			) {
				issues.push(`Action function '${fn}' doesn't follow naming convention`);
			}
		});

		if (issues.length > 0) {
			console.warn(`[Store Validation] Issues found in ${storeName}:`, issues);
		} else {
			console.log(`[Store Validation] ${storeName} passed validation`);
		}

		return {
			valid: issues.length === 0,
			issues,
			functions,
			data
		};
	},

	/**
	 * Check for potential performance issues
	 */
	checkPerformance(store, storeName) {
		const state = store.getState();
		const warnings = [];

		// Check state size
		const stateSize = JSON.stringify(state).length;
		if (stateSize > 100000) {
			// 100KB
			warnings.push(`Large state size: ${(stateSize / 1024).toFixed(2)}KB`);
		}

		// Check for deep nesting
		const maxDepth = this.getObjectDepth(state);
		if (maxDepth > 5) {
			warnings.push(`Deep object nesting: ${maxDepth} levels`);
		}

		// Check for large arrays
		Object.entries(state).forEach(([key, value]) => {
			if (Array.isArray(value) && value.length > 1000) {
				warnings.push(`Large array '${key}': ${value.length} items`);
			}
		});

		if (warnings.length > 0) {
			console.warn(
				`[Performance Check] ${storeName} has potential issues:`,
				warnings
			);
		}

		return {
			stateSize,
			maxDepth,
			warnings
		};
	},

	/**
	 * Get object depth for nesting check
	 */
	getObjectDepth(obj, depth = 0) {
		if (obj === null || typeof obj !== 'object') {
			return depth;
		}

		const depths = Object.values(obj).map((value) =>
			this.getObjectDepth(value, depth + 1)
		);

		return Math.max(depth, ...depths);
	}
};

/**
 * Development tools for debugging stores
 */
export const devTools = {
	/**
	 * Log store state in a readable format
	 */
	logStore(store, storeName) {
		const state = store.getState();
		console.group(`[Store Debug] ${storeName} State`);
		console.log('Raw State:', state);

		// Separate actions from data
		const actions = {};
		const data = {};

		Object.entries(state).forEach(([key, value]) => {
			if (typeof value === 'function') {
				actions[key] = 'function';
			} else {
				data[key] = value;
			}
		});

		console.log('Data:', data);
		console.log('Actions:', Object.keys(actions));
		console.groupEnd();
	},

	/**
	 * Compare states for debugging
	 */
	compareStates(prevState, nextState, storeName) {
		const changes = stateMonitor.getChangedFields(prevState, nextState);

		if (changes.length > 0) {
			console.group(`[Store Diff] ${storeName} Changes`);
			changes.forEach((field) => {
				console.log(`${field}:`, {
					from: prevState[field],
					to: nextState[field]
				});
			});
			console.groupEnd();
		}
	},

	/**
	 * Track action calls
	 */
	wrapActionWithLogging(action, actionName, storeName) {
		return (...args) => {
			console.log(
				`[Action] ${storeName}.${actionName}(${args
					.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
					.join(', ')})`
			);

			const result = action(...args);
			return result;
		};
	}
};

/**
 * Auto-monitor setup for stores
 */
export const setupStoreMonitoring = (stores) => {
	// Enable monitoring in development
	if (process.env.NODE_ENV === 'development') {
		stateMonitor.enable();

		// Subscribe to all stores
		Object.entries(stores).forEach(([name, store]) => {
			stateMonitor.subscribeToStore(store, name);
			storeValidation.validateStore(store, name);
			storeValidation.checkPerformance(store, name);
		});

		// Add global debug methods
		if (typeof window !== 'undefined') {
			window.stateMonitor = stateMonitor;
			window.devTools = devTools;
			window.storeValidation = storeValidation;
		}

		console.log('[State Monitor] Development monitoring setup complete');
	}
};

export default stateMonitor;
