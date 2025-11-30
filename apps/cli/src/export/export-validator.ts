/**
 * @fileoverview Export Validator
 * Validates tasks before export to Hamster
 */

import type {
	ExportValidationResult,
	ExportableTask,
	TaskValidationResult
} from './types.js';

/**
 * Validates a single task for export
 */
export function validateTask(task: ExportableTask): TaskValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Required: title
	if (!task.title || task.title.trim().length === 0) {
		errors.push('Task title is required');
	}

	// Required: id
	if (!task.id) {
		errors.push('Task ID is required');
	}

	// Warning: missing description
	if (!task.description || task.description.trim().length === 0) {
		warnings.push('Task has no description');
	}

	// Warning: missing status (will default to 'todo')
	if (!task.status) {
		warnings.push('Task has no status, will default to "todo"');
	}

	// Warning: missing priority (will default to 'medium')
	if (!task.priority) {
		warnings.push('Task has no priority, will default to "medium"');
	}

	// Warning: title too short
	if (task.title && task.title.trim().length < 5) {
		warnings.push('Task title is very short');
	}

	// Warning: title too long
	if (task.title && task.title.length > 200) {
		warnings.push('Task title is very long (>200 chars)');
	}

	return {
		taskId: task.id,
		isValid: errors.length === 0,
		errors,
		warnings
	};
}

/**
 * Validates multiple tasks for export
 */
export function validateTasks(tasks: ExportableTask[]): ExportValidationResult {
	const taskResults = tasks.map(validateTask);
	const validTasks = taskResults.filter((r) => r.isValid).length;
	const invalidTasks = taskResults.filter((r) => !r.isValid).length;

	const allErrors: string[] = [];
	const allWarnings: string[] = [];

	// Collect all errors and warnings
	for (const result of taskResults) {
		for (const error of result.errors) {
			allErrors.push(`Task ${result.taskId}: ${error}`);
		}
		for (const warning of result.warnings) {
			allWarnings.push(`Task ${result.taskId}: ${warning}`);
		}
	}

	// Check for empty task list
	if (tasks.length === 0) {
		allErrors.push('No tasks selected for export');
	}

	// Check for circular dependencies
	const circularDeps = detectCircularDependencies(tasks);
	if (circularDeps.length > 0) {
		for (const cycle of circularDeps) {
			allWarnings.push(`Circular dependency detected: ${cycle.join(' → ')}`);
		}
	}

	// Check for missing dependency targets
	const missingDeps = detectMissingDependencies(tasks);
	if (missingDeps.length > 0) {
		for (const { taskId, missingDep } of missingDeps) {
			allWarnings.push(
				`Task ${taskId} depends on non-existent task ${missingDep}`
			);
		}
	}

	return {
		isValid: invalidTasks === 0 && allErrors.length === 0,
		totalTasks: tasks.length,
		validTasks,
		invalidTasks,
		taskResults,
		errors: allErrors,
		warnings: allWarnings
	};
}

/**
 * Detects circular dependencies in tasks
 */
function detectCircularDependencies(tasks: ExportableTask[]): string[][] {
	const cycles: string[][] = [];
	const taskMap = new Map(tasks.map((t) => [t.id, t]));

	function dfs(taskId: string, path: string[], visited: Set<string>): boolean {
		if (path.includes(taskId)) {
			// Found a cycle
			const cycleStart = path.indexOf(taskId);
			cycles.push([...path.slice(cycleStart), taskId]);
			return true;
		}

		if (visited.has(taskId)) {
			return false;
		}

		visited.add(taskId);
		path.push(taskId);

		const task = taskMap.get(taskId);
		if (task?.dependencies) {
			for (const depId of task.dependencies) {
				dfs(depId, path, visited);
			}
		}

		path.pop();
		return false;
	}

	const visited = new Set<string>();
	for (const task of tasks) {
		if (!visited.has(task.id)) {
			dfs(task.id, [], visited);
		}
	}

	return cycles;
}

/**
 * Detects dependencies that reference non-existent tasks
 */
function detectMissingDependencies(
	tasks: ExportableTask[]
): Array<{ taskId: string; missingDep: string }> {
	const taskIds = new Set(tasks.map((t) => t.id));
	const missing: Array<{ taskId: string; missingDep: string }> = [];

	for (const task of tasks) {
		if (task.dependencies) {
			for (const depId of task.dependencies) {
				if (!taskIds.has(depId)) {
					missing.push({ taskId: task.id, missingDep: depId });
				}
			}
		}
	}

	return missing;
}

/**
 * Filters tasks to only include valid ones
 */
export function filterValidTasks(tasks: ExportableTask[]): ExportableTask[] {
	return tasks.filter((task) => validateTask(task).isValid);
}
