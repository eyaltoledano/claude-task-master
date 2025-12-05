/**
 * Unit Tests for Logger Utility
 * Target: 90%+ coverage for src/utils/logger.ts
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { logger } from '../../../src/utils/logger.js';

describe('Logger Utility', () => {
	const originalEnv = process.env;
	let consoleSpy: {
		log: jest.SpiedFunction<typeof console.log>;
		warn: jest.SpiedFunction<typeof console.warn>;
		error: jest.SpiedFunction<typeof console.error>;
	};

	beforeEach(() => {
		process.env = { ...originalEnv };
		delete process.env.DEBUG;

		consoleSpy = {
			log: jest.spyOn(console, 'log').mockImplementation(() => {}),
			warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
			error: jest.spyOn(console, 'error').mockImplementation(() => {})
		};
	});

	afterEach(() => {
		process.env = originalEnv;
		jest.restoreAllMocks();
	});

	describe('debug', () => {
		it('should not log when DEBUG is not set', () => {
			logger.debug('snowflake:test', 'Test message');

			expect(consoleSpy.log).not.toHaveBeenCalled();
		});

		it('should log when DEBUG includes the namespace', () => {
			process.env.DEBUG = 'snowflake:test';

			logger.debug('snowflake:test', 'Test message', { extra: 'data' });

			expect(consoleSpy.log).toHaveBeenCalledWith(
				'[DEBUG snowflake:test]',
				'Test message',
				{ extra: 'data' }
			);
		});

		it('should log when DEBUG is set to wildcard *', () => {
			process.env.DEBUG = '*';

			logger.debug('snowflake:anything', 'Test message');

			expect(consoleSpy.log).toHaveBeenCalledWith(
				'[DEBUG snowflake:anything]',
				'Test message'
			);
		});

		it('should log when DEBUG includes snowflake:*', () => {
			process.env.DEBUG = 'snowflake:*';

			logger.debug('snowflake:provider', 'Provider message');

			expect(consoleSpy.log).toHaveBeenCalledWith(
				'[DEBUG snowflake:provider]',
				'Provider message'
			);
		});

		it('should not log when DEBUG does not include the namespace', () => {
			process.env.DEBUG = 'other:namespace';

			logger.debug('snowflake:test', 'Test message');

			expect(consoleSpy.log).not.toHaveBeenCalled();
		});

		it('should handle multiple arguments', () => {
			process.env.DEBUG = 'snowflake:test';

			logger.debug('snowflake:test', 'Message', 1, 2, 3, { obj: true });

			expect(consoleSpy.log).toHaveBeenCalledWith(
				'[DEBUG snowflake:test]',
				'Message',
				1,
				2,
				3,
				{ obj: true }
			);
		});
	});

	describe('info', () => {
		it('should always log info messages', () => {
			logger.info('Information message');

			expect(consoleSpy.log).toHaveBeenCalledWith(
				'[INFO snowflake]',
				'Information message'
			);
		});

		it('should handle multiple arguments', () => {
			logger.info('Info with data', { key: 'value' }, 42);

			expect(consoleSpy.log).toHaveBeenCalledWith(
				'[INFO snowflake]',
				'Info with data',
				{ key: 'value' },
				42
			);
		});
	});

	describe('warn', () => {
		it('should always log warning messages', () => {
			logger.warn('Warning message');

			expect(consoleSpy.warn).toHaveBeenCalledWith(
				'[WARN snowflake]',
				'Warning message'
			);
		});

		it('should handle multiple arguments', () => {
			logger.warn('Warning!', 'extra', 'info');

			expect(consoleSpy.warn).toHaveBeenCalledWith(
				'[WARN snowflake]',
				'Warning!',
				'extra',
				'info'
			);
		});
	});

	describe('error', () => {
		it('should always log error messages', () => {
			logger.error('Error message');

			expect(consoleSpy.error).toHaveBeenCalledWith(
				'[ERROR snowflake]',
				'Error message'
			);
		});

		it('should handle Error objects', () => {
			const error = new Error('Test error');
			logger.error('An error occurred', error);

			expect(consoleSpy.error).toHaveBeenCalledWith(
				'[ERROR snowflake]',
				'An error occurred',
				error
			);
		});

		it('should handle multiple arguments', () => {
			logger.error('Error with context', { userId: 123 }, 'details');

			expect(consoleSpy.error).toHaveBeenCalledWith(
				'[ERROR snowflake]',
				'Error with context',
				{ userId: 123 },
				'details'
			);
		});
	});

	describe('debugWarn', () => {
		it('should not log when DEBUG is not set', () => {
			logger.debugWarn('snowflake:test', 'Warning message');

			expect(consoleSpy.warn).not.toHaveBeenCalled();
		});

		it('should log when DEBUG includes the namespace', () => {
			process.env.DEBUG = 'snowflake:test';

			logger.debugWarn('snowflake:test', 'Debug warning', { context: 'test' });

			expect(consoleSpy.warn).toHaveBeenCalledWith(
				'[WARN snowflake:test]',
				'Debug warning',
				{ context: 'test' }
			);
		});

		it('should log when DEBUG is wildcard', () => {
			process.env.DEBUG = '*';

			logger.debugWarn('any:namespace', 'Debug warning');

			expect(consoleSpy.warn).toHaveBeenCalledWith(
				'[WARN any:namespace]',
				'Debug warning'
			);
		});

		it('should log when DEBUG includes snowflake:*', () => {
			process.env.DEBUG = 'snowflake:*';

			logger.debugWarn('snowflake:auth', 'Auth warning');

			expect(consoleSpy.warn).toHaveBeenCalledWith(
				'[WARN snowflake:auth]',
				'Auth warning'
			);
		});
	});

	describe('Default Export', () => {
		it('should export logger as default', async () => {
			const defaultExport = (await import('../../../src/utils/logger.js')).default;

			expect(defaultExport).toBe(logger);
			expect(typeof defaultExport.debug).toBe('function');
			expect(typeof defaultExport.info).toBe('function');
			expect(typeof defaultExport.warn).toBe('function');
			expect(typeof defaultExport.error).toBe('function');
			expect(typeof defaultExport.debugWarn).toBe('function');
		});
	});
});

