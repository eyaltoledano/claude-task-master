/**
 * Error Handler Service
 * Centralized error handling with categorization and recovery strategies
 */

import * as vscode from 'vscode';
import type { ExtensionLogger } from '../utils/logger';

export enum ErrorSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export enum ErrorCategory {
	MCP_CONNECTION = 'mcp_connection',
	CONFIGURATION = 'configuration',
	TASK_LOADING = 'task_loading',
	NETWORK = 'network',
	INTERNAL = 'internal'
}

export interface ErrorContext {
	category: ErrorCategory;
	severity: ErrorSeverity;
	message: string;
	originalError?: Error | unknown;
	operation?: string;
	taskId?: string;
	isRecoverable?: boolean;
	suggestedActions?: string[];
}

export class ErrorHandler {
	private errorLog: Map<string, ErrorContext> = new Map();
	private errorId = 0;

	constructor(private logger: ExtensionLogger) {}

	/**
	 * Handle an error with appropriate logging and user notification
	 */
	handleError(context: ErrorContext): string {
		const errorId = `error_${++this.errorId}`;
		this.errorLog.set(errorId, context);

		// Log to extension logger
		this.logError(context);

		// Show user notification if appropriate
		this.notifyUser(context);

		return errorId;
	}

	/**
	 * Log error based on severity
	 */
	private logError(context: ErrorContext): void {
		const logMessage = `[${context.category}] ${context.message}`;
		const details = {
			operation: context.operation,
			taskId: context.taskId,
			error: context.originalError
		};

		switch (context.severity) {
			case ErrorSeverity.CRITICAL:
			case ErrorSeverity.HIGH:
				this.logger.error(logMessage, details);
				break;
			case ErrorSeverity.MEDIUM:
				this.logger.warn(logMessage, details);
				break;
			case ErrorSeverity.LOW:
				this.logger.debug(logMessage, details);
				break;
		}
	}

	/**
	 * Show user notification based on severity and category
	 */
	/**
	 * Validate if an action is allowed
	 */
	private isValidAction(action: string): boolean {
		// Define predefined valid actions
		const predefinedActions = [
			'Retry',
			'Settings',
			'Reload',
			'Dismiss',
			'View Logs',
			'Report Issue'
		];

		// Check if it's a predefined action or a TaskMaster command
		return predefinedActions.includes(action) || action.startsWith('tm.');
	}

	/**
	 * Filter and validate suggested actions
	 */
	private getValidActions(actions: string[]): string[] {
		return actions.filter((action) => this.isValidAction(action));
	}

	private notifyUser(context: ErrorContext): void {
		// Don't show low severity errors to users
		if (context.severity === ErrorSeverity.LOW) {
			return;
		}

		// Validate and filter suggested actions
		const rawActions = context.suggestedActions || [];
		const actions = this.getValidActions(rawActions);

		// Log if any actions were filtered out
		if (rawActions.length !== actions.length) {
			this.logger.warn('Invalid actions filtered out:', {
				original: rawActions,
				filtered: actions,
				removed: rawActions.filter((a) => !actions.includes(a))
			});
		}

		switch (context.severity) {
			case ErrorSeverity.CRITICAL:
				vscode.window
					.showErrorMessage(`TaskMaster: ${context.message}`, ...actions)
					.then((action) => {
						if (action) {
							this.handleUserAction(action, context);
						}
					});
				break;

			case ErrorSeverity.HIGH:
				if (context.category === ErrorCategory.MCP_CONNECTION) {
					// Use validated actions or default actions for MCP connection
					const mcpActions =
						actions.length > 0 ? actions : ['Retry', 'Settings'];
					vscode.window
						.showWarningMessage(`TaskMaster: ${context.message}`, ...mcpActions)
						.then((action) => {
							if (action === 'Retry') {
								vscode.commands.executeCommand('tm.reconnect');
							} else if (action === 'Settings') {
								vscode.commands.executeCommand('tm.openSettings');
							} else if (action) {
								this.handleUserAction(action, context);
							}
						});
				} else {
					// Show warning with validated actions
					if (actions.length > 0) {
						vscode.window
							.showWarningMessage(`TaskMaster: ${context.message}`, ...actions)
							.then((action) => {
								if (action) {
									this.handleUserAction(action, context);
								}
							});
					} else {
						vscode.window.showWarningMessage(`TaskMaster: ${context.message}`);
					}
				}
				break;

			case ErrorSeverity.MEDIUM:
				// Only show medium errors for important categories
				if (
					[ErrorCategory.CONFIGURATION, ErrorCategory.TASK_LOADING].includes(
						context.category
					)
				) {
					if (actions.length > 0) {
						vscode.window
							.showInformationMessage(
								`TaskMaster: ${context.message}`,
								...actions
							)
							.then((action) => {
								if (action) {
									this.handleUserAction(action, context);
								}
							});
					} else {
						vscode.window.showInformationMessage(
							`TaskMaster: ${context.message}`
						);
					}
				}
				break;
		}
	}

	/**
	 * Handle user action from notification
	 */
	private handleUserAction(action: string, context: ErrorContext): void {
		this.logger.debug(`User selected action: ${action}`, {
			errorContext: context
		});

		// Handle predefined actions
		switch (action) {
			case 'Retry':
				if (context.category === ErrorCategory.MCP_CONNECTION) {
					vscode.commands.executeCommand('tm.reconnect');
				} else {
					vscode.commands.executeCommand('tm.refreshTasks');
				}
				break;

			case 'Settings':
				vscode.commands.executeCommand('tm.openSettings');
				break;

			case 'Reload':
				vscode.commands.executeCommand('workbench.action.reloadWindow');
				break;

			case 'View Logs':
				// Show error details in a modal dialog instead of output channel
				this.showErrorDetails(context);
				break;

			case 'Report Issue':
				const issueUrl = this.generateIssueUrl(context);
				vscode.env.openExternal(vscode.Uri.parse(issueUrl));
				break;

			case 'Dismiss':
				// No action needed
				break;

			default:
				// Handle TaskMaster commands (tm.*)
				if (action.startsWith('tm.')) {
					void vscode.commands.executeCommand(action).then(
						() => {},
						(error: unknown) => {
							this.logger.error(`Failed to execute command: ${action}`, error);
						}
					);
				}
				break;
		}
	}

	/**
	 * Show detailed error information in a modal dialog
	 */
	private showErrorDetails(context: ErrorContext): void {
		const details = [
			`**Error Details**`,
			``,
			`Category: ${context.category}`,
			`Severity: ${context.severity}`,
			`Message: ${context.message}`,
			context.operation ? `Operation: ${context.operation}` : '',
			context.taskId ? `Task ID: ${context.taskId}` : '',
			context.originalError ? `\nOriginal Error:\n${context.originalError}` : ''
		]
			.filter(Boolean)
			.join('\n');

		vscode.window.showInformationMessage(details, {
			modal: true,
			detail: details
		});
	}

	/**
	 * Generate GitHub issue URL with pre-filled information
	 */
	private generateIssueUrl(context: ErrorContext): string {
		const title = encodeURIComponent(`[Extension Error] ${context.message}`);
		const body = encodeURIComponent(
			[
				`**Error Details:**`,
				`- Category: ${context.category}`,
				`- Severity: ${context.severity}`,
				`- Message: ${context.message}`,
				context.operation ? `- Operation: ${context.operation}` : '',
				context.taskId ? `- Task ID: ${context.taskId}` : '',
				``,
				`**Context:**`,
				'```json',
				JSON.stringify(context, null, 2),
				'```',
				``,
				`**Environment:**`,
				`- VS Code Version: ${vscode.version}`,
				`- Extension Version: ${vscode.extensions.getExtension('Hamster.taskmaster')?.packageJSON.version || 'Unknown'}`,
				``,
				`**Steps to Reproduce:**`,
				`1. [Please describe the steps that led to this error]`,
				``,
				`**Expected Behavior:**`,
				`[What should have happened instead]`
			]
				.filter(Boolean)
				.join('\n')
		);

		return `https://github.com/eyaltoledano/claude-task-master/issues/new?title=${title}&body=${body}`;
	}

	/**
	 * Get error by ID
	 */
	getError(errorId: string): ErrorContext | undefined {
		return this.errorLog.get(errorId);
	}

	/**
	 * Clear old errors (keep last 100)
	 */
	clearOldErrors(): void {
		if (this.errorLog.size > 100) {
			const entriesToKeep = Array.from(this.errorLog.entries()).slice(-100);
			this.errorLog.clear();
			entriesToKeep.forEach(([id, error]) => this.errorLog.set(id, error));
		}
	}
}
