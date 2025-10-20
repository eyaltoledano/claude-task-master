/**
 * @fileoverview Main entry point for the tm-core package
 * This file exports all public APIs from the core Task Master library
 */

// Export main facade
export {
	TaskMasterCore,
	createTaskMasterCore,
	type TaskMasterCoreOptions,
	type ListTasksResult,
	type StartTaskOptions,
	type StartTaskResult,
	type ConflictCheckResult,
	type ExportTasksOptions,
	type ExportResult
} from './task-master-core.js';

// Re-export types
export type * from './types/index.js';

// Re-export interfaces (types only to avoid conflicts)
export type * from './interfaces/index.js';

// Re-export constants
export * from './constants/index.js';

// Re-export providers
export * from './providers/index.js';

// Re-export storage (selectively to avoid conflicts)
export {
	FileStorage,
	ApiStorage,
	StorageFactory,
	type ApiStorageConfig
} from './storage/index.js';
export { PlaceholderStorage, type StorageAdapter } from './storage/index.js';

// Re-export parser
export * from './parser/index.js';

// Re-export utilities
export * from './utils/index.js';

// Re-export errors
export * from './errors/index.js';

// Re-export entities
export { TaskEntity } from './entities/task.entity.js';

// Re-export authentication
export {
	AuthManager,
	AuthenticationError,
	type AuthCredentials,
	type OAuthFlowOptions,
	type AuthConfig
} from './auth/index.js';

// Re-export logger
export { getLogger, createLogger, setGlobalLogger } from './logger/index.js';

// Re-export executors
export * from './executors/index.js';

// Re-export reports
export {
	ComplexityReportManager,
	type ComplexityReport,
	type ComplexityReportMetadata,
	type ComplexityAnalysis,
	type TaskComplexityData
} from './reports/index.js';

// Re-export services
export {
	PreflightChecker,
	TaskLoaderService,
	type CheckResult,
	type PreflightResult,
	type TaskValidationResult,
	type ValidationErrorType,
	type DependencyIssue
} from './services/index.js';

// Re-export Git adapter
export { GitAdapter } from './git/git-adapter.js';
export {
	CommitMessageGenerator,
	type CommitMessageOptions
} from './git/commit-message-generator.js';

// Re-export workflow orchestrator, state manager, activity logger, and types
export { WorkflowOrchestrator } from './workflow/workflow-orchestrator.js';
export { WorkflowStateManager } from './workflow/workflow-state-manager.js';
export { WorkflowActivityLogger } from './workflow/workflow-activity-logger.js';
export type {
	WorkflowPhase,
	TDDPhase,
	WorkflowContext,
	WorkflowState,
	WorkflowEvent,
	WorkflowEventData,
	WorkflowEventListener,
	SubtaskInfo,
	TestResult,
	WorkflowError
} from './workflow/types.js';

// Re-export workflow service
export { WorkflowService } from './services/workflow.service.js';
export type {
	StartWorkflowOptions,
	WorkflowStatus,
	NextAction
} from './services/workflow.service.js';
