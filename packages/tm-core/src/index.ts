/**
 * @fileoverview Main entry point for @tm/core
 * Provides unified access to all Task Master functionality through TmCore
 */

import type { TasksDomain } from './modules/tasks/tasks-domain.js';

// ========== Primary API ==========

/**
 * Create a new TmCore instance - The ONLY way to use tm-core
 *
 * @example
 * ```typescript
 * import { createTmCore } from '@tm/core';
 *
 * const tmcore = await createTmCore({
 *   projectPath: process.cwd()
 * });
 *
 * // Access domains
 * await tmcore.auth.login({ ... });
 * const tasks = await tmcore.tasks.list();
 * await tmcore.workflow.start({ taskId: '1' });
 * await tmcore.git.commit('feat: add feature');
 * const config = tmcore.config.get('models.main');
 * ```
 */
export { createTmCore, TmCore, type TmCoreOptions } from './tm-core.js';

// ========== Type Exports ==========

// Common types that consumers need
export type * from './common/types/index.js';

// Common interfaces
export type * from './common/interfaces/index.js';

// Storage interfaces - TagInfo and TagsWithStatsResult
export type {
	TagInfo,
	TagsWithStatsResult
} from './common/interfaces/storage.interface.js';

// Storage adapters - FileStorage for direct local file access
export { FileStorage } from './modules/storage/index.js';

// Constants
export * from './common/constants/index.js';

// Errors
export * from './common/errors/index.js';

// Utils
export * from './common/utils/index.js';
export * from './utils/time.utils.js';

// Task validation schemas
export * from './modules/tasks/validation/index.js';

// ========== Domain-Specific Type Exports ==========

// Task types
export type {
	TaskListResult,
	GetTaskListOptions
} from './modules/tasks/services/task-service.js';

export type {
	StartTaskOptions,
	StartTaskResult,
	ConflictCheckResult
} from './modules/tasks/services/task-execution-service.js';

export type {
	PreflightResult,
	CheckResult
} from './modules/tasks/services/preflight-checker.service.js';

// Task domain result types
export type TaskWithSubtaskResult = Awaited<ReturnType<TasksDomain['get']>>;

// Auth types
export type {
	AuthCredentials,
	OAuthFlowOptions,
	UserContext
} from './modules/auth/types.js';
export { AuthenticationError } from './modules/auth/types.js';

// Auth constants
export {
	AUTH_TIMEOUT_MS,
	MFA_MAX_ATTEMPTS,
	LOCAL_ONLY_COMMANDS,
	type LocalOnlyCommand
} from './modules/auth/index.js';

// Brief types
export type { Brief } from './modules/briefs/types.js';
export type { TagWithStats } from './modules/briefs/services/brief-service.js';

// Workflow types
export type {
	StartWorkflowOptions,
	WorkflowStatus,
	NextAction
} from './modules/workflow/services/workflow.service.js';

export type {
	WorkflowPhase,
	TDDPhase,
	WorkflowContext,
	WorkflowState,
	TestResult
} from './modules/workflow/types.js';

// Git types
export type { CommitMessageOptions } from './modules/git/services/commit-message-generator.js';

// Integration types
export type {
	ExportTasksOptions,
	ExportResult,
	ImportTask
} from './modules/integration/services/export.service.js';

// Reports types
export type {
	ComplexityReport,
	ComplexityReportMetadata,
	ComplexityAnalysis,
	TaskComplexityData
} from './modules/reports/types.js';

// Prompts types
export type {
	PromptAction,
	PromptDisplayOptions,
	PromptDisplayResult,
	PromptMetrics,
	PromptState,
	PromptStateStore,
	PromptType,
	TriggerCondition,
	TriggerEvaluationResult,
	TriggerType,
	UpgradePromptConfig
} from './modules/prompts/index.js';

// ========== Advanced API (for CLI/Extension/MCP) ==========

// Auth - Advanced
export { AuthManager } from './modules/auth/managers/auth-manager.js';
export { AuthDomain } from './modules/auth/auth-domain.js';

// Briefs - Advanced
export { BriefsDomain } from './modules/briefs/briefs-domain.js';
export { BriefService } from './modules/briefs/services/brief-service.js';

// Workflow - Advanced
export { WorkflowOrchestrator } from './modules/workflow/orchestrators/workflow-orchestrator.js';
export { WorkflowStateManager } from './modules/workflow/managers/workflow-state-manager.js';
export { WorkflowService } from './modules/workflow/services/workflow.service.js';
export type { SubtaskInfo } from './modules/workflow/types.js';

// Git - Advanced
export { GitAdapter } from './modules/git/adapters/git-adapter.js';
export { CommitMessageGenerator } from './modules/git/services/commit-message-generator.js';

// Tasks - Advanced
export { PreflightChecker } from './modules/tasks/services/preflight-checker.service.js';
export { TaskLoaderService } from './modules/tasks/services/task-loader.service.js';
export {
	TaskFileGeneratorService,
	type GenerateTaskFilesOptions,
	type GenerateTaskFilesResult
} from './modules/tasks/services/task-file-generator.service.js';

// Integration - Advanced
export {
	ExportService,
	type GenerateBriefOptions,
	type GenerateBriefResult,
	type GenerateBriefFromPrdOptions,
	type GenerateBriefFromPrdResult,
	type BriefStatusResult,
	type BriefStatusResponse,
	type BriefGenerationProgress,
	type SendTeamInvitationsResult,
	type InvitationResult
} from './modules/integration/services/export.service.js';

// Prompts - Advanced
export { PromptService } from './modules/prompts/services/prompt-service.js';
export { PromptStateManager } from './modules/prompts/services/prompt-state-manager.js';
export {
	TriggerEvaluator,
	type TriggerContext
} from './modules/prompts/services/trigger-evaluator.js';
export {
	DEFAULT_PROMPT_CONFIG,
	DEFAULT_TRIGGER_CONDITIONS,
	PROMPT_STATE_KEY,
	PROMPT_STATE_VERSION
} from './modules/prompts/constants.js';

// ========== Testing Utilities ==========

// Test fixtures for integration tests
export {
	createTask,
	createSubtask,
	createTasksFile,
	TaskScenarios,
	type TasksFile
} from './testing/index.js';
