/**
 * @fileoverview Type definitions for the loop module
 */

/**
 * Available preset loop prompts
 */
export type LoopPreset =
	| 'default'
	| 'test-coverage'
	| 'linting'
	| 'duplication'
	| 'entropy';

/**
 * Configuration options for a loop execution
 */
export interface LoopConfig {
	/** Number of iterations to run */
	iterations: number;
	/** Preset name or custom prompt file path */
	prompt: LoopPreset | string;
	/** Path to the progress file */
	progressFile: string;
	/** Seconds to sleep between iterations */
	sleepSeconds: number;
	/** Tag context to operate on (optional) */
	tag?: string;
}

/**
 * Result of a single loop iteration
 */
export interface LoopIteration {
	/** Iteration number (1-indexed) */
	iteration: number;
	/** ID of the task worked on (if any) */
	taskId?: string;
	/** Status of this iteration */
	status: 'success' | 'blocked' | 'error' | 'complete';
	/** Optional message describing the result */
	message?: string;
	/** Duration of this iteration in milliseconds */
	duration?: number;
}

/**
 * Overall result of a loop execution
 */
export interface LoopResult {
	/** Array of iteration results */
	iterations: LoopIteration[];
	/** Total number of iterations executed */
	totalIterations: number;
	/** Number of tasks completed successfully */
	tasksCompleted: number;
	/** Final status of the loop */
	finalStatus: 'all_complete' | 'max_iterations' | 'blocked' | 'error';
}
