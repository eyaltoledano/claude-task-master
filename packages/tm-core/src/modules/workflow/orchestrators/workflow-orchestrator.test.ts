import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowOrchestrator } from '../orchestrators/workflow-orchestrator.js';
import type {
	WorkflowContext,
	WorkflowPhase,
	WorkflowEventData,
	WorkflowError
} from '../types.js';
import { TestResultValidator } from '../services/test-result-validator.js';
import type { TestResult } from '../services/test-result-validator.types.js';

describe('WorkflowOrchestrator - State Machine Structure', () => {
	let orchestrator: WorkflowOrchestrator;
	let initialContext: WorkflowContext;

	beforeEach(() => {
		initialContext = {
			taskId: 'task-1',
			subtasks: [
				{ id: '1.1', title: 'Subtask 1', status: 'pending', attempts: 0 },
				{ id: '1.2', title: 'Subtask 2', status: 'pending', attempts: 0 }
			],
			currentSubtaskIndex: 0,
			errors: [],
			metadata: {}
		};
		orchestrator = new WorkflowOrchestrator(initialContext);
	});

	describe('Initial State', () => {
		it('should start in PREFLIGHT phase', () => {
			expect(orchestrator.getCurrentPhase()).toBe('PREFLIGHT');
		});

		it('should have the provided context', () => {
			const context = orchestrator.getContext();
			expect(context.taskId).toBe('task-1');
			expect(context.subtasks).toHaveLength(2);
		});
	});

	describe('State Transitions', () => {
		it('should transition from PREFLIGHT to BRANCH_SETUP', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			expect(orchestrator.getCurrentPhase()).toBe('BRANCH_SETUP');
		});

		it('should transition from BRANCH_SETUP to SUBTASK_LOOP', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
			expect(orchestrator.getCurrentPhase()).toBe('SUBTASK_LOOP');
		});

		it('should store branch name in context', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
			expect(orchestrator.getContext().branchName).toBe('feature/test');
		});

		it('should transition from SUBTASK_LOOP to FINALIZE when all subtasks complete', () => {
			// Navigate to SUBTASK_LOOP
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			// Complete all subtasks
			orchestrator.transition({ type: 'ALL_SUBTASKS_COMPLETE' });
			expect(orchestrator.getCurrentPhase()).toBe('FINALIZE');
		});

		it('should transition from FINALIZE to COMPLETE', () => {
			// Navigate to FINALIZE
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
			orchestrator.transition({ type: 'ALL_SUBTASKS_COMPLETE' });

			// Complete finalization
			orchestrator.transition({ type: 'FINALIZE_COMPLETE' });
			expect(orchestrator.getCurrentPhase()).toBe('COMPLETE');
		});

		it('should reject invalid transitions', () => {
			expect(() => {
				orchestrator.transition({ type: 'FINALIZE_COMPLETE' });
			}).toThrow('Invalid transition');
		});
	});

	describe('TDD Cycle in SUBTASK_LOOP', () => {
		beforeEach(() => {
			// Navigate to SUBTASK_LOOP
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
		});

		it('should start with RED phase when entering SUBTASK_LOOP', () => {
			expect(orchestrator.getCurrentTDDPhase()).toBe('RED');
		});

		it('should transition from RED to GREEN', () => {
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			expect(orchestrator.getCurrentTDDPhase()).toBe('GREEN');
		});

		it('should transition from GREEN to COMMIT', () => {
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			expect(orchestrator.getCurrentTDDPhase()).toBe('COMMIT');
		});

		it('should complete subtask after COMMIT', () => {
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });

			const context = orchestrator.getContext();
			expect(context.subtasks[0].status).toBe('completed');
		});

		it('should move to next subtask after completion', () => {
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });
			orchestrator.transition({ type: 'SUBTASK_COMPLETE' });

			expect(orchestrator.getContext().currentSubtaskIndex).toBe(1);
			expect(orchestrator.getCurrentTDDPhase()).toBe('RED');
		});
	});

	describe('State Serialization', () => {
		it('should serialize current state', () => {
			const state = orchestrator.getState();
			expect(state).toHaveProperty('phase');
			expect(state).toHaveProperty('context');
			expect(state.phase).toBe('PREFLIGHT');
		});

		it('should restore from serialized state', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			const state = orchestrator.getState();
			const restored = new WorkflowOrchestrator(state.context);
			restored.restoreState(state);

			expect(restored.getCurrentPhase()).toBe('SUBTASK_LOOP');
			expect(restored.getContext().branchName).toBe('feature/test');
		});
	});

	describe('Event Emission', () => {
		it('should emit phase:entered event on state transition', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('phase:entered', (event) => events.push(event));

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('phase:entered');
			expect(events[0].phase).toBe('BRANCH_SETUP');
		});

		it('should emit phase:exited event on state transition', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('phase:exited', (event) => events.push(event));

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('phase:exited');
			expect(events[0].phase).toBe('PREFLIGHT');
		});

		it('should emit tdd phase events', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('tdd:red:started', (event) => events.push(event));
			orchestrator.on('tdd:green:started', (event) => events.push(event));

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('tdd:red:started');

			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			expect(events).toHaveLength(2);
			expect(events[1].type).toBe('tdd:green:started');
		});

		it('should emit subtask events', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('subtask:started', (event) => events.push(event));
			orchestrator.on('subtask:completed', (event) => events.push(event));

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('subtask:started');
			expect(events[0].subtaskId).toBe('1.1');

			// Complete TDD cycle
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });
			orchestrator.transition({ type: 'SUBTASK_COMPLETE' });

			expect(events).toHaveLength(3);
			expect(events[1].type).toBe('subtask:completed');
			expect(events[2].type).toBe('subtask:started');
			expect(events[2].subtaskId).toBe('1.2');
		});

		it('should support multiple listeners for same event', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			orchestrator.on('phase:entered', listener1);
			orchestrator.on('phase:entered', listener2);

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

			expect(listener1).toHaveBeenCalledOnce();
			expect(listener2).toHaveBeenCalledOnce();
		});

		it('should allow removing event listeners', () => {
			const listener = vi.fn();
			orchestrator.on('phase:entered', listener);
			orchestrator.off('phase:entered', listener);

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

			expect(listener).not.toHaveBeenCalled();
		});

		it('should include timestamp in all events', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('phase:entered', (event) => events.push(event));

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

			expect(events[0].timestamp).toBeInstanceOf(Date);
		});

		it('should include additional data in events', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('git:branch:created', (event) => events.push(event));

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			const branchEvent = events.find((e) => e.type === 'git:branch:created');
			expect(branchEvent).toBeDefined();
			expect(branchEvent?.data?.branchName).toBe('feature/test');
		});
	});

	describe('State Persistence', () => {
		it('should persist state after transitions when auto-persist enabled', async () => {
			const persistMock = vi.fn();
			orchestrator.enableAutoPersist(persistMock);

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

			expect(persistMock).toHaveBeenCalledOnce();
			const state = persistMock.mock.calls[0][0];
			expect(state.phase).toBe('BRANCH_SETUP');
		});

		it('should emit state:persisted event', async () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('state:persisted', (event) => events.push(event));

			await orchestrator.persistState();

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('state:persisted');
		});

		it('should auto-persist after each transition when enabled', () => {
			const persistMock = vi.fn();
			orchestrator.enableAutoPersist(persistMock);

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			expect(persistMock).toHaveBeenCalledTimes(1);

			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
			expect(persistMock).toHaveBeenCalledTimes(2);
		});

		it('should not auto-persist when disabled', () => {
			const persistMock = vi.fn();
			orchestrator.enableAutoPersist(persistMock);
			orchestrator.disableAutoPersist();

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

			expect(persistMock).not.toHaveBeenCalled();
		});

		it('should serialize state with all context data', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			const state = orchestrator.getState();

			expect(state.phase).toBe('SUBTASK_LOOP');
			expect(state.context.branchName).toBe('feature/test');
			expect(state.context.currentTDDPhase).toBe('RED');
			expect(state.context.taskId).toBe('task-1');
		});
	});

	describe('Phase Transition Guards and Validation', () => {
		it('should enforce guard conditions on transitions', () => {
			// Create orchestrator with guard condition that should fail
			const guardedContext: WorkflowContext = {
				taskId: 'task-1',
				subtasks: [],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: { guardTest: true }
			};

			const guardedOrchestrator = new WorkflowOrchestrator(guardedContext);

			// Add guard that checks for subtasks (should fail since we have no subtasks)
			guardedOrchestrator.addGuard('SUBTASK_LOOP', (context) => {
				return context.subtasks.length > 0;
			});

			guardedOrchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

			expect(() => {
				guardedOrchestrator.transition({
					type: 'BRANCH_CREATED',
					branchName: 'feature/test'
				});
			}).toThrow('Guard condition failed');
		});

		it('should allow transition when guard condition passes', () => {
			const guardedContext: WorkflowContext = {
				taskId: 'task-1',
				subtasks: [
					{ id: '1.1', title: 'Test', status: 'pending', attempts: 0 }
				],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: {}
			};

			const guardedOrchestrator = new WorkflowOrchestrator(guardedContext);

			guardedOrchestrator.addGuard('SUBTASK_LOOP', (context) => {
				return context.subtasks.length > 0;
			});

			guardedOrchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			guardedOrchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			expect(guardedOrchestrator.getCurrentPhase()).toBe('SUBTASK_LOOP');
		});

		it('should validate test results before GREEN phase transition', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			// Attempt to transition to GREEN without test results
			expect(() => {
				orchestrator.transition({ type: 'RED_PHASE_COMPLETE' });
			}).toThrow('Test results required');
		});

		it('should validate RED phase test results have failures', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			// Provide passing test results (should fail RED phase validation)
			expect(() => {
				orchestrator.transition({
					type: 'RED_PHASE_COMPLETE',
					testResults: {
						total: 5,
						passed: 5,
						failed: 0,
						skipped: 0,
						phase: 'RED'
					}
				});
			}).toThrow('RED phase must have at least one failing test');
		});

		it('should allow RED to GREEN transition with valid failing tests', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});

			expect(orchestrator.getCurrentTDDPhase()).toBe('GREEN');
		});

		it('should validate GREEN phase test results have no failures', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});

			// Provide test results with failures (should fail GREEN phase validation)
			expect(() => {
				orchestrator.transition({
					type: 'GREEN_PHASE_COMPLETE',
					testResults: {
						total: 5,
						passed: 3,
						failed: 2,
						skipped: 0,
						phase: 'GREEN'
					}
				});
			}).toThrow('GREEN phase must have zero failures');
		});

		it('should allow GREEN to COMMIT transition with all tests passing', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});

			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});

			expect(orchestrator.getCurrentTDDPhase()).toBe('COMMIT');
		});

		it('should store test results in context', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			const redResults = {
				total: 5,
				passed: 0,
				failed: 5,
				skipped: 0,
				phase: 'RED' as const
			};

			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: redResults
			});

			const context = orchestrator.getContext();
			expect(context.lastTestResults).toEqual(redResults);
		});

		it('should validate git repository state before BRANCH_SETUP', () => {
			// Set up orchestrator with git validation enabled
			const gitContext: WorkflowContext = {
				taskId: 'task-1',
				subtasks: [
					{ id: '1.1', title: 'Test', status: 'pending', attempts: 0 }
				],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: { requireGit: false }
			};

			const gitOrchestrator = new WorkflowOrchestrator(gitContext);

			// Guard that requires git to be true (but it's false)
			gitOrchestrator.addGuard('BRANCH_SETUP', (context) => {
				return context.metadata.requireGit === true;
			});

			expect(() => {
				gitOrchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			}).toThrow('Guard condition failed');
		});
	});

	describe('Subtask Iteration and Progress Tracking', () => {
		beforeEach(() => {
			// Navigate to SUBTASK_LOOP for all tests
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
		});

		it('should return current subtask', () => {
			const currentSubtask = orchestrator.getCurrentSubtask();
			expect(currentSubtask).toBeDefined();
			expect(currentSubtask?.id).toBe('1.1');
			expect(currentSubtask?.title).toBe('Subtask 1');
		});

		it('should return undefined when no current subtask', () => {
			// Complete all subtasks
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });
			orchestrator.transition({ type: 'SUBTASK_COMPLETE' });

			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });
			orchestrator.transition({ type: 'SUBTASK_COMPLETE' });

			const currentSubtask = orchestrator.getCurrentSubtask();
			expect(currentSubtask).toBeUndefined();
		});

		it('should calculate workflow progress', () => {
			const progress = orchestrator.getProgress();
			expect(progress.completed).toBe(0);
			expect(progress.total).toBe(2);
			expect(progress.current).toBe(1);
			expect(progress.percentage).toBe(0);
		});

		it('should update progress as subtasks complete', () => {
			// Complete first subtask
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });
			orchestrator.transition({ type: 'SUBTASK_COMPLETE' });

			const progress = orchestrator.getProgress();
			expect(progress.completed).toBe(1);
			expect(progress.total).toBe(2);
			expect(progress.current).toBe(2);
			expect(progress.percentage).toBe(50);
		});

		it('should show 100% progress when all subtasks complete', () => {
			// Complete all subtasks
			for (let i = 0; i < 2; i++) {
				orchestrator.transition({
					type: 'RED_PHASE_COMPLETE',
					testResults: {
						total: 5,
						passed: 0,
						failed: 5,
						skipped: 0,
						phase: 'RED'
					}
				});
				orchestrator.transition({
					type: 'GREEN_PHASE_COMPLETE',
					testResults: {
						total: 5,
						passed: 5,
						failed: 0,
						skipped: 0,
						phase: 'GREEN'
					}
				});
				orchestrator.transition({ type: 'COMMIT_COMPLETE' });
				orchestrator.transition({ type: 'SUBTASK_COMPLETE' });
			}

			const progress = orchestrator.getProgress();
			expect(progress.completed).toBe(2);
			expect(progress.total).toBe(2);
			expect(progress.percentage).toBe(100);
		});

		it('should validate if can proceed to next phase', () => {
			// In RED phase - cannot proceed without completing TDD cycle
			expect(orchestrator.canProceed()).toBe(false);

			// Complete RED phase
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});

			// In GREEN phase - still cannot proceed
			expect(orchestrator.canProceed()).toBe(false);

			// Complete GREEN phase
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});

			// In COMMIT phase - still cannot proceed
			expect(orchestrator.canProceed()).toBe(false);

			// Complete COMMIT phase
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });

			// Subtask complete - can proceed
			expect(orchestrator.canProceed()).toBe(true);
		});

		it('should track subtask attempts', () => {
			const context = orchestrator.getContext();
			expect(context.subtasks[0].attempts).toBe(0);

			// Increment attempt on starting RED phase
			orchestrator.incrementAttempts();
			expect(orchestrator.getContext().subtasks[0].attempts).toBe(1);
		});

		it('should enforce max attempts limit', () => {
			// Set max attempts to 3
			const limitedContext: WorkflowContext = {
				taskId: 'task-1',
				subtasks: [
					{
						id: '1.1',
						title: 'Subtask 1',
						status: 'pending',
						attempts: 0,
						maxAttempts: 3
					}
				],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: {}
			};

			const limitedOrchestrator = new WorkflowOrchestrator(limitedContext);
			limitedOrchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			limitedOrchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			// Increment attempts to max
			for (let i = 0; i < 3; i++) {
				limitedOrchestrator.incrementAttempts();
			}

			expect(limitedOrchestrator.hasExceededMaxAttempts()).toBe(false);

			// One more attempt should exceed
			limitedOrchestrator.incrementAttempts();
			expect(limitedOrchestrator.hasExceededMaxAttempts()).toBe(true);
		});

		it('should allow unlimited attempts when maxAttempts is undefined', () => {
			for (let i = 0; i < 100; i++) {
				orchestrator.incrementAttempts();
			}

			expect(orchestrator.hasExceededMaxAttempts()).toBe(false);
		});

		it('should emit progress events on subtask completion', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('progress:updated', (event) => events.push(event));

			// Complete first subtask
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });
			orchestrator.transition({ type: 'SUBTASK_COMPLETE' });

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('progress:updated');
			expect(events[0].data?.completed).toBe(1);
			expect(events[0].data?.total).toBe(2);
		});
	});

	describe('Error Handling and Recovery', () => {
		beforeEach(() => {
			// Navigate to SUBTASK_LOOP for all tests
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
		});

		it('should handle errors with ERROR event', () => {
			const error: WorkflowError = {
				phase: 'SUBTASK_LOOP',
				message: 'Test execution failed',
				timestamp: new Date(),
				recoverable: true
			};

			orchestrator.transition({ type: 'ERROR', error });

			const context = orchestrator.getContext();
			expect(context.errors).toHaveLength(1);
			expect(context.errors[0].message).toBe('Test execution failed');
		});

		it('should emit error:occurred event', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('error:occurred', (event) => events.push(event));

			const error: WorkflowError = {
				phase: 'SUBTASK_LOOP',
				message: 'Test execution failed',
				timestamp: new Date(),
				recoverable: true
			};

			orchestrator.transition({ type: 'ERROR', error });

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('error:occurred');
			expect(events[0].data?.error).toEqual(error);
		});

		it('should support retry attempts', () => {
			const currentSubtask = orchestrator.getCurrentSubtask();
			expect(currentSubtask?.attempts).toBe(0);

			// Simulate failed attempt
			orchestrator.incrementAttempts();
			orchestrator.retryCurrentSubtask();

			const context = orchestrator.getContext();
			expect(context.currentTDDPhase).toBe('RED');
			expect(context.subtasks[0].attempts).toBe(1);
		});

		it('should mark subtask as failed when max attempts exceeded', () => {
			const limitedContext: WorkflowContext = {
				taskId: 'task-1',
				subtasks: [
					{
						id: '1.1',
						title: 'Subtask 1',
						status: 'pending',
						attempts: 0,
						maxAttempts: 2
					}
				],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: {}
			};

			const limitedOrchestrator = new WorkflowOrchestrator(limitedContext);
			limitedOrchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			limitedOrchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			// Exceed max attempts
			for (let i = 0; i < 3; i++) {
				limitedOrchestrator.incrementAttempts();
			}

			limitedOrchestrator.handleMaxAttemptsExceeded();

			const context = limitedOrchestrator.getContext();
			expect(context.subtasks[0].status).toBe('failed');
		});

		it('should emit subtask:failed event when max attempts exceeded', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('subtask:failed', (event) => events.push(event));

			const limitedContext: WorkflowContext = {
				taskId: 'task-1',
				subtasks: [
					{
						id: '1.1',
						title: 'Subtask 1',
						status: 'pending',
						attempts: 0,
						maxAttempts: 2
					}
				],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: {}
			};

			const limitedOrchestrator = new WorkflowOrchestrator(limitedContext);
			limitedOrchestrator.on('subtask:failed', (event) => events.push(event));

			limitedOrchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			limitedOrchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			// Exceed max attempts
			for (let i = 0; i < 3; i++) {
				limitedOrchestrator.incrementAttempts();
			}

			limitedOrchestrator.handleMaxAttemptsExceeded();

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('subtask:failed');
		});

		it('should support abort workflow', () => {
			orchestrator.transition({ type: 'ABORT' });

			// Should still be in SUBTASK_LOOP but workflow should be aborted
			expect(orchestrator.getCurrentPhase()).toBe('SUBTASK_LOOP');
			expect(orchestrator.isAborted()).toBe(true);
		});

		it('should prevent transitions after abort', () => {
			orchestrator.transition({ type: 'ABORT' });

			expect(() => {
				orchestrator.transition({
					type: 'RED_PHASE_COMPLETE',
					testResults: {
						total: 5,
						passed: 0,
						failed: 5,
						skipped: 0,
						phase: 'RED'
					}
				});
			}).toThrow('Workflow has been aborted');
		});

		it('should allow retry after recoverable error', () => {
			const error: WorkflowError = {
				phase: 'SUBTASK_LOOP',
				message: 'Temporary failure',
				timestamp: new Date(),
				recoverable: true
			};

			orchestrator.transition({ type: 'ERROR', error });

			// Should be able to retry
			expect(() => {
				orchestrator.transition({ type: 'RETRY' });
			}).not.toThrow();

			expect(orchestrator.getCurrentTDDPhase()).toBe('RED');
		});

		it('should track error history in context', () => {
			const error1: WorkflowError = {
				phase: 'SUBTASK_LOOP',
				message: 'Error 1',
				timestamp: new Date(),
				recoverable: true
			};

			const error2: WorkflowError = {
				phase: 'SUBTASK_LOOP',
				message: 'Error 2',
				timestamp: new Date(),
				recoverable: false
			};

			orchestrator.transition({ type: 'ERROR', error: error1 });
			orchestrator.transition({ type: 'RETRY' });
			orchestrator.transition({ type: 'ERROR', error: error2 });

			const context = orchestrator.getContext();
			expect(context.errors).toHaveLength(2);
			expect(context.errors[0].message).toBe('Error 1');
			expect(context.errors[1].message).toBe('Error 2');
		});
	});

	describe('Resume Functionality from Checkpoints', () => {
		it('should restore state from checkpoint', () => {
			// Advance to SUBTASK_LOOP and complete first subtask
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });
			orchestrator.transition({ type: 'SUBTASK_COMPLETE' });

			// Save state
			const state = orchestrator.getState();

			// Create new orchestrator and restore
			const restored = new WorkflowOrchestrator(state.context);
			restored.restoreState(state);

			expect(restored.getCurrentPhase()).toBe('SUBTASK_LOOP');
			expect(restored.getContext().currentSubtaskIndex).toBe(1);
			expect(restored.getContext().branchName).toBe('feature/test');
		});

		it('should resume from mid-TDD cycle', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});

			// Save state in GREEN phase
			const state = orchestrator.getState();

			// Restore and verify in GREEN phase
			const restored = new WorkflowOrchestrator(state.context);
			restored.restoreState(state);

			expect(restored.getCurrentPhase()).toBe('SUBTASK_LOOP');
			expect(restored.getCurrentTDDPhase()).toBe('GREEN');
		});

		it('should validate restored state integrity', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			const state = orchestrator.getState();

			// Validate state structure
			expect(orchestrator.canResumeFromState(state)).toBe(true);
		});

		it('should reject invalid checkpoint state', () => {
			const invalidState = {
				phase: 'INVALID_PHASE' as WorkflowPhase,
				context: initialContext
			};

			expect(orchestrator.canResumeFromState(invalidState)).toBe(false);
		});

		it('should preserve subtask attempts on resume', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			// Increment attempts
			orchestrator.incrementAttempts();
			orchestrator.incrementAttempts();

			const state = orchestrator.getState();

			// Restore
			const restored = new WorkflowOrchestrator(state.context);
			restored.restoreState(state);

			const currentSubtask = restored.getCurrentSubtask();
			expect(currentSubtask?.attempts).toBe(2);
		});

		it('should preserve errors on resume', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			const error: WorkflowError = {
				phase: 'SUBTASK_LOOP',
				message: 'Test error',
				timestamp: new Date(),
				recoverable: true
			};

			orchestrator.transition({ type: 'ERROR', error });

			const state = orchestrator.getState();

			// Restore
			const restored = new WorkflowOrchestrator(state.context);
			restored.restoreState(state);

			expect(restored.getContext().errors).toHaveLength(1);
			expect(restored.getContext().errors[0].message).toBe('Test error');
		});

		it('should preserve completed subtask statuses on resume', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			// Complete first subtask
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });
			orchestrator.transition({ type: 'SUBTASK_COMPLETE' });

			const state = orchestrator.getState();

			// Restore
			const restored = new WorkflowOrchestrator(state.context);
			restored.restoreState(state);

			const progress = restored.getProgress();
			expect(progress.completed).toBe(1);
			expect(progress.current).toBe(2);
		});

		it('should emit workflow:resumed event on restore', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			const state = orchestrator.getState();

			// Create new orchestrator with event listener
			const events: WorkflowEventData[] = [];
			const restored = new WorkflowOrchestrator(state.context);
			restored.on('workflow:resumed', (event) => events.push(event));

			restored.restoreState(state);

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('workflow:resumed');
			expect(events[0].phase).toBe('SUBTASK_LOOP');
		});

		it('should calculate correct progress after resume', () => {
			// Complete first subtask
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});
			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});
			orchestrator.transition({
				type: 'GREEN_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 5,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			});
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });
			orchestrator.transition({ type: 'SUBTASK_COMPLETE' });

			const state = orchestrator.getState();

			// Restore and check progress
			const restored = new WorkflowOrchestrator(state.context);
			restored.restoreState(state);

			const progress = restored.getProgress();
			expect(progress.completed).toBe(1);
			expect(progress.total).toBe(2);
			expect(progress.percentage).toBe(50);
		});
	});

	describe('Adapter Integration', () => {
		let testValidator: TestResultValidator;

		beforeEach(() => {
			testValidator = new TestResultValidator();
		});

		it('should integrate with TestResultValidator', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			// Set validator
			orchestrator.setTestResultValidator(testValidator);

			// Validator should be used internally
			expect(orchestrator.hasTestResultValidator()).toBe(true);
		});

		it('should use TestResultValidator to validate RED phase', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			orchestrator.setTestResultValidator(testValidator);

			// Should reject passing tests in RED phase
			expect(() => {
				orchestrator.transition({
					type: 'RED_PHASE_COMPLETE',
					testResults: {
						total: 5,
						passed: 5,
						failed: 0,
						skipped: 0,
						phase: 'RED'
					}
				});
			}).toThrow('RED phase must have at least one failing test');
		});

		it('should use TestResultValidator to validate GREEN phase', () => {
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			orchestrator.setTestResultValidator(testValidator);

			orchestrator.transition({
				type: 'RED_PHASE_COMPLETE',
				testResults: {
					total: 5,
					passed: 0,
					failed: 5,
					skipped: 0,
					phase: 'RED'
				}
			});

			// Should reject failing tests in GREEN phase
			expect(() => {
				orchestrator.transition({
					type: 'GREEN_PHASE_COMPLETE',
					testResults: {
						total: 5,
						passed: 3,
						failed: 2,
						skipped: 0,
						phase: 'GREEN'
					}
				});
			}).toThrow('GREEN phase must have zero failures');
		});

		it('should support git adapter hooks', () => {
			const gitOperations: string[] = [];

			orchestrator.onGitOperation((operation, data) => {
				gitOperations.push(operation);
			});

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			// Verify git operation hook was called
			expect(gitOperations).toContain('branch:created');
		});

		it('should support executor adapter hooks', () => {
			const executions: string[] = [];

			orchestrator.onExecute((command, context) => {
				executions.push(command);
			});

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			orchestrator.executeCommand('run-tests');

			expect(executions).toContain('run-tests');
		});

		it('should provide adapter context in events', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('phase:entered', (event) => events.push(event));

			orchestrator.setTestResultValidator(testValidator);

			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

			// Event should include adapter availability
			expect(events[0].data?.adapters).toBeDefined();
		});

		it('should allow adapter reconfiguration', () => {
			orchestrator.setTestResultValidator(testValidator);
			expect(orchestrator.hasTestResultValidator()).toBe(true);

			orchestrator.removeTestResultValidator();
			expect(orchestrator.hasTestResultValidator()).toBe(false);
		});

		it('should work without adapters (optional integration)', () => {
			// Should work fine without adapters
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName: 'feature/test'
			});

			expect(orchestrator.getCurrentPhase()).toBe('SUBTASK_LOOP');
		});

		it('should emit adapter-related events', () => {
			const events: WorkflowEventData[] = [];
			orchestrator.on('adapter:configured', (event) => events.push(event));

			orchestrator.setTestResultValidator(testValidator);

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('adapter:configured');
			expect(events[0].data?.adapterType).toBe('test-validator');
		});
	});
});
