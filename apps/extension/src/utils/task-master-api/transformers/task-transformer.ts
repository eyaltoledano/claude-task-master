/**
 * Task Transformer
 * Handles transformation and validation of MCP responses to internal format
 */

import type { ExtensionLogger } from '../../logger';
import { MCPTaskResponse, type TaskMasterTask } from '../types';

export class TaskTransformer {
	constructor(private logger: ExtensionLogger) {}

	/**
	 * Transform MCP tasks response to internal format
	 */
	transformMCPTasksResponse(mcpResponse: any): TaskMasterTask[] {
		const transformStartTime = Date.now();

		try {
			// Validate response structure
			const validationResult = this.validateMCPResponse(mcpResponse);
			if (!validationResult.isValid) {
				this.logger.warn(
					'MCP response validation failed:',
					validationResult.errors
				);
				return [];
			}

			// Handle different response structures
			let tasks = [];
			if (Array.isArray(mcpResponse)) {
				tasks = mcpResponse;
			} else if (mcpResponse.data) {
				if (Array.isArray(mcpResponse.data)) {
					tasks = mcpResponse.data;
				} else if (
					mcpResponse.data.tasks &&
					Array.isArray(mcpResponse.data.tasks)
				) {
					tasks = mcpResponse.data.tasks;
				}
			} else if (mcpResponse.tasks && Array.isArray(mcpResponse.tasks)) {
				tasks = mcpResponse.tasks;
			}

			this.logger.log(`Transforming ${tasks.length} tasks from MCP response`, {
				responseStructure: {
					isArray: Array.isArray(mcpResponse),
					hasData: !!mcpResponse.data,
					dataIsArray: Array.isArray(mcpResponse.data),
					hasDataTasks: !!mcpResponse.data?.tasks,
					hasTasks: !!mcpResponse.tasks
				}
			});

			const transformedTasks: TaskMasterTask[] = [];
			const transformationErrors: Array<{
				taskId: any;
				error: string;
				task: any;
			}> = [];

			for (let i = 0; i < tasks.length; i++) {
				try {
					const task = tasks[i];
					const transformedTask = this.transformSingleTask(task, i);
					if (transformedTask) {
						transformedTasks.push(transformedTask);
					}
				} catch (error) {
					const errorMsg =
						error instanceof Error
							? error.message
							: 'Unknown transformation error';
					transformationErrors.push({
						taskId: tasks[i]?.id || `unknown_${i}`,
						error: errorMsg,
						task: tasks[i]
					});
					this.logger.error(
						`Failed to transform task at index ${i}:`,
						errorMsg,
						tasks[i]
					);
				}
			}

			// Log transformation summary
			const transformDuration = Date.now() - transformStartTime;
			this.logger.log(`Transformation completed in ${transformDuration}ms`, {
				totalTasks: tasks.length,
				successfulTransformations: transformedTasks.length,
				errors: transformationErrors.length,
				errorSummary: transformationErrors.map((e) => ({
					id: e.taskId,
					error: e.error
				}))
			});

			return transformedTasks;
		} catch (error) {
			this.logger.error(
				'Critical error during response transformation:',
				error
			);
			return [];
		}
	}

	/**
	 * Validate MCP response structure
	 */
	private validateMCPResponse(mcpResponse: any): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		if (!mcpResponse) {
			errors.push('Response is null or undefined');
			return { isValid: false, errors };
		}

		// Arrays are valid responses
		if (Array.isArray(mcpResponse)) {
			return { isValid: true, errors };
		}

		if (typeof mcpResponse !== 'object') {
			errors.push('Response is not an object or array');
			return { isValid: false, errors };
		}

		if (mcpResponse.error) {
			errors.push(`MCP error: ${mcpResponse.error}`);
		}

		// Check for valid task structure
		const hasValidTasksStructure =
			(mcpResponse.data && Array.isArray(mcpResponse.data)) ||
			(mcpResponse.data?.tasks && Array.isArray(mcpResponse.data.tasks)) ||
			(mcpResponse.tasks && Array.isArray(mcpResponse.tasks));

		if (!hasValidTasksStructure && !mcpResponse.error) {
			errors.push('Response does not contain a valid tasks array structure');
		}

		return { isValid: errors.length === 0, errors };
	}

	/**
	 * Transform a single task with validation
	 */
	private transformSingleTask(task: any, index: number): TaskMasterTask | null {
		if (!task || typeof task !== 'object') {
			this.logger.warn(`Task at index ${index} is not a valid object:`, task);
			return null;
		}

		try {
			// Validate required fields
			const taskId = this.validateAndNormalizeId(task.id, index);
			const title =
				this.validateAndNormalizeString(
					task.title,
					'Untitled Task',
					`title for task ${taskId}`
				) || 'Untitled Task';
			const description =
				this.validateAndNormalizeString(
					task.description,
					'',
					`description for task ${taskId}`
				) || '';

			// Normalize and validate status/priority
			const status = this.normalizeStatus(task.status);
			const priority = this.normalizePriority(task.priority);

			// Handle optional fields
			const details = this.validateAndNormalizeString(
				task.details,
				undefined,
				`details for task ${taskId}`
			);
			const testStrategy = this.validateAndNormalizeString(
				task.testStrategy,
				undefined,
				`testStrategy for task ${taskId}`
			);

			// Handle complexity score
			const complexityScore =
				typeof task.complexityScore === 'number'
					? task.complexityScore
					: undefined;

			// Transform dependencies
			const dependencies = this.transformDependencies(
				task.dependencies,
				taskId
			);

			// Transform subtasks
			const subtasks = this.transformSubtasks(task.subtasks, taskId);

			const transformedTask: TaskMasterTask = {
				id: taskId,
				title,
				description,
				status,
				priority,
				details,
				testStrategy,
				complexityScore,
				dependencies,
				subtasks
			};

			// Log successful transformation for complex tasks
			if (
				(subtasks && subtasks.length > 0) ||
				dependencies.length > 0 ||
				complexityScore !== undefined
			) {
				this.logger.debug(`Successfully transformed complex task ${taskId}:`, {
					subtaskCount: subtasks?.length ?? 0,
					dependencyCount: dependencies.length,
					status,
					priority,
					complexityScore
				});
			}

			return transformedTask;
		} catch (error) {
			this.logger.error(
				`Error transforming task at index ${index}:`,
				error,
				task
			);
			return null;
		}
	}

	private validateAndNormalizeId(id: any, fallbackIndex: number): string {
		if (id === null || id === undefined) {
			const generatedId = `generated_${fallbackIndex}_${Date.now()}`;
			this.logger.warn(`Task missing ID, generated: ${generatedId}`);
			return generatedId;
		}

		const stringId = String(id).trim();
		if (stringId === '') {
			const generatedId = `empty_${fallbackIndex}_${Date.now()}`;
			this.logger.warn(`Task has empty ID, generated: ${generatedId}`);
			return generatedId;
		}

		return stringId;
	}

	private validateAndNormalizeString(
		value: any,
		defaultValue: string | undefined,
		fieldName: string
	): string | undefined {
		if (value === null || value === undefined) {
			return defaultValue;
		}

		if (typeof value !== 'string') {
			this.logger.warn(`${fieldName} is not a string, converting:`, value);
			return String(value).trim() || defaultValue;
		}

		const trimmed = value.trim();
		if (trimmed === '' && defaultValue !== undefined) {
			return defaultValue;
		}

		return trimmed || defaultValue;
	}

	private transformDependencies(dependencies: any, taskId: string): string[] {
		if (!dependencies) {
			return [];
		}

		if (!Array.isArray(dependencies)) {
			this.logger.warn(
				`Dependencies for task ${taskId} is not an array:`,
				dependencies
			);
			return [];
		}

		const validDependencies: string[] = [];
		for (let i = 0; i < dependencies.length; i++) {
			const dep = dependencies[i];
			if (dep === null || dep === undefined) {
				this.logger.warn(`Null dependency at index ${i} for task ${taskId}`);
				continue;
			}

			const stringDep = String(dep).trim();
			if (stringDep === '') {
				this.logger.warn(`Empty dependency at index ${i} for task ${taskId}`);
				continue;
			}

			// Check for self-dependency
			if (stringDep === taskId) {
				this.logger.warn(
					`Self-dependency detected for task ${taskId}, skipping`
				);
				continue;
			}

			validDependencies.push(stringDep);
		}

		return validDependencies;
	}

	private transformSubtasks(
		subtasks: any,
		parentTaskId: string
	): TaskMasterTask['subtasks'] {
		if (!subtasks) {
			return [];
		}

		if (!Array.isArray(subtasks)) {
			this.logger.warn(
				`Subtasks for task ${parentTaskId} is not an array:`,
				subtasks
			);
			return [];
		}

		const validSubtasks = [];
		for (let i = 0; i < subtasks.length; i++) {
			try {
				const subtask = subtasks[i];
				if (!subtask || typeof subtask !== 'object') {
					this.logger.warn(
						`Invalid subtask at index ${i} for task ${parentTaskId}:`,
						subtask
					);
					continue;
				}

				const transformedSubtask = {
					id: typeof subtask.id === 'number' ? subtask.id : i + 1,
					title:
						this.validateAndNormalizeString(
							subtask.title,
							`Subtask ${i + 1}`,
							`subtask title for parent ${parentTaskId}`
						) || `Subtask ${i + 1}`,
					description: this.validateAndNormalizeString(
						subtask.description,
						undefined,
						`subtask description for parent ${parentTaskId}`
					),
					status:
						this.validateAndNormalizeString(
							subtask.status,
							'pending',
							`subtask status for parent ${parentTaskId}`
						) || 'pending',
					details: this.validateAndNormalizeString(
						subtask.details,
						undefined,
						`subtask details for parent ${parentTaskId}`
					),
					testStrategy: this.validateAndNormalizeString(
						subtask.testStrategy,
						undefined,
						`subtask testStrategy for parent ${parentTaskId}`
					),
					dependencies: subtask.dependencies || []
				};

				validSubtasks.push(transformedSubtask);
			} catch (error) {
				this.logger.error(
					`Error transforming subtask at index ${i} for task ${parentTaskId}:`,
					error
				);
			}
		}

		return validSubtasks;
	}

	private normalizeStatus(status: string): TaskMasterTask['status'] {
		const original = status;
		const normalized = status?.toLowerCase()?.trim() || 'pending';

		const statusMap: Record<string, TaskMasterTask['status']> = {
			pending: 'pending',
			'in-progress': 'in-progress',
			in_progress: 'in-progress',
			inprogress: 'in-progress',
			progress: 'in-progress',
			working: 'in-progress',
			active: 'in-progress',
			review: 'review',
			reviewing: 'review',
			'in-review': 'review',
			in_review: 'review',
			done: 'done',
			completed: 'done',
			complete: 'done',
			finished: 'done',
			closed: 'done',
			resolved: 'done',
			blocked: 'deferred',
			block: 'deferred',
			stuck: 'deferred',
			waiting: 'deferred',
			cancelled: 'cancelled',
			canceled: 'cancelled',
			cancel: 'cancelled',
			abandoned: 'cancelled',
			deferred: 'deferred',
			defer: 'deferred',
			postponed: 'deferred',
			later: 'deferred'
		};

		const result = statusMap[normalized] || 'pending';

		if (original && original !== result) {
			this.logger.debug(`Normalized status '${original}' -> '${result}'`);
		}

		return result;
	}

	private normalizePriority(priority: string): TaskMasterTask['priority'] {
		const original = priority;
		const normalized = priority?.toLowerCase()?.trim() || 'medium';

		let result: TaskMasterTask['priority'] = 'medium';

		if (
			normalized.includes('high') ||
			normalized.includes('urgent') ||
			normalized.includes('critical') ||
			normalized.includes('important') ||
			normalized === 'h' ||
			normalized === '3'
		) {
			result = 'high';
		} else if (
			normalized.includes('low') ||
			normalized.includes('minor') ||
			normalized.includes('trivial') ||
			normalized === 'l' ||
			normalized === '1'
		) {
			result = 'low';
		} else if (
			normalized.includes('medium') ||
			normalized.includes('normal') ||
			normalized.includes('standard') ||
			normalized === 'm' ||
			normalized === '2'
		) {
			result = 'medium';
		}

		if (original && original !== result) {
			this.logger.debug(`Normalized priority '${original}' -> '${result}'`);
		}

		return result;
	}
}
