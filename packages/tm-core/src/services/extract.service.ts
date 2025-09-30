/**
 * @fileoverview Extract Service
 * Core service for extracting tasks to external systems (e.g., Hamster briefs)
 */

import type { Task, TaskStatus, Subtask } from '../types/index.js';
import type { UserContext } from '../auth/types.js';
import { ConfigManager } from '../config/config-manager.js';
import { TaskService } from './task-service.js';
import { AuthManager } from '../auth/auth-manager.js';
import { ERROR_CODES, TaskMasterError } from '../errors/task-master-error.js';
import { SupabaseTaskRepository } from '../repositories/supabase-task-repository.js';
import { SupabaseAuthClient } from '../clients/supabase-client.js';

/**
 * Options for extracting tasks
 */
export interface ExtractTasksOptions {
	/** Optional tag to extract tasks from (uses active tag if not provided) */
	tag?: string;
	/** Brief ID to extract to */
	briefId?: string;
	/** Organization ID (required if briefId is provided) */
	orgId?: string;
	/** Filter by task status */
	status?: TaskStatus;
	/** Include subtasks in extraction */
	includeSubtasks?: boolean;
}

/**
 * Result of the extraction operation
 */
export interface ExtractResult {
	/** Whether the extraction was successful */
	success: boolean;
	/** Number of tasks extracted */
	taskCount: number;
	/** The brief ID tasks were extracted to */
	briefId: string;
	/** The organization ID */
	orgId: string;
	/** Optional message */
	message?: string;
	/** Error details if extraction failed */
	error?: {
		code: string;
		message: string;
	};
}

/**
 * Brief information from API
 */
export interface Brief {
	id: string;
	accountId: string;
	createdAt: string;
	name?: string;
}

/**
 * ExtractService handles task extraction to external systems
 */
export class ExtractService {
	private configManager: ConfigManager;
	private taskService: TaskService;
	private authManager: AuthManager;

	constructor(
		configManager: ConfigManager,
		taskService: TaskService,
		authManager: AuthManager
	) {
		this.configManager = configManager;
		this.taskService = taskService;
		this.authManager = authManager;
	}

	/**
	 * Extract tasks to a brief
	 */
	async extractTasks(options: ExtractTasksOptions): Promise<ExtractResult> {
		// Validate authentication
		if (!this.authManager.isAuthenticated()) {
			throw new TaskMasterError(
				'Authentication required for extraction',
				ERROR_CODES.AUTHENTICATION_ERROR
			);
		}

		// Get current context
		const context = this.authManager.getContext();

		// Determine org and brief IDs
		let orgId = options.orgId || context?.orgId;
		let briefId = options.briefId || context?.briefId;

		// Validate we have necessary IDs
		if (!orgId) {
			throw new TaskMasterError(
				'Organization ID is required for extraction. Use "tm context org" to select one.',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}

		if (!briefId) {
			throw new TaskMasterError(
				'Brief ID is required for extraction. Use "tm context brief" or provide --brief flag.',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}

		// Get tasks from the specified or active tag
		const activeTag = this.configManager.getActiveTag();
		const tag = options.tag || activeTag;

		const taskListResult = await this.taskService.getTaskList({
			tag,
			filter: options.status ? { status: options.status } : undefined,
			includeSubtasks: options.includeSubtasks
		});

		if (taskListResult.tasks.length === 0) {
			return {
				success: false,
				taskCount: 0,
				briefId,
				orgId,
				message: 'No tasks found to extract',
				error: {
					code: 'NO_TASKS',
					message: 'No tasks match the specified criteria'
				}
			};
		}

		// Transform tasks for extraction
		const extractedTasks = this.transformTasksForExtraction(
			taskListResult.tasks
		);

		try {
			// Call the extraction API
			await this.performExtraction(orgId, briefId, extractedTasks);

			return {
				success: true,
				taskCount: extractedTasks.length,
				briefId,
				orgId,
				message: `Successfully extracted ${extractedTasks.length} task(s) to brief`
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			return {
				success: false,
				taskCount: 0,
				briefId,
				orgId,
				error: {
					code: 'EXTRACTION_FAILED',
					message: errorMessage
				}
			};
		}
	}

	/**
	 * Extract tasks from a brief ID or URL
	 */
	async extractFromBriefInput(briefInput: string): Promise<ExtractResult> {
		// Extract brief ID from input
		const briefId = this.extractBriefId(briefInput);
		if (!briefId) {
			throw new TaskMasterError(
				'Invalid brief ID or URL provided',
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		// Fetch brief to get organization
		const brief = await this.authManager.getBrief(briefId);
		if (!brief) {
			throw new TaskMasterError(
				'Brief not found or you do not have access',
				ERROR_CODES.NOT_FOUND
			);
		}

		// Extract with the resolved org and brief
		return this.extractTasks({
			orgId: brief.accountId,
			briefId: brief.id
		});
	}

	/**
	 * Validate extraction context before prompting
	 */
	async validateContext(): Promise<{
		hasOrg: boolean;
		hasBrief: boolean;
		context: UserContext | null;
	}> {
		const context = this.authManager.getContext();

		return {
			hasOrg: !!context?.orgId,
			hasBrief: !!context?.briefId,
			context
		};
	}

	/**
	 * Transform tasks for extraction format
	 */
	private transformTasksForExtraction(tasks: Task[]): any[] {
		return tasks.map((task) => ({
			id: task.id,
			title: task.title,
			description: task.description,
			status: task.status,
			priority: task.priority || 'medium',
			dependencies: task.dependencies || [],
			details: task.details,
			testStrategy: task.testStrategy,
			complexity: task.complexity,
			subtasks: task.subtasks
				? this.transformSubtasksForExtraction(task.subtasks)
				: []
		}));
	}

	/**
	 * Transform subtasks for extraction format
	 */
	private transformSubtasksForExtraction(subtasks: Subtask[]): any[] {
		return subtasks.map((subtask) => ({
			id: subtask.id,
			title: subtask.title,
			description: subtask.description,
			status: subtask.status,
			priority: subtask.priority || 'medium',
			dependencies: subtask.dependencies || [],
			details: subtask.details,
			testStrategy: subtask.testStrategy,
			complexity: subtask.complexity,
			subtasks: []
		}));
	}

	/**
	 * Perform the actual extraction API call
	 */
	private async performExtraction(
		orgId: string,
		briefId: string,
		tasks: any[]
	): Promise<void> {
		// Create Supabase client using SupabaseAuthClient
		const supabaseAuthClient = new SupabaseAuthClient();
		const supabaseClient = supabaseAuthClient.getClient();

		if (supabaseClient) {
			// Use SupabaseTaskRepository for extraction
			const repository = new SupabaseTaskRepository(supabaseClient);
			const result = await repository.extractTasks(briefId, tasks);

			if (!result.success) {
				throw new Error(result.error || 'Failed to extract tasks');
			}

			console.log(
				`Successfully extracted ${result.count} tasks to brief ${briefId}`
			);
		} else {
			// Fallback to API call if no Supabase client
			// This would use the standard REST API
			const apiUrl = `/api/v1/orgs/${orgId}/briefs/${briefId}/tasks`;

			// TODO: Implement REST API fallback
			console.log(
				`Would extract ${tasks.length} tasks to ${apiUrl} via REST API`
			);

			// In the actual implementation:
			// await this.authManager.apiRequest('POST', apiUrl, { tasks });
		}
	}

	/**
	 * Extract a brief ID from raw input (ID or URL)
	 */
	private extractBriefId(input: string): string | null {
		const raw = input?.trim() ?? '';
		if (!raw) return null;

		const parseUrl = (s: string): URL | null => {
			try {
				return new URL(s);
			} catch {}
			try {
				return new URL(`https://${s}`);
			} catch {}
			return null;
		};

		const fromParts = (path: string): string | null => {
			const parts = path.split('/').filter(Boolean);
			const briefsIdx = parts.lastIndexOf('briefs');
			const candidate =
				briefsIdx >= 0 && parts.length > briefsIdx + 1
					? parts[briefsIdx + 1]
					: parts[parts.length - 1];
			return candidate?.trim() || null;
		};

		// Try to parse as URL
		const url = parseUrl(raw);
		if (url) {
			const qId = url.searchParams.get('id') || url.searchParams.get('briefId');
			const candidate = (qId || fromParts(url.pathname)) ?? null;
			if (candidate) {
				if (this.isLikelyId(candidate) || candidate.length >= 8) {
					return candidate;
				}
			}
		}

		// Check if it looks like a path without scheme
		if (raw.includes('/')) {
			const candidate = fromParts(raw);
			if (candidate && (this.isLikelyId(candidate) || candidate.length >= 8)) {
				return candidate;
			}
		}

		// Return as-is if it looks like an ID
		if (this.isLikelyId(raw) || raw.length >= 8) {
			return raw;
		}

		return null;
	}

	/**
	 * Check if a string looks like a brief ID (UUID-like)
	 */
	private isLikelyId(value: string): boolean {
		const uuidRegex =
			/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
		const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
		const slugRegex = /^[A-Za-z0-9_-]{16,}$/;
		return (
			uuidRegex.test(value) || ulidRegex.test(value) || slugRegex.test(value)
		);
	}
}
