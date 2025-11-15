/**
 * @fileoverview Tasks Domain Facade
 * Public API for task-related operations
 */

import type { ConfigManager } from '../config/managers/config-manager.js';
import type { AuthDomain } from '../auth/auth-domain.js';
import { BriefsDomain } from '../briefs/briefs-domain.js';
import { TaskService } from './services/task-service.js';
import { TaskExecutionService } from './services/task-execution-service.js';
import { TaskLoaderService } from './services/task-loader.service.js';
import { PreflightChecker } from './services/preflight-checker.service.js';
import { TagService } from './services/tag.service.js';
import type {
	CreateTagOptions,
	DeleteTagOptions,
	CopyTagOptions
} from './services/tag.service.js';

import type { Subtask, Task, TaskStatus } from '../../common/types/index.js';
import type {
	TaskListResult,
	GetTaskListOptions
} from './services/task-service.js';
import type {
	StartTaskOptions,
	StartTaskResult
} from './services/task-execution-service.js';
import type {
	PreflightResult
} from './services/preflight-checker.service.js';
import type { TaskValidationResult } from './services/task-loader.service.js';
import type { ExpandTaskResult } from '../integration/services/task-expansion.service.js';

/**
 * Tasks Domain - Unified API for all task operations
 */
export class TasksDomain {
	private taskService: TaskService;
	private executionService: TaskExecutionService;
	private loaderService: TaskLoaderService;
	private preflightChecker: PreflightChecker;
	private briefsDomain: BriefsDomain;
	private tagService!: TagService;

	constructor(configManager: ConfigManager, _authDomain?: AuthDomain) {
		this.taskService = new TaskService(configManager);
		this.executionService = new TaskExecutionService(this.taskService);
		this.loaderService = new TaskLoaderService(this.taskService);
		this.preflightChecker = new PreflightChecker(configManager.getProjectRoot());
		this.briefsDomain = new BriefsDomain();
	}

	async initialize(): Promise<void> {
		await this.taskService.initialize();

		// TagService needs storage - get it from TaskService AFTER initialization
		this.tagService = new TagService(this.taskService.getStorage());
	}

	// ========== Task Retrieval ==========

	/**
	 * Get list of tasks with filtering
	 */
	async list(options?: GetTaskListOptions): Promise<TaskListResult> {
		return this.taskService.getTaskList(options);
	}

	/**
	 * Get a single task by ID
	 * Automatically handles all ID formats:
	 * - Simple task IDs (e.g., "1", "HAM-123")
	 * - Subtask IDs with dot notation (e.g., "1.2", "HAM-123.2")
	 *
	 * @returns Discriminated union indicating task/subtask with proper typing
	 */
	async get(
		taskId: string,
		tag?: string
	): Promise<
		| { task: Task; isSubtask: false }
		| { task: Subtask; isSubtask: true }
		| { task: null; isSubtask: boolean }
	> {
		// Parse ID - check for dot notation (subtask)
		const parts = taskId.split('.');
		const parentId = parts[0];
		const subtaskIdPart = parts[1];

		// Fetch the task
		const task = await this.taskService.getTask(parentId, tag);
		if (!task) {
			return { task: null, isSubtask: false };
		}

		// Handle subtask notation (1.2)
		if (subtaskIdPart && task.subtasks) {
			const subtask = task.subtasks.find(
				(st) => String(st.id) === subtaskIdPart
			);
			if (subtask) {
				// Return the actual subtask with properly typed result
				return { task: subtask, isSubtask: true };
			}
			// Subtask ID provided but not found
			return { task: null, isSubtask: true };
		}

		// It's a regular task
		return { task, isSubtask: false };
	}

	/**
	 * Get tasks by status
	 */
	async getByStatus(status: TaskStatus, tag?: string): Promise<Task[]> {
		return this.taskService.getTasksByStatus(status, tag);
	}

	/**
	 * Get task statistics
	 */
	async getStats(tag?: string) {
		return this.taskService.getTaskStats(tag);
	}

	/**
	 * Get next available task to work on
	 */
	async getNext(tag?: string): Promise<Task | null> {
		return this.taskService.getNextTask(tag);
	}

	// ========== Task Status Management ==========

	/**
	 * Update task with new data (direct structural update)
	 * @param taskId - Task ID (supports numeric, alphanumeric like TAS-49, and subtask IDs like 1.2)
	 * @param updates - Partial task object with fields to update
	 * @param tag - Optional tag context
	 */
	async update(
		taskId: string | number,
		updates: Partial<Task>,
		tag?: string
	): Promise<void> {
		return this.taskService.updateTask(taskId, updates, tag);
	}

	/**
	 * Update task using AI-powered prompt (natural language update)
	 * @param taskId - Task ID (supports numeric, alphanumeric like TAS-49, and subtask IDs like 1.2)
	 * @param prompt - Natural language prompt describing the update
	 * @param tag - Optional tag context
	 * @param options - Optional update options
	 * @param options.useResearch - Use research AI for file storage updates
	 * @param options.mode - Update mode for API storage: 'append', 'update', or 'rewrite'
	 */
	async updateWithPrompt(
		taskId: string | number,
		prompt: string,
		tag?: string,
		options?: { mode?: 'append' | 'update' | 'rewrite'; useResearch?: boolean }
	): Promise<void> {
		return this.taskService.updateTaskWithPrompt(taskId, prompt, tag, options);
	}

	/**
	 * Expand task into subtasks using AI
	 * @returns ExpandTaskResult when using API storage, void for file storage
	 */
	async expand(
		taskId: string | number,
		tag?: string,
		options?: {
			numSubtasks?: number;
			useResearch?: boolean;
			additionalContext?: string;
			force?: boolean;
		}
	): Promise<ExpandTaskResult | void> {
		return this.taskService.expandTaskWithPrompt(taskId, tag, options);
	}

	/**
	 * Update task status
	 */
	async updateStatus(taskId: string, status: TaskStatus, tag?: string) {
		return this.taskService.updateTaskStatus(taskId, status, tag);
	}

	/**
	 * Set active tag
	 */
	async setActiveTag(tag: string): Promise<void> {
		return this.taskService.setActiveTag(tag);
	}

	/**
	 * Resolve a brief by ID, name, or partial match without switching
	 * Returns the full brief object
	 *
	 * Supports:
	 * - Full UUID
	 * - Last 8 characters of UUID
	 * - Brief name (exact or partial match)
	 *
	 * Only works with API storage (briefs).
	 *
	 * @param briefIdOrName - Brief identifier
	 * @param orgId - Optional organization ID
	 * @returns The resolved brief object
	 */
	async resolveBrief(briefIdOrName: string, orgId?: string): Promise<any> {
		return this.briefsDomain.resolveBrief(briefIdOrName, orgId);
	}

	/**
	 * Switch to a different tag/brief context
	 * For file storage: updates active tag in state
	 * For API storage: looks up brief by name and updates auth context
	 */
	async switchTag(tagName: string): Promise<void> {
		const storageType = this.taskService.getStorageType();

		if (storageType === 'file') {
			await this.setActiveTag(tagName);
		} else {
			await this.briefsDomain.switchBrief(tagName);
		}
	}

	// ========== Task Execution ==========

	/**
	 * Start working on a task
	 */
	async start(taskId: string, options?: StartTaskOptions): Promise<StartTaskResult> {
		return this.executionService.startTask(taskId, options);
	}

	/**
	 * Check for in-progress conflicts
	 */
	async checkInProgressConflicts(taskId: string) {
		return this.executionService.checkInProgressConflicts(taskId);
	}

	/**
	 * Get next available task (from execution service)
	 */
	async getNextAvailable(): Promise<string | null> {
		return this.executionService.getNextAvailableTask();
	}

	/**
	 * Check if a task can be started
	 */
	async canStart(taskId: string, force?: boolean): Promise<boolean> {
		return this.executionService.canStartTask(taskId, force);
	}

	// ========== Task Loading & Validation ==========

	/**
	 * Load and validate a task for execution
	 */
	async loadAndValidate(taskId: string): Promise<TaskValidationResult> {
		return this.loaderService.loadAndValidateTask(taskId);
	}

	/**
	 * Get execution order for subtasks
	 */
	getExecutionOrder(task: Task) {
		return this.loaderService.getExecutionOrder(task);
	}

	// ========== Preflight Checks ==========

	/**
	 * Run all preflight checks
	 */
	async runPreflightChecks(): Promise<PreflightResult> {
		return this.preflightChecker.runAllChecks();
	}

	/**
	 * Detect test command
	 */
	async detectTestCommand() {
		return this.preflightChecker.detectTestCommand();
	}

	/**
	 * Check git working tree
	 */
	async checkGitWorkingTree() {
		return this.preflightChecker.checkGitWorkingTree();
	}

	/**
	 * Validate required tools
	 */
	async validateRequiredTools() {
		return this.preflightChecker.validateRequiredTools();
	}

	/**
	 * Detect default git branch
	 */
	async detectDefaultBranch() {
		return this.preflightChecker.detectDefaultBranch();
	}

	// ========== Tag Management ==========

	/**
	 * Create a new tag
	 * For file storage: creates tag locally with optional task copying
	 * For API storage: throws error (client should redirect to web UI)
	 */
	async createTag(name: string, options?: CreateTagOptions) {
		return this.tagService.createTag(name, options);
	}

	/**
	 * Delete an existing tag
	 * Cannot delete master tag
	 * For file storage: deletes tag locally
	 * For API storage: throws error (client should redirect to web UI)
	 */
	async deleteTag(name: string, options?: DeleteTagOptions) {
		return this.tagService.deleteTag(name, options);
	}

	/**
	 * Rename an existing tag
	 * Cannot rename master tag
	 * For file storage: renames tag locally
	 * For API storage: throws error (client should redirect to web UI)
	 */
	async renameTag(oldName: string, newName: string) {
		return this.tagService.renameTag(oldName, newName);
	}

	/**
	 * Copy an existing tag to create a new tag with the same tasks
	 * For file storage: copies tag locally
	 * For API storage: throws error (client should show alternative)
	 */
	async copyTag(source: string, target: string, options?: CopyTagOptions) {
		return this.tagService.copyTag(source, target, options);
	}

	/**
	 * Get all tags with detailed statistics including task counts
	 * For API storage, returns briefs with task counts
	 * For file storage, returns tags from tasks.json with counts
	 */
	async getTagsWithStats() {
		return this.tagService.getTagsWithStats();
	}

	// ========== Storage Information ==========

	/**
	 * Get the resolved storage type (actual type being used at runtime)
	 */
	getStorageType(): 'file' | 'api' {
		return this.taskService.getStorageType();
	}
}
