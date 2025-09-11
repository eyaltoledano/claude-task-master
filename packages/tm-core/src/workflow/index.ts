/**
 * @fileoverview Workflow Module
 * Public exports for workflow functionality
 */

export { WorkflowService, type WorkflowServiceConfig } from './workflow-service.js';

// Re-export workflow engine types for convenience
export type {
	WorkflowExecutionContext,
	WorkflowStatus,
	WorkflowEvent,
	WorkflowEventType,
	WorkflowProcess,
	ProcessStatus,
	WorktreeInfo
} from '@tm/workflow-engine';