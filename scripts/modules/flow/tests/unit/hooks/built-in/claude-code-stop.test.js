/**
 * @fileoverview Claude Code Stop Hook Tests
 * Tests for the Claude Code session termination hook including cleanup operations,
 * safety checks, and graceful shutdown procedures.
 *
 * @author Claude (Task Master Flow Testing Phase 2.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock ClaudeCodeStopHook class
class MockClaudeCodeStopHook extends EventEmitter {
	constructor(options = {}) {
		super();
		this.config = {
			gracefulShutdownTimeout: options.gracefulShutdownTimeout || 30000,
			forceKillTimeout: options.forceKillTimeout || 60000,
			saveStateBeforeStop: options.saveStateBeforeStop !== false,
			cleanupTempFiles: options.cleanupTempFiles !== false,
			notifyOnStop: options.notifyOnStop !== false,
			...options
		};
		this.isActive = false;
		this.currentSession = null;
		this.stopInProgress = false;
		this.statistics = {
			totalStops: 0,
			gracefulStops: 0,
			forcedStops: 0,
			failedStops: 0,
			averageStopTime: 0,
			totalStopTime: 0
		};
	}

	// Hook registration and activation
	async activate() {
		if (this.isActive) {
			throw new Error('Claude Code stop hook already active');
		}

		this.isActive = true;
		this.emit('hookActivated');
		return true;
	}

	async deactivate() {
		if (!this.isActive) {
			throw new Error('Claude Code stop hook not active');
		}

		this.isActive = false;
		this.emit('hookDeactivated');
		return true;
	}

	// Session management
	setCurrentSession(session) {
		if (!session || typeof session !== 'object') {
			throw new Error('Invalid session object');
		}

		this.currentSession = {
			id: session.id,
			status: session.status || 'active',
			startTime: session.startTime || new Date(),
			processes: session.processes || [],
			tempFiles: session.tempFiles || [],
			resources: session.resources || [],
			...session
		};

		this.emit('sessionSet', { sessionId: this.currentSession.id });
		return this.currentSession;
	}

	getCurrentSession() {
		return this.currentSession;
	}

	// Main stop hook execution
	async execute(context = {}) {
		if (!this.isActive) {
			throw new Error('Hook not active');
		}

		if (this.stopInProgress) {
			throw new Error('Stop operation already in progress');
		}

		const startTime = Date.now();
		this.stopInProgress = true;
		this.statistics.totalStops++;

		try {
			this.emit('stopStarted', {
				sessionId: this.currentSession?.id,
				context,
				timestamp: new Date()
			});

			const stopResult = await this.performStop(context);

			const stopTime = Date.now() - startTime;
			this.updateStatistics(true, stopTime);

			this.emit('stopCompleted', {
				sessionId: this.currentSession?.id,
				result: stopResult,
				stopTime,
				graceful: stopResult.graceful
			});

			return stopResult;
		} catch (error) {
			const stopTime = Date.now() - startTime;
			this.updateStatistics(false, stopTime);

			this.emit('stopFailed', {
				sessionId: this.currentSession?.id,
				error: error.message,
				stopTime
			});

			throw error;
		} finally {
			this.stopInProgress = false;
		}
	}

	// Core stop logic
	async performStop(context) {
		const stopResult = {
			graceful: false,
			processesTerminated: 0,
			filesCleanedUp: 0,
			resourcesReleased: 0,
			stateSaved: false,
			notifications: [],
			warnings: [],
			errors: []
		};

		try {
			// Step 1: Safety checks
			await this.performSafetyChecks(context, stopResult);

			// Step 2: Save state if enabled
			if (this.config.saveStateBeforeStop) {
				await this.saveSessionState(stopResult);
			}

			// Step 3: Graceful process termination
			await this.terminateProcesses(context, stopResult);

			// Step 4: Resource cleanup
			await this.cleanupResources(stopResult);

			// Step 5: Temporary file cleanup
			if (this.config.cleanupTempFiles) {
				await this.cleanupTempFiles(stopResult);
			}

			// Step 6: Send notifications
			if (this.config.notifyOnStop) {
				await this.sendNotifications(stopResult);
			}

			stopResult.graceful = true;
			this.statistics.gracefulStops++;

			return stopResult;
		} catch (error) {
			stopResult.errors.push(error.message);

			// Attempt force stop if graceful failed
			if (context.allowForceStop !== false) {
				await this.performForceStop(stopResult);
				this.statistics.forcedStops++;
			} else {
				this.statistics.failedStops++;
				throw error;
			}

			return stopResult;
		}
	}

	// Safety checks before stopping
	async performSafetyChecks(context, result) {
		const checks = [];

		// Check for unsaved work
		if (this.currentSession?.hasUnsavedWork) {
			if (context.force) {
				result.warnings.push('Unsaved work detected but force stop requested');
			} else {
				throw new Error('Cannot stop: unsaved work detected');
			}
		}

		// Check for active operations
		if (this.currentSession?.activeOperations > 0) {
			if (context.force) {
				result.warnings.push(
					`${this.currentSession.activeOperations} active operations will be terminated`
				);
			} else {
				throw new Error(
					`Cannot stop: ${this.currentSession.activeOperations} active operations in progress`
				);
			}
		}

		// Check for critical processes
		const criticalProcesses =
			this.currentSession?.processes?.filter((p) => p.critical) || [];
		if (criticalProcesses.length > 0) {
			if (context.force) {
				result.warnings.push(
					`${criticalProcesses.length} critical processes will be terminated`
				);
			} else {
				throw new Error(
					`Cannot stop: ${criticalProcesses.length} critical processes running`
				);
			}
		}

		this.emit('safetyChecksCompleted', {
			checks: checks.length,
			warnings: result.warnings.length,
			sessionId: this.currentSession?.id
		});
	}

	// Save session state
	async saveSessionState(result) {
		if (!this.currentSession) {
			result.warnings.push('No active session to save state for');
			return;
		}

		try {
			const stateData = {
				sessionId: this.currentSession.id,
				status: this.currentSession.status,
				startTime: this.currentSession.startTime,
				stopTime: new Date(),
				processes: this.currentSession.processes,
				resources: this.currentSession.resources,
				metadata: this.currentSession.metadata || {}
			};

			// Mock state saving
			await new Promise((resolve) => setTimeout(resolve, 50));

			result.stateSaved = true;
			this.emit('stateSaved', {
				sessionId: this.currentSession.id,
				stateSize: JSON.stringify(stateData).length
			});
		} catch (error) {
			result.warnings.push(`Failed to save state: ${error.message}`);
		}
	}

	// Process termination
	async terminateProcesses(context, result) {
		if (!this.currentSession?.processes) {
			return;
		}

		const processes = [...this.currentSession.processes];
		const terminationPromises = [];

		for (const process of processes) {
			terminationPromises.push(this.terminateProcess(process, context));
		}

		try {
			// Wait for graceful termination with timeout
			await Promise.race([
				Promise.all(terminationPromises),
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error('Process termination timeout')),
						this.config.gracefulShutdownTimeout
					)
				)
			]);

			result.processesTerminated = processes.length;
			this.emit('processesTerminated', {
				count: processes.length,
				sessionId: this.currentSession.id
			});
		} catch (error) {
			result.warnings.push(`Process termination warning: ${error.message}`);

			// Count successfully terminated processes
			result.processesTerminated = processes.filter((p) => p.terminated).length;
		}
	}

	async terminateProcess(process, context) {
		try {
			if (process.type === 'critical' && !context.force) {
				throw new Error(`Cannot terminate critical process: ${process.name}`);
			}

			// Mock process termination
			await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

			process.terminated = true;
			process.terminatedAt = new Date();

			this.emit('processTerminated', {
				processId: process.id,
				processName: process.name,
				sessionId: this.currentSession?.id
			});
		} catch (error) {
			process.terminationError = error.message;
			throw error;
		}
	}

	// Resource cleanup
	async cleanupResources(result) {
		if (!this.currentSession?.resources) {
			return;
		}

		const resources = [...this.currentSession.resources];
		let cleanedUp = 0;

		for (const resource of resources) {
			try {
				await this.cleanupResource(resource);
				cleanedUp++;
			} catch (error) {
				result.warnings.push(
					`Failed to cleanup resource ${resource.id}: ${error.message}`
				);
			}
		}

		result.resourcesReleased = cleanedUp;
		this.emit('resourcesCleanedUp', {
			count: cleanedUp,
			total: resources.length,
			sessionId: this.currentSession?.id
		});
	}

	async cleanupResource(resource) {
		// Mock resource cleanup
		await new Promise((resolve) => setTimeout(resolve, 20));

		resource.cleanedUp = true;
		resource.cleanedUpAt = new Date();

		this.emit('resourceCleaned', {
			resourceId: resource.id,
			resourceType: resource.type,
			sessionId: this.currentSession?.id
		});
	}

	// Temporary file cleanup
	async cleanupTempFiles(result) {
		if (!this.currentSession?.tempFiles) {
			return;
		}

		const tempFiles = [...this.currentSession.tempFiles];
		let cleanedUp = 0;

		for (const file of tempFiles) {
			try {
				await this.cleanupTempFile(file);
				cleanedUp++;
			} catch (error) {
				result.warnings.push(
					`Failed to cleanup temp file ${file.path}: ${error.message}`
				);
			}
		}

		result.filesCleanedUp = cleanedUp;
		this.emit('tempFilesCleanedUp', {
			count: cleanedUp,
			total: tempFiles.length,
			sessionId: this.currentSession?.id
		});
	}

	async cleanupTempFile(file) {
		// Mock file cleanup
		await new Promise((resolve) => setTimeout(resolve, 10));

		file.deleted = true;
		file.deletedAt = new Date();

		this.emit('tempFileDeleted', {
			filePath: file.path,
			fileSize: file.size,
			sessionId: this.currentSession?.id
		});
	}

	// Force stop procedures
	async performForceStop(result) {
		try {
			// Force terminate all processes
			if (this.currentSession?.processes) {
				for (const process of this.currentSession.processes) {
					if (!process.terminated) {
						process.forceTerminated = true;
						process.terminatedAt = new Date();
					}
				}
				result.processesTerminated = this.currentSession.processes.length;
			}

			// Force cleanup all resources
			if (this.currentSession?.resources) {
				for (const resource of this.currentSession.resources) {
					resource.forceCleanedUp = true;
					resource.cleanedUpAt = new Date();
				}
				result.resourcesReleased = this.currentSession.resources.length;
			}

			result.warnings.push(
				'Force stop performed - some operations may not have completed gracefully'
			);

			this.emit('forceStopCompleted', {
				sessionId: this.currentSession?.id,
				processesTerminated: result.processesTerminated,
				resourcesReleased: result.resourcesReleased
			});
		} catch (error) {
			result.errors.push(`Force stop failed: ${error.message}`);
			throw error;
		}
	}

	// Notification system
	async sendNotifications(result) {
		const notifications = [];

		// Session stop notification
		notifications.push({
			type: 'session_stopped',
			sessionId: this.currentSession?.id,
			timestamp: new Date(),
			graceful: result.graceful,
			summary: {
				processesTerminated: result.processesTerminated,
				resourcesReleased: result.resourcesReleased,
				filesCleanedUp: result.filesCleanedUp
			}
		});

		// Warning notifications
		for (const warning of result.warnings) {
			notifications.push({
				type: 'warning',
				message: warning,
				sessionId: this.currentSession?.id,
				timestamp: new Date()
			});
		}

		result.notifications = notifications;

		this.emit('notificationsSent', {
			count: notifications.length,
			sessionId: this.currentSession?.id
		});
	}

	// Statistics and monitoring
	updateStatistics(success, stopTime) {
		if (success) {
			this.statistics.totalStopTime += stopTime;
			this.statistics.averageStopTime =
				this.statistics.totalStopTime / this.statistics.totalStops;
		}
	}

	getStatistics() {
		return {
			...this.statistics,
			successRate:
				this.statistics.totalStops > 0
					? ((this.statistics.gracefulStops + this.statistics.forcedStops) /
							this.statistics.totalStops) *
						100
					: 0,
			gracefulRate:
				this.statistics.totalStops > 0
					? (this.statistics.gracefulStops / this.statistics.totalStops) * 100
					: 0,
			isActive: this.isActive,
			stopInProgress: this.stopInProgress,
			currentSessionId: this.currentSession?.id
		};
	}

	// Utility methods
	async emergencyStop() {
		if (!this.isActive) {
			throw new Error('Hook not active');
		}

		return await this.execute({
			force: true,
			allowForceStop: true,
			emergency: true
		});
	}

	async gracefulStop() {
		if (!this.isActive) {
			throw new Error('Hook not active');
		}

		return await this.execute({
			force: false,
			allowForceStop: false
		});
	}

	// Cleanup and shutdown
	async cleanup() {
		this.currentSession = null;
		this.stopInProgress = false;
		this.statistics = {
			totalStops: 0,
			gracefulStops: 0,
			forcedStops: 0,
			failedStops: 0,
			averageStopTime: 0,
			totalStopTime: 0
		};
		this.emit('hookCleanedUp');
	}
}

describe('Claude Code Stop Hook', () => {
	let stopHook;

	beforeEach(async () => {
		stopHook = new MockClaudeCodeStopHook();
		await stopHook.activate();
	});

	afterEach(async () => {
		if (stopHook.isActive) {
			await stopHook.deactivate();
		}
		await stopHook.cleanup();
	});

	describe('Hook Activation and Deactivation', () => {
		test('should activate hook successfully', async () => {
			const newHook = new MockClaudeCodeStopHook();

			expect(newHook.isActive).toBe(false);

			await newHook.activate();

			expect(newHook.isActive).toBe(true);

			await newHook.deactivate();
		});

		test('should emit hookActivated event', async () => {
			const eventSpy = jest.fn();
			const newHook = new MockClaudeCodeStopHook();
			newHook.on('hookActivated', eventSpy);

			await newHook.activate();

			expect(eventSpy).toHaveBeenCalled();

			await newHook.deactivate();
		});

		test('should deactivate hook successfully', async () => {
			await stopHook.deactivate();

			expect(stopHook.isActive).toBe(false);
		});

		test('should emit hookDeactivated event', async () => {
			const eventSpy = jest.fn();
			stopHook.on('hookDeactivated', eventSpy);

			await stopHook.deactivate();

			expect(eventSpy).toHaveBeenCalled();
		});

		test('should reject double activation', async () => {
			await expect(stopHook.activate()).rejects.toThrow(
				'Claude Code stop hook already active'
			);
		});

		test('should reject deactivation when not active', async () => {
			const newHook = new MockClaudeCodeStopHook();

			await expect(newHook.deactivate()).rejects.toThrow(
				'Claude Code stop hook not active'
			);
		});
	});

	describe('Session Management', () => {
		test('should set current session', () => {
			const session = {
				id: 'test-session-1',
				status: 'active',
				processes: [{ id: 'proc1', name: 'test-process' }],
				tempFiles: [{ path: '/tmp/test.txt', size: 1024 }]
			};

			const result = stopHook.setCurrentSession(session);

			expect(result.id).toBe('test-session-1');
			expect(result.status).toBe('active');
			expect(result.processes).toHaveLength(1);
			expect(result.tempFiles).toHaveLength(1);
		});

		test('should emit sessionSet event', () => {
			const eventSpy = jest.fn();
			stopHook.on('sessionSet', eventSpy);

			const session = { id: 'event-test-session' };
			stopHook.setCurrentSession(session);

			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: 'event-test-session'
			});
		});

		test('should get current session', () => {
			const session = { id: 'get-test-session' };
			stopHook.setCurrentSession(session);

			const retrieved = stopHook.getCurrentSession();

			expect(retrieved.id).toBe('get-test-session');
		});

		test('should reject invalid session object', () => {
			expect(() => stopHook.setCurrentSession(null)).toThrow(
				'Invalid session object'
			);
			expect(() => stopHook.setCurrentSession('not-object')).toThrow(
				'Invalid session object'
			);
		});
	});

	describe('Stop Hook Execution', () => {
		beforeEach(() => {
			const session = {
				id: 'execution-test-session',
				status: 'active',
				processes: [
					{ id: 'proc1', name: 'worker-process', type: 'worker' },
					{ id: 'proc2', name: 'monitor-process', type: 'monitor' }
				],
				tempFiles: [
					{ path: '/tmp/session.log', size: 2048 },
					{ path: '/tmp/cache.dat', size: 4096 }
				],
				resources: [
					{ id: 'res1', type: 'database', name: 'session-db' },
					{ id: 'res2', type: 'file-handle', name: 'output-file' }
				]
			};
			stopHook.setCurrentSession(session);
		});

		test('should execute stop hook successfully', async () => {
			const result = await stopHook.execute();

			expect(result.graceful).toBe(true);
			expect(result.processesTerminated).toBe(2);
			expect(result.filesCleanedUp).toBe(2);
			expect(result.resourcesReleased).toBe(2);
			expect(result.stateSaved).toBe(true);
		});

		test('should emit stop lifecycle events', async () => {
			const startedSpy = jest.fn();
			const completedSpy = jest.fn();

			stopHook.on('stopStarted', startedSpy);
			stopHook.on('stopCompleted', completedSpy);

			await stopHook.execute();

			expect(startedSpy).toHaveBeenCalledWith({
				sessionId: 'execution-test-session',
				context: {},
				timestamp: expect.any(Date)
			});

			expect(completedSpy).toHaveBeenCalledWith({
				sessionId: 'execution-test-session',
				result: expect.objectContaining({ graceful: true }),
				stopTime: expect.any(Number),
				graceful: true
			});
		});

		test('should reject execution when hook not active', async () => {
			await stopHook.deactivate();

			await expect(stopHook.execute()).rejects.toThrow('Hook not active');
		});

		test('should reject concurrent executions', async () => {
			const execution1 = stopHook.execute();

			await expect(stopHook.execute()).rejects.toThrow(
				'Stop operation already in progress'
			);

			await execution1; // Wait for first execution to complete
		});

		test('should handle execution context', async () => {
			const context = {
				force: true,
				reason: 'user-requested',
				timeout: 5000
			};

			const result = await stopHook.execute(context);

			expect(result.graceful).toBe(true);
		});
	});

	describe('Safety Checks', () => {
		test('should pass safety checks for clean session', async () => {
			const session = {
				id: 'clean-session',
				hasUnsavedWork: false,
				activeOperations: 0,
				processes: [{ id: 'proc1', name: 'safe-process', critical: false }]
			};
			stopHook.setCurrentSession(session);

			const result = await stopHook.execute();

			expect(result.graceful).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});

		test('should handle unsaved work with force flag', async () => {
			const session = {
				id: 'unsaved-work-session',
				hasUnsavedWork: true,
				activeOperations: 0,
				processes: []
			};
			stopHook.setCurrentSession(session);

			const result = await stopHook.execute({ force: true });

			expect(result.graceful).toBe(true);
			expect(result.warnings).toContain(
				'Unsaved work detected but force stop requested'
			);
		});

		test('should reject stop with unsaved work without force', async () => {
			const session = {
				id: 'unsaved-work-session',
				hasUnsavedWork: true
			};
			stopHook.setCurrentSession(session);

			await expect(
				stopHook.execute({ force: false, allowForceStop: false })
			).rejects.toThrow('Cannot stop: unsaved work detected');
		});

		test('should handle active operations with force flag', async () => {
			const session = {
				id: 'active-ops-session',
				activeOperations: 3,
				processes: []
			};
			stopHook.setCurrentSession(session);

			const result = await stopHook.execute({ force: true });

			expect(result.warnings).toContain(
				'3 active operations will be terminated'
			);
		});

		test('should reject stop with active operations without force', async () => {
			const session = {
				id: 'active-ops-session',
				activeOperations: 2
			};
			stopHook.setCurrentSession(session);

			await expect(
				stopHook.execute({ force: false, allowForceStop: false })
			).rejects.toThrow('Cannot stop: 2 active operations in progress');
		});

		test('should handle critical processes with force flag', async () => {
			const session = {
				id: 'critical-process-session',
				processes: [
					{ id: 'proc1', name: 'critical-proc', critical: true },
					{ id: 'proc2', name: 'normal-proc', critical: false }
				]
			};
			stopHook.setCurrentSession(session);

			const result = await stopHook.execute({ force: true });

			expect(result.warnings).toContain(
				'1 critical processes will be terminated'
			);
		});

		test('should emit safetyChecksCompleted event', async () => {
			const eventSpy = jest.fn();
			stopHook.on('safetyChecksCompleted', eventSpy);

			const session = { id: 'safety-check-session', processes: [] };
			stopHook.setCurrentSession(session);

			await stopHook.execute();

			expect(eventSpy).toHaveBeenCalledWith({
				checks: expect.any(Number),
				warnings: expect.any(Number),
				sessionId: 'safety-check-session'
			});
		});
	});

	describe('State Saving', () => {
		test('should save session state when enabled', async () => {
			const eventSpy = jest.fn();
			stopHook.on('stateSaved', eventSpy);

			const session = { id: 'state-save-session' };
			stopHook.setCurrentSession(session);

			const result = await stopHook.execute();

			expect(result.stateSaved).toBe(true);
			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: 'state-save-session',
				stateSize: expect.any(Number)
			});
		});

		test('should skip state saving when disabled', async () => {
			const hookWithoutStateSave = new MockClaudeCodeStopHook({
				saveStateBeforeStop: false
			});
			await hookWithoutStateSave.activate();

			const session = { id: 'no-state-save-session' };
			hookWithoutStateSave.setCurrentSession(session);

			const result = await hookWithoutStateSave.execute();

			expect(result.stateSaved).toBe(false);

			await hookWithoutStateSave.deactivate();
		});

		test('should handle state saving errors gracefully', async () => {
			// Mock a session without required data to trigger state save warning
			const session = null;
			stopHook.currentSession = session;

			const result = await stopHook.execute();

			expect(result.warnings).toContain('No active session to save state for');
		});
	});

	describe('Process Termination', () => {
		test('should terminate all processes successfully', async () => {
			const eventSpy = jest.fn();
			stopHook.on('processesTerminated', eventSpy);

			const session = {
				id: 'process-termination-session',
				processes: [
					{ id: 'proc1', name: 'worker', type: 'worker' },
					{ id: 'proc2', name: 'monitor', type: 'monitor' }
				]
			};
			stopHook.setCurrentSession(session);

			const result = await stopHook.execute();

			expect(result.processesTerminated).toBe(2);
			expect(eventSpy).toHaveBeenCalledWith({
				count: 2,
				sessionId: 'process-termination-session'
			});
		});

		test('should emit processTerminated events for individual processes', async () => {
			const eventSpy = jest.fn();
			stopHook.on('processTerminated', eventSpy);

			const session = {
				id: 'individual-process-session',
				processes: [{ id: 'proc1', name: 'test-process' }]
			};
			stopHook.setCurrentSession(session);

			await stopHook.execute();

			expect(eventSpy).toHaveBeenCalledWith({
				processId: 'proc1',
				processName: 'test-process',
				sessionId: 'individual-process-session'
			});
		});

		test('should handle process termination timeout', async () => {
			const shortTimeoutHook = new MockClaudeCodeStopHook({
				gracefulShutdownTimeout: 1
			});
			await shortTimeoutHook.activate();

			const session = {
				id: 'timeout-session',
				processes: [{ id: 'proc1', name: 'slow-process' }]
			};
			shortTimeoutHook.setCurrentSession(session);

			const result = await shortTimeoutHook.execute({ allowForceStop: true });

			expect(
				result.warnings.some((w) => w.includes('Process termination warning'))
			).toBe(true);

			await shortTimeoutHook.deactivate();
		});
	});

	describe('Resource Cleanup', () => {
		test('should cleanup all resources successfully', async () => {
			const eventSpy = jest.fn();
			stopHook.on('resourcesCleanedUp', eventSpy);

			const session = {
				id: 'resource-cleanup-session',
				resources: [
					{ id: 'res1', type: 'database' },
					{ id: 'res2', type: 'file-handle' }
				]
			};
			stopHook.setCurrentSession(session);

			const result = await stopHook.execute();

			expect(result.resourcesReleased).toBe(2);
			expect(eventSpy).toHaveBeenCalledWith({
				count: 2,
				total: 2,
				sessionId: 'resource-cleanup-session'
			});
		});

		test('should emit resourceCleaned events for individual resources', async () => {
			const eventSpy = jest.fn();
			stopHook.on('resourceCleaned', eventSpy);

			const session = {
				id: 'individual-resource-session',
				resources: [{ id: 'res1', type: 'database' }]
			};
			stopHook.setCurrentSession(session);

			await stopHook.execute();

			expect(eventSpy).toHaveBeenCalledWith({
				resourceId: 'res1',
				resourceType: 'database',
				sessionId: 'individual-resource-session'
			});
		});
	});

	describe('Temporary File Cleanup', () => {
		test('should cleanup temp files when enabled', async () => {
			const eventSpy = jest.fn();
			stopHook.on('tempFilesCleanedUp', eventSpy);

			const session = {
				id: 'temp-cleanup-session',
				tempFiles: [
					{ path: '/tmp/file1.tmp', size: 1024 },
					{ path: '/tmp/file2.tmp', size: 2048 }
				]
			};
			stopHook.setCurrentSession(session);

			const result = await stopHook.execute();

			expect(result.filesCleanedUp).toBe(2);
			expect(eventSpy).toHaveBeenCalledWith({
				count: 2,
				total: 2,
				sessionId: 'temp-cleanup-session'
			});
		});

		test('should skip temp file cleanup when disabled', async () => {
			const hookWithoutTempCleanup = new MockClaudeCodeStopHook({
				cleanupTempFiles: false
			});
			await hookWithoutTempCleanup.activate();

			const session = {
				id: 'no-temp-cleanup-session',
				tempFiles: [{ path: '/tmp/file1.tmp', size: 1024 }]
			};
			hookWithoutTempCleanup.setCurrentSession(session);

			const result = await hookWithoutTempCleanup.execute();

			expect(result.filesCleanedUp).toBe(0);

			await hookWithoutTempCleanup.deactivate();
		});

		test('should emit tempFileDeleted events for individual files', async () => {
			const eventSpy = jest.fn();
			stopHook.on('tempFileDeleted', eventSpy);

			const session = {
				id: 'individual-file-session',
				tempFiles: [{ path: '/tmp/test.tmp', size: 512 }]
			};
			stopHook.setCurrentSession(session);

			await stopHook.execute();

			expect(eventSpy).toHaveBeenCalledWith({
				filePath: '/tmp/test.tmp',
				fileSize: 512,
				sessionId: 'individual-file-session'
			});
		});
	});

	describe('Force Stop Operations', () => {
		test('should perform force stop when graceful stop fails', async () => {
			const eventSpy = jest.fn();
			stopHook.on('forceStopCompleted', eventSpy);

			// Create a session that will cause graceful stop to fail
			const problematicSession = {
				id: 'problematic-session',
				hasUnsavedWork: true, // This will cause failure without force
				processes: [{ id: 'proc1', name: 'stuck-process' }],
				resources: [{ id: 'res1', type: 'locked-resource' }]
			};
			stopHook.setCurrentSession(problematicSession);

			const result = await stopHook.execute({ allowForceStop: true });

			expect(result.warnings).toContain(
				'Force stop performed - some operations may not have completed gracefully'
			);
			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: 'problematic-session',
				processesTerminated: 1,
				resourcesReleased: 1
			});
		});

		test('should track forced stops in statistics', async () => {
			const problematicSession = {
				id: 'force-stats-session',
				hasUnsavedWork: true
			};
			stopHook.setCurrentSession(problematicSession);

			await stopHook.execute({ allowForceStop: true });

			const stats = stopHook.getStatistics();

			expect(stats.forcedStops).toBe(1);
			expect(stats.gracefulStops).toBe(0);
		});
	});

	describe('Notification System', () => {
		test('should send notifications when enabled', async () => {
			const hookWithNotifications = new MockClaudeCodeStopHook({
				notifyOnStop: true
			});
			await hookWithNotifications.activate();

			const eventSpy = jest.fn();
			hookWithNotifications.on('notificationsSent', eventSpy);

			const session = { id: 'notification-session' };
			hookWithNotifications.setCurrentSession(session);

			const result = await hookWithNotifications.execute();

			expect(result.notifications).toHaveLength(1);
			expect(result.notifications[0].type).toBe('session_stopped');
			expect(eventSpy).toHaveBeenCalledWith({
				count: 1,
				sessionId: 'notification-session'
			});

			await hookWithNotifications.deactivate();
		});

		test('should include warning notifications', async () => {
			const hookWithNotifications = new MockClaudeCodeStopHook({
				notifyOnStop: true
			});
			await hookWithNotifications.activate();

			const session = {
				id: 'warning-notification-session',
				hasUnsavedWork: true
			};
			hookWithNotifications.setCurrentSession(session);

			const result = await hookWithNotifications.execute({ force: true });

			const warningNotifications = result.notifications.filter(
				(n) => n.type === 'warning'
			);
			expect(warningNotifications.length).toBeGreaterThan(0);

			await hookWithNotifications.deactivate();
		});
	});

	describe('Utility Methods', () => {
		test('should perform emergency stop', async () => {
			const session = {
				id: 'emergency-session',
				hasUnsavedWork: true,
				activeOperations: 5,
				processes: [{ id: 'proc1', name: 'critical-proc', critical: true }]
			};
			stopHook.setCurrentSession(session);

			const result = await stopHook.emergencyStop();

			expect(result.graceful).toBe(true); // Should succeed with force
			expect(result.warnings.length).toBeGreaterThan(0);
		});

		test('should perform graceful stop', async () => {
			const session = {
				id: 'graceful-session',
				hasUnsavedWork: false,
				activeOperations: 0,
				processes: []
			};
			stopHook.setCurrentSession(session);

			const result = await stopHook.gracefulStop();

			expect(result.graceful).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});

		test('should reject graceful stop with unsafe conditions', async () => {
			const session = {
				id: 'unsafe-graceful-session',
				hasUnsavedWork: true
			};
			stopHook.setCurrentSession(session);

			await expect(stopHook.gracefulStop()).rejects.toThrow(
				'Cannot stop: unsaved work detected'
			);
		});
	});

	describe('Statistics and Monitoring', () => {
		test('should track stop statistics', async () => {
			const session = { id: 'stats-session', processes: [] };
			stopHook.setCurrentSession(session);

			await stopHook.execute();
			await stopHook.execute();

			const stats = stopHook.getStatistics();

			expect(stats.totalStops).toBe(2);
			expect(stats.gracefulStops).toBe(2);
			expect(stats.successRate).toBe(100);
			expect(stats.gracefulRate).toBe(100);
			expect(stats.averageStopTime).toBeGreaterThan(0);
		});

		test('should track failed stops', async () => {
			const session = {
				id: 'failed-stats-session',
				hasUnsavedWork: true
			};
			stopHook.setCurrentSession(session);

			try {
				await stopHook.execute({ force: false, allowForceStop: false });
			} catch (error) {
				// Expected to fail
			}

			const stats = stopHook.getStatistics();

			expect(stats.totalStops).toBe(1);
			expect(stats.failedStops).toBe(1);
			expect(stats.successRate).toBe(0);
		});

		test('should provide comprehensive status information', () => {
			const session = { id: 'status-session' };
			stopHook.setCurrentSession(session);

			const stats = stopHook.getStatistics();

			expect(stats.isActive).toBe(true);
			expect(stats.stopInProgress).toBe(false);
			expect(stats.currentSessionId).toBe('status-session');
		});
	});

	describe('Performance Benchmarks', () => {
		test('should complete stop operations within time limits', async () => {
			const session = {
				id: 'performance-session',
				processes: Array.from({ length: 10 }, (_, i) => ({
					id: `proc-${i}`,
					name: `process-${i}`
				})),
				resources: Array.from({ length: 5 }, (_, i) => ({
					id: `res-${i}`,
					type: 'resource'
				})),
				tempFiles: Array.from({ length: 20 }, (_, i) => ({
					path: `/tmp/file-${i}.tmp`,
					size: 1024
				}))
			};
			stopHook.setCurrentSession(session);

			const startTime = Date.now();
			await stopHook.execute();
			const stopTime = Date.now() - startTime;

			expect(stopTime).toBeLessThan(1000); // Should complete within 1 second
		});

		test('should handle multiple concurrent stop attempts gracefully', async () => {
			const session = { id: 'concurrent-session', processes: [] };
			stopHook.setCurrentSession(session);

			const attempts = [];
			for (let i = 0; i < 5; i++) {
				attempts.push(stopHook.execute().catch((error) => error.message));
			}

			const results = await Promise.all(attempts);

			// First should succeed, others should fail with "already in progress"
			const successes = results.filter(
				(r) => typeof r === 'object' && r.graceful
			);
			const failures = results.filter(
				(r) => typeof r === 'string' && r.includes('already in progress')
			);

			expect(successes).toHaveLength(1);
			expect(failures).toHaveLength(4);
		});
	});

	describe('Cleanup and Error Handling', () => {
		test('should cleanup hook state', async () => {
			const session = { id: 'cleanup-session' };
			stopHook.setCurrentSession(session);

			expect(stopHook.currentSession).not.toBeNull();

			await stopHook.cleanup();

			expect(stopHook.currentSession).toBeNull();
			expect(stopHook.stopInProgress).toBe(false);
			expect(stopHook.getStatistics().totalStops).toBe(0);
		});

		test('should emit hookCleanedUp event', async () => {
			const eventSpy = jest.fn();
			stopHook.on('hookCleanedUp', eventSpy);

			await stopHook.cleanup();

			expect(eventSpy).toHaveBeenCalled();
		});

		test('should handle errors gracefully and emit events', async () => {
			const failedSpy = jest.fn();
			stopHook.on('stopFailed', failedSpy);

			const session = {
				id: 'error-session',
				hasUnsavedWork: true
			};
			stopHook.setCurrentSession(session);

			try {
				await stopHook.execute({ force: false, allowForceStop: false });
			} catch (error) {
				// Expected to fail
			}

			expect(failedSpy).toHaveBeenCalledWith({
				sessionId: 'error-session',
				error: 'Cannot stop: unsaved work detected',
				stopTime: expect.any(Number)
			});
		});
	});
});
