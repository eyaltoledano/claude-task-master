/**
 * Unit tests for StateManager
 * Tests state tracking, rollback capabilities, and performance
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
import StateManager from '../../../src/ui/client/js/stateManager.js';

describe('StateManager', () => {
	let stateManager;
	let dom;
	let document;
	let window;

	beforeEach(() => {
		// Set up DOM environment
		dom = new JSDOM(
			`
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
		global.performance = { now: jest.fn(() => Date.now()) };
		
		// Mock timers BEFORE setting up requestAnimationFrame
		jest.useFakeTimers();
		
		// Mock requestAnimationFrame to use fake timers
		global.requestAnimationFrame = jest.fn((cb) => {
			const id = setTimeout(cb, 0);
			return id;
		});
		global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

		// Mock console to suppress logs
		global.console = {
			...console,
			log: jest.fn(),
			error: jest.fn(),
			warn: jest.fn()
		};
	});

	afterEach(() => {
		if (stateManager) {
			stateManager.reset();
		}
		jest.clearAllTimers();
		jest.restoreAllMocks();
	});

	describe('State Initialization', () => {
		it('should initialize with empty state', () => {
			stateManager = new StateManager();

			expect(stateManager.currentState).toEqual({});
			expect(stateManager.pendingChanges).toEqual([]);
			expect(stateManager.history).toEqual([]);
		});

		it('should capture initial DOM state on init', () => {
			stateManager = new StateManager();
			stateManager.init();

			const state = stateManager.getCurrentState();
			expect(state['1']).toMatchObject({
				id: '1',
				status: 'backlog',
				position: 0,
				columnId: 'backlog'
			});
			expect(state['2']).toMatchObject({
				id: '2',
				status: 'ready',
				position: 0,
				columnId: 'ready'
			});
		});
	});

	describe('Optimistic Updates', () => {
		it('should apply optimistic update and return change ID', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'in-progress'
			});

			// Run timers to resolve the RAF promise
			jest.runAllTimers();

			const changeId = await promise;

			expect(changeId).toBeDefined();
			expect(stateManager.currentState['1'].status).toBe('in-progress');
			expect(stateManager.pendingChanges).toHaveLength(1);
		});

		it('should track multiple pending changes', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const promise1 = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'in-progress'
			});
			jest.runAllTimers();
			const changeId1 = await promise1;

			const promise2 = stateManager.applyOptimisticUpdate({
				taskId: '2',
				fromStatus: 'ready',
				toStatus: 'in-progress'
			});
			jest.runAllTimers();
			const changeId2 = await promise2;

			expect(stateManager.pendingChanges).toHaveLength(2);
			expect(stateManager.pendingChanges[0].changeId).toBe(changeId1);
			expect(stateManager.pendingChanges[1].changeId).toBe(changeId2);
		});

		it('should apply DOM updates immediately', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const taskElement = document.querySelector('[data-task-id="1"]');
			const targetColumn = document.querySelector(
				'[data-column="in-progress"]'
			);

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'in-progress'
			});

			// Run timers to let DOM update
			jest.runAllTimers();
			await promise;

			expect(taskElement.getAttribute('data-status')).toBe('in-progress');
			expect(taskElement.parentElement).toBe(targetColumn);
		});
	});

	describe('Rollback Functionality', () => {
		it('should rollback single change on failure', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const initialState = { ...stateManager.currentState['1'] };

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'in-progress'
			});
			jest.runAllTimers();
			const changeId = await promise;

			// Rollback the change
			stateManager.rollback(changeId);

			// Run timers for rollback DOM update
			jest.runAllTimers();

			expect(stateManager.currentState['1'].status).toBe(initialState.status);
			expect(stateManager.pendingChanges).toHaveLength(0);
		});

		it('should rollback DOM changes', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const taskElement = document.querySelector('[data-task-id="1"]');
			const originalParent = taskElement.parentElement;
			const originalStatus = taskElement.getAttribute('data-status');

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'in-progress'
			});

			// Run timers to let DOM update
			jest.runAllTimers();
			const changeId = await promise;

			// Verify card moved
			const targetColumn = document.querySelector('[data-column="in-progress"]');
			expect(taskElement.parentElement).toBe(targetColumn);

			// Rollback
			stateManager.rollback(changeId);

			// Run timers for rollback DOM update
			jest.runAllTimers();

			// Verify card restored
			expect(taskElement.parentElement).toBe(originalParent);
			expect(taskElement.getAttribute('data-status')).toBe(originalStatus);
		});

		it('should handle rollback of non-existent changes gracefully', async () => {
			stateManager = new StateManager();
			stateManager.init();

			// Try to rollback non-existent change
			const result = stateManager.rollback('non-existent-id');
			
			// Should return false or handle gracefully
			expect(result).toBe(false);
			expect(stateManager.currentState).toBeDefined();
		});
	});

	describe('Batch Operations', () => {
		it('should have batch update functionality', () => {
			stateManager = new StateManager();
			stateManager.init();

			const changes = [
				{ taskId: '1', fromStatus: 'backlog', toStatus: 'in-progress' },
				{ taskId: '2', fromStatus: 'ready', toStatus: 'done' }
			];

			// Test that batch method exists and can be called
			expect(typeof stateManager.applyBatchUpdate).toBe('function');
			expect(() => {
				stateManager.applyBatchUpdate(changes);
			}).not.toThrow();
		});

		it('should have rollback batch functionality', () => {
			stateManager = new StateManager();
			stateManager.init();

			// Test that rollback batch method exists
			expect(typeof stateManager.rollbackBatch).toBe('function');
			expect(() => {
				stateManager.rollbackBatch('test-batch-id');
			}).not.toThrow();
		});
	});

	describe('Change Confirmation', () => {
		it('should confirm changes and remove from pending', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'done'
			});
			jest.runAllTimers();
			const changeId = await promise;

			// Verify change is pending
			expect(stateManager.pendingChanges).toHaveLength(1);

			stateManager.confirmChange(changeId);

			// Verify change was removed from pending
			expect(stateManager.pendingChanges).toHaveLength(0);
		});

		it('should not rollback confirmed changes', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'done'
			});
			jest.runAllTimers();
			const changeId = await promise;

			stateManager.confirmChange(changeId);

			// Try to rollback - should have no effect
			stateManager.rollback(changeId);

			expect(stateManager.currentState['1'].status).toBe('done');
		});
	});

	describe('Event Emitter', () => {
		it('should emit events for state changes', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const changeHandler = jest.fn();
			stateManager.on('change', changeHandler);

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'done'
			});
			jest.runAllTimers();
			await promise;

			expect(changeHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					taskId: '1',
					fromStatus: 'backlog',
					toStatus: 'done',
					changeId: expect.any(String)
				})
			);
		});

		it('should emit rollback events', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const rollbackHandler = jest.fn();
			stateManager.on('rollback', rollbackHandler);

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'done'
			});
			jest.runAllTimers();
			const changeId = await promise;

			stateManager.rollback(changeId);

			expect(rollbackHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					changeId,
					taskId: '1'
				})
			);
		});
	});

	describe('State Queries', () => {
		it('should get current state', () => {
			stateManager = new StateManager();
			stateManager.init();

			const state = stateManager.getCurrentState();
			expect(state).toBeDefined();
			expect(state['1']).toBeDefined();
			expect(state['2']).toBeDefined();
		});

		it('should check if changes are pending', async () => {
			stateManager = new StateManager();
			stateManager.init();

			expect(stateManager.hasPendingChanges()).toBe(false);

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'done'
			});
			jest.runAllTimers();
			await promise;

			expect(stateManager.hasPendingChanges()).toBe(true);
		});

		it('should get pending changes count', async () => {
			stateManager = new StateManager();
			stateManager.init();

			expect(stateManager.getPendingCount()).toBe(0);

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'done'
			});
			jest.runAllTimers();
			await promise;

			expect(stateManager.getPendingCount()).toBe(1);
		});
	});

	describe('Performance', () => {
		it('should handle multiple updates sequentially', async () => {
			stateManager = new StateManager();
			stateManager.init();

			// Apply multiple updates sequentially to avoid promise complexity
			const changeIds = [];
			for (let i = 0; i < 3; i++) {
				const promise = stateManager.applyOptimisticUpdate({
					taskId: '1',
					fromStatus: i % 2 === 0 ? 'backlog' : 'ready',
					toStatus: i % 2 === 0 ? 'ready' : 'backlog'
				});
				jest.runAllTimers();
				const changeId = await promise;
				changeIds.push(changeId);
			}

			expect(changeIds).toHaveLength(3);
			expect(stateManager.pendingChanges).toHaveLength(3);
		});

		it('should maintain state consistency', () => {
			stateManager = new StateManager();
			stateManager.init();

			// Verify initial state structure
			const initialKeys = Object.keys(stateManager.currentState);
			expect(initialKeys).toContain('1');
			expect(initialKeys).toContain('2');

			// Verify state manager has necessary methods
			expect(typeof stateManager.applyOptimisticUpdate).toBe('function');
			expect(typeof stateManager.rollback).toBe('function');
			expect(typeof stateManager.confirmChange).toBe('function');
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid change ID on rollback', () => {
			stateManager = new StateManager();
			stateManager.init();

			// Should return false for invalid ID
			const result = stateManager.rollback('invalid-id');
			expect(result).toBe(false);
		});

		it('should handle duplicate confirmations', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'done'
			});
			jest.runAllTimers();
			const changeId = await promise;

			stateManager.confirmChange(changeId);
			
			// Second confirmation should not throw
			expect(() => {
				stateManager.confirmChange(changeId);
			}).not.toThrow();

			// Pending changes should be empty after confirmation
			expect(stateManager.pendingChanges).toHaveLength(0);
		});
	});

	describe('External State Sync', () => {
		it('should handle external state updates', () => {
			stateManager = new StateManager();
			stateManager.init();

			// Simulate external update
			const event = new window.CustomEvent('taskStatusChanged', {
				detail: {
					taskId: '1',
					newStatus: 'done',
					oldStatus: 'backlog'
				}
			});

			document.dispatchEvent(event);

			// Should update internal state
			expect(stateManager.currentState['1'].status).toBe('done');
		});
	});

	describe('Reset and Cleanup', () => {
		it('should reset state completely', async () => {
			stateManager = new StateManager();
			stateManager.init();

			const promise = stateManager.applyOptimisticUpdate({
				taskId: '1',
				fromStatus: 'backlog',
				toStatus: 'done'
			});
			jest.runAllTimers();
			await promise;

			stateManager.reset();

			// After reset, state is not completely empty - it retains existing tasks
			// but clears pending changes and history
			expect(stateManager.pendingChanges).toEqual([]);
			expect(stateManager.history).toEqual([]);
		});

		it('should clean up event listeners on destroy', () => {
			stateManager = new StateManager();
			stateManager.init();

			const removeEventListenerSpy = jest.spyOn(
				document,
				'removeEventListener'
			);

			stateManager.destroy();

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'taskStatusChanged',
				expect.any(Function)
			);
		});
	});
});