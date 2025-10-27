/**
 * Terminal Manager - Handles task execution in VS Code terminals
 * Uses @tm/core for consistent task management with the CLI
 */

import * as vscode from 'vscode';
import { createTmCore, type TmCore } from '@tm/core';
import type { ExtensionLogger } from '../utils/logger';

export interface TerminalExecutionOptions {
	taskId: string;
	taskTitle: string;
	tag?: string;
}

export interface TerminalExecutionResult {
	success: boolean;
	error?: string;
	terminalName?: string;
}

export class TerminalManager {
	private terminals = new Map<string, vscode.Terminal>();
	private tmCore?: TmCore;

	constructor(
		private context: vscode.ExtensionContext,
		private logger: ExtensionLogger
	) {}

	/**
	 * Execute a task in a new VS Code terminal with Claude
	 * Uses @tm/core for consistent task management with the CLI
	 */
	async executeTask(
		options: TerminalExecutionOptions
	): Promise<TerminalExecutionResult> {
		const { taskTitle, tag } = options;
		// Ensure taskId is always a string
		const taskId = String(options.taskId);

		this.logger.log(
			`Starting task execution for ${taskId}: ${taskTitle}${tag ? ` (tag: ${tag})` : ''}`
		);
		this.logger.log(`TaskId type: ${typeof taskId}, value: ${taskId}`);

		try {
			// Initialize tm-core if needed
			await this.initializeCore();

			// Use tm-core to start the task (same as CLI)
			const startResult = await this.tmCore!.tasks.start(taskId, {
				dryRun: false,
				force: false,
				updateStatus: true
			});

			if (!startResult.started || !startResult.executionOutput) {
				throw new Error(
					startResult.error || 'Failed to start task with tm-core'
				);
			}

			// Create terminal with custom TaskMaster icon
			const terminalName = `Task ${taskId}: ${taskTitle}`;
			const terminal = this.createTerminal(terminalName);

			// Store terminal reference for potential cleanup
			this.terminals.set(taskId, terminal);

			// Show terminal and run Claude command
			terminal.show();
			const command = `claude "${startResult.executionOutput}"`;
			terminal.sendText(command);

			this.logger.log(`Launched Claude for task ${taskId} using tm-core`);

			return {
				success: true,
				terminalName
			};
		} catch (error) {
			this.logger.error('Failed to execute task:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Create a new terminal with TaskMaster branding
	 */
	private createTerminal(name: string): vscode.Terminal {
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

		return vscode.window.createTerminal({
			name,
			cwd: workspaceRoot,
			iconPath: new vscode.ThemeIcon('play') // Use a VS Code built-in icon for now
		});
	}

	/**
	 * Initialize TaskMaster Core (same as CLI)
	 */
	private async initializeCore(): Promise<void> {
		if (!this.tmCore) {
			const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (!workspaceRoot) {
				throw new Error('No workspace folder found');
			}
			this.tmCore = await createTmCore({ projectPath: workspaceRoot });
		}
	}

	/**
	 * Get terminal by task ID (if still active)
	 */
	getTerminalByTaskId(taskId: string): vscode.Terminal | undefined {
		return this.terminals.get(taskId);
	}

	/**
	 * Clean up terminated terminals
	 */
	cleanupTerminal(taskId: string): void {
		const terminal = this.terminals.get(taskId);
		if (terminal) {
			this.terminals.delete(taskId);
		}
	}

	/**
	 * Dispose all managed terminals and clean up tm-core
	 */
	async dispose(): Promise<void> {
		this.terminals.forEach((terminal) => {
			try {
				terminal.dispose();
			} catch (error) {
				this.logger.error('Failed to dispose terminal:', error);
			}
		});
		this.terminals.clear();

		// Clear tm-core reference (no explicit cleanup needed)
		if (this.tmCore) {
			this.tmCore = undefined;
		}
	}
}
