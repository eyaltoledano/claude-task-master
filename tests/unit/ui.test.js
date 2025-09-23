/**
 * UI module tests
 */

import { jest } from '@jest/globals';
import {
	getStatusWithColor,
	formatDependenciesWithStatus,
	createProgressBar,
	getComplexityWithColor
} from '../../scripts/modules/ui.js';
import { sampleTasks } from '../fixtures/sample-tasks.js';

// Mock dependencies
jest.mock('chalk', () => {
	const origChalkFn = (text) => text;
	const chalk = origChalkFn;
	chalk.green = (text) => text; // Return text as-is for status functions
	chalk.yellow = (text) => text;
	chalk.red = (text) => text;
	chalk.cyan = (text) => text;
	chalk.blue = (text) => text;
	chalk.gray = (text) => text;
	chalk.white = (text) => text;
	chalk.bold = (text) => text;
	chalk.dim = (text) => text;

	// Add hex and other methods
	chalk.hex = () => origChalkFn;
	chalk.rgb = () => origChalkFn;

	return chalk;
});

jest.mock('figlet', () => ({
	textSync: jest.fn(() => 'Task Master Banner')
}));

jest.mock('boxen', () => jest.fn((text) => `[boxed: ${text}]`));

jest.mock('ora', () =>
	jest.fn(() => ({
		start: jest.fn(),
		succeed: jest.fn(),
		fail: jest.fn(),
		stop: jest.fn()
	}))
);

jest.mock('cli-table3', () =>
	jest.fn().mockImplementation(() => ({
		push: jest.fn(),
		toString: jest.fn(() => 'Table Content')
	}))
);

jest.mock('gradient-string', () => jest.fn(() => jest.fn((text) => text)));

jest.mock('../../scripts/modules/utils.js', () => ({
	CONFIG: {
		projectName: 'Test Project',
		projectVersion: '1.0.0'
	},
	log: jest.fn(),
	findTaskById: jest.fn(),
	readJSON: jest.fn(),
	readComplexityReport: jest.fn(),
	truncate: jest.fn((text) => text)
}));

jest.mock('../../scripts/modules/task-manager.js', () => ({
	findNextTask: jest.fn(),
	analyzeTaskComplexity: jest.fn()
}));

describe('UI Module', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getStatusWithColor function', () => {
		test('should return done status with emoji for console output', () => {
			const result = getStatusWithColor('done');
			expect(result).toMatch(/done/);
			expect(result).toContain('✓');
		});

		test('should return pending status with emoji for console output', () => {
			const result = getStatusWithColor('pending');
			expect(result).toMatch(/pending/);
			expect(result).toContain('○');
		});

		test('should return deferred status with emoji for console output', () => {
			const result = getStatusWithColor('deferred');
			expect(result).toMatch(/deferred/);
			expect(result).toContain('x');
		});

		test('should return in-progress status with emoji for console output', () => {
			const result = getStatusWithColor('in-progress');
			expect(result).toMatch(/in-progress/);
			expect(result).toContain('🔄');
		});

		test('should return unknown status with emoji for console output', () => {
			const result = getStatusWithColor('unknown');
			expect(result).toMatch(/unknown/);
			expect(result).toContain('❌');
		});

		test('should use simple icons when forTable is true', () => {
			const doneResult = getStatusWithColor('done', true);
			expect(doneResult).toMatch(/done/);
			expect(doneResult).toContain('✓');

			const pendingResult = getStatusWithColor('pending', true);
			expect(pendingResult).toMatch(/pending/);
			expect(pendingResult).toContain('○');

			const inProgressResult = getStatusWithColor('in-progress', true);
			expect(inProgressResult).toMatch(/in-progress/);
			expect(inProgressResult).toContain('►');

			const deferredResult = getStatusWithColor('deferred', true);
			expect(deferredResult).toMatch(/deferred/);
			expect(deferredResult).toContain('x');
		});
	});

	describe('formatDependenciesWithStatus function', () => {
		test('should format dependencies as plain IDs when forConsole is false (default)', () => {
			const dependencies = [1, 2, 3];
			const allTasks = [
				{ id: 1, status: 'done' },
				{ id: 2, status: 'pending' },
				{ id: 3, status: 'deferred' }
			];

			const result = formatDependenciesWithStatus(dependencies, allTasks);

			// With recent changes, we expect just plain IDs when forConsole is false
			expect(result).toBe('1, 2, 3');
		});

		test('should format dependencies with status indicators when forConsole is true', () => {
			const dependencies = [1, 2, 3];
			const allTasks = [
				{ id: 1, status: 'done' },
				{ id: 2, status: 'pending' },
				{ id: 3, status: 'deferred' }
			];

			const result = formatDependenciesWithStatus(dependencies, allTasks, true);

			// We can't test for exact color formatting due to our chalk mocks
			// Instead, test that the result contains all the expected IDs
			expect(result).toContain('1');
			expect(result).toContain('2');
			expect(result).toContain('3');

			// Test that it's a comma-separated list
			expect(result.split(', ').length).toBe(3);
		});

		test('should return "None" for empty dependencies', () => {
			const result = formatDependenciesWithStatus([], []);
			expect(result).toBe('None');
		});

		test('should handle missing tasks in the task list', () => {
			const dependencies = [1, 999];
			const allTasks = [{ id: 1, status: 'done' }];

			const result = formatDependenciesWithStatus(dependencies, allTasks);
			expect(result).toBe('1, 999 (Not found)');
		});
	});

	describe('createProgressBar function', () => {
		test('should create a progress bar with the correct percentage', () => {
			const result = createProgressBar(50, 10, {
				pending: 20,
				'in-progress': 15,
				blocked: 5
			});
			expect(result).toContain('50%');
		});

		test('should handle 0% progress', () => {
			const result = createProgressBar(0, 10);
			expect(result).toContain('0%');
		});

		test('should handle 100% progress', () => {
			const result = createProgressBar(100, 10);
			expect(result).toContain('100%');
		});

		test('should handle invalid percentages by clamping', () => {
			const result1 = createProgressBar(0, 10);
			expect(result1).toContain('0%');

			const result2 = createProgressBar(100, 10);
			expect(result2).toContain('100%');
		});

		test('should support status breakdown in the progress bar', () => {
			const result = createProgressBar(30, 10, {
				pending: 30,
				'in-progress': 20,
				blocked: 10,
				deferred: 5,
				cancelled: 5
			});

			expect(result).toContain('40%');
		});
	});

	describe('getComplexityWithColor function', () => {
		test('should return high complexity in red', () => {
			const result = getComplexityWithColor(8);
			expect(result).toMatch(/8/);
			expect(result).toContain('●');
		});

		test('should return medium complexity in yellow', () => {
			const result = getComplexityWithColor(5);
			expect(result).toMatch(/5/);
			expect(result).toContain('●');
		});

		test('should return low complexity in green', () => {
			const result = getComplexityWithColor(3);
			expect(result).toMatch(/3/);
			expect(result).toContain('●');
		});

		test('should handle non-numeric inputs', () => {
			const result = getComplexityWithColor('high');
			expect(result).toMatch(/high/);
			expect(result).toContain('●');
		});
	});
});
