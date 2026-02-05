/**
 * @fileoverview SQL query builders and helpers for SQLite storage
 * Provides functions for common CRUD operations on tasks, subtasks, and metadata.
 */

import type Database from 'libsql';
import type {
	Task,
	Subtask,
	TaskStatus,
	TaskMetadata,
	TaskImplementationMetadata,
	RelevantFile,
	ExistingInfrastructure,
	ScopeBoundaries
} from '../../../../common/types/index.js';
import type {
	TaskRow,
	SubtaskRow,
	TaskMetadataRow,
	TagMetadataRow,
	TaskInsertData,
	TaskUpdateData,
	SubtaskInsertData,
	SubtaskUpdateData
} from './types.js';
import { parseComplexity, serializeComplexity } from './types.js';

// ============================================================================
// Task Queries
// ============================================================================

/**
 * Insert a new task into the database
 */
export function insertTask(db: Database.Database, data: TaskInsertData): void {
	const stmt = db.prepare(`
		INSERT INTO tasks (
			id, title, description, status, priority, details, test_strategy,
			tag, effort, actual_effort, complexity, assignee, expansion_prompt,
			complexity_reasoning, implementation_approach, recommended_subtasks,
			created_at, updated_at
		) VALUES (
			?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?,
			?, ?, ?,
			datetime('now'), datetime('now')
		)
	`);

	stmt.run(
		data.id,
		data.title,
		data.description,
		data.status,
		data.priority,
		data.details,
		data.test_strategy,
		data.tag,
		data.effort ?? null,
		data.actual_effort ?? null,
		serializeComplexity(data.complexity ?? undefined),
		data.assignee ?? null,
		data.expansion_prompt ?? null,
		data.complexity_reasoning ?? null,
		data.implementation_approach ?? null,
		data.recommended_subtasks ?? null
	);
}

/**
 * Update an existing task
 */
export function updateTask(
	db: Database.Database,
	taskId: string,
	tag: string,
	updates: TaskUpdateData
): void {
	const setClauses: string[] = ['updated_at = datetime(\'now\')'];
	const params: unknown[] = [];

	if (updates.title !== undefined) {
		setClauses.push('title = ?');
		params.push(updates.title);
	}
	if (updates.description !== undefined) {
		setClauses.push('description = ?');
		params.push(updates.description);
	}
	if (updates.status !== undefined) {
		setClauses.push('status = ?');
		params.push(updates.status);
	}
	if (updates.priority !== undefined) {
		setClauses.push('priority = ?');
		params.push(updates.priority);
	}
	if (updates.details !== undefined) {
		setClauses.push('details = ?');
		params.push(updates.details);
	}
	if (updates.test_strategy !== undefined) {
		setClauses.push('test_strategy = ?');
		params.push(updates.test_strategy);
	}
	if (updates.effort !== undefined) {
		setClauses.push('effort = ?');
		params.push(updates.effort);
	}
	if (updates.actual_effort !== undefined) {
		setClauses.push('actual_effort = ?');
		params.push(updates.actual_effort);
	}
	if (updates.complexity !== undefined) {
		setClauses.push('complexity = ?');
		params.push(serializeComplexity(updates.complexity));
	}
	if (updates.assignee !== undefined) {
		setClauses.push('assignee = ?');
		params.push(updates.assignee);
	}
	if (updates.expansion_prompt !== undefined) {
		setClauses.push('expansion_prompt = ?');
		params.push(updates.expansion_prompt);
	}
	if (updates.complexity_reasoning !== undefined) {
		setClauses.push('complexity_reasoning = ?');
		params.push(updates.complexity_reasoning);
	}
	if (updates.implementation_approach !== undefined) {
		setClauses.push('implementation_approach = ?');
		params.push(updates.implementation_approach);
	}
	if (updates.recommended_subtasks !== undefined) {
		setClauses.push('recommended_subtasks = ?');
		params.push(updates.recommended_subtasks);
	}

	params.push(taskId, tag);

	const sql = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ? AND tag = ?`;
	db.prepare(sql).run(...params);
}

/**
 * Delete a task and all related data (cascades via foreign keys)
 */
export function deleteTask(db: Database.Database, taskId: string, tag: string): void {
	const stmt = db.prepare('DELETE FROM tasks WHERE id = ? AND tag = ?');
	stmt.run(taskId, tag);
}

/**
 * Get a single task by ID and tag
 */
export function getTask(db: Database.Database, taskId: string, tag: string): TaskRow | undefined {
	const stmt = db.prepare('SELECT * FROM tasks WHERE id = ? AND tag = ?');
	return stmt.get(taskId, tag) as TaskRow | undefined;
}

/**
 * Get all tasks for a tag
 */
export function getTasks(db: Database.Database, tag: string): TaskRow[] {
	const stmt = db.prepare('SELECT * FROM tasks WHERE tag = ? ORDER BY id');
	return stmt.all(tag) as TaskRow[];
}

/**
 * Get tasks by status
 */
export function getTasksByStatus(
	db: Database.Database,
	tag: string,
	status: TaskStatus
): TaskRow[] {
	const stmt = db.prepare('SELECT * FROM tasks WHERE tag = ? AND status = ? ORDER BY id');
	return stmt.all(tag, status) as TaskRow[];
}

// ============================================================================
// Task Dependencies Queries
// ============================================================================

/**
 * Add a dependency between tasks
 */
export function addTaskDependency(
	db: Database.Database,
	taskId: string,
	dependsOnId: string,
	tag: string
): void {
	const stmt = db.prepare(`
		INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id, tag)
		VALUES (?, ?, ?)
	`);
	stmt.run(taskId, dependsOnId, tag);
}

/**
 * Remove a dependency between tasks
 */
export function removeTaskDependency(
	db: Database.Database,
	taskId: string,
	dependsOnId: string,
	tag: string
): void {
	const stmt = db.prepare(
		'DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ? AND tag = ?'
	);
	stmt.run(taskId, dependsOnId, tag);
}

/**
 * Get all dependencies for a task
 */
export function getTaskDependencies(
	db: Database.Database,
	taskId: string,
	tag: string
): string[] {
	const stmt = db.prepare(
		'SELECT depends_on_id FROM task_dependencies WHERE task_id = ? AND tag = ?'
	);
	const rows = stmt.all(taskId, tag) as Array<{ depends_on_id: string }>;
	return rows.map(r => r.depends_on_id);
}

/**
 * Set all dependencies for a task (replaces existing)
 */
export function setTaskDependencies(
	db: Database.Database,
	taskId: string,
	tag: string,
	dependencies: string[]
): void {
	// Remove existing dependencies
	const deleteStmt = db.prepare(
		'DELETE FROM task_dependencies WHERE task_id = ? AND tag = ?'
	);
	deleteStmt.run(taskId, tag);

	// Add new dependencies
	if (dependencies.length > 0) {
		const insertStmt = db.prepare(`
			INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id, tag)
			VALUES (?, ?, ?)
		`);
		for (const depId of dependencies) {
			insertStmt.run(taskId, depId, tag);
		}
	}
}

// ============================================================================
// Task Tags/Labels Queries
// ============================================================================

/**
 * Add a label to a task
 */
export function addTaskLabel(
	db: Database.Database,
	taskId: string,
	labelName: string,
	contextTag: string
): void {
	const stmt = db.prepare(`
		INSERT OR IGNORE INTO task_tags (task_id, tag_name, context_tag)
		VALUES (?, ?, ?)
	`);
	stmt.run(taskId, labelName, contextTag);
}

/**
 * Remove a label from a task
 */
export function removeTaskLabel(
	db: Database.Database,
	taskId: string,
	labelName: string,
	contextTag: string
): void {
	const stmt = db.prepare(
		'DELETE FROM task_tags WHERE task_id = ? AND tag_name = ? AND context_tag = ?'
	);
	stmt.run(taskId, labelName, contextTag);
}

/**
 * Get all labels for a task
 */
export function getTaskLabels(
	db: Database.Database,
	taskId: string,
	contextTag: string
): string[] {
	const stmt = db.prepare(
		'SELECT tag_name FROM task_tags WHERE task_id = ? AND context_tag = ?'
	);
	const rows = stmt.all(taskId, contextTag) as Array<{ tag_name: string }>;
	return rows.map(r => r.tag_name);
}

/**
 * Set all labels for a task (replaces existing)
 */
export function setTaskLabels(
	db: Database.Database,
	taskId: string,
	contextTag: string,
	labels: string[]
): void {
	// Remove existing labels
	const deleteStmt = db.prepare(
		'DELETE FROM task_tags WHERE task_id = ? AND context_tag = ?'
	);
	deleteStmt.run(taskId, contextTag);

	// Add new labels
	if (labels.length > 0) {
		const insertStmt = db.prepare(`
			INSERT OR IGNORE INTO task_tags (task_id, tag_name, context_tag)
			VALUES (?, ?, ?)
		`);
		for (const label of labels) {
			insertStmt.run(taskId, label, contextTag);
		}
	}
}

// ============================================================================
// Subtask Queries
// ============================================================================

/**
 * Insert a new subtask
 */
export function insertSubtask(db: Database.Database, data: SubtaskInsertData, tag: string): void {
	const stmt = db.prepare(`
		INSERT INTO subtasks (
			id, parent_id, tag, title, description, status, priority,
			details, test_strategy, acceptance_criteria, assignee,
			created_at, updated_at
		) VALUES (
			?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?,
			datetime('now'), datetime('now')
		)
	`);

	stmt.run(
		data.id,
		data.parent_id,
		tag,
		data.title,
		data.description,
		data.status,
		data.priority,
		data.details,
		data.test_strategy,
		data.acceptance_criteria ?? null,
		data.assignee ?? null
	);
}

/**
 * Update an existing subtask
 */
export function updateSubtask(
	db: Database.Database,
	subtaskId: number,
	parentId: string,
	tag: string,
	updates: SubtaskUpdateData
): void {
	const setClauses: string[] = ['updated_at = datetime(\'now\')'];
	const params: unknown[] = [];

	if (updates.title !== undefined) {
		setClauses.push('title = ?');
		params.push(updates.title);
	}
	if (updates.description !== undefined) {
		setClauses.push('description = ?');
		params.push(updates.description);
	}
	if (updates.status !== undefined) {
		setClauses.push('status = ?');
		params.push(updates.status);
	}
	if (updates.priority !== undefined) {
		setClauses.push('priority = ?');
		params.push(updates.priority);
	}
	if (updates.details !== undefined) {
		setClauses.push('details = ?');
		params.push(updates.details);
	}
	if (updates.test_strategy !== undefined) {
		setClauses.push('test_strategy = ?');
		params.push(updates.test_strategy);
	}
	if (updates.acceptance_criteria !== undefined) {
		setClauses.push('acceptance_criteria = ?');
		params.push(updates.acceptance_criteria);
	}
	if (updates.assignee !== undefined) {
		setClauses.push('assignee = ?');
		params.push(updates.assignee);
	}

	params.push(subtaskId, parentId, tag);

	const sql = `UPDATE subtasks SET ${setClauses.join(', ')} WHERE id = ? AND parent_id = ? AND tag = ?`;
	db.prepare(sql).run(...params);
}

/**
 * Delete a subtask
 */
export function deleteSubtask(
	db: Database.Database,
	subtaskId: number,
	parentId: string,
	tag: string
): void {
	const stmt = db.prepare('DELETE FROM subtasks WHERE id = ? AND parent_id = ? AND tag = ?');
	stmt.run(subtaskId, parentId, tag);
}

/**
 * Get all subtasks for a parent task
 */
export function getSubtasks(
	db: Database.Database,
	parentId: string,
	tag: string
): SubtaskRow[] {
	const stmt = db.prepare(
		'SELECT * FROM subtasks WHERE parent_id = ? AND tag = ? ORDER BY id'
	);
	return stmt.all(parentId, tag) as SubtaskRow[];
}

/**
 * Get subtask dependencies
 */
export function getSubtaskDependencies(
	db: Database.Database,
	parentId: string,
	subtaskId: number,
	tag: string
): number[] {
	const stmt = db.prepare(`
		SELECT depends_on_subtask_id FROM subtask_dependencies
		WHERE parent_id = ? AND subtask_id = ? AND tag = ?
	`);
	const rows = stmt.all(parentId, subtaskId, tag) as Array<{ depends_on_subtask_id: number }>;
	return rows.map(r => r.depends_on_subtask_id);
}

/**
 * Set subtask dependencies (replaces existing)
 */
export function setSubtaskDependencies(
	db: Database.Database,
	parentId: string,
	subtaskId: number,
	tag: string,
	dependencies: number[]
): void {
	// Remove existing dependencies
	const deleteStmt = db.prepare(
		'DELETE FROM subtask_dependencies WHERE parent_id = ? AND subtask_id = ? AND tag = ?'
	);
	deleteStmt.run(parentId, subtaskId, tag);

	// Add new dependencies
	if (dependencies.length > 0) {
		const insertStmt = db.prepare(`
			INSERT OR IGNORE INTO subtask_dependencies (parent_id, subtask_id, depends_on_subtask_id, tag)
			VALUES (?, ?, ?, ?)
		`);
		for (const depId of dependencies) {
			insertStmt.run(parentId, subtaskId, depId, tag);
		}
	}
}

// ============================================================================
// Task Metadata Queries
// ============================================================================

/**
 * Get task implementation metadata
 */
export function getTaskMetadata(
	db: Database.Database,
	taskId: string,
	tag: string
): TaskMetadataRow | undefined {
	const stmt = db.prepare('SELECT * FROM task_metadata WHERE task_id = ? AND tag = ?');
	return stmt.get(taskId, tag) as TaskMetadataRow | undefined;
}

/**
 * Set task implementation metadata
 */
export function setTaskMetadata(
	db: Database.Database,
	taskId: string,
	tag: string,
	metadata: TaskImplementationMetadata,
	userMetadata?: Record<string, unknown>
): void {
	const stmt = db.prepare(`
		INSERT OR REPLACE INTO task_metadata (
			task_id, tag, relevant_files, codebase_patterns, existing_infrastructure,
			scope_boundaries, technical_constraints, acceptance_criteria, skills,
			category, user_metadata
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);

	stmt.run(
		taskId,
		tag,
		metadata.relevantFiles ? JSON.stringify(metadata.relevantFiles) : null,
		metadata.codebasePatterns ? JSON.stringify(metadata.codebasePatterns) : null,
		metadata.existingInfrastructure ? JSON.stringify(metadata.existingInfrastructure) : null,
		metadata.scopeBoundaries ? JSON.stringify(metadata.scopeBoundaries) : null,
		metadata.technicalConstraints ? JSON.stringify(metadata.technicalConstraints) : null,
		metadata.acceptanceCriteria ? JSON.stringify(metadata.acceptanceCriteria) : null,
		metadata.skills ? JSON.stringify(metadata.skills) : null,
		metadata.category ?? null,
		userMetadata ? JSON.stringify(userMetadata) : null
	);
}

/**
 * Delete task metadata
 */
export function deleteTaskMetadata(db: Database.Database, taskId: string, tag: string): void {
	const stmt = db.prepare('DELETE FROM task_metadata WHERE task_id = ? AND tag = ?');
	stmt.run(taskId, tag);
}

// ============================================================================
// Tag Metadata Queries
// ============================================================================

/**
 * Get tag metadata
 */
export function getTagMetadata(db: Database.Database, tag: string): TagMetadataRow | undefined {
	const stmt = db.prepare('SELECT * FROM tag_metadata WHERE tag = ?');
	return stmt.get(tag) as TagMetadataRow | undefined;
}

/**
 * Set tag metadata
 */
export function setTagMetadata(
	db: Database.Database,
	tag: string,
	metadata: Partial<Omit<TagMetadataRow, 'tag'>>
): void {
	const existing = getTagMetadata(db, tag);

	if (existing) {
		const setClauses: string[] = ['updated_at = datetime(\'now\')'];
		const params: unknown[] = [];

		if (metadata.description !== undefined) {
			setClauses.push('description = ?');
			params.push(metadata.description);
		}
		if (metadata.project_name !== undefined) {
			setClauses.push('project_name = ?');
			params.push(metadata.project_name);
		}
		if (metadata.version !== undefined) {
			setClauses.push('version = ?');
			params.push(metadata.version);
		}

		params.push(tag);

		const sql = `UPDATE tag_metadata SET ${setClauses.join(', ')} WHERE tag = ?`;
		db.prepare(sql).run(...params);
	} else {
		const stmt = db.prepare(`
			INSERT INTO tag_metadata (tag, description, project_name, version, created_at, updated_at)
			VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
		`);
		stmt.run(
			tag,
			metadata.description ?? null,
			metadata.project_name ?? null,
			metadata.version ?? '1.0.0'
		);
	}
}

/**
 * Delete tag metadata
 */
export function deleteTagMetadata(db: Database.Database, tag: string): void {
	const stmt = db.prepare('DELETE FROM tag_metadata WHERE tag = ?');
	stmt.run(tag);
}

/**
 * Get all tags
 */
export function getAllTags(db: Database.Database): string[] {
	const stmt = db.prepare('SELECT DISTINCT tag FROM tasks ORDER BY tag');
	const rows = stmt.all() as Array<{ tag: string }>;
	return rows.map(r => r.tag);
}

// ============================================================================
// Conversion Helpers
// ============================================================================

/**
 * Convert a TaskRow to a Task domain object
 */
export function taskRowToTask(
	row: TaskRow,
	dependencies: string[],
	subtasks: Subtask[],
	labels: string[],
	metadata?: TaskMetadataRow
): Task {
	const task: Task = {
		id: row.id,
		title: row.title,
		description: row.description,
		status: row.status,
		priority: row.priority,
		dependencies,
		details: row.details,
		testStrategy: row.test_strategy,
		subtasks,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		effort: row.effort ?? undefined,
		actualEffort: row.actual_effort ?? undefined,
		complexity: parseComplexity(row.complexity),
		assignee: row.assignee ?? undefined,
		expansionPrompt: row.expansion_prompt ?? undefined,
		complexityReasoning: row.complexity_reasoning ?? undefined,
		implementationApproach: row.implementation_approach ?? undefined,
		recommendedSubtasks: row.recommended_subtasks ?? undefined,
		tags: labels.length > 0 ? labels : undefined
	};

	// Add implementation metadata if present
	if (metadata) {
		if (metadata.relevant_files) {
			task.relevantFiles = JSON.parse(metadata.relevant_files) as RelevantFile[];
		}
		if (metadata.codebase_patterns) {
			task.codebasePatterns = JSON.parse(metadata.codebase_patterns) as string[];
		}
		if (metadata.existing_infrastructure) {
			task.existingInfrastructure = JSON.parse(
				metadata.existing_infrastructure
			) as ExistingInfrastructure[];
		}
		if (metadata.scope_boundaries) {
			task.scopeBoundaries = JSON.parse(metadata.scope_boundaries) as ScopeBoundaries;
		}
		if (metadata.technical_constraints) {
			task.technicalConstraints = JSON.parse(metadata.technical_constraints) as string[];
		}
		if (metadata.acceptance_criteria) {
			task.acceptanceCriteria = JSON.parse(metadata.acceptance_criteria) as string[];
		}
		if (metadata.skills) {
			task.skills = JSON.parse(metadata.skills) as string[];
		}
		if (metadata.category) {
			task.category = metadata.category as Task['category'];
		}
		if (metadata.user_metadata) {
			task.metadata = JSON.parse(metadata.user_metadata) as Record<string, unknown>;
		}
	}

	return task;
}

/**
 * Convert a SubtaskRow to a Subtask domain object
 */
export function subtaskRowToSubtask(row: SubtaskRow, dependencies: number[]): Subtask {
	return {
		id: row.id,
		parentId: row.parent_id,
		title: row.title,
		description: row.description,
		status: row.status,
		priority: row.priority,
		dependencies: dependencies.map(String),
		details: row.details,
		testStrategy: row.test_strategy,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		assignee: row.assignee ?? undefined,
		acceptanceCriteria: row.acceptance_criteria
			? [row.acceptance_criteria]
			: undefined
	};
}

/**
 * Convert a Task domain object to insert data
 */
export function taskToInsertData(task: Task, tag: string): TaskInsertData {
	return {
		id: task.id,
		title: task.title,
		description: task.description,
		status: task.status,
		priority: task.priority,
		details: task.details,
		test_strategy: task.testStrategy,
		tag,
		effort: task.effort,
		actual_effort: task.actualEffort,
		complexity: task.complexity,
		assignee: task.assignee,
		expansion_prompt: task.expansionPrompt,
		complexity_reasoning: task.complexityReasoning,
		implementation_approach: task.implementationApproach,
		recommended_subtasks: task.recommendedSubtasks
	};
}

/**
 * Convert a Subtask domain object to insert data
 */
export function subtaskToInsertData(subtask: Subtask): SubtaskInsertData {
	return {
		id: typeof subtask.id === 'number' ? subtask.id : parseInt(String(subtask.id), 10),
		parent_id: subtask.parentId,
		title: subtask.title,
		description: subtask.description,
		status: subtask.status,
		priority: subtask.priority,
		details: subtask.details,
		test_strategy: subtask.testStrategy,
		acceptance_criteria: subtask.acceptanceCriteria?.join('\n'),
		assignee: subtask.assignee
	};
}

/**
 * Convert TagMetadataRow to TaskMetadata
 */
export function tagMetadataRowToTaskMetadata(
	row: TagMetadataRow | undefined,
	taskCount: number,
	completedCount: number
): TaskMetadata {
	return {
		version: row?.version ?? '1.0.0',
		lastModified: row?.updated_at ?? new Date().toISOString(),
		taskCount,
		completedCount,
		projectName: row?.project_name ?? undefined,
		description: row?.description ?? undefined,
		tags: row ? [row.tag] : undefined,
		created: row?.created_at,
		updated: row?.updated_at
	};
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Load a complete task with all related data
 */
export function loadCompleteTask(
	db: Database.Database,
	taskId: string,
	tag: string
): Task | null {
	const taskRow = getTask(db, taskId, tag);
	if (!taskRow) {
		return null;
	}

	const dependencies = getTaskDependencies(db, taskId, tag);
	const labels = getTaskLabels(db, taskId, tag);
	const subtaskRows = getSubtasks(db, taskId, tag);
	const metadata = getTaskMetadata(db, taskId, tag);

	const subtasks = subtaskRows.map(row => {
		const deps = getSubtaskDependencies(db, taskId, row.id, tag);
		return subtaskRowToSubtask(row, deps);
	});

	return taskRowToTask(taskRow, dependencies, subtasks, labels, metadata);
}

/**
 * Load all tasks for a tag with all related data
 */
export function loadAllTasks(db: Database.Database, tag: string): Task[] {
	const taskRows = getTasks(db, tag);

	return taskRows.map(taskRow => {
		const dependencies = getTaskDependencies(db, taskRow.id, tag);
		const labels = getTaskLabels(db, taskRow.id, tag);
		const subtaskRows = getSubtasks(db, taskRow.id, tag);
		const metadata = getTaskMetadata(db, taskRow.id, tag);

		const subtasks = subtaskRows.map(row => {
			const deps = getSubtaskDependencies(db, taskRow.id, row.id, tag);
			return subtaskRowToSubtask(row, deps);
		});

		return taskRowToTask(taskRow, dependencies, subtasks, labels, metadata);
	});
}

/**
 * Save a complete task with all related data
 */
export function saveCompleteTask(db: Database.Database, task: Task, tag: string): void {
	const insertData = taskToInsertData(task, tag);

	// Insert or update the task
	const existing = getTask(db, task.id, tag);
	if (existing) {
		updateTask(db, task.id, tag, {
			title: task.title,
			description: task.description,
			status: task.status,
			priority: task.priority,
			details: task.details,
			test_strategy: task.testStrategy,
			effort: task.effort,
			actual_effort: task.actualEffort,
			complexity: task.complexity,
			assignee: task.assignee,
			expansion_prompt: task.expansionPrompt,
			complexity_reasoning: task.complexityReasoning,
			implementation_approach: task.implementationApproach,
			recommended_subtasks: task.recommendedSubtasks
		});
	} else {
		insertTask(db, insertData);
	}

	// Set dependencies
	setTaskDependencies(db, task.id, tag, task.dependencies);

	// Set labels
	if (task.tags) {
		setTaskLabels(db, task.id, tag, task.tags);
	}

	// Set metadata if present
	const hasMetadata =
		task.relevantFiles ||
		task.codebasePatterns ||
		task.existingInfrastructure ||
		task.scopeBoundaries ||
		task.technicalConstraints ||
		task.acceptanceCriteria ||
		task.skills ||
		task.category ||
		task.metadata;

	if (hasMetadata) {
		setTaskMetadata(
			db,
			task.id,
			tag,
			{
				relevantFiles: task.relevantFiles,
				codebasePatterns: task.codebasePatterns,
				existingInfrastructure: task.existingInfrastructure,
				scopeBoundaries: task.scopeBoundaries,
				technicalConstraints: task.technicalConstraints,
				acceptanceCriteria: task.acceptanceCriteria,
				skills: task.skills,
				category: task.category
			},
			task.metadata
		);
	}

	// Handle subtasks
	const existingSubtasks = getSubtasks(db, task.id, tag);
	const existingSubtaskIds = new Set(existingSubtasks.map(s => s.id));
	const newSubtaskIds = new Set(
		task.subtasks.map(s => (typeof s.id === 'number' ? s.id : parseInt(String(s.id), 10)))
	);

	// Delete removed subtasks
	for (const existingSub of existingSubtasks) {
		if (!newSubtaskIds.has(existingSub.id)) {
			deleteSubtask(db, existingSub.id, task.id, tag);
		}
	}

	// Insert or update subtasks
	for (const subtask of task.subtasks) {
		const subtaskId = typeof subtask.id === 'number' ? subtask.id : parseInt(String(subtask.id), 10);
		const insertData = subtaskToInsertData(subtask);

		if (existingSubtaskIds.has(subtaskId)) {
			updateSubtask(db, subtaskId, task.id, tag, {
				title: subtask.title,
				description: subtask.description,
				status: subtask.status,
				priority: subtask.priority,
				details: subtask.details,
				test_strategy: subtask.testStrategy,
				acceptance_criteria: subtask.acceptanceCriteria?.join('\n'),
				assignee: subtask.assignee
			});
		} else {
			insertSubtask(db, insertData, tag);
		}

		// Set subtask dependencies
		const deps = subtask.dependencies?.map(d =>
			typeof d === 'number' ? d : parseInt(String(d), 10)
		) ?? [];
		setSubtaskDependencies(db, task.id, subtaskId, tag, deps);
	}
}

/**
 * Delete all tasks for a tag
 */
export function deleteAllTasksForTag(db: Database.Database, tag: string): void {
	const stmt = db.prepare('DELETE FROM tasks WHERE tag = ?');
	stmt.run(tag);
}

/**
 * Copy all tasks from one tag to another
 */
export function copyTasksToTag(
	db: Database.Database,
	sourceTag: string,
	targetTag: string
): void {
	const tasks = loadAllTasks(db, sourceTag);

	for (const task of tasks) {
		saveCompleteTask(db, task, targetTag);
	}
}

/**
 * Get task counts for statistics
 */
export function getTaskCounts(
	db: Database.Database,
	tag: string
): { total: number; completed: number; byStatus: Record<string, number> } {
	const totalStmt = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE tag = ?');
	const total = (totalStmt.get(tag) as { count: number }).count;

	const completedStmt = db.prepare(
		"SELECT COUNT(*) as count FROM tasks WHERE tag = ? AND status IN ('done', 'completed')"
	);
	const completed = (completedStmt.get(tag) as { count: number }).count;

	const byStatusStmt = db.prepare(
		'SELECT status, COUNT(*) as count FROM tasks WHERE tag = ? GROUP BY status'
	);
	const statusRows = byStatusStmt.all(tag) as Array<{ status: string; count: number }>;
	const byStatus: Record<string, number> = {};
	for (const row of statusRows) {
		byStatus[row.status] = row.count;
	}

	return { total, completed, byStatus };
}
