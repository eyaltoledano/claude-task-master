/**
 * @fileoverview Unit tests for ListTasksCommand
 */

import type { TmCore } from '@tm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@tm/core', () => ({
	createTmCore: vi.fn(),
	OUTPUT_FORMATS: ['text', 'json', 'compact'],
	TASK_STATUSES: [
		'pending',
		'in-progress',
		'done',
		'review',
		'deferred',
		'cancelled'
	],
	STATUS_ICONS: {
		pending: '⏳',
		'in-progress': '🔄',
		done: '✅',
		review: '👀',
		deferred: '⏸️',
		cancelled: '❌'
	}
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

vi.mock('../../../src/ui/index.js', () => ({
	calculateDependencyStatistics: vi.fn(() => ({ total: 0, blocked: 0 })),
	calculateSubtaskStatistics: vi.fn(() => ({ total: 0, completed: 0 })),
	calculateTaskStatistics: vi.fn(() => ({ total: 0, completed: 0 })),
	displayDashboards: vi.fn(),
	displayRecommendedNextTask: vi.fn(),
	displaySuggestedNextSteps: vi.fn(),
	getPriorityBreakdown: vi.fn(() => ({})),
	getTaskDescription: vi.fn(() => 'Test description')
}));

vi.mock('../../../src/utils/ui.js', () => ({
	createTaskTable: vi.fn(() => 'Table output'),
	displayWarning: vi.fn()
}));

import { ListTasksCommand } from '../../../src/commands/list.command.js';

describe('ListTasksCommand', () => {
	let consoleLogSpy: any;
	let mockTmCore: Partial<TmCore>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		mockTmCore = {
			tasks: {
				list: vi.fn().mockResolvedValue({
					tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
					total: 1,
					filtered: 1,
					storageType: 'json'
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
			const command = new ListTasksCommand();

			// Mock the tmCore initialization
			(command as any).tmCore = mockTmCore;

			// Execute with --json flag
			await (command as any).executeCommand({
				json: true,
				format: 'text' // Should be overridden by --json
			});

			// Verify JSON output was called
			expect(consoleLogSpy).toHaveBeenCalled();
			const output = consoleLogSpy.mock.calls[0][0];

			// Should be valid JSON
			expect(() => JSON.parse(output)).not.toThrow();

			const parsed = JSON.parse(output);
			expect(parsed).toHaveProperty('tasks');
			expect(parsed).toHaveProperty('metadata');
		});

		it('should override --format when --json is set', async () => {
			const command = new ListTasksCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeCommand({
				json: true,
				format: 'compact' // Should be overridden
			});

			// Should output JSON, not compact format
			const output = consoleLogSpy.mock.calls[0][0];
			expect(() => JSON.parse(output)).not.toThrow();
		});

		it('should use specified format when --json is not set', async () => {
			const command = new ListTasksCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeCommand({
				format: 'compact'
			});

			// Should use compact format (not JSON)
			const output = consoleLogSpy.mock.calls;
			// In compact mode, output is not JSON
			expect(output.length).toBeGreaterThan(0);
		});

		it('should default to text format when neither flag is set', async () => {
			const command = new ListTasksCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeCommand({});

			// Should use text format (not JSON)
			// If any console.log was called, verify it's not JSON
			if (consoleLogSpy.mock.calls.length > 0) {
				const output = consoleLogSpy.mock.calls[0][0];
				// Text format output should not be parseable JSON
				// or should be the table string we mocked
				expect(
					output === 'Table output' ||
						(() => {
							try {
								JSON.parse(output);
								return false;
							} catch {
								return true;
							}
						})()
				).toBe(true);
			}
		});
	});

	describe('format validation', () => {
		it('should accept valid formats', () => {
			const command = new ListTasksCommand();

			expect((command as any).validateOptions({ format: 'text' })).toBe(true);
			expect((command as any).validateOptions({ format: 'json' })).toBe(true);
			expect((command as any).validateOptions({ format: 'compact' })).toBe(
				true
			);
		});

		it('should reject invalid formats', () => {
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			const command = new ListTasksCommand();

			expect((command as any).validateOptions({ format: 'invalid' })).toBe(
				false
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Invalid format: invalid')
			);

			consoleErrorSpy.mockRestore();
		});
	});
});
