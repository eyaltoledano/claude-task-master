/**
 * @fileoverview Flow Logging System
 *
 * Implements production-ready structured logging with multiple transports,
 * contextual logging, and integration with Flow configuration and error handling.
 */

import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

/**
 * Log levels with numeric priorities
 */
export const LOG_LEVELS = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3
};

/**
 * Log level colors for console output
 */
const LOG_COLORS = {
	error: '\x1b[31m', // Red
	warn: '\x1b[33m', // Yellow
	info: '\x1b[32m', // Green
	debug: '\x1b[36m', // Cyan
	reset: '\x1b[0m' // Reset
};

/**
 * ANSI escape code regex for stripping colors
 */
const ANSI_REGEX = /\u001B\[[0-9;]*m/g;

/**
 * Log entry structure
 */
export class LogEntry {
	constructor(level, message, meta = {}) {
		this.timestamp = new Date().toISOString();
		this.level = level;
		this.message = message;
		this.meta = { ...meta };
		this.category = meta.category || 'general';
		this.operationId = meta.operationId || null;
		this.context = meta.context || {};
	}

	/**
	 * Convert to JSON for structured logging
	 */
	toJSON() {
		return {
			timestamp: this.timestamp,
			level: this.level,
			message: this.message,
			category: this.category,
			operationId: this.operationId,
			context: this.context,
			meta: this.meta
		};
	}

	/**
	 * Format for simple console output
	 */
	toSimpleString() {
		const color = LOG_COLORS[this.level] || '';
		const reset = LOG_COLORS.reset;
		const timestamp = new Date(this.timestamp).toLocaleTimeString();
		const levelStr = this.level.toUpperCase().padEnd(5);

		let msg = `${color}[${timestamp}] ${levelStr}${reset} ${this.message}`;

		if (this.operationId) {
			msg += ` (${this.operationId})`;
		}

		return msg;
	}

	/**
	 * Format for detailed console output
	 */
	toDetailedString() {
		const simple = this.toSimpleString();
		const details = [];

		if (this.category !== 'general') {
			details.push(`Category: ${this.category}`);
		}

		if (Object.keys(this.context).length > 0) {
			details.push(`Context: ${JSON.stringify(this.context)}`);
		}

		if (Object.keys(this.meta).length > 0) {
			const { category, operationId, context, ...filteredMeta } = this.meta;

			if (Object.keys(filteredMeta).length > 0) {
				details.push(`Meta: ${JSON.stringify(filteredMeta)}`);
			}
		}

		return details.length > 0 ? `${simple}\n  ${details.join('\n  ')}` : simple;
	}
}

/**
 * Base transport interface
 */
export class Transport extends EventEmitter {
	constructor(options = {}) {
		super();
		this.name = options.name || 'transport';
		this.level = options.level || 'info';
		this.format = options.format || 'simple';
		this.enabled = options.enabled !== false;
	}

	/**
	 * Check if level should be logged
	 */
	shouldLog(level) {
		return this.enabled && LOG_LEVELS[level] <= LOG_LEVELS[this.level];
	}

	/**
	 * Log entry (to be implemented by subclasses)
	 */
	async log(entry) {
		throw new Error('Transport.log() must be implemented by subclass');
	}
}

/**
 * Console transport
 */
export class ConsoleTransport extends Transport {
	constructor(options = {}) {
		super({ name: 'console', ...options });
		this.colorize = options.colorize !== false;
	}

	async log(entry) {
		if (!this.shouldLog(entry.level)) return;

		let output;
		switch (this.format) {
			case 'json':
				output = JSON.stringify(entry.toJSON());
				break;
			case 'detailed':
				output = entry.toDetailedString();
				break;
			default:
				output = this.colorize
					? entry.toSimpleString()
					: entry.toSimpleString().replace(/\u001b\[[0-9;]*m/g, '');
				break;
		}

		// Route to appropriate console method
		switch (entry.level) {
			case 'error':
				console.error(output);
				break;
			case 'warn':
				console.warn(output);
				break;
			case 'debug':
				console.debug(output);
				break;
			default:
				console.log(output);
				break;
		}

		this.emit('logged', entry);
	}
}

/**
 * File transport
 */
export class FileTransport extends Transport {
	constructor(options = {}) {
		super({ name: 'file', format: 'json', ...options });
		this.filename = options.filename || 'flow.log';
		this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB
		this.maxFiles = options.maxFiles || 5;
		this.stream = null;
		this.currentSize = 0;
	}

	async log(entry) {
		if (!this.shouldLog(entry.level)) return;

		try {
			await this._ensureStream();

			const output =
				this.format === 'json'
					? JSON.stringify(entry.toJSON()) + '\n'
					: entry.toDetailedString() + '\n';

			await this._writeToFile(output);
			this.emit('logged', entry);
		} catch (error) {
			this.emit('error', error);
		}
	}

	async close() {
		if (this.stream) {
			this.stream.end();
			this.stream = null;
		}
	}

	// Private methods

	async _ensureStream() {
		if (!this.stream) {
			const dir = path.dirname(this.filename);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			this.stream = fs.createWriteStream(this.filename, { flags: 'a' });

			// Get current file size
			try {
				const stats = fs.statSync(this.filename);
				this.currentSize = stats.size;
			} catch {
				this.currentSize = 0;
			}
		}
	}

	async _writeToFile(output) {
		if (this.currentSize + output.length > this.maxSize) {
			await this._rotateFile();
		}

		this.stream.write(output);
		this.currentSize += output.length;
	}

	async _rotateFile() {
		if (this.stream) {
			this.stream.end();
			this.stream = null;
		}

		// Rotate existing files
		for (let i = this.maxFiles - 1; i >= 1; i--) {
			const oldFile = `${this.filename}.${i}`;
			const newFile = `${this.filename}.${i + 1}`;

			if (fs.existsSync(oldFile)) {
				if (i === this.maxFiles - 1) {
					fs.unlinkSync(oldFile); // Delete oldest
				} else {
					fs.renameSync(oldFile, newFile);
				}
			}
		}

		// Move current file to .1
		if (fs.existsSync(this.filename)) {
			fs.renameSync(this.filename, `${this.filename}.1`);
		}

		this.currentSize = 0;
	}
}

/**
 * Memory transport for testing/debugging
 */
export class MemoryTransport extends Transport {
	constructor(options = {}) {
		super({ name: 'memory', ...options });
		this.logs = [];
		this.maxLogs = options.maxLogs || 1000;
	}

	async log(entry) {
		if (!this.shouldLog(entry.level)) return;

		this.logs.push(entry);

		// Keep only recent logs
		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}

		this.emit('logged', entry);
	}

	/**
	 * Get all stored logs
	 */
	getLogs(filter = {}) {
		let logs = [...this.logs];

		if (filter.level) {
			logs = logs.filter((log) => log.level === filter.level);
		}

		if (filter.category) {
			logs = logs.filter((log) => log.category === filter.category);
		}

		if (filter.operationId) {
			logs = logs.filter((log) => log.operationId === filter.operationId);
		}

		if (filter.since) {
			const since = new Date(filter.since);
			logs = logs.filter((log) => new Date(log.timestamp) >= since);
		}

		return logs;
	}

	/**
	 * Clear all logs
	 */
	clear() {
		this.logs = [];
		this.emit('cleared');
	}
}

/**
 * Flow Logger with multiple transports
 */
export class FlowLogger extends EventEmitter {
	constructor(options = {}) {
		super();
		this.transports = new Map();
		this.level = options.level || 'info';
		this.defaultMeta = options.defaultMeta || {};
		this.enabled = options.enabled !== false;
	}

	/**
	 * Add transport
	 */
	addTransport(transport) {
		this.transports.set(transport.name, transport);

		transport.on('error', (error) => {
			this.emit('transport_error', { transport: transport.name, error });
		});

		return this;
	}

	/**
	 * Remove transport
	 */
	removeTransport(name) {
		const transport = this.transports.get(name);
		if (transport) {
			if (transport.close) {
				transport.close();
			}
			this.transports.delete(name);
		}
		return this;
	}

	/**
	 * Get transport
	 */
	getTransport(name) {
		return this.transports.get(name);
	}

	/**
	 * Set log level
	 */
	setLevel(level) {
		if (!(level in LOG_LEVELS)) {
			throw new Error(`Invalid log level: ${level}`);
		}
		this.level = level;
		return this;
	}

	/**
	 * Create child logger with additional context
	 */
	child(meta = {}) {
		const childLogger = new FlowLogger({
			level: this.level,
			defaultMeta: { ...this.defaultMeta, ...meta },
			enabled: this.enabled
		});

		// Copy transports
		for (const transport of this.transports.values()) {
			childLogger.addTransport(transport);
		}

		return childLogger;
	}

	/**
	 * Check if level should be logged
	 */
	shouldLog(level) {
		return this.enabled && LOG_LEVELS[level] <= LOG_LEVELS[this.level];
	}

	/**
	 * Log at specified level
	 */
	async log(level, message, meta = {}) {
		if (!this.shouldLog(level)) return;

		const entry = new LogEntry(level, message, {
			...this.defaultMeta,
			...meta
		});

		// Log to all transports
		const promises = Array.from(this.transports.values()).map(
			async (transport) => {
				try {
					await transport.log(entry);
				} catch (error) {
					this.emit('transport_error', { transport: transport.name, error });
				}
			}
		);

		await Promise.all(promises);
		this.emit('logged', entry);

		return entry;
	}

	/**
	 * Convenience methods for different log levels
	 */
	async error(message, meta = {}) {
		return this.log('error', message, meta);
	}

	async warn(message, meta = {}) {
		return this.log('warn', message, meta);
	}

	async info(message, meta = {}) {
		return this.log('info', message, meta);
	}

	async debug(message, meta = {}) {
		return this.log('debug', message, meta);
	}

	/**
	 * Log error object with full context
	 */
	async logError(error, context = {}) {
		const meta = {
			category: 'error',
			context,
			error: {
				name: error.name,
				message: error.message,
				code: error.code,
				stack: error.stack,
				details: error.details
			}
		};

		if (error.operationId) {
			meta.operationId = error.operationId;
		}

		return this.error(error.message, meta);
	}

	/**
	 * Log execution context
	 */
	async logExecution(phase, executionId, details = {}) {
		return this.info(`Execution ${phase}`, {
			category: 'execution',
			operationId: executionId,
			phase,
			context: details
		});
	}

	/**
	 * Log agent operation
	 */
	async logAgent(operation, agentType, details = {}) {
		return this.info(`Agent ${operation}`, {
			category: 'agent',
			agentType,
			operation,
			context: details
		});
	}

	/**
	 * Log provider operation
	 */
	async logProvider(operation, provider, details = {}) {
		return this.info(`Provider ${operation}`, {
			category: 'provider',
			provider,
			operation,
			context: details
		});
	}

	/**
	 * Close all transports
	 */
	async close() {
		const closePromises = Array.from(this.transports.values())
			.filter((transport) => transport.close)
			.map((transport) => transport.close());

		await Promise.all(closePromises);
		this.transports.clear();
	}
}

/**
 * Global logger instance
 */
export const flowLogger = new FlowLogger();

/**
 * Initialize logging with configuration
 */
export function initializeLogging(config = {}) {
	const {
		level = 'info',
		format = 'simple',
		logToFile = false,
		logFilePath = '.taskmaster/flow/logs/flow.log',
		fileMaxSize = 10 * 1024 * 1024,
		fileMaxFiles = 5,
		enableMemoryTransport = false,
		memoryMaxLogs = 1000
	} = config;

	// Clear existing transports
	for (const transportName of flowLogger.transports.keys()) {
		flowLogger.removeTransport(transportName);
	}

	// Set level
	flowLogger.setLevel(level);

	// Add console transport
	flowLogger.addTransport(
		new ConsoleTransport({
			level,
			format,
			colorize: process.stdout.isTTY
		})
	);

	// Add file transport if enabled
	if (logToFile) {
		flowLogger.addTransport(
			new FileTransport({
				level,
				format: 'json', // Always use JSON for file logs
				filename: logFilePath,
				maxSize: fileMaxSize,
				maxFiles: fileMaxFiles
			})
		);
	}

	// Add memory transport if enabled (useful for testing)
	if (enableMemoryTransport) {
		flowLogger.addTransport(
			new MemoryTransport({
				level,
				maxLogs: memoryMaxLogs
			})
		);
	}

	return flowLogger;
}

/**
 * Create operation logger with unique ID
 */
export function createOperationLogger(operationType, details = {}) {
	const operationId = `${operationType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	return flowLogger.child({
		operationId,
		operationType,
		operationDetails: details
	});
}

/**
 * Logging middleware for error handling integration
 */
export function withLogging(fn, logger = flowLogger, context = {}) {
	return async (...args) => {
		const operationLogger = logger.child(context);

		try {
			await operationLogger.debug('Operation started', { args: args.length });
			const result = await fn(...args);
			await operationLogger.debug('Operation completed successfully');
			return result;
		} catch (error) {
			await operationLogger.logError(error, { args: args.length });
			throw error;
		}
	};
}

/**
 * Export log levels for external use
 */
