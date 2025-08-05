import * as vscode from 'vscode';

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
	log(message: string, ...args: any[]): void;
	error(message: string, ...args: any[]): void;
	warn(message: string, ...args: any[]): void;
	debug(message: string, ...args: any[]): void;
	show(): void;
	dispose(): void;
}

/**
 * Logger that outputs to VS Code's output channel instead of console
 * This prevents interference with MCP stdio communication
 */
export class ExtensionLogger implements ILogger {
	private static instance: ExtensionLogger;
	private outputChannel: vscode.OutputChannel;
	private debugMode: boolean;

	private constructor() {
		this.outputChannel = vscode.window.createOutputChannel('TaskMaster');
		const config = vscode.workspace.getConfiguration('taskmaster');
		this.debugMode = config.get<boolean>('debug.enableLogging', true);
	}

	static getInstance(): ExtensionLogger {
		if (!ExtensionLogger.instance) {
			ExtensionLogger.instance = new ExtensionLogger();
		}
		return ExtensionLogger.instance;
	}

	log(message: string, ...args: any[]): void {
		if (!this.debugMode) {
			return;
		}
		const timestamp = new Date().toISOString();
		const formattedMessage = this.formatMessage(message, args);
		this.outputChannel.appendLine(`[${timestamp}] ${formattedMessage}`);
	}

	error(message: string, ...args: any[]): void {
		const timestamp = new Date().toISOString();
		const formattedMessage = this.formatMessage(message, args);
		this.outputChannel.appendLine(`[${timestamp}] ERROR: ${formattedMessage}`);
	}

	warn(message: string, ...args: any[]): void {
		if (!this.debugMode) {
			return;
		}
		const timestamp = new Date().toISOString();
		const formattedMessage = this.formatMessage(message, args);
		this.outputChannel.appendLine(`[${timestamp}] WARN: ${formattedMessage}`);
	}

	debug(message: string, ...args: any[]): void {
		if (!this.debugMode) {
			return;
		}
		const timestamp = new Date().toISOString();
		const formattedMessage = this.formatMessage(message, args);
		this.outputChannel.appendLine(`[${timestamp}] DEBUG: ${formattedMessage}`);
	}

	private formatMessage(message: string, args: any[]): string {
		if (args.length === 0) {
			return message;
		}

		// Convert objects to JSON for better readability
		const formattedArgs = args.map((arg) => {
			if (typeof arg === 'object' && arg !== null) {
				try {
					return JSON.stringify(arg, null, 2);
				} catch {
					return String(arg);
				}
			}
			return String(arg);
		});

		return `${message} ${formattedArgs.join(' ')}`;
	}

	show(): void {
		this.outputChannel.show();
	}

	dispose(): void {
		this.outputChannel.dispose();
	}

	setDebugMode(enabled: boolean): void {
		this.debugMode = enabled;
	}
}

// Export a singleton instance for convenience
export const logger = ExtensionLogger.getInstance();
