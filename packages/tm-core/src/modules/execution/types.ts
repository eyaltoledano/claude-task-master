/**
 * Executor types and interfaces for Task Master
 */

import type { Task } from '../../common/types/index.js';

/**
 * Supported executor types
 */
export type ExecutorType = 'claude' | 'shell' | 'custom';

/**
 * Options for executor creation
 */
export interface ExecutorOptions {
	type: ExecutorType;
	projectRoot: string;
	config?: Record<string, any>;
}

/**
 * Result from task execution
 */
export interface ExecutionResult {
	success: boolean;
	taskId: string;
	executorType: ExecutorType;
	output?: string;
	error?: string;
	startTime: string;
	endTime?: string;
	processId?: number;
}

/**
 * Base interface for all task executors
 */
export interface ITaskExecutor {
	/**
	 * Execute a task
	 */
	execute(task: Task): Promise<ExecutionResult>;

	/**
	 * Stop a running task execution
	 */
	stop?(): Promise<void>;

	/**
	 * Get executor type
	 */
	getType(): ExecutorType;

	/**
	 * Check if executor is available/configured
	 */
	isAvailable(): Promise<boolean>;
}

/**
 * Configuration for Claude executor
 */
export interface ClaudeExecutorConfig {
	command?: string; // Default: 'claude'
	systemPrompt?: string;
	additionalFlags?: string[];
}

/**
 * Configuration for Shell executor
 */
export interface ShellExecutorConfig {
	shell?: string; // Default: '/bin/bash'
	env?: Record<string, string>;
	cwd?: string;
}
