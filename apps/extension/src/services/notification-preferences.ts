/**
 * Notification Preferences Service
 * Manages user preferences for notifications
 */

import * as vscode from 'vscode';
import { ErrorCategory, ErrorSeverity } from './error-handler';

export enum NotificationLevel {
	ALL = 'all',
	ERRORS_ONLY = 'errors_only',
	CRITICAL_ONLY = 'critical_only',
	NONE = 'none'
}

interface NotificationRule {
	category: ErrorCategory;
	minSeverity: ErrorSeverity;
	enabled: boolean;
}

export class NotificationPreferences {
	private defaultRules: NotificationRule[] = [
		{
			category: ErrorCategory.MCP_CONNECTION,
			minSeverity: ErrorSeverity.HIGH,
			enabled: true
		},
		{
			category: ErrorCategory.CONFIGURATION,
			minSeverity: ErrorSeverity.MEDIUM,
			enabled: true
		},
		{
			category: ErrorCategory.TASK_LOADING,
			minSeverity: ErrorSeverity.HIGH,
			enabled: true
		},
		{
			category: ErrorCategory.NETWORK,
			minSeverity: ErrorSeverity.HIGH,
			enabled: true
		},
		{
			category: ErrorCategory.INTERNAL,
			minSeverity: ErrorSeverity.CRITICAL,
			enabled: true
		}
	];

	/**
	 * Check if a notification should be shown
	 */
	shouldShowNotification(
		category: ErrorCategory,
		severity: ErrorSeverity
	): boolean {
		// Get user's notification level preference
		const level = this.getNotificationLevel();

		if (level === NotificationLevel.NONE) {
			return false;
		}

		if (
			level === NotificationLevel.CRITICAL_ONLY &&
			severity !== ErrorSeverity.CRITICAL
		) {
			return false;
		}

		if (
			level === NotificationLevel.ERRORS_ONLY &&
			severity !== ErrorSeverity.CRITICAL &&
			severity !== ErrorSeverity.HIGH
		) {
			return false;
		}

		// Check category-specific rules
		const rule = this.defaultRules.find((r) => r.category === category);
		if (!rule || !rule.enabled) {
			return false;
		}

		// Check if severity meets minimum threshold
		return this.compareSeverity(severity, rule.minSeverity) >= 0;
	}

	/**
	 * Get user's notification level preference
	 */
	private getNotificationLevel(): NotificationLevel {
		const config = vscode.workspace.getConfiguration('taskmaster');
		return config.get<NotificationLevel>(
			'notifications.level',
			NotificationLevel.ERRORS_ONLY
		);
	}

	/**
	 * Compare severity levels
	 */
	private compareSeverity(a: ErrorSeverity, b: ErrorSeverity): number {
		const severityOrder = {
			[ErrorSeverity.LOW]: 0,
			[ErrorSeverity.MEDIUM]: 1,
			[ErrorSeverity.HIGH]: 2,
			[ErrorSeverity.CRITICAL]: 3
		};
		return severityOrder[a] - severityOrder[b];
	}

	/**
	 * Get toast notification duration based on severity
	 */
	getToastDuration(severity: ErrorSeverity): number {
		switch (severity) {
			case ErrorSeverity.CRITICAL:
				return 10000; // 10 seconds
			case ErrorSeverity.HIGH:
				return 7000; // 7 seconds
			case ErrorSeverity.MEDIUM:
				return 5000; // 5 seconds
			case ErrorSeverity.LOW:
				return 3000; // 3 seconds
		}
	}
}
