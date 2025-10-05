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

export interface LoggerConfig {
	level?: LogLevel;
	silent?: boolean;
	prefix?: string;
	timestamp?: boolean;
	colors?: boolean;
	// MCP mode silences all output
	mcpMode?: boolean;
}

export class Logger {
	private config: Required<LoggerConfig>;
	private static readonly DEFAULT_CONFIG: Required<LoggerConfig> = {
		level: LogLevel.WARN,
		silent: false,
		prefix: '',
		timestamp: false,
		colors: true,
		mcpMode: false
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

		// MCP mode overrides everything to be silent
		if (this.config.mcpMode) {
			this.config.silent = true;
		}
	}

	/**
	 * Check if logging is enabled for a given level
	 */
	private shouldLog(level: LogLevel): boolean {
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
	 * Log an error message
	 */
	error(message: string, ...args: any[]): void {
		if (!this.shouldLog(LogLevel.ERROR)) return;
		console.error(this.formatMessage(LogLevel.ERROR, message, ...args));
	}

	/**
	 * Log a warning message
	 */
	warn(message: string, ...args: any[]): void {
		if (!this.shouldLog(LogLevel.WARN)) return;
		console.warn(this.formatMessage(LogLevel.WARN, message, ...args));
	}

	/**
	 * Log an info message
	 */
	info(message: string, ...args: any[]): void {
		if (!this.shouldLog(LogLevel.INFO)) return;
		console.log(this.formatMessage(LogLevel.INFO, message, ...args));
	}

	/**
	 * Log a debug message
	 */
	debug(message: string, ...args: any[]): void {
		if (!this.shouldLog(LogLevel.DEBUG)) return;
		console.log(this.formatMessage(LogLevel.DEBUG, message, ...args));
	}

	/**
	 * Log a message without any formatting (raw output)
	 * Useful for CLI output that should appear as-is
	 */
	log(message: string, ...args: any[]): void {
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

		// MCP mode always overrides to silent
		if (this.config.mcpMode) {
			this.config.silent = true;
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): Readonly<Required<LoggerConfig>> {
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
