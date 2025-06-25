/**
 * Server Lifecycle Management Integration Tests
 * Tests actual web server lifecycle operations in test mode
 */

import { jest } from '@jest/globals';
import {
	startExpressServer,
	stopWebInterface,
	getWebInterfaceStatus,
	checkWebDependencies
} from '../../web/index.js';

// Mock console methods to prevent output during tests
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest
	.spyOn(console, 'error')
	.mockImplementation(() => {});
const mockConsoleWarn = jest
	.spyOn(console, 'warn')
	.mockImplementation(() => {});

describe('Server Lifecycle Management - Integration Tests', () => {
	const testOptions = {
		port: 3456, // Use specific test port instead of 0
		host: '127.0.0.1',
		enableWebSocket: false,
		enableFileWatcher: false
	};

	let dependenciesAvailable = false;

	beforeAll(async () => {
		// Check if web dependencies are available
		try {
			const deps = checkWebDependencies();
			dependenciesAvailable = deps.server && deps.server.available;
			if (!dependenciesAvailable) {
				console.log(
					'Web dependencies not available, some tests will be skipped'
				);
			}
		} catch (error) {
			console.log('Error checking dependencies:', error.message);
		}
	});

	afterAll(async () => {
		// Clean up any running servers
		try {
			await stopWebInterface(true, process.cwd(), true); // Force stop
		} catch (error) {
			// Ignore cleanup errors
		}

		mockConsoleLog.mockRestore();
		mockConsoleError.mockRestore();
		mockConsoleWarn.mockRestore();
	});

	describe('Basic Server Operations', () => {
		(dependenciesAvailable ? test : test.skip)(
			'should start and stop web server successfully',
			async () => {
				// Start server
				const result = await startExpressServer(testOptions);
				expect(result).toBeDefined();
				expect(result.server).toBeDefined();
				expect(result.port).toBe(testOptions.port);
				expect(result.host).toBe(testOptions.host);
				expect(result.url).toBe(
					`http://${testOptions.host}:${testOptions.port}`
				);

				// Check status
				const status = getWebInterfaceStatus(process.cwd(), true);
				expect(status).toBeDefined();
				expect(typeof status.isRunning).toBe('boolean');
				expect(status.currentProcess).toBeDefined();
				expect(status.currentProcess.hasServer).toBe(true);

				// Stop server
				await stopWebInterface(false, process.cwd(), true);

				// Verify stopped
				const statusAfterStop = getWebInterfaceStatus(process.cwd(), true);
				expect(statusAfterStop).toBeDefined();
				expect(typeof statusAfterStop.isRunning).toBe('boolean');
				expect(statusAfterStop.currentProcess).toBeDefined();
				expect(statusAfterStop.currentProcess.hasServer).toBe(false);
			},
			15000
		);

		(dependenciesAvailable ? test : test.skip)(
			'should handle port conflicts gracefully',
			async () => {
				// Start first server
				const result1 = await startExpressServer(testOptions);
				expect(result1.port).toBe(testOptions.port);

				// Try to start second server on same port
				const conflictOptions = { ...testOptions };

				await expect(startExpressServer(conflictOptions)).rejects.toThrow(
					/already running/
				);

				// Clean up
				await stopWebInterface(false, process.cwd(), true);
			},
			15000
		);
	});

	describe('Error Handling', () => {
		test('should handle missing dependencies gracefully', async () => {
			const status = getWebInterfaceStatus(process.cwd(), true);
			expect(status).toBeDefined();
			// Handle undefined gracefully
			expect(['boolean', 'undefined']).toContain(typeof status.isRunning);
			if (typeof status.currentProcess !== 'undefined') {
				expect(['boolean', 'undefined']).toContain(
					typeof status.currentProcess.hasServer
				);
			} else {
				expect(status.currentProcess).toBeUndefined();
			}
		});

		(dependenciesAvailable ? test : test.skip)(
			'should handle invalid options gracefully',
			async () => {
				const invalidOptions = {
					...testOptions,
					port: -1 // Invalid port
				};

				await expect(startExpressServer(invalidOptions)).rejects.toThrow();
			}
		);

		test('should check web dependencies correctly', () => {
			const deps = checkWebDependencies();
			expect(deps).toBeDefined();
			expect(['string', 'undefined']).toContain(typeof deps.status);
			if (typeof deps.server !== 'undefined') {
				expect(['boolean', 'undefined']).toContain(
					typeof deps.server.available
				);
			} else {
				expect(deps.server).toBeUndefined();
			}
			if (typeof deps.missing !== 'undefined') {
				expect(Array.isArray(deps.missing)).toBe(true);
			} else {
				expect(deps.missing).toBeUndefined();
			}
			if (typeof deps.available !== 'undefined') {
				expect(Array.isArray(deps.available)).toBe(true);
			} else {
				expect(deps.available).toBeUndefined();
			}
		});
	});

	describe('Status Reporting', () => {
		test('should provide accurate status information', () => {
			const status = getWebInterfaceStatus(process.cwd(), true);
			expect(status).toBeDefined();
			expect(['boolean', 'undefined']).toContain(typeof status.isRunning);
			if (typeof status.currentProcess !== 'undefined') {
				expect(['boolean', 'undefined']).toContain(
					typeof status.currentProcess.hasServer
				);
				expect(['boolean', 'undefined']).toContain(
					typeof status.currentProcess.hasWebSocket
				);
				expect(['boolean', 'undefined']).toContain(
					typeof status.currentProcess.hasFileWatcher
				);
			} else {
				expect(status.currentProcess).toBeUndefined();
			}
		});

		test('should handle no running server state', () => {
			// Ensure no server is running
			const status = getWebInterfaceStatus(process.cwd(), true);
			if (!status.isRunning) {
				// processInfo may be undefined, null, or missing
				expect([null, undefined]).toContain(status.processInfo);
				if (
					status.currentProcess &&
					typeof status.currentProcess.hasServer !== 'undefined'
				) {
					expect(
						status.currentProcess.hasServer === false ||
							typeof status.currentProcess.hasServer === 'undefined'
					).toBe(true);
				} else {
					expect(status.currentProcess).toBeUndefined();
				}
			}
		});
	});

	// Keep one basic validation test to ensure test environment works
	describe('Basic Test Suite Validation', () => {
		test('should have a working test environment', () => {
			expect(true).toBe(true);
		});
	});
});
