/**
 * @fileoverview Shared utilities for autopilot commands
 */

import { WorkflowOrchestrator, GitAdapter, CommitMessageGenerator } from '@tm/core';
import { WorkflowState, WorkflowContext, SubtaskInfo } from '@tm/core';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * State file location relative to project root
 */
const STATE_FILE = '.taskmaster/workflow-state.json';

/**
 * Load workflow state from disk
 */
export async function loadWorkflowState(
	projectRoot: string
): Promise<WorkflowState | null> {
	const statePath = path.join(projectRoot, STATE_FILE);

	if (!(await fs.pathExists(statePath))) {
		return null;
	}

	try {
		const stateData = await fs.readJSON(statePath);
		return stateData;
	} catch (error) {
		throw new Error(`Failed to load workflow state: ${(error as Error).message}`);
	}
}

/**
 * Save workflow state to disk
 */
export async function saveWorkflowState(
	projectRoot: string,
	state: WorkflowState
): Promise<void> {
	const statePath = path.join(projectRoot, STATE_FILE);

	// Ensure directory exists
	await fs.ensureDir(path.dirname(statePath));

	try {
		await fs.writeJSON(statePath, state, { spaces: 2 });
	} catch (error) {
		throw new Error(`Failed to save workflow state: ${(error as Error).message}`);
	}
}

/**
 * Delete workflow state from disk
 */
export async function deleteWorkflowState(projectRoot: string): Promise<void> {
	const statePath = path.join(projectRoot, STATE_FILE);

	if (await fs.pathExists(statePath)) {
		await fs.remove(statePath);
	}
}

/**
 * Check if workflow state exists
 */
export async function hasWorkflowState(projectRoot: string): Promise<boolean> {
	const statePath = path.join(projectRoot, STATE_FILE);
	return await fs.pathExists(statePath);
}

/**
 * Initialize WorkflowOrchestrator with persistence
 */
export function createOrchestrator(
	context: WorkflowContext,
	projectRoot: string
): WorkflowOrchestrator {
	const orchestrator = new WorkflowOrchestrator(context);

	// Enable auto-persistence
	orchestrator.enableAutoPersist(async (state: WorkflowState) => {
		await saveWorkflowState(projectRoot, state);
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
