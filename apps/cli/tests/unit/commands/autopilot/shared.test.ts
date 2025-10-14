/**
 * @fileoverview Unit tests for autopilot shared utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	validateTaskId,
	parseSubtasks,
	OutputFormatter
} from '../../../../src/commands/autopilot/shared.js';

// Mock fs-extra
vi.mock('fs-extra', () => ({
	default: {
		pathExists: vi.fn(),
		readJSON: vi.fn(),
		writeJSON: vi.fn(),
		ensureDir: vi.fn(),
		remove: vi.fn()
	},
	pathExists: vi.fn(),
	readJSON: vi.fn(),
	writeJSON: vi.fn(),
	ensureDir: vi.fn(),
	remove: vi.fn()
}));

describe('Autopilot Shared Utilities', () => {
	const projectRoot = '/test/project';
	const statePath = `${projectRoot}/.taskmaster/workflow-state.json`;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('validateTaskId', () => {
		it('should validate simple task IDs', () => {
			expect(validateTaskId('1')).toBe(true);
			expect(validateTaskId('10')).toBe(true);
			expect(validateTaskId('999')).toBe(true);
		});

		it('should validate subtask IDs', () => {
			expect(validateTaskId('1.1')).toBe(true);
			expect(validateTaskId('1.2')).toBe(true);
			expect(validateTaskId('10.5')).toBe(true);
		});

		it('should validate nested subtask IDs', () => {
			expect(validateTaskId('1.1.1')).toBe(true);
			expect(validateTaskId('1.2.3')).toBe(true);
		});

		it('should reject invalid formats', () => {
			expect(validateTaskId('')).toBe(false);
			expect(validateTaskId('abc')).toBe(false);
			expect(validateTaskId('1.')).toBe(false);
			expect(validateTaskId('.1')).toBe(false);
			expect(validateTaskId('1..2')).toBe(false);
			expect(validateTaskId('1.2.3.')).toBe(false);
		});
	});

	describe('parseSubtasks', () => {
		it('should parse subtasks from task data', () => {
			const task = {
				id: '1',
				title: 'Test Task',
				subtasks: [
					{ id: '1', title: 'Subtask 1', status: 'pending' },
					{ id: '2', title: 'Subtask 2', status: 'done' },
					{ id: '3', title: 'Subtask 3', status: 'in-progress' }
				]
			};

			const result = parseSubtasks(task, 5);

			expect(result).toHaveLength(3);
			expect(result[0]).toEqual({
				id: '1',
				title: 'Subtask 1',
				status: 'pending',
				attempts: 0,
				maxAttempts: 5
			});
			expect(result[1]).toEqual({
				id: '2',
				title: 'Subtask 2',
				status: 'completed',
				attempts: 0,
				maxAttempts: 5
			});
		});

		it('should return empty array for missing subtasks', () => {
			const task = { id: '1', title: 'Test Task' };
			expect(parseSubtasks(task)).toEqual([]);
		});

		it('should use default maxAttempts', () => {
			const task = {
				subtasks: [{ id: '1', title: 'Subtask 1', status: 'pending' }]
			};

			const result = parseSubtasks(task);
			expect(result[0].maxAttempts).toBe(3);
		});
	});

	// State persistence tests omitted - covered in integration tests

	describe('OutputFormatter', () => {
		let consoleLogSpy: any;
		let consoleErrorSpy: any;

		beforeEach(() => {
			consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		});

		afterEach(() => {
			consoleLogSpy.mockRestore();
			consoleErrorSpy.mockRestore();
		});

		describe('JSON mode', () => {
			it('should output JSON for success', () => {
				const formatter = new OutputFormatter(true);
				formatter.success('Test message', { key: 'value' });

				expect(consoleLogSpy).toHaveBeenCalled();
				const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
				expect(output.success).toBe(true);
				expect(output.message).toBe('Test message');
				expect(output.key).toBe('value');
			});

			it('should output JSON for error', () => {
				const formatter = new OutputFormatter(true);
				formatter.error('Error message', { code: 'ERR001' });

				expect(consoleErrorSpy).toHaveBeenCalled();
				const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
				expect(output.error).toBe('Error message');
				expect(output.code).toBe('ERR001');
			});

			it('should output JSON for data', () => {
				const formatter = new OutputFormatter(true);
				formatter.output({ test: 'data' });

				expect(consoleLogSpy).toHaveBeenCalled();
				const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
				expect(output.test).toBe('data');
			});
		});

		describe('Text mode', () => {
			it('should output formatted text for success', () => {
				const formatter = new OutputFormatter(false);
				formatter.success('Test message');

				expect(consoleLogSpy).toHaveBeenCalledWith(
					expect.stringContaining('✓ Test message')
				);
			});

			it('should output formatted text for error', () => {
				const formatter = new OutputFormatter(false);
				formatter.error('Error message');

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					expect.stringContaining('Error: Error message')
				);
			});

			it('should output formatted text for warning', () => {
				const consoleWarnSpy = vi
					.spyOn(console, 'warn')
					.mockImplementation(() => {});
				const formatter = new OutputFormatter(false);
				formatter.warning('Warning message');

				expect(consoleWarnSpy).toHaveBeenCalledWith(
					expect.stringContaining('⚠ Warning message')
				);
				consoleWarnSpy.mockRestore();
			});

			it('should not output info in JSON mode', () => {
				const formatter = new OutputFormatter(true);
				formatter.info('Info message');

				expect(consoleLogSpy).not.toHaveBeenCalled();
			});
		});
	});
});
