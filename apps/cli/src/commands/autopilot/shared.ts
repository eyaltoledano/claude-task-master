/**
 * @fileoverview Shared utilities for autopilot commands
 */

import {
	WorkflowOrchestrator,
	WorkflowStateManager,
	GitAdapter,
	CommitMessageGenerator
} from '@tm/core';
import type { WorkflowState, WorkflowContext, SubtaskInfo } from '@tm/core';
import chalk from 'chalk';

/**
 * Base options interface for all autopilot commands
 */
export interface AutopilotBaseOptions {
	projectRoot?: string;
	json?: boolean;
	verbose?: boolean;
}

/**
 * Load workflow state from disk using WorkflowStateManager
 */
export async function loadWorkflowState(
	projectRoot: string
): Promise<WorkflowState | null> {
	const stateManager = new WorkflowStateManager(projectRoot);

	if (!(await stateManager.exists())) {
		return null;
	}

	try {
		return await stateManager.load();
	} catch (error) {
		throw new Error(
			`Failed to load workflow state: ${(error as Error).message}`
		);
	}
}

/**
 * Save workflow state to disk using WorkflowStateManager
 */
export async function saveWorkflowState(
	projectRoot: string,
	state: WorkflowState
): Promise<void> {
	const stateManager = new WorkflowStateManager(projectRoot);

	try {
		await stateManager.save(state);
	} catch (error) {
		throw new Error(
			`Failed to save workflow state: ${(error as Error).message}`
		);
	}
}

/**
 * Delete workflow state from disk using WorkflowStateManager
 */
export async function deleteWorkflowState(projectRoot: string): Promise<void> {
	const stateManager = new WorkflowStateManager(projectRoot);
	await stateManager.delete();
}

/**
 * Check if workflow state exists using WorkflowStateManager
 */
export async function hasWorkflowState(projectRoot: string): Promise<boolean> {
	const stateManager = new WorkflowStateManager(projectRoot);
	return await stateManager.exists();
}

/**
 * Initialize WorkflowOrchestrator with persistence
 */
export function createOrchestrator(
	context: WorkflowContext,
	projectRoot: string
): WorkflowOrchestrator {
	const orchestrator = new WorkflowOrchestrator(context);
	const stateManager = new WorkflowStateManager(projectRoot);

	// Enable auto-persistence
	orchestrator.enableAutoPersist(async (state: WorkflowState) => {
		await stateManager.save(state);
	});

	return orchestrator;
}

/**
 * Initialize GitAdapter for project
 */
export function createGitAdapter(projectRoot: string): GitAdapter {
	return new GitAdapter(projectRoot);
}

/**
 * Initialize CommitMessageGenerator
 */
export function createCommitMessageGenerator(): CommitMessageGenerator {
	return new CommitMessageGenerator();
}

/**
 * Output formatter for JSON and text modes
 */
export class OutputFormatter {
	constructor(private useJson: boolean) {}

	/**
	 * Output data in appropriate format
	 */
	output(data: Record<string, unknown>): void {
		if (this.useJson) {
			console.log(JSON.stringify(data, null, 2));
		} else {
			this.outputText(data);
		}
	}

	/**
	 * Output data in human-readable text format
	 */
	private outputText(data: Record<string, unknown>): void {
		for (const [key, value] of Object.entries(data)) {
			if (typeof value === 'object' && value !== null) {
				console.log(chalk.cyan(`${key}:`));
				this.outputObject(value as Record<string, unknown>, '  ');
			} else {
				console.log(chalk.white(`${key}: ${value}`));
			}
		}
	}

	/**
	 * Output nested object with indentation
	 */
	private outputObject(obj: Record<string, unknown>, indent: string): void {
		for (const [key, value] of Object.entries(obj)) {
			if (typeof value === 'object' && value !== null) {
				console.log(chalk.cyan(`${indent}${key}:`));
				this.outputObject(value as Record<string, unknown>, indent + '  ');
			} else {
				console.log(chalk.gray(`${indent}${key}: ${value}`));
			}
		}
	}

	/**
	 * Output error message
	 */
	error(message: string, details?: Record<string, unknown>): void {
		if (this.useJson) {
			console.error(
				JSON.stringify(
					{
						error: message,
						...details
					},
					null,
					2
				)
			);
		} else {
			console.error(chalk.red(`Error: ${message}`));
			if (details) {
				for (const [key, value] of Object.entries(details)) {
					console.error(chalk.gray(`  ${key}: ${value}`));
				}
			}
		}
	}

	/**
	 * Output success message
	 */
	success(message: string, data?: Record<string, unknown>): void {
		if (this.useJson) {
			console.log(
				JSON.stringify(
					{
						success: true,
						message,
						...data
					},
					null,
					2
				)
			);
		} else {
			console.log(chalk.green(`✓ ${message}`));
			if (data) {
				this.output(data);
			}
		}
	}

	/**
	 * Output warning message
	 */
	warning(message: string): void {
		if (this.useJson) {
			console.warn(
				JSON.stringify(
					{
						warning: message
					},
					null,
					2
				)
			);
		} else {
			console.warn(chalk.yellow(`⚠ ${message}`));
		}
	}

	/**
	 * Output info message
	 */
	info(message: string): void {
		if (this.useJson) {
			// Don't output info messages in JSON mode
			return;
		}
		console.log(chalk.blue(`ℹ ${message}`));
	}
}

/**
 * Validate task ID format
 */
export function validateTaskId(taskId: string): boolean {
	// Task ID should be in format: number or number.number (e.g., "1" or "1.2")
	const pattern = /^\d+(\.\d+)*$/;
	return pattern.test(taskId);
}

/**
 * Parse subtasks from task data
 */
export function parseSubtasks(
	task: any,
	maxAttempts: number = 3
): SubtaskInfo[] {
	if (!task.subtasks || !Array.isArray(task.subtasks)) {
		return [];
	}

	return task.subtasks.map((subtask: any) => ({
		id: subtask.id,
		title: subtask.title,
		status: subtask.status === 'done' ? 'completed' : 'pending',
		attempts: 0,
		maxAttempts
	}));
}
