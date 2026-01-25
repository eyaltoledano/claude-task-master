/**
 * @fileoverview Loop Service - Orchestrates running Claude Code iterations (sandbox or CLI mode)
 */

import { spawn, spawnSync } from 'node:child_process';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getLogger } from '../../../common/logger/index.js';
import { PRESETS, isPreset as checkIsPreset } from '../presets/index.js';
import type {
	LoopConfig,
	LoopIteration,
	LoopOutputCallbacks,
	LoopPreset,
	LoopResult
} from '../types.js';

export interface LoopServiceOptions {
	projectRoot: string;
}

export class LoopService {
	private readonly projectRoot: string;
	private readonly logger = getLogger('LoopService');
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
		// Validate incompatible options early - fail once, not per iteration
		if (config.verbose && config.sandbox) {
			const errorMsg =
				'Verbose mode is not supported with sandbox mode. Use --verbose without --sandbox, or remove --verbose.';
			this.reportError(config.callbacks, errorMsg);
			return {
				iterations: [],
				totalIterations: 0,
				tasksCompleted: 0,
				finalStatus: 'error',
				errorMessage: errorMsg
			};
		}

		this._isRunning = true;
		const iterations: LoopIteration[] = [];
		let tasksCompleted = 0;

		await this.initProgressFile(config);

		for (let i = 1; i <= config.iterations && this._isRunning; i++) {
			// Notify presentation layer of iteration start
			config.callbacks?.onIterationStart?.(i, config.iterations);

			const prompt = await this.buildPrompt(config, i);
			const iteration = await this.executeIteration(
				prompt,
				i,
				config.sandbox ?? false,
				config.includeOutput ?? false,
				config.verbose ?? false,
				config.callbacks
			);
			iterations.push(iteration);

			// Notify presentation layer of iteration completion
			config.callbacks?.onIterationEnd?.(iteration);

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

	/**
	 * Report an error via callback if provided, otherwise log to the logger.
	 * Ensures errors are never silently swallowed when callbacks aren't configured.
	 */
	private reportError(
		callbacks: LoopOutputCallbacks | undefined,
		message: string,
		severity: 'warning' | 'error' = 'error'
	): void {
		if (callbacks?.onError) {
			callbacks.onError(message, severity);
		} else if (severity === 'warning') {
			this.logger.warn(message);
		} else {
			this.logger.error(message);
		}
	}

	private async initProgressFile(config: LoopConfig): Promise<void> {
		await mkdir(path.dirname(config.progressFile), { recursive: true });
		const lines = [
			'# Taskmaster Loop Progress',
			`# Started: ${new Date().toISOString()}`,
			...(config.brief ? [`# Brief: ${config.brief}`] : []),
			`# Preset: ${config.prompt}`,
			`# Max Iterations: ${config.iterations}`,
			...(config.tag ? [`# Tag: ${config.tag}`] : []),
			'',
			'---',
			''
		];
		// Append to existing progress file instead of overwriting
		await appendFile(
			config.progressFile,
			'\n' + lines.join('\n') + '\n',
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
		// Note: tasks.json reference removed - let the preset control task source to avoid confusion
		return `@${config.progressFile} @CLAUDE.md

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

	private async executeIteration(
		prompt: string,
		iterationNum: number,
		sandbox: boolean,
		includeOutput = false,
		verbose = false,
		callbacks?: LoopOutputCallbacks
	): Promise<LoopIteration> {
		const startTime = Date.now();
		const command = sandbox ? 'docker' : 'claude';

		if (verbose) {
			return this.executeVerboseIteration(
				prompt,
				iterationNum,
				command,
				sandbox,
				includeOutput,
				startTime,
				callbacks
			);
		}

		const args = this.buildCommandArgs(prompt, sandbox, false);
		const result = spawnSync(command, args, {
			cwd: this.projectRoot,
			encoding: 'utf-8',
			maxBuffer: 50 * 1024 * 1024,
			stdio: ['inherit', 'pipe', 'pipe']
		});

		if (result.error) {
			const errorMessage = this.formatCommandError(
				result.error,
				command,
				sandbox
			);
			this.reportError(callbacks, errorMessage);
			return this.createErrorIteration(iterationNum, startTime, errorMessage);
		}

		const output = (result.stdout || '') + (result.stderr || '');
		if (output) {
			callbacks?.onOutput?.(output);
		}

		if (result.status === null) {
			const errorMsg = 'Command terminated abnormally (no exit code)';
			this.reportError(callbacks, errorMsg);
			return this.createErrorIteration(iterationNum, startTime, errorMsg);
		}

		const { status, message } = this.parseCompletion(output, result.status);
		return {
			iteration: iterationNum,
			status,
			duration: Date.now() - startTime,
			message,
			...(includeOutput && { output })
		};
	}

	/**
	 * Execute an iteration with verbose output (shows Claude's work in real-time).
	 * Uses Claude's stream-json format to display assistant messages as they arrive.
	 * @param prompt - The prompt to send to Claude
	 * @param iterationNum - Current iteration number (1-indexed)
	 * @param command - The command to execute ('claude' or 'docker')
	 * @param sandbox - Whether running in Docker sandbox mode
	 * @param includeOutput - Whether to include full output in the result
	 * @param startTime - Timestamp when iteration started (for duration calculation)
	 * @param callbacks - Optional callbacks for presentation layer output
	 * @returns Promise resolving to the iteration result
	 */
	private executeVerboseIteration(
		prompt: string,
		iterationNum: number,
		command: string,
		sandbox: boolean,
		includeOutput: boolean,
		startTime: number,
		callbacks?: LoopOutputCallbacks
	): Promise<LoopIteration> {
		const args = this.buildCommandArgs(prompt, sandbox, true);

		return new Promise((resolve) => {
			// Prevent multiple resolutions from race conditions between error/close events
			let isResolved = false;
			const resolveOnce = (result: LoopIteration): void => {
				if (!isResolved) {
					isResolved = true;
					resolve(result);
				}
			};

			const child = spawn(command, args, {
				cwd: this.projectRoot,
				stdio: ['inherit', 'pipe', 'pipe']
			});

			// Track stdout completion to handle race between data and close events
			let stdoutEnded = false;
			let finalResult = '';
			let buffer = '';

			const processLine = (line: string): void => {
				if (!line.startsWith('{')) return;

				try {
					const event = JSON.parse(line);

					// Validate event structure before accessing properties
					if (!this.isValidStreamEvent(event)) {
						return;
					}

					this.handleStreamEvent(event, callbacks);

					// Capture final result for includeOutput feature
					if (event.type === 'result') {
						finalResult = typeof event.result === 'string' ? event.result : '';
					}
				} catch (error) {
					// Log malformed JSON for debugging (non-JSON lines like system output are expected)
					if (line.trim().startsWith('{')) {
						const parseError = `Failed to parse JSON event: ${error instanceof Error ? error.message : 'Unknown error'}. Line: ${line.substring(0, 100)}...`;
						this.reportError(callbacks, parseError, 'warning');
					}
				}
			};

			// Handle null stdout (shouldn't happen with pipe, but be defensive)
			if (!child.stdout) {
				resolveOnce(
					this.createErrorIteration(
						iterationNum,
						startTime,
						'Failed to capture stdout from child process'
					)
				);
				return;
			}

			child.stdout.on('data', (data: Buffer) => {
				try {
					const lines = this.processBufferedLines(
						buffer,
						data.toString('utf-8')
					);
					buffer = lines.remaining;
					for (const line of lines.complete) {
						processLine(line);
					}
				} catch (error) {
					this.reportError(
						callbacks,
						`Failed to process stdout data: ${error instanceof Error ? error.message : 'Unknown error'}`,
						'warning'
					);
				}
			});

			child.stdout.on('end', () => {
				stdoutEnded = true;
				// Process any remaining buffer when stdout ends
				if (buffer) {
					processLine(buffer);
					buffer = '';
				}
			});

			child.stderr?.on('data', (data: Buffer) => {
				const stderrText = data.toString('utf-8');
				callbacks?.onStderr?.(iterationNum, stderrText);
			});

			child.on('error', (error: NodeJS.ErrnoException) => {
				const errorMessage = this.formatCommandError(error, command, sandbox);
				this.reportError(callbacks, errorMessage);

				// Cleanup: remove listeners and kill process if still running
				child.stdout?.removeAllListeners();
				child.stderr?.removeAllListeners();
				if (!child.killed) {
					try {
						child.kill('SIGTERM');
					} catch {
						// Process may have already exited
					}
				}

				resolveOnce(
					this.createErrorIteration(iterationNum, startTime, errorMessage)
				);
			});

			child.on('close', (exitCode: number | null) => {
				// Process remaining buffer only if stdout hasn't already ended
				if (!stdoutEnded && buffer) {
					processLine(buffer);
				}

				if (exitCode === null) {
					const errorMsg = 'Command terminated abnormally (no exit code)';
					this.reportError(callbacks, errorMsg);
					resolveOnce(
						this.createErrorIteration(iterationNum, startTime, errorMsg)
					);
					return;
				}

				const { status, message } = this.parseCompletion(finalResult, exitCode);
				resolveOnce({
					iteration: iterationNum,
					status,
					duration: Date.now() - startTime,
					message,
					...(includeOutput && { output: finalResult })
				});
			});
		});
	}

	/**
	 * Validate that a parsed JSON object has the expected stream event structure.
	 */
	private isValidStreamEvent(event: unknown): event is {
		type: string;
		message?: {
			content?: Array<{ type: string; text?: string; name?: string }>;
		};
		result?: string;
	} {
		if (!event || typeof event !== 'object') {
			return false;
		}

		const e = event as Record<string, unknown>;
		if (!('type' in e) || typeof e.type !== 'string') {
			return false;
		}

		// Validate message structure if present
		if ('message' in e && e.message !== undefined) {
			if (typeof e.message !== 'object' || e.message === null) {
				return false;
			}
			const msg = e.message as Record<string, unknown>;
			if ('content' in msg && !Array.isArray(msg.content)) {
				return false;
			}
		}

		return true;
	}

	private buildCommandArgs(
		prompt: string,
		sandbox: boolean,
		verbose: boolean
	): string[] {
		if (sandbox) {
			return ['sandbox', 'run', 'claude', '-p', prompt];
		}

		const args = ['-p', prompt, '--dangerously-skip-permissions'];
		if (verbose) {
			// Use stream-json format to show Claude's work in real-time
			args.push('--output-format', 'stream-json', '--verbose');
		}
		return args;
	}

	private formatCommandError(
		error: NodeJS.ErrnoException,
		command: string,
		sandbox: boolean
	): string {
		if (error.code === 'ENOENT') {
			return sandbox
				? 'Docker is not installed. Install Docker Desktop to use --sandbox mode.'
				: 'Claude CLI is not installed. Install with: npm install -g @anthropic-ai/claude-code';
		}

		if (error.code === 'EACCES') {
			return `Permission denied executing '${command}'`;
		}

		return `Failed to execute '${command}': ${error.message}`;
	}

	private createErrorIteration(
		iterationNum: number,
		startTime: number,
		message: string
	): LoopIteration {
		return {
			iteration: iterationNum,
			status: 'error',
			duration: Date.now() - startTime,
			message
		};
	}

	private handleStreamEvent(
		event: {
			type: string;
			message?: {
				content?: Array<{ type: string; text?: string; name?: string }>;
			};
		},
		callbacks?: LoopOutputCallbacks
	): void {
		if (event.type !== 'assistant' || !event.message?.content) return;

		for (const block of event.message.content) {
			if (block.type === 'text' && block.text) {
				callbacks?.onText?.(block.text);
			} else if (block.type === 'tool_use' && block.name) {
				callbacks?.onToolUse?.(block.name);
			}
		}
	}

	private processBufferedLines(
		buffer: string,
		newData: string
	): { complete: string[]; remaining: string } {
		const combined = buffer + newData;
		const lines = combined.split('\n');
		return {
			complete: lines.slice(0, -1),
			remaining: lines[lines.length - 1]
		};
	}
}
