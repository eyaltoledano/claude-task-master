/**
 * Unit tests for Offline Mode Detection
 * Tests network connectivity monitoring and offline handling
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

describe('Offline Mode Detection', () => {
	let dom;
	let document;
	let window;
	let OfflineDetector;
	let mockToast;

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
		global.navigator = {
			onLine: true
		};

		// Mock sessionStorage
		const sessionStorageMock = {
			getItem: jest.fn(),
			setItem: jest.fn(),
			removeItem: jest.fn(),
			clear: jest.fn()
		};
		Object.defineProperty(window, 'sessionStorage', {
			value: sessionStorageMock,
			writable: true
		});

		// Mock toast notifications
		mockToast = {
			error: jest.fn(),
			warning: jest.fn(),
			info: jest.fn(),
			success: jest.fn()
		};
		global.toast = mockToast;

		// Mock fetch
		global.fetch = jest.fn();

		// Mock timers
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.restoreAllMocks();
	});

	// Helper to load the OfflineDetector
	const loadOfflineDetector = async () => {
		// Import the actual implementation when it exists
		const module = await import(
			'../../../src/ui/client/js/components/offlineDetector.js'
		);
		return module.default;
	};

	describe('Initialization', () => {
		it('should initialize with default options', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector();

			expect(detector).toBeDefined();
			expect(detector.isOnline).toBe(true);
			expect(detector.options.checkInterval).toBe(30000); // 30 seconds
		});

		it('should accept custom options', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({
				checkInterval: 60000,
				endpoints: ['/api/health'],
				showNotifications: false
			});

			expect(detector.options.checkInterval).toBe(60000);
			expect(detector.options.endpoints).toEqual(['/api/health']);
			expect(detector.options.showNotifications).toBe(false);
		});

		it('should register event listeners on start', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector();

			const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

			detector.start();

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				'online',
				expect.any(Function)
			);
			expect(addEventListenerSpy).toHaveBeenCalledWith(
				'offline',
				expect.any(Function)
			);
		});
	});

	describe('Online/Offline Detection', () => {
		it('should detect when going offline', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector();
			const offlineCallback = jest.fn();

			detector.on('offline', offlineCallback);
			detector.start();

			// Simulate going offline
			global.navigator.onLine = false;
			const offlineEvent = new window.Event('offline');
			window.dispatchEvent(offlineEvent);

			expect(detector.isOnline).toBe(false);
			expect(offlineCallback).toHaveBeenCalled();
			expect(mockToast.warning).toHaveBeenCalledWith(
				expect.stringContaining('offline'),
				expect.any(Object)
			);
		});

		it('should detect when coming back online', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector();
			const onlineCallback = jest.fn();

			detector.on('online', onlineCallback);
			detector.start();

			// First go offline
			global.navigator.onLine = false;
			window.dispatchEvent(new window.Event('offline'));

			// Then come back online
			global.navigator.onLine = true;
			const onlineEvent = new window.Event('online');
			window.dispatchEvent(onlineEvent);

			expect(detector.isOnline).toBe(true);
			expect(onlineCallback).toHaveBeenCalled();
			expect(mockToast.success).toHaveBeenCalledWith(
				expect.stringContaining('online'),
				expect.any(Object)
			);
		});
	});

	describe('Connectivity Checks', () => {
		it('should perform periodic connectivity checks', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({ checkInterval: 5000 });

			global.fetch.mockResolvedValue({ ok: true });

			detector.start();

			expect(global.fetch).not.toHaveBeenCalled();

			jest.advanceTimersByTime(5000);

			expect(global.fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					method: 'HEAD',
					cache: 'no-cache'
				})
			);
		});

		it('should detect offline state when connectivity check fails', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({ checkInterval: 5000 });
			const offlineCallback = jest.fn();

			detector.on('offline', offlineCallback);
			global.fetch.mockRejectedValue(new Error('Network error'));

			detector.start();

			// Fast-forward time
			await jest.advanceTimersByTimeAsync(5000);

			expect(detector.isOnline).toBe(false);
			expect(offlineCallback).toHaveBeenCalled();
		});

		it('should try multiple endpoints before declaring offline', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({
				checkInterval: 5000,
				endpoints: ['/api/health', '/api/ping', 'https://1.1.1.1']
			});

			global.fetch
				.mockRejectedValueOnce(new Error('Failed'))
				.mockRejectedValueOnce(new Error('Failed'))
				.mockResolvedValueOnce({ ok: true });

			detector.start();

			await jest.advanceTimersByTimeAsync(5000);

			expect(global.fetch).toHaveBeenCalledTimes(3);
			expect(detector.isOnline).toBe(true);
		});
	});

	describe('UI Indicators', () => {
		it.skip('should show offline indicator when offline', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({ showIndicator: true });

			detector.start();

			// Go offline
			global.navigator.onLine = false;
			window.dispatchEvent(new window.Event('offline'));

			// Run any pending timers
			jest.runAllTimers();

			// The detector should create the indicator
			const indicator = document.querySelector('.offline-indicator');
			expect(indicator).toBeTruthy();
			expect(indicator.classList.contains('offline-indicator-visible')).toBe(
				true
			);
		});

		it('should hide offline indicator when online', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({ showIndicator: true });

			detector.start();

			// First go offline
			global.navigator.onLine = false;
			window.dispatchEvent(new window.Event('offline'));

			// Then come back online
			global.navigator.onLine = true;
			window.dispatchEvent(new window.Event('online'));

			const indicator = document.querySelector('.offline-indicator');
			expect(indicator.classList.contains('offline-indicator-visible')).toBe(
				false
			);
		});

		it('should add offline class to body', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector();

			detector.start();

			// Go offline
			global.navigator.onLine = false;
			window.dispatchEvent(new window.Event('offline'));

			expect(document.body.classList.contains('offline')).toBe(true);

			// Come back online
			global.navigator.onLine = true;
			window.dispatchEvent(new window.Event('online'));

			expect(document.body.classList.contains('offline')).toBe(false);
		});
	});

	describe('Offline Queue', () => {
		it('should queue failed requests when offline', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({ enableQueue: true });

			detector.start();

			// Go offline
			global.navigator.onLine = false;
			window.dispatchEvent(new window.Event('offline'));

			// Queue a request
			const request = {
				url: '/api/tasks/1',
				method: 'PATCH',
				body: { status: 'done' }
			};

			detector.queueRequest(request);

			expect(detector.getQueuedRequests()).toHaveLength(1);
			expect(detector.getQueuedRequests()[0]).toMatchObject(request);
		});

		it('should process queued requests when coming back online', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({ enableQueue: true });
			const processCallback = jest.fn();

			detector.on('process-queue', processCallback);
			detector.start();

			// Go offline and queue requests
			global.navigator.onLine = false;
			window.dispatchEvent(new window.Event('offline'));

			detector.queueRequest({ url: '/api/tasks/1', method: 'PATCH' });
			detector.queueRequest({ url: '/api/tasks/2', method: 'PATCH' });

			// Come back online
			global.navigator.onLine = true;
			window.dispatchEvent(new window.Event('online'));

			expect(processCallback).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ url: '/api/tasks/1' }),
					expect.objectContaining({ url: '/api/tasks/2' })
				])
			);
		});

		it('should clear queue after processing', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({ enableQueue: true });

			detector.start();

			// Queue requests while offline
			global.navigator.onLine = false;
			window.dispatchEvent(new window.Event('offline'));
			detector.queueRequest({ url: '/api/test', method: 'POST' });

			// Process queue
			detector.clearQueue();

			expect(detector.getQueuedRequests()).toHaveLength(0);
		});
	});

	describe('Storage Persistence', () => {
		it('should persist offline state in sessionStorage', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({ persistState: true });

			detector.start();

			// Go offline
			global.navigator.onLine = false;
			window.dispatchEvent(new window.Event('offline'));

			expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
				'offline-mode',
				'true'
			);

			// Come back online
			global.navigator.onLine = true;
			window.dispatchEvent(new window.Event('online'));

			expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
				'offline-mode',
				'false'
			);
		});

		it('should restore state from sessionStorage on init', async () => {
			window.sessionStorage.getItem.mockReturnValue('true');

			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({ persistState: true });

			expect(detector.isOnline).toBe(false);
		});
	});

	describe('Cleanup', () => {
		it('should remove event listeners on stop', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector();

			const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

			detector.start();
			detector.stop();

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'online',
				expect.any(Function)
			);
			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'offline',
				expect.any(Function)
			);
		});

		it('should clear intervals on stop', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector({ checkInterval: 5000 });

			detector.start();

			const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

			detector.stop();

			expect(clearIntervalSpy).toHaveBeenCalled();
		});
	});

	describe('Event Emitter', () => {
		it('should emit custom events', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector();

			const statusChangeCallback = jest.fn();
			detector.on('status-change', statusChangeCallback);

			detector.start();

			// Trigger offline
			global.navigator.onLine = false;
			window.dispatchEvent(new window.Event('offline'));

			expect(statusChangeCallback).toHaveBeenCalledWith({
				online: false,
				timestamp: expect.any(Number)
			});
		});

		it('should support removing event listeners', async () => {
			OfflineDetector = await loadOfflineDetector();
			const detector = new OfflineDetector();

			const callback = jest.fn();
			detector.on('offline', callback);
			detector.off('offline', callback);

			detector.start();

			// Trigger offline
			global.navigator.onLine = false;
			window.dispatchEvent(new window.Event('offline'));

			expect(callback).not.toHaveBeenCalled();
		});
	});
});
