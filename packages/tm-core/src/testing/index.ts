/**
 * @fileoverview Testing utilities for @tm/core
 *
 * This module provides test fixtures and utilities for testing applications
 * that use @tm/core. Import from '@tm/core/testing' or '@tm/core'.
 *
 * @example
 * ```ts
 * import { createTask, createTasksFile, TaskScenarios } from '@tm/core/testing';
 * import { createApiStorageConfig, ConfigScenarios } from '@tm/core/testing';
 *
 * const task = createTask({ id: 1, title: 'Test Task' });
 * const tasksFile = TaskScenarios.linearDependencyChain();
 * const config = ConfigScenarios.apiStorage();
 * ```
 */

export {
	createTask,
	createSubtask,
	createTasksFile,
	TaskScenarios,
	type TasksFile
} from './task-fixtures.js';

export {
	createApiStorageSettings,
	createFileStorageSettings,
	createApiStorageConfig,
	createFileStorageConfig,
	ConfigScenarios
} from './config-fixtures.js';

export {
	MockSupabaseSessionStorage,
	MockSupabaseSessionStorageMinimal
} from './auth-mocks.js';

export { createMockLogger } from './test-mocks.js';
