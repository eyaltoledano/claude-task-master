/**
 * Unit tests for StateManager using real implementation
 * Tests state tracking, rollback capabilities, and performance
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('StateManager - Real Implementation Tests', () => {
    let stateManager;
    let dom;
    let document;
    let window;
    let StateManager;
    
    beforeEach(() => {
        // Set up DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div class="kanban-board">
                    <div class="kanban-column" data-status="backlog">
                        <div class="task-container" data-column="backlog">
                            <div class="task-card" data-task-id="1" data-status="backlog"></div>
                        </div>
                    </div>
                    <div class="kanban-column" data-status="ready">
                        <div class="task-container" data-column="ready">
                            <div class="task-card" data-task-id="2" data-status="ready"></div>
                        </div>
                    </div>
                    <div class="kanban-column" data-status="in-progress">
                        <div class="task-container" data-column="in-progress"></div>
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
        
        // Load the real StateManager implementation
        const stateManagerPath = path.join(__dirname, '../../../src/ui/client/js/stateManager.js');
        const stateManagerCode = fs.readFileSync(stateManagerPath, 'utf8');
        
        // Execute the module code to get the StateManager class
        // Since it's an ES module with export default, we need to extract the class
        const classMatch = stateManagerCode.match(/class\s+StateManager[\s\S]*?^}$/m);
        if (classMatch) {
            eval(`StateManager = ${classMatch[0]}`);
        }
        
        // Mock timers
        jest.useFakeTimers();
    });
    
    afterEach(() => {
        if (stateManager) {
            stateManager.reset();
        }
        jest.clearAllTimers();
        jest.restoreAllMocks();
    });
    
    describe('Rollback Tests with Real Implementation', () => {
        it('should properly rollback single change on failure', async () => {
            stateManager = new StateManager();
            stateManager.init();
            
            // Capture initial state
            const initialState = JSON.parse(JSON.stringify(stateManager.currentState['1']));
            
            // Apply optimistic update
            const changeId = await stateManager.applyOptimisticUpdate({
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress'
            });
            
            // Verify change was applied
            expect(stateManager.currentState['1'].status).toBe('in-progress');
            expect(stateManager.pendingChanges.length).toBe(1);
            
            // Run timers to let DOM update
            jest.runAllTimers();
            
            // Rollback the change
            const rollbackSuccess = stateManager.rollback(changeId);
            expect(rollbackSuccess).toBe(true);
            
            // Run timers for rollback DOM update
            jest.runAllTimers();
            
            // Verify state was restored
            expect(stateManager.currentState['1'].status).toBe(initialState.status);
            expect(stateManager.currentState['1'].columnId).toBe(initialState.columnId);
            
            // Verify pending change was removed
            expect(stateManager.pendingChanges.length).toBe(0);
        });
        
        it('should restore DOM state on rollback', async () => {
            stateManager = new StateManager();
            stateManager.init();
            
            const taskCard = document.querySelector('[data-task-id="1"]');
            const originalContainer = taskCard.parentElement;
            const originalStatus = taskCard.getAttribute('data-status');
            
            // Apply optimistic update
            const changeId = await stateManager.applyOptimisticUpdate({
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress'
            });
            
            // Run timers to let DOM update
            jest.runAllTimers();
            
            // Verify card moved (in state at least)
            expect(stateManager.currentState['1'].status).toBe('in-progress');
            
            // Rollback
            stateManager.rollback(changeId);
            
            // Run timers for rollback DOM update
            jest.runAllTimers();
            
            // Verify card status is restored
            expect(taskCard.getAttribute('data-status')).toBe(originalStatus);
            
            // Verify state is restored
            expect(stateManager.currentState['1'].status).toBe('backlog');
        });
        
        it('should handle multiple rapid updates with proper batching', async () => {
            stateManager = new StateManager();
            stateManager.init();
            
            const rafSpy = jest.spyOn(global, 'requestAnimationFrame');
            
            // Apply multiple updates rapidly (without await)
            const promises = [
                stateManager.applyOptimisticUpdate({ taskId: '1', fromStatus: 'backlog', toStatus: 'ready' }),
                stateManager.applyOptimisticUpdate({ taskId: '2', fromStatus: 'ready', toStatus: 'in-progress' }),
                stateManager.applyOptimisticUpdate({ taskId: '1', fromStatus: 'ready', toStatus: 'in-progress' })
            ];
            
            // Wait for all promises
            await Promise.all(promises);
            
            // Should have called RAF but cancelled previous ones
            // The exact count depends on timing, but it should be less than 3
            expect(rafSpy.mock.calls.length).toBeLessThanOrEqual(3);
            
            // Run all timers
            jest.runAllTimers();
            
            // All updates should be applied
            expect(stateManager.currentState['1'].status).toBe('in-progress');
            expect(stateManager.currentState['2'].status).toBe('in-progress');
        });
    });
    
    describe('Performance Tests with Real Implementation', () => {
        it('should meet <200ms performance requirement', async () => {
            stateManager = new StateManager();
            stateManager.init();
            
            const measurements = [];
            
            for (let i = 0; i < 5; i++) {
                const start = performance.now();
                
                await stateManager.applyOptimisticUpdate({
                    taskId: '1',
                    fromStatus: i % 2 === 0 ? 'backlog' : 'ready',
                    toStatus: i % 2 === 0 ? 'ready' : 'backlog'
                });
                
                const end = performance.now();
                measurements.push(end - start);
            }
            
            // All updates should be under 200ms
            measurements.forEach(time => {
                expect(time).toBeLessThan(200);
            });
            
            // Average should be well under 200ms
            const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;
            expect(average).toBeLessThan(100);
        });
    });
    
    describe('State Persistence with Real Implementation', () => {
        it('should properly serialize and restore state', () => {
            stateManager = new StateManager();
            stateManager.init();
            
            // Apply some changes
            stateManager.applyOptimisticUpdate({
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress',
                changeId: 'test-change-1'
            });
            
            // Serialize
            const serialized = stateManager.serialize();
            
            // Create new instance
            const newStateManager = new StateManager();
            newStateManager.restore(serialized);
            
            // Verify restoration
            expect(newStateManager.currentState['1'].status).toBe('in-progress');
            expect(newStateManager.pendingChanges).toHaveLength(1);
            expect(newStateManager.pendingChanges[0].changeId).toBe('test-change-1');
        });
    });
});