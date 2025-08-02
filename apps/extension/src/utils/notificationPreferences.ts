import * as vscode from 'vscode';
import { ErrorCategory, ErrorSeverity, NotificationType } from './errorHandler';
import { logger } from './logger';

export interface NotificationPreferences {
	// Global notification toggles
	enableToastNotifications: boolean;
	enableVSCodeNotifications: boolean;
	enableConsoleLogging: boolean;

	// Toast notification settings
	toastDuration: {
		info: number;
		warning: number;
		error: number;
	};

	// Category-based preferences
	categoryPreferences: Record<
		ErrorCategory,
		{
			showToUser: boolean;
			notificationType: NotificationType;
			logToConsole: boolean;
		}
	>;

	// Severity-based preferences
	severityPreferences: Record<
		ErrorSeverity,
		{
			showToUser: boolean;
			notificationType: NotificationType;
			minToastDuration: number;
		}
	>;

	// Advanced settings
	maxToastCount: number;
	enableErrorTracking: boolean;
	enableDetailedErrorInfo: boolean;
}

export class NotificationPreferencesManager {
	private static instance: NotificationPreferencesManager | null = null;
	private readonly configSection = 'taskMasterKanban';

	private constructor() {}

	static getInstance(): NotificationPreferencesManager {
		if (!NotificationPreferencesManager.instance) {
			NotificationPreferencesManager.instance =
				new NotificationPreferencesManager();
		}
		return NotificationPreferencesManager.instance;
	}

	/**
	 * Get current notification preferences from VS Code settings
	 */
	getPreferences(): NotificationPreferences {
		const config = vscode.workspace.getConfiguration(this.configSection);

		return {
			enableToastNotifications: config.get('notifications.enableToast', true),
			enableVSCodeNotifications: config.get('notifications.enableVSCode', true),
			enableConsoleLogging: config.get('notifications.enableConsole', true),

			toastDuration: {
				info: config.get('notifications.toastDuration.info', 5000),
				warning: config.get('notifications.toastDuration.warning', 7000),
				error: config.get('notifications.toastDuration.error', 10000)
			},

			categoryPreferences: this.getCategoryPreferences(config),
			severityPreferences: this.getSeverityPreferences(config),

			maxToastCount: config.get('notifications.maxToastCount', 5),
			enableErrorTracking: config.get(
				'notifications.enableErrorTracking',
				true
			),
			enableDetailedErrorInfo: config.get(
				'notifications.enableDetailedErrorInfo',
				false
			)
		};
	}

	/**
	 * Update notification preferences in VS Code settings
	 */
	async updatePreferences(
		preferences: Partial<NotificationPreferences>
	): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.configSection);

		if (preferences.enableToastNotifications !== undefined) {
			await config.update(
				'notifications.enableToast',
				preferences.enableToastNotifications,
				vscode.ConfigurationTarget.Global
			);
		}

		if (preferences.enableVSCodeNotifications !== undefined) {
			await config.update(
				'notifications.enableVSCode',
				preferences.enableVSCodeNotifications,
				vscode.ConfigurationTarget.Global
			);
		}

		if (preferences.enableConsoleLogging !== undefined) {
			await config.update(
				'notifications.enableConsole',
				preferences.enableConsoleLogging,
				vscode.ConfigurationTarget.Global
			);
		}

		if (preferences.toastDuration) {
			await config.update(
				'notifications.toastDuration',
				preferences.toastDuration,
				vscode.ConfigurationTarget.Global
			);
		}

		if (preferences.maxToastCount !== undefined) {
			await config.update(
				'notifications.maxToastCount',
				preferences.maxToastCount,
				vscode.ConfigurationTarget.Global
			);
		}

		if (preferences.enableErrorTracking !== undefined) {
			await config.update(
				'notifications.enableErrorTracking',
				preferences.enableErrorTracking,
				vscode.ConfigurationTarget.Global
			);
		}

		if (preferences.enableDetailedErrorInfo !== undefined) {
			await config.update(
				'notifications.enableDetailedErrorInfo',
				preferences.enableDetailedErrorInfo,
				vscode.ConfigurationTarget.Global
			);
		}
	}

	/**
	 * Check if notifications should be shown for a specific error category and severity
	 */
	shouldShowNotification(
		category: ErrorCategory,
		severity: ErrorSeverity
	): boolean {
		const preferences = this.getPreferences();

		// Check global toggles first
		if (
			!preferences.enableToastNotifications &&
			!preferences.enableVSCodeNotifications
		) {
			return false;
		}

		// Check category preferences
		const categoryPref = preferences.categoryPreferences[category];
		if (categoryPref && !categoryPref.showToUser) {
			return false;
		}

		// Check severity preferences
		const severityPref = preferences.severityPreferences[severity];
		if (severityPref && !severityPref.showToUser) {
			return false;
		}

		return true;
	}

	/**
	 * Get the appropriate notification type for an error
	 */
	getNotificationType(
		category: ErrorCategory,
		severity: ErrorSeverity
	): NotificationType {
		const preferences = this.getPreferences();

		// Check category preference first
		const categoryPref = preferences.categoryPreferences[category];
		if (categoryPref) {
			return categoryPref.notificationType;
		}

		// Fall back to severity preference
		const severityPref = preferences.severityPreferences[severity];
		if (severityPref) {
			return severityPref.notificationType;
		}

		// Default fallback
		return this.getDefaultNotificationType(severity);
	}

	/**
	 * Get toast duration for a specific severity
	 */
	getToastDuration(severity: ErrorSeverity): number {
		const preferences = this.getPreferences();

		switch (severity) {
			case ErrorSeverity.LOW:
				return preferences.toastDuration.info;
			case ErrorSeverity.MEDIUM:
				return preferences.toastDuration.warning;
			case ErrorSeverity.HIGH:
			case ErrorSeverity.CRITICAL:
				return preferences.toastDuration.error;
			default:
				return preferences.toastDuration.warning;
		}
	}

	/**
	 * Reset preferences to defaults
	 */
	async resetToDefaults(): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.configSection);

		// Reset all notification settings
		await config.update(
			'notifications',
			undefined,
			vscode.ConfigurationTarget.Global
		);

		logger.log('Task Master Kanban notification preferences reset to defaults');
	}

	/**
	 * Get category-based preferences with defaults
	 */
	private getCategoryPreferences(config: vscode.WorkspaceConfiguration): Record<
		ErrorCategory,
		{
			showToUser: boolean;
			notificationType: NotificationType;
			logToConsole: boolean;
		}
	> {
		const defaults = {
			[ErrorCategory.MCP_CONNECTION]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_ERROR,
				logToConsole: true
			},
			[ErrorCategory.CONFIGURATION]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_WARNING,
				logToConsole: true
			},
			[ErrorCategory.TASK_LOADING]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_WARNING,
				logToConsole: true
			},
			[ErrorCategory.UI_RENDERING]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_INFO,
				logToConsole: false
			},
			[ErrorCategory.VALIDATION]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_WARNING,
				logToConsole: true
			},
			[ErrorCategory.NETWORK]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_WARNING,
				logToConsole: true
			},
			[ErrorCategory.INTERNAL]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_ERROR,
				logToConsole: true
			},
			[ErrorCategory.TASK_MASTER_API]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_ERROR,
				logToConsole: true
			},
			[ErrorCategory.DATA_VALIDATION]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_WARNING,
				logToConsole: true
			},
			[ErrorCategory.DATA_PARSING]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_ERROR,
				logToConsole: true
			},
			[ErrorCategory.TASK_DATA_CORRUPTION]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_ERROR,
				logToConsole: true
			},
			[ErrorCategory.VSCODE_API]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_ERROR,
				logToConsole: true
			},
			[ErrorCategory.WEBVIEW]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_WARNING,
				logToConsole: true
			},
			[ErrorCategory.EXTENSION_HOST]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_ERROR,
				logToConsole: true
			},
			[ErrorCategory.USER_INTERACTION]: {
				showToUser: false,
				notificationType: NotificationType.CONSOLE_ONLY,
				logToConsole: true
			},
			[ErrorCategory.DRAG_DROP]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_INFO,
				logToConsole: false
			},
			[ErrorCategory.COMPONENT_RENDER]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_WARNING,
				logToConsole: true
			},
			[ErrorCategory.PERMISSION]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_ERROR,
				logToConsole: true
			},
			[ErrorCategory.FILE_SYSTEM]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_ERROR,
				logToConsole: true
			},
			[ErrorCategory.UNKNOWN]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_WARNING,
				logToConsole: true
			}
		};

		// Allow user overrides from settings
		const userPreferences = config.get('notifications.categoryPreferences', {});
		return { ...defaults, ...userPreferences };
	}

	/**
	 * Get severity-based preferences with defaults
	 */
	private getSeverityPreferences(config: vscode.WorkspaceConfiguration): Record<
		ErrorSeverity,
		{
			showToUser: boolean;
			notificationType: NotificationType;
			minToastDuration: number;
		}
	> {
		const defaults = {
			[ErrorSeverity.LOW]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_INFO,
				minToastDuration: 3000
			},
			[ErrorSeverity.MEDIUM]: {
				showToUser: true,
				notificationType: NotificationType.TOAST_WARNING,
				minToastDuration: 5000
			},
			[ErrorSeverity.HIGH]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_WARNING,
				minToastDuration: 7000
			},
			[ErrorSeverity.CRITICAL]: {
				showToUser: true,
				notificationType: NotificationType.VSCODE_ERROR,
				minToastDuration: 10000
			}
		};

		// Allow user overrides from settings
		const userPreferences = config.get('notifications.severityPreferences', {});
		return { ...defaults, ...userPreferences };
	}

	/**
	 * Get default notification type for severity
	 */
	private getDefaultNotificationType(
		severity: ErrorSeverity
	): NotificationType {
		switch (severity) {
			case ErrorSeverity.LOW:
				return NotificationType.TOAST_INFO;
			case ErrorSeverity.MEDIUM:
				return NotificationType.TOAST_WARNING;
			case ErrorSeverity.HIGH:
				return NotificationType.VSCODE_WARNING;
			case ErrorSeverity.CRITICAL:
				return NotificationType.VSCODE_ERROR;
			default:
				return NotificationType.CONSOLE_ONLY;
		}
	}
}

// Export convenience functions
export function getNotificationPreferences(): NotificationPreferences {
	return NotificationPreferencesManager.getInstance().getPreferences();
}

export function updateNotificationPreferences(
	preferences: Partial<NotificationPreferences>
): Promise<void> {
	return NotificationPreferencesManager.getInstance().updatePreferences(
		preferences
	);
}

export function shouldShowNotification(
	category: ErrorCategory,
	severity: ErrorSeverity
): boolean {
	return NotificationPreferencesManager.getInstance().shouldShowNotification(
		category,
		severity
	);
}

export function getNotificationType(
	category: ErrorCategory,
	severity: ErrorSeverity
): NotificationType {
	return NotificationPreferencesManager.getInstance().getNotificationType(
		category,
		severity
	);
}

export function getToastDuration(severity: ErrorSeverity): number {
	return NotificationPreferencesManager.getInstance().getToastDuration(
		severity
	);
}
