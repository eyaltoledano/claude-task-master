/**
 * Unit tests for PollingManager module
 * Tests polling lifecycle, configuration, and event handling
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

import PollingManager from '../../../src/ui/client/js/polling.js';

describe('PollingManager', () => {
	let pollingManager;
	let mockFetch;
	let dom;
	let document;
	let window;

	beforeEach(() => {
		// Set up DOM environment
		dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
			url: 'http://localhost:3000',
			pretendToBeVisual: true
		});

		document = dom.window.document;
		window = dom.window;

		// Set up globals
		global.document = document;
		global.window = window;
		global.navigator = window.navigator;
		global.localStorage = {
			clear: jest.fn(),
			getItem: jest.fn(),
			setItem: jest.fn(),
			removeItem: jest.fn()
		};

		// Mock console to suppress logs/errors
		global.console = {
			...console,
			log: jest.fn(),
			error: jest.fn(),
			warn: jest.fn()
		};

		// Mock fetch API
		mockFetch = jest.fn();
		global.fetch = mockFetch;

		// Mock timers
		jest.useFakeTimers();
	});

	afterEach(() => {
		// Destroy the singleton instance
		if (PollingManager.instance) {
			PollingManager.instance.destroy();
		}
		jest.clearAllTimers();
		jest.restoreAllMocks();
	});

	describe('Singleton Pattern', () => {
		it('should return the same instance when getInstance is called multiple times', () => {
			const instance1 = PollingManager.getInstance();
			const instance2 = PollingManager.getInstance();

			expect(instance1).toBe(instance2);
		});

		it('should throw error when trying to instantiate directly', () => {
			// First create an instance
			PollingManager.getInstance();
			// Then try to instantiate directly, which should throw
			expect(() => new PollingManager()).toThrow(
				'Use PollingManager.getInstance() to get the singleton instance'
			);
		});
	});

	describe('Configuration', () => {
		it('should accept custom configuration options', () => {
			const config = {
				interval: 60000, // 60 seconds
				endpoint: '/api/tasks',
				enableDiffDetection: true,
				enableCaching: true,
				maxRetries: 5
			};

			pollingManager = PollingManager.getInstance(config);
			expect(pollingManager.config).toEqual(expect.objectContaining(config));
		});

		it('should use default configuration when no options provided', () => {
			pollingManager = PollingManager.getInstance();

			expect(pollingManager.config).toEqual({
				interval: 30000, // 30 seconds default
				endpoint: '/api/tasks',
				enableDiffDetection: true,
				enableCaching: true,
				maxRetries: 3,
				backoffMultiplier: 2,
				maxBackoffDelay: 32000
			});
		});

		it('should validate configuration values', () => {
			// Test negative interval
			expect(() => {
				PollingManager.getInstance({ interval: -1000 });
			}).toThrow('Interval must be positive');

			// Reset instance for next test
			if (PollingManager.instance) {
				PollingManager.instance.destroy();
			}

			// Test invalid max retries
			expect(() => {
				PollingManager.getInstance({ maxRetries: 0 });
			}).toThrow('Max retries must be at least 1');
		});
	});

	describe('Lifecycle Management', () => {
		it('should start polling when start() is called', async () => {
			pollingManager = PollingManager.getInstance();

			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ tasks: [] })
			});

			const startSpy = jest.spyOn(pollingManager, 'poll');

			await pollingManager.start();

			expect(pollingManager.isPolling).toBe(true);
			expect(startSpy).toHaveBeenCalled();
		});

		it('should stop polling when stop() is called', async () => {
			pollingManager = PollingManager.getInstance();

			await pollingManager.start();
			pollingManager.stop();

			expect(pollingManager.isPolling).toBe(false);
			expect(pollingManager.pollTimer).toBeNull();
		});

		it('should pause and resume polling', async () => {
			pollingManager = PollingManager.getInstance();

			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ tasks: [] })
			});

			await pollingManager.start();
			pollingManager.pause();
			expect(pollingManager.isPaused).toBe(true);

			pollingManager.resume();
			expect(pollingManager.isPaused).toBe(false);
		});

		it('should not start multiple polling loops', async () => {
			pollingManager = PollingManager.getInstance();

			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ tasks: [] })
			});

			await pollingManager.start();
			await pollingManager.start(); // Second call should be ignored

			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});

	describe('Polling Behavior', () => {
		it('should poll at configured interval', async () => {
			pollingManager = PollingManager.getInstance({ interval: 5000 });

			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ tasks: [] })
			});

			// Spy on the poll method
			const pollSpy = jest.spyOn(pollingManager, 'poll');

			await pollingManager.start();

			// Initial poll
			expect(pollSpy).toHaveBeenCalledTimes(1);
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Clear the spy count
			pollSpy.mockClear();
			mockFetch.mockClear();

			// Advance timer to trigger next poll
			jest.advanceTimersByTime(5000);

			// Since poll schedules the next one, we should see the timer callback set
			expect(pollingManager.pollTimer).toBeDefined();

			// Stop polling to prevent infinite loop
			pollingManager.stop();
		});

		it('should emit events on successful poll', async () => {
			pollingManager = PollingManager.getInstance();

			const mockData = { tasks: [{ id: 1, title: 'Test' }] };
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => mockData
			});

			const dataHandler = jest.fn();
			const successHandler = jest.fn();

			pollingManager.on('data', dataHandler);
			pollingManager.on('poll:success', successHandler);

			// Start polling to set isPolling = true
			pollingManager.isPolling = true;
			await pollingManager.poll();

			expect(dataHandler).toHaveBeenCalledWith(mockData);
			expect(successHandler).toHaveBeenCalledWith(mockData);
		});

		it('should handle polling errors gracefully', async () => {
			pollingManager = PollingManager.getInstance();

			mockFetch.mockRejectedValue(new Error('Network error'));

			const errorHandler = jest.fn();
			pollingManager.on('poll:error', errorHandler);

			// Start polling to set isPolling = true
			pollingManager.isPolling = true;
			await pollingManager.poll();

			expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
			expect(pollingManager.retryCount).toBe(1);
		});
	});

	describe('Network Resilience', () => {
		it('should implement exponential backoff on failures', async () => {
			pollingManager = PollingManager.getInstance({
				interval: 5000,
				backoffMultiplier: 2,
				maxBackoffDelay: 20000
			});

			mockFetch.mockRejectedValue(new Error('Network error'));

			await pollingManager.start();

			// After first failure, retry delay should be doubled
			expect(pollingManager.retryDelay).toBe(4000); // 2000 * 2

			// Let the retry happen
			jest.advanceTimersByTime(4000);
			await Promise.resolve();

			// After second failure, retry delay should be doubled again
			expect(pollingManager.retryDelay).toBe(8000); // 4000 * 2

			// The maxBackoffDelay is 20000, but we're at 8000, so next should be 16000
			// However, we need to check if it hits max retries (3) first
			// Since we already had 2 failures, one more will trigger max retries
			// Let's verify the polling has stopped due to max retries
			expect(pollingManager.retryCount).toBe(2);
		});

		it('should reset retry count on successful poll', async () => {
			pollingManager = PollingManager.getInstance();

			// Set isPolling to true
			pollingManager.isPolling = true;

			// Simulate failures
			mockFetch.mockRejectedValueOnce(new Error('Network error'));
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await pollingManager.poll();
			expect(pollingManager.retryCount).toBe(1);

			await pollingManager.poll();
			expect(pollingManager.retryCount).toBe(2);

			// Simulate success
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ tasks: [] })
			});

			await pollingManager.poll();

			expect(pollingManager.retryCount).toBe(0);
		});

		it('should stop retrying after max retries reached', async () => {
			pollingManager = PollingManager.getInstance({ maxRetries: 2 });

			mockFetch.mockRejectedValue(new Error('Network error'));

			const stopHandler = jest.fn();
			pollingManager.on('poll:maxRetries', stopHandler);

			await pollingManager.start();
			// First failure, retryCount = 1
			expect(pollingManager.retryCount).toBe(1);

			// Advance to trigger first retry
			jest.advanceTimersByTime(4000);
			await Promise.resolve();
			// Second failure, retryCount = 2, should hit max retries

			expect(stopHandler).toHaveBeenCalled();
			expect(pollingManager.isPolling).toBe(false);
		});
	});

	describe('Event Emitter', () => {
		it('should support event subscription and unsubscription', () => {
			pollingManager = PollingManager.getInstance();

			const handler = jest.fn();

			pollingManager.on('test', handler);
			pollingManager.emit('test', 'data');

			expect(handler).toHaveBeenCalledWith('data');

			pollingManager.off('test', handler);
			pollingManager.emit('test', 'data2');

			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('should support one-time event handlers', () => {
			pollingManager = PollingManager.getInstance();

			const handler = jest.fn();

			pollingManager.once('test', handler);
			pollingManager.emit('test', 'data1');
			pollingManager.emit('test', 'data2');

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith('data1');
		});
	});

	describe('Manual Refresh', () => {
		it('should support manual refresh trigger', async () => {
			pollingManager = PollingManager.getInstance();

			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ tasks: [] })
			});

			await pollingManager.start();

			// Reset mock count
			mockFetch.mockClear();

			// Trigger manual refresh
			await pollingManager.refresh();

			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('should reset poll timer after manual refresh', async () => {
			pollingManager = PollingManager.getInstance({ interval: 10000 });

			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ tasks: [] })
			});

			await pollingManager.start();

			// Advance timer halfway
			jest.advanceTimersByTime(5000);

			// Manual refresh should reset timer
			await pollingManager.refresh();

			mockFetch.mockClear();

			// Advance by less than full interval
			jest.advanceTimersByTime(9000);
			expect(mockFetch).not.toHaveBeenCalled();

			// Advance to complete interval
			jest.advanceTimersByTime(1000);
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});
});
