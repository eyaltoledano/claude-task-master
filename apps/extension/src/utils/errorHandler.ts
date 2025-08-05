import * as vscode from 'vscode';
import { logger } from './logger';
import {
	getNotificationType,
	getToastDuration,
	shouldShowNotification
} from './notificationPreferences';

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
	UI_RENDERING = 'ui_rendering',
	VALIDATION = 'validation',
	NETWORK = 'network',
	INTERNAL = 'internal',
	TASK_MASTER_API = 'TASK_MASTER_API',
	DATA_VALIDATION = 'DATA_VALIDATION',
	DATA_PARSING = 'DATA_PARSING',
	TASK_DATA_CORRUPTION = 'TASK_DATA_CORRUPTION',
	VSCODE_API = 'VSCODE_API',
	WEBVIEW = 'WEBVIEW',
	EXTENSION_HOST = 'EXTENSION_HOST',
	USER_INTERACTION = 'USER_INTERACTION',
	DRAG_DROP = 'DRAG_DROP',
	COMPONENT_RENDER = 'COMPONENT_RENDER',
	PERMISSION = 'PERMISSION',
	FILE_SYSTEM = 'FILE_SYSTEM',
	UNKNOWN = 'UNKNOWN'
}

export enum NotificationType {
	VSCODE_INFO = 'VSCODE_INFO',
	VSCODE_WARNING = 'VSCODE_WARNING',
	VSCODE_ERROR = 'VSCODE_ERROR',
	TOAST_SUCCESS = 'TOAST_SUCCESS',
	TOAST_INFO = 'TOAST_INFO',
	TOAST_WARNING = 'TOAST_WARNING',
	TOAST_ERROR = 'TOAST_ERROR',
	CONSOLE_ONLY = 'CONSOLE_ONLY',
	SILENT = 'SILENT'
}

export interface ErrorContext {
	// Core error information
	category: ErrorCategory;
	severity: ErrorSeverity;
	message: string;
	originalError?: Error | unknown;

	// Contextual information
	operation?: string; // What operation was being performed
	taskId?: string; // Related task ID if applicable
	userId?: string; // User context if applicable
	sessionId?: string; // Session context

	// Technical details
	stackTrace?: string;
	userAgent?: string;
	timestamp?: number;

	// Recovery information
	isRecoverable?: boolean;
	suggestedActions?: string[];
	documentationLink?: string;

	// Notification preferences
	notificationType?: NotificationType;
	showToUser?: boolean;
	logToConsole?: boolean;
	logToFile?: boolean;
}

export interface ErrorDetails {
	code: string;
	message: string;
	category: ErrorCategory;
	severity: ErrorSeverity;
	timestamp: Date;
	context?: Record<string, any>;
	stack?: string;
	userAction?: string;
	recovery?: {
		automatic: boolean;
		action?: () => Promise<void>;
		description?: string;
	};
}

export interface ErrorLogEntry {
	id: string;
	error: ErrorDetails;
	resolved: boolean;
	resolvedAt?: Date;
	attempts: number;
	lastAttempt?: Date;
}

/**
 * Base class for all Task Master errors
 */
export abstract class TaskMasterError extends Error {
	public readonly code: string;
	public readonly category: ErrorCategory;
	public readonly severity: ErrorSeverity;
	public readonly timestamp: Date;
	public readonly context?: Record<string, any>;
	public readonly userAction?: string;
	public readonly recovery?: {
		automatic: boolean;
		action?: () => Promise<void>;
		description?: string;
	};

	constructor(
		message: string,
		code: string,
		category: ErrorCategory,
		severity: ErrorSeverity = ErrorSeverity.MEDIUM,
		context?: Record<string, any>,
		userAction?: string,
		recovery?: {
			automatic: boolean;
			action?: () => Promise<void>;
			description?: string;
		}
	) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
		this.category = category;
		this.severity = severity;
		this.timestamp = new Date();
		this.context = context;
		this.userAction = userAction;
		this.recovery = recovery;

		// Capture stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	public toErrorDetails(): ErrorDetails {
		return {
			code: this.code,
			message: this.message,
			category: this.category,
			severity: this.severity,
			timestamp: this.timestamp,
			context: this.context,
			stack: this.stack,
			userAction: this.userAction,
			recovery: this.recovery
		};
	}
}

/**
 * MCP Connection related errors
 */
export class MCPConnectionError extends TaskMasterError {
	constructor(
		message: string,
		code = 'MCP_CONNECTION_FAILED',
		context?: Record<string, any>,
		recovery?: {
			automatic: boolean;
			action?: () => Promise<void>;
			description?: string;
		}
	) {
		super(
			message,
			code,
			ErrorCategory.MCP_CONNECTION,
			ErrorSeverity.HIGH,
			context,
			'Check your Task Master configuration and ensure the MCP server is accessible.',
			recovery
		);
	}
}

/**
 * Configuration related errors
 */
export class ConfigurationError extends TaskMasterError {
	constructor(
		message: string,
		code = 'CONFIGURATION_INVALID',
		context?: Record<string, any>
	) {
		super(
			message,
			code,
			ErrorCategory.CONFIGURATION,
			ErrorSeverity.MEDIUM,
			context,
			'Check your Task Master configuration in VS Code settings.'
		);
	}
}

/**
 * Task loading related errors
 */
export class TaskLoadingError extends TaskMasterError {
	constructor(
		message: string,
		code = 'TASK_LOADING_FAILED',
		context?: Record<string, any>,
		recovery?: {
			automatic: boolean;
			action?: () => Promise<void>;
			description?: string;
		}
	) {
		super(
			message,
			code,
			ErrorCategory.TASK_LOADING,
			ErrorSeverity.MEDIUM,
			context,
			'Try refreshing the task list or check your project configuration.',
			recovery
		);
	}
}

/**
 * UI rendering related errors
 */
export class UIRenderingError extends TaskMasterError {
	constructor(
		message: string,
		code = 'UI_RENDERING_FAILED',
		context?: Record<string, any>
	) {
		super(
			message,
			code,
			ErrorCategory.UI_RENDERING,
			ErrorSeverity.LOW,
			context,
			'Try closing and reopening the Kanban board.'
		);
	}
}

/**
 * Network related errors
 */
export class NetworkError extends TaskMasterError {
	constructor(
		message: string,
		code = 'NETWORK_ERROR',
		context?: Record<string, any>,
		recovery?: {
			automatic: boolean;
			action?: () => Promise<void>;
			description?: string;
		}
	) {
		super(
			message,
			code,
			ErrorCategory.NETWORK,
			ErrorSeverity.MEDIUM,
			context,
			'Check your network connection and firewall settings.',
			recovery
		);
	}
}

/**
 * Centralized error handler
 */
export class ErrorHandler {
	private static instance: ErrorHandler | null = null;
	private errorLog: ErrorLogEntry[] = [];
	private maxLogSize = 1000;
	private errorListeners: ((error: ErrorDetails) => void)[] = [];

	private constructor() {
		this.setupGlobalErrorHandlers();
	}

	static getInstance(): ErrorHandler {
		if (!ErrorHandler.instance) {
			ErrorHandler.instance = new ErrorHandler();
		}
		return ErrorHandler.instance;
	}

	/**
	 * Handle an error with comprehensive logging and recovery
	 */
	async handleError(
		error: Error | TaskMasterError,
		context?: Record<string, any>
	): Promise<void> {
		const errorDetails = this.createErrorDetails(error, context);
		const logEntry = this.logError(errorDetails);

		// Notify listeners
		this.notifyErrorListeners(errorDetails);

		// Show user notification based on severity
		await this.showUserNotification(errorDetails);

		// Attempt recovery if available
		if (errorDetails.recovery?.automatic && errorDetails.recovery.action) {
			try {
				await errorDetails.recovery.action();
				this.markErrorResolved(logEntry.id);
			} catch (recoveryError) {
				logger.error('Error recovery failed:', recoveryError);
				logEntry.attempts++;
				logEntry.lastAttempt = new Date();
			}
		}

		// Log to console with appropriate level
		this.logToConsole(errorDetails);
	}

	/**
	 * Handle critical errors that should stop execution
	 */
	async handleCriticalError(
		error: Error | TaskMasterError,
		context?: Record<string, any>
	): Promise<void> {
		const errorDetails = this.createErrorDetails(error, context);
		errorDetails.severity = ErrorSeverity.CRITICAL;

		await this.handleError(error, context);

		// Show critical error dialog
		const action = await vscode.window.showErrorMessage(
			`Critical Error in Task Master: ${errorDetails.message}`,
			'View Details',
			'Report Issue',
			'Restart Extension'
		);

		switch (action) {
			case 'View Details':
				await this.showErrorDetails(errorDetails);
				break;
			case 'Report Issue':
				await this.openIssueReport(errorDetails);
				break;
			case 'Restart Extension':
				await vscode.commands.executeCommand('workbench.action.reloadWindow');
				break;
		}
	}

	/**
	 * Add error event listener
	 */
	onError(listener: (error: ErrorDetails) => void): void {
		this.errorListeners.push(listener);
	}

	/**
	 * Remove error event listener
	 */
	removeErrorListener(listener: (error: ErrorDetails) => void): void {
		const index = this.errorListeners.indexOf(listener);
		if (index !== -1) {
			this.errorListeners.splice(index, 1);
		}
	}

	/**
	 * Get error log
	 */
	getErrorLog(
		category?: ErrorCategory,
		severity?: ErrorSeverity
	): ErrorLogEntry[] {
		let filteredLog = this.errorLog;

		if (category) {
			filteredLog = filteredLog.filter(
				(entry) => entry.error.category === category
			);
		}

		if (severity) {
			filteredLog = filteredLog.filter(
				(entry) => entry.error.severity === severity
			);
		}

		return filteredLog.slice().reverse(); // Most recent first
	}

	/**
	 * Clear error log
	 */
	clearErrorLog(): void {
		this.errorLog = [];
	}

	/**
	 * Export error log for debugging
	 */
	exportErrorLog(): string {
		return JSON.stringify(this.errorLog, null, 2);
	}

	/**
	 * Create error details from error instance
	 */
	private createErrorDetails(
		error: Error | TaskMasterError,
		context?: Record<string, any>
	): ErrorDetails {
		if (error instanceof TaskMasterError) {
			const details = error.toErrorDetails();
			if (context) {
				details.context = { ...details.context, ...context };
			}
			return details;
		}

		// Handle standard Error objects
		return {
			code: 'UNKNOWN_ERROR',
			message: error.message || 'An unknown error occurred',
			category: ErrorCategory.INTERNAL,
			severity: ErrorSeverity.MEDIUM,
			timestamp: new Date(),
			context: { ...context, errorName: error.name },
			stack: error.stack
		};
	}

	/**
	 * Log error to internal log
	 */
	private logError(errorDetails: ErrorDetails): ErrorLogEntry {
		const logEntry: ErrorLogEntry = {
			id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			error: errorDetails,
			resolved: false,
			attempts: 0
		};

		this.errorLog.push(logEntry);

		// Maintain log size limit
		if (this.errorLog.length > this.maxLogSize) {
			this.errorLog = this.errorLog.slice(-this.maxLogSize);
		}

		return logEntry;
	}

	/**
	 * Mark error as resolved
	 */
	private markErrorResolved(errorId: string): void {
		const entry = this.errorLog.find((e) => e.id === errorId);
		if (entry) {
			entry.resolved = true;
			entry.resolvedAt = new Date();
		}
	}

	/**
	 * Show user notification based on error severity and user preferences
	 */
	private async showUserNotification(
		errorDetails: ErrorDetails
	): Promise<void> {
		// Check if user wants to see this notification
		if (!shouldShowNotification(errorDetails.category, errorDetails.severity)) {
			return;
		}

		const notificationType = getNotificationType(
			errorDetails.category,
			errorDetails.severity
		);
		const message = errorDetails.userAction
			? `${errorDetails.message} ${errorDetails.userAction}`
			: errorDetails.message;

		// Handle different notification types based on user preferences
		switch (notificationType) {
			case 'VSCODE_ERROR':
				await vscode.window.showErrorMessage(message);
				break;
			case 'VSCODE_WARNING':
				await vscode.window.showWarningMessage(message);
				break;
			case 'VSCODE_INFO':
				await vscode.window.showInformationMessage(message);
				break;
			case 'TOAST_SUCCESS':
			case 'TOAST_INFO':
			case 'TOAST_WARNING':
			case 'TOAST_ERROR':
				// These will be handled by the webview toast system
				// The error listener in extension.ts will send these to webview
				break;
			case 'CONSOLE_ONLY':
			case 'SILENT':
				// No user notification, just console logging
				break;
			default:
				// Fallback to severity-based notifications
				switch (errorDetails.severity) {
					case ErrorSeverity.CRITICAL:
						await vscode.window.showErrorMessage(message);
						break;
					case ErrorSeverity.HIGH:
						await vscode.window.showErrorMessage(message);
						break;
					case ErrorSeverity.MEDIUM:
						await vscode.window.showWarningMessage(message);
						break;
					case ErrorSeverity.LOW:
						await vscode.window.showInformationMessage(message);
						break;
				}
		}
	}

	/**
	 * Log to console with appropriate level
	 */
	private logToConsole(errorDetails: ErrorDetails): void {
		const logMessage = `[${errorDetails.category}] ${errorDetails.code}: ${errorDetails.message}`;

		switch (errorDetails.severity) {
			case ErrorSeverity.CRITICAL:
			case ErrorSeverity.HIGH:
				logger.error(logMessage, errorDetails);
				break;
			case ErrorSeverity.MEDIUM:
				logger.warn(logMessage, errorDetails);
				break;
			case ErrorSeverity.LOW:
				console.info(logMessage, errorDetails);
				break;
		}
	}

	/**
	 * Show detailed error information
	 */
	private async showErrorDetails(errorDetails: ErrorDetails): Promise<void> {
		const details = [
			`Error Code: ${errorDetails.code}`,
			`Category: ${errorDetails.category}`,
			`Severity: ${errorDetails.severity}`,
			`Time: ${errorDetails.timestamp.toISOString()}`,
			`Message: ${errorDetails.message}`
		];

		if (errorDetails.context) {
			details.push(`Context: ${JSON.stringify(errorDetails.context, null, 2)}`);
		}

		if (errorDetails.stack) {
			details.push(`Stack Trace: ${errorDetails.stack}`);
		}

		const content = details.join('\n\n');

		// Create temporary document to show error details
		const doc = await vscode.workspace.openTextDocument({
			content,
			language: 'plaintext'
		});

		await vscode.window.showTextDocument(doc);
	}

	/**
	 * Open GitHub issue report
	 */
	private async openIssueReport(errorDetails: ErrorDetails): Promise<void> {
		const issueTitle = encodeURIComponent(
			`Error: ${errorDetails.code} - ${errorDetails.message}`
		);
		const issueBody = encodeURIComponent(`
**Error Details:**
- Code: ${errorDetails.code}
- Category: ${errorDetails.category}
- Severity: ${errorDetails.severity}
- Time: ${errorDetails.timestamp.toISOString()}

**Message:**
${errorDetails.message}

**Context:**
${errorDetails.context ? JSON.stringify(errorDetails.context, null, 2) : 'None'}

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**


**Additional Notes:**

    `);

		const issueUrl = `https://github.com/eyaltoledano/claude-task-master/issues/new?title=${issueTitle}&body=${issueBody}`;
		await vscode.env.openExternal(vscode.Uri.parse(issueUrl));
	}

	/**
	 * Notify error listeners
	 */
	private notifyErrorListeners(errorDetails: ErrorDetails): void {
		this.errorListeners.forEach((listener) => {
			try {
				listener(errorDetails);
			} catch (error) {
				logger.error('Error in error listener:', error);
			}
		});
	}

	/**
	 * Setup global error handlers
	 */
	private setupGlobalErrorHandlers(): void {
		// Handle unhandled promise rejections
		process.on('unhandledRejection', (reason, promise) => {
			// Create a concrete error class for internal errors
			class InternalError extends TaskMasterError {
				constructor(
					message: string,
					code: string,
					severity: ErrorSeverity,
					context?: Record<string, any>
				) {
					super(message, code, ErrorCategory.INTERNAL, severity, context);
				}
			}

			const error = new InternalError(
				'Unhandled Promise Rejection',
				'UNHANDLED_REJECTION',
				ErrorSeverity.HIGH,
				{ reason: String(reason), promise: String(promise) }
			);
			this.handleError(error);
		});

		// Handle uncaught exceptions
		process.on('uncaughtException', (error) => {
			// Create a concrete error class for internal errors
			class InternalError extends TaskMasterError {
				constructor(
					message: string,
					code: string,
					severity: ErrorSeverity,
					context?: Record<string, any>
				) {
					super(message, code, ErrorCategory.INTERNAL, severity, context);
				}
			}

			const taskMasterError = new InternalError(
				'Uncaught Exception',
				'UNCAUGHT_EXCEPTION',
				ErrorSeverity.CRITICAL,
				{ originalError: error.message, stack: error.stack }
			);
			this.handleCriticalError(taskMasterError);
		});
	}
}

/**
 * Utility functions for error handling
 */
export function getErrorHandler(): ErrorHandler {
	return ErrorHandler.getInstance();
}

export function createRecoveryAction(
	action: () => Promise<void>,
	description: string
) {
	return {
		automatic: false,
		action,
		description
	};
}

export function createAutoRecoveryAction(
	action: () => Promise<void>,
	description: string
) {
	return {
		automatic: true,
		action,
		description
	};
}

// Default error categorization rules
export const ERROR_CATEGORIZATION_RULES: Record<string, ErrorCategory> = {
	// Network patterns
	ECONNREFUSED: ErrorCategory.NETWORK,
	ENOTFOUND: ErrorCategory.NETWORK,
	ETIMEDOUT: ErrorCategory.NETWORK,
	'Network request failed': ErrorCategory.NETWORK,
	'fetch failed': ErrorCategory.NETWORK,

	// MCP patterns
	MCP: ErrorCategory.MCP_CONNECTION,
	'Task Master': ErrorCategory.TASK_MASTER_API,
	polling: ErrorCategory.TASK_MASTER_API,

	// VS Code patterns
	vscode: ErrorCategory.VSCODE_API,
	webview: ErrorCategory.WEBVIEW,
	extension: ErrorCategory.EXTENSION_HOST,

	// Data patterns
	JSON: ErrorCategory.DATA_PARSING,
	parse: ErrorCategory.DATA_PARSING,
	validation: ErrorCategory.DATA_VALIDATION,
	invalid: ErrorCategory.DATA_VALIDATION,

	// Permission patterns
	EACCES: ErrorCategory.PERMISSION,
	EPERM: ErrorCategory.PERMISSION,
	permission: ErrorCategory.PERMISSION,

	// File system patterns
	ENOENT: ErrorCategory.FILE_SYSTEM,
	EISDIR: ErrorCategory.FILE_SYSTEM,
	file: ErrorCategory.FILE_SYSTEM
};

// Severity mapping based on error categories
export const CATEGORY_SEVERITY_MAPPING: Record<ErrorCategory, ErrorSeverity> = {
	[ErrorCategory.NETWORK]: ErrorSeverity.MEDIUM,
	[ErrorCategory.MCP_CONNECTION]: ErrorSeverity.HIGH,
	[ErrorCategory.TASK_MASTER_API]: ErrorSeverity.HIGH,
	[ErrorCategory.DATA_VALIDATION]: ErrorSeverity.MEDIUM,
	[ErrorCategory.DATA_PARSING]: ErrorSeverity.HIGH,
	[ErrorCategory.TASK_DATA_CORRUPTION]: ErrorSeverity.CRITICAL,
	[ErrorCategory.VSCODE_API]: ErrorSeverity.HIGH,
	[ErrorCategory.WEBVIEW]: ErrorSeverity.MEDIUM,
	[ErrorCategory.EXTENSION_HOST]: ErrorSeverity.CRITICAL,
	[ErrorCategory.USER_INTERACTION]: ErrorSeverity.LOW,
	[ErrorCategory.DRAG_DROP]: ErrorSeverity.MEDIUM,
	[ErrorCategory.COMPONENT_RENDER]: ErrorSeverity.MEDIUM,
	[ErrorCategory.PERMISSION]: ErrorSeverity.CRITICAL,
	[ErrorCategory.FILE_SYSTEM]: ErrorSeverity.HIGH,
	[ErrorCategory.CONFIGURATION]: ErrorSeverity.MEDIUM,
	[ErrorCategory.UNKNOWN]: ErrorSeverity.HIGH,
	// Legacy mappings for existing categories
	[ErrorCategory.TASK_LOADING]: ErrorSeverity.HIGH,
	[ErrorCategory.UI_RENDERING]: ErrorSeverity.MEDIUM,
	[ErrorCategory.VALIDATION]: ErrorSeverity.MEDIUM,
	[ErrorCategory.INTERNAL]: ErrorSeverity.HIGH
};

// Notification type mapping based on severity
export const SEVERITY_NOTIFICATION_MAPPING: Record<
	ErrorSeverity,
	NotificationType
> = {
	[ErrorSeverity.LOW]: NotificationType.TOAST_INFO,
	[ErrorSeverity.MEDIUM]: NotificationType.TOAST_WARNING,
	[ErrorSeverity.HIGH]: NotificationType.VSCODE_WARNING,
	[ErrorSeverity.CRITICAL]: NotificationType.VSCODE_ERROR
};

/**
 * Automatically categorize an error based on its message and type
 */
export function categorizeError(
	error: Error | unknown,
	operation?: string
): ErrorCategory {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const errorStack = error instanceof Error ? error.stack : undefined;
	const searchText =
		`${errorMessage} ${errorStack || ''} ${operation || ''}`.toLowerCase();

	for (const [pattern, category] of Object.entries(
		ERROR_CATEGORIZATION_RULES
	)) {
		if (searchText.includes(pattern.toLowerCase())) {
			return category;
		}
	}

	return ErrorCategory.UNKNOWN;
}

export function getSuggestedSeverity(category: ErrorCategory): ErrorSeverity {
	return CATEGORY_SEVERITY_MAPPING[category] || ErrorSeverity.HIGH;
}

export function getSuggestedNotificationType(
	severity: ErrorSeverity
): NotificationType {
	return (
		SEVERITY_NOTIFICATION_MAPPING[severity] || NotificationType.CONSOLE_ONLY
	);
}

export function createErrorContext(
	error: Error | unknown,
	operation?: string,
	overrides?: Partial<ErrorContext>
): ErrorContext {
	const category = categorizeError(error, operation);
	const severity = getSuggestedSeverity(category);
	const notificationType = getSuggestedNotificationType(severity);

	const baseContext: ErrorContext = {
		category,
		severity,
		message: error instanceof Error ? error.message : String(error),
		originalError: error,
		operation,
		timestamp: Date.now(),
		stackTrace: error instanceof Error ? error.stack : undefined,
		isRecoverable: severity !== ErrorSeverity.CRITICAL,
		notificationType,
		showToUser:
			severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL,
		logToConsole: true,
		logToFile:
			severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL
	};

	return { ...baseContext, ...overrides };
}
