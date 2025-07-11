/**
 * Jest setup file for E2E tests
 * Runs before each test file
 */

import { jest, expect, afterAll } from '@jest/globals';
import { TestHelpers } from '../utils/test-helpers.js';
import { TestLogger } from '../utils/logger.js';

// Increase timeout for all E2E tests (can be overridden per test)
jest.setTimeout(180000);

// Add custom matchers for CLI testing
expect.extend({
	toContainTaskId(received) {
		const taskIdRegex = /#?\d+/;
		const pass = taskIdRegex.test(received);

		if (pass) {
			return {
				message: () => `expected ${received} not to contain a task ID`,
				pass: true
			};
		} else {
			return {
				message: () => `expected ${received} to contain a task ID (e.g., #123)`,
				pass: false
			};
		}
	},

	toHaveExitCode(received, expected) {
		const pass = received.exitCode === expected;

		if (pass) {
			return {
				message: () => `expected exit code not to be ${expected}`,
				pass: true
			};
		} else {
			return {
				message: () =>
					`expected exit code ${expected} but got ${received.exitCode}\nstderr: ${received.stderr}`,
				pass: false
			};
		}
	},

	toContainInOutput(received, expected) {
		const output = (received.stdout || '') + (received.stderr || '');
		const pass = output.includes(expected);

		if (pass) {
			return {
				message: () => `expected output not to contain "${expected}"`,
				pass: true
			};
		} else {
			return {
				message: () =>
					`expected output to contain "${expected}"\nstdout: ${received.stdout}\nstderr: ${received.stderr}`,
				pass: false
			};
		}
	}
});

// Global test helpers
global.TestHelpers = TestHelpers;
global.TestLogger = TestLogger;

// Helper to create test context
global.createTestContext = (testName) => {
	const logger = new TestLogger(testName);
	const helpers = new TestHelpers(logger);
	return { logger, helpers };
};

// Clean up any hanging processes
afterAll(async () => {
	// Give time for any async operations to complete
	await new Promise((resolve) => setTimeout(resolve, 100));
});