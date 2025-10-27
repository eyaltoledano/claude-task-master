/**
 * @fileoverview Tests for MCP logging integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogLevel, type LogCallback } from './logger.js';

describe('Logger - MCP Integration', () => {
	// Store original environment
	let originalEnv: Record<string, string | undefined>;

	beforeEach(() => {
		// Save original environment
		originalEnv = {
			MCP_MODE: process.env.MCP_MODE,
			TASK_MASTER_MCP: process.env.TASK_MASTER_MCP,
			TASK_MASTER_SILENT: process.env.TASK_MASTER_SILENT,
			TM_SILENT: process.env.TM_SILENT,
			TASK_MASTER_LOG_LEVEL: process.env.TASK_MASTER_LOG_LEVEL,
			TM_LOG_LEVEL: process.env.TM_LOG_LEVEL,
			NO_COLOR: process.env.NO_COLOR,
			TASK_MASTER_NO_COLOR: process.env.TASK_MASTER_NO_COLOR
		};

		// Clear environment variables for clean tests
		delete process.env.MCP_MODE;
		delete process.env.TASK_MASTER_MCP;
		delete process.env.TASK_MASTER_SILENT;
		delete process.env.TM_SILENT;
		delete process.env.TASK_MASTER_LOG_LEVEL;
		delete process.env.TM_LOG_LEVEL;
		delete process.env.NO_COLOR;
		delete process.env.TASK_MASTER_NO_COLOR;
	});

	afterEach(() => {
		// Restore original environment
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	});
	describe('Callback-based logging', () => {
		it('should call callback instead of console when logCallback is provided', () => {
			const mockCallback = vi.fn();
			const logger = new Logger({
				level: LogLevel.INFO,
				logCallback: mockCallback
			});

			logger.info('Test message');

			expect(mockCallback).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('Test message')
			);
		});

		it('should call callback for all log levels', () => {
			const mockCallback = vi.fn();
			const logger = new Logger({
				level: LogLevel.DEBUG,
				logCallback: mockCallback
			});

			logger.error('Error message');
			logger.warn('Warning message');
			logger.info('Info message');
			logger.debug('Debug message');

			expect(mockCallback).toHaveBeenNthCalledWith(
				1,
				'error',
				expect.stringContaining('Error message')
			);
			expect(mockCallback).toHaveBeenNthCalledWith(
				2,
				'warn',
				expect.stringContaining('Warning message')
			);
			expect(mockCallback).toHaveBeenNthCalledWith(
				3,
				'info',
				expect.stringContaining('Info message')
			);
			expect(mockCallback).toHaveBeenNthCalledWith(
				4,
				'debug',
				expect.stringContaining('Debug message')
			);
		});

		it('should respect log level with callback', () => {
			const mockCallback = vi.fn();
			const logger = new Logger({
				level: LogLevel.WARN,
				logCallback: mockCallback
			});

			logger.debug('Debug message');
			logger.info('Info message');
			logger.warn('Warning message');
			logger.error('Error message');

			// Only warn and error should be logged
			expect(mockCallback).toHaveBeenCalledTimes(2);
			expect(mockCallback).toHaveBeenNthCalledWith(
				1,
				'warn',
				expect.stringContaining('Warning message')
			);
			expect(mockCallback).toHaveBeenNthCalledWith(
				2,
				'error',
				expect.stringContaining('Error message')
			);
		});

		it('should handle raw log() calls with callback', () => {
			const mockCallback = vi.fn();
			const logger = new Logger({
				level: LogLevel.INFO,
				logCallback: mockCallback
			});

			logger.log('Raw message', 'with args');

			expect(mockCallback).toHaveBeenCalledWith('log', 'Raw message with args');
		});
	});

	describe('MCP mode with callback', () => {
		it('should not silence logs when mcpMode=true and callback is provided', () => {
			const mockCallback = vi.fn();
			const logger = new Logger({
				level: LogLevel.INFO,
				mcpMode: true,
				logCallback: mockCallback
			});

			logger.info('Test message');

			expect(mockCallback).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('Test message')
			);
		});

		it('should silence logs when mcpMode=true and no callback', () => {
			const consoleSpy = vi.spyOn(console, 'log');
			const logger = new Logger({
				level: LogLevel.INFO,
				mcpMode: true
				// No callback
			});

			logger.info('Test message');

			expect(consoleSpy).not.toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe('Child loggers', () => {
		it('should inherit callback from parent', () => {
			const mockCallback = vi.fn();
			const parent = new Logger({
				level: LogLevel.INFO,
				logCallback: mockCallback
			});

			const child = parent.child('child');
			child.info('Child message');

			expect(mockCallback).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('[child]')
			);
			expect(mockCallback).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('Child message')
			);
		});

		it('should allow child to override callback', () => {
			const parentCallback = vi.fn();
			const childCallback = vi.fn();

			const parent = new Logger({
				level: LogLevel.INFO,
				logCallback: parentCallback
			});

			const child = parent.child('child', {
				logCallback: childCallback
			});

			parent.info('Parent message');
			child.info('Child message');

			expect(parentCallback).toHaveBeenCalledTimes(1);
			expect(childCallback).toHaveBeenCalledTimes(1);
		});
	});

	describe('Configuration updates', () => {
		it('should allow updating logCallback via setConfig', () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();

			const logger = new Logger({
				level: LogLevel.INFO,
				logCallback: callback1
			});

			logger.info('Message 1');
			expect(callback1).toHaveBeenCalledTimes(1);

			logger.setConfig({ logCallback: callback2 });
			logger.info('Message 2');

			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).toHaveBeenCalledTimes(1);
		});

		it('should maintain mcpMode behavior when updating config', () => {
			const callback = vi.fn();
			const logger = new Logger({
				level: LogLevel.INFO,
				mcpMode: true
			});

			// Initially silent (no callback)
			logger.info('Message 1');
			expect(callback).not.toHaveBeenCalled();

			// Add callback - should start logging
			logger.setConfig({ logCallback: callback });
			logger.info('Message 2');
			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('Formatting with callback', () => {
		it('should include prefix in callback messages', () => {
			const mockCallback = vi.fn();
			const logger = new Logger({
				level: LogLevel.INFO,
				prefix: 'test-prefix',
				logCallback: mockCallback
			});

			logger.info('Test message');

			expect(mockCallback).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('[test-prefix]')
			);
		});

		it('should include timestamp when enabled', () => {
			const mockCallback = vi.fn();
			const logger = new Logger({
				level: LogLevel.INFO,
				timestamp: true,
				logCallback: mockCallback
			});

			logger.info('Test message');

			const [[, message]] = mockCallback.mock.calls;
			// Message should contain ISO timestamp pattern
			expect(message).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it('should format additional arguments', () => {
			const mockCallback = vi.fn();
			const logger = new Logger({
				level: LogLevel.INFO,
				logCallback: mockCallback
			});

			const data = { key: 'value' };
			logger.info('Test message', data, 'string arg');

			expect(mockCallback).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('Test message')
			);
			expect(mockCallback).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('"key"')
			);
			expect(mockCallback).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('string arg')
			);
		});
	});

	describe('Edge cases', () => {
		it('should handle null/undefined callback gracefully', () => {
			const logger = new Logger({
				level: LogLevel.INFO,
				logCallback: undefined
			});

			const consoleSpy = vi.spyOn(console, 'log');

			// Should fallback to console
			logger.info('Test message');

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should not call callback when level is SILENT', () => {
			const mockCallback = vi.fn();
			const logger = new Logger({
				level: LogLevel.SILENT,
				logCallback: mockCallback
			});

			logger.error('Error');
			logger.warn('Warning');
			logger.info('Info');
			logger.debug('Debug');

			expect(mockCallback).not.toHaveBeenCalled();
		});

		it('should propagate callback errors', () => {
			const errorCallback: LogCallback = () => {
				throw new Error('Callback error');
			};

			const logger = new Logger({
				level: LogLevel.INFO,
				logCallback: errorCallback
			});

			// Should throw
			expect(() => {
				logger.info('Test message');
			}).toThrow('Callback error');
		});
	});

	describe('Environment variable detection', () => {
		it('should detect MCP mode from environment', () => {
			const originalEnv = process.env.MCP_MODE;
			process.env.MCP_MODE = 'true';

			const logger = new Logger({
				level: LogLevel.INFO
			});

			const config = logger.getConfig();
			expect(config.mcpMode).toBe(true);
			expect(config.silent).toBe(true); // Should be silent without callback

			// Cleanup
			if (originalEnv === undefined) {
				delete process.env.MCP_MODE;
			} else {
				process.env.MCP_MODE = originalEnv;
			}
		});

		it('should detect log level from environment', () => {
			const originalEnv = process.env.TASK_MASTER_LOG_LEVEL;
			process.env.TASK_MASTER_LOG_LEVEL = 'DEBUG';

			const logger = new Logger();
			const config = logger.getConfig();
			expect(config.level).toBe(LogLevel.DEBUG);

			// Cleanup
			if (originalEnv === undefined) {
				delete process.env.TASK_MASTER_LOG_LEVEL;
			} else {
				process.env.TASK_MASTER_LOG_LEVEL = originalEnv;
			}
		});
	});
});
