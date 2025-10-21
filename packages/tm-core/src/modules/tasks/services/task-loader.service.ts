/**
 * @fileoverview Task Loader Service
 * Loads and validates tasks for autopilot execution
 */

import type { Task, Subtask, TaskStatus } from '../../../common/types/index.js';
import type { TaskService } from './task-service.js';
import { getLogger } from '../../../common/logger/factory.js';

const logger = getLogger('TaskLoader');

/**
 * Validation error types
 */
export type ValidationErrorType =
	| 'task_not_found'
	| 'task_completed'
	| 'no_subtasks'
	| 'circular_dependencies'
	| 'missing_dependencies'
	| 'invalid_structure';

/**
 * Validation result for task loading
 */
export interface TaskValidationResult {
	/** Whether validation passed */
	success: boolean;
	/** Loaded task (only present if validation succeeded) */
	task?: Task;
	/** Error type */
	errorType?: ValidationErrorType;
	/** Human-readable error message */
	errorMessage?: string;
	/** Actionable suggestion for fixing the error */
	suggestion?: string;
	/** Dependency analysis (only for dependency errors) */
	dependencyIssues?: DependencyIssue[];
}

/**
 * Dependency issue details
 */
export interface DependencyIssue {
	/** Subtask ID with the issue */
	subtaskId: string;
	/** Type of dependency issue */
	issueType: 'circular' | 'missing' | 'invalid';
	/** Description of the issue */
	message: string;
	/** The problematic dependency reference */
	dependencyRef?: string;
}

/**
 * TaskLoaderService loads and validates tasks for autopilot execution
 */
export class TaskLoaderService {
	private taskService: TaskService;

	constructor(taskService: TaskService) {
		if (!taskService) {
			throw new Error('taskService is required for TaskLoaderService');
		}
		this.taskService = taskService;
	}

	/**
	 * Load and validate a task for autopilot execution
	 */
	async loadAndValidateTask(taskId: string): Promise<TaskValidationResult> {
		logger.info(`Loading task ${taskId}...`);

		// Step 1: Load task
		const task = await this.loadTask(taskId);
		if (!task) {
			return {
				success: false,
				errorType: 'task_not_found',
				errorMessage: `Task with ID "${taskId}" not found`,
				suggestion:
					'Use "task-master list" to see available tasks or verify the task ID is correct.'
			};
		}

		// Step 2: Validate task status
		const statusValidation = this.validateTaskStatus(task);
		if (!statusValidation.success) {
			return statusValidation;
		}

		// Step 3: Check for subtasks
		const subtaskValidation = this.validateSubtasksExist(task);
		if (!subtaskValidation.success) {
			return subtaskValidation;
		}

		// Step 4: Validate subtask structure
		const structureValidation = this.validateSubtaskStructure(task);
		if (!structureValidation.success) {
			return structureValidation;
		}

		// Step 5: Analyze dependencies
		const dependencyValidation = this.validateDependencies(task);
		if (!dependencyValidation.success) {
			return dependencyValidation;
		}

		logger.info(`Task ${taskId} validated successfully`);

		return {
			success: true,
			task
		};
	}

	/**
	 * Load task using TaskService
	 */
	private async loadTask(taskId: string): Promise<Task | null> {
		try {
			return await this.taskService.getTask(taskId);
		} catch (error) {
			logger.error(`Failed to load task ${taskId}:`, error);
			return null;
		}
	}

	/**
	 * Validate task status is appropriate for autopilot
	 */
	private validateTaskStatus(task: Task): TaskValidationResult {
		const completedStatuses: TaskStatus[] = ['done', 'completed', 'cancelled'];

		if (completedStatuses.includes(task.status)) {
			return {
				success: false,
				errorType: 'task_completed',
				errorMessage: `Task "${task.title}" is already ${task.status}`,
				suggestion:
					'Autopilot can only execute tasks that are pending or in-progress. Use a different task.'
			};
		}

		return { success: true };
	}

	/**
	 * Validate task has subtasks
	 */
	private validateSubtasksExist(task: Task): TaskValidationResult {
		if (!task.subtasks || task.subtasks.length === 0) {
			return {
				success: false,
				errorType: 'no_subtasks',
				errorMessage: `Task "${task.title}" has no subtasks`,
				suggestion: this.buildExpansionSuggestion(task)
			};
		}

		return { success: true };
	}

	/**
	 * Build helpful suggestion for expanding tasks
	 */
	private buildExpansionSuggestion(task: Task): string {
		const suggestions: string[] = [
			`Autopilot requires tasks to be broken down into subtasks for execution.`
		];

		// Add expansion command suggestion
		suggestions.push(`\nExpand this task using:`);
		suggestions.push(`  task-master expand --id=${task.id}`);

		// If task has complexity analysis, mention it
		if (task.complexity || task.recommendedSubtasks) {
			suggestions.push(
				`\nThis task has complexity analysis available. Consider reviewing it first:`
			);
			suggestions.push(`  task-master show ${task.id}`);
		} else {
			suggestions.push(
				`\nOr analyze task complexity first to determine optimal subtask count:`
			);
			suggestions.push(`  task-master analyze-complexity --from=${task.id}`);
		}

		return suggestions.join('\n');
	}

	/**
	 * Validate subtask structure
	 */
	private validateSubtaskStructure(task: Task): TaskValidationResult {
		for (const subtask of task.subtasks) {
			// Check required fields
			if (!subtask.title || !subtask.description) {
				return {
					success: false,
					errorType: 'invalid_structure',
					errorMessage: `Subtask ${task.id}.${subtask.id} is missing required fields`,
					suggestion:
						'Subtasks must have title and description. Re-expand the task or manually fix the subtask structure.'
				};
			}

			// Validate dependencies are arrays
			if (subtask.dependencies && !Array.isArray(subtask.dependencies)) {
				return {
					success: false,
					errorType: 'invalid_structure',
					errorMessage: `Subtask ${task.id}.${subtask.id} has invalid dependencies format`,
					suggestion:
						'Dependencies must be an array. Fix the task structure manually.'
				};
			}
		}

		return { success: true };
	}

	/**
	 * Validate subtask dependencies
	 */
	private validateDependencies(task: Task): TaskValidationResult {
		const issues: DependencyIssue[] = [];
		const subtaskIds = new Set(task.subtasks.map((st) => String(st.id)));

		for (const subtask of task.subtasks) {
			const subtaskId = `${task.id}.${subtask.id}`;

			// Check for missing dependencies
			if (subtask.dependencies && subtask.dependencies.length > 0) {
				for (const depId of subtask.dependencies) {
					const depIdStr = String(depId);

					if (!subtaskIds.has(depIdStr)) {
						issues.push({
							subtaskId,
							issueType: 'missing',
							message: `References non-existent subtask ${depIdStr}`,
							dependencyRef: depIdStr
						});
					}
				}
			}

			// Check for circular dependencies
			const circularCheck = this.detectCircularDependency(
				subtask,
				task.subtasks,
				new Set()
			);

			if (circularCheck) {
				issues.push({
					subtaskId,
					issueType: 'circular',
					message: `Circular dependency detected: ${circularCheck.join(' -> ')}`
				});
			}
		}

		if (issues.length > 0) {
			const errorType =
				issues[0].issueType === 'circular'
					? 'circular_dependencies'
					: 'missing_dependencies';

			return {
				success: false,
				errorType,
				errorMessage: `Task "${task.title}" has dependency issues`,
				suggestion:
					'Fix dependency issues manually or re-expand the task:\n' +
					issues
						.map((issue) => `  - ${issue.subtaskId}: ${issue.message}`)
						.join('\n'),
				dependencyIssues: issues
			};
		}

		return { success: true };
	}

	/**
	 * Detect circular dependencies using depth-first search
	 */
	private detectCircularDependency(
		subtask: Subtask,
		allSubtasks: Subtask[],
		visited: Set<string>
	): string[] | null {
		const subtaskId = String(subtask.id);

		if (visited.has(subtaskId)) {
			return [subtaskId];
		}

		visited.add(subtaskId);

		if (subtask.dependencies && subtask.dependencies.length > 0) {
			for (const depId of subtask.dependencies) {
				const depIdStr = String(depId);
				const dependency = allSubtasks.find((st) => String(st.id) === depIdStr);

				if (dependency) {
					const circular = this.detectCircularDependency(
						dependency,
						allSubtasks,
						new Set(visited)
					);

					if (circular) {
						return [subtaskId, ...circular];
					}
				}
			}
		}

		return null;
	}

	/**
	 * Get ordered subtask execution sequence
	 * Returns subtasks in dependency order (tasks with no deps first)
	 */
	getExecutionOrder(task: Task): Subtask[] {
		const ordered: Subtask[] = [];
		const completed = new Set<string>();

		// Keep adding subtasks whose dependencies are all completed
		while (ordered.length < task.subtasks.length) {
			let added = false;

			for (const subtask of task.subtasks) {
				const subtaskId = String(subtask.id);

				if (completed.has(subtaskId)) {
					continue;
				}

				// Check if all dependencies are completed
				const allDepsCompleted =
					!subtask.dependencies ||
					subtask.dependencies.length === 0 ||
					subtask.dependencies.every((depId) => completed.has(String(depId)));

				if (allDepsCompleted) {
					ordered.push(subtask);
					completed.add(subtaskId);
					added = true;
					break;
				}
			}

			// Safety check to prevent infinite loop
			if (!added && ordered.length < task.subtasks.length) {
				logger.warn(
					`Could not determine complete execution order for task ${task.id}`
				);
				// Add remaining subtasks in original order
				for (const subtask of task.subtasks) {
					if (!completed.has(String(subtask.id))) {
						ordered.push(subtask);
					}
				}
				break;
			}
		}

		return ordered;
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		// TaskService doesn't require explicit cleanup
		// Resources are automatically released when instance is garbage collected
	}
}
