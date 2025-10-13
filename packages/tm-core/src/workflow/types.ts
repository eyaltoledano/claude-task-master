/**
 * Workflow phase definitions
 */
export type WorkflowPhase =
	| 'PREFLIGHT'
	| 'BRANCH_SETUP'
	| 'SUBTASK_LOOP'
	| 'FINALIZE'
	| 'COMPLETE';

/**
 * TDD cycle phases within subtask loop
 */
export type TDDPhase = 'RED' | 'GREEN' | 'COMMIT';

/**
 * Workflow state context
 */
export interface WorkflowContext {
	taskId: string;
	subtasks: SubtaskInfo[];
	currentSubtaskIndex: number;
	currentTDDPhase?: TDDPhase;
	branchName?: string;
	errors: WorkflowError[];
	metadata: Record<string, unknown>;
	lastTestResults?: TestResult;
}

/**
 * Test result from test execution
 */
export interface TestResult {
	total: number;
	passed: number;
	failed: number;
	skipped: number;
	phase: 'RED' | 'GREEN';
}

/**
 * Subtask information
 */
export interface SubtaskInfo {
	id: string;
	title: string;
	status: 'pending' | 'in-progress' | 'completed' | 'failed';
	attempts: number;
	maxAttempts?: number;
}

/**
 * Workflow error information
 */
export interface WorkflowError {
	phase: WorkflowPhase;
	message: string;
	timestamp: Date;
	recoverable: boolean;
}

/**
 * State machine state
 */
export interface WorkflowState {
	phase: WorkflowPhase;
	context: WorkflowContext;
}

/**
 * State transition event types
 */
export type WorkflowEvent =
	| { type: 'PREFLIGHT_COMPLETE' }
	| { type: 'BRANCH_CREATED'; branchName: string }
	| { type: 'SUBTASK_START'; subtaskId: string }
	| { type: 'RED_PHASE_COMPLETE'; testResults?: TestResult }
	| { type: 'GREEN_PHASE_COMPLETE'; testResults?: TestResult }
	| { type: 'COMMIT_COMPLETE' }
	| { type: 'SUBTASK_COMPLETE' }
	| { type: 'ALL_SUBTASKS_COMPLETE' }
	| { type: 'FINALIZE_COMPLETE' }
	| { type: 'ERROR'; error: WorkflowError }
	| { type: 'RETRY' }
	| { type: 'ABORT' };

/**
 * State transition definition
 */
export interface StateTransition {
	from: WorkflowPhase;
	to: WorkflowPhase;
	event: WorkflowEvent['type'];
	guard?: (context: WorkflowContext) => boolean;
}

/**
 * State machine configuration
 */
export interface StateMachineConfig {
	initialPhase: WorkflowPhase;
	transitions: StateTransition[];
}

/**
 * Workflow event listener
 */
export type WorkflowEventListener = (event: WorkflowEventData) => void;

/**
 * Comprehensive event data for workflow events
 */
export interface WorkflowEventData {
	type: WorkflowEventType;
	timestamp: Date;
	phase: WorkflowPhase;
	tddPhase?: TDDPhase;
	subtaskId?: string;
	data?: Record<string, unknown>;
}

/**
 * All possible workflow event types
 */
export type WorkflowEventType =
	| 'workflow:started'
	| 'workflow:completed'
	| 'workflow:error'
	| 'workflow:resumed'
	| 'phase:entered'
	| 'phase:exited'
	| 'tdd:feature-already-implemented'
	| 'tdd:red:started'
	| 'tdd:red:completed'
	| 'tdd:green:started'
	| 'tdd:green:completed'
	| 'tdd:commit:started'
	| 'tdd:commit:completed'
	| 'subtask:started'
	| 'subtask:completed'
	| 'subtask:failed'
	| 'test:run'
	| 'test:passed'
	| 'test:failed'
	| 'git:branch:created'
	| 'git:commit:created'
	| 'error:occurred'
	| 'state:persisted'
	| 'progress:updated'
	| 'adapter:configured';
