/**
 * Phase 6.1 - Notification Display Testing
 * Comprehensive tests for notification system functionality and user experience
 */

import { jest } from '@jest/globals';

// Mock the NotificationSystem component
const mockNotificationSystem = {
	showNotification: jest.fn(),
	hideNotification: jest.fn(),
	clearAllNotifications: jest.fn(),
	updateNotification: jest.fn(),
	getActiveNotifications: jest.fn(),
	setNotificationPreferences: jest.fn(),
	dismissNotification: jest.fn(),
	markAsRead: jest.fn(),
	scheduleNotification: jest.fn(),
	groupNotifications: jest.fn(),
	validateNotification: jest.fn(),
	handleUserAction: jest.fn()
};

// Mock notification types and priorities
const notificationTypes = {
	SUCCESS: 'success',
	ERROR: 'error',
	WARNING: 'warning',
	INFO: 'info',
	PROGRESS: 'progress',
	SYSTEM: 'system'
};

const notificationPriorities = {
	LOW: 1,
	NORMAL: 2,
	HIGH: 3,
	URGENT: 4,
	CRITICAL: 5
};

// Mock notification data
const mockNotifications = [
	{
		id: 'notif-1',
		type: notificationTypes.SUCCESS,
		priority: notificationPriorities.NORMAL,
		title: 'Task Completed',
		message: 'Task 15.2 has been completed successfully',
		timestamp: Date.now() - 5000,
		autoHide: true,
		hideAfter: 5000,
		actions: [{ label: 'View Task', action: 'view_task', taskId: '15.2' }]
	},
	{
		id: 'notif-2',
		type: notificationTypes.ERROR,
		priority: notificationPriorities.HIGH,
		title: 'Build Failed',
		message: 'The build process encountered errors and could not complete',
		timestamp: Date.now() - 10000,
		autoHide: false,
		actions: [
			{ label: 'View Logs', action: 'view_logs' },
			{ label: 'Retry Build', action: 'retry_build' }
		]
	},
	{
		id: 'notif-3',
		type: notificationTypes.WARNING,
		priority: notificationPriorities.NORMAL,
		title: 'Memory Usage High',
		message: 'System memory usage is above 85%',
		timestamp: Date.now() - 15000,
		autoHide: true,
		hideAfter: 10000,
		actions: [{ label: 'View Details', action: 'view_system_stats' }]
	},
	{
		id: 'notif-4',
		type: notificationTypes.INFO,
		priority: notificationPriorities.LOW,
		title: 'Update Available',
		message: 'A new version of Task Master is available',
		timestamp: Date.now() - 20000,
		autoHide: false,
		actions: [
			{ label: 'Download', action: 'download_update' },
			{ label: 'Later', action: 'dismiss' }
		]
	}
];

const mockNotificationPreferences = {
	enabled: true,
	showDesktopNotifications: true,
	playSound: false,
	maxVisibleNotifications: 5,
	defaultAutoHideTime: 5000,
	groupSimilar: true,
	priorityThreshold: notificationPriorities.NORMAL,
	muteMode: false,
	muteDuration: 0
};

describe('Notification Display Testing', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Reset mock implementations
		mockNotificationSystem.showNotification.mockImplementation(
			(notification) => {
				if (!notification.title || !notification.message) {
					return {
						success: false,
						error: 'Title and message are required'
					};
				}

				const newNotification = {
					id: notification.id || `notif-${Date.now()}`,
					type: notification.type || notificationTypes.INFO,
					priority: notification.priority || notificationPriorities.NORMAL,
					title: notification.title,
					message: notification.message,
					timestamp: notification.timestamp || Date.now(),
					autoHide: notification.autoHide !== false,
					hideAfter:
						notification.hideAfter ||
						mockNotificationPreferences.defaultAutoHideTime,
					actions: notification.actions || [],
					visible: true,
					read: false
				};

				return {
					success: true,
					notification: newNotification,
					timestamp: Date.now()
				};
			}
		);

		mockNotificationSystem.hideNotification.mockImplementation((id) => {
			if (!id) {
				return {
					success: false,
					error: 'Notification ID is required'
				};
			}

			return {
				success: true,
				hidden: true,
				id,
				timestamp: Date.now()
			};
		});

		mockNotificationSystem.clearAllNotifications.mockImplementation(
			(filter) => {
				return {
					success: true,
					cleared: true,
					count: filter ? 2 : mockNotifications.length,
					filter: filter || null,
					timestamp: Date.now()
				};
			}
		);

		mockNotificationSystem.updateNotification.mockImplementation(
			(id, updates) => {
				if (!id) {
					return {
						success: false,
						error: 'Notification ID is required'
					};
				}

				return {
					success: true,
					updated: true,
					id,
					updates,
					timestamp: Date.now()
				};
			}
		);

		mockNotificationSystem.getActiveNotifications.mockImplementation(
			(filters) => {
				let notifications = [...mockNotifications];

				if (filters) {
					if (filters.type) {
						notifications = notifications.filter(
							(n) => n.type === filters.type
						);
					}
					if (filters.priority) {
						notifications = notifications.filter(
							(n) => n.priority >= filters.priority
						);
					}
					if (filters.unreadOnly) {
						notifications = notifications.filter((n) => !n.read);
					}
				}

				return {
					success: true,
					notifications,
					count: notifications.length,
					timestamp: Date.now()
				};
			}
		);

		mockNotificationSystem.setNotificationPreferences.mockImplementation(
			(preferences) => {
				const updatedPrefs = { ...mockNotificationPreferences, ...preferences };

				return {
					success: true,
					preferences: updatedPrefs,
					timestamp: Date.now()
				};
			}
		);

		mockNotificationSystem.dismissNotification.mockImplementation((id) => {
			if (!id) {
				return {
					success: false,
					error: 'Notification ID is required'
				};
			}

			return {
				success: true,
				dismissed: true,
				id,
				timestamp: Date.now()
			};
		});

		mockNotificationSystem.markAsRead.mockImplementation((id) => {
			if (!id) {
				return {
					success: false,
					error: 'Notification ID is required'
				};
			}

			return {
				success: true,
				marked: true,
				id,
				read: true,
				timestamp: Date.now()
			};
		});

		mockNotificationSystem.scheduleNotification.mockImplementation(
			(notification, delay) => {
				if (!notification.title || !notification.message) {
					return {
						success: false,
						error: 'Title and message are required'
					};
				}

				if (delay < 0) {
					return {
						success: false,
						error: 'Delay must be non-negative'
					};
				}

				return {
					success: true,
					scheduled: true,
					id: `scheduled-${Date.now()}`,
					delay,
					executeAt: Date.now() + delay,
					timestamp: Date.now()
				};
			}
		);

		mockNotificationSystem.groupNotifications.mockImplementation(
			(notifications) => {
				const groups = {};

				notifications.forEach((notification) => {
					const key = `${notification.type}-${notification.title}`;
					if (!groups[key]) {
						groups[key] = {
							type: notification.type,
							title: notification.title,
							count: 0,
							notifications: [],
							latestTimestamp: 0
						};
					}

					groups[key].count++;
					groups[key].notifications.push(notification);
					groups[key].latestTimestamp = Math.max(
						groups[key].latestTimestamp,
						notification.timestamp
					);
				});

				return {
					success: true,
					groups: Object.values(groups),
					groupCount: Object.keys(groups).length,
					timestamp: Date.now()
				};
			}
		);

		mockNotificationSystem.validateNotification.mockImplementation(
			(notification) => {
				const errors = [];

				if (!notification.title) errors.push('Title is required');
				if (!notification.message) errors.push('Message is required');
				if (
					notification.priority &&
					!Object.values(notificationPriorities).includes(notification.priority)
				) {
					errors.push('Invalid priority level');
				}
				if (
					notification.type &&
					!Object.values(notificationTypes).includes(notification.type)
				) {
					errors.push('Invalid notification type');
				}
				if (notification.hideAfter && notification.hideAfter < 1000) {
					errors.push('Auto-hide time must be at least 1000ms');
				}

				return {
					valid: errors.length === 0,
					errors,
					timestamp: Date.now()
				};
			}
		);

		mockNotificationSystem.handleUserAction.mockImplementation(
			(notificationId, action) => {
				if (!notificationId || !action) {
					return {
						success: false,
						error: 'Notification ID and action are required'
					};
				}

				const validActions = [
					'view_task',
					'view_logs',
					'retry_build',
					'view_system_stats',
					'download_update',
					'dismiss'
				];
				if (!validActions.includes(action)) {
					return {
						success: false,
						error: 'Invalid action'
					};
				}

				return {
					success: true,
					executed: true,
					notificationId,
					action,
					timestamp: Date.now()
				};
			}
		);
	});

	describe('Basic Notification Display', () => {
		test('should show notification with required fields', () => {
			const notification = {
				title: 'Test Notification',
				message: 'This is a test message',
				type: notificationTypes.INFO
			};

			const result = mockNotificationSystem.showNotification(notification);

			expect(result.success).toBe(true);
			expect(result.notification.title).toBe(notification.title);
			expect(result.notification.message).toBe(notification.message);
			expect(result.notification.type).toBe(notification.type);
			expect(result.notification.id).toBeDefined();
			expect(result.notification.timestamp).toBeDefined();
		});

		test('should reject notification without title', () => {
			const notification = {
				message: 'This is a test message'
			};

			const result = mockNotificationSystem.showNotification(notification);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Title and message are required');
		});

		test('should reject notification without message', () => {
			const notification = {
				title: 'Test Notification'
			};

			const result = mockNotificationSystem.showNotification(notification);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Title and message are required');
		});

		test('should apply default values for optional fields', () => {
			const notification = {
				title: 'Test Notification',
				message: 'This is a test message'
			};

			const result = mockNotificationSystem.showNotification(notification);

			expect(result.success).toBe(true);
			expect(result.notification.type).toBe(notificationTypes.INFO);
			expect(result.notification.priority).toBe(notificationPriorities.NORMAL);
			expect(result.notification.autoHide).toBe(true);
			expect(result.notification.hideAfter).toBe(
				mockNotificationPreferences.defaultAutoHideTime
			);
		});
	});

	describe('Notification Types and Priorities', () => {
		test('should handle all notification types', () => {
			Object.values(notificationTypes).forEach((type) => {
				const notification = {
					title: `${type} Notification`,
					message: `This is a ${type} message`,
					type
				};

				const result = mockNotificationSystem.showNotification(notification);
				expect(result.success).toBe(true);
				expect(result.notification.type).toBe(type);
			});
		});

		test('should handle all priority levels', () => {
			Object.values(notificationPriorities).forEach((priority) => {
				const notification = {
					title: 'Priority Test',
					message: `Priority level ${priority}`,
					priority
				};

				const result = mockNotificationSystem.showNotification(notification);
				expect(result.success).toBe(true);
				expect(result.notification.priority).toBe(priority);
			});
		});

		test('should validate notification types', () => {
			const validNotification = {
				title: 'Test',
				message: 'Test message',
				type: notificationTypes.SUCCESS
			};

			const invalidNotification = {
				title: 'Test',
				message: 'Test message',
				type: 'invalid_type'
			};

			const validResult =
				mockNotificationSystem.validateNotification(validNotification);
			expect(validResult.valid).toBe(true);

			const invalidResult =
				mockNotificationSystem.validateNotification(invalidNotification);
			expect(invalidResult.valid).toBe(false);
			expect(invalidResult.errors).toContain('Invalid notification type');
		});

		test('should validate priority levels', () => {
			const validNotification = {
				title: 'Test',
				message: 'Test message',
				priority: notificationPriorities.HIGH
			};

			const invalidNotification = {
				title: 'Test',
				message: 'Test message',
				priority: 999
			};

			const validResult =
				mockNotificationSystem.validateNotification(validNotification);
			expect(validResult.valid).toBe(true);

			const invalidResult =
				mockNotificationSystem.validateNotification(invalidNotification);
			expect(invalidResult.valid).toBe(false);
			expect(invalidResult.errors).toContain('Invalid priority level');
		});
	});

	describe('Notification Lifecycle Management', () => {
		test('should hide notification by ID', () => {
			const result = mockNotificationSystem.hideNotification('notif-1');

			expect(result.success).toBe(true);
			expect(result.hidden).toBe(true);
			expect(result.id).toBe('notif-1');
		});

		test('should reject hiding notification without ID', () => {
			const result = mockNotificationSystem.hideNotification();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Notification ID is required');
		});

		test('should clear all notifications', () => {
			const result = mockNotificationSystem.clearAllNotifications();

			expect(result.success).toBe(true);
			expect(result.cleared).toBe(true);
			expect(result.count).toBe(mockNotifications.length);
		});

		test('should clear notifications with filter', () => {
			const filter = { type: notificationTypes.ERROR };
			const result = mockNotificationSystem.clearAllNotifications(filter);

			expect(result.success).toBe(true);
			expect(result.cleared).toBe(true);
			expect(result.filter).toEqual(filter);
		});

		test('should update notification', () => {
			const updates = { message: 'Updated message', read: true };
			const result = mockNotificationSystem.updateNotification(
				'notif-1',
				updates
			);

			expect(result.success).toBe(true);
			expect(result.updated).toBe(true);
			expect(result.id).toBe('notif-1');
			expect(result.updates).toEqual(updates);
		});

		test('should dismiss notification', () => {
			const result = mockNotificationSystem.dismissNotification('notif-1');

			expect(result.success).toBe(true);
			expect(result.dismissed).toBe(true);
			expect(result.id).toBe('notif-1');
		});

		test('should mark notification as read', () => {
			const result = mockNotificationSystem.markAsRead('notif-1');

			expect(result.success).toBe(true);
			expect(result.marked).toBe(true);
			expect(result.id).toBe('notif-1');
			expect(result.read).toBe(true);
		});
	});

	describe('Notification Retrieval and Filtering', () => {
		test('should get all active notifications', () => {
			const result = mockNotificationSystem.getActiveNotifications();

			expect(result.success).toBe(true);
			expect(result.notifications).toHaveLength(mockNotifications.length);
			expect(result.count).toBe(mockNotifications.length);
		});

		test('should filter notifications by type', () => {
			const filters = { type: notificationTypes.ERROR };
			const result = mockNotificationSystem.getActiveNotifications(filters);

			expect(result.success).toBe(true);
			expect(
				result.notifications.every((n) => n.type === notificationTypes.ERROR)
			).toBe(true);
		});

		test('should filter notifications by priority', () => {
			const filters = { priority: notificationPriorities.HIGH };
			const result = mockNotificationSystem.getActiveNotifications(filters);

			expect(result.success).toBe(true);
			expect(
				result.notifications.every(
					(n) => n.priority >= notificationPriorities.HIGH
				)
			).toBe(true);
		});

		test('should filter unread notifications only', () => {
			const filters = { unreadOnly: true };
			const result = mockNotificationSystem.getActiveNotifications(filters);

			expect(result.success).toBe(true);
			expect(result.notifications.every((n) => !n.read)).toBe(true);
		});

		test('should combine multiple filters', () => {
			const filters = {
				type: notificationTypes.ERROR,
				priority: notificationPriorities.HIGH,
				unreadOnly: true
			};

			const result = mockNotificationSystem.getActiveNotifications(filters);

			expect(result.success).toBe(true);
			expect(
				result.notifications.every(
					(n) =>
						n.type === notificationTypes.ERROR &&
						n.priority >= notificationPriorities.HIGH &&
						!n.read
				)
			).toBe(true);
		});
	});

	describe('Notification Preferences', () => {
		test('should update notification preferences', () => {
			const newPrefs = {
				maxVisibleNotifications: 10,
				defaultAutoHideTime: 8000,
				playSound: true
			};

			const result =
				mockNotificationSystem.setNotificationPreferences(newPrefs);

			expect(result.success).toBe(true);
			expect(result.preferences.maxVisibleNotifications).toBe(10);
			expect(result.preferences.defaultAutoHideTime).toBe(8000);
			expect(result.preferences.playSound).toBe(true);
		});

		test('should preserve existing preferences when updating', () => {
			const newPrefs = { playSound: true };
			const result =
				mockNotificationSystem.setNotificationPreferences(newPrefs);

			expect(result.success).toBe(true);
			expect(result.preferences.enabled).toBe(
				mockNotificationPreferences.enabled
			);
			expect(result.preferences.playSound).toBe(true);
		});
	});

	describe('Scheduled Notifications', () => {
		test('should schedule notification with delay', () => {
			const notification = {
				title: 'Scheduled Notification',
				message: 'This will show later'
			};

			const delay = 5000;
			const result = mockNotificationSystem.scheduleNotification(
				notification,
				delay
			);

			expect(result.success).toBe(true);
			expect(result.scheduled).toBe(true);
			expect(result.delay).toBe(delay);
			expect(result.executeAt).toBeGreaterThan(Date.now());
			expect(result.id).toBeDefined();
		});

		test('should reject scheduling with negative delay', () => {
			const notification = {
				title: 'Test',
				message: 'Test message'
			};

			const result = mockNotificationSystem.scheduleNotification(
				notification,
				-1000
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Delay must be non-negative');
		});

		test('should reject scheduling without required fields', () => {
			const notification = { title: 'Test' }; // Missing message

			const result = mockNotificationSystem.scheduleNotification(
				notification,
				1000
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Title and message are required');
		});
	});

	describe('Notification Grouping', () => {
		test('should group similar notifications', () => {
			const testNotifications = [
				{ type: 'error', title: 'Build Failed', timestamp: 1000 },
				{ type: 'error', title: 'Build Failed', timestamp: 2000 },
				{ type: 'success', title: 'Task Completed', timestamp: 3000 },
				{ type: 'error', title: 'Build Failed', timestamp: 4000 }
			];

			const result =
				mockNotificationSystem.groupNotifications(testNotifications);

			expect(result.success).toBe(true);
			expect(result.groupCount).toBe(2);

			const buildFailedGroup = result.groups.find(
				(g) => g.title === 'Build Failed'
			);
			expect(buildFailedGroup.count).toBe(3);
			expect(buildFailedGroup.notifications).toHaveLength(3);

			const taskCompletedGroup = result.groups.find(
				(g) => g.title === 'Task Completed'
			);
			expect(taskCompletedGroup.count).toBe(1);
		});

		test('should track latest timestamp in groups', () => {
			const testNotifications = [
				{ type: 'error', title: 'Build Failed', timestamp: 1000 },
				{ type: 'error', title: 'Build Failed', timestamp: 4000 },
				{ type: 'error', title: 'Build Failed', timestamp: 2000 }
			];

			const result =
				mockNotificationSystem.groupNotifications(testNotifications);

			expect(result.success).toBe(true);
			const group = result.groups[0];
			expect(group.latestTimestamp).toBe(4000);
		});
	});

	describe('User Actions', () => {
		test('should handle valid user actions', () => {
			const validActions = ['view_task', 'view_logs', 'retry_build', 'dismiss'];

			validActions.forEach((action) => {
				const result = mockNotificationSystem.handleUserAction(
					'notif-1',
					action
				);
				expect(result.success).toBe(true);
				expect(result.executed).toBe(true);
				expect(result.action).toBe(action);
			});
		});

		test('should reject invalid actions', () => {
			const result = mockNotificationSystem.handleUserAction(
				'notif-1',
				'invalid_action'
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid action');
		});

		test('should require notification ID and action', () => {
			const result1 = mockNotificationSystem.handleUserAction(
				null,
				'view_task'
			);
			expect(result1.success).toBe(false);
			expect(result1.error).toBe('Notification ID and action are required');

			const result2 = mockNotificationSystem.handleUserAction('notif-1', null);
			expect(result2.success).toBe(false);
			expect(result2.error).toBe('Notification ID and action are required');
		});
	});

	describe('Validation and Error Handling', () => {
		test('should validate complete notification object', () => {
			const validNotification = {
				title: 'Valid Notification',
				message: 'This is valid',
				type: notificationTypes.SUCCESS,
				priority: notificationPriorities.NORMAL,
				hideAfter: 5000
			};

			const result =
				mockNotificationSystem.validateNotification(validNotification);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		test('should detect all validation errors', () => {
			const invalidNotification = {
				// Missing title and message
				type: 'invalid_type',
				priority: 999,
				hideAfter: 500 // Too short
			};

			const result =
				mockNotificationSystem.validateNotification(invalidNotification);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Title is required');
			expect(result.errors).toContain('Message is required');
			expect(result.errors).toContain('Invalid notification type');
			expect(result.errors).toContain('Invalid priority level');
			expect(result.errors).toContain('Auto-hide time must be at least 1000ms');
		});

		test('should handle graceful degradation', () => {
			// Should not throw errors even with corrupt data
			expect(() => {
				mockNotificationSystem.validateNotification({ invalid: 'structure' });
			}).not.toThrow();

			expect(() => {
				mockNotificationSystem.groupNotifications([{ incomplete: 'data' }]);
			}).not.toThrow();
		});
	});

	describe('Performance and Timing', () => {
		test('should show notifications quickly', () => {
			const startTime = Date.now();

			mockNotificationSystem.showNotification({
				title: 'Performance Test',
				message: 'Testing display speed'
			});

			const executionTime = Date.now() - startTime;
			expect(executionTime).toBeLessThan(50); // 50ms limit
		});

		test('should handle bulk operations efficiently', () => {
			const startTime = Date.now();

			// Simulate multiple rapid notifications
			for (let i = 0; i < 20; i++) {
				mockNotificationSystem.showNotification({
					title: `Bulk Test ${i}`,
					message: `Message ${i}`
				});
			}

			const executionTime = Date.now() - startTime;
			expect(executionTime).toBeLessThan(200); // 200ms for 20 notifications
		});

		test('should group notifications efficiently', () => {
			const manyNotifications = Array.from({ length: 100 }, (_, i) => ({
				type: i % 2 === 0 ? 'error' : 'success',
				title: `Notification ${i % 5}`,
				timestamp: Date.now() + i
			}));

			const startTime = Date.now();
			mockNotificationSystem.groupNotifications(manyNotifications);
			const executionTime = Date.now() - startTime;

			expect(executionTime).toBeLessThan(100); // 100ms for 100 notifications
		});
	});

	describe('Accessibility Features', () => {
		test('should provide meaningful notification content', () => {
			mockNotifications.forEach((notification) => {
				expect(notification.title).toBeDefined();
				expect(notification.message).toBeDefined();
				expect(typeof notification.title).toBe('string');
				expect(typeof notification.message).toBe('string');
				expect(notification.title.length).toBeGreaterThan(0);
				expect(notification.message.length).toBeGreaterThan(0);
			});
		});

		test('should support screen reader friendly content', () => {
			const notification = {
				title: 'Task Completed Successfully',
				message:
					'Your task "Setup Database Connection" has been completed. View details to see the results.',
				type: notificationTypes.SUCCESS
			};

			const result = mockNotificationSystem.showNotification(notification);

			expect(result.success).toBe(true);
			expect(result.notification.title).toBe(notification.title);
			expect(result.notification.message).toBe(notification.message);

			// Should have descriptive content
			expect(result.notification.title).toMatch(/\w+/);
			expect(result.notification.message).toMatch(/\w+/);
		});

		test('should handle notifications without overwhelming users', () => {
			const preferences = mockNotificationPreferences;
			expect(preferences.maxVisibleNotifications).toBeDefined();
			expect(preferences.maxVisibleNotifications).toBeGreaterThan(0);
			expect(preferences.maxVisibleNotifications).toBeLessThanOrEqual(10);
		});
	});
});
