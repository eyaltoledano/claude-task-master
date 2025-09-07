/**
 * @fileoverview Logger factory and singleton management
 */

import { Logger, type LoggerConfig } from './logger.js';

// Global logger instance
let globalLogger: Logger | null = null;

// Named logger instances
const loggers = new Map<string, Logger>();

/**
 * Create a new logger instance
 */
export function createLogger(config?: LoggerConfig): Logger {
	return new Logger(config);
}

/**
 * Get or create a named logger instance
 */
export function getLogger(name?: string, config?: LoggerConfig): Logger {
	// If no name provided, return global logger
	if (!name) {
		if (!globalLogger) {
			globalLogger = createLogger(config);
		}
		return globalLogger;
	}

	// Check if named logger exists
	if (!loggers.has(name)) {
		loggers.set(
			name,
			createLogger({
				prefix: name,
				...config
			})
		);
	}

	return loggers.get(name)!;
}

/**
 * Set the global logger instance
 */
export function setGlobalLogger(logger: Logger): void {
	globalLogger = logger;
}

/**
 * Clear all logger instances (useful for testing)
 */
export function clearLoggers(): void {
	globalLogger = null;
	loggers.clear();
}
