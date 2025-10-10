import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowOrchestrator } from './workflow-orchestrator.js';
import type { WorkflowContext, WorkflowPhase, WorkflowEventData } from './types.js';

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
      orchestrator.transition({ type: 'RED_PHASE_COMPLETE' });
      expect(orchestrator.getCurrentTDDPhase()).toBe('GREEN');
    });

    it('should transition from GREEN to COMMIT', () => {
      orchestrator.transition({ type: 'RED_PHASE_COMPLETE' });
      orchestrator.transition({ type: 'GREEN_PHASE_COMPLETE' });
      expect(orchestrator.getCurrentTDDPhase()).toBe('COMMIT');
    });

    it('should complete subtask after COMMIT', () => {
      orchestrator.transition({ type: 'RED_PHASE_COMPLETE' });
      orchestrator.transition({ type: 'GREEN_PHASE_COMPLETE' });
      orchestrator.transition({ type: 'COMMIT_COMPLETE' });

      const context = orchestrator.getContext();
      expect(context.subtasks[0].status).toBe('completed');
    });

    it('should move to next subtask after completion', () => {
      orchestrator.transition({ type: 'RED_PHASE_COMPLETE' });
      orchestrator.transition({ type: 'GREEN_PHASE_COMPLETE' });
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

      orchestrator.transition({ type: 'RED_PHASE_COMPLETE' });
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
      orchestrator.transition({ type: 'RED_PHASE_COMPLETE' });
      orchestrator.transition({ type: 'GREEN_PHASE_COMPLETE' });
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
});
