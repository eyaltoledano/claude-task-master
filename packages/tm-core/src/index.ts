/**
 * @fileoverview Main entry point for the tm-core package
 * This file exports all public APIs from the core Task Master library
 */

// Export main facade
export {
	TaskMasterCore,
	createTaskMasterCore,
	type TaskMasterCoreOptions,
	type ListTasksResult
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

// Re-export workflow
export { WorkflowService, type WorkflowServiceConfig } from './workflow/index.js';
export type * from './workflow/index.js';
