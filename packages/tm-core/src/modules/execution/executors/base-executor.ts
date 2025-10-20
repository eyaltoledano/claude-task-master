/**
 * Base executor class providing common functionality for all executors
 */

import type { Task } from '../../../common/types/index.js';
import type { ITaskExecutor, ExecutorType, ExecutionResult } from '../types.js';
import { getLogger } from '../../../common/logger/index.js';

export abstract class BaseExecutor implements ITaskExecutor {
	protected readonly logger = getLogger('BaseExecutor');
	protected readonly projectRoot: string;
	protected readonly config: Record<string, any>;

	constructor(projectRoot: string, config: Record<string, any> = {}) {
		this.projectRoot = projectRoot;
		this.config = config;
	}

	abstract execute(task: Task): Promise<ExecutionResult>;
	abstract getType(): ExecutorType;
	abstract isAvailable(): Promise<boolean>;

	/**
	 * Format task details into a readable prompt
	 */
	protected formatTaskPrompt(task: Task): string {
		const sections: string[] = [];

		sections.push(`Task ID: ${task.id}`);
		sections.push(`Title: ${task.title}`);

		if (task.description) {
			sections.push(`\nDescription:\n${task.description}`);
		}

		if (task.details) {
			sections.push(`\nImplementation Details:\n${task.details}`);
		}

		if (task.testStrategy) {
			sections.push(`\nTest Strategy:\n${task.testStrategy}`);
		}

		if (task.dependencies && task.dependencies.length > 0) {
			sections.push(`\nDependencies: ${task.dependencies.join(', ')}`);
		}

		if (task.subtasks && task.subtasks.length > 0) {
			const subtaskList = task.subtasks
				.map((st) => `  - [${st.status}] ${st.id}: ${st.title}`)
				.join('\n');
			sections.push(`\nSubtasks:\n${subtaskList}`);
		}

		sections.push(`\nStatus: ${task.status}`);
		sections.push(`Priority: ${task.priority}`);

		return sections.join('\n');
	}

	/**
	 * Create base execution result
	 */
	protected createResult(
		taskId: string,
		success: boolean,
		output?: string,
		error?: string
	): ExecutionResult {
		return {
			success,
			taskId,
			executorType: this.getType(),
			output,
			error,
			startTime: new Date().toISOString(),
			endTime: new Date().toISOString()
		};
	}
}
