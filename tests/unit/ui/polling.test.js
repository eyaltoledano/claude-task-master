/**
 * Unit tests for PollingManager module
 * Tests polling lifecycle, configuration, and event handling
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';

// We'll import the actual module once it's created
// import PollingManager from '../../../src/ui/client/js/polling.js';

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
        
        // Mock fetch API
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        
        // Mock timers
        jest.useFakeTimers();
    });
    
    afterEach(() => {
        if (pollingManager) {
            pollingManager.destroy();
        }
        jest.clearAllTimers();
        jest.restoreAllMocks();
    });
    
    describe('Singleton Pattern', () => {
        it('should return the same instance when getInstance is called multiple times', () => {
            const PollingManager = getMockPollingManager();
            const instance1 = PollingManager.getInstance();
            const instance2 = PollingManager.getInstance();
            
            expect(instance1).toBe(instance2);
        });
        
        it('should throw error when trying to instantiate directly', () => {
            const PollingManager = getMockPollingManager();
            expect(() => new PollingManager()).toThrow('Use PollingManager.getInstance()');
        });
    });
    
    describe('Configuration', () => {
        it('should accept custom configuration options', () => {
            const PollingManager = getMockPollingManager();
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
            const PollingManager = getMockPollingManager();
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
            const PollingManager = getMockPollingManager();
            
            expect(() => {
                PollingManager.getInstance({ interval: -1000 });
            }).toThrow('Interval must be positive');
            
            expect(() => {
                PollingManager.getInstance({ maxRetries: 0 });
            }).toThrow('Max retries must be at least 1');
        });
    });
    
    describe('Lifecycle Management', () => {
        it('should start polling when start() is called', async () => {
            const PollingManager = getMockPollingManager();
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
            const PollingManager = getMockPollingManager();
            pollingManager = PollingManager.getInstance();
            
            await pollingManager.start();
            pollingManager.stop();
            
            expect(pollingManager.isPolling).toBe(false);
            expect(pollingManager.pollTimer).toBeNull();
        });
        
        it('should pause and resume polling', async () => {
            const PollingManager = getMockPollingManager();
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
            const PollingManager = getMockPollingManager();
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
            const PollingManager = getMockPollingManager();
            pollingManager = PollingManager.getInstance({ interval: 5000 });
            
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ tasks: [] })
            });
            
            await pollingManager.start();
            
            // Initial poll
            expect(mockFetch).toHaveBeenCalledTimes(1);
            
            // Advance timer by interval
            jest.advanceTimersByTime(5000);
            expect(mockFetch).toHaveBeenCalledTimes(2);
            
            // Advance again
            jest.advanceTimersByTime(5000);
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });
        
        it('should emit events on successful poll', async () => {
            const PollingManager = getMockPollingManager();
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
            
            await pollingManager.poll();
            
            expect(dataHandler).toHaveBeenCalledWith(mockData);
            expect(successHandler).toHaveBeenCalled();
        });
        
        it('should handle polling errors gracefully', async () => {
            const PollingManager = getMockPollingManager();
            pollingManager = PollingManager.getInstance();
            
            mockFetch.mockRejectedValue(new Error('Network error'));
            
            const errorHandler = jest.fn();
            pollingManager.on('poll:error', errorHandler);
            
            await pollingManager.poll();
            
            expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
            expect(pollingManager.retryCount).toBe(1);
        });
    });
    
    describe('Network Resilience', () => {
        it('should implement exponential backoff on failures', async () => {
            const PollingManager = getMockPollingManager();
            pollingManager = PollingManager.getInstance({
                interval: 5000,
                backoffMultiplier: 2,
                maxBackoffDelay: 20000
            });
            
            mockFetch.mockRejectedValue(new Error('Network error'));
            
            await pollingManager.start();
            
            // First retry after 2 seconds (base backoff)
            expect(pollingManager.retryDelay).toBe(2000);
            
            jest.advanceTimersByTime(2000);
            
            // Second retry after 4 seconds
            expect(pollingManager.retryDelay).toBe(4000);
            
            jest.advanceTimersByTime(4000);
            
            // Third retry after 8 seconds
            expect(pollingManager.retryDelay).toBe(8000);
        });
        
        it('should reset retry count on successful poll', async () => {
            const PollingManager = getMockPollingManager();
            pollingManager = PollingManager.getInstance();
            
            // Simulate failures
            mockFetch.mockRejectedValueOnce(new Error('Network error'));
            mockFetch.mockRejectedValueOnce(new Error('Network error'));
            
            await pollingManager.poll();
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
            const PollingManager = getMockPollingManager();
            pollingManager = PollingManager.getInstance({ maxRetries: 2 });
            
            mockFetch.mockRejectedValue(new Error('Network error'));
            
            const stopHandler = jest.fn();
            pollingManager.on('poll:maxRetries', stopHandler);
            
            await pollingManager.start();
            
            // Advance through retries
            jest.advanceTimersByTime(10000);
            
            expect(stopHandler).toHaveBeenCalled();
            expect(pollingManager.isPolling).toBe(false);
        });
    });
    
    describe('Event Emitter', () => {
        it('should support event subscription and unsubscription', () => {
            const PollingManager = getMockPollingManager();
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
            const PollingManager = getMockPollingManager();
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
            const PollingManager = getMockPollingManager();
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
            const PollingManager = getMockPollingManager();
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

// Mock implementation for testing
function getMockPollingManager() {
    class PollingManager {
        static instance = null;
        
        constructor() {
            if (PollingManager.instance) {
                throw new Error('Use PollingManager.getInstance()');
            }
        }
        
        static getInstance(config = {}) {
            if (!PollingManager.instance) {
                PollingManager.instance = new PollingManager();
                PollingManager.instance.init(config);
            }
            return PollingManager.instance;
        }
        
        init(config) {
            this.config = {
                interval: 30000,
                endpoint: '/api/tasks',
                enableDiffDetection: true,
                enableCaching: true,
                maxRetries: 3,
                backoffMultiplier: 2,
                maxBackoffDelay: 32000,
                ...config
            };
            
            // Validate config
            if (this.config.interval <= 0) {
                throw new Error('Interval must be positive');
            }
            if (this.config.maxRetries < 1) {
                throw new Error('Max retries must be at least 1');
            }
            
            this.isPolling = false;
            this.isPaused = false;
            this.pollTimer = null;
            this.retryCount = 0;
            this.retryDelay = 2000;
            this.events = {};
        }
        
        async start() {
            if (this.isPolling) return;
            this.isPolling = true;
            await this.poll();
        }
        
        stop() {
            this.isPolling = false;
            if (this.pollTimer) {
                clearTimeout(this.pollTimer);
                this.pollTimer = null;
            }
        }
        
        pause() {
            this.isPaused = true;
        }
        
        resume() {
            this.isPaused = false;
        }
        
        async poll() {
            try {
                const response = await fetch(this.config.endpoint);
                const data = await response.json();
                
                this.retryCount = 0;
                this.retryDelay = 2000;
                
                this.emit('data', data);
                this.emit('poll:success');
                
                if (this.isPolling && !this.isPaused) {
                    this.pollTimer = setTimeout(() => this.poll(), this.config.interval);
                }
            } catch (error) {
                this.retryCount++;
                this.emit('poll:error', error);
                
                if (this.retryCount >= this.config.maxRetries) {
                    this.emit('poll:maxRetries');
                    this.stop();
                } else {
                    this.retryDelay = Math.min(
                        this.retryDelay * this.config.backoffMultiplier,
                        this.config.maxBackoffDelay
                    );
                    
                    if (this.isPolling) {
                        this.pollTimer = setTimeout(() => this.poll(), this.retryDelay);
                    }
                }
            }
        }
        
        async refresh() {
            if (this.pollTimer) {
                clearTimeout(this.pollTimer);
            }
            await this.poll();
        }
        
        on(event, handler) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(handler);
        }
        
        once(event, handler) {
            const wrapper = (...args) => {
                handler(...args);
                this.off(event, wrapper);
            };
            this.on(event, wrapper);
        }
        
        off(event, handler) {
            if (this.events[event]) {
                this.events[event] = this.events[event].filter(h => h !== handler);
            }
        }
        
        emit(event, ...args) {
            if (this.events[event]) {
                this.events[event].forEach(handler => handler(...args));
            }
        }
        
        destroy() {
            this.stop();
            this.events = {};
            PollingManager.instance = null;
        }
    }
    
    return PollingManager;
}