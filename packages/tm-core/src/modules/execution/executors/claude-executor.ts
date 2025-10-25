/**
 * Claude executor implementation for Task Master
 */

import { spawn } from 'child_process';
import type { Task } from '../../../common/types/index.js';
import type {
	ExecutorType,
	ExecutionResult,
	ClaudeExecutorConfig
} from '../types.js';
import { BaseExecutor } from '../executors/base-executor.js';

export class ClaudeExecutor extends BaseExecutor {
	private claudeConfig: ClaudeExecutorConfig;
	private currentProcess: any = null;

	constructor(projectRoot: string, config: ClaudeExecutorConfig = {}) {
		super(projectRoot, config);
		this.claudeConfig = {
			command: config.command || 'claude',
			systemPrompt:
				config.systemPrompt ||
				'You are a helpful AI assistant helping to complete a software development task.',
			additionalFlags: config.additionalFlags || []
		};
	}

	getType(): ExecutorType {
		return 'claude';
	}

	async isAvailable(): Promise<boolean> {
		return new Promise((resolve) => {
			const checkProcess = spawn('which', [this.claudeConfig.command!], {
				shell: true
			});

			checkProcess.on('close', (code) => {
				resolve(code === 0);
			});

			checkProcess.on('error', () => {
				resolve(false);
			});
		});
	}

	async execute(task: Task): Promise<ExecutionResult> {
		const startTime = new Date().toISOString();

		try {
			// Check if Claude is available
			const isAvailable = await this.isAvailable();
			if (!isAvailable) {
				return this.createResult(
					task.id,
					false,
					undefined,
					`Claude CLI not found. Please ensure 'claude' command is available in PATH.`
				);
			}

			// Format the task into a prompt
			const taskPrompt = this.formatTaskPrompt(task);
			const fullPrompt = `${this.claudeConfig.systemPrompt}\n\nHere is the task to complete:\n\n${taskPrompt}`;

			// Execute Claude with the task details
			const result = await this.runClaude(fullPrompt, task.id);

			return {
				...result,
				startTime,
				endTime: new Date().toISOString()
			};
		} catch (error: any) {
			this.logger.error(`Failed to execute task ${task.id}:`, error);
			return this.createResult(
				task.id,
				false,
				undefined,
				error.message || 'Unknown error occurred'
			);
		}
	}

	private runClaude(prompt: string, taskId: string): Promise<ExecutionResult> {
		return new Promise((resolve) => {
			const args = [prompt, ...this.claudeConfig.additionalFlags!];

			this.logger.info(`Executing Claude for task ${taskId}`);
			this.logger.debug(
				`Command: ${this.claudeConfig.command} ${args.join(' ')}`
			);

			this.currentProcess = spawn(this.claudeConfig.command!, args, {
				cwd: this.projectRoot,
				shell: false,
				stdio: 'inherit' // Let Claude handle its own I/O
			});

			this.currentProcess.on('close', (code: number) => {
				this.currentProcess = null;

				if (code === 0) {
					resolve(
						this.createResult(
							taskId,
							true,
							'Claude session completed successfully'
						)
					);
				} else {
					resolve(
						this.createResult(
							taskId,
							false,
							undefined,
							`Claude exited with code ${code}`
						)
					);
				}
			});

			this.currentProcess.on('error', (error: any) => {
				this.currentProcess = null;
				this.logger.error(`Claude process error:`, error);
				resolve(
					this.createResult(
						taskId,
						false,
						undefined,
						`Failed to spawn Claude: ${error.message}`
					)
				);
			});
		});
	}

	async stop(): Promise<void> {
		if (this.currentProcess) {
			this.logger.info('Stopping Claude process...');
			this.currentProcess.kill('SIGTERM');
			this.currentProcess = null;
		}
	}
}
