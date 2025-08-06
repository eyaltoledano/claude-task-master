/**
 * Error Logging System
 * Captures, stores, and reports errors with contextual information
 *
 * @module ErrorLogger
 */

class ErrorLogger {
	/**
	 * Create a new ErrorLogger instance
	 * @param {Object} options - Configuration options
	 * @param {number} options.maxLogs - Maximum number of logs to keep (default: 100)
	 * @param {string} options.logLevel - Minimum log level to capture (default: 'error')
	 * @param {boolean} options.persistLogs - Persist logs to localStorage (default: false)
	 */
	constructor(options = {}) {
		this.options = {
			maxLogs: 100,
			logLevel: 'error',
			persistLogs: false,
			...options
		};

		this.logs = [];
		this.logLevels = {
			debug: 0,
			info: 1,
			warn: 2,
			error: 3
		};
		this.currentLevel =
			this.logLevels[this.options.logLevel] !== undefined
				? this.logLevels[this.options.logLevel]
				: 3;
		this.globalErrorHandler = null;
		this.globalRejectionHandler = null;
		this.groupStack = [];

		// Restore logs from localStorage if enabled
		if (this.options.persistLogs) {
			this.restoreLogs();
		}
	}

	/**
	 * Log a message at specified level
	 * @private
	 * @param {string} level - Log level
	 * @param {string} message - Log message
	 * @param {Object} metadata - Additional metadata
	 */
	log(level, message, metadata = {}) {
		const levelValue = this.logLevels[level];
		if (levelValue === undefined || levelValue < this.currentLevel) {
			return;
		}

		const logEntry = {
			level,
			message,
			timestamp: Date.now(),
			metadata,
			type: 'log'
		};

		// If in a group, add to group logs but don't add to main logs
		if (this.groupStack.length > 0) {
			const currentGroup = this.groupStack[this.groupStack.length - 1];
			currentGroup.logs.push(logEntry);
			return; // Don't add to main logs
		} else {
			this.addLog(logEntry);
		}

		// Also log to console in development
		if (typeof console !== 'undefined' && console[level]) {
			console[level](message, metadata);
		}
	}

	/**
	 * Log debug message
	 * @param {string} message - Debug message
	 * @param {Object} metadata - Additional metadata
	 */
	debug(message, metadata) {
		this.log('debug', message, metadata);
	}

	/**
	 * Log info message
	 * @param {string} message - Info message
	 * @param {Object} metadata - Additional metadata
	 */
	info(message, metadata) {
		this.log('info', message, metadata);
	}

	/**
	 * Log warning message
	 * @param {string} message - Warning message
	 * @param {Object} metadata - Additional metadata
	 */
	warn(message, metadata) {
		this.log('warn', message, metadata);
	}

	/**
	 * Log error message
	 * @param {string} message - Error message
	 * @param {Object} metadata - Additional metadata
	 */
	error(message, metadata) {
		this.log('error', message, metadata);
	}

	/**
	 * Log an Error object
	 * @param {Error} error - Error object
	 * @param {Object} metadata - Additional metadata
	 */
	logError(error, metadata = {}) {
		const logEntry = {
			level: 'error',
			message: error.message || 'Unknown error',
			stack: error.stack,
			timestamp: Date.now(),
			metadata: {
				...metadata,
				errorName: error.name,
				errorType: error.constructor.name
			},
			type: 'error'
		};

		if (metadata.context) {
			logEntry.context = metadata.context;
		}

		this.addLog(logEntry);
	}

	/**
	 * Start a log group
	 * @param {string} label - Group label
	 */
	group(label) {
		const groupEntry = {
			type: 'group',
			label,
			logs: [],
			timestamp: Date.now()
		};

		this.groupStack.push(groupEntry);

		if (typeof console !== 'undefined' && console.group) {
			console.group(label);
		}
	}

	/**
	 * End the current log group
	 */
	groupEnd() {
		if (this.groupStack.length === 0) return;

		const group = this.groupStack.pop();
		this.addLog(group);

		if (typeof console !== 'undefined' && console.groupEnd) {
			console.groupEnd();
		}
	}

	/**
	 * Add log entry to storage
	 * @private
	 * @param {Object} logEntry - Log entry to add
	 */
	addLog(logEntry) {
		this.logs.push(logEntry);

		// Trim logs if exceeding max
		if (this.logs.length > this.options.maxLogs) {
			this.logs = this.logs.slice(-this.options.maxLogs);
		}

		// Persist if enabled
		if (this.options.persistLogs) {
			this.persistLogs();
		}
	}

	/**
	 * Attach global error handlers
	 */
	attachGlobalHandlers() {
		// Window error handler
		this.globalErrorHandler = (event) => {
			const { error, message, filename, lineno, colno } = event;

			const logEntry = {
				level: 'error',
				message: error?.message || message || 'Unknown error',
				stack: error?.stack,
				timestamp: Date.now(),
				metadata: {
					filename,
					lineno,
					colno,
					userAgent:
						typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
				},
				type: 'uncaughtError'
			};

			this.addLog(logEntry);
		};

		// Unhandled promise rejection handler
		this.globalRejectionHandler = (event) => {
			const reason = event.reason;

			const logEntry = {
				level: 'error',
				message: `Unhandled promise rejection: ${reason?.message || reason}`,
				stack: reason?.stack,
				timestamp: Date.now(),
				metadata: {
					promise: event.promise,
					userAgent:
						typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
				},
				type: 'unhandledRejection'
			};

			this.addLog(logEntry);
		};

		window.addEventListener('error', this.globalErrorHandler);
		window.addEventListener('unhandledrejection', this.globalRejectionHandler);
	}

	/**
	 * Detach global error handlers
	 */
	detachGlobalHandlers() {
		if (this.globalErrorHandler) {
			window.removeEventListener('error', this.globalErrorHandler);
		}
		if (this.globalRejectionHandler) {
			window.removeEventListener(
				'unhandledrejection',
				this.globalRejectionHandler
			);
		}
	}

	/**
	 * Get all logs
	 * @returns {Array} All logs
	 */
	getLogs() {
		return [...this.logs];
	}

	/**
	 * Get logs by level
	 * @param {string|Array} level - Log level(s) to filter by
	 * @returns {Array} Filtered logs
	 */
	getLogsByLevel(level) {
		const levels = Array.isArray(level) ? level : [level];
		return this.logs.filter((log) => levels.includes(log.level));
	}

	/**
	 * Search logs by message
	 * @param {string} query - Search query
	 * @returns {Array} Matching logs
	 */
	searchLogs(query) {
		const lowerQuery = query.toLowerCase();
		return this.logs.filter(
			(log) => log.message && log.message.toLowerCase().includes(lowerQuery)
		);
	}

	/**
	 * Get logs by time range
	 * @param {number} start - Start timestamp
	 * @param {number} end - End timestamp
	 * @returns {Array} Logs within time range
	 */
	getLogsByTimeRange(start, end) {
		return this.logs.filter(
			(log) => log.timestamp >= start && log.timestamp <= end
		);
	}

	/**
	 * Get error summary statistics
	 * @returns {Object} Summary statistics
	 */
	getSummary() {
		const summary = {
			total: this.logs.length,
			byLevel: {
				debug: 0,
				info: 0,
				warn: 0,
				error: 0
			},
			errorRate: 0,
			timeRange: {
				start: null,
				end: null
			}
		};

		if (this.logs.length === 0) return summary;

		// Count by level
		this.logs.forEach((log) => {
			if (summary.byLevel[log.level] !== undefined) {
				summary.byLevel[log.level]++;
			}
		});

		// Calculate error rate
		summary.errorRate = summary.byLevel.error / summary.total;

		// Get time range
		const timestamps = this.logs.map((log) => log.timestamp).filter(Boolean);
		if (timestamps.length > 0) {
			summary.timeRange.start = Math.min(...timestamps);
			summary.timeRange.end = Math.max(...timestamps);
		}

		return summary;
	}

	/**
	 * Export logs in specified format
	 * @param {string} format - Export format ('json' or 'csv')
	 * @returns {string} Exported logs
	 */
	exportLogs(format = 'json') {
		if (format === 'json') {
			return JSON.stringify(this.logs, null, 2);
		}

		if (format === 'csv') {
			const headers = ['timestamp', 'level', 'message', 'metadata'];
			const rows = [headers.join(',')];

			this.logs.forEach((log) => {
				const message = (log.message || '').replace(/"/g, '""');
				const metadata = JSON.stringify(log.metadata || {}).replace(/"/g, '""');
				const row = [
					log.timestamp,
					log.level,
					message.includes(',') || message.includes('"')
						? `"${message}"`
						: message,
					`"${metadata}"`
				];
				rows.push(row.join(','));
			});

			return rows.join('\n');
		}

		throw new Error(`Unsupported export format: ${format}`);
	}

	/**
	 * Clear all logs
	 */
	clear() {
		this.logs = [];

		if (this.options.persistLogs && typeof window !== 'undefined') {
			window.localStorage.removeItem('error-logs');
		}
	}

	/**
	 * Persist logs to localStorage
	 * @private
	 */
	persistLogs() {
		if (typeof window === 'undefined' || !window.localStorage) return;

		try {
			window.localStorage.setItem('error-logs', JSON.stringify(this.logs));
		} catch (error) {
			// Ignore storage errors
		}
	}

	/**
	 * Restore logs from localStorage
	 * @private
	 */
	restoreLogs() {
		if (typeof window === 'undefined' || !window.localStorage) return;

		try {
			const stored = window.localStorage.getItem('error-logs');
			if (stored) {
				this.logs = JSON.parse(stored);
			}
		} catch (error) {
			// Ignore storage errors
		}
	}

	/**
	 * Clean up and destroy the logger
	 */
	destroy() {
		this.detachGlobalHandlers();
		this.clear();
	}
}

// Create singleton instance for easy access
let errorLoggerInstance = null;

/**
 * Get or create the global error logger instance
 * @param {Object} options - Configuration options
 * @returns {ErrorLogger} Error logger instance
 */
export function getErrorLogger(options = {}) {
	if (!errorLoggerInstance) {
		errorLoggerInstance = new ErrorLogger(options);
	}
	return errorLoggerInstance;
}

// Convenience methods for global instance
export const logger = {
	debug: (message, metadata) => getErrorLogger().debug(message, metadata),
	info: (message, metadata) => getErrorLogger().info(message, metadata),
	warn: (message, metadata) => getErrorLogger().warn(message, metadata),
	error: (message, metadata) => getErrorLogger().error(message, metadata),
	logError: (error, metadata) => getErrorLogger().logError(error, metadata),
	getLogs: () => getErrorLogger().getLogs(),
	clear: () => getErrorLogger().clear(),
	exportLogs: (format) => getErrorLogger().exportLogs(format),
	getSummary: () => getErrorLogger().getSummary()
};

export default ErrorLogger;
