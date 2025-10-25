/**
 * Service for managing task execution
 */

import type { Task } from '../../../common/types/index.js';
import type {
	ITaskExecutor,
	ExecutorOptions,
	ExecutionResult,
	ExecutorType
} from '../types.js';
import { ExecutorFactory } from '../executors/executor-factory.js';
import { getLogger } from '../../../common/logger/index.js';

export interface ExecutorServiceOptions {
	projectRoot: string;
	defaultExecutor?: ExecutorType;
	executorConfig?: Record<string, any>;
}

export class ExecutorService {
	private logger = getLogger('ExecutorService');
	private projectRoot: string;
	private defaultExecutor?: ExecutorType;
	private executorConfig: Record<string, any>;
	private currentExecutor?: ITaskExecutor;

	constructor(options: ExecutorServiceOptions) {
		this.projectRoot = options.projectRoot;
		this.defaultExecutor = options.defaultExecutor;
		this.executorConfig = options.executorConfig || {};
	}

	/**
	 * Execute a task
	 */
	async executeTask(
		task: Task,
		executorType?: ExecutorType
	): Promise<ExecutionResult> {
		try {
			// Determine executor type
			const type =
				executorType ||
				this.defaultExecutor ||
				(await ExecutorFactory.getDefaultExecutor(this.projectRoot));
			if (!type) {
				return {
					success: false,
					taskId: task.id,
					executorType: 'claude',
					error:
						'No executor available. Please install Claude CLI or specify an executor type.',
					startTime: new Date().toISOString()
				};
			}

			// Create executor
			const executorOptions: ExecutorOptions = {
				type,
				projectRoot: this.projectRoot,
				config: this.executorConfig
			};

			this.currentExecutor = ExecutorFactory.create(executorOptions);

			// Check if executor is available
			const isAvailable = await this.currentExecutor.isAvailable();
			if (!isAvailable) {
				return {
					success: false,
					taskId: task.id,
					executorType: type,
					error: `Executor ${type} is not available or not configured properly`,
					startTime: new Date().toISOString()
				};
			}

			// Execute the task
			this.logger.info(`Starting task ${task.id} with ${type} executor`);
			const result = await this.currentExecutor.execute(task);

			return result;
		} catch (error: any) {
			this.logger.error(`Failed to execute task ${task.id}:`, error);
			return {
				success: false,
				taskId: task.id,
				executorType: executorType || 'claude',
				error: error.message || 'Unknown error occurred',
				startTime: new Date().toISOString()
			};
		}
	}

	/**
	 * Stop the current task execution
	 */
	async stopCurrentTask(): Promise<void> {
		if (this.currentExecutor && this.currentExecutor.stop) {
			await this.currentExecutor.stop();
			this.currentExecutor = undefined;
		}
	}
}
