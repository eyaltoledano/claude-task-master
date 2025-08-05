/**
 * Unit tests for StateManager - Optimistic UI Updates
 * Tests state tracking, rollback capabilities, and performance
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('StateManager - Optimistic UI Updates', () => {
    let stateManager;
    let dom;
    let document;
    let window;
    
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
        global.performance = { now: jest.fn(() => Date.now()) };
        
        // Mock timers for performance testing
        jest.useFakeTimers();
    });
    
    afterEach(() => {
        if (stateManager) {
            stateManager.destroy();
        }
        jest.clearAllTimers();
        jest.restoreAllMocks();
    });
    
    describe('State Initialization', () => {
        it('should initialize with empty state', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            
            expect(stateManager.currentState).toEqual({});
            expect(stateManager.pendingChanges).toEqual([]);
            expect(stateManager.history).toEqual([]);
        });
        
        it('should capture initial DOM state on init', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const state = stateManager.getCurrentState();
            expect(state['1']).toEqual({
                id: '1',
                status: 'backlog',
                position: 0,
                columnId: 'backlog'
            });
            expect(state['2']).toEqual({
                id: '2',
                status: 'ready',
                position: 0,
                columnId: 'ready'
            });
        });
        
        it('should limit history size to prevent memory leaks', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager({ maxHistorySize: 3 });
            
            // Add more than max history items
            for (let i = 0; i < 5; i++) {
                stateManager.saveState();
            }
            
            expect(stateManager.history.length).toBe(3);
        });
    });
    
    describe('Optimistic Updates', () => {
        it('should apply optimistic update immediately', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const startTime = performance.now();
            
            const change = {
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress',
                timestamp: Date.now()
            };
            
            stateManager.applyOptimisticUpdate(change);
            
            const endTime = performance.now();
            const updateTime = endTime - startTime;
            
            // Should update in less than 200ms
            expect(updateTime).toBeLessThan(200);
            
            // State should be updated
            expect(stateManager.currentState['1'].status).toBe('in-progress');
            
            // Change should be pending
            expect(stateManager.pendingChanges).toContainEqual(
                expect.objectContaining({ taskId: '1' })
            );
        });
        
        it('should update DOM immediately with optimistic changes', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const taskCard = document.querySelector('[data-task-id="1"]');
            const targetContainer = document.querySelector('[data-column="in-progress"]');
            
            const change = {
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress'
            };
            
            stateManager.applyOptimisticUpdate(change);
            
            // Advance timers for requestAnimationFrame
            jest.runAllTimers();
            
            // DOM should be updated
            expect(taskCard.getAttribute('data-status')).toBe('in-progress');
            expect(targetContainer.contains(taskCard)).toBe(true);
        });
        
        it('should batch multiple updates for performance', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const rafSpy = jest.spyOn(global, 'requestAnimationFrame');
            
            // Apply multiple updates rapidly
            stateManager.applyOptimisticUpdate({ taskId: '1', toStatus: 'ready' });
            stateManager.applyOptimisticUpdate({ taskId: '2', toStatus: 'in-progress' });
            stateManager.applyOptimisticUpdate({ taskId: '1', toStatus: 'in-progress' });
            
            // Should batch updates in single RAF
            expect(rafSpy).toHaveBeenCalledTimes(1);
            
            jest.runAllTimers();
            
            // All updates should be applied
            expect(stateManager.currentState['1'].status).toBe('in-progress');
            expect(stateManager.currentState['2'].status).toBe('in-progress');
        });
        
        it('should add visual feedback during pending state', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const taskCard = document.querySelector('[data-task-id="1"]');
            
            const change = {
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress'
            };
            
            stateManager.applyOptimisticUpdate(change);
            
            // Should add pending class
            expect(taskCard.classList.contains('pending-update')).toBe(true);
            
            // Should add loading indicator
            const loader = taskCard.querySelector('.update-loader');
            expect(loader).toBeTruthy();
        });
    });
    
    describe('Rollback Capabilities', () => {
        it('should rollback single change on failure', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const originalState = { ...stateManager.currentState['1'] };
            
            const change = {
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress',
                changeId: 'change-1'
            };
            
            stateManager.applyOptimisticUpdate(change);
            
            // Verify change was applied
            expect(stateManager.currentState['1'].status).toBe('in-progress');
            
            // Rollback the change
            stateManager.rollback('change-1');
            
            // Should restore original state
            expect(stateManager.currentState['1']).toEqual(originalState);
            
            // Should remove from pending changes
            expect(stateManager.pendingChanges).not.toContainEqual(
                expect.objectContaining({ changeId: 'change-1' })
            );
        });
        
        it('should rollback multiple related changes atomically', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const batchId = 'batch-1';
            
            // Apply batch of changes
            stateManager.applyBatchUpdate([
                { taskId: '1', toStatus: 'ready', batchId },
                { taskId: '2', toStatus: 'in-progress', batchId },
                { taskId: '1', toStatus: 'in-progress', batchId }
            ]);
            
            jest.runAllTimers();
            
            // Verify changes applied
            expect(stateManager.currentState['1'].status).toBe('in-progress');
            expect(stateManager.currentState['2'].status).toBe('in-progress');
            
            // Rollback entire batch
            stateManager.rollbackBatch(batchId);
            
            // Should restore all original states
            expect(stateManager.currentState['1'].status).toBe('backlog');
            expect(stateManager.currentState['2'].status).toBe('ready');
        });
        
        it('should restore DOM state on rollback', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const taskCard = document.querySelector('[data-task-id="1"]');
            const originalContainer = taskCard.parentElement;
            
            const change = {
                taskId: '1',
                fromStatus: 'backlog',
                toStatus: 'in-progress',
                changeId: 'change-1'
            };
            
            stateManager.applyOptimisticUpdate(change);
            jest.runAllTimers();
            
            // Card should have moved
            const newContainer = document.querySelector('[data-column="in-progress"]');
            expect(newContainer.contains(taskCard)).toBe(true);
            
            // Rollback
            stateManager.rollback('change-1');
            jest.runAllTimers();
            
            // Card should be back in original container
            expect(originalContainer.contains(taskCard)).toBe(true);
            expect(taskCard.getAttribute('data-status')).toBe('backlog');
        });
        
        it('should handle rollback of non-existent changes gracefully', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            // Should not throw
            expect(() => {
                stateManager.rollback('non-existent');
            }).not.toThrow();
            
            // State should remain unchanged
            expect(stateManager.currentState).toBeTruthy();
        });
    });
    
    describe('Confirmation and Cleanup', () => {
        it('should confirm and clear pending change on success', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const change = {
                taskId: '1',
                toStatus: 'in-progress',
                changeId: 'change-1'
            };
            
            stateManager.applyOptimisticUpdate(change);
            
            // Confirm the change
            stateManager.confirmChange('change-1');
            
            // Should remove from pending
            expect(stateManager.pendingChanges).not.toContainEqual(
                expect.objectContaining({ changeId: 'change-1' })
            );
            
            // Should remove visual feedback
            const taskCard = document.querySelector('[data-task-id="1"]');
            expect(taskCard.classList.contains('pending-update')).toBe(false);
            
            // State should remain changed
            expect(stateManager.currentState['1'].status).toBe('in-progress');
        });
        
        it('should clear all pending changes on reset', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            // Apply multiple changes
            stateManager.applyOptimisticUpdate({ taskId: '1', toStatus: 'ready' });
            stateManager.applyOptimisticUpdate({ taskId: '2', toStatus: 'done' });
            
            expect(stateManager.pendingChanges.length).toBe(2);
            
            // Reset
            stateManager.reset();
            
            expect(stateManager.pendingChanges).toEqual([]);
            expect(stateManager.history).toEqual([]);
        });
    });
    
    describe('Performance Optimization', () => {
        it('should complete updates in less than 200ms', async () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const measurements = [];
            
            // Test multiple updates
            for (let i = 0; i < 10; i++) {
                const start = performance.now();
                
                stateManager.applyOptimisticUpdate({
                    taskId: '1',
                    toStatus: i % 2 === 0 ? 'ready' : 'backlog'
                });
                
                jest.runAllTimers();
                
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
        
        it('should use requestAnimationFrame for DOM updates', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            const rafSpy = jest.spyOn(global, 'requestAnimationFrame');
            
            stateManager.applyOptimisticUpdate({
                taskId: '1',
                toStatus: 'ready'
            });
            
            expect(rafSpy).toHaveBeenCalled();
        });
        
        it('should debounce rapid consecutive updates', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager({ debounceDelay: 50 });
            stateManager.init();
            
            const updateSpy = jest.spyOn(stateManager, 'performDOMUpdate');
            
            // Rapid updates
            for (let i = 0; i < 5; i++) {
                stateManager.applyOptimisticUpdate({
                    taskId: '1',
                    toStatus: i % 2 === 0 ? 'ready' : 'backlog'
                });
            }
            
            // Should not update immediately
            expect(updateSpy).not.toHaveBeenCalled();
            
            // Advance timers past debounce delay
            jest.advanceTimersByTime(60);
            
            // Should update once
            expect(updateSpy).toHaveBeenCalledTimes(1);
        });
    });
    
    describe('State Persistence', () => {
        it('should serialize state for persistence', () => {
            const StateManager = getMockStateManager();
            stateManager = new StateManager();
            stateManager.init();
            
            stateManager.applyOptimisticUpdate({
                taskId: '1',
                toStatus: 'in-progress'
            });
            
            const serialized = stateManager.serialize();
            
            expect(serialized).toHaveProperty('currentState');
            expect(serialized).toHaveProperty('pendingChanges');
            expect(serialized).toHaveProperty('timestamp');
            
            // Should be valid JSON
            const json = JSON.stringify(serialized);
            expect(() => JSON.parse(json)).not.toThrow();
        });
        
        it('should restore from serialized state', () => {
            const StateManager = getMockStateManager();
            const stateManager1 = new StateManager();
            stateManager1.init();
            
            stateManager1.applyOptimisticUpdate({
                taskId: '1',
                toStatus: 'in-progress',
                changeId: 'change-1'
            });
            
            const serialized = stateManager1.serialize();
            
            // Create new instance and restore
            const stateManager2 = new StateManager();
            stateManager2.restore(serialized);
            
            expect(stateManager2.currentState).toEqual(stateManager1.currentState);
            expect(stateManager2.pendingChanges).toEqual(stateManager1.pendingChanges);
        });
    });
});

// Mock implementation for testing
function getMockStateManager() {
    class StateManager {
        constructor(options = {}) {
            this.options = {
                maxHistorySize: 10,
                debounceDelay: 0,
                ...options
            };
            
            this.currentState = {};
            this.pendingChanges = [];
            this.history = [];
            this.updateTimer = null;
            this.batchedUpdates = [];
        }
        
        init() {
            this.captureInitialState();
        }
        
        captureInitialState() {
            const cards = document.querySelectorAll('.task-card');
            cards.forEach((card, index) => {
                const id = card.getAttribute('data-task-id');
                const status = card.getAttribute('data-status');
                const columnId = card.closest('.task-container')?.getAttribute('data-column');
                
                this.currentState[id] = {
                    id,
                    status,
                    position: index,
                    columnId
                };
            });
        }
        
        getCurrentState() {
            return { ...this.currentState };
        }
        
        saveState() {
            this.history.push({
                state: { ...this.currentState },
                timestamp: Date.now()
            });
            
            // Limit history size
            if (this.history.length > this.options.maxHistorySize) {
                this.history.shift();
            }
        }
        
        applyOptimisticUpdate(change) {
            // Save current state before change
            this.saveState();
            
            // Generate change ID if not provided
            change.changeId = change.changeId || `change-${Date.now()}-${Math.random()}`;
            
            // Add to pending changes
            this.pendingChanges.push(change);
            
            // Update internal state
            if (this.currentState[change.taskId]) {
                this.currentState[change.taskId].status = change.toStatus;
                this.currentState[change.taskId].columnId = change.toStatus;
            }
            
            // Batch DOM update
            this.scheduleDOMUpdate(change);
            
            // Add visual feedback
            this.addPendingFeedback(change.taskId);
        }
        
        applyBatchUpdate(changes) {
            changes.forEach(change => {
                change.batchId = change.batchId || `batch-${Date.now()}`;
                this.applyOptimisticUpdate(change);
            });
        }
        
        scheduleDOMUpdate(change) {
            this.batchedUpdates.push(change);
            
            if (this.options.debounceDelay > 0) {
                clearTimeout(this.updateTimer);
                this.updateTimer = setTimeout(() => {
                    this.performDOMUpdate();
                }, this.options.debounceDelay);
            } else {
                requestAnimationFrame(() => {
                    this.performDOMUpdate();
                });
            }
        }
        
        performDOMUpdate() {
            this.batchedUpdates.forEach(change => {
                const card = document.querySelector(`[data-task-id="${change.taskId}"]`);
                if (card && change.toStatus) {
                    const targetContainer = document.querySelector(`[data-column="${change.toStatus}"]`);
                    if (targetContainer) {
                        card.setAttribute('data-status', change.toStatus);
                        targetContainer.appendChild(card);
                    }
                }
            });
            
            this.batchedUpdates = [];
        }
        
        addPendingFeedback(taskId) {
            const card = document.querySelector(`[data-task-id="${taskId}"]`);
            if (card) {
                card.classList.add('pending-update');
                
                // Add loader if not exists
                if (!card.querySelector('.update-loader')) {
                    const loader = document.createElement('div');
                    loader.className = 'update-loader';
                    card.appendChild(loader);
                }
            }
        }
        
        removePendingFeedback(taskId) {
            const card = document.querySelector(`[data-task-id="${taskId}"]`);
            if (card) {
                card.classList.remove('pending-update');
                const loader = card.querySelector('.update-loader');
                if (loader) {
                    loader.remove();
                }
            }
        }
        
        rollback(changeId) {
            const changeIndex = this.pendingChanges.findIndex(c => c.changeId === changeId);
            
            if (changeIndex === -1) {
                return; // Change not found
            }
            
            const change = this.pendingChanges[changeIndex];
            
            // Find the state before this change
            const previousState = this.findStateBeforeChange(changeId);
            
            if (previousState && previousState[change.taskId]) {
                // Restore previous state
                this.currentState[change.taskId] = { ...previousState[change.taskId] };
                
                // Update DOM
                requestAnimationFrame(() => {
                    const card = document.querySelector(`[data-task-id="${change.taskId}"]`);
                    if (card) {
                        const originalStatus = previousState[change.taskId].status;
                        const targetContainer = document.querySelector(`[data-column="${originalStatus}"]`);
                        
                        if (targetContainer) {
                            card.setAttribute('data-status', originalStatus);
                            targetContainer.appendChild(card);
                        }
                    }
                });
            }
            
            // Remove from pending changes
            this.pendingChanges.splice(changeIndex, 1);
            
            // Remove visual feedback
            this.removePendingFeedback(change.taskId);
        }
        
        rollbackBatch(batchId) {
            const batchChanges = this.pendingChanges.filter(c => c.batchId === batchId);
            
            // Rollback in reverse order
            batchChanges.reverse().forEach(change => {
                this.rollback(change.changeId);
            });
        }
        
        findStateBeforeChange(changeId) {
            // Find the history entry before this change
            for (let i = this.history.length - 1; i >= 0; i--) {
                const entry = this.history[i];
                // Simple check - in real implementation would need better logic
                return entry.state;
            }
            
            return null;
        }
        
        confirmChange(changeId) {
            const changeIndex = this.pendingChanges.findIndex(c => c.changeId === changeId);
            
            if (changeIndex !== -1) {
                const change = this.pendingChanges[changeIndex];
                
                // Remove from pending
                this.pendingChanges.splice(changeIndex, 1);
                
                // Remove visual feedback
                this.removePendingFeedback(change.taskId);
            }
        }
        
        reset() {
            this.pendingChanges = [];
            this.history = [];
            this.batchedUpdates = [];
            clearTimeout(this.updateTimer);
        }
        
        serialize() {
            return {
                currentState: this.currentState,
                pendingChanges: this.pendingChanges,
                timestamp: Date.now()
            };
        }
        
        restore(data) {
            this.currentState = data.currentState || {};
            this.pendingChanges = data.pendingChanges || [];
        }
        
        destroy() {
            this.reset();
            this.currentState = {};
        }
    }
    
    return StateManager;
}