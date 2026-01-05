/**
 * @fileoverview Task Service
 * Core service for task operations - handles business logic between storage and API
 */

import type {
	Task,
	TaskFilter,
	TaskStatus,
	StorageType
} from '../../../common/types/index.js';
import type { IStorage } from '../../../common/interfaces/storage.interface.js';
import { ConfigManager } from '../../config/managers/config-manager.js';
import { StorageFactory } from '../../storage/services/storage-factory.js';
import { TaskEntity } from '../entities/task.entity.js';
import { ERROR_CODES, TaskMasterError } from '../../../common/errors/task-master-error.js';
import { getLogger } from '../../../common/logger/factory.js';
import type { ExpandTaskResult } from '../../integration/services/task-expansion.service.js';
import { normalizeDisplayId } from '../../../common/schemas/task-id.schema.js';

/**
 * Result returned by getTaskList
 */
export interface TaskListResult {
	/** The filtered list of tasks */
	tasks: Task[];
	/** Total number of tasks before filtering */
	total: number;
	/** Number of tasks after filtering */
	filtered: number;
	/** The tag/brief name for these tasks (brief name for API storage, tag for file storage) */
	tag?: string;
	/** Storage type being used */
	storageType: StorageType;
}

/**
 * Options for getTaskList
 */
export interface GetTaskListOptions {
	/** Optional tag override (uses active tag from config if not provided) */
	tag?: string;
	/** Filter criteria */
	filter?: TaskFilter;
	/** Include subtasks in response */
	includeSubtasks?: boolean;
}

/**
 * TaskService handles all task-related operations
 * This is where business logic lives - it coordinates between ConfigManager and Storage
 */
export class TaskService {
	private configManager: ConfigManager;
	private storage: IStorage;
	private initialized = false;
	private logger = getLogger('TaskService');

	constructor(configManager: ConfigManager) {
		this.configManager = configManager;

		// Storage will be created during initialization
		this.storage = null as any;
	}

	/**
	 * Normalize a dependency ID to full dotted notation
	 *
	 * Handles:
	 * - Numeric task IDs: "1" → "1"
	 * - Dotted subtask IDs: "1.2" → "1.2"
	 * - API display IDs: "ham1" → "HAM-1"
	 *
	 * When context is provided (parentId for subtasks), converts relative IDs:
	 * - Relative subtask dep: "2" with parentId "1" → "1.2"
	 *
	 * @param depId - The dependency ID to normalize
	 * @param parentId - Optional parent task ID (for subtask dependencies)
	 * @returns Normalized dependency ID in full dotted notation
	 *
	 * @example
	 * ```typescript
	 * normalizeDependencyId("1");              // "1"
	 * normalizeDependencyId("1.2");            // "1.2"
	 * normalizeDependencyId("ham1");           // "HAM-1"
	 * normalizeDependencyId("2", "1");         // "1.2" (subtask dep)
	 * normalizeDependencyId("1.2", "5");       // "1.2" (already full)
	 * ```
	 */
	private normalizeDependencyId(depId: string | number, parentId?: string): string {
		const idStr = String(depId);

		// If already dotted (subtask ID), normalize and return as-is
		if (idStr.includes('.')) {
			return normalizeDisplayId(idStr);
		}

		// If parentId provided and depId is numeric, treat as relative subtask dependency
		if (parentId && /^\d+$/.test(idStr)) {
			return `${parentId}.${idStr}`;
		}

		// Otherwise normalize API IDs or return numeric IDs as-is
		return normalizeDisplayId(idStr);
	}

	/**
	 * Normalize an array of dependency IDs to full dotted notation
	 *
	 * @param depIds - Array of dependency IDs to normalize
	 * @param parentId - Optional parent task ID (for subtask dependencies)
	 * @returns Array of normalized dependency IDs
	 *
	 * @example
	 * ```typescript
	 * normalizeDependencyIds(["1", "2"], "5");     // ["5.1", "5.2"]
	 * normalizeDependencyIds(["1.2", "3.4"]);      // ["1.2", "3.4"]
	 * normalizeDependencyIds(["ham1", "ham2"]);    // ["HAM-1", "HAM-2"]
	 * ```
	 */
	private normalizeDependencyIds(
		depIds: Array<string | number>,
		parentId?: string
	): string[] {
		return depIds.map((depId) => this.normalizeDependencyId(depId, parentId));
	}

	/**
	 * Check if a candidate task has a dependency conflict with already-selected tasks
	 *
	 * A conflict exists when:
	 * 1. The candidate depends on a selected task, OR
	 * 2. A selected task depends on the candidate, OR
	 * 3. Cross-type dependency exists (e.g., task depends on subtask's parent or vice versa)
	 * 4. Cross-hierarchy dependency (e.g., candidate depends on subtask that's child of selected)
	 *
	 * @param candidate - The candidate task being considered for selection
	 * @param selectedTasks - Array of already-selected tasks
	 * @returns True if there's a dependency conflict
	 *
	 * @example
	 * ```typescript
	 * // Candidate task 3 depends on selected task 1
	 * hasDependencyConflict({ id: "3", dependencies: ["1"] }, [{ id: "1", ... }]);
	 * // => true
	 *
	 * // Selected task 1 depends on candidate
	 * hasDependencyConflict({ id: "3", dependencies: [] }, [{ id: "1", dependencies: ["3"] }]);
	 * // => true
	 *
	 * // Task 3 depends on subtask 1.2, and task 1 (parent of 1.2) is selected
	 * hasDependencyConflict({ id: "3", dependencies: ["1.2"] }, [{ id: "1", ... }]);
	 * // => true
	 *
	 * // No dependencies
	 * hasDependencyConflict({ id: "3", dependencies: [] }, [{ id: "1", dependencies: [] }]);
	 * // => false
	 * ```
	 */
	private hasDependencyConflict(
		candidate: Task,
		selectedTasks: Task[]
	): boolean {
		const candidateId = String(candidate.id);
		const candidateDeps = new Set(
			this.normalizeDependencyIds(candidate.dependencies ?? [])
		);

		// Check each selected task for conflicts
		for (const selectedTask of selectedTasks) {
			const selectedId = String(selectedTask.id);
			const selectedDeps = new Set(
				this.normalizeDependencyIds(selectedTask.dependencies ?? [])
			);

			// Check 1: Does candidate depend on selected task?
			if (candidateDeps.has(selectedId)) {
				return true;
			}

			// Check 2: Does selected task depend on candidate?
			if (selectedDeps.has(candidateId)) {
				return true;
			}

			// Check 3: Cross-type dependencies
			// If candidate is a subtask (e.g., "1.2"), check if selected depends on parent (e.g., "1")
			if (candidateId.includes('.')) {
				const candidateParentId = candidateId.split('.')[0];
				if (selectedDeps.has(candidateParentId)) {
					return true;
				}
			}

			// If selected is a subtask, check if candidate depends on its parent
			if (selectedId.includes('.')) {
				const selectedParentId = selectedId.split('.')[0];
				if (candidateDeps.has(selectedParentId)) {
					return true;
				}
			}

			// Check 4: Cross-hierarchy dependencies
			// If candidate depends on a subtask, check if the subtask's parent is being selected
			for (const dep of candidateDeps) {
				if (dep.includes('.')) {
					const depParentId = dep.split('.')[0];
					if (selectedId === depParentId) {
						return true;
					}
				}
			}

			// If selected depends on a subtask, check if the subtask's parent is the candidate
			for (const dep of selectedDeps) {
				if (dep.includes('.')) {
					const depParentId = dep.split('.')[0];
					if (candidateId === depParentId) {
						return true;
					}
				}
			}
		}

		return false;
	}

	/**
	 * Initialize the service
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// Create storage based on configuration
		const storageConfig = this.configManager.getStorageConfig();
		const projectRoot = this.configManager.getProjectRoot();

		this.storage = await StorageFactory.createFromStorageConfig(
			storageConfig,
			projectRoot
		);

		// Initialize storage
		await this.storage.initialize();

		this.initialized = true;
	}

	/**
	 * Get list of tasks
	 * This is the main method that retrieves tasks from storage and applies filters
	 */
	async getTaskList(options: GetTaskListOptions = {}): Promise<TaskListResult> {
		// Determine which tag to use
		const activeTag = this.configManager.getActiveTag();
		const tag = options.tag || activeTag;

		try {
			// Determine if we can push filters to storage layer
			const canPushStatusFilter =
				options.filter?.status &&
				!options.filter.priority &&
				!options.filter.tags &&
				!options.filter.assignee &&
				!options.filter.search &&
				options.filter.hasSubtasks === undefined;

			// Build storage-level options
			const storageOptions: any = {};

			// Push status filter to storage if it's the only filter
			if (canPushStatusFilter) {
				const statuses = Array.isArray(options.filter!.status)
					? options.filter!.status
					: [options.filter!.status];
				// Only push single status to storage (multiple statuses need in-memory filtering)
				if (statuses.length === 1) {
					storageOptions.status = statuses[0];
				}
			}

			// Push subtask exclusion to storage
			if (options.includeSubtasks === false) {
				storageOptions.excludeSubtasks = true;
			}

			// Load tasks from storage with pushed-down filters
			const rawTasks = await this.storage.loadTasks(tag, storageOptions);

			// Get total count without status filters, but preserve subtask exclusion
			const baseOptions: any = {};
			if (options.includeSubtasks === false) {
				baseOptions.excludeSubtasks = true;
			}

			const allTasks =
				storageOptions.status !== undefined
					? await this.storage.loadTasks(tag, baseOptions)
					: rawTasks;

			// Convert to TaskEntity for business logic operations
			const taskEntities = TaskEntity.fromArray(rawTasks);

			// Apply remaining filters in-memory if needed
			let filteredEntities = taskEntities;
			if (options.filter && !canPushStatusFilter) {
				filteredEntities = this.applyFilters(taskEntities, options.filter);
			} else if (
				options.filter?.status &&
				Array.isArray(options.filter.status) &&
				options.filter.status.length > 1
			) {
				// Multiple statuses - filter in-memory
				filteredEntities = this.applyFilters(taskEntities, options.filter);
			}

			// Convert back to plain objects
			const tasks = filteredEntities.map((entity) => entity.toJSON());

			// For API storage, use brief name. For file storage, use tag.
			// This way consumers don't need to know about the difference.
			const storageType = this.getStorageType();
			const tagOrBrief =
				storageType === 'api'
					? this.storage.getCurrentBriefName() || tag
					: tag;

			return {
				tasks,
				total: allTasks.length,
				filtered: filteredEntities.length,
				tag: tagOrBrief, // For API: brief name, For file: tag
				storageType
			};
		} catch (error) {
			// Re-throw all TaskMasterErrors without wrapping
			// These errors are already user-friendly and have appropriate error codes
			if (error instanceof TaskMasterError) {
				throw error;
			}

			// Only wrap unknown errors
			this.logger.error('Failed to get task list', error);
			throw new TaskMasterError(
				'Failed to get task list',
				ERROR_CODES.INTERNAL_ERROR,
				{
					operation: 'getTaskList',
					tag,
					hasFilter: !!options.filter
				},
				error as Error
			);
		}
	}

	/**
	 * Get a single task by ID - delegates to storage layer
	 */
	async getTask(taskId: string, tag?: string): Promise<Task | null> {
		// Use provided tag or get active tag
		const activeTag = tag || this.getActiveTag();

		try {
			// Delegate to storage layer which handles the specific logic for tasks vs subtasks
			return await this.storage.loadTask(String(taskId), activeTag);
		} catch (error) {
			// Re-throw all TaskMasterErrors without wrapping
			if (error instanceof TaskMasterError) {
				throw error;
			}

			throw new TaskMasterError(
				`Failed to get task ${taskId}`,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'getTask',
					resource: 'task',
					taskId: String(taskId),
					tag: activeTag
				},
				error as Error
			);
		}
	}

	/**
	 * Get tasks filtered by status
	 */
	async getTasksByStatus(
		status: TaskStatus | TaskStatus[],
		tag?: string
	): Promise<Task[]> {
		const statuses = Array.isArray(status) ? status : [status];

		const result = await this.getTaskList({
			tag,
			filter: { status: statuses }
		});

		return result.tasks;
	}

	/**
	 * Get statistics about tasks
	 */
	async getTaskStats(tag?: string): Promise<{
		total: number;
		byStatus: Record<TaskStatus, number>;
		withSubtasks: number;
		blocked: number;
		storageType: StorageType;
	}> {
		const result = await this.getTaskList({
			tag,
			includeSubtasks: true
		});

		const stats = {
			total: result.total,
			byStatus: {} as Record<TaskStatus, number>,
			withSubtasks: 0,
			blocked: 0,
			storageType: result.storageType
		};

		// Initialize all statuses
		const allStatuses: TaskStatus[] = [
			'pending',
			'in-progress',
			'done',
			'deferred',
			'cancelled',
			'blocked',
			'review'
		];

		allStatuses.forEach((status) => {
			stats.byStatus[status] = 0;
		});

		// Count tasks
		result.tasks.forEach((task) => {
			stats.byStatus[task.status]++;

			if (task.subtasks && task.subtasks.length > 0) {
				stats.withSubtasks++;
			}

			if (task.status === 'blocked') {
				stats.blocked++;
			}
		});

		return stats;
	}

	/**
	 * Get next available tasks to work on
	 * Returns up to `concurrency` independent tasks that can be worked on in parallel
	 * Prioritizes eligible subtasks from in-progress parent tasks before falling back to top-level tasks
	 *
	 * @param concurrency - Maximum number of tasks to return (must be >= 1, capped at 10)
	 * @param tag - Optional tag to filter tasks
	 * @returns Promise resolving to array of independent tasks (empty if none available)
	 *
	 * @throws {Error} If concurrency < 1
	 *
	 * Algorithm:
	 * 1. Validate concurrency parameter
	 * 2. Get all tasks with status [pending, in-progress, done]
	 * 3. Build set of completed task/subtask IDs
	 * 4. Collect eligible candidates:
	 *    a. Subtasks from in-progress parents (with satisfied dependencies)
	 *    b. Top-level tasks (with satisfied dependencies)
	 * 5. Sort candidates by: priority (desc) → dep count (asc) → ID (asc)
	 * 6. Select up to N tasks, ensuring no selected task depends on another selected task
	 *
	 * Example:
	 * ```typescript
	 * // Get 2 independent tasks
	 * const tasks = await taskService.getNextTasks(2);
	 * // Returns: [{ id: '1', ... }, { id: '3', ... }]
	 * // Task 3 is NOT returned if it depends on Task 1
	 * ```
	 */
	async getNextTasks(concurrency: number, tag?: string): Promise<Task[]> {
		// Validate concurrency parameter type
		if (typeof concurrency !== 'number' || Number.isNaN(concurrency)) {
			throw new TaskMasterError(
				`Invalid concurrency value: '${concurrency}'. Concurrency must be a positive integer.`,
				ERROR_CODES.INVALID_INPUT,
				{
					operation: 'getNextTasks',
					parameter: 'concurrency',
					providedValue: concurrency,
					expectedType: 'number'
				}
			);
		}

		// Validate minimum value
		if (concurrency < 1) {
			throw new TaskMasterError(
				`Concurrency must be at least 1. Got: ${concurrency}`,
				ERROR_CODES.INVALID_INPUT,
				{
					operation: 'getNextTasks',
					parameter: 'concurrency',
					providedValue: concurrency,
					minimumValue: 1
				}
			);
		}

		// Cap at 10 with warning (FR-003, EM-003)
		const maxConcurrency = 10;
		let effectiveConcurrency = concurrency;
		if (concurrency > maxConcurrency) {
			this.logger.warn(
				`Concurrency capped at maximum of ${maxConcurrency}. Requested: ${concurrency}, using: ${maxConcurrency}`
			);
			effectiveConcurrency = maxConcurrency;
		}

		// Get all tasks with relevant statuses
		const result = await this.getTaskList({
			tag,
			filter: {
				status: ['pending', 'in-progress', 'done']
			}
		});

		const allTasks = result.tasks;
		const priorityValues = { critical: 4, high: 3, medium: 2, low: 1 };

		// Build completed IDs set (both tasks and subtasks)
		const completedIds = new Set<string>();
		allTasks.forEach((t) => {
			if (t.status === 'done') {
				completedIds.add(String(t.id));
			}
			if (Array.isArray(t.subtasks)) {
				t.subtasks.forEach((st) => {
					if (st.status === 'done') {
						completedIds.add(`${t.id}.${st.id}`);
					}
				});
			}
		});

		// Helper to check if all dependencies are satisfied
		const areDepsSatisfied = (deps: string[] = []): boolean => {
			return deps.length === 0 || deps.every((depId) => completedIds.has(String(depId)));
		};

		// Collect all eligible candidates
		const candidates: Array<Task & { parentId?: string }> = [];

		// Phase 1: Subtasks from in-progress parent tasks
		allTasks
			.filter((t) => t.status === 'in-progress' && Array.isArray(t.subtasks))
			.forEach((parent) => {
				parent.subtasks!.forEach((st) => {
					const stStatus = (st.status || 'pending').toLowerCase();
					if (stStatus !== 'pending' && stStatus !== 'in-progress') return;

					// Normalize subtask dependencies to full dotted notation
					const fullDeps = this.normalizeDependencyIds(
						st.dependencies ?? [],
						String(parent.id)
					);

					if (areDepsSatisfied(fullDeps)) {
						candidates.push({
							id: `${parent.id}.${st.id}`,
							title: st.title || `Subtask ${st.id}`,
							status: st.status || 'pending',
							priority: st.priority || parent.priority || 'medium',
							dependencies: fullDeps,
							parentId: String(parent.id),
							description: st.description,
							details: st.details,
							testStrategy: st.testStrategy,
							subtasks: []
						} as Task & { parentId: string });
					}
				});
			});

		// Phase 2: Top-level tasks (exclude those with subtasks in Phase 1)
		const tasksWithSubtasksInProgress = new Set<string>(
			allTasks
				.filter((t) => t.status === 'in-progress' && Array.isArray(t.subtasks) && t.subtasks.length > 0)
				.map((t) => String(t.id))
		);

		allTasks.forEach((task) => {
			const status = (task.status || 'pending').toLowerCase();
			if (status !== 'pending' && status !== 'in-progress') return;

			// Skip tasks that have subtasks (they're handled in Phase 1)
			if (tasksWithSubtasksInProgress.has(String(task.id))) return;

			const deps = task.dependencies ?? [];
			if (areDepsSatisfied(deps)) {
				candidates.push(task);
			}
		});

		// Sort candidates by priority → dependency count → ID
		candidates.sort((a, b) => {
			const pa = priorityValues[a.priority as keyof typeof priorityValues] ?? 2;
			const pb = priorityValues[b.priority as keyof typeof priorityValues] ?? 2;
			if (pb !== pa) return pb - pa;

			if (a.dependencies!.length !== b.dependencies!.length) {
				return a.dependencies!.length - b.dependencies!.length;
			}

			return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
		});

		// Select up to N tasks, ensuring no inter-task dependencies
		const selectedTasks: Task[] = [];

		for (const candidate of candidates) {
			if (selectedTasks.length >= effectiveConcurrency) break;

			// Check if candidate has any dependency conflicts with already-selected tasks
			if (!this.hasDependencyConflict(candidate, selectedTasks)) {
				selectedTasks.push(candidate);
			}
		}

		return selectedTasks;
	}

	/**
	 * Get next available task to work on
	 * Prioritizes eligible subtasks from in-progress parent tasks before falling back to top-level tasks
	 */
	async getNextTask(tag?: string): Promise<Task | null> {
		const result = await this.getTaskList({
			tag,
			filter: {
				status: ['pending', 'in-progress', 'done']
			}
		});

		const allTasks = result.tasks;
		const priorityValues = { critical: 4, high: 3, medium: 2, low: 1 };

		// Build completed IDs set (both tasks and subtasks)
		const completedIds = new Set<string>();
		allTasks.forEach((t) => {
			if (t.status === 'done') {
				completedIds.add(String(t.id));
			}
			if (Array.isArray(t.subtasks)) {
				t.subtasks.forEach((st) => {
					if (st.status === 'done') {
						completedIds.add(`${t.id}.${st.id}`);
					}
				});
			}
		});

		// 1) Look for eligible subtasks from in-progress parent tasks
		const candidateSubtasks: Array<Task & { parentId?: string }> = [];

		allTasks
			.filter((t) => t.status === 'in-progress' && Array.isArray(t.subtasks))
			.forEach((parent) => {
				parent.subtasks!.forEach((st) => {
					const stStatus = (st.status || 'pending').toLowerCase();
					if (stStatus !== 'pending' && stStatus !== 'in-progress') return;

					// Normalize subtask dependencies to full dotted notation
					const fullDeps = this.normalizeDependencyIds(
						st.dependencies ?? [],
						String(parent.id)
					);
					const depsSatisfied =
						fullDeps.length === 0 ||
						fullDeps.every((depId) => completedIds.has(String(depId)));

					if (depsSatisfied) {
						candidateSubtasks.push({
							id: `${parent.id}.${st.id}`,
							title: st.title || `Subtask ${st.id}`,
							status: st.status || 'pending',
							priority: st.priority || parent.priority || 'medium',
							dependencies: fullDeps,
							parentId: String(parent.id),
							description: st.description,
							details: st.details,
							testStrategy: st.testStrategy,
							subtasks: []
						} as Task & { parentId: string });
					}
				});
			});

		if (candidateSubtasks.length > 0) {
			// Sort by priority → dependency count → parent ID → subtask ID
			candidateSubtasks.sort((a, b) => {
				const pa =
					priorityValues[a.priority as keyof typeof priorityValues] ?? 2;
				const pb =
					priorityValues[b.priority as keyof typeof priorityValues] ?? 2;
				if (pb !== pa) return pb - pa;

				if (a.dependencies!.length !== b.dependencies!.length) {
					return a.dependencies!.length - b.dependencies!.length;
				}

				// Compare parent then subtask ID numerically
				const [aPar, aSub] = String(a.id).split('.').map(Number);
				const [bPar, bSub] = String(b.id).split('.').map(Number);
				if (aPar !== bPar) return aPar - bPar;
				return aSub - bSub;
			});

			return candidateSubtasks[0];
		}

		// 2) Fall back to top-level tasks (original logic)
		const eligibleTasks = allTasks.filter((task) => {
			const status = (task.status || 'pending').toLowerCase();
			if (status !== 'pending' && status !== 'in-progress') return false;

			const deps = task.dependencies ?? [];
			return deps.every((depId) => completedIds.has(String(depId)));
		});

		if (eligibleTasks.length === 0) return null;

		// Sort by priority → dependency count → task ID
		const nextTask = eligibleTasks.sort((a, b) => {
			const pa = priorityValues[a.priority as keyof typeof priorityValues] ?? 2;
			const pb = priorityValues[b.priority as keyof typeof priorityValues] ?? 2;
			if (pb !== pa) return pb - pa;

			const da = (a.dependencies ?? []).length;
			const db = (b.dependencies ?? []).length;
			if (da !== db) return da - db;

			return Number(a.id) - Number(b.id);
		})[0];

		return nextTask;
	}

	/**
	 * Apply filters to task entities
	 */
	private applyFilters(tasks: TaskEntity[], filter: TaskFilter): TaskEntity[] {
		return tasks.filter((task) => {
			// Status filter
			if (filter.status) {
				const statuses = Array.isArray(filter.status)
					? filter.status
					: [filter.status];
				if (!statuses.includes(task.status)) {
					return false;
				}
			}

			// Priority filter
			if (filter.priority) {
				const priorities = Array.isArray(filter.priority)
					? filter.priority
					: [filter.priority];
				if (!priorities.includes(task.priority)) {
					return false;
				}
			}

			// Tags filter
			if (filter.tags && filter.tags.length > 0) {
				if (
					!task.tags ||
					!filter.tags.some((tag) => task.tags?.includes(tag))
				) {
					return false;
				}
			}

			// Assignee filter
			if (filter.assignee) {
				if (task.assignee !== filter.assignee) {
					return false;
				}
			}

			// Search filter
			if (filter.search) {
				const searchLower = filter.search.toLowerCase();
				const inTitle = task.title.toLowerCase().includes(searchLower);
				const inDescription = task.description
					.toLowerCase()
					.includes(searchLower);
				const inDetails = task.details.toLowerCase().includes(searchLower);

				if (!inTitle && !inDescription && !inDetails) {
					return false;
				}
			}

			// Has subtasks filter
			if (filter.hasSubtasks !== undefined) {
				const hasSubtasks = task.subtasks.length > 0;
				if (hasSubtasks !== filter.hasSubtasks) {
					return false;
				}
			}

			return true;
		});
	}

	/**
	 * Get current storage type (resolved at runtime)
	 * Returns the actual storage type being used, never 'auto'
	 */
	getStorageType(): 'file' | 'api' {
		// Storage interface guarantees this method exists
		return this.storage.getStorageType();
	}

	/**
	 * Get the storage instance
	 * Internal use only - used by other services in the tasks module
	 */
	getStorage(): IStorage {
		return this.storage;
	}

	/**
	 * Get current active tag
	 * For API storage, uses the brief ID from auth context
	 * For file storage, uses the tag from local config/state
	 */
	getActiveTag(): string {
		// For API storage, use brief ID from auth context if available
		if (this.initialized && this.getStorageType() === 'api') {
			const briefName = this.storage.getCurrentBriefName();
			if (briefName) {
				return briefName;
			}
		}

		// Fall back to config-based tag resolution
		return this.configManager.getActiveTag();
	}

	/**
	 * Set active tag
	 */
	async setActiveTag(tag: string): Promise<void> {
		await this.configManager.setActiveTag(tag);
	}

	/**
	 * Update a task with new data (direct structural update)
	 * @param taskId - Task ID (supports numeric, alphanumeric, and subtask IDs)
	 * @param updates - Partial task object with fields to update
	 * @param tag - Optional tag context
	 */
	async updateTask(
		taskId: string | number,
		updates: Partial<Task>,
		tag?: string
	): Promise<void> {
		// Ensure we have storage
		if (!this.storage) {
			throw new TaskMasterError(
				'Storage not initialized',
				ERROR_CODES.STORAGE_ERROR
			);
		}

		// Auto-initialize if needed
		if (!this.initialized) {
			await this.initialize();
		}

		// Use provided tag or get active tag
		const activeTag = tag || this.getActiveTag();
		const taskIdStr = String(taskId);

		try {
			// Direct update - no AI processing
			await this.storage.updateTask(taskIdStr, updates, activeTag);
		} catch (error) {
			// Re-throw all TaskMasterErrors without wrapping
			if (error instanceof TaskMasterError) {
				throw error;
			}

			throw new TaskMasterError(
				`Failed to update task ${taskId}`,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'updateTask',
					resource: 'task',
					taskId: taskIdStr,
					tag: activeTag
				},
				error as Error
			);
		}
	}

	/**
	 * Update a task using AI-powered prompt (natural language update)
	 * @param taskId - Task ID (supports numeric, alphanumeric, and subtask IDs)
	 * @param prompt - Natural language prompt describing the update
	 * @param tag - Optional tag context
	 * @param options - Optional update options
	 * @param options.useResearch - Use research AI for file storage updates
	 * @param options.mode - Update mode for API storage: 'append', 'update', or 'rewrite'
	 */
	async updateTaskWithPrompt(
		taskId: string | number,
		prompt: string,
		tag?: string,
		options?: { mode?: 'append' | 'update' | 'rewrite'; useResearch?: boolean }
	): Promise<void> {
		// Ensure we have storage
		if (!this.storage) {
			throw new TaskMasterError(
				'Storage not initialized',
				ERROR_CODES.STORAGE_ERROR
			);
		}

		// Auto-initialize if needed
		if (!this.initialized) {
			await this.initialize();
		}

		// Use provided tag or get active tag
		const activeTag = tag || this.getActiveTag();
		const taskIdStr = String(taskId);

		try {
			// AI-powered update - send prompt to storage layer
			// API storage: sends prompt to backend for server-side AI processing
			// File storage: must use client-side AI logic before calling this
			await this.storage.updateTaskWithPrompt(
				taskIdStr,
				prompt,
				activeTag,
				options
			);
		} catch (error) {
			// If it's a user-facing error (like NO_BRIEF_SELECTED), don't wrap it
			if (
				error instanceof TaskMasterError
			) {
				throw error;
			}

			throw new TaskMasterError(
				`Failed to update task ${taskId} with prompt`,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'updateTaskWithPrompt',
					resource: 'task',
					taskId: taskIdStr,
					tag: activeTag,
					promptLength: prompt.length
				},
				error as Error
			);
		}
	}

	/**
	 * Expand a task into subtasks using AI-powered generation
	 * @param taskId - Task ID to expand (supports numeric and alphanumeric IDs)
	 * @param tag - Optional tag context
	 * @param options - Optional expansion options
	 * @param options.numSubtasks - Number of subtasks to generate
	 * @param options.useResearch - Use research AI for generation
	 * @param options.additionalContext - Additional context for generation
	 * @param options.force - Force regeneration even if subtasks exist
	 * @returns ExpandTaskResult when using API storage, void for file storage
	 */
	async expandTaskWithPrompt(
		taskId: string | number,
		tag?: string,
		options?: {
			numSubtasks?: number;
			useResearch?: boolean;
			additionalContext?: string;
			force?: boolean;
		}
	): Promise<ExpandTaskResult | void> {
		// Ensure we have storage
		if (!this.storage) {
			throw new TaskMasterError(
				'Storage not initialized',
				ERROR_CODES.STORAGE_ERROR
			);
		}

		// Auto-initialize if needed
		if (!this.initialized) {
			await this.initialize();
		}

		// Use provided tag or get active tag
		const activeTag = tag || this.getActiveTag();
		const taskIdStr = String(taskId);

		try {
			// AI-powered expansion - send to storage layer
			// API storage: sends request to backend for server-side AI processing
			// File storage: must use client-side AI logic before calling this
			return await this.storage.expandTaskWithPrompt(
				taskIdStr,
				activeTag,
				options
			);
		} catch (error) {
			// If it's a user-facing error (like NO_BRIEF_SELECTED), don't wrap it
			if (
				error instanceof TaskMasterError
			) {
				throw error;
			}

			throw new TaskMasterError(
				`Failed to expand task ${taskId}`,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'expandTaskWithPrompt',
					resource: 'task',
					taskId: taskIdStr,
					tag: activeTag,
					numSubtasks: options?.numSubtasks
				},
				error as Error
			);
		}
	}

	/**
	 * Update task status - delegates to storage layer which handles storage-specific logic
	 */
	async updateTaskStatus(
		taskId: string | number,
		newStatus: TaskStatus,
		tag?: string
	): Promise<{
		success: boolean;
		oldStatus: TaskStatus;
		newStatus: TaskStatus;
		taskId: string;
	}> {
		// Ensure we have storage
		if (!this.storage) {
			throw new TaskMasterError(
				'Storage not initialized',
				ERROR_CODES.STORAGE_ERROR
			);
		}

		// Use provided tag or get active tag
		const activeTag = tag || this.getActiveTag();
		const taskIdStr = String(taskId);

		try {
			// Delegate to storage layer which handles the specific logic for tasks vs subtasks
			return await this.storage.updateTaskStatus(
				taskIdStr,
				newStatus,
				activeTag
			);
		} catch (error) {
			// Re-throw all TaskMasterErrors without wrapping
			if (error instanceof TaskMasterError) {
				throw error;
			}

			throw new TaskMasterError(
				`Failed to update task status for ${taskIdStr}`,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'updateTaskStatus',
					resource: 'task',
					taskId: taskIdStr,
					newStatus,
					tag: activeTag
				},
				error as Error
			);
		}
	}

	/**
	 * Get all tags with detailed statistics including task counts
	 * Delegates to storage layer which handles file vs API implementation
	 */
	async getTagsWithStats() {
		// Ensure we have storage
		if (!this.storage) {
			throw new TaskMasterError(
				'Storage not initialized',
				ERROR_CODES.STORAGE_ERROR
			);
		}

		// Auto-initialize if needed
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			return await this.storage.getTagsWithStats();
		} catch (error) {
			// Re-throw all TaskMasterErrors without wrapping
			if (error instanceof TaskMasterError) {
				throw error;
			}

			throw new TaskMasterError(
				'Failed to get tags with stats',
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'getTagsWithStats',
					resource: 'tags'
				},
				error as Error
			);
		}
	}

	/**
	 * Close and cleanup resources
	 * Releases file locks and other storage resources
	 */
	async close(): Promise<void> {
		if (this.storage) {
			await this.storage.close();
		}
		this.initialized = false;
	}
}
