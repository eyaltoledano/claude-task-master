/**
 * Unit tests for Error Logging System
 * Tests error capture, logging, and reporting functionality
 */

import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import ErrorLogger from '../../../src/ui/client/js/components/errorLogger.js';

describe('Error Logging System', () => {
	let dom;
	let document;
	let window;
	let mockConsole;

	beforeEach(() => {
		// Set up DOM environment
		dom = new JSDOM(
			`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="app"></div>
            </body>
            </html>
        `,
			{
				url: 'http://localhost:3000',
				pretendToBeVisual: true
			}
		);

		document = dom.window.document;
		window = dom.window;

		// Set up globals
		global.document = document;
		global.window = window;

		// Mock console methods
		mockConsole = {
			log: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			group: jest.fn(),
			groupEnd: jest.fn()
		};
		global.console = mockConsole;

		// Mock localStorage
		const localStorageMock = {
			getItem: jest.fn(),
			setItem: jest.fn(),
			removeItem: jest.fn(),
			clear: jest.fn()
		};
		Object.defineProperty(window, 'localStorage', {
			value: localStorageMock,
			writable: true
		});

		// Mock timers
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.restoreAllMocks();
	});

	describe('Initialization', () => {
		it('should initialize with default options', () => {
			const logger = new ErrorLogger();

			expect(logger).toBeDefined();
			expect(logger.logs).toBeDefined();
			expect(logger.options.maxLogs).toBe(100);
			expect(logger.options.logLevel).toBe('error');
		});

		it('should accept custom options', () => {
			const logger = new ErrorLogger({
				maxLogs: 50,
				logLevel: 'debug',
				persistLogs: true
			});

			expect(logger.options.maxLogs).toBe(50);
			expect(logger.options.logLevel).toBe('debug');
			expect(logger.options.persistLogs).toBe(true);
		});
	});

	describe('Error Capture', () => {
		it('should capture JavaScript errors', () => {
			const logger = new ErrorLogger();

			const error = new Error('Test error');
			error.stack = 'Error: Test error\n    at test.js:10:5';

			logger.logError(error, {
				context: 'test-context',
				userId: '123'
			});

			expect(logger.logs).toHaveLength(1);
			expect(logger.logs[0]).toMatchObject({
				level: 'error',
				message: 'Test error',
				stack: expect.stringContaining('test.js:10:5'),
				context: 'test-context',
				metadata: { userId: '123' }
			});
		});

		it('should capture unhandled errors', () => {
			const logger = new ErrorLogger();
			logger.attachGlobalHandlers();

			const errorEvent = new window.ErrorEvent('error', {
				error: new Error('Unhandled error'),
				message: 'Unhandled error',
				filename: 'app.js',
				lineno: 20,
				colno: 10
			});

			window.dispatchEvent(errorEvent);

			expect(logger.logs).toHaveLength(1);
			expect(logger.logs[0]).toMatchObject({
				level: 'error',
				message: 'Unhandled error',
				metadata: {
					filename: 'app.js',
					lineno: 20,
					colno: 10
				}
			});
		});

		it('should capture promise rejections', () => {
			const logger = new ErrorLogger();
			logger.attachGlobalHandlers();

			const promiseEvent = new window.Event('unhandledrejection');
			promiseEvent.reason = new Error('Promise rejected');
			promiseEvent.promise = Promise.reject().catch(() => {}); // Handle to prevent actual rejection

			window.dispatchEvent(promiseEvent);

			expect(logger.logs).toHaveLength(1);
			expect(logger.logs[0]).toMatchObject({
				level: 'error',
				message: 'Unhandled promise rejection: Promise rejected',
				type: 'unhandledRejection'
			});
		});
	});

	describe('Log Levels', () => {
		it('should respect log level filtering', () => {
			const logger = new ErrorLogger({ logLevel: 'warn' });

			logger.debug('Debug message');
			logger.info('Info message');
			logger.warn('Warning message');
			logger.error('Error message');

			// Only warn and error should be logged
			expect(logger.logs).toHaveLength(2);
			expect(logger.logs[0].level).toBe('warn');
			expect(logger.logs[1].level).toBe('error');
		});

		it('should support all log levels', () => {
			const logger = new ErrorLogger({ logLevel: 'debug' });

			logger.debug('Debug');
			logger.info('Info');
			logger.warn('Warning');
			logger.error('Error');

			expect(logger.logs).toHaveLength(4);
			expect(logger.logs.map((l) => l.level)).toEqual([
				'debug',
				'info',
				'warn',
				'error'
			]);
		});
	});

	describe('Log Storage', () => {
		it('should store logs in memory', () => {
			const logger = new ErrorLogger();

			for (let i = 0; i < 5; i++) {
				logger.error(`Error ${i}`);
			}

			expect(logger.logs).toHaveLength(5);
			expect(logger.getLogs()).toHaveLength(5);
		});

		it('should respect max logs limit', () => {
			const logger = new ErrorLogger({ maxLogs: 3 });

			for (let i = 0; i < 5; i++) {
				logger.error(`Error ${i}`);
			}

			expect(logger.logs).toHaveLength(3);
			// Should keep the most recent logs
			expect(logger.logs[0].message).toBe('Error 2');
			expect(logger.logs[2].message).toBe('Error 4');
		});

		it('should persist logs to localStorage', () => {
			const logger = new ErrorLogger({ persistLogs: true });

			logger.error('Persistent error');

			expect(window.localStorage.setItem).toHaveBeenCalledWith(
				'error-logs',
				expect.stringContaining('Persistent error')
			);
		});

		it('should restore logs from localStorage', () => {
			const storedLogs = JSON.stringify([
				{ level: 'error', message: 'Stored error', timestamp: Date.now() }
			]);
			window.localStorage.getItem.mockReturnValue(storedLogs);

			const logger = new ErrorLogger({ persistLogs: true });

			expect(logger.logs).toHaveLength(1);
			expect(logger.logs[0].message).toBe('Stored error');
		});
	});

	describe('Log Formatting', () => {
		it('should format logs with metadata', () => {
			const logger = new ErrorLogger();

			logger.error('Test error', {
				userId: '123',
				action: 'button-click',
				browser: 'Chrome'
			});

			const log = logger.logs[0];
			expect(log).toMatchObject({
				level: 'error',
				message: 'Test error',
				timestamp: expect.any(Number),
				metadata: {
					userId: '123',
					action: 'button-click',
					browser: 'Chrome'
				}
			});
		});

		it('should include stack traces for errors', () => {
			const logger = new ErrorLogger();

			const error = new Error('Stack trace test');
			logger.logError(error);

			const log = logger.logs[0];
			expect(log.stack).toBeDefined();
			expect(log.stack).toContain('Stack trace test');
		});

		it('should format grouped logs', () => {
			const logger = new ErrorLogger({ logLevel: 'info' }); // Need to set log level to capture info messages

			logger.group('User Action');
			logger.info('Click on button');
			logger.info('Submit form');
			logger.groupEnd();

			expect(logger.logs).toHaveLength(1);
			const groupLog = logger.logs[0];
			expect(groupLog.type).toBe('group');
			expect(groupLog.label).toBe('User Action');
			expect(groupLog.logs).toHaveLength(2);
			expect(groupLog.logs[0].message).toBe('Click on button');
			expect(groupLog.logs[1].message).toBe('Submit form');
		});
	});

	describe('Log Filtering and Search', () => {
		it('should filter logs by level', () => {
			const logger = new ErrorLogger({ logLevel: 'debug' });

			logger.debug('Debug');
			logger.info('Info');
			logger.warn('Warning');
			logger.error('Error');

			const errors = logger.getLogsByLevel('error');
			expect(errors).toHaveLength(1);
			expect(errors[0].message).toBe('Error');

			const warnings = logger.getLogsByLevel(['warn', 'error']);
			expect(warnings).toHaveLength(2);
		});

		it('should search logs by message', () => {
			const logger = new ErrorLogger();

			logger.error('Failed to save user');
			logger.error('Network timeout');
			logger.error('Failed to load data');

			const results = logger.searchLogs('Failed');
			expect(results).toHaveLength(2);
		});

		it('should filter logs by time range', () => {
			const logger = new ErrorLogger();

			const now = Date.now();
			logger.logs = [
				{ timestamp: now - 3600000, message: 'Old error' }, // 1 hour ago
				{ timestamp: now - 1800000, message: 'Recent error' }, // 30 min ago
				{ timestamp: now, message: 'Current error' }
			];

			const recentLogs = logger.getLogsByTimeRange(now - 2700000, now); // Last 45 min
			expect(recentLogs).toHaveLength(2);
			expect(recentLogs[0].message).toBe('Recent error');
		});
	});

	describe('Export and Reporting', () => {
		it('should export logs as JSON', () => {
			const logger = new ErrorLogger({ logLevel: 'warn' });

			logger.error('Error 1');
			logger.warn('Warning 1');

			const exported = logger.exportLogs('json');
			const parsed = JSON.parse(exported);

			expect(parsed).toHaveLength(2);
			expect(parsed[0].message).toBe('Error 1');
		});

		it('should export logs as CSV', () => {
			const logger = new ErrorLogger();

			logger.error('Error message', { userId: '123' });

			const csv = logger.exportLogs('csv');
			expect(csv).toContain('timestamp,level,message,metadata');
			expect(csv).toContain('error,Error message');
		});

		it('should generate error summary report', () => {
			const logger = new ErrorLogger({ logLevel: 'debug' });

			logger.debug('Debug 1');
			logger.debug('Debug 2');
			logger.info('Info 1');
			logger.warn('Warning 1');
			logger.error('Error 1');
			logger.error('Error 2');
			logger.error('Error 3');

			const summary = logger.getSummary();
			expect(summary).toMatchObject({
				total: 7,
				byLevel: {
					debug: 2,
					info: 1,
					warn: 1,
					error: 3
				},
				errorRate: expect.closeTo(0.43, 2),
				timeRange: {
					start: expect.any(Number),
					end: expect.any(Number)
				}
			});
		});
	});

	describe('Cleanup and Management', () => {
		it('should clear all logs', () => {
			const logger = new ErrorLogger();

			logger.error('Error 1');
			logger.error('Error 2');

			expect(logger.logs).toHaveLength(2);

			logger.clear();

			expect(logger.logs).toHaveLength(0);
		});

		it('should clear logs from localStorage', () => {
			const logger = new ErrorLogger({ persistLogs: true });

			logger.error('Error to clear');
			logger.clear();

			expect(window.localStorage.removeItem).toHaveBeenCalledWith('error-logs');
		});

		it('should detach global handlers on destroy', () => {
			const logger = new ErrorLogger();

			const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

			logger.attachGlobalHandlers();
			logger.destroy();

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'error',
				expect.any(Function)
			);
			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'unhandledrejection',
				expect.any(Function)
			);
		});
	});
});
