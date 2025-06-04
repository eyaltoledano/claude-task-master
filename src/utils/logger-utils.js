/**
 * Logger utility functions for Task Master
 * Provides standardized logging patterns for both CLI and utility contexts
 */

import { log as utilLog } from '../../scripts/modules/utils.js';

/**
 * Creates a standard logger object that wraps the utility log function
 * This provides a consistent logger interface across different parts of the application
 * @returns {Object} A logger object with standard logging methods (info, warn, error, debug, success)
 */
export function createStandardLogger() {
	return {
		info: (msg, ...args) => utilLog('info', msg, ...args),
		warn: (msg, ...args) => utilLog('warn', msg, ...args),
		error: (msg, ...args) => utilLog('error', msg, ...args),
		debug: (msg, ...args) => utilLog('debug', msg, ...args),
		success: (msg, ...args) => utilLog('success', msg, ...args)
	};
}

/**
 * Creates a logger using either the provided logger or a default standard logger
 * This is the recommended pattern for functions that accept an optional logger parameter
 * @param {Object|null} providedLogger - Optional logger object passed from caller
 * @returns {Object} A logger object with standard logging methods
 */
export function getLoggerOrDefault(providedLogger = null) {
	return providedLogger || createStandardLogger();
}
