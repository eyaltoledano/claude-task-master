/**
 * @fileoverview Task Expansion Service
 * Core service for expanding tasks into subtasks using AI
 */

import { z } from 'zod';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import { getLogger } from '../../../common/logger/factory.js';
import { AuthManager } from '../../auth/managers/auth-manager.js';
import { ApiClient } from '../../storage/utils/api-client.js';
import type { TaskRepository } from '../../tasks/repositories/task-repository.interface.js';

/**
 * Response from the expand task API endpoint (202 Accepted)
 */
interface ExpandTaskResponse {
	message: string;
	taskId: string;
	queued: boolean;
	jobId: string;
}

/**
 * Result returned to the caller with expansion details
 */
export interface ExpandTaskResult {
	/** Success message */
	message: string;
	/** Task ID (display_id like HAM-4) */
	taskId: string;
	/** Whether the job was queued successfully */
	queued: boolean;
	/** Background job ID for tracking */
	jobId: string;
	/** Direct link to view the task in the UI */
	taskLink: string;
}

/**
 * Options for task expansion
 */
export interface ExpandTaskOptions {
	/** Number of subtasks to generate */
	numSubtasks?: number;
	/** Use research model for expansion */
	useResearch?: boolean;
	/** Additional context for AI generation */
	additionalContext?: string;
	/** Force expansion even if subtasks exist */
	force?: boolean;
}

/**
 * TaskExpansionService handles AI-powered task expansion
 */
export class TaskExpansionService {
	private readonly repository: TaskRepository;
	private readonly projectId: string;
	private readonly apiClient: ApiClient;
	private readonly authManager: AuthManager;
	private readonly logger = getLogger('TaskExpansionService');

	constructor(
		repository: TaskRepository,
		projectId: string,
		apiClient: ApiClient,
		authManager: AuthManager
	) {
		this.repository = repository;
		this.projectId = projectId;
		this.apiClient = apiClient;
		this.authManager = authManager;
	}

	/**
	 * Expand task into subtasks with AI-powered generation
	 * Sends task to backend for server-side AI processing
	 * @returns Expansion result with job details and task link
	 */
	async expandTask(
		taskId: string,
		options?: ExpandTaskOptions
	): Promise<ExpandTaskResult> {
		try {
			// Get brief context from AuthManager
			const context = this.authManager.ensureBriefSelected('expandTask');

			// Get the task being expanded to extract existing subtasks
			const task = await this.repository.getTask(this.projectId, taskId);

			if (!task) {
				throw new TaskMasterError(
					`Task ${taskId} not found`,
					ERROR_CODES.TASK_NOT_FOUND,
					{
						operation: 'expandTask',
						taskId,
						userMessage: `Task ${taskId} isn't available in the current project.`
					}
				);
			}

			// Get brief information for enriched context
			const brief = await this.repository.getBrief(context.briefId);

			// Build brief context payload with brief data if available
			const briefContext = {
				title: brief?.name || context.briefName || context.briefId,
				description: brief?.description || undefined,
				status: brief?.status || 'active'
			};

			// Get all tasks for context (optional but helpful for AI)
			const allTasks = await this.repository.getTasks(this.projectId);

			// Build the payload according to ExpandTaskContextSchema
			const payload = {
				briefContext,
				allTasks,
				existingSubtasks: task.subtasks || [],
				enrichedContext: options?.additionalContext
			};

			// Build query params for options that aren't part of the context
			const queryParams = new URLSearchParams();
			if (options?.numSubtasks !== undefined) {
				queryParams.set('numSubtasks', options.numSubtasks.toString());
			}
			if (options?.useResearch !== undefined) {
				queryParams.set('useResearch', options.useResearch.toString());
			}
			if (options?.force !== undefined) {
				queryParams.set('force', options.force.toString());
			}

			// Validate that task has a database UUID (required for API calls)
			if (!task.databaseId) {
				throw new TaskMasterError(
					`Task ${taskId} is missing a database ID. Task expansion requires tasks to be synced with the remote database.`,
					ERROR_CODES.VALIDATION_ERROR,
					{
						operation: 'expandTask',
						taskId,
						userMessage:
							'This task has not been synced with the remote database. Please ensure the task is saved remotely before attempting expansion.'
					}
				);
			}

			// Validate UUID format using Zod
			const uuidSchema = z.uuid();
			const validation = uuidSchema.safeParse(task.databaseId);
			if (!validation.success) {
				throw new TaskMasterError(
					`Task ${taskId} has an invalid database ID format: ${task.databaseId}`,
					ERROR_CODES.VALIDATION_ERROR,
					{
						operation: 'expandTask',
						taskId,
						databaseId: task.databaseId,
						userMessage:
							'The task database ID is not in valid UUID format. This may indicate data corruption.'
					}
				);
			}

			// Use validated databaseId (UUID) for API calls
			const taskUuid = task.databaseId;

			const url = `/ai/api/v1/tasks/${taskUuid}/subtasks/generate${
				queryParams.toString() ? `?${queryParams.toString()}` : ''
			}`;

			const result = await this.apiClient.post<ExpandTaskResponse>(
				url,
				payload
			);

			// Get base URL for task link
			const baseUrl =
				process.env.TM_BASE_DOMAIN ||
				process.env.TM_PUBLIC_BASE_DOMAIN ||
				'http://localhost:8080';
			const taskLink = `${baseUrl}/home/hamster/briefs/${context.briefId}/task/${taskUuid}`;

			// Log success with job details and task link
			this.logger.info(`✓ Task expansion queued for ${taskId}`);
			this.logger.info(`  Job ID: ${result.jobId}`);
			this.logger.info(`  ${result.message}`);
			this.logger.info(`  View task: ${taskLink}`);

			return {
				...result,
				taskLink
			};
		} catch (error) {
			// If it's already a TaskMasterError, just add context and re-throw
			if (error instanceof TaskMasterError) {
				throw error.withContext({
					operation: 'expandTask',
					taskId,
					numSubtasks: options?.numSubtasks,
					useResearch: options?.useResearch
				});
			}

			// For other errors, wrap them
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new TaskMasterError(
				errorMessage,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'expandTask',
					taskId,
					numSubtasks: options?.numSubtasks,
					useResearch: options?.useResearch
				},
				error as Error
			);
		}
	}
}
