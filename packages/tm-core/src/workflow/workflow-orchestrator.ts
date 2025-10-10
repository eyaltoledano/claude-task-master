import type {
  WorkflowPhase,
  TDDPhase,
  WorkflowContext,
  WorkflowEvent,
  WorkflowState,
  StateTransition,
  WorkflowEventType,
  WorkflowEventData,
  WorkflowEventListener
} from './types.js';

/**
 * Lightweight state machine for TDD workflow orchestration
 */
export class WorkflowOrchestrator {
  private currentPhase: WorkflowPhase;
  private context: WorkflowContext;
  private readonly transitions: StateTransition[];
  private readonly eventListeners: Map<WorkflowEventType, Set<WorkflowEventListener>>;

  constructor(initialContext: WorkflowContext) {
    this.currentPhase = 'PREFLIGHT';
    this.context = { ...initialContext };
    this.transitions = this.defineTransitions();
    this.eventListeners = new Map();
  }

  /**
   * Define valid state transitions
   */
  private defineTransitions(): StateTransition[] {
    return [
      {
        from: 'PREFLIGHT',
        to: 'BRANCH_SETUP',
        event: 'PREFLIGHT_COMPLETE'
      },
      {
        from: 'BRANCH_SETUP',
        to: 'SUBTASK_LOOP',
        event: 'BRANCH_CREATED'
      },
      {
        from: 'SUBTASK_LOOP',
        to: 'FINALIZE',
        event: 'ALL_SUBTASKS_COMPLETE'
      },
      {
        from: 'FINALIZE',
        to: 'COMPLETE',
        event: 'FINALIZE_COMPLETE'
      }
    ];
  }

  /**
   * Get current workflow phase
   */
  getCurrentPhase(): WorkflowPhase {
    return this.currentPhase;
  }

  /**
   * Get current TDD phase (only valid in SUBTASK_LOOP)
   */
  getCurrentTDDPhase(): TDDPhase | undefined {
    if (this.currentPhase === 'SUBTASK_LOOP') {
      return this.context.currentTDDPhase || 'RED';
    }
    return undefined;
  }

  /**
   * Get workflow context
   */
  getContext(): WorkflowContext {
    return { ...this.context };
  }

  /**
   * Transition to next state based on event
   */
  transition(event: WorkflowEvent): void {
    // Handle TDD phase transitions within SUBTASK_LOOP
    if (this.currentPhase === 'SUBTASK_LOOP') {
      this.handleTDDPhaseTransition(event);
      return;
    }

    // Handle main workflow phase transitions
    const validTransition = this.transitions.find(
      (t) => t.from === this.currentPhase && t.event === event.type
    );

    if (!validTransition) {
      throw new Error(
        `Invalid transition: ${event.type} from ${this.currentPhase}`
      );
    }

    // Execute transition
    this.executeTransition(validTransition, event);
  }

  /**
   * Handle TDD phase transitions (RED -> GREEN -> COMMIT)
   */
  private handleTDDPhaseTransition(event: WorkflowEvent): void {
    const currentTDD = this.context.currentTDDPhase || 'RED';

    switch (event.type) {
      case 'RED_PHASE_COMPLETE':
        if (currentTDD !== 'RED') {
          throw new Error('Invalid transition: RED_PHASE_COMPLETE from non-RED phase');
        }
        this.emit('tdd:red:completed');
        this.context.currentTDDPhase = 'GREEN';
        this.emit('tdd:green:started');
        break;

      case 'GREEN_PHASE_COMPLETE':
        if (currentTDD !== 'GREEN') {
          throw new Error('Invalid transition: GREEN_PHASE_COMPLETE from non-GREEN phase');
        }
        this.emit('tdd:green:completed');
        this.context.currentTDDPhase = 'COMMIT';
        this.emit('tdd:commit:started');
        break;

      case 'COMMIT_COMPLETE':
        if (currentTDD !== 'COMMIT') {
          throw new Error('Invalid transition: COMMIT_COMPLETE from non-COMMIT phase');
        }
        this.emit('tdd:commit:completed');
        // Mark current subtask as completed
        const currentSubtask = this.context.subtasks[this.context.currentSubtaskIndex];
        if (currentSubtask) {
          currentSubtask.status = 'completed';
        }
        break;

      case 'SUBTASK_COMPLETE':
        this.emit('subtask:completed');
        // Move to next subtask
        this.context.currentSubtaskIndex++;
        if (this.context.currentSubtaskIndex < this.context.subtasks.length) {
          // Start next subtask with RED phase
          this.context.currentTDDPhase = 'RED';
          this.emit('tdd:red:started');
          this.emit('subtask:started');
        }
        break;

      case 'ALL_SUBTASKS_COMPLETE':
        // Transition to FINALIZE phase
        this.emit('phase:exited');
        this.currentPhase = 'FINALIZE';
        this.context.currentTDDPhase = undefined;
        this.emit('phase:entered');
        break;

      default:
        throw new Error(`Invalid transition: ${event.type} in SUBTASK_LOOP`);
    }
  }

  /**
   * Execute a state transition
   */
  private executeTransition(transition: StateTransition, event: WorkflowEvent): void {
    // Check guard condition if present
    if (transition.guard && !transition.guard(this.context)) {
      throw new Error(`Guard condition failed for transition to ${transition.to}`);
    }

    // Emit phase exit event
    this.emit('phase:exited');

    // Update context based on event
    this.updateContext(event);

    // Transition to new phase
    this.currentPhase = transition.to;

    // Emit phase entry event
    this.emit('phase:entered');

    // Initialize TDD phase if entering SUBTASK_LOOP
    if (this.currentPhase === 'SUBTASK_LOOP') {
      this.context.currentTDDPhase = 'RED';
      this.emit('tdd:red:started');
      this.emit('subtask:started');
    }
  }

  /**
   * Update context based on event
   */
  private updateContext(event: WorkflowEvent): void {
    switch (event.type) {
      case 'BRANCH_CREATED':
        this.context.branchName = event.branchName;
        this.emit('git:branch:created', { branchName: event.branchName });
        break;

      case 'ERROR':
        this.context.errors.push(event.error);
        this.emit('error:occurred', { error: event.error });
        break;

      // Add more context updates as needed
    }
  }

  /**
   * Get current state for serialization
   */
  getState(): WorkflowState {
    return {
      phase: this.currentPhase,
      context: { ...this.context }
    };
  }

  /**
   * Restore state from checkpoint
   */
  restoreState(state: WorkflowState): void {
    this.currentPhase = state.phase;
    this.context = { ...state.context };
  }

  /**
   * Add event listener
   */
  on(eventType: WorkflowEventType, listener: WorkflowEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(eventType: WorkflowEventType, listener: WorkflowEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit workflow event
   */
  private emit(eventType: WorkflowEventType, data?: Record<string, unknown>): void {
    const eventData: WorkflowEventData = {
      type: eventType,
      timestamp: new Date(),
      phase: this.currentPhase,
      tddPhase: this.context.currentTDDPhase,
      subtaskId: this.getCurrentSubtaskId(),
      data
    };

    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach((listener) => listener(eventData));
    }
  }

  /**
   * Get current subtask ID
   */
  private getCurrentSubtaskId(): string | undefined {
    const currentSubtask = this.context.subtasks[this.context.currentSubtaskIndex];
    return currentSubtask?.id;
  }
}
