/**
 * @fileoverview Export Service
 * Core service for exporting tasks to external systems (e.g., Hamster briefs)
 */

import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import type { Task, TaskStatus } from '../../../common/types/index.js';
import { AuthDomain } from '../../auth/auth-domain.js';
import type { AuthManager } from '../../auth/managers/auth-manager.js';
import type { UserContext } from '../../auth/types.js';
import type { ConfigManager } from '../../config/managers/config-manager.js';
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

// ========== Generate Brief From Tasks Types ==========

/**
 * Task format for generating a brief
 */
export interface ImportTask {
	/** External ID from source system (for sync/mapping) */
	externalId: string;
	/** Task content */
	title: string;
	description?: string;
	details?: string;
	/** Status */
	status: 'todo' | 'in_progress' | 'done' | 'blocked';
	/** Priority - Note: Hamster uses 'urgent' not 'critical' */
	priority: 'low' | 'medium' | 'high' | 'urgent';
	/** Relationships (using externalIds) */
	dependencies?: string[];
	parentId?: string;
	/** Optional metadata */
	metadata?: {
		originalStatus?: string;
		originalPriority?: string;
		createdAt?: string;
		updatedAt?: string;
		testStrategy?: string;
		[key: string]: unknown;
	};
}

/**
 * Options for generating a brief from tasks
 */
export interface GenerateBriefOptions {
	/** Optional tag to export tasks from (uses active tag if not provided) */
	tag?: string;
	/** Filter by task status */
	status?: TaskStatus;
	/** Exclude subtasks from export */
	excludeSubtasks?: boolean;
	/** Optional organization ID (uses default if not provided) */
	orgId?: string;
	/** Email addresses to invite to the brief (max 10) */
	inviteEmails?: string[];
	/** Generation options */
	options?: {
		/** Use AI to generate a brief title from task content */
		generateTitle?: boolean;
		/** Use AI to generate a brief description */
		generateDescription?: boolean;
		/** Preserve task hierarchy */
		preserveHierarchy?: boolean;
		/** Preserve dependency relationships */
		preserveDependencies?: boolean;
		/** Optional explicit title (overrides generation) */
		title?: string;
		/** Optional explicit description (overrides generation) */
		description?: string;
	};
}

/**
 * Result of an invitation attempt
 */
export interface InvitationResult {
	email: string;
	status: 'sent' | 'already_member' | 'error';
	error?: string;
}

/**
 * Response from generate brief from tasks endpoint
 */
export interface GenerateBriefResponse {
	success: boolean;
	brief: {
		id: string;
		url: string;
		title: string;
		description: string;
		taskCount: number;
		createdAt: string;
	};
	taskMapping: Array<{
		externalId: string;
		hamsterId: string;
		parentHamsterId?: string;
	}>;
	/** Invitation results (only present if inviteEmails was provided) */
	invitations?: InvitationResult[];
	warnings?: string[];
	error?: {
		code: string;
		message: string;
		details?: unknown;
	};
}

/**
 * Result of the generate brief operation
 */
export interface GenerateBriefResult {
	/** Whether the operation was successful */
	success: boolean;
	/** Created brief details */
	brief?: {
		id: string;
		url: string;
		title: string;
		description: string;
		taskCount: number;
	};
	/** Task mapping for future sync */
	taskMapping?: Array<{
		externalId: string;
		hamsterId: string;
		parentHamsterId?: string;
	}>;
	/** Invitation results (only present if inviteEmails was provided) */
	invitations?: InvitationResult[];
	/** Any warnings during import */
	warnings?: string[];
	/** Error details if failed */
	error?: {
		code: string;
		message: string;
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
		const orgId = options.orgId || context?.orgId;
		const briefId = options.briefId || context?.briefId;

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
		// Use AuthDomain to get the properly formatted API base URL
		const authDomain = new AuthDomain();
		const apiBaseUrl = authDomain.getApiBaseUrl();

		if (apiBaseUrl) {
			// Use the new bulk import API endpoint
			const apiUrl = `${apiBaseUrl}/ai/api/v1/briefs/${briefId}/tasks`;

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
			// The extractTasks method has been removed from SupabaseRepository
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

	// ========== Generate Brief From Tasks ==========

	/**
	 * Generate a new brief from local tasks
	 * This is the primary export method - creates a brief and imports all tasks atomically
	 */
	async generateBriefFromTasks(
		options: GenerateBriefOptions = {}
	): Promise<GenerateBriefResult> {
		const isAuthenticated = await this.authManager.hasValidSession();
		if (!isAuthenticated) {
			throw new TaskMasterError(
				'Authentication required for export',
				ERROR_CODES.AUTHENTICATION_ERROR
			);
		}

		// Get current context for org ID
		const context = await this.authManager.getContext();
		let orgId = options.orgId || context?.orgId;

		// If no org in context, try to fetch and use the user's organizations
		if (!orgId) {
			const organizations = await this.authManager.getOrganizations();
			if (organizations.length === 0) {
				return {
					success: false,
					error: {
						code: 'NO_ORGANIZATIONS',
						message:
							'No organizations available. Please create an organization in Hamster first.'
					}
				};
			}
			// Use the first organization (most common case: user has one org)
			orgId = organizations[0].id;
		}

		// Get tasks from the specified or active tag
		const activeTag = this.configManager.getActiveTag();
		const tag = options.tag || activeTag;

		// Always read tasks from local file storage for export
		const fileStorage = new FileStorage(this.configManager.getProjectRoot());
		await fileStorage.initialize();

		// Load tasks with filters applied
		const tasks = await fileStorage.loadTasks(tag, {
			status: options.status,
			excludeSubtasks: options.excludeSubtasks
		});

		if (tasks.length === 0) {
			return {
				success: false,
				error: {
					code: 'NO_TASKS',
					message: 'No tasks found to export'
				}
			};
		}

		// Transform tasks to import format
		const importTasks = this.transformTasksForImport(tasks);

		// Get project name from project root directory name
		const projectName = this.getProjectName();

		// Call the generate brief endpoint
		return this.callGenerateBriefEndpoint({
			tasks: importTasks,
			source: {
				tool: 'task-master',
				version: this.getVersion(),
				tag: tag,
				projectName: projectName
			},
			orgId,
			inviteEmails: options.inviteEmails,
			options: options.options
		});
	}

	/**
	 * Transform tasks to import format for the API
	 */
	private transformTasksForImport(tasks: Task[]): ImportTask[] {
		const importTasks: ImportTask[] = [];

		for (const task of tasks) {
			// Add parent task
			importTasks.push({
				externalId: String(task.id),
				title: task.title,
				description: this.enrichDescription(task),
				details: task.details,
				status: this.mapStatusForImport(task.status),
				priority: this.mapPriorityForImport(task.priority),
				dependencies: task.dependencies?.map(String) || [],
				metadata: {
					originalStatus: task.status,
					originalPriority: task.priority,
					testStrategy: task.testStrategy,
					complexity: task.complexity
				}
			});

			// Add subtasks if they exist
			if (task.subtasks && task.subtasks.length > 0) {
				for (const subtask of task.subtasks) {
					importTasks.push({
						externalId: `${task.id}.${subtask.id}`,
						parentId: String(task.id),
						title: subtask.title,
						description: this.enrichDescription(subtask),
						details: subtask.details,
						status: this.mapStatusForImport(subtask.status),
						priority: this.mapPriorityForImport(subtask.priority),
						dependencies:
							subtask.dependencies?.map((dep) => {
								// Convert subtask dependencies to full ID format
								if (String(dep).includes('.')) {
									return String(dep);
								}
								return `${task.id}.${dep}`;
							}) || [],
						metadata: {
							originalStatus: subtask.status,
							originalPriority: subtask.priority,
							testStrategy: subtask.testStrategy,
							complexity: subtask.complexity
						}
					});
				}
			}
		}

		return importTasks;
	}

	/**
	 * Map internal status to import format
	 */
	private mapStatusForImport(status?: string): ImportTask['status'] {
		switch (status) {
			case 'pending':
				return 'todo';
			case 'in-progress':
			case 'in_progress':
				return 'in_progress';
			case 'done':
			case 'completed':
				return 'done';
			case 'blocked':
				return 'blocked';
			default:
				return 'todo';
		}
	}

	/**
	 * Map internal priority to import format
	 * Note: Hamster uses 'urgent' instead of 'critical'
	 */
	private mapPriorityForImport(priority?: string): ImportTask['priority'] {
		switch (priority?.toLowerCase()) {
			case 'low':
				return 'low';
			case 'medium':
				return 'medium';
			case 'high':
				return 'high';
			case 'critical':
			case 'urgent':
				return 'urgent';
			default:
				return 'medium';
		}
	}

	/**
	 * Get the current version of task-master
	 */
	private getVersion(): string {
		// Try to get version from package.json or config
		try {
			// This will be populated at build time or from package.json
			return process.env.npm_package_version || '1.0.0';
		} catch {
			return '1.0.0';
		}
	}

	/**
	 * Get the project name from the project root directory
	 */
	private getProjectName(): string | undefined {
		try {
			const projectRoot = this.configManager.getProjectRoot();
			// Use the directory name as project name
			const path = projectRoot.split('/');
			return path[path.length - 1] || undefined;
		} catch {
			return undefined;
		}
	}

	/**
	 * Call the generate brief from tasks endpoint
	 */
	private async callGenerateBriefEndpoint(request: {
		tasks: ImportTask[];
		source: {
			tool: string;
			version: string;
			tag?: string;
			projectName?: string;
		};
		orgId?: string;
		inviteEmails?: string[];
		options?: GenerateBriefOptions['options'];
	}): Promise<GenerateBriefResult> {
		// Use AuthDomain to get the properly formatted API base URL
		const authDomain = new AuthDomain();
		const apiBaseUrl = authDomain.getApiBaseUrl();

		if (!apiBaseUrl) {
			throw new TaskMasterError(
				'Export API endpoint not configured. Please set TM_PUBLIC_BASE_DOMAIN environment variable.',
				ERROR_CODES.MISSING_CONFIGURATION,
				{ operation: 'generateBriefFromTasks' }
			);
		}

		const apiUrl = `${apiBaseUrl}/ai/api/v1/briefs/generate-from-tasks`;

		// Get auth token
		const accessToken = await this.authManager.getAccessToken();
		if (!accessToken) {
			throw new TaskMasterError(
				'Not authenticated',
				ERROR_CODES.AUTHENTICATION_ERROR
			);
		}

		// Build request body - use accountId for Hamster API
		const accountId = request.orgId;
		if (!accountId) {
			return {
				success: false,
				error: {
					code: 'MISSING_ACCOUNT',
					message:
						'No organization selected. Please run "tm auth" and select an organization first.'
				}
			};
		}

		const requestBody: Record<string, unknown> = {
			tasks: request.tasks,
			source: request.source,
			accountId, // Hamster expects accountId, not orgId
			options: {
				generateTitle: request.options?.generateTitle ?? true,
				generateDescription: request.options?.generateDescription ?? true,
				preserveHierarchy: request.options?.preserveHierarchy ?? true,
				preserveDependencies: request.options?.preserveDependencies ?? true,
				title: request.options?.title,
				description: request.options?.description
			}
		};

		// Add invite emails if provided (max 10)
		if (request.inviteEmails && request.inviteEmails.length > 0) {
			requestBody.inviteEmails = request.inviteEmails.slice(0, 10);
		}

		try {
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
					'x-account-id': accountId // Also send as header for redundancy
				},
				body: JSON.stringify(requestBody)
			});

			// Check content type to avoid JSON parse errors on HTML responses (e.g., 404 pages)
			const contentType = response.headers.get('content-type') || '';
			if (!contentType.includes('application/json')) {
				const text = await response.text();
				return {
					success: false,
					error: {
						code: 'API_ERROR',
						message: `API returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`
					}
				};
			}

			const jsonData = await response.json();
			const result = jsonData as GenerateBriefResponse;

			if (!response.ok || !result.success) {
				// Try to extract error from various possible response formats
				const errorMessage =
					result.error?.message ||
					(jsonData as any)?.message ||
					(jsonData as any)?.error ||
					`API request failed: ${response.status} - ${response.statusText}`;

				const errorCode =
					result.error?.code ||
					(jsonData as any)?.code ||
					(jsonData as any)?.statusCode ||
					'API_ERROR';

				return {
					success: false,
					warnings: result.warnings,
					error: {
						code: String(errorCode),
						message: String(errorMessage)
					}
				};
			}

			return {
				success: true,
				brief: result.brief,
				taskMapping: result.taskMapping,
				invitations: result.invitations,
				warnings: result.warnings
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			return {
				success: false,
				error: {
					code: 'NETWORK_ERROR',
					message: `Failed to connect to API: ${errorMessage}`
				}
			};
		}
	}
}
