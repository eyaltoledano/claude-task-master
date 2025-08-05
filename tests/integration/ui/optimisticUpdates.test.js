/**
 * Integration tests for Tasks 110.2 and 110.3
 * Tests Optimistic UI Updates and API Retry Logic together
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('Integration: Optimistic Updates + API Retry', () => {
    let dom;
    let document;
    let window;
    let stateManager;
    let apiClient;
    let kanban;
    
    beforeEach(() => {
        // Set up DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div class="kanban-board">
                    <div class="kanban-column" data-column="backlog">
                        <div class="task-container" data-column="backlog">
                            <div class="task-card" data-task-id="1" data-status="backlog">
                                <div class="task-title">Task 1</div>
                            </div>
                        </div>
                    </div>
                    <div class="kanban-column" data-column="ready">
                        <div class="task-container" data-column="ready"></div>
                    </div>
                    <div class="kanban-column" data-column="in-progress">
                        <div class="task-container" data-column="in-progress"></div>
                    </div>
                    <div class="kanban-column" data-column="completed">
                        <div class="task-container" data-column="completed"></div>
                    </div>
                </div>
            </body>
            </html>
        `, {
            url: 'http://localhost:3000',
            pretendToBeVisual: true
        });
        
        document = dom.window.document;
        window = dom.window;
        
        // Set up globals
        global.document = document;
        global.window = window;
        global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
        global.cancelAnimationFrame = jest.fn();
        global.performance = { now: jest.fn(() => Date.now()) };
        global.fetch = jest.fn();
        
        // Mock timers
        jest.useFakeTimers();
    });
    
    afterEach(() => {
        jest.clearAllTimers();
        jest.restoreAllMocks();
    });
    
    describe('Performance Requirements', () => {
        it('should complete optimistic update in <200ms', async () => {
            // Load actual implementations
            const StateManager = require('../../../src/ui/client/js/stateManager.js');
            const APIClient = require('../../../src/ui/client/js/apiClient.js').APIClient;
            
            stateManager = new StateManager();
            stateManager.init();
            
            const startTime = performance.now();
            
            // Apply optimistic update
            const changeId = await stateManager.applyOptimisticUpdate({
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress'
            });
            
            jest.runAllTimers();
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Should meet <200ms requirement
            expect(duration).toBeLessThan(200);
            
            // Verify DOM was updated
            const taskCard = document.querySelector('[data-task-id="1"]');
            expect(taskCard.getAttribute('data-status')).toBe('in-progress');
            
            // Verify visual feedback was added
            expect(taskCard.classList.contains('pending-update')).toBe(true);
            
            // Verify state was updated
            expect(stateManager.currentState['1'].status).toBe('in-progress');
        });
    });
    
    describe('Optimistic Update with API Success', () => {
        it('should confirm changes when API succeeds', async () => {
            const StateManager = require('../../../src/ui/client/js/stateManager.js');
            const APIClient = require('../../../src/ui/client/js/apiClient.js').APIClient;
            
            stateManager = new StateManager();
            stateManager.init();
            
            apiClient = new APIClient({
                maxRetries: 0, // No retries for this test
                timeout: 5000
            });
            
            // Mock successful API response
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, task: { id: '1', status: 'in-progress' } })
            });
            
            // Apply optimistic update
            const changeId = await stateManager.applyOptimisticUpdate({
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress'
            });
            
            // Execute API call
            const result = await apiClient.updateTaskStatus('1', 'in-progress');
            
            // Confirm the change
            stateManager.confirmChange(changeId);
            
            // Verify pending feedback is removed
            const taskCard = document.querySelector('[data-task-id="1"]');
            expect(taskCard.classList.contains('pending-update')).toBe(false);
            
            // Verify no pending changes remain
            expect(stateManager.getPendingCount()).toBe(0);
        });
    });
    
    describe('Optimistic Update with API Failure and Rollback', () => {
        it('should rollback changes when API fails after retries', async () => {
            const StateManager = require('../../../src/ui/client/js/stateManager.js');
            const APIClient = require('../../../src/ui/client/js/apiClient.js').APIClient;
            
            stateManager = new StateManager();
            stateManager.init();
            
            apiClient = new APIClient({
                maxRetries: 2,
                retryDelay: 100,
                backoffMultiplier: 2
            });
            
            // Mock API failures
            global.fetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'));
            
            // Apply optimistic update
            const changeId = await stateManager.applyOptimisticUpdate({
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress'
            });
            
            // Verify optimistic update was applied
            expect(stateManager.currentState['1'].status).toBe('in-progress');
            
            try {
                // Execute API call (will fail after retries)
                await apiClient.updateTaskStatus('1', 'in-progress');
            } catch (error) {
                // Rollback the change
                stateManager.rollback(changeId);
            }
            
            // Advance timers for animations
            jest.runAllTimers();
            
            // Verify state was rolled back
            expect(stateManager.currentState['1'].status).toBe('backlog');
            
            // Verify DOM was rolled back
            const taskCard = document.querySelector('[data-task-id="1"]');
            expect(taskCard.getAttribute('data-status')).toBe('backlog');
            
            // Verify visual feedback was removed
            expect(taskCard.classList.contains('pending-update')).toBe(false);
        });
    });
    
    describe('API Retry Logic', () => {
        it('should retry failed requests with exponential backoff', async () => {
            const APIClient = require('../../../src/ui/client/js/apiClient.js').APIClient;
            
            apiClient = new APIClient({
                maxRetries: 3,
                retryDelay: 1000,
                backoffMultiplier: 2,
                maxDelay: 8000
            });
            
            let fetchCallCount = 0;
            
            // Mock API failures then success
            global.fetch
                .mockImplementation(() => {
                    fetchCallCount++;
                    if (fetchCallCount <= 2) {
                        return Promise.reject(new Error('Network error'));
                    }
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({ success: true })
                    });
                });
            
            const promise = apiClient.updateTaskStatus('1', 'in-progress');
            
            // Advance through retry delays
            jest.advanceTimersByTime(1000); // First retry after 1000ms
            jest.advanceTimersByTime(2000); // Second retry after 2000ms (exponential backoff)
            
            const result = await promise;
            
            // Should have retried and succeeded
            expect(fetchCallCount).toBe(3);
            expect(result.success).toBe(true);
            
            // Check statistics
            const stats = apiClient.getQueueStatus().stats;
            expect(stats.retriedRequests).toBe(2);
            expect(stats.successfulRequests).toBe(1);
        });
        
        it('should handle timeout errors appropriately', async () => {
            const APIClient = require('../../../src/ui/client/js/apiClient.js').APIClient;
            
            apiClient = new APIClient({
                maxRetries: 1,
                timeout: 100 // Very short timeout
            });
            
            // Mock slow API response
            global.fetch.mockImplementation(() => 
                new Promise(resolve => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            json: async () => ({ success: true })
                        });
                    }, 200); // Longer than timeout
                })
            );
            
            try {
                await apiClient.updateTaskStatus('1', 'in-progress');
                expect(true).toBe(false); // Should not reach here
            } catch (error) {
                expect(error.message).toContain('timeout');
                expect(error.context.errorType).toBe('timeout');
            }
        });
    });
    
    describe('Request Queuing', () => {
        it('should queue and process requests in order', async () => {
            const APIClient = require('../../../src/ui/client/js/apiClient.js').APIClient;
            
            apiClient = new APIClient({
                enableQueuing: true,
                maxRetries: 0
            });
            
            const results = [];
            
            // Mock API responses with delays
            global.fetch
                .mockImplementationOnce(async () => {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    results.push('request-1');
                    return { ok: true, json: async () => ({ id: 1 }) };
                })
                .mockImplementationOnce(async () => {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    results.push('request-2');
                    return { ok: true, json: async () => ({ id: 2 }) };
                })
                .mockImplementationOnce(async () => {
                    results.push('request-3');
                    return { ok: true, json: async () => ({ id: 3 }) };
                });
            
            // Send multiple requests rapidly
            const promise1 = apiClient.updateTaskStatus('1', 'ready');
            const promise2 = apiClient.updateTaskStatus('2', 'in-progress');
            const promise3 = apiClient.updateTaskStatus('3', 'done');
            
            // Process queue
            jest.runAllTimers();
            
            await Promise.all([promise1, promise2, promise3]);
            
            // Verify requests were processed in order
            expect(results).toEqual(['request-1', 'request-2', 'request-3']);
            
            // Check queue statistics
            const status = apiClient.getQueueStatus();
            expect(status.stats.queuedRequests).toBe(3);
        });
        
        it('should coalesce duplicate requests', async () => {
            const APIClient = require('../../../src/ui/client/js/apiClient.js').APIClient;
            
            apiClient = new APIClient({
                enableQueuing: true,
                maxRetries: 0
            });
            
            let fetchCallCount = 0;
            
            // Mock API response
            global.fetch.mockImplementation(async () => {
                fetchCallCount++;
                return { ok: true, json: async () => ({ success: true }) };
            });
            
            // Send duplicate requests rapidly
            const promise1 = apiClient.updateTaskStatus('1', 'in-progress');
            const promise2 = apiClient.updateTaskStatus('1', 'in-progress'); // Duplicate
            const promise3 = apiClient.updateTaskStatus('1', 'in-progress'); // Duplicate
            
            jest.runAllTimers();
            
            const results = await Promise.all([promise1, promise2, promise3]);
            
            // All should succeed with same result
            expect(results[0]).toEqual(results[1]);
            expect(results[1]).toEqual(results[2]);
            
            // But only one actual API call should be made
            expect(fetchCallCount).toBe(1);
        });
    });
    
    describe('Full Integration Scenario', () => {
        it('should handle drag-drop with optimistic updates and retry logic', async () => {
            const StateManager = require('../../../src/ui/client/js/stateManager.js');
            const APIClient = require('../../../src/ui/client/js/apiClient.js').APIClient;
            
            // Initialize components
            stateManager = new StateManager();
            stateManager.init();
            
            apiClient = new APIClient({
                maxRetries: 2,
                retryDelay: 500
            });
            
            // Simulate drag-drop operation
            const taskCard = document.querySelector('[data-task-id="1"]');
            const targetContainer = document.querySelector('[data-column="in-progress"]');
            
            // Apply optimistic update (as would happen in handleSortableEnd)
            const changeId = await stateManager.applyOptimisticUpdate({
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress'
            });
            
            // DOM should update immediately
            jest.runAllTimers();
            expect(targetContainer.contains(taskCard)).toBe(true);
            expect(taskCard.classList.contains('pending-update')).toBe(true);
            
            // Mock API failure then success
            global.fetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true })
                });
            
            // Execute API call with retry
            const apiPromise = apiClient.updateTaskStatus('1', 'in-progress');
            
            // Advance through retry delay
            jest.advanceTimersByTime(500);
            
            const result = await apiPromise;
            
            // Confirm the change
            stateManager.confirmChange(changeId);
            
            // Verify final state
            expect(stateManager.currentState['1'].status).toBe('in-progress');
            expect(taskCard.classList.contains('pending-update')).toBe(false);
            expect(result.success).toBe(true);
            
            // Check retry statistics
            const stats = apiClient.getQueueStatus().stats;
            expect(stats.retriedRequests).toBe(1);
            expect(stats.successfulRequests).toBe(1);
        });
    });
});