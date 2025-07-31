/**
 * Webview Logger Utility
 * Provides conditional logging based on environment
 */

type LogLevel = 'log' | 'warn' | 'error' | 'debug' | 'info';

interface LogEntry {
	level: LogLevel;
	message: string;
	data?: any;
	timestamp: number;
}

class WebviewLogger {
	private static instance: WebviewLogger;
	private enabled: boolean;
	private logHistory: LogEntry[] = [];
	private maxHistorySize = 100;

	private constructor() {
		// Enable logging in development, disable in production
		// Check for development mode via various indicators
		this.enabled = this.isDevelopment();
	}

	static getInstance(): WebviewLogger {
		if (!WebviewLogger.instance) {
			WebviewLogger.instance = new WebviewLogger();
		}
		return WebviewLogger.instance;
	}

	private isDevelopment(): boolean {
		// Check various indicators for development mode
		// VS Code webviews don't have process.env, so we check other indicators
		return (
			// Check if running in localhost (development server)
			window.location.hostname === 'localhost' ||
			// Check for development query parameter
			window.location.search.includes('debug=true') ||
			// Check for VS Code development mode indicator
			(window as any).__VSCODE_DEV_MODE__ === true ||
			// Default to false in production
			false
		);
	}

	private addToHistory(entry: LogEntry): void {
		this.logHistory.push(entry);
		if (this.logHistory.length > this.maxHistorySize) {
			this.logHistory.shift();
		}
	}

	private logMessage(level: LogLevel, message: string, ...args: any[]): void {
		const entry: LogEntry = {
			level,
			message,
			data: args.length > 0 ? args : undefined,
			timestamp: Date.now()
		};

		this.addToHistory(entry);

		if (!this.enabled) {
			return;
		}

		// Format the message with timestamp
		const timestamp = new Date().toISOString();
		const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

		// Use appropriate console method
		switch (level) {
			case 'error':
				console.error(prefix, message, ...args);
				break;
			case 'warn':
				console.warn(prefix, message, ...args);
				break;
			case 'debug':
				console.debug(prefix, message, ...args);
				break;
			case 'info':
				console.info(prefix, message, ...args);
				break;
			default:
				console.log(prefix, message, ...args);
		}
	}

	log(message: string, ...args: any[]): void {
		this.logMessage('log', message, ...args);
	}

	error(message: string, ...args: any[]): void {
		// Always log errors, even in production
		const entry: LogEntry = {
			level: 'error',
			message,
			data: args.length > 0 ? args : undefined,
			timestamp: Date.now()
		};
		this.addToHistory(entry);
		console.error(`[${new Date().toISOString()}] [ERROR]`, message, ...args);
	}

	warn(message: string, ...args: any[]): void {
		this.logMessage('warn', message, ...args);
	}

	debug(message: string, ...args: any[]): void {
		this.logMessage('debug', message, ...args);
	}

	info(message: string, ...args: any[]): void {
		this.logMessage('info', message, ...args);
	}

	// Enable/disable logging dynamically
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (enabled) {
			console.log('[WebviewLogger] Logging enabled');
		}
	}

	// Get log history (useful for debugging)
	getHistory(): LogEntry[] {
		return [...this.logHistory];
	}

	// Clear log history
	clearHistory(): void {
		this.logHistory = [];
	}

	// Export logs as string (useful for bug reports)
	exportLogs(): string {
		return this.logHistory
			.map((entry) => {
				const timestamp = new Date(entry.timestamp).toISOString();
				const data = entry.data ? JSON.stringify(entry.data) : '';
				return `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message} ${data}`;
			})
			.join('\n');
	}
}

// Export singleton instance
export const logger = WebviewLogger.getInstance();

// Export type for use in other files
export type { WebviewLogger };
