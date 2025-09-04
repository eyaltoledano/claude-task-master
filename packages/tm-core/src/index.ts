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
} from './task-master-core';

// Re-export types
export type * from './types';

// Re-export interfaces (types only to avoid conflicts)
export type * from './interfaces';

// Re-export constants
export * from './constants';

// Re-export providers
export * from './providers';

// Re-export storage (selectively to avoid conflicts)
export {
	FileStorage,
	ApiStorage,
	StorageFactory,
	type ApiStorageConfig
} from './storage';
export { PlaceholderStorage, type StorageAdapter } from './storage';

// Re-export parser
export * from './parser';

// Re-export utilities
export * from './utils';

// Re-export errors
export * from './errors';

// Re-export entities
export { TaskEntity } from './entities/task.entity';

// Re-export authentication
export {
	AuthManager,
	AuthenticationError,
	type AuthCredentials,
	type OAuthFlowOptions,
	type AuthConfig
} from './auth';

// Re-export logger
export { getLogger, createLogger, setGlobalLogger } from './logger';
