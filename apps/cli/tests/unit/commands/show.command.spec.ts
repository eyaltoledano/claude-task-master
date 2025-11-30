/**
 * @fileoverview Unit tests for ShowCommand
 */

import type { TmCore } from '@tm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@tm/core', () => ({
	createTmCore: vi.fn()
}));

vi.mock('../../../src/utils/project-root.js', () => ({
	getProjectRoot: vi.fn((path?: string) => path || '/test/project')
}));

vi.mock('../../../src/utils/error-handler.js', () => ({
	displayError: vi.fn()
}));

vi.mock('../../../src/utils/display-helpers.js', () => ({
	displayCommandHeader: vi.fn()
}));

vi.mock('../../../src/ui/components/task-detail.component.js', () => ({
	displayTaskDetails: vi.fn()
}));

vi.mock('../../../src/utils/ui.js', () => ({
	createTaskTable: vi.fn(() => 'Table output'),
	displayWarning: vi.fn()
}));

import { ShowCommand } from '../../../src/commands/show.command.js';

describe('ShowCommand', () => {
	let consoleLogSpy: any;
	let mockTmCore: Partial<TmCore>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		mockTmCore = {
			tasks: {
				get: vi.fn().mockResolvedValue({
					task: {
						id: '1',
						title: 'Test Task',
						status: 'pending',
						description: 'Test description'
					},
					isSubtask: false
				}),
				getStorageType: vi.fn().mockReturnValue('json')
			} as any,
			config: {
				getActiveTag: vi.fn().mockReturnValue('master')
			} as any
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
		consoleLogSpy.mockRestore();
	});

	describe('JSON output format', () => {
		it('should use JSON format when --json flag is set', async () => {
			const command = new ShowCommand();

			// Mock the tmCore initialization
			(command as any).tmCore = mockTmCore;

			// Execute with --json flag
			await (command as any).executeCommand('1', {
				id: '1',
				json: true,
				format: 'text' // Should be overridden by --json
			});

			// Verify JSON output was called
			expect(consoleLogSpy).toHaveBeenCalled();
			const output = consoleLogSpy.mock.calls[0][0];

			// Should be valid JSON
			expect(() => JSON.parse(output)).not.toThrow();

			const parsed = JSON.parse(output);
			expect(parsed).toHaveProperty('task');
			expect(parsed).toHaveProperty('found');
			expect(parsed).toHaveProperty('storageType');
		});

		it('should override --format when --json is set', async () => {
			const command = new ShowCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeCommand('1', {
				id: '1',
				json: true,
				format: 'text' // Should be overridden
			});

			// Should output JSON, not text format
			const output = consoleLogSpy.mock.calls[0][0];
			expect(() => JSON.parse(output)).not.toThrow();
		});

		it('should use text format when --json is not set', async () => {
			const command = new ShowCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeCommand('1', {
				id: '1',
				format: 'text'
			});

			// Should use text format (not JSON)
			// Text format will call displayCommandHeader and displayTaskDetails
			// We just verify it was called (mocked functions)
			expect(consoleLogSpy).toHaveBeenCalled();
		});

		it('should default to text format when neither flag is set', async () => {
			const command = new ShowCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeCommand('1', {
				id: '1'
			});

			// Should use text format by default
			expect(consoleLogSpy).toHaveBeenCalled();
		});
	});

	describe('format validation', () => {
		it('should accept valid formats', () => {
			const command = new ShowCommand();

			expect((command as any).validateOptions({ format: 'text' })).toBe(true);
			expect((command as any).validateOptions({ format: 'json' })).toBe(true);
		});

		it('should reject invalid formats', () => {
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			const command = new ShowCommand();

			expect((command as any).validateOptions({ format: 'invalid' })).toBe(
				false
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Invalid format: invalid')
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe('multiple task IDs', () => {
		it('should handle comma-separated task IDs', async () => {
			const command = new ShowCommand();
			(command as any).tmCore = mockTmCore;

			// Mock getMultipleTasks
			const getMultipleTasksSpy = vi
				.spyOn(command as any, 'getMultipleTasks')
				.mockResolvedValue({
					tasks: [
						{ id: '1', title: 'Task 1' },
						{ id: '2', title: 'Task 2' }
					],
					notFound: [],
					storageType: 'json'
				});

			await (command as any).executeCommand('1,2', {
				id: '1,2',
				json: true
			});

			expect(getMultipleTasksSpy).toHaveBeenCalledWith(
				['1', '2'],
				expect.any(Object)
			);
		});
	});
});
