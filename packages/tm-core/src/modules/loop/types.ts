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
	/** Run Claude in Docker sandbox mode (default: false) */
	sandbox?: boolean;
	/**
	 * Include full Claude output in iteration results (default: false)
	 *
	 * When true: `LoopIteration.output` will contain full stdout+stderr text
	 * When false: `LoopIteration.output` will be undefined (saves memory)
	 *
	 * Can be combined with `stream=true` to both display and capture output.
	 * Note: Output can be large (up to 50MB per iteration).
	 */
	includeOutput?: boolean;
	/**
	 * Stream output in real-time instead of showing at end (default: false)
	 *
	 * When true: Output appears as Claude generates it (uses --output-format stream-json)
	 * When false: Output appears only after iteration completes
	 *
	 * Independent of `includeOutput` - controls display timing, not capture.
	 * Note: NOT compatible with `sandbox=true` (will return error).
	 */
	stream?: boolean;
	/**
	 * Brief title describing the current initiative/goal (optional)
	 *
	 * If provided, included in the progress file header to give Claude
	 * context about the bigger picture across iterations.
	 * Example: "Implement streaming output for loop command"
	 */
	brief?: string;
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
	/**
	 * Full Claude output text
	 *
	 * ONLY present when `LoopConfig.includeOutput=true`.
	 * Contains concatenated stdout and stderr from Claude CLI execution.
	 * May include ANSI color codes and tool call output.
	 * Can be large - use `includeOutput=false` to save memory.
	 */
	output?: string;
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
