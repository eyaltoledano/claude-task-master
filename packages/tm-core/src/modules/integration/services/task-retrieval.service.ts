/**
 * @fileoverview Task Retrieval Service
 * Core service for retrieving tasks with enriched document content
 * Uses repository for task structure and API for document content
 */

import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import { getLogger } from '../../../common/logger/factory.js';
import type { Task } from '../../../common/types/index.js';
import { AuthManager } from '../../auth/managers/auth-manager.js';
import { ApiClient } from '../../storage/utils/api-client.js';
import type { TaskRepository } from '../../tasks/repositories/task-repository.interface.js';

/**
 * Response from the get task API endpoint
 */
interface GetTaskResponse {
	task: Task;
	document?: {
		id: string;
		title: string;
		content: string;
		createdAt: string;
		updatedAt: string;
	};
}

/**
 * TaskRetrievalService handles fetching tasks with enriched document content
 * Uses repository for task structure and API endpoint for document content
 */
export class TaskRetrievalService {
	private readonly repository: TaskRepository;
	private readonly projectId: string;
	private readonly apiClient: ApiClient;
	private readonly authManager: AuthManager;
	private readonly logger = getLogger('TaskRetrievalService');

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
	 * Get task by ID (UUID or display ID like HAM-123)
	 * Uses repository for task structure and API for enriched document content
	 * @returns Task with subtasks, dependencies, and document content in details field
	 */
	async getTask(taskId: string): Promise<Task | null> {
		try {
			this.authManager.ensureBriefSelected('getTask');

			const task = await this.repository.getTask(this.projectId, taskId);

			if (!task) {
				throw new TaskMasterError(
					`Task ${taskId} not found`,
					ERROR_CODES.TASK_NOT_FOUND,
					{
						operation: 'getTask',
						taskId,
						userMessage: `Task ${taskId} isn't available in the current project.`
					}
				);
			}

			// Fetch document content from API and merge into task.details
			try {
				const url = `/ai/api/v1/tasks/${task.id}`;
				const apiResult = await this.apiClient.get<GetTaskResponse>(url);

				if (apiResult.document?.content) {
					task.details = apiResult.document.content;
				}
			} catch (error) {
				// Document fetch failed - log but don't fail the whole operation
				this.logger.debug(
					`Could not fetch document content for task ${taskId}: ${error}`
				);
			}

			this.logger.info(`✓ Retrieved task ${taskId}`);
			if (task.details) {
				this.logger.debug(
					`  Document content available (${task.details.length} chars)`
				);
			}

			return task;
		} catch (error) {
			// If it's already a TaskMasterError, just add context and re-throw
			if (error instanceof TaskMasterError) {
				throw error.withContext({
					operation: 'getTask',
					taskId
				});
			}

			// For other errors, wrap them
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new TaskMasterError(
				errorMessage,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'getTask',
					taskId
				},
				error as Error
			);
		}
	}
}
