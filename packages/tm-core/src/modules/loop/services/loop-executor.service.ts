/**
 * @fileoverview Loop Executor Service
 * Spawns Claude Code CLI with generated prompts and captures output for completion detection
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { LoopIteration } from '../types.js';
import {
	LoopCompletionService,
	type CompletionCheckResult
} from './loop-completion.service.js';

/**
 * Result of executing a single loop iteration
 */
export interface ExecutionResult {
	/** The iteration result with status and metadata */
	iteration: LoopIteration;
	/** Raw output captured from Claude CLI */
	output: string;
	/** Result of checking output for completion markers */
	completionCheck: CompletionCheckResult;
	/** Process exit code */
	exitCode: number;
}

/**
 * Service for executing loop iterations via Claude CLI
 */
export class LoopExecutorService {
	private readonly completionService: LoopCompletionService;
	private currentProcess: ChildProcess | null = null;

	constructor(completionService: LoopCompletionService) {
		this.completionService = completionService;
	}

	/**
	 * Execute a single loop iteration
	 * @param prompt - The prompt to send to Claude CLI
	 * @param iteration - The iteration number (1-indexed)
	 * @param projectRoot - The project root directory
	 * @returns Promise resolving to the execution result
	 */
	async executeIteration(
		prompt: string,
		iteration: number,
		projectRoot: string
	): Promise<ExecutionResult> {
		const startTime = Date.now();
		let output = '';

		return new Promise((resolve) => {
			// Use claude -p for print mode (non-interactive)
			this.currentProcess = spawn('claude', ['-p', prompt], {
				cwd: projectRoot,
				shell: false,
				stdio: ['ignore', 'pipe', 'pipe']
			});

			this.currentProcess.stdout?.on('data', (data: Buffer) => {
				output += data.toString();
			});

			this.currentProcess.stderr?.on('data', (data: Buffer) => {
				output += data.toString();
			});

			this.currentProcess.on('close', (code: number | null) => {
				this.currentProcess = null;
				const duration = Date.now() - startTime;
				const completionCheck = this.completionService.parseOutput(output);
				const exitCode = code ?? 1;

				const iterationResult: LoopIteration = {
					iteration,
					status: this.determineStatus(exitCode, completionCheck),
					duration,
					message: completionCheck.marker?.reason
				};

				resolve({
					iteration: iterationResult,
					output,
					completionCheck,
					exitCode
				});
			});

			this.currentProcess.on('error', (error: Error) => {
				this.currentProcess = null;
				resolve({
					iteration: {
						iteration,
						status: 'error',
						message: error.message
					},
					output,
					completionCheck: { isComplete: false, isBlocked: false },
					exitCode: 1
				});
			});
		});
	}

	/**
	 * Determine the iteration status based on exit code and completion check
	 */
	private determineStatus(
		code: number,
		check: CompletionCheckResult
	): LoopIteration['status'] {
		if (check.isComplete) return 'complete';
		if (check.isBlocked) return 'blocked';
		if (code !== 0) return 'error';
		return 'success';
	}

	/**
	 * Stop the currently running process
	 */
	async stop(): Promise<void> {
		if (this.currentProcess) {
			this.currentProcess.kill('SIGTERM');
			this.currentProcess = null;
		}
	}
}
