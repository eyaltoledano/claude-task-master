/**
 * @fileoverview Loop Service - Orchestrates running Claude Code iterations (sandbox or CLI mode)
 */

import { spawnSync } from 'node:child_process';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PRESETS, isPreset as checkIsPreset } from '../presets/index.js';
import type {
	LoopConfig,
	LoopIteration,
	LoopPreset,
	LoopResult
} from '../types.js';

export interface LoopServiceOptions {
	projectRoot: string;
}

export class LoopService {
	private readonly projectRoot: string;
	private _isRunning = false;

	constructor(options: LoopServiceOptions) {
		this.projectRoot = options.projectRoot;
	}

	getProjectRoot(): string {
		return this.projectRoot;
	}

	get isRunning(): boolean {
		return this._isRunning;
	}

	/** Check if Docker sandbox auth is ready */
	checkSandboxAuth(): { ready: boolean; error?: string } {
		const result = spawnSync(
			'docker',
			['sandbox', 'run', 'claude', '-p', 'Say OK'],
			{
				cwd: this.projectRoot,
				timeout: 30000,
				encoding: 'utf-8',
				stdio: ['inherit', 'pipe', 'pipe']
			}
		);

		if (result.error) {
			const code = (result.error as NodeJS.ErrnoException).code;
			if (code === 'ENOENT') {
				return {
					ready: false,
					error:
						'Docker is not installed. Install Docker Desktop to use --sandbox mode.'
				};
			}
			return { ready: false, error: `Docker error: ${result.error.message}` };
		}

		const output = (result.stdout || '') + (result.stderr || '');
		return { ready: output.toLowerCase().includes('ok') };
	}

	/** Run interactive Docker sandbox session for user authentication */
	runInteractiveAuth(): { success: boolean; error?: string } {
		const result = spawnSync(
			'docker',
			[
				'sandbox',
				'run',
				'claude',
				"You're authenticated! Press Ctrl+C to continue."
			],
			{
				cwd: this.projectRoot,
				stdio: 'inherit'
			}
		);

		if (result.error) {
			const code = (result.error as NodeJS.ErrnoException).code;
			if (code === 'ENOENT') {
				return {
					success: false,
					error:
						'Docker is not installed. Install Docker Desktop to use --sandbox mode.'
				};
			}
			return { success: false, error: `Docker error: ${result.error.message}` };
		}

		if (result.status === null) {
			return {
				success: false,
				error: 'Docker terminated abnormally (no exit code)'
			};
		}

		if (result.status !== 0) {
			return {
				success: false,
				error: `Docker exited with code ${result.status}`
			};
		}

		return { success: true };
	}

	/** Run a loop with the given configuration */
	async run(config: LoopConfig): Promise<LoopResult> {
		this._isRunning = true;
		const iterations: LoopIteration[] = [];
		let tasksCompleted = 0;

		await this.initProgressFile(config);

		for (let i = 1; i <= config.iterations && this._isRunning; i++) {
			// Show iteration header
			console.log();
			console.log(`━━━ Iteration ${i} of ${config.iterations} ━━━`);

			const prompt = await this.buildPrompt(config, i);
			const iteration = this.executeIteration(
				prompt,
				i,
				config.sandbox ?? false
			);
			iterations.push(iteration);

			// Check for early exit conditions
			if (iteration.status === 'complete') {
				return this.finalize(
					config,
					iterations,
					tasksCompleted + 1,
					'all_complete'
				);
			}
			if (iteration.status === 'blocked') {
				return this.finalize(config, iterations, tasksCompleted, 'blocked');
			}
			if (iteration.status === 'success') {
				tasksCompleted++;
			}

			// Sleep between iterations (except last)
			if (i < config.iterations && config.sleepSeconds > 0) {
				await new Promise((r) => setTimeout(r, config.sleepSeconds * 1000));
			}
		}

		return this.finalize(config, iterations, tasksCompleted, 'max_iterations');
	}

	/** Stop the loop after current iteration completes */
	stop(): void {
		this._isRunning = false;
	}

	// ========== Private Helpers ==========

	private async finalize(
		config: LoopConfig,
		iterations: LoopIteration[],
		tasksCompleted: number,
		finalStatus: LoopResult['finalStatus']
	): Promise<LoopResult> {
		this._isRunning = false;
		const result: LoopResult = {
			iterations,
			totalIterations: iterations.length,
			tasksCompleted,
			finalStatus
		};
		await this.appendFinalSummary(config.progressFile, result);
		return result;
	}

	private async initProgressFile(config: LoopConfig): Promise<void> {
		await mkdir(path.dirname(config.progressFile), { recursive: true });
		const tagLine = config.tag ? `# Tag: ${config.tag}\n` : '';
		// Append to existing progress file instead of overwriting
		await appendFile(
			config.progressFile,
			`
# Task Master Loop Progress
# Started: ${new Date().toISOString()}
# Preset: ${config.prompt}
# Max Iterations: ${config.iterations}
${tagLine}
---

`,
			'utf-8'
		);
	}

	private async appendFinalSummary(
		file: string,
		result: LoopResult
	): Promise<void> {
		await appendFile(
			file,
			`
---
# Loop Complete: ${new Date().toISOString()}
- Total iterations: ${result.totalIterations}
- Tasks completed: ${result.tasksCompleted}
- Final status: ${result.finalStatus}
`,
			'utf-8'
		);
	}

	private isPreset(name: string): name is LoopPreset {
		return checkIsPreset(name);
	}

	private async resolvePrompt(prompt: string): Promise<string> {
		if (this.isPreset(prompt)) {
			return PRESETS[prompt];
		}
		const content = await readFile(prompt, 'utf-8');
		if (!content.trim()) {
			throw new Error(`Custom prompt file '${prompt}' is empty`);
		}
		return content;
	}

	private buildContextHeader(config: LoopConfig, iteration: number): string {
		const tagInfo = config.tag ? ` (tag: ${config.tag})` : '';
		return `@${config.progressFile} @.taskmaster/tasks/tasks.json @CLAUDE.md

Loop iteration ${iteration} of ${config.iterations}${tagInfo}`;
	}

	private async buildPrompt(
		config: LoopConfig,
		iteration: number
	): Promise<string> {
		const basePrompt = await this.resolvePrompt(config.prompt);
		return `${this.buildContextHeader(config, iteration)}\n\n${basePrompt}`;
	}

	private parseCompletion(
		output: string,
		exitCode: number
	): { status: LoopIteration['status']; message?: string } {
		const completeMatch = output.match(
			/<loop-complete>([^<]*)<\/loop-complete>/i
		);
		if (completeMatch)
			return { status: 'complete', message: completeMatch[1].trim() };

		const blockedMatch = output.match(/<loop-blocked>([^<]*)<\/loop-blocked>/i);
		if (blockedMatch)
			return { status: 'blocked', message: blockedMatch[1].trim() };

		if (exitCode !== 0)
			return { status: 'error', message: `Exit code ${exitCode}` };
		return { status: 'success' };
	}

	private executeIteration(
		prompt: string,
		iterationNum: number,
		sandbox: boolean
	): LoopIteration {
		const startTime = Date.now();

		// Use docker sandbox or plain claude based on config
		const command = sandbox ? 'docker' : 'claude';
		const args = sandbox
			? ['sandbox', 'run', 'claude', '-p', prompt]
			: ['-p', prompt, '--dangerously-skip-permissions'];

		const result = spawnSync(command, args, {
			cwd: this.projectRoot,
			encoding: 'utf-8',
			maxBuffer: 50 * 1024 * 1024, // 50MB buffer
			stdio: ['inherit', 'pipe', 'pipe']
		});

		// Check for spawn-level errors (command not found, permission denied, etc.)
		if (result.error) {
			const code = (result.error as NodeJS.ErrnoException).code;
			let errorMessage: string;

			if (code === 'ENOENT') {
				errorMessage = sandbox
					? 'Docker is not installed. Install Docker Desktop to use --sandbox mode.'
					: 'Claude CLI is not installed. Install with: npm install -g @anthropic-ai/claude-code';
			} else if (code === 'EACCES') {
				errorMessage = `Permission denied executing '${command}'`;
			} else {
				errorMessage = `Failed to execute '${command}': ${result.error.message}`;
			}

			console.error(`[Loop Error] ${errorMessage}`);
			return {
				iteration: iterationNum,
				status: 'error',
				duration: Date.now() - startTime,
				message: errorMessage
			};
		}

		const output = (result.stdout || '') + (result.stderr || '');

		// Print output to console (spawnSync with pipe captures but doesn't display)
		if (output) console.log(output);

		// Handle null status (spawn failed but no error object - shouldn't happen but be safe)
		if (result.status === null) {
			return {
				iteration: iterationNum,
				status: 'error',
				duration: Date.now() - startTime,
				message: 'Command terminated abnormally (no exit code)'
			};
		}

		const { status, message } = this.parseCompletion(output, result.status);
		return {
			iteration: iterationNum,
			status,
			duration: Date.now() - startTime,
			message
		};
	}
}
