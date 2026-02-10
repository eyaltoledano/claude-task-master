/**
 * @fileoverview Project Orchestrator Service
 * Coordinates sequential execution of dependency-ordered tags within a project,
 * delegating per-tag cluster execution to TagOrchestratorService.
 */

import type { Task } from '../../../common/types/index.js';
import type {
	ProjectExecutionContext,
	ProgressEventListener,
	ProgressEventData
} from '../types.js';
import {
	TagOrchestratorService,
	type TagExecutionOptions,
	type TagExecutionResult
} from './tag-orchestrator.service.js';
import type { TaskExecutor } from './parallel-executor.service.js';
import { getLogger } from '../../../common/logger/factory.js';
import { ERROR_CODES, TaskMasterError } from '../../../common/errors/task-master-error.js';

/**
 * Tag with dependencies
 */
export interface TagWithDependencies {
	tag: string;
	tasks: Task[];
	dependencies: string[];
}

/**
 * Project execution options
 */
export interface ProjectExecutionOptions extends TagExecutionOptions {
	/** Stop on first tag failure */
	stopOnFailure?: boolean;
}

/**
 * Project execution result
 */
export interface ProjectExecutionResult {
	projectId: string;
	success: boolean;
	totalTags: number;
	completedTags: number;
	failedTags: number;
	blockedTags: number;
	totalClusters: number;
	completedClusters: number;
	totalTasks: number;
	completedTasks: number;
	startTime: Date;
	endTime: Date;
	duration: number;
	tagResults: TagExecutionResult[];
}

/**
 * ProjectOrchestratorService manages project-level execution
 */
export class ProjectOrchestratorService {
	private logger = getLogger('ProjectOrchestratorService');
	private tagOrchestrator: TagOrchestratorService;
	private eventListeners: Set<ProgressEventListener> = new Set();
	private listenerFailureCounts: Map<ProgressEventListener, number> =
		new Map();
	private currentContext?: ProjectExecutionContext;

	constructor(tagOrchestrator?: TagOrchestratorService) {
		this.tagOrchestrator = tagOrchestrator || new TagOrchestratorService();

		this.tagOrchestrator.addEventListener((event) => {
			this.emitEvent(event);
		});
	}

	/**
	 * Execute all tags in a project
	 */
	async executeProject(
		projectId: string,
		tagData: TagWithDependencies[],
		executor: TaskExecutor,
		options: ProjectExecutionOptions = {}
	): Promise<ProjectExecutionResult> {
		this.logger.info('Starting project execution', {
			projectId,
			tagCount: tagData.length
		});

		const startTime = new Date();
		const tagResults: TagExecutionResult[] = [];
		const completedTags = new Set<string>();
		const failedTags = new Set<string>();
		const blockedTags = new Set<string>();

		const sortedTags = this.topologicalSortTags(tagData);

		if (sortedTags === null) {
			throw new TaskMasterError(
				'Circular dependency detected in project tag dependencies',
				ERROR_CODES.VALIDATION_ERROR,
				{
					operation: 'executeProject',
					projectId
				}
			);
		}

		this.currentContext = {
			projectId,
			tags: sortedTags.map((t) => t.tag),
			currentTagIndex: 0,
			tagContexts: new Map(),
			startTime,
			status: 'in-progress'
		};

		for (let i = 0; i < sortedTags.length; i++) {
			const { tag, tasks, dependencies } = sortedTags[i];
			this.currentContext = { ...this.currentContext, currentTagIndex: i };

			this.logger.info('Checking tag readiness', {
				tag,
				dependencies,
				completedTags: Array.from(completedTags)
			});

			const isReady = this.tagOrchestrator.isTagReady(
				tag,
				dependencies,
				completedTags
			);

			if (!isReady) {
				this.logger.warn('Tag not ready, marking as blocked', {
					tag,
					dependencies,
					completedTags: Array.from(completedTags)
				});

				blockedTags.add(tag);

				this.emitEvent({
					type: 'cluster:blocked',
					timestamp: new Date(),
					metadata: {
						tag,
						reason: 'Upstream tag dependencies not satisfied',
						dependencies
					}
				});

				if (options.stopOnFailure) {
					break;
				}
				continue;
			}

			this.logger.info('Executing tag', {
				tag,
				taskCount: tasks.length,
				index: i + 1,
				total: sortedTags.length
			});

			try {
				const result = await this.tagOrchestrator.executeTag(
					tag,
					tasks,
					executor,
					options
				);

				tagResults.push(result);

				if (result.success) {
					completedTags.add(tag);
					this.logger.info('Tag completed successfully', {
						tag,
						duration: result.duration
					});
				} else {
					failedTags.add(tag);
					this.logger.error('Tag failed', {
						tag,
						failedClusters: result.failedClusters,
						blockedClusters: result.blockedClusters
					});

					this.blockDownstreamTags(
						tag,
						sortedTags,
						completedTags,
						blockedTags
					);

					if (options.stopOnFailure) {
						this.logger.info('Stopping project execution due to tag failure');
						break;
					}
				}
			} catch (error) {
				this.logger.error('Tag execution error', {
					tag,
					error
				});

				failedTags.add(tag);

				this.blockDownstreamTags(
					tag,
					sortedTags,
					completedTags,
					blockedTags
				);

				if (options.stopOnFailure) {
					throw error;
				}
			}

			this.emitEvent({
				type: 'progress:updated',
				timestamp: new Date(),
				progress: {
					completedTasks: tagResults.reduce(
						(sum, r) => sum + r.completedTasks,
						0
					),
					totalTasks: tagData.reduce(
						(sum, t) => sum + t.tasks.length,
						0
					),
					completedClusters: tagResults.reduce(
						(sum, r) => sum + r.completedClusters,
						0
					),
					totalClusters: tagResults.reduce(
						(sum, r) => sum + r.totalClusters,
						0
					),
					percentage: sortedTags.length > 0 ? ((i + 1) / sortedTags.length) * 100 : 0
				}
			});
		}

		const endTime = new Date();
		const duration = endTime.getTime() - startTime.getTime();

		this.currentContext = {
			...this.currentContext,
			status:
				failedTags.size === 0 && completedTags.size === sortedTags.length
					? 'done'
					: 'failed',
			endTime
		};

		const result: ProjectExecutionResult = {
			projectId,
			success:
				failedTags.size === 0 && completedTags.size === sortedTags.length,
			totalTags: sortedTags.length,
			completedTags: completedTags.size,
			failedTags: failedTags.size,
			blockedTags: blockedTags.size,
			totalClusters: tagResults.reduce(
				(sum, r) => sum + r.totalClusters,
				0
			),
			completedClusters: tagResults.reduce(
				(sum, r) => sum + r.completedClusters,
				0
			),
			totalTasks: tagData.reduce((sum, t) => sum + t.tasks.length, 0),
			completedTasks: tagResults.reduce(
				(sum, r) => sum + r.completedTasks,
				0
			),
			startTime,
			endTime,
			duration,
			tagResults
		};

		this.logger.info('Project execution complete', {
			projectId,
			success: result.success,
			completedTags: result.completedTags,
			totalTags: result.totalTags,
			duration
		});

		return result;
	}

	/**
	 * Topological sort of tags based on dependencies
	 * @returns Sorted tags or null if circular dependency detected
	 */
	private topologicalSortTags(
		tagData: TagWithDependencies[]
	): TagWithDependencies[] | null {
		const tagMap = new Map(tagData.map((t) => [t.tag, t]));
		const inDegree = new Map<string, number>();
		const result: TagWithDependencies[] = [];

		tagData.forEach((t) => {
			inDegree.set(t.tag, 0);
		});

		tagData.forEach((t) => {
			t.dependencies.forEach((dep) => {
				if (tagMap.has(dep)) {
					inDegree.set(t.tag, (inDegree.get(t.tag) || 0) + 1);
				}
			});
		});

		const queue: TagWithDependencies[] = [];
		inDegree.forEach((degree, tag) => {
			if (degree === 0) {
				const tagData = tagMap.get(tag);
				if (tagData) {
					queue.push(tagData);
				}
			}
		});

		while (queue.length > 0) {
			const current = queue.shift()!;
			result.push(current);

			tagData.forEach((t) => {
				if (t.dependencies.includes(current.tag)) {
					const newInDegree = (inDegree.get(t.tag) || 0) - 1;
					inDegree.set(t.tag, newInDegree);

					if (newInDegree === 0) {
						queue.push(t);
					}
				}
			});
		}

		if (result.length !== tagData.length) {
			return null;
		}

		return result;
	}

	/**
	 * Block all downstream tags when a tag fails
	 */
	private blockDownstreamTags(
		failedTag: string,
		allTags: TagWithDependencies[],
		completedTags: Set<string>,
		blockedTags: Set<string>
	): void {
		allTags.forEach((t) => {
			if (
				t.dependencies.includes(failedTag) &&
				!completedTags.has(t.tag) &&
				!blockedTags.has(t.tag)
			) {
				blockedTags.add(t.tag);
				this.logger.info('Blocking downstream tag', {
					tag: t.tag,
					blockedBy: failedTag
				});

				this.blockDownstreamTags(t.tag, allTags, completedTags, blockedTags);
			}
		});
	}

	/**
	 * Get current execution context
	 */
	getCurrentContext(): ProjectExecutionContext | undefined {
		return this.currentContext;
	}

	/**
	 * Get current tag orchestrator
	 */
	getTagOrchestrator(): TagOrchestratorService {
		return this.tagOrchestrator;
	}

	/**
	 * Stop project execution
	 */
	async stopExecution(): Promise<void> {
		this.logger.info('Stopping project execution');

		if (this.currentContext) {
			this.currentContext = {
				...this.currentContext,
				status: 'failed',
				endTime: new Date()
			};
		}

		await this.tagOrchestrator.stopExecution();
	}

	addEventListener(listener: ProgressEventListener): void {
		this.eventListeners.add(listener);
	}

	removeEventListener(listener: ProgressEventListener): void {
		this.eventListeners.delete(listener);
		this.listenerFailureCounts.delete(listener);
	}

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
}
