/**
 * @fileoverview WorkflowActivityLogger - Logs all workflow events to activity.jsonl
 *
 * Subscribes to all WorkflowOrchestrator events and persists them to a JSONL file
 * for debugging, auditing, and workflow analysis.
 */

import type { WorkflowOrchestrator } from './workflow-orchestrator.js';
import type { WorkflowEventData, WorkflowEventType } from './types.js';
import { logActivity, type ActivityEvent } from '../storage/activity-logger.js';
import { getLogger } from '../logger/index.js';

/**
 * All workflow event types that should be logged
 */
const WORKFLOW_EVENT_TYPES: WorkflowEventType[] = [
	'workflow:started',
	'workflow:completed',
	'workflow:error',
	'workflow:resumed',
	'phase:entered',
	'phase:exited',
	'tdd:feature-already-implemented',
	'tdd:red:started',
	'tdd:red:completed',
	'tdd:green:started',
	'tdd:green:completed',
	'tdd:commit:started',
	'tdd:commit:completed',
	'subtask:started',
	'subtask:completed',
	'subtask:failed',
	'test:run',
	'test:passed',
	'test:failed',
	'git:branch:created',
	'git:commit:created',
	'error:occurred',
	'state:persisted',
	'progress:updated',
	'adapter:configured'
];

/**
 * Logs all workflow events to an activity.jsonl file
 */
export class WorkflowActivityLogger {
	private readonly activityLogPath: string;
	private readonly orchestrator: WorkflowOrchestrator;
	private readonly logger = getLogger('WorkflowActivityLogger');
	private isActive = false;

	constructor(orchestrator: WorkflowOrchestrator, activityLogPath: string) {
		this.orchestrator = orchestrator;
		this.activityLogPath = activityLogPath;
	}

	/**
	 * Start logging workflow events
	 */
	start(): void {
		if (this.isActive) {
			this.logger.warn('Activity logger is already active');
			return;
		}

		// Subscribe to all workflow events
		WORKFLOW_EVENT_TYPES.forEach((eventType) => {
			this.orchestrator.on(eventType, (event) => this.logEvent(event));
		});

		this.isActive = true;
		this.logger.debug(
			`Activity logger started, logging to: ${this.activityLogPath}`
		);
	}

	/**
	 * Stop logging workflow events
	 * Note: WorkflowOrchestrator doesn't currently support removing listeners,
	 * so this just marks the logger as inactive to prevent duplicate logging
	 */
	stop(): void {
		this.isActive = false;
		this.logger.debug('Activity logger stopped');
	}

	/**
	 * Log a workflow event to the activity log
	 */
	private async logEvent(event: WorkflowEventData): Promise<void> {
		if (!this.isActive) {
			return;
		}

		try {
			// Convert WorkflowEventData to ActivityEvent format
			const activityEvent: Omit<ActivityEvent, 'timestamp'> = {
				type: event.type,
				phase: event.phase,
				tddPhase: event.tddPhase,
				subtaskId: event.subtaskId,
				// Convert Date to ISO string for JSONL compatibility
				eventTimestamp: event.timestamp.toISOString(),
				...(event.data || {})
			};

			await logActivity(this.activityLogPath, activityEvent);
		} catch (error: any) {
			// Log errors but don't throw - we don't want activity logging to break the workflow
			this.logger.error(
				`Failed to log activity event ${event.type}: ${error.message}`
			);
		}
	}

	/**
	 * Get the path to the activity log file
	 */
	getActivityLogPath(): string {
		return this.activityLogPath;
	}

	/**
	 * Check if the logger is currently active
	 */
	isLogging(): boolean {
		return this.isActive;
	}
}
