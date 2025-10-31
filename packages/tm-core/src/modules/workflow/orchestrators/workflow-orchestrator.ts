import type {
	WorkflowPhase,
	TDDPhase,
	WorkflowContext,
	WorkflowEvent,
	WorkflowState,
	StateTransition,
	WorkflowEventType,
	WorkflowEventData,
	WorkflowEventListener,
	SubtaskInfo,
	WorkflowError
} from '../types.js';
import type { TestResultValidator } from '../services/test-result-validator.js';

/**
 * Lightweight state machine for TDD workflow orchestration
 */
export class WorkflowOrchestrator {
	private currentPhase: WorkflowPhase;
	private context: WorkflowContext;
	private readonly transitions: StateTransition[];
	private readonly eventListeners: Map<
		WorkflowEventType,
		Set<WorkflowEventListener>
	>;
	private persistCallback?: (state: WorkflowState) => void | Promise<void>;
	private autoPersistEnabled: boolean = false;
	private readonly phaseGuards: Map<
		WorkflowPhase,
		(context: WorkflowContext) => boolean
	>;
	private aborted: boolean = false;
	private testResultValidator?: TestResultValidator;
	private gitOperationHook?: (operation: string, data?: unknown) => void;
	private executeHook?: (command: string, context: WorkflowContext) => void;

	constructor(initialContext: WorkflowContext) {
		this.currentPhase = 'PREFLIGHT';
		this.context = { ...initialContext };
		this.transitions = this.defineTransitions();
		this.eventListeners = new Map();
		this.phaseGuards = new Map();
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
	async transition(event: WorkflowEvent): Promise<void> {
		// Check if workflow is aborted
		if (this.aborted && event.type !== 'ABORT') {
			throw new Error('Workflow has been aborted');
		}

		// Handle special events that work across all phases
		if (event.type === 'ERROR') {
			this.handleError(event.error);
			await this.triggerAutoPersist();
			return;
		}

		if (event.type === 'ABORT') {
			this.aborted = true;
			await this.triggerAutoPersist();
			return;
		}

		if (event.type === 'RETRY') {
			this.handleRetry();
			await this.triggerAutoPersist();
			return;
		}

		// Handle TDD phase transitions within SUBTASK_LOOP
		if (this.currentPhase === 'SUBTASK_LOOP') {
			await this.handleTDDPhaseTransition(event);
			await this.triggerAutoPersist();
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
		await this.triggerAutoPersist();
	}

	/**
	 * Handle TDD phase transitions (RED -> GREEN -> COMMIT)
	 */
	private async handleTDDPhaseTransition(event: WorkflowEvent): Promise<void> {
		const currentTDD = this.context.currentTDDPhase || 'RED';

		switch (event.type) {
			case 'RED_PHASE_COMPLETE':
				if (currentTDD !== 'RED') {
					throw new Error(
						'Invalid transition: RED_PHASE_COMPLETE from non-RED phase'
					);
				}

				// Validate test results are provided
				if (!event.testResults) {
					throw new Error('Test results required for RED phase transition');
				}

				// Store test results in context
				this.context.lastTestResults = event.testResults;

				// Special case: All tests passing in RED phase means feature already implemented
				if (event.testResults.failed === 0) {
					this.emit('tdd:red:completed');
					this.emit('tdd:feature-already-implemented', {
						subtaskId: this.getCurrentSubtaskId(),
						testResults: event.testResults
					});

					// Mark subtask as complete and move to next one
					const subtask =
						this.context.subtasks[this.context.currentSubtaskIndex];
					if (subtask) {
						subtask.status = 'completed';
					}

					this.emit('subtask:completed');
					this.context.currentSubtaskIndex++;

					// Emit progress update
					const progress = this.getProgress();
					this.emit('progress:updated', {
						completed: progress.completed,
						total: progress.total,
						percentage: progress.percentage
					});

					// Start next subtask or complete workflow
					if (this.context.currentSubtaskIndex < this.context.subtasks.length) {
						this.context.currentTDDPhase = 'RED';
						this.emit('tdd:red:started');
						this.emit('subtask:started');
					} else {
						// All subtasks complete, transition to FINALIZE
						await this.transition({ type: 'ALL_SUBTASKS_COMPLETE' });
					}
					break;
				}

				// Normal RED phase: has failing tests, proceed to GREEN
				this.emit('tdd:red:completed');
				this.context.currentTDDPhase = 'GREEN';
				this.emit('tdd:green:started');
				break;

			case 'GREEN_PHASE_COMPLETE':
				if (currentTDD !== 'GREEN') {
					throw new Error(
						'Invalid transition: GREEN_PHASE_COMPLETE from non-GREEN phase'
					);
				}

				// Validate test results are provided
				if (!event.testResults) {
					throw new Error('Test results required for GREEN phase transition');
				}

				// Validate GREEN phase has no failures
				if (event.testResults.failed !== 0) {
					throw new Error('GREEN phase must have zero failures');
				}

				// Store test results in context
				this.context.lastTestResults = event.testResults;

				this.emit('tdd:green:completed');
				this.context.currentTDDPhase = 'COMMIT';
				this.emit('tdd:commit:started');
				break;

			case 'COMMIT_COMPLETE':
				if (currentTDD !== 'COMMIT') {
					throw new Error(
						'Invalid transition: COMMIT_COMPLETE from non-COMMIT phase'
					);
				}
				this.emit('tdd:commit:completed');
				// Mark current subtask as completed
				const currentSubtask =
					this.context.subtasks[this.context.currentSubtaskIndex];
				if (currentSubtask) {
					currentSubtask.status = 'completed';
				}
				break;

			case 'SUBTASK_COMPLETE':
				this.emit('subtask:completed');
				// Move to next subtask
				this.context.currentSubtaskIndex++;

				// Emit progress update
				const progress = this.getProgress();
				this.emit('progress:updated', {
					completed: progress.completed,
					total: progress.total,
					percentage: progress.percentage
				});

				if (this.context.currentSubtaskIndex < this.context.subtasks.length) {
					// Start next subtask with RED phase
					this.context.currentTDDPhase = 'RED';
					this.emit('tdd:red:started');
					this.emit('subtask:started');
				} else {
					// All subtasks complete, transition to FINALIZE
					await this.transition({ type: 'ALL_SUBTASKS_COMPLETE' });
				}
				break;

			case 'ALL_SUBTASKS_COMPLETE':
				// Transition to FINALIZE phase
				this.emit('phase:exited');
				this.currentPhase = 'FINALIZE';
				this.context.currentTDDPhase = undefined;
				this.emit('phase:entered');
				// Note: Don't auto-transition to COMPLETE - requires explicit finalize call
				break;

			default:
				throw new Error(`Invalid transition: ${event.type} in SUBTASK_LOOP`);
		}
	}

	/**
	 * Execute a state transition
	 */
	private executeTransition(
		transition: StateTransition,
		event: WorkflowEvent
	): void {
		// Check guard condition if present
		if (transition.guard && !transition.guard(this.context)) {
			throw new Error(
				`Guard condition failed for transition to ${transition.to}`
			);
		}

		// Check phase-specific guard if present
		const phaseGuard = this.phaseGuards.get(transition.to);
		if (phaseGuard && !phaseGuard(this.context)) {
			throw new Error('Guard condition failed');
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

				// Trigger git operation hook
				if (this.gitOperationHook) {
					this.gitOperationHook('branch:created', {
						branchName: event.branchName
					});
				}
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

		// Emit workflow:resumed event
		this.emit('workflow:resumed', {
			phase: this.currentPhase,
			progress: this.getProgress()
		});
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
	private emit(
		eventType: WorkflowEventType,
		data?: Record<string, unknown>
	): void {
		const eventData: WorkflowEventData = {
			type: eventType,
			timestamp: new Date(),
			phase: this.currentPhase,
			tddPhase: this.context.currentTDDPhase,
			subtaskId: this.getCurrentSubtaskId(),
			data: {
				...data,
				adapters: {
					testValidator: !!this.testResultValidator,
					gitHook: !!this.gitOperationHook,
					executeHook: !!this.executeHook
				}
			}
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
		const currentSubtask =
			this.context.subtasks[this.context.currentSubtaskIndex];
		return currentSubtask?.id;
	}

	/**
	 * Register callback for state persistence
	 */
	onStatePersist(
		callback: (state: WorkflowState) => void | Promise<void>
	): void {
		this.persistCallback = callback;
	}

	/**
	 * Enable auto-persistence after each transition
	 */
	enableAutoPersist(
		callback: (state: WorkflowState) => void | Promise<void>
	): void {
		this.persistCallback = callback;
		this.autoPersistEnabled = true;
	}

	/**
	 * Disable auto-persistence
	 */
	disableAutoPersist(): void {
		this.autoPersistEnabled = false;
	}

	/**
	 * Manually persist current state
	 */
	async persistState(): Promise<void> {
		if (this.persistCallback) {
			await this.persistCallback(this.getState());
		}
		this.emit('state:persisted');
	}

	/**
	 * Trigger auto-persistence if enabled
	 */
	private async triggerAutoPersist(): Promise<void> {
		if (this.autoPersistEnabled && this.persistCallback) {
			await this.persistCallback(this.getState());
		}
	}

	/**
	 * Add a guard condition for a specific phase
	 */
	addGuard(
		phase: WorkflowPhase,
		guard: (context: WorkflowContext) => boolean
	): void {
		this.phaseGuards.set(phase, guard);
	}

	/**
	 * Remove a guard condition for a specific phase
	 */
	removeGuard(phase: WorkflowPhase): void {
		this.phaseGuards.delete(phase);
	}

	/**
	 * Get current subtask being worked on
	 */
	getCurrentSubtask(): SubtaskInfo | undefined {
		return this.context.subtasks[this.context.currentSubtaskIndex];
	}

	/**
	 * Get workflow progress information
	 */
	getProgress(): {
		completed: number;
		total: number;
		current: number;
		percentage: number;
	} {
		const completed = this.context.subtasks.filter(
			(st) => st.status === 'completed'
		).length;
		const total = this.context.subtasks.length;
		const current = this.context.currentSubtaskIndex + 1;
		const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

		return { completed, total, current, percentage };
	}

	/**
	 * Check if can proceed to next subtask or phase
	 */
	canProceed(): boolean {
		if (this.currentPhase !== 'SUBTASK_LOOP') {
			return false;
		}

		const currentSubtask = this.getCurrentSubtask();

		// Can proceed if current subtask is completed (after COMMIT phase)
		return currentSubtask?.status === 'completed';
	}

	/**
	 * Increment attempts for current subtask
	 */
	incrementAttempts(): void {
		const currentSubtask = this.getCurrentSubtask();
		if (currentSubtask) {
			currentSubtask.attempts++;
		}
	}

	/**
	 * Check if current subtask has exceeded max attempts
	 */
	hasExceededMaxAttempts(): boolean {
		const currentSubtask = this.getCurrentSubtask();
		if (!currentSubtask || !currentSubtask.maxAttempts) {
			return false;
		}

		return currentSubtask.attempts > currentSubtask.maxAttempts;
	}

	/**
	 * Handle error event
	 */
	private handleError(error: WorkflowError): void {
		this.context.errors.push(error);
		this.emit('error:occurred', { error });
	}

	/**
	 * Handle retry event
	 */
	private handleRetry(): void {
		if (this.currentPhase === 'SUBTASK_LOOP') {
			// Reset to RED phase to retry current subtask
			this.context.currentTDDPhase = 'RED';
			this.emit('tdd:red:started');
		}
	}

	/**
	 * Retry current subtask (resets to RED phase)
	 */
	retryCurrentSubtask(): void {
		if (this.currentPhase === 'SUBTASK_LOOP') {
			this.context.currentTDDPhase = 'RED';
			this.emit('tdd:red:started');
		}
	}

	/**
	 * Handle max attempts exceeded for current subtask
	 */
	handleMaxAttemptsExceeded(): void {
		const currentSubtask = this.getCurrentSubtask();
		if (currentSubtask) {
			currentSubtask.status = 'failed';
			this.emit('subtask:failed', {
				subtaskId: currentSubtask.id,
				attempts: currentSubtask.attempts,
				maxAttempts: currentSubtask.maxAttempts
			});
		}
	}

	/**
	 * Check if workflow has been aborted
	 */
	isAborted(): boolean {
		return this.aborted;
	}

	/**
	 * Validate if a state can be resumed from
	 */
	canResumeFromState(state: WorkflowState): boolean {
		// Validate phase is valid
		const validPhases: WorkflowPhase[] = [
			'PREFLIGHT',
			'BRANCH_SETUP',
			'SUBTASK_LOOP',
			'FINALIZE',
			'COMPLETE'
		];

		if (!validPhases.includes(state.phase)) {
			return false;
		}

		// Validate context structure
		if (!state.context || typeof state.context !== 'object') {
			return false;
		}

		// Validate required context fields
		if (!state.context.taskId || !Array.isArray(state.context.subtasks)) {
			return false;
		}

		if (typeof state.context.currentSubtaskIndex !== 'number') {
			return false;
		}

		if (!Array.isArray(state.context.errors)) {
			return false;
		}

		// All validations passed
		return true;
	}

	/**
	 * Set TestResultValidator adapter
	 */
	setTestResultValidator(validator: TestResultValidator): void {
		this.testResultValidator = validator;
		this.emit('adapter:configured', { adapterType: 'test-validator' });
	}

	/**
	 * Check if TestResultValidator is configured
	 */
	hasTestResultValidator(): boolean {
		return !!this.testResultValidator;
	}

	/**
	 * Remove TestResultValidator adapter
	 */
	removeTestResultValidator(): void {
		this.testResultValidator = undefined;
	}

	/**
	 * Register git operation hook
	 */
	onGitOperation(hook: (operation: string, data?: unknown) => void): void {
		this.gitOperationHook = hook;
	}

	/**
	 * Register execute command hook
	 */
	onExecute(hook: (command: string, context: WorkflowContext) => void): void {
		this.executeHook = hook;
	}

	/**
	 * Execute a command (triggers execute hook)
	 */
	executeCommand(command: string): void {
		if (this.executeHook) {
			this.executeHook(command, this.context);
		}
	}
}
