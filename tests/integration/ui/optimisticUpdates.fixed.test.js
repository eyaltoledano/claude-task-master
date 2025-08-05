/**
 * Integration tests for Tasks 110.2 and 110.3
 * Tests Optimistic UI Updates and API Retry Logic together
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Integration: Optimistic Updates + API Retry', () => {
    let dom;
    let document;
    let window;
    let StateManager;
    let APIClient;
    
    beforeEach(async () => {
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
        
        // Load the actual implementations
        const stateManagerPath = path.join(__dirname, '../../../src/ui/client/js/stateManager.js');
        const apiClientPath = path.join(__dirname, '../../../src/ui/client/js/apiClient.js');
        
        // Read and evaluate the modules in the test context
        const stateManagerCode = fs.readFileSync(stateManagerPath, 'utf8');
        const apiClientCode = fs.readFileSync(apiClientPath, 'utf8');
        
        // Create a simple module loader
        const loadModule = (code) => {
            const module = { exports: {} };
            const exports = module.exports;
            
            // Wrap in function to create scope
            const fn = new Function('module', 'exports', 'document', 'window', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', code);
            fn(module, exports, document, window, global.performance, global.requestAnimationFrame, global.cancelAnimationFrame);
            
            return module.exports;
        };
        
        // Extract the class definitions (simplified approach)
        // Since these are browser modules, we'll use eval in test context
        eval(stateManagerCode.replace('export default', 'StateManager ='));
        eval(apiClientCode.replace('export', ''));
        
        // Mock timers
        jest.useFakeTimers();
    });
    
    afterEach(() => {
        jest.clearAllTimers();
        jest.restoreAllMocks();
    });
    
    describe('Performance Requirements', () => {
        it('should complete optimistic update in <200ms', async () => {
            const stateManager = new StateManager();
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
            const stateManager = new StateManager();
            stateManager.init();
            
            const apiClient = new APIClient({
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
            const stateManager = new StateManager();
            stateManager.init();
            
            const apiClient = new APIClient({
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
            const apiClient = new APIClient({
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
            const apiClient = new APIClient({
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
});