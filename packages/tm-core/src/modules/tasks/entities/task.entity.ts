/**
 * @fileoverview Task entity with business rules and domain logic
 */

import { ERROR_CODES, TaskMasterError } from '../../../common/errors/task-master-error.js';
import type {
	Subtask,
	Task,
	TaskPriority,
	TaskStatus
} from '../../../common/types/index.js';

/**
 * Task entity representing a task with business logic
 * Encapsulates validation and state management rules
 */
export class TaskEntity implements Task {
	readonly id: string;
	title: string;
	description: string;
	status: TaskStatus;
	priority: TaskPriority;
	dependencies: string[];
	details: string;
	testStrategy: string;
	subtasks: Subtask[];

	// Optional properties
	createdAt?: string;
	updatedAt?: string;
	effort?: number;
	actualEffort?: number;
	tags?: string[];
	assignee?: string;
	complexity?: Task['complexity'];
	recommendedSubtasks?: number;
	expansionPrompt?: string;
	complexityReasoning?: string;

	constructor(data: Task | (Omit<Task, 'id'> & { id: number | string })) {
		this.validate(data);

		// Always convert ID to string
		this.id = String(data.id);
		this.title = data.title;
		this.description = data.description;
		this.status = data.status;
		this.priority = data.priority;
		// Ensure dependency IDs are also strings
		this.dependencies = (data.dependencies || []).map((dep) => String(dep));
		this.details = data.details;
		this.testStrategy = data.testStrategy;
		// Normalize subtask IDs to strings
		this.subtasks = (data.subtasks || []).map((subtask) => ({
			...subtask,
			id: String(subtask.id),
			parentId: String(subtask.parentId)
		}));

		// Optional properties
		this.createdAt = data.createdAt;
		this.updatedAt = data.updatedAt;
		this.effort = data.effort;
		this.actualEffort = data.actualEffort;
		this.tags = data.tags;
		this.assignee = data.assignee;
		this.complexity = data.complexity;
		this.recommendedSubtasks = data.recommendedSubtasks;
		this.expansionPrompt = data.expansionPrompt;
		this.complexityReasoning = data.complexityReasoning;
	}

	/**
	 * Validate task data
	 */
	private validate(
		data: Partial<Task> | Partial<Omit<Task, 'id'> & { id: number | string }>
	): void {
		if (
			data.id === undefined ||
			data.id === null ||
			(typeof data.id !== 'string' && typeof data.id !== 'number')
		) {
			throw new TaskMasterError(
				'Task ID is required and must be a string or number',
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		if (!data.title || data.title.trim().length === 0) {
			throw new TaskMasterError(
				'Task title is required',
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		if (!data.description || data.description.trim().length === 0) {
			throw new TaskMasterError(
				'Task description is required',
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		if (!this.isValidStatus(data.status)) {
			throw new TaskMasterError(
				`Invalid task status: ${data.status}`,
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		if (!this.isValidPriority(data.priority)) {
			throw new TaskMasterError(
				`Invalid task priority: ${data.priority}`,
				ERROR_CODES.VALIDATION_ERROR
			);
		}
	}

	/**
	 * Check if status is valid
	 */
	private isValidStatus(status: any): status is TaskStatus {
		return [
			'pending',
			'in-progress',
			'done',
			'deferred',
			'cancelled',
			'blocked',
			'review'
		].includes(status);
	}

	/**
	 * Check if priority is valid
	 */
	private isValidPriority(priority: any): priority is TaskPriority {
		return ['low', 'medium', 'high', 'critical'].includes(priority);
	}

	/**
	 * Check if task can be marked as complete
	 */
	canComplete(): boolean {
		// Cannot complete if status is already done or cancelled
		if (this.status === 'done' || this.status === 'cancelled') {
			return false;
		}

		// Cannot complete if blocked
		if (this.status === 'blocked') {
			return false;
		}

		// Check if all subtasks are complete
		const allSubtasksComplete = this.subtasks.every(
			(subtask) => subtask.status === 'done' || subtask.status === 'cancelled'
		);

		return allSubtasksComplete;
	}

	/**
	 * Mark task as complete
	 */
	markAsComplete(): void {
		if (!this.canComplete()) {
			throw new TaskMasterError(
				'Task cannot be marked as complete',
				ERROR_CODES.TASK_STATUS_ERROR,
				{
					taskId: this.id,
					currentStatus: this.status,
					hasIncompleteSubtasks: this.subtasks.some(
						(s) => s.status !== 'done' && s.status !== 'cancelled'
					)
				}
			);
		}

		this.status = 'done';
		this.updatedAt = new Date().toISOString();
	}

	/**
	 * Check if task has dependencies
	 */
	hasDependencies(): boolean {
		return this.dependencies.length > 0;
	}

	/**
	 * Check if task has subtasks
	 */
	hasSubtasks(): boolean {
		return this.subtasks.length > 0;
	}

	/**
	 * Add a subtask
	 */
	addSubtask(subtask: Omit<Subtask, 'id' | 'parentId'>): void {
		const nextId = this.subtasks.length + 1;
		this.subtasks.push({
			...subtask,
			id: nextId,
			parentId: this.id
		});
		this.updatedAt = new Date().toISOString();
	}

	/**
	 * Update task status
	 */
	updateStatus(newStatus: TaskStatus): void {
		if (!this.isValidStatus(newStatus)) {
			throw new TaskMasterError(
				`Invalid status: ${newStatus}`,
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		// Business rule: Cannot move from done to pending
		if (this.status === 'done' && newStatus === 'pending') {
			throw new TaskMasterError(
				'Cannot move completed task back to pending',
				ERROR_CODES.TASK_STATUS_ERROR
			);
		}

		this.status = newStatus;
		this.updatedAt = new Date().toISOString();
	}

	/**
	 * Convert entity to plain object
	 */
	toJSON(): Task {
		return {
			id: this.id,
			title: this.title,
			description: this.description,
			status: this.status,
			priority: this.priority,
			dependencies: this.dependencies,
			details: this.details,
			testStrategy: this.testStrategy,
			subtasks: this.subtasks,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
			effort: this.effort,
			actualEffort: this.actualEffort,
			tags: this.tags,
			assignee: this.assignee,
			complexity: this.complexity,
			recommendedSubtasks: this.recommendedSubtasks,
			expansionPrompt: this.expansionPrompt,
			complexityReasoning: this.complexityReasoning
		};
	}

	/**
	 * Create TaskEntity from plain object
	 */
	static fromObject(data: Task): TaskEntity {
		return new TaskEntity(data);
	}

	/**
	 * Create multiple TaskEntities from array
	 */
	static fromArray(data: Task[]): TaskEntity[] {
		return data.map((task) => new TaskEntity(task));
	}
}
