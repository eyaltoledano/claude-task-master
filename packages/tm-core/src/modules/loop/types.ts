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
 * Output callbacks for loop execution.
 * These allow the caller (CLI/MCP) to handle presentation while
 * the service stays focused on business logic.
 *
 * Callback modes:
 * - `onIterationStart`, `onIterationEnd`, `onError`, `onStderr`: Called in both verbose and non-verbose modes
 * - `onText`, `onToolUse`: Called only in VERBOSE mode (--verbose flag)
 * - `onOutput`: Called only in NON-VERBOSE mode (default)
 */
export interface LoopOutputCallbacks {
	/** Called at the start of each iteration (both modes) */
	onIterationStart?: (iteration: number, total: number) => void;
	/** Called when Claude outputs text (VERBOSE MODE ONLY) */
	onText?: (text: string) => void;
	/** Called when Claude invokes a tool (VERBOSE MODE ONLY) */
	onToolUse?: (toolName: string) => void;
	/** Called when an error occurs (both modes) */
	onError?: (message: string, severity?: 'warning' | 'error') => void;
	/** Called for stderr output (both modes) */
	onStderr?: (iteration: number, text: string) => void;
	/** Called when non-verbose iteration completes with output (NON-VERBOSE MODE ONLY) */
	onOutput?: (output: string) => void;
	/** Called at the end of each iteration with the result (both modes) */
	onIterationEnd?: (iteration: LoopIteration) => void;
}

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
	 * Can be combined with `verbose=true` to both display and capture output.
	 * Note: Output can be large (up to 50MB per iteration).
	 */
	includeOutput?: boolean;
	/**
	 * Show Claude's work in real-time instead of just the result (default: false)
	 *
	 * When true: Output appears as Claude generates it (shows thinking, tool calls)
	 * When false: Output appears only after iteration completes
	 *
	 * Independent of `includeOutput` - controls display timing, not capture.
	 * Note: NOT compatible with `sandbox=true` (will return error).
	 */
	verbose?: boolean;
	/**
	 * Brief title describing the current initiative/goal (optional)
	 *
	 * If provided, included in the progress file header to give Claude
	 * context about the bigger picture across iterations.
	 * Example: "Implement streaming output for loop command"
	 */
	brief?: string;
	/**
	 * Output callbacks for presentation layer (CLI/MCP).
	 * If not provided, the service runs silently (no console output).
	 */
	callbacks?: LoopOutputCallbacks;
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
	/** Error message when finalStatus is 'error' (optional) */
	errorMessage?: string;
}
