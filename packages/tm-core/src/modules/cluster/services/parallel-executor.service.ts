/**
 * @fileoverview Parallel Executor Service
 * Executes tasks within a cluster concurrently, bounded by resource constraints.
 */

import type { Task } from '../../../common/types/index.js';
import type {
	ClusterMetadata,
	TaskExecutionResult,
	ClusterExecutionResult,
	ProgressEventListener,
	ProgressEventData
} from '../types.js';
import { getLogger } from '../../../common/logger/factory.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';

/**
 * Resource constraints for parallel execution
 */
export interface ResourceConstraints {
	/** Maximum number of concurrent tasks */
	maxConcurrentTasks: number;
	/** Maximum memory usage in MB (0 = unlimited) */
	maxMemoryMB?: number;
	/** Task timeout in milliseconds */
	taskTimeoutMs?: number;
}

/**
 * Task executor function type
 */
export type TaskExecutor = (task: Task) => Promise<TaskExecutionResult>;

/**
 * Execution context for a single task.
 * Note: `promise` stores a sentinel value — actual execution is tracked via the worker pool.
 * Note: `abortController` is a placeholder — its signal is not currently wired into the executor.
 */
interface TaskExecutionContext {
	task: Task;
	startTime: Date;
	promise: Promise<TaskExecutionResult>;
	abortController: AbortController;
}

/**
 * ParallelExecutorService manages concurrent task execution within clusters
 */
export class ParallelExecutorService {
	private logger = getLogger('ParallelExecutorService');
	private eventListeners: Set<ProgressEventListener> = new Set();
	private listenerFailureCounts: Map<ProgressEventListener, number> =
		new Map();
	private activeExecutions: Map<string, TaskExecutionContext> = new Map();
	private constraints: ResourceConstraints;

	constructor(constraints: ResourceConstraints = { maxConcurrentTasks: 5 }) {
		this.constraints = constraints;
	}

	/**
	 * Execute all tasks in a cluster concurrently, bounded by resource constraints
	 */
	async executeCluster(
		cluster: ClusterMetadata,
		tasks: Task[],
		executor: TaskExecutor
	): Promise<ClusterExecutionResult> {
		this.logger.info('Starting cluster execution', {
			clusterId: cluster.clusterId,
			taskCount: tasks.length
		});

		const startTime = new Date();
		const taskResults: TaskExecutionResult[] = [];
		const failedTasks: string[] = [];
		const completedTasks: string[] = [];

		this.emitEvent({
			type: 'cluster:started',
			timestamp: new Date(),
			clusterId: cluster.clusterId,
			status: 'in-progress'
		});

		try {
			const results = await this.executeWithWorkerPool(tasks, executor);

			results.forEach((result) => {
				taskResults.push(result);
				if (result.success) {
					completedTasks.push(result.taskId);
				} else {
					failedTasks.push(result.taskId);
				}
			});

			const endTime = new Date();
			const duration = endTime.getTime() - startTime.getTime();
			const success = failedTasks.length === 0;

			this.emitEvent({
				type: success ? 'cluster:completed' : 'cluster:failed',
				timestamp: new Date(),
				clusterId: cluster.clusterId,
				status: success ? 'done' : 'failed',
				metadata: {
					completedTasks: completedTasks.length,
					failedTasks: failedTasks.length,
					duration
				}
			});

			this.logger.info('Cluster execution complete', {
				clusterId: cluster.clusterId,
				success,
				completedTasks: completedTasks.length,
				failedTasks: failedTasks.length,
				duration
			});

			return {
				clusterId: cluster.clusterId,
				success,
				startTime,
				endTime,
				duration,
				taskResults,
				failedTasks,
				completedTasks
			};
		} catch (error) {
			const endTime = new Date();
			const duration = endTime.getTime() - startTime.getTime();

			this.logger.error('Cluster execution failed', {
				clusterId: cluster.clusterId,
				error
			});

			this.emitEvent({
				type: 'cluster:failed',
				timestamp: new Date(),
				clusterId: cluster.clusterId,
				status: 'failed',
				error: error instanceof Error ? error.message : String(error)
			});

			// Only convert expected operational errors to result objects.
			// Let unexpected errors propagate so the caller's retry logic can handle them.
			if (error instanceof TaskMasterError) {
				return {
					clusterId: cluster.clusterId,
					success: false,
					startTime,
					endTime,
					duration,
					taskResults,
					failedTasks: tasks.map((t) => String(t.id)),
					completedTasks: []
				};
			}

			throw error;
		}
	}

	/**
	 * Execute tasks using worker pool pattern
	 */
	private async executeWithWorkerPool(
		tasks: Task[],
		executor: TaskExecutor
	): Promise<TaskExecutionResult[]> {
		const results: TaskExecutionResult[] = [];
		const taskQueue = [...tasks];
		const inProgress = new Map<string, Promise<TaskExecutionResult>>();

		while (taskQueue.length > 0 || inProgress.size > 0) {
			while (
				taskQueue.length > 0 &&
				inProgress.size < this.constraints.maxConcurrentTasks
			) {
				const task = taskQueue.shift()!;
				const taskId = String(task.id);
				const execution = this.executeTask(task, executor);
				inProgress.set(taskId, execution);
			}

			if (inProgress.size > 0) {
				const entries = Array.from(inProgress.entries());
				const result = await Promise.race(
					entries.map(([id, promise]) =>
						promise.then((r) => ({ ...r, _trackingId: id }))
					)
				);

				const { _trackingId, ...taskResult } = result;
				inProgress.delete(_trackingId);
				results.push(taskResult);
			}
		}

		return results;
	}

	/**
	 * Execute a single task with isolation and error handling
	 */
	private async executeTask(
		task: Task,
		executor: TaskExecutor
	): Promise<TaskExecutionResult> {
		const taskId = String(task.id);
		const startTime = new Date();
		const abortController = new AbortController();

		this.logger.debug('Starting task execution', { taskId });

		this.emitEvent({
			type: 'task:started',
			timestamp: new Date(),
			taskId,
			status: 'in-progress'
		});

		const context: TaskExecutionContext = {
			task,
			startTime,
			promise: Promise.resolve({
				taskId,
				success: false,
				startTime,
				endTime: new Date(),
				duration: 0
			}),
			abortController
		};
		this.activeExecutions.set(taskId, context);

		try {
			const timeoutPromise = this.constraints.taskTimeoutMs
				? new Promise<TaskExecutionResult>((_, reject) => {
						setTimeout(() => {
							reject(
								new TaskMasterError(
									`Task execution timeout: ${taskId}`,
									ERROR_CODES.TIMEOUT
								)
							);
						}, this.constraints.taskTimeoutMs);
					})
				: null;

			const result = timeoutPromise
				? await Promise.race([executor(task), timeoutPromise])
				: await executor(task);

			const endTime = new Date();
			const duration = endTime.getTime() - startTime.getTime();

			const finalResult: TaskExecutionResult = {
				...result,
				taskId,
				startTime,
				endTime,
				duration
			};

			this.emitEvent({
				type: finalResult.success ? 'task:completed' : 'task:failed',
				timestamp: new Date(),
				taskId,
				status: finalResult.success ? 'done' : 'failed',
				error: finalResult.error
			});

			this.logger.debug('Task execution complete', {
				taskId,
				success: finalResult.success,
				duration
			});

			return finalResult;
		} catch (error) {
			const endTime = new Date();
			const duration = endTime.getTime() - startTime.getTime();
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			this.logger.error('Task execution failed', {
				taskId,
				error: errorMessage
			});

			this.emitEvent({
				type: 'task:failed',
				timestamp: new Date(),
				taskId,
				status: 'failed',
				error: errorMessage
			});

			return {
				taskId,
				success: false,
				startTime,
				endTime,
				duration,
				error: errorMessage
			};
		} finally {
			this.activeExecutions.delete(taskId);
		}
	}

	/**
	 * Stop a running task
	 */
	async stopTask(taskId: string): Promise<void> {
		const context = this.activeExecutions.get(taskId);
		if (context) {
			this.logger.info('Stopping task', { taskId });
			context.abortController.abort();
			this.activeExecutions.delete(taskId);
		}
	}

	/**
	 * Stop all running tasks
	 */
	async stopAll(): Promise<void> {
		this.logger.info('Stopping all tasks', {
			activeCount: this.activeExecutions.size
		});

		const taskIds = Array.from(this.activeExecutions.keys());
		await Promise.all(taskIds.map((taskId) => this.stopTask(taskId)));
	}

	/**
	 * Get active execution count
	 */
	getActiveExecutionCount(): number {
		return this.activeExecutions.size;
	}

	/**
	 * Check if task is currently executing
	 */
	isTaskExecuting(taskId: string): boolean {
		return this.activeExecutions.has(taskId);
	}

	/**
	 * Add progress event listener
	 */
	addEventListener(listener: ProgressEventListener): void {
		this.eventListeners.add(listener);
	}

	/**
	 * Remove progress event listener
	 */
	removeEventListener(listener: ProgressEventListener): void {
		this.eventListeners.delete(listener);
		this.listenerFailureCounts.delete(listener);
	}

	/**
	 * Emit progress event to all listeners
	 */
	private emitEvent(event: ProgressEventData): void {
		this.eventListeners.forEach((listener) => {
			try {
				listener(event);
				this.listenerFailureCounts.delete(listener);
			} catch (error) {
				const count =
					(this.listenerFailureCounts.get(listener) || 0) + 1;
				this.listenerFailureCounts.set(listener, count);
				if (count >= 3) {
					this.logger.error(
						'Event listener is repeatedly failing',
						{ failureCount: count, error }
					);
				} else {
					this.logger.warn('Error in event listener', { error });
				}
			}
		});
	}

	/**
	 * Update resource constraints
	 */
	updateConstraints(constraints: Partial<ResourceConstraints>): void {
		this.constraints = { ...this.constraints, ...constraints };
		this.logger.info('Resource constraints updated', this.constraints);
	}

	/**
	 * Get current resource constraints
	 */
	getConstraints(): ResourceConstraints {
		return { ...this.constraints };
	}
}
