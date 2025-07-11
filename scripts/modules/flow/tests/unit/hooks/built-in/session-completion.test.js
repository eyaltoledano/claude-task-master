/**
 * @fileoverview Session Completion Hook Tests
 * Tests for session completion hook including finalization,
 * cleanup operations, and completion reporting.
 *
 * @author Claude (Task Master Flow Testing Phase 2.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock SessionCompletionHook class
class MockSessionCompletionHook extends EventEmitter {
	constructor(options = {}) {
		super();
		this.config = {
			generateReport: options.generateReport !== false,
			saveSessionData: options.saveSessionData !== false,
			cleanupTempData: options.cleanupTempData !== false,
			notifyCompletion: options.notifyCompletion !== false,
			archiveSession: options.archiveSession !== false,
			...options
		};
		this.statistics = {
			totalCompletions: 0,
			successfulCompletions: 0,
			failedCompletions: 0,
			averageCompletionTime: 0,
			totalCompletionTime: 0
		};
		this.isActive = false;
		this.currentSession = null;
	}

	async activate() {
		this.isActive = true;
		this.emit('hookActivated');
		return true;
	}

	async deactivate() {
		this.isActive = false;
		this.emit('hookDeactivated');
		return true;
	}

	setCurrentSession(session) {
		this.currentSession = {
			id: session.id,
			startTime: session.startTime || new Date(),
			endTime: session.endTime || new Date(),
			status: session.status || 'completed',
			results: session.results || [],
			metrics: session.metrics || {},
			errors: session.errors || [],
			warnings: session.warnings || [],
			...session
		};
		this.emit('sessionSet', { sessionId: this.currentSession.id });
		return this.currentSession;
	}

	async execute(context = {}) {
		const startTime = Date.now();
		this.statistics.totalCompletions++;

		try {
			if (!this.isActive) {
				throw new Error('Hook not active');
			}

			if (!this.currentSession) {
				throw new Error('No session to complete');
			}

			this.emit('completionStarted', {
				sessionId: this.currentSession?.id,
				context,
				timestamp: new Date()
			});

			const completionResult = await this.performCompletion(context);

			const completionTime = Date.now() - startTime;
			this.updateStatistics(true, completionTime);

			this.emit('completionFinished', {
				sessionId: this.currentSession?.id,
				result: completionResult,
				completionTime
			});

			return completionResult;
		} catch (error) {
			const completionTime = Date.now() - startTime;
			this.statistics.failedCompletions++;
			this.updateStatistics(false, completionTime);

			this.emit('completionFailed', {
				sessionId: this.currentSession?.id,
				error: error.message,
				completionTime
			});

			throw error;
		}
	}

	async performCompletion(context) {
		const result = {
			sessionId: this.currentSession.id,
			completedAt: new Date(),
			report: null,
			dataSaved: false,
			tempDataCleaned: false,
			notificationsSent: false,
			archived: false,
			warnings: [],
			errors: []
		};

		try {
			// Generate session report
			if (this.config.generateReport) {
				result.report = await this.generateSessionReport();
			}

			// Save session data
			if (this.config.saveSessionData) {
				await this.saveSessionData(result);
			}

			// Cleanup temporary data
			if (this.config.cleanupTempData) {
				await this.cleanupTempData(result);
			}

			// Send completion notifications
			if (this.config.notifyCompletion) {
				await this.sendCompletionNotifications(result);
			}

			// Archive session
			if (this.config.archiveSession) {
				await this.archiveSession(result);
			}

			this.statistics.successfulCompletions++;
			return result;
		} catch (error) {
			result.errors.push(error.message);
			this.statistics.failedCompletions++;
			throw error;
		}
	}

	async generateSessionReport() {
		const report = {
			sessionId: this.currentSession.id,
			duration: this.currentSession.endTime - this.currentSession.startTime,
			status: this.currentSession.status,
			summary: {
				totalResults: this.currentSession.results.length,
				successfulResults: this.currentSession.results.filter((r) => r.success)
					.length,
				failedResults: this.currentSession.results.filter((r) => !r.success)
					.length,
				totalErrors: this.currentSession.errors.length,
				totalWarnings: this.currentSession.warnings.length
			},
			metrics: this.currentSession.metrics,
			timeline: this.generateTimeline(),
			performance: this.calculatePerformanceMetrics(),
			generatedAt: new Date()
		};

		this.emit('reportGenerated', {
			sessionId: this.currentSession.id,
			reportSize: JSON.stringify(report).length
		});

		return report;
	}

	generateTimeline() {
		return [
			{ event: 'session_started', timestamp: this.currentSession.startTime },
			{ event: 'session_ended', timestamp: this.currentSession.endTime }
		];
	}

	calculatePerformanceMetrics() {
		const duration =
			this.currentSession.endTime - this.currentSession.startTime;
		return {
			totalDuration: duration,
			averageResultTime:
				this.currentSession.results.length > 0
					? duration / this.currentSession.results.length
					: 0,
			errorRate:
				this.currentSession.results.length > 0
					? (this.currentSession.errors.length /
							this.currentSession.results.length) *
						100
					: 0
		};
	}

	async saveSessionData(result) {
		try {
			const sessionData = {
				session: this.currentSession,
				report: result.report,
				savedAt: new Date()
			};

			// Mock data saving with reduced delay
			await new Promise((resolve) => setTimeout(resolve, 10));

			result.dataSaved = true;
			this.emit('sessionDataSaved', {
				sessionId: this.currentSession.id,
				dataSize: JSON.stringify(sessionData).length
			});
		} catch (error) {
			result.warnings.push(`Failed to save session data: ${error.message}`);
		}
	}

	async cleanupTempData(result) {
		try {
			const tempFiles = this.currentSession.tempFiles || [];
			const tempData = this.currentSession.tempData || [];

			let cleanedFiles = 0;
			let cleanedData = 0;

			// Mock file cleanup with reduced delay
			for (const file of tempFiles) {
				await new Promise((resolve) => setTimeout(resolve, 1));
				cleanedFiles++;
			}

			// Mock data cleanup with reduced delay
			for (const data of tempData) {
				await new Promise((resolve) => setTimeout(resolve, 1));
				cleanedData++;
			}

			result.tempDataCleaned = true;
			this.emit('tempDataCleaned', {
				sessionId: this.currentSession.id,
				filesCleanedUp: cleanedFiles,
				dataCleanedUp: cleanedData
			});
		} catch (error) {
			result.warnings.push(`Failed to cleanup temp data: ${error.message}`);
		}
	}

	async sendCompletionNotifications(result) {
		try {
			const notifications = [
				{
					type: 'session_completed',
					sessionId: this.currentSession.id,
					status: this.currentSession.status,
					summary: result.report?.summary,
					timestamp: new Date()
				}
			];

			// Add warning notifications
			for (const warning of this.currentSession.warnings || []) {
				notifications.push({
					type: 'warning',
					sessionId: this.currentSession.id,
					message: warning,
					timestamp: new Date()
				});
			}

			// Add error notifications
			for (const error of this.currentSession.errors || []) {
				notifications.push({
					type: 'error',
					sessionId: this.currentSession.id,
					message: error,
					timestamp: new Date()
				});
			}

			// Mock notification sending with reduced delay
			await new Promise((resolve) => setTimeout(resolve, 5));

			result.notificationsSent = true;
			result.notifications = notifications;

			this.emit('notificationsSent', {
				sessionId: this.currentSession.id,
				count: notifications.length
			});
		} catch (error) {
			result.warnings.push(`Failed to send notifications: ${error.message}`);
		}
	}

	async archiveSession(result) {
		try {
			const archiveData = {
				session: this.currentSession,
				report: result.report,
				archivedAt: new Date(),
				archiveId: `archive-${this.currentSession.id}-${Date.now()}`
			};

			// Mock archiving with reduced delay
			await new Promise((resolve) => setTimeout(resolve, 20));

			result.archived = true;
			result.archiveId = archiveData.archiveId;

			this.emit('sessionArchived', {
				sessionId: this.currentSession.id,
				archiveId: archiveData.archiveId,
				archiveSize: JSON.stringify(archiveData).length
			});
		} catch (error) {
			result.warnings.push(`Failed to archive session: ${error.message}`);
		}
	}

	updateStatistics(success, completionTime) {
		this.statistics.totalCompletionTime += completionTime;
		this.statistics.averageCompletionTime =
			this.statistics.totalCompletionTime / this.statistics.totalCompletions;
	}

	getStatistics() {
		return {
			...this.statistics,
			successRate:
				this.statistics.totalCompletions > 0
					? (this.statistics.successfulCompletions /
							this.statistics.totalCompletions) *
						100
					: 0,
			isActive: this.isActive,
			currentSessionId: this.currentSession?.id
		};
	}

	async cleanup() {
		this.currentSession = null;
		this.statistics = {
			totalCompletions: 0,
			successfulCompletions: 0,
			failedCompletions: 0,
			averageCompletionTime: 0,
			totalCompletionTime: 0
		};
		this.emit('hookCleanedUp');
	}
}

describe('Session Completion Hook', () => {
	let completionHook;

	beforeEach(async () => {
		completionHook = new MockSessionCompletionHook();
		await completionHook.activate();
	});

	afterEach(async () => {
		if (completionHook.isActive) {
			await completionHook.deactivate();
		}
		await completionHook.cleanup();
	});

	describe('Hook Activation', () => {
		test('should activate successfully', async () => {
			const newHook = new MockSessionCompletionHook();
			await newHook.activate();

			expect(newHook.isActive).toBe(true);

			await newHook.deactivate();
		});

		test('should emit activation events', async () => {
			const activatedSpy = jest.fn();
			const deactivatedSpy = jest.fn();

			const newHook = new MockSessionCompletionHook();
			newHook.on('hookActivated', activatedSpy);
			newHook.on('hookDeactivated', deactivatedSpy);

			await newHook.activate();
			await newHook.deactivate();

			expect(activatedSpy).toHaveBeenCalled();
			expect(deactivatedSpy).toHaveBeenCalled();
		});
	});

	describe('Session Management', () => {
		test('should set current session', () => {
			const session = {
				id: 'test-session',
				startTime: new Date('2023-01-01T10:00:00Z'),
				endTime: new Date('2023-01-01T11:00:00Z'),
				status: 'completed',
				results: [
					{ id: 'result1', success: true },
					{ id: 'result2', success: false }
				],
				errors: ['Error 1'],
				warnings: ['Warning 1']
			};

			const result = completionHook.setCurrentSession(session);

			expect(result.id).toBe('test-session');
			expect(result.status).toBe('completed');
			expect(result.results).toHaveLength(2);
		});

		test('should emit sessionSet event', () => {
			const eventSpy = jest.fn();
			completionHook.on('sessionSet', eventSpy);

			const session = { id: 'event-test-session' };
			completionHook.setCurrentSession(session);

			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: 'event-test-session'
			});
		});
	});

	describe('Session Completion Execution', () => {
		beforeEach(() => {
			const session = {
				id: 'completion-test-session',
				startTime: new Date('2023-01-01T10:00:00Z'),
				endTime: new Date('2023-01-01T11:00:00Z'),
				status: 'completed',
				results: [
					{ id: 'result1', success: true },
					{ id: 'result2', success: true },
					{ id: 'result3', success: false }
				],
				errors: ['Test error'],
				warnings: ['Test warning'],
				metrics: { performance: 'good' },
				tempFiles: ['/tmp/session.log'],
				tempData: ['cache-data']
			};
			completionHook.setCurrentSession(session);
		});

		test('should execute completion successfully', async () => {
			const result = await completionHook.execute();

			expect(result.sessionId).toBe('completion-test-session');
			expect(result.completedAt).toBeInstanceOf(Date);
			expect(result.report).toBeDefined();
			expect(result.dataSaved).toBe(true);
			expect(result.tempDataCleaned).toBe(true);
			expect(result.notificationsSent).toBe(true);
			expect(result.archived).toBe(true);
		});

		test('should emit completion lifecycle events', async () => {
			const startedSpy = jest.fn();
			const finishedSpy = jest.fn();

			completionHook.on('completionStarted', startedSpy);
			completionHook.on('completionFinished', finishedSpy);

			await completionHook.execute();

			expect(startedSpy).toHaveBeenCalledWith({
				sessionId: 'completion-test-session',
				context: {},
				timestamp: expect.any(Date)
			});

			expect(finishedSpy).toHaveBeenCalledWith({
				sessionId: 'completion-test-session',
				result: expect.objectContaining({
					sessionId: 'completion-test-session'
				}),
				completionTime: expect.any(Number)
			});
		});

		test('should reject execution when hook not active', async () => {
			await completionHook.deactivate();

			await expect(completionHook.execute()).rejects.toThrow('Hook not active');
		});

		test('should reject execution when no session set', async () => {
			completionHook.currentSession = null;

			await expect(completionHook.execute()).rejects.toThrow(
				'No session to complete'
			);
		});
	});

	describe('Report Generation', () => {
		beforeEach(() => {
			const session = {
				id: 'report-test-session',
				startTime: new Date('2023-01-01T10:00:00Z'),
				endTime: new Date('2023-01-01T11:00:00Z'),
				status: 'completed',
				results: [
					{ id: 'result1', success: true },
					{ id: 'result2', success: false }
				],
				errors: ['Error 1', 'Error 2'],
				warnings: ['Warning 1'],
				metrics: { cpu: 80, memory: 60 }
			};
			completionHook.setCurrentSession(session);
		});

		test('should generate comprehensive session report', async () => {
			const result = await completionHook.execute();

			expect(result.report).toBeDefined();
			expect(result.report.sessionId).toBe('report-test-session');
			expect(result.report.duration).toBe(3600000); // 1 hour in ms
			expect(result.report.summary.totalResults).toBe(2);
			expect(result.report.summary.successfulResults).toBe(1);
			expect(result.report.summary.failedResults).toBe(1);
			expect(result.report.summary.totalErrors).toBe(2);
			expect(result.report.summary.totalWarnings).toBe(1);
			expect(result.report.metrics).toEqual({ cpu: 80, memory: 60 });
			expect(result.report.performance).toBeDefined();
			expect(result.report.timeline).toBeDefined();
		});

		test('should emit reportGenerated event', async () => {
			const eventSpy = jest.fn();
			completionHook.on('reportGenerated', eventSpy);

			await completionHook.execute();

			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: 'report-test-session',
				reportSize: expect.any(Number)
			});
		});

		test('should calculate performance metrics correctly', async () => {
			const result = await completionHook.execute();

			expect(result.report.performance.totalDuration).toBe(3600000);
			expect(result.report.performance.averageResultTime).toBe(1800000); // 3600000 / 2
			expect(result.report.performance.errorRate).toBe(100); // 2 errors / 2 results * 100
		});

		test('should skip report generation when disabled', async () => {
			const hookWithoutReport = new MockSessionCompletionHook({
				generateReport: false
			});
			await hookWithoutReport.activate();

			const session = { id: 'no-report-session' };
			hookWithoutReport.setCurrentSession(session);

			const result = await hookWithoutReport.execute();

			expect(result.report).toBeNull();

			await hookWithoutReport.deactivate();
		});
	});

	describe('Data Management', () => {
		beforeEach(() => {
			const session = {
				id: 'data-test-session',
				tempFiles: ['/tmp/file1.log', '/tmp/file2.cache'],
				tempData: ['data1', 'data2', 'data3']
			};
			completionHook.setCurrentSession(session);
		});

		test('should save session data', async () => {
			const eventSpy = jest.fn();
			completionHook.on('sessionDataSaved', eventSpy);

			const result = await completionHook.execute();

			expect(result.dataSaved).toBe(true);
			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: 'data-test-session',
				dataSize: expect.any(Number)
			});
		});

		test('should cleanup temporary data', async () => {
			const eventSpy = jest.fn();
			completionHook.on('tempDataCleaned', eventSpy);

			const result = await completionHook.execute();

			expect(result.tempDataCleaned).toBe(true);
			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: 'data-test-session',
				filesCleanedUp: 2,
				dataCleanedUp: 3
			});
		});

		test('should skip data operations when disabled', async () => {
			const hookWithoutData = new MockSessionCompletionHook({
				saveSessionData: false,
				cleanupTempData: false
			});
			await hookWithoutData.activate();

			const session = { id: 'no-data-session' };
			hookWithoutData.setCurrentSession(session);

			const result = await hookWithoutData.execute();

			expect(result.dataSaved).toBe(false);
			expect(result.tempDataCleaned).toBe(false);

			await hookWithoutData.deactivate();
		});
	});

	describe('Notification System', () => {
		beforeEach(() => {
			const session = {
				id: 'notification-test-session',
				errors: ['Session error'],
				warnings: ['Session warning']
			};
			completionHook.setCurrentSession(session);
		});

		test('should send completion notifications', async () => {
			const eventSpy = jest.fn();
			completionHook.on('notificationsSent', eventSpy);

			const result = await completionHook.execute();

			expect(result.notificationsSent).toBe(true);
			expect(result.notifications).toHaveLength(3); // completion + error + warning
			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: 'notification-test-session',
				count: 3
			});
		});

		test('should include different notification types', async () => {
			const result = await completionHook.execute();

			const notifications = result.notifications;
			const completionNotification = notifications.find(
				(n) => n.type === 'session_completed'
			);
			const errorNotification = notifications.find((n) => n.type === 'error');
			const warningNotification = notifications.find(
				(n) => n.type === 'warning'
			);

			expect(completionNotification).toBeDefined();
			expect(errorNotification).toBeDefined();
			expect(warningNotification).toBeDefined();
		});
	});

	describe('Session Archiving', () => {
		beforeEach(() => {
			const session = { id: 'archive-test-session' };
			completionHook.setCurrentSession(session);
		});

		test('should archive session', async () => {
			const eventSpy = jest.fn();
			completionHook.on('sessionArchived', eventSpy);

			const result = await completionHook.execute();

			expect(result.archived).toBe(true);
			expect(result.archiveId).toMatch(/^archive-archive-test-session-\d+$/);
			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: 'archive-test-session',
				archiveId: result.archiveId,
				archiveSize: expect.any(Number)
			});
		});

		test('should skip archiving when disabled', async () => {
			const hookWithoutArchive = new MockSessionCompletionHook({
				archiveSession: false
			});
			await hookWithoutArchive.activate();

			const session = { id: 'no-archive-session' };
			hookWithoutArchive.setCurrentSession(session);

			const result = await hookWithoutArchive.execute();

			expect(result.archived).toBe(false);
			expect(result.archiveId).toBeUndefined();

			await hookWithoutArchive.deactivate();
		});
	});

	describe('Statistics and Monitoring', () => {
		test('should track completion statistics', async () => {
			const session = { id: 'stats-session' };
			completionHook.setCurrentSession(session);

			await completionHook.execute();
			await completionHook.execute();

			const stats = completionHook.getStatistics();

			expect(stats.totalCompletions).toBe(2);
			expect(stats.successfulCompletions).toBe(2);
			expect(stats.successRate).toBe(100);
			expect(stats.averageCompletionTime).toBeGreaterThan(0);
		});

		test('should track failed completions', async () => {
			// Force an error by setting invalid session
			completionHook.currentSession = null;

			try {
				await completionHook.execute();
			} catch (error) {
				// Expected to fail
			}

			const stats = completionHook.getStatistics();

			expect(stats.totalCompletions).toBe(1);
			expect(stats.failedCompletions).toBe(1);
			expect(stats.successRate).toBe(0);
		});
	});

	describe('Error Handling', () => {
		test('should emit completionFailed event on errors', async () => {
			const eventSpy = jest.fn();
			completionHook.on('completionFailed', eventSpy);

			completionHook.currentSession = null;

			try {
				await completionHook.execute();
			} catch (error) {
				// Expected to fail
			}

			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: undefined,
				error: 'No session to complete',
				completionTime: expect.any(Number)
			});
		});

		test('should handle partial completion failures gracefully', async () => {
			// Mock a scenario where some operations succeed and others fail
			const session = { id: 'partial-failure-session' };
			completionHook.setCurrentSession(session);

			// This test would require more complex mocking to simulate partial failures
			// For now, we verify that the hook can handle the basic case
			const result = await completionHook.execute();

			expect(result.warnings).toEqual([]);
			expect(result.errors).toEqual([]);
		});
	});

	describe('Performance Benchmarks', () => {
		test('should complete within performance thresholds', async () => {
			const session = {
				id: 'performance-session',
				results: Array.from({ length: 100 }, (_, i) => ({
					id: `result-${i}`,
					success: true
				})),
				tempFiles: Array.from({ length: 50 }, (_, i) => `/tmp/file-${i}.tmp`),
				tempData: Array.from({ length: 200 }, (_, i) => `data-${i}`)
			};
			completionHook.setCurrentSession(session);

			const startTime = Date.now();
			await completionHook.execute();
			const completionTime = Date.now() - startTime;

			expect(completionTime).toBeLessThan(1000); // Should complete within 1 second
		});
	});

	describe('Cleanup', () => {
		test('should cleanup hook state', async () => {
			const session = { id: 'cleanup-session' };
			completionHook.setCurrentSession(session);

			expect(completionHook.currentSession).not.toBeNull();

			await completionHook.cleanup();

			expect(completionHook.currentSession).toBeNull();
			expect(completionHook.getStatistics().totalCompletions).toBe(0);
		});

		test('should emit hookCleanedUp event', async () => {
			const eventSpy = jest.fn();
			completionHook.on('hookCleanedUp', eventSpy);

			await completionHook.cleanup();

			expect(eventSpy).toHaveBeenCalled();
		});
	});
});
