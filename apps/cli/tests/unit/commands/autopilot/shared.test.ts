/**
 * @fileoverview Unit tests for autopilot shared utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutputFormatter } from '../../../../src/commands/autopilot/shared.js';

describe('Autopilot Shared Utilities', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

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
					expect.stringContaining('⚠️ Warning message')
				);
				consoleWarnSpy.mockRestore();
			});

			it('should output formatted text for info', () => {
				const formatter = new OutputFormatter(false);
				formatter.info('Info message');

				expect(consoleLogSpy).toHaveBeenCalledWith(
					expect.stringContaining('ℹ Info message')
				);
			});
		});

		describe('info suppression', () => {
			it('should not output info in JSON mode', () => {
				const formatter = new OutputFormatter(true);
				formatter.info('Info message');

				expect(consoleLogSpy).not.toHaveBeenCalled();
			});
		});
	});
});
