/**
 * @fileoverview Logging System
 * Provides structured logging with multiple levels and destinations
 */

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ClassifiedError } from './error-handling.js';

/**
 * Log levels
 */
export enum LogLevel {
	DEBUG = 'debug',
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
	FATAL = 'fatal'
}

/**
 * Log entry structure
 */
export interface LogEntry {
	timestamp: Date;
	level: LogLevel;
	message: string;
	context?: Record<string, unknown>;
	error?: Error;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
	/** Minimum log level to capture */
	level: LogLevel;
	/** Enable console logging */
	console: boolean;
	/** Enable file logging */
	file: boolean;
	/** File path for logs */
	filePath?: string;
	/** Include timestamps */
	timestamps: boolean;
	/** Include context in logs */
	includeContext: boolean;
}

/**
 * Logger class for structured logging
 */
export class Logger {
	private config: LoggerConfig;
	private buffer: LogEntry[] = [];
	private readonly MAX_BUFFER_SIZE = 100;

	constructor(config: Partial<LoggerConfig> = {}) {
		this.config = {
			level: config.level ?? LogLevel.INFO,
			console: config.console ?? true,
			file: config.file ?? false,
			filePath: config.filePath,
			timestamps: config.timestamps ?? true,
			includeContext: config.includeContext ?? true
		};

		// Create log directory if file logging is enabled
		if (this.config.file && this.config.filePath) {
			const logDir = join(process.cwd(), '.taskmaster', 'logs');
			if (!existsSync(logDir)) {
				try {
					mkdirSync(logDir, { recursive: true });
				} catch (error) {
					console.error('Failed to create log directory:', error);
					this.config.file = false;
				}
			}
		}
	}

	/**
	 * Log a debug message
	 */
	public debug(message: string, context?: Record<string, unknown>): void {
		this.log(LogLevel.DEBUG, message, context);
	}

	/**
	 * Log an info message
	 */
	public info(message: string, context?: Record<string, unknown>): void {
		this.log(LogLevel.INFO, message, context);
	}

	/**
	 * Log a warning message
	 */
	public warn(message: string, context?: Record<string, unknown>): void {
		this.log(LogLevel.WARN, message, context);
	}

	/**
	 * Log an error message
	 */
	public error(
		message: string,
		error?: Error | ClassifiedError,
		context?: Record<string, unknown>
	): void {
		const entry: LogEntry = {
			timestamp: new Date(),
			level: LogLevel.ERROR,
			message,
			context,
			error: error instanceof Error ? error : undefined
		};

		if (error && 'category' in error) {
			// ClassifiedError
			entry.context = {
				...entry.context,
				category: error.category,
				severity: error.severity,
				recoveryActions: error.recoveryActions
			};
		}

		this.write(entry);
	}

	/**
	 * Log a fatal error
	 */
	public fatal(
		message: string,
		error?: Error,
		context?: Record<string, unknown>
	): void {
		const entry: LogEntry = {
			timestamp: new Date(),
			level: LogLevel.FATAL,
			message,
			context,
			error
		};
		this.write(entry);
	}

	/**
	 * Log an entry
	 */
	private log(
		level: LogLevel,
		message: string,
		context?: Record<string, unknown>
	): void {
		// Check if log level is enabled
		if (!this.isLevelEnabled(level)) {
			return;
		}

		const entry: LogEntry = {
			timestamp: new Date(),
			level,
			message,
			context
		};

		this.write(entry);
	}

	/**
	 * Write log entry to destinations
	 */
	private write(entry: LogEntry): void {
		// Add to buffer
		this.buffer.push(entry);
		if (this.buffer.length > this.MAX_BUFFER_SIZE) {
			this.buffer.shift();
		}

		// Console output
		if (this.config.console) {
			this.writeToConsole(entry);
		}

		// File output
		if (this.config.file && this.config.filePath) {
			this.writeToFile(entry);
		}
	}

	/**
	 * Write entry to console
	 */
	private writeToConsole(entry: LogEntry): void {
		const formatted = this.formatEntry(entry, false);

		switch (entry.level) {
			case LogLevel.DEBUG:
				console.debug(formatted);
				break;
			case LogLevel.INFO:
				console.info(formatted);
				break;
			case LogLevel.WARN:
				console.warn(formatted);
				break;
			case LogLevel.ERROR:
			case LogLevel.FATAL:
				console.error(formatted);
				if (entry.error) {
					console.error(entry.error.stack);
				}
				break;
		}
	}

	/**
	 * Write entry to file
	 */
	private writeToFile(entry: LogEntry): void {
		if (!this.config.filePath) {
			return;
		}

		const formatted = this.formatEntry(entry, true);
		const logPath = join(
			process.cwd(),
			'.taskmaster',
			'logs',
			this.config.filePath
		);

		try {
			appendFileSync(logPath, formatted + '\n', 'utf-8');
		} catch (error) {
			console.error('Failed to write to log file:', error);
		}
	}

	/**
	 * Format log entry for output
	 */
	private formatEntry(entry: LogEntry, includeStack: boolean): string {
		let output = '';

		// Timestamp
		if (this.config.timestamps) {
			output += `[${entry.timestamp.toISOString()}] `;
		}

		// Level
		output += `[${entry.level.toUpperCase()}] `;

		// Message
		output += entry.message;

		// Context
		if (this.config.includeContext && entry.context) {
			output += ` | Context: ${JSON.stringify(entry.context)}`;
		}

		// Error stack
		if (includeStack && entry.error && entry.error.stack) {
			output += `\nStack: ${entry.error.stack}`;
		}

		return output;
	}

	/**
	 * Check if log level is enabled
	 */
	private isLevelEnabled(level: LogLevel): boolean {
		const levels = [
			LogLevel.DEBUG,
			LogLevel.INFO,
			LogLevel.WARN,
			LogLevel.ERROR,
			LogLevel.FATAL
		];

		const configLevelIndex = levels.indexOf(this.config.level);
		const requestedLevelIndex = levels.indexOf(level);

		return requestedLevelIndex >= configLevelIndex;
	}

	/**
	 * Get recent log entries
	 */
	public getRecentLogs(count = 10): LogEntry[] {
		return this.buffer.slice(-count);
	}

	/**
	 * Clear log buffer
	 */
	public clearBuffer(): void {
		this.buffer = [];
	}

	/**
	 * Update logger configuration
	 */
	public configure(config: Partial<LoggerConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Get current configuration
	 */
	public getConfig(): LoggerConfig {
		return { ...this.config };
	}
}

/**
 * Global logger instance
 */
export const logger = new Logger({
	level:
		process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
	console: true,
	file: false,
	filePath: 'terminal-ui.log',
	timestamps: true,
	includeContext: true
});

/**
 * Create a logger with specific context
 */
export function createLogger(
	name: string,
	config?: Partial<LoggerConfig>
): Logger {
	const contextLogger = new Logger(config);

	// Wrap methods to include name in context
	const wrappedLogger = {
		debug: (message: string, context?: Record<string, unknown>) =>
			contextLogger.debug(message, { ...context, logger: name }),
		info: (message: string, context?: Record<string, unknown>) =>
			contextLogger.info(message, { ...context, logger: name }),
		warn: (message: string, context?: Record<string, unknown>) =>
			contextLogger.warn(message, { ...context, logger: name }),
		error: (
			message: string,
			error?: Error | ClassifiedError,
			context?: Record<string, unknown>
		) => contextLogger.error(message, error, { ...context, logger: name }),
		fatal: (
			message: string,
			error?: Error,
			context?: Record<string, unknown>
		) => contextLogger.fatal(message, error, { ...context, logger: name })
	};

	return wrappedLogger as unknown as Logger;
}
