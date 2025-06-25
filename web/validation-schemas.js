/**
 * Task Master API Validation Schemas
 *
 * This module contains all Zod validation schemas used by the REST API endpoints.
 * Organized by category for better maintainability and reusability.
 *
 * Usage:
 * ```javascript
 * import { createTaskSchema, taskIdParamSchema } from "./validation-schemas.js";
 *
 * // Use in validation middleware
 * router.post("/tasks", validateBody(createTaskSchema), handler);
 * router.get("/tasks/:id", validateParams(taskIdParamSchema), handler);
 * ```
 *
 * Categories:
 * - Common Base Schemas: Reusable building blocks
 * - Query Parameter Schemas: For URL query string validation
 * - Request Body Schemas: For POST/PUT/PATCH request body validation
 * - Path Parameter Schemas: For URL path parameter validation
 */

import { z } from 'zod';

// ===== COMMON BASE SCHEMAS =====

export const projectRootSchema = z
	.string()
	.describe('The directory of the project. Must be an absolute path.');

export const taskIdSchema = z
	.string()
	.describe("Task ID (e.g., '15' or '15.2' for subtasks)");

export const taskIdsSchema = z
	.string()
	.describe("Comma-separated task IDs (e.g., '1,3,5' or '1.2,3.4')");

export const tagSchema = z
	.string()
	.optional()
	.describe('Tag context to operate on');

export const filePathSchema = z
	.string()
	.optional()
	.describe('Path to the tasks file');

export const prioritySchema = z
	.enum(['high', 'medium', 'low'])
	.optional()
	.describe('Task priority');

export const statusSchema = z
	.enum(['pending', 'in-progress', 'done', 'cancelled', 'deferred', 'blocked'])
	.describe('Task status');

export const dependenciesSchema = z
	.array(z.string())
	.optional()
	.describe('Array of task IDs this task depends on');

// ===== QUERY PARAMETER SCHEMAS =====

export const listTasksQuerySchema = z.object({
	status: z.string().optional().describe('Filter tasks by status'),
	withSubtasks: z
		.string()
		.optional()
		.transform((val) => val === 'true')
		.describe('Include subtasks'),
	tag: tagSchema
});

export const showTaskQuerySchema = z.object({
	tag: tagSchema
});

export const complexityReportQuerySchema = z.object({
	tag: tagSchema,
	file: filePathSchema
});

export const validateDependenciesQuerySchema = z.object({
	tag: tagSchema
});

export const deleteTaskQuerySchema = z.object({
	tag: tagSchema
});

export const removeSubtaskQuerySchema = z.object({
	convert: z
		.string()
		.optional()
		.transform((val) => val === 'true')
		.describe('Convert to standalone task'),
	tag: tagSchema
});

export const clearSubtasksQuerySchema = z.object({
	tag: tagSchema
});

export const listTagsQuerySchema = z.object({
	showMetadata: z
		.string()
		.optional()
		.transform((val) => val === 'true')
		.describe('Include detailed metadata')
});

export const deleteTagQuerySchema = z.object({
	force: z
		.string()
		.optional()
		.transform((val) => val === 'true')
		.describe('Force delete without confirmation')
});

// ===== REQUEST BODY SCHEMAS =====

export const createTaskSchema = z
	.object({
		prompt: z.string().optional().describe('Description of the task to add'),
		title: z
			.string()
			.optional()
			.describe('Task title (for manual task creation)'),
		description: z.string().optional().describe('Task description'),
		details: z.string().optional().describe('Implementation details'),
		testStrategy: z.string().optional().describe('Test strategy'),
		dependencies: dependenciesSchema,
		priority: prioritySchema,
		research: z.boolean().optional().describe('Use research capabilities'),
		tag: tagSchema
	})
	.refine((data) => data.prompt || data.title, {
		message: "Either 'prompt' or 'title' is required"
	});

export const updateTaskSchema = z.object({
	prompt: z.string().describe('New information or context to incorporate'),
	useResearch: z.boolean().optional().describe('Use research-backed updates'),
	append: z
		.boolean()
		.optional()
		.describe('Append timestamped information instead of full update'),
	tag: tagSchema
});

export const bulkUpdateTasksSchema = z.object({
	from: z.string().describe('Starting task ID for bulk update'),
	prompt: z.string().describe('Update context to apply'),
	useResearch: z.boolean().optional().describe('Use research-backed updates'),
	tag: tagSchema
});

export const setTaskStatusSchema = z.object({
	status: statusSchema,
	tag: tagSchema
});

export const createSubtaskSchema = z.object({
	title: z.string().describe('Subtask title'),
	description: z.string().optional().describe('Subtask description'),
	details: z.string().optional().describe('Implementation details'),
	status: statusSchema.optional().default('pending'),
	dependencies: dependenciesSchema,
	tag: tagSchema
});

export const updateSubtaskSchema = z.object({
	prompt: z.string().describe('Information to append to subtask'),
	useResearch: z.boolean().optional().describe('Use research-backed updates'),
	tag: tagSchema
});

export const expandTaskSchema = z.object({
	num: z.number().optional().describe('Number of subtasks to generate'),
	useResearch: z.boolean().optional().describe('Use research for expansion'),
	prompt: z.string().optional().describe('Additional context for expansion'),
	force: z
		.boolean()
		.optional()
		.describe('Clear existing subtasks before expanding'),
	tag: tagSchema
});

export const expandAllTasksSchema = z.object({
	num: z.number().optional().describe('Number of subtasks per task'),
	useResearch: z.boolean().optional().describe('Use research for expansion'),
	prompt: z.string().optional().describe('Additional context for expansion'),
	force: z
		.boolean()
		.optional()
		.describe('Clear existing subtasks before expanding'),
	tag: tagSchema
});

export const addDependencySchema = z.object({
	dependsOn: z.string().describe('ID of the task that must be completed first'),
	tag: tagSchema
});

export const fixDependenciesSchema = z.object({
	tag: tagSchema
});

export const moveTaskSchema = z.object({
	tag: tagSchema
});

export const moveBatchTasksSchema = z.object({
	from: z
		.union([z.array(z.string()), z.string()])
		.describe('Array or comma-separated string of source task IDs'),
	to: z
		.union([z.array(z.string()), z.string()])
		.describe('Array or comma-separated string of destination task IDs'),
	tag: tagSchema
});

export const createTagSchema = z
	.object({
		tagName: z.string().optional().describe('Name of the new tag'),
		description: z.string().optional().describe('Tag description'),
		copyFromCurrent: z
			.boolean()
			.optional()
			.describe('Copy tasks from current tag'),
		copyFrom: z.string().optional().describe('Specific tag to copy from'),
		fromBranch: z
			.boolean()
			.optional()
			.describe('Create tag name from git branch')
	})
	.refine((data) => data.tagName || data.fromBranch, {
		message: "Either 'tagName' or 'fromBranch' must be specified"
	});

export const copyTagSchema = z.object({
	description: z.string().optional().describe('Description for the copied tag')
});

export const analyzeComplexitySchema = z.object({
	output: z.string().optional().describe('Output file path for report'),
	threshold: z
		.number()
		.optional()
		.describe('Minimum complexity score threshold'),
	useResearch: z.boolean().optional().describe('Use research for analysis'),
	tag: tagSchema
});

export const researchSchema = z.object({
	query: z.string().describe('Research query/prompt'),
	taskIds: z
		.string()
		.optional()
		.describe('Comma-separated task IDs for context'),
	filePaths: z
		.string()
		.optional()
		.describe('Comma-separated file paths for context'),
	customContext: z.string().optional().describe('Additional custom context'),
	includeProjectTree: z
		.boolean()
		.optional()
		.describe('Include project file tree'),
	detailLevel: z
		.enum(['low', 'medium', 'high'])
		.optional()
		.describe('Detail level'),
	saveTo: z.string().optional().describe('Task/subtask ID to save results to'),
	saveFile: z.boolean().optional().describe('Save to file in docs/research/'),
	tag: tagSchema
});

export const parsePrdSchema = z.object({
	input: z.string().describe('Path to PRD file'),
	output: z.string().optional().describe('Output path for tasks.json'),
	numTasks: z.number().optional().describe('Number of tasks to generate'),
	force: z.boolean().optional().describe('Overwrite existing tasks.json'),
	tag: tagSchema
});

export const generateFilesSchema = z.object({
	outputDir: z.string().optional().describe('Output directory for task files'),
	tag: tagSchema
});

// ===== PATH PARAMETER SCHEMAS =====

export const taskIdParamSchema = z.object({
	id: taskIdSchema
});

export const taskIdsParamSchema = z.object({
	ids: taskIdsSchema
});

export const parentSubtaskParamSchema = z.object({
	parentId: taskIdSchema.describe('Parent task ID'),
	subtaskId: taskIdSchema.describe('Subtask ID')
});

export const moveTaskParamSchema = z.object({
	fromId: taskIdSchema.describe('Source task ID'),
	toId: taskIdSchema.describe('Destination task ID')
});

export const tagNameParamSchema = z.object({
	tagName: z.string().describe('Tag name')
});

export const renameTagParamSchema = z.object({
	oldName: z.string().describe('Current tag name'),
	newName: z.string().describe('New tag name')
});

export const copyTagParamSchema = z.object({
	sourceName: z.string().describe('Source tag name'),
	targetName: z.string().describe('Target tag name')
});

export const dependencyParamSchema = z.object({
	id: taskIdSchema,
	dependencyId: taskIdSchema.describe('Dependency task ID to remove')
});
