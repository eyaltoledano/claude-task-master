/**
 * @fileoverview Core logger implementation
 */

import chalk from 'chalk';

export enum LogLevel {
	SILENT = 0,
	ERROR = 1,
	WARN = 2,
	INFO = 3,
	DEBUG = 4
}

/**
 * Log object interface (e.g., MCP context.log)
 */
export interface LogObject {
	info: (message: string) => void;
	warn: (message: string) => void;
	error: (message: string) => void;
	debug: (message: string) => void;
}

/**
 * Log callback can be either a function or a log object
 */
export type LogCallback =
	| ((level: string, message: string) => void)
	| LogObject;

export interface LoggerConfig {
	level?: LogLevel;
	silent?: boolean;
	prefix?: string;
	timestamp?: boolean;
	colors?: boolean;
	// MCP mode silences all output (unless logCallback is provided)
	mcpMode?: boolean;
	// Callback function or object for logging (useful for MCP integration)
	logCallback?: LogCallback;
}

export class Logger {
	private config: LoggerConfig & {
		level: LogLevel;
		silent: boolean;
		prefix: string;
		timestamp: boolean;
		colors: boolean;
		mcpMode: boolean;
	};
	private static readonly DEFAULT_CONFIG = {
		level: LogLevel.SILENT,
		silent: false,
		prefix: '',
		timestamp: false,
		colors: true,
		mcpMode: false,
		logCallback: undefined as LogCallback | undefined
	};

	constructor(config: LoggerConfig = {}) {
		// Check environment variables
		const envConfig: LoggerConfig = {};

		// Check for MCP mode
		if (
			process.env.MCP_MODE === 'true' ||
			process.env.TASK_MASTER_MCP === 'true'
		) {
			envConfig.mcpMode = true;
		}

		// Check for silent mode
		if (
			process.env.TASK_MASTER_SILENT === 'true' ||
			process.env.TM_SILENT === 'true'
		) {
			envConfig.silent = true;
		}

		// Check for log level
		if (process.env.TASK_MASTER_LOG_LEVEL || process.env.TM_LOG_LEVEL) {
			const levelStr = (
				process.env.TASK_MASTER_LOG_LEVEL ||
				process.env.TM_LOG_LEVEL ||
				''
			).toUpperCase();
			if (levelStr in LogLevel) {
				envConfig.level = LogLevel[levelStr as keyof typeof LogLevel];
			}
		}

		// Check for no colors
		if (
			process.env.NO_COLOR === 'true' ||
			process.env.TASK_MASTER_NO_COLOR === 'true'
		) {
			envConfig.colors = false;
		}

		// Merge configs: defaults < constructor < environment
		this.config = {
			...Logger.DEFAULT_CONFIG,
			...config,
			...envConfig
		};

		// MCP mode overrides to silent ONLY if no callback is provided
		if (this.config.mcpMode && !this.config.logCallback) {
			this.config.silent = true;
		}
	}

	/**
	 * Check if logging is enabled for a given level
	 */
	private shouldLog(level: LogLevel): boolean {
		// If a callback is provided, route logs through it while still respecting the configured level
		if (this.config.logCallback) {
			return level <= this.config.level;
		}

		// Otherwise, respect silent/mcpMode flags
		if (this.config.silent || this.config.mcpMode) {
			return false;
		}
		return level <= this.config.level;
	}

	/**
	 * Format a log message
	 */
	private formatMessage(
		level: LogLevel,
		message: string,
		...args: any[]
	): string {
		let formatted = '';

		// Add timestamp if enabled
		if (this.config.timestamp) {
			const timestamp = new Date().toISOString();
			formatted += this.config.colors
				? chalk.gray(`[${timestamp}] `)
				: `[${timestamp}] `;
		}

		// Add prefix if configured
		if (this.config.prefix) {
			formatted += this.config.colors
				? chalk.cyan(`[${this.config.prefix}] `)
				: `[${this.config.prefix}] `;
		}

		// Skip level indicator for cleaner output
		// We can still color the message based on level
		if (this.config.colors) {
			switch (level) {
				case LogLevel.ERROR:
					message = chalk.red(message);
					break;
				case LogLevel.WARN:
					message = chalk.yellow(message);
					break;
				case LogLevel.INFO:
					// Info stays default color
					break;
				case LogLevel.DEBUG:
					message = chalk.gray(message);
					break;
			}
		}

		// Add the message
		formatted += message;

		// Add any additional arguments
		if (args.length > 0) {
			formatted +=
				' ' +
				args
					.map((arg) =>
						typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
					)
					.join(' ');
		}

		return formatted;
	}

	/**
	 * Check if callback is a log object (has info/warn/error/debug methods)
	 */
	private isLogObject(callback: LogCallback): callback is LogObject {
		return (
			typeof callback === 'object' &&
			callback !== null &&
			'info' in callback &&
			'warn' in callback &&
			'error' in callback &&
			'debug' in callback
		);
	}

	/**
	 * Output a log message either to console or callback
	 */
	private output(
		level: LogLevel,
		levelName: string,
		message: string,
		...args: any[]
	): void {
		const formatted = this.formatMessage(level, message, ...args);

		// Use callback if available
		if (this.config.logCallback) {
			// If callback is a log object, call the appropriate method
			if (this.isLogObject(this.config.logCallback)) {
				const method = levelName.toLowerCase() as keyof LogObject;
				if (method in this.config.logCallback) {
					this.config.logCallback[method](formatted);
				}
			} else {
				// Otherwise it's a function callback
				this.config.logCallback(levelName.toLowerCase(), formatted);
			}
			return;
		}

		// Otherwise use console
		switch (level) {
			case LogLevel.ERROR:
				console.error(formatted);
				break;
			case LogLevel.WARN:
				console.warn(formatted);
				break;
			default:
				console.log(formatted);
				break;
		}
	}

	/**
	 * Log an error message
	 */
	error(message: string, ...args: any[]): void {
		if (!this.shouldLog(LogLevel.ERROR)) return;
		this.output(LogLevel.ERROR, 'ERROR', message, ...args);
	}

	/**
	 * Log a warning message
	 */
	warn(message: string, ...args: any[]): void {
		if (!this.shouldLog(LogLevel.WARN)) return;
		this.output(LogLevel.WARN, 'WARN', message, ...args);
	}

	/**
	 * Log an info message
	 */
	info(message: string, ...args: any[]): void {
		if (!this.shouldLog(LogLevel.INFO)) return;
		this.output(LogLevel.INFO, 'INFO', message, ...args);
	}

	/**
	 * Log a debug message
	 */
	debug(message: string, ...args: any[]): void {
		if (!this.shouldLog(LogLevel.DEBUG)) return;
		this.output(LogLevel.DEBUG, 'DEBUG', message, ...args);
	}

	/**
	 * Log a message without any formatting (raw output)
	 * Useful for CLI output that should appear as-is
	 */
	log(message: string, ...args: any[]): void {
		// If callback is provided, use it for raw logs too
		if (this.config.logCallback) {
			const fullMessage =
				args.length > 0 ? [message, ...args].join(' ') : message;

			// If callback is a log object, use info method for raw logs
			if (this.isLogObject(this.config.logCallback)) {
				this.config.logCallback.info(fullMessage);
			} else {
				// Otherwise it's a function callback
				this.config.logCallback('log', fullMessage);
			}
			return;
		}

		// Otherwise, respect silent/mcpMode
		if (this.config.silent || this.config.mcpMode) return;

		if (args.length > 0) {
			console.log(message, ...args);
		} else {
			console.log(message);
		}
	}

	/**
	 * Update logger configuration
	 */
	setConfig(config: Partial<LoggerConfig>): void {
		this.config = {
			...this.config,
			...config
		};

		// MCP mode overrides to silent ONLY if no callback is provided
		if (this.config.mcpMode && !this.config.logCallback) {
			this.config.silent = true;
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): Readonly<
		LoggerConfig & {
			level: LogLevel;
			silent: boolean;
			prefix: string;
			timestamp: boolean;
			colors: boolean;
			mcpMode: boolean;
		}
	> {
		return { ...this.config };
	}

	/**
	 * Create a child logger with a prefix
	 */
	child(prefix: string, config?: Partial<LoggerConfig>): Logger {
		const childPrefix = this.config.prefix
			? `${this.config.prefix}:${prefix}`
			: prefix;

		return new Logger({
			...this.config,
			...config,
			prefix: childPrefix
		});
	}
}
