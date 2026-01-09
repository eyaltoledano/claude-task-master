/**
 * @fileoverview Loop Service - Simplified orchestrator for loop execution
 * All logic inlined: preset resolution, prompt generation, execution, progress tracking, completion detection
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LoopConfig, LoopIteration, LoopPreset, LoopResult } from '../types.js';
import { DEFAULT_PRESET } from '../presets/default.js';
import { DUPLICATION_PRESET } from '../presets/duplication.js';
import { ENTROPY_PRESET } from '../presets/entropy.js';
import { LINTING_PRESET } from '../presets/linting.js';
import { TEST_COVERAGE_PRESET } from '../presets/test-coverage.js';

/**
 * Options for LoopService constructor
 */
export interface LoopServiceOptions {
	/** Absolute path to the project root directory */
	projectRoot: string;
}

/**
 * LoopService - Simplified orchestrator for loop execution
 * All logic inlined: no sub-services required
 */
export class LoopService {
	private readonly projectRoot: string;
	private _isRunning = false;
	private currentProcess: ChildProcess | null = null;

	/**
	 * Create a new LoopService
	 * @param options - Service configuration options
	 */
	constructor(options: LoopServiceOptions) {
		this.projectRoot = options.projectRoot;
	}

	/**
	 * Get the project root directory
	 */
	getProjectRoot(): string {
		return this.projectRoot;
	}

	/**
	 * Check if a loop is currently running
	 */
	get isRunning(): boolean {
		return this._isRunning;
	}

	/**
	 * Run a loop with the given configuration
	 * @param config - Loop configuration
	 * @returns Promise resolving to the loop result
	 */
	async run(config: LoopConfig): Promise<LoopResult> {
		this._isRunning = true;
		const iterations: LoopIteration[] = [];
		let tasksCompleted = 0;

		// Initialize progress file using inlined method
		await this.initProgressFile(config);

		for (let i = 1; i <= config.iterations && this._isRunning; i++) {
			// Generate prompt for this iteration using inlined method
			const prompt = await this.buildPrompt(config, i);

			// Execute iteration using inlined method
			const result = await this.executeIterationInline(prompt, i);

			iterations.push(result.iteration);

			// Log progress using inlined method
			await this.appendProgress(config.progressFile, i, result.iteration);

			// Check for completion
			if (result.completionCheck.isComplete) {
				this._isRunning = false;
				return this.buildResult(iterations, tasksCompleted + 1, 'all_complete');
			}

			if (result.completionCheck.isBlocked) {
				this._isRunning = false;
				return this.buildResult(iterations, tasksCompleted, 'blocked');
			}

			if (result.iteration.status === 'success') {
				tasksCompleted++;
			}

			// Sleep between iterations (except last)
			if (i < config.iterations && config.sleepSeconds > 0) {
				await this.sleep(config.sleepSeconds * 1000);
			}
		}

		this._isRunning = false;
		return this.buildResult(iterations, tasksCompleted, 'max_iterations');
	}

	/**
	 * Stop the currently running loop
	 * Signals the loop to stop after the current iteration completes
	 */
	stop(): void {
		this._isRunning = false;
		this.stopProcess();
	}

	/**
	 * Build a LoopResult from iterations and status
	 */
	private buildResult(
		iterations: LoopIteration[],
		tasksCompleted: number,
		finalStatus: LoopResult['finalStatus']
	): LoopResult {
		return {
			iterations,
			totalIterations: iterations.length,
			tasksCompleted,
			finalStatus
		};
	}

	/**
	 * Sleep for the specified duration
	 * @param ms - Duration in milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// === Inlined from LoopCompletionService (Phase 2 simplification) ===

	private readonly completePattern = /<loop-complete>([^<]*)<\/loop-complete>/i;
	private readonly blockedPattern = /<loop-blocked>([^<]*)<\/loop-blocked>/i;

	/**
	 * Parse Claude output for completion markers
	 * @param output - The output string to parse
	 * @param exitCode - The exit code from the process
	 * @returns Status and optional message
	 */
	private parseCompletion(
		output: string,
		exitCode: number | null
	): { status: LoopIteration['status']; message?: string } {
		const completeMatch = output.match(this.completePattern);
		if (completeMatch) return { status: 'complete', message: completeMatch[1].trim() };

		const blockedMatch = output.match(this.blockedPattern);
		if (blockedMatch) return { status: 'blocked', message: blockedMatch[1].trim() };

		if (exitCode !== 0) return { status: 'error', message: `Exit code ${exitCode}` };
		return { status: 'success' };
	}

	// === Inlined from LoopProgressService (Phase 2 simplification) ===

	/**
	 * Initialize a new progress file with header information
	 * @param config - Loop configuration
	 */
	private async initProgressFile(config: LoopConfig): Promise<void> {
		const dir = path.dirname(config.progressFile);
		await mkdir(dir, { recursive: true });

		const lines = [
			'# Task Master Loop Progress',
			`# Started: ${new Date().toISOString()}`,
			`# Preset: ${config.prompt}`,
			`# Max Iterations: ${config.iterations}`
		];

		if (config.tag) {
			lines.push(`# Tag: ${config.tag}`);
		}

		lines.push('', '---', '');
		await writeFile(config.progressFile, lines.join('\n'), 'utf-8');
	}

	/**
	 * Append a progress entry to the progress file
	 * @param file - Path to the progress file
	 * @param iteration - Iteration number
	 * @param result - Loop iteration result
	 */
	private async appendProgress(
		file: string,
		iteration: number,
		result: LoopIteration
	): Promise<void> {
		const taskIdPart = result.taskId ? ` (Task ${result.taskId})` : '';
		const entry = `[${new Date().toISOString()}] Iteration ${iteration}${taskIdPart}: ${result.message || 'Iteration completed'}\n`;
		await appendFile(file, entry, 'utf-8');
	}

	// === Inlined from LoopPromptService (Phase 2 simplification) ===

	/** Preset content map for inline resolution */
	private readonly presetContent: Record<LoopPreset, string> = {
		default: DEFAULT_PRESET,
		'test-coverage': TEST_COVERAGE_PRESET,
		linting: LINTING_PRESET,
		duplication: DUPLICATION_PRESET,
		entropy: ENTROPY_PRESET
	};

	/** List of valid preset names */
	private readonly presetNames: readonly LoopPreset[] = [
		'default',
		'test-coverage',
		'linting',
		'duplication',
		'entropy'
	];

	/**
	 * Check if a string is a valid preset name
	 * @param name - The name to check
	 * @returns True if the name is a valid preset
	 */
	private isPreset(name: string): name is LoopPreset {
		return this.presetNames.includes(name as LoopPreset);
	}

	/**
	 * Resolve a prompt string to its content
	 * Handles both preset names and custom file paths
	 * @param prompt - Preset name or file path
	 * @returns Promise resolving to the prompt content
	 */
	private async resolvePrompt(prompt: string): Promise<string> {
		if (this.isPreset(prompt)) {
			return this.presetContent[prompt];
		}
		// Treat as file path - read from filesystem
		const content = await readFile(prompt, 'utf-8');
		if (!content.trim()) {
			throw new Error(`Custom prompt file '${prompt}' has empty content`);
		}
		return content;
	}

	/**
	 * Build the context header for a loop iteration
	 * @param config - Loop configuration
	 * @param iteration - Current iteration number (1-indexed)
	 * @returns Formatted context header string
	 */
	private buildContextHeader(config: LoopConfig, iteration: number): string {
		const lines = [
			`# Loop Iteration ${iteration} of ${config.iterations}`,
			``,
			`## Context`,
			`- Progress file: @${config.progressFile}`,
			`- Tasks file: @.taskmaster/tasks/tasks.json`
		];

		if (config.tag) {
			lines.push(`- Tag filter: ${config.tag}`);
		}

		return lines.join('\n');
	}

	/**
	 * Build the full prompt for a loop iteration
	 * Combines context header with resolved preset/custom prompt
	 * @param config - Loop configuration
	 * @param iteration - Current iteration number (1-indexed)
	 * @returns Promise resolving to the complete prompt string
	 */
	private async buildPrompt(config: LoopConfig, iteration: number): Promise<string> {
		const basePrompt = await this.resolvePrompt(config.prompt);
		const contextHeader = this.buildContextHeader(config, iteration);
		return `${contextHeader}\n\n${basePrompt}`;
	}

	// === Inlined from LoopExecutorService (Phase 2 simplification) ===

	/**
	 * Result of an iteration execution
	 */
	private executeIterationInline(
		prompt: string,
		iteration: number
	): Promise<{
		iteration: LoopIteration;
		output: string;
		completionCheck: { isComplete: boolean; isBlocked: boolean; reason?: string };
		exitCode: number;
	}> {
		const startTime = Date.now();
		let output = '';

		return new Promise((resolve) => {
			// Use claude -p for print mode (non-interactive)
			this.currentProcess = spawn('claude', ['-p', prompt], {
				cwd: this.projectRoot,
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
				const exitCode = code ?? 1;

				// Parse output for completion markers using inlined parseCompletion
				const { status, message } = this.parseCompletion(output, exitCode);
				const isComplete = status === 'complete';
				const isBlocked = status === 'blocked';

				const iterationResult: LoopIteration = {
					iteration,
					status,
					duration,
					message
				};

				resolve({
					iteration: iterationResult,
					output,
					completionCheck: { isComplete, isBlocked, reason: message },
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
	 * Stop the currently running process (inlined)
	 */
	private stopProcess(): void {
		if (this.currentProcess) {
			this.currentProcess.kill('SIGTERM');
			this.currentProcess = null;
		}
	}
}
