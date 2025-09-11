/**
 * @fileoverview Process Sandbox
 * Manages Claude Code process execution in isolated environments
 */

import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type {
	WorkflowProcess,
	WorkflowEvent,
	WorkflowEventType
} from '../types/workflow.types.js';
import { ProcessError } from '../errors/workflow.errors.js';

export interface ProcessSandboxConfig {
	/** Claude Code executable path */
	claudeExecutable: string;
	/** Default timeout for processes (minutes) */
	defaultTimeout: number;
	/** Environment variables to pass to processes */
	environment?: Record<string, string>;
	/** Enable debug output */
	debug: boolean;
}

export interface ProcessOptions {
	/** Working directory for the process */
	cwd: string;
	/** Environment variables (merged with config) */
	env?: Record<string, string>;
	/** Timeout in minutes (overrides default) */
	timeout?: number;
	/** Additional Claude Code arguments */
	args?: string[];
}

/**
 * ProcessSandbox manages Claude Code process lifecycle
 * Single responsibility: Process spawning, monitoring, and cleanup
 */
export class ProcessSandbox extends EventEmitter {
	private config: ProcessSandboxConfig;
	private activeProcesses = new Map<string, WorkflowProcess>();
	private childProcesses = new Map<string, ChildProcess>();
	private timeouts = new Map<string, NodeJS.Timeout>();

	constructor(config: ProcessSandboxConfig) {
		super();
		this.config = config;
		this.setupCleanupHandlers();
	}

	/**
	 * Start a Claude Code process for task execution
	 */
	async startProcess(
		workflowId: string,
		taskId: string,
		taskPrompt: string,
		options: ProcessOptions
	): Promise<WorkflowProcess> {
		if (this.activeProcesses.has(workflowId)) {
			throw new ProcessError(
				`Process already running for workflow ${workflowId}`
			);
		}

		// Prepare command and arguments
		const args = [
			'-p', // Print mode for non-interactive execution
			taskPrompt,
			...(options.args || [])
		];

		// Prepare environment
		const env = {
			...process.env,
			...this.config.environment,
			...options.env,
			// Ensure task context is available
			TASKMASTER_WORKFLOW_ID: workflowId,
			TASKMASTER_TASK_ID: taskId
		};

		try {
			// Spawn Claude Code process
			const childProcess = spawn(this.config.claudeExecutable, args, {
				cwd: options.cwd,
				env,
				stdio: ['pipe', 'pipe', 'pipe']
			});

			const workflowProcess: WorkflowProcess = {
				pid: childProcess.pid!,
				command: this.config.claudeExecutable,
				args,
				cwd: options.cwd,
				env,
				startedAt: new Date(),
				status: 'starting'
			};

			// Store process references
			this.activeProcesses.set(workflowId, workflowProcess);
			this.childProcesses.set(workflowId, childProcess);

			// Setup process event handlers
			this.setupProcessHandlers(workflowId, taskId, childProcess);

			// Setup timeout if specified
			const timeoutMinutes = options.timeout || this.config.defaultTimeout;
			if (timeoutMinutes > 0) {
				this.setupProcessTimeout(workflowId, timeoutMinutes);
			}

			// Emit process started event
			this.emitEvent('process.started', workflowId, taskId, {
				pid: workflowProcess.pid,
				command: workflowProcess.command
			});

			workflowProcess.status = 'running';
			return workflowProcess;
		} catch (error) {
			throw new ProcessError(
				`Failed to start process for workflow ${workflowId}`,
				undefined,
				error as Error
			);
		}
	}

	/**
	 * Stop a running process
	 */
	async stopProcess(workflowId: string, force = false): Promise<void> {
		const process = this.activeProcesses.get(workflowId);
		const childProcess = this.childProcesses.get(workflowId);

		if (!process || !childProcess) {
			throw new ProcessError(
				`No running process found for workflow ${workflowId}`
			);
		}

		try {
			// Clear timeout
			const timeout = this.timeouts.get(workflowId);
			if (timeout) {
				clearTimeout(timeout);
				this.timeouts.delete(workflowId);
			}

			// Kill the process
			if (force) {
				childProcess.kill('SIGKILL');
			} else {
				childProcess.kill('SIGTERM');

				// Give it 5 seconds to gracefully exit, then force kill
				setTimeout(() => {
					if (!childProcess.killed) {
						childProcess.kill('SIGKILL');
					}
				}, 5000);
			}

			process.status = 'stopped';

			// Emit process stopped event
			this.emitEvent('process.stopped', workflowId, process.pid.toString(), {
				pid: process.pid,
				forced: force
			});
		} catch (error) {
			throw new ProcessError(
				`Failed to stop process for workflow ${workflowId}`,
				process.pid,
				error as Error
			);
		}
	}

	/**
	 * Send input to a running process
	 */
	async sendInput(workflowId: string, input: string): Promise<void> {
		const childProcess = this.childProcesses.get(workflowId);
		if (!childProcess) {
			throw new ProcessError(
				`No running process found for workflow ${workflowId}`
			);
		}

		try {
			childProcess.stdin?.write(input);
			childProcess.stdin?.write('\n');
		} catch (error) {
			throw new ProcessError(
				`Failed to send input to process for workflow ${workflowId}`,
				childProcess.pid,
				error as Error
			);
		}
	}

	/**
	 * Get process information
	 */
	getProcess(workflowId: string): WorkflowProcess | undefined {
		return this.activeProcesses.get(workflowId);
	}

	/**
	 * List all active processes
	 */
	listProcesses(): WorkflowProcess[] {
		return Array.from(this.activeProcesses.values());
	}

	/**
	 * Check if a process is running
	 */
	isProcessRunning(workflowId: string): boolean {
		const process = this.activeProcesses.get(workflowId);
		return process?.status === 'running' || process?.status === 'starting';
	}

	/**
	 * Clean up all processes
	 */
	async cleanupAll(force = false): Promise<void> {
		const workflowIds = Array.from(this.activeProcesses.keys());

		await Promise.all(
			workflowIds.map(async (workflowId) => {
				try {
					await this.stopProcess(workflowId, force);
				} catch (error) {
					console.error(
						`Failed to cleanup process for workflow ${workflowId}:`,
						error
					);
				}
			})
		);
	}

	/**
	 * Setup process event handlers
	 */
	private setupProcessHandlers(
		workflowId: string,
		taskId: string,
		childProcess: ChildProcess
	): void {
		const process = this.activeProcesses.get(workflowId);
		if (!process) return;

		// Handle stdout
		childProcess.stdout?.on('data', (data) => {
			const output = data.toString();
			if (this.config.debug) {
				console.log(`[${workflowId}] STDOUT:`, output);
			}

			this.emitEvent('process.output', workflowId, taskId, {
				stream: 'stdout',
				data: output
			});
		});

		// Handle stderr
		childProcess.stderr?.on('data', (data) => {
			const output = data.toString();
			if (this.config.debug) {
				console.error(`[${workflowId}] STDERR:`, output);
			}

			this.emitEvent('process.output', workflowId, taskId, {
				stream: 'stderr',
				data: output
			});
		});

		// Handle process exit
		childProcess.on('exit', (code, signal) => {
			process.status = code === 0 ? 'stopped' : 'crashed';

			this.emitEvent('process.stopped', workflowId, taskId, {
				pid: process.pid,
				exitCode: code,
				signal
			});

			// Cleanup
			this.activeProcesses.delete(workflowId);
			this.childProcesses.delete(workflowId);

			const timeout = this.timeouts.get(workflowId);
			if (timeout) {
				clearTimeout(timeout);
				this.timeouts.delete(workflowId);
			}
		});

		// Handle process errors
		childProcess.on('error', (error) => {
			process.status = 'crashed';

			this.emitEvent('process.error', workflowId, taskId, undefined, error);

			// Cleanup
			this.activeProcesses.delete(workflowId);
			this.childProcesses.delete(workflowId);
		});
	}

	/**
	 * Setup process timeout
	 */
	private setupProcessTimeout(
		workflowId: string,
		timeoutMinutes: number
	): void {
		const timeout = setTimeout(
			async () => {
				console.warn(`Process timeout reached for workflow ${workflowId}`);

				try {
					await this.stopProcess(workflowId, true);
				} catch (error) {
					console.error('Failed to stop timed out process:', error);
				}
			},
			timeoutMinutes * 60 * 1000
		);

		this.timeouts.set(workflowId, timeout);
	}

	/**
	 * Emit workflow event
	 */
	private emitEvent(
		type: WorkflowEventType,
		workflowId: string,
		taskId: string,
		data?: any,
		error?: Error
	): void {
		const event: WorkflowEvent = {
			type,
			workflowId,
			taskId,
			timestamp: new Date(),
			data,
			error
		};

		this.emit('event', event);
		this.emit(type, event);
	}

	/**
	 * Setup cleanup handlers for graceful shutdown
	 */
	private setupCleanupHandlers(): void {
		const cleanup = () => {
			console.log('Cleaning up processes...');
			this.cleanupAll(true).catch(console.error);
		};

		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);
		process.on('exit', cleanup);
	}
}
