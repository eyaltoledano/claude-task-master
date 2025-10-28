/**
 * @fileoverview Export Service
 * Core service for exporting tasks to external systems (e.g., Hamster briefs)
 */

import type { Task, TaskStatus } from '../../../common/types/index.js';
import type { UserContext } from '../../auth/types.js';
import { ConfigManager } from '../../config/managers/config-manager.js';
import { AuthManager } from '../../auth/managers/auth-manager.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import { FileStorage } from '../../storage/adapters/file-storage/index.js';

// Type definitions for the bulk API response
interface TaskImportResult {
	externalId?: string;
	index: number;
	success: boolean;
	taskId?: string;
	error?: string;
	validationErrors?: string[];
}

interface BulkTasksResponse {
	dryRun: boolean;
	totalTasks: number;
	successCount: number;
	failedCount: number;
	skippedCount: number;
	results: TaskImportResult[];
	summary: {
		message: string;
		duration: number;
	};
}

/**
 * Options for exporting tasks
 */
export interface ExportTasksOptions {
	/** Optional tag to export tasks from (uses active tag if not provided) */
	tag?: string;
	/** Brief ID to export to */
	briefId?: string;
	/** Organization ID (required if briefId is provided) */
	orgId?: string;
	/** Filter by task status */
	status?: TaskStatus;
	/** Exclude subtasks from export (default: false, subtasks included by default) */
	excludeSubtasks?: boolean;
}

/**
 * Result of the export operation
 */
export interface ExportResult {
	/** Whether the export was successful */
	success: boolean;
	/** Number of tasks exported */
	taskCount: number;
	/** The brief ID tasks were exported to */
	briefId: string;
	/** The organization ID */
	orgId: string;
	/** Optional message */
	message?: string;
	/** Error details if export failed */
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
 * ExportService handles task export to external systems
 */
export class ExportService {
	private configManager: ConfigManager;
	private authManager: AuthManager;

	constructor(configManager: ConfigManager, authManager: AuthManager) {
		this.configManager = configManager;
		this.authManager = authManager;
	}

	/**
	 * Export tasks to a brief
	 */
	async exportTasks(options: ExportTasksOptions): Promise<ExportResult> {
		const isAuthenticated = await this.authManager.hasValidSession();
		// Validate authentication
		if (!isAuthenticated) {
			throw new TaskMasterError(
				'Authentication required for export',
				ERROR_CODES.AUTHENTICATION_ERROR
			);
		}

		// Get current context
		const context = await this.authManager.getContext();

		// Determine org and brief IDs
		let orgId = options.orgId || context?.orgId;
		let briefId = options.briefId || context?.briefId;

		// Validate we have necessary IDs
		if (!orgId) {
			throw new TaskMasterError(
				'Organization ID is required for export. Use "tm context org" to select one.',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}

		if (!briefId) {
			throw new TaskMasterError(
				'Brief ID is required for export. Use "tm context brief" or provide --brief flag.',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}

		// Get tasks from the specified or active tag
		const activeTag = this.configManager.getActiveTag();
		const tag = options.tag || activeTag;

		// Always read tasks from local file storage for export
		// (we're exporting local tasks to a remote brief)
		const fileStorage = new FileStorage(this.configManager.getProjectRoot());
		await fileStorage.initialize();

		// Load tasks with filters applied at storage layer
		const filteredTasks = await fileStorage.loadTasks(tag, {
			status: options.status,
			excludeSubtasks: options.excludeSubtasks
		});

		// Get total count (without filters) for comparison
		const allTasks = await fileStorage.loadTasks(tag);

		const taskListResult = {
			tasks: filteredTasks,
			total: allTasks.length,
			filtered: filteredTasks.length,
			tag,
			storageType: 'file' as const
		};

		if (taskListResult.tasks.length === 0) {
			return {
				success: false,
				taskCount: 0,
				briefId,
				orgId,
				message: 'No tasks found to export',
				error: {
					code: 'NO_TASKS',
					message: 'No tasks match the specified criteria'
				}
			};
		}

		try {
			// Call the export API with the original tasks
			// performExport will handle the transformation based on the method used
			await this.performExport(orgId, briefId, taskListResult.tasks);

			return {
				success: true,
				taskCount: taskListResult.tasks.length,
				briefId,
				orgId,
				message: `Successfully exported ${taskListResult.tasks.length} task(s) to brief`
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
					code: 'EXPORT_FAILED',
					message: errorMessage
				}
			};
		}
	}

	/**
	 * Export tasks from a brief ID or URL
	 */
	async exportFromBriefInput(briefInput: string): Promise<ExportResult> {
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

		// Export with the resolved org and brief
		return this.exportTasks({
			orgId: brief.accountId,
			briefId: brief.id
		});
	}

	/**
	 * Validate export context before prompting
	 */
	async validateContext(): Promise<{
		hasOrg: boolean;
		hasBrief: boolean;
		context: UserContext | null;
	}> {
		const context = await this.authManager.getContext();

		return {
			hasOrg: !!context?.orgId,
			hasBrief: !!context?.briefId,
			context
		};
	}

	/**
	 * Transform tasks for API bulk import format (flat structure)
	 */
	private transformTasksForBulkImport(tasks: Task[]): any[] {
		const flatTasks: any[] = [];

		// Process each task and its subtasks
		tasks.forEach((task) => {
			// Add parent task
			flatTasks.push({
				externalId: String(task.id),
				title: task.title,
				description: this.enrichDescription(task),
				status: this.mapStatusForAPI(task.status),
				priority: task.priority || 'medium',
				dependencies: task.dependencies?.map(String) || [],
				details: task.details,
				testStrategy: task.testStrategy,
				complexity: task.complexity,
				metadata: {
					complexity: task.complexity,
					originalId: task.id,
					originalDescription: task.description,
					originalDetails: task.details,
					originalTestStrategy: task.testStrategy
				}
			});

			// Add subtasks if they exist
			if (task.subtasks && task.subtasks.length > 0) {
				task.subtasks.forEach((subtask) => {
					flatTasks.push({
						externalId: `${task.id}.${subtask.id}`,
						parentExternalId: String(task.id),
						title: subtask.title,
						description: this.enrichDescription(subtask),
						status: this.mapStatusForAPI(subtask.status),
						priority: subtask.priority || 'medium',
						dependencies:
							subtask.dependencies?.map((dep) => {
								// Convert subtask dependencies to full ID format
								if (String(dep).includes('.')) {
									return String(dep);
								}
								return `${task.id}.${dep}`;
							}) || [],
						details: subtask.details,
						testStrategy: subtask.testStrategy,
						complexity: subtask.complexity,
						metadata: {
							complexity: subtask.complexity,
							originalId: subtask.id,
							originalDescription: subtask.description,
							originalDetails: subtask.details,
							originalTestStrategy: subtask.testStrategy
						}
					});
				});
			}
		});

		return flatTasks;
	}

	/**
	 * Enrich task/subtask description with implementation details and test strategy
	 * Creates a comprehensive markdown-formatted description
	 */
	private enrichDescription(taskOrSubtask: Task | any): string {
		const sections: string[] = [];

		// Start with original description if it exists
		if (taskOrSubtask.description) {
			sections.push(taskOrSubtask.description);
		}

		// Add implementation details section
		if (taskOrSubtask.details) {
			sections.push('## Implementation Details\n');
			sections.push(taskOrSubtask.details);
		}

		// Add test strategy section
		if (taskOrSubtask.testStrategy) {
			sections.push('## Test Strategy\n');
			sections.push(taskOrSubtask.testStrategy);
		}

		// Join sections with double newlines for better markdown formatting
		return sections.join('\n\n').trim() || 'No description provided';
	}

	/**
	 * Map internal status to API status format
	 */
	private mapStatusForAPI(status?: string): string {
		switch (status) {
			case 'pending':
				return 'todo';
			case 'in-progress':
				return 'in_progress';
			case 'done':
				return 'done';
			default:
				return 'todo';
		}
	}

	/**
	 * Perform the actual export API call
	 */
	private async performExport(
		orgId: string,
		briefId: string,
		tasks: any[]
	): Promise<void> {
		// Check if we should use the API endpoint or direct Supabase
		const apiEndpoint =
			process.env.TM_BASE_DOMAIN || process.env.TM_PUBLIC_BASE_DOMAIN;

		if (apiEndpoint) {
			// Use the new bulk import API endpoint
			const apiUrl = `${apiEndpoint}/ai/api/v1/briefs/${briefId}/tasks`;

			// Transform tasks to flat structure for API
			const flatTasks = this.transformTasksForBulkImport(tasks);

			// Prepare request body
			const requestBody = {
				source: 'task-master-cli',
				options: {
					dryRun: false,
					stopOnError: false
				},
				accountId: orgId,
				tasks: flatTasks
			};

			// Get auth token
			const accessToken = await this.authManager.getAccessToken();
			if (!accessToken) {
				throw new Error('Not authenticated');
			}

			// Make API request
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`API request failed: ${response.status} - ${errorText}`
				);
			}

			const result = (await response.json()) as BulkTasksResponse;

			if (result.failedCount > 0) {
				const failedTasks = result.results
					.filter((r) => !r.success)
					.map((r) => `${r.externalId}: ${r.error}`)
					.join(', ');
				console.warn(
					`Warning: ${result.failedCount} tasks failed to import: ${failedTasks}`
				);
			}

			console.log(
				`Successfully exported ${result.successCount} of ${result.totalTasks} tasks to brief ${briefId}`
			);
		} else {
			// Direct Supabase approach is no longer supported
			// The extractTasks method has been removed from SupabaseTaskRepository
			// as we now exclusively use the API endpoint for exports
			throw new Error(
				'Export API endpoint not configured. Please set TM_PUBLIC_BASE_DOMAIN environment variable to enable task export.'
			);
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
