/**
 * @fileoverview Project Orchestrator Service
 * Manages execution of all tags within a project sequentially
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
	private currentContext?: ProjectExecutionContext;

	constructor(tagOrchestrator?: TagOrchestratorService) {
		this.tagOrchestrator = tagOrchestrator || new TagOrchestratorService();

		// Forward events from tag orchestrator
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

		// Sort tags in topological order based on dependencies
		const sortedTags = this.topologicalSortTags(tagData);

		// Check for circular dependencies
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

		// Create execution context
		this.currentContext = {
			projectId,
			tags: sortedTags.map((t) => t.tag),
			currentTagIndex: 0,
			tagContexts: new Map(),
			startTime,
			status: 'in-progress'
		};

		// Execute tags in order
		for (let i = 0; i < sortedTags.length; i++) {
			const { tag, tasks, dependencies } = sortedTags[i];
			this.currentContext.currentTagIndex = i;

			this.logger.info('Checking tag readiness', {
				tag,
				dependencies,
				completedTags: Array.from(completedTags)
			});

			// Check if tag is ready (all dependencies satisfied)
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

				// Emit blocked event
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
				// Execute tag
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

					// Block downstream tags
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

				// Block downstream tags
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

			// Emit progress update
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
					percentage: ((i + 1) / sortedTags.length) * 100
				}
			});
		}

		const endTime = new Date();
		const duration = endTime.getTime() - startTime.getTime();

		// Update context
		this.currentContext.status =
			failedTags.size === 0 && completedTags.size === sortedTags.length
				? 'completed'
				: 'failed';
		this.currentContext.endTime = endTime;

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

		// Calculate in-degree for each tag
		tagData.forEach((t) => {
			inDegree.set(t.tag, 0);
		});

		tagData.forEach((t) => {
			t.dependencies.forEach((dep) => {
				if (tagMap.has(dep)) {
					inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
				}
			});
		});

		// Find all tags with in-degree 0
		const queue: TagWithDependencies[] = [];
		inDegree.forEach((degree, tag) => {
			if (degree === 0) {
				const tagData = tagMap.get(tag);
				if (tagData) {
					queue.push(tagData);
				}
			}
		});

		// Process queue
		while (queue.length > 0) {
			const current = queue.shift()!;
			result.push(current);

			// Process dependents (tags that depend on current)
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

		// Check if all tags were processed (no circular dependency)
		if (result.length !== tagData.length) {
			return null; // Circular dependency detected
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

				// Recursively block downstream
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
			this.currentContext.status = 'failed';
			this.currentContext.endTime = new Date();
		}

		await this.tagOrchestrator.stopExecution();
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
	}

	/**
	 * Emit progress event to all listeners
	 */
	private emitEvent(event: ProgressEventData): void {
		this.eventListeners.forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				this.logger.error('Error in event listener', { error });
			}
		});
	}
}
