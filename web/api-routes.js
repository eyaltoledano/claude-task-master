/**
 * Task Master REST API Routes
 *
 * This module provides REST API endpoints that serve as thin adapters
 * to the existing task-manager core functionality.
 *
 * COMPLETE API REFERENCE:
 *
 * === HEALTH & STATUS ===
 * GET    /api/health                          - Health check endpoint
 *
 * === CORE TASK OPERATIONS ===
 * GET    /api/tasks                           - List all tasks (task-master list)
 * GET    /api/tasks/next                      - Get next available task (task-master next)
 * GET    /api/tasks/:ids                      - Show specific task(s) by ID - supports comma-separated IDs (task-master show)
 * POST   /api/tasks                           - Create new task (task-master add-task)
 * PUT    /api/tasks/:id                       - Update specific task (task-master update-task)
 * PUT    /api/tasks/bulk-update               - Update multiple tasks from starting ID (task-master update)
 * PATCH  /api/tasks/:id/status                - Set task status (task-master set-status)
 * DELETE /api/tasks/:id                       - Delete task (task-master remove-task)
 *
 * === SUBTASK OPERATIONS ===
 * POST   /api/tasks/:id/subtasks              - Add subtask to task (task-master add-subtask)
 * PUT    /api/tasks/:parentId/subtasks/:subtaskId - Update subtask (task-master update-subtask)
 * DELETE /api/tasks/:parentId/subtasks/:subtaskId - Remove subtask (task-master remove-subtask)
 *
 * === TASK EXPANSION & MANAGEMENT ===
 * POST   /api/tasks/:id/expand                - Expand specific task with subtasks (task-master expand --id)
 * POST   /api/tasks/expand-all                - Expand all eligible tasks (task-master expand --all)
 * DELETE /api/tasks/:id/subtasks              - Clear subtasks from specific task (task-master clear-subtasks --id)
 * DELETE /api/tasks/subtasks                  - Clear all subtasks from all tasks (task-master clear-subtasks --all)
 *
 * === DEPENDENCY MANAGEMENT ===
 * POST   /api/tasks/:id/dependencies          - Add dependency (task-master add-dependency)
 * DELETE /api/tasks/:id/dependencies/:depId   - Remove dependency (task-master remove-dependency)
 * GET    /api/tasks/dependencies/validate     - Validate dependencies (task-master validate-dependencies)
 * POST   /api/tasks/dependencies/fix          - Fix dependency issues (task-master fix-dependencies)
 *
 * === TASK MOVEMENT ===
 * PUT    /api/tasks/:fromId/move/:toId        - Move single task (task-master move)
 * PUT    /api/tasks/move-batch                - Move multiple tasks (task-master move with multiple IDs)
 *
 * === TAG MANAGEMENT ===
 * GET    /api/tags                            - List all tags (task-master tags)
 * POST   /api/tags                            - Create new tag (task-master add-tag)
 * DELETE /api/tags/:tagName                   - Delete tag (task-master delete-tag)
 * PUT    /api/tags/:oldName/rename/:newName   - Rename tag (task-master rename-tag)
 * POST   /api/tags/:source/copy/:target       - Copy tag (task-master copy-tag)
 * PUT    /api/tags/use/:tagName               - Switch to tag (task-master use-tag)
 *
 * === ANALYSIS & RESEARCH ===
 * POST   /api/analysis/complexity             - Analyze task complexity (task-master analyze-complexity)
 * GET    /api/analysis/complexity-report      - Get complexity report (task-master complexity-report)
 * POST   /api/research                        - Perform research query (task-master research)
 *
 * === PROJECT SETUP ===
 * POST   /api/parse-prd                       - Parse PRD and generate tasks (task-master parse-prd)
 * POST   /api/tasks/generate-files            - Generate task files (task-master generate)
 *
 * === FEATURES ===
 * - Complete coverage of Task Master CLI functionality
 * - Multi-ID support (comma-separated IDs like "1,3,5" or "1.2,3.4")
 * - Full CRUD operations for tasks and subtasks
 * - Bulk operations support
 * - Research-backed operations
 * - Tag context support throughout
 * - Proper REST conventions and error handling
 * - Appropriate HTTP status codes
 * - JSON request/response format
 * - Comprehensive Zod validation on all endpoints
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Import robustness middleware
import {
	errorRecoveryMiddleware,
	initializeErrorRecovery
} from './middleware/error-recovery.js';
import { getHealthMonitor } from './middleware/health-monitor.js';
import {
	tagValidationMiddleware,
	ensureTagExists,
	validateTagOperation
} from './middleware/tag-validation.js';

// Import validation schemas
import {
	// Query parameter schemas
	listTasksQuerySchema,
	showTaskQuerySchema,
	complexityReportQuerySchema,
	validateDependenciesQuerySchema,
	deleteTaskQuerySchema,
	removeSubtaskQuerySchema,
	clearSubtasksQuerySchema,
	listTagsQuerySchema,
	deleteTagQuerySchema,
	// Request body schemas
	createTaskSchema,
	updateTaskSchema,
	bulkUpdateTasksSchema,
	setTaskStatusSchema,
	createSubtaskSchema,
	updateSubtaskSchema,
	expandTaskSchema,
	expandAllTasksSchema,
	addDependencySchema,
	fixDependenciesSchema,
	moveTaskSchema,
	moveBatchTasksSchema,
	createTagSchema,
	copyTagSchema,
	analyzeComplexitySchema,
	researchSchema,
	parsePrdSchema,
	generateFilesSchema,
	// Path parameter schemas
	taskIdParamSchema,
	taskIdsParamSchema,
	parentSubtaskParamSchema,
	moveTaskParamSchema,
	tagNameParamSchema,
	renameTagParamSchema,
	copyTagParamSchema,
	dependencyParamSchema
} from './validation-schemas.js';

// Import existing task-manager modules
import listTasks from '../scripts/modules/task-manager/list-tasks.js';
import addTask from '../scripts/modules/task-manager/add-task.js';
import updateTaskById from '../scripts/modules/task-manager/update-task-by-id.js';
import removeTask from '../scripts/modules/task-manager/remove-task.js';
import addSubtask from '../scripts/modules/task-manager/add-subtask.js';
import removeSubtask from '../scripts/modules/task-manager/remove-subtask.js';
import updateSubtaskById from '../scripts/modules/task-manager/update-subtask-by-id.js';
import setTaskStatus from '../scripts/modules/task-manager/set-task-status.js';
import expandTask from '../scripts/modules/task-manager/expand-task.js';
import expandAllTasks from '../scripts/modules/task-manager/expand-all-tasks.js';
import clearSubtasks from '../scripts/modules/task-manager/clear-subtasks.js';
import generateTaskFiles from '../scripts/modules/task-manager/generate-task-files.js';
import findNextTask from '../scripts/modules/task-manager/find-next-task.js';
import updateTasks from '../scripts/modules/task-manager/update-tasks.js';
import moveTask from '../scripts/modules/task-manager/move-task.js';
import analyzeTaskComplexity from '../scripts/modules/task-manager/analyze-task-complexity.js';
import { performResearch } from '../scripts/modules/task-manager/research.js';
import parsePrd from '../scripts/modules/task-manager/parse-prd.js';
import {
	createTag,
	deleteTag,
	tags,
	useTag,
	renameTag,
	copyTag
} from '../scripts/modules/task-manager/tag-management.js';
import {
	addDependency,
	removeDependency,
	validateDependenciesCommand,
	fixDependenciesCommand
} from '../scripts/modules/dependency-manager.js';
import {
	findProjectRoot,
	readJSON,
	readComplexityReport,
	getCurrentTag,
	findTaskById,
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../scripts/modules/utils.js';
import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { ensureTaskMasterDirectoryStructure } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== VALIDATION MIDDLEWARE =====

/**
 * Create validation middleware for request body
 */
function validateBody(schema) {
	return (req, res, next) => {
		try {
			const result = schema.safeParse(req.body);
			if (!result.success) {
				return res.status(400).json({
					error: 'Validation Error',
					message: 'Invalid request body',
					details: result.error.errors.map((err) => ({
						field: err.path.join('.'),
						message: err.message,
						received: err.received
					}))
				});
			}
			req.validatedBody = result.data;
			next();
		} catch (error) {
			return res.status(400).json({
				error: 'Validation Error',
				message: 'Failed to validate request body',
				details: error.message
			});
		}
	};
}

/**
 * Create validation middleware for query parameters
 */
function validateQuery(schema) {
	return (req, res, next) => {
		try {
			const result = schema.safeParse(req.query);
			if (!result.success) {
				return res.status(400).json({
					error: 'Validation Error',
					message: 'Invalid query parameters',
					details: result.error.errors.map((err) => ({
						field: err.path.join('.'),
						message: err.message,
						received: err.received
					}))
				});
			}
			req.validatedQuery = result.data;
			next();
		} catch (error) {
			return res.status(400).json({
				error: 'Validation Error',
				message: 'Failed to validate query parameters',
				details: error.message
			});
		}
	};
}

/**
 * Create validation middleware for path parameters
 */
function validateParams(schema) {
	return (req, res, next) => {
		try {
			const result = schema.safeParse(req.params);
			if (!result.success) {
				return res.status(400).json({
					error: 'Validation Error',
					message: 'Invalid path parameters',
					details: result.error.errors.map((err) => ({
						field: err.path.join('.'),
						message: err.message,
						received: err.received
					}))
				});
			}
			req.validatedParams = result.data;
			next();
		} catch (error) {
			return res.status(400).json({
				error: 'Validation Error',
				message: 'Failed to validate path parameters',
				details: error.message
			});
		}
	};
}

// ===== HELPER FUNCTIONS =====

/**
 * Helper function to create API response with optional telemetry data
 */
function createApiResponse(data, telemetryData = null) {
	const response = { ...data };
	if (telemetryData) {
		response.telemetryData = telemetryData;
	}
	return response;
}

/**
 * Create API context object for task-manager functions
 * @param {Object} req - Express request object
 * @param {string} commandName - Name of the command being executed
 * @returns {Object} - Context object for task-manager functions
 */
function createApiContext(req, commandName) {
	const projectRoot =
		req.app.get('projectRoot') || findProjectRoot() || process.cwd();

	// Create a proper logger wrapper for API context (similar to MCP server)
	const apiLogger = {
		info: (msg) => console.log(`[INFO] ${msg}`),
		warn: (msg) => console.warn(`[WARN] ${msg}`),
		error: (msg) => console.error(`[ERROR] ${msg}`),
		debug: (msg) => process.env.DEBUG && console.log(`[DEBUG] ${msg}`),
		success: (msg) => console.log(`[SUCCESS] ${msg}`)
	};

	return {
		projectRoot,
		commandName,
		outputType: 'api',
		mcpLog: apiLogger, // Proper logger wrapper like MCP server
		tag: req.effectiveTag // Include tag for compatibility with core functions
	};
}

/**
 * Development-friendly error handler
 * Provides detailed error information for debugging
 */
function handleApiError(error, operation, res) {
	console.error(`Error in ${operation}:`, error);

	// Handle specific error types with helpful messages
	if (error.code === 'ENOENT') {
		return res.status(404).json({
			error: 'File not found',
			message: error.message,
			operation,
			stack: error.stack // Include stack trace for development
		});
	}

	if (
		error.message.includes('not found') ||
		error.message.includes('does not exist')
	) {
		return res.status(404).json({
			error: 'Resource not found',
			message: error.message,
			operation
		});
	}

	if (error.message.includes('circular')) {
		return res.status(400).json({
			error: 'Circular dependency detected',
			message: error.message,
			operation,
			hint: 'Check your task dependencies for loops'
		});
	}

	if (error.message.includes('already exists')) {
		return res.status(409).json({
			error: 'Resource conflict',
			message: error.message,
			operation
		});
	}

	// Default server error with full details for development
	res.status(500).json({
		error: `Failed to ${operation}`,
		message: error.message,
		operation,
		stack: error.stack // Include stack trace for development debugging
	});
}

/**
 * Helper function to get specific task(s) by ID (async version for better performance)
 * Uses the same tag resolution system as CLI and MCP
 */
async function getTasksById(tasksPath, ids, effectiveTag, projectRoot) {
	try {
		// Use readJSON with tag resolution like CLI/MCP do
		const data = readJSON(tasksPath, projectRoot, effectiveTag);
		const tasks = data?.tasks || [];

		const idArray = Array.isArray(ids)
			? ids
			: ids.split(',').map((id) => id.trim());
		const result = [];

		for (const id of idArray) {
			// Use the existing findTaskById utility function for consistent behavior
			const { task } = findTaskById(tasks, id);

			if (task) {
				// For subtasks, add the composite ID and isSubtask flag
				if (id.includes('.')) {
					result.push({
						...task,
						id: id, // Keep the composite ID (e.g., "1.2")
						isSubtask: true
					});
				} else {
					result.push(task);
				}
			}
		}

		return result;
	} catch (error) {
		throw new Error(
			`Failed to read tasks from tag '${effectiveTag}': ${error.message}`
		);
	}
}

/**
 * Create Express router with API routes
 * @param {string} projectRoot - Project root directory path
 * @returns {express.Router} Configured Express router
 */
export function createApiRouter(projectRoot) {
	const router = express.Router();

	// Initialize error recovery system
	initializeErrorRecovery();

	// Store project root in router for use in route handlers
	router.use((req, res, next) => {
		req.app.set('projectRoot', projectRoot);
		next();
	});

	// Apply robustness middleware in the correct order
	router.use(errorRecoveryMiddleware(projectRoot));

	// Development logging middleware with correlation ID
	router.use((req, res, next) => {
		const start = Date.now();
		const correlationId =
			req.correlationId ||
			`req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		req.correlationId = correlationId;

		console.log(`🌐 [${correlationId}] API Request: ${req.method} ${req.path}`);

		// Log request body for POST/PUT/PATCH requests (helpful for development)
		if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
			console.log(
				`📝 [${correlationId}] Request body:`,
				JSON.stringify(req.body, null, 2)
			);
		}

		res.on('finish', () => {
			const duration = Date.now() - start;
			const statusIcon = res.statusCode >= 400 ? '❌' : '✅';
			console.log(
				`${statusIcon} [${correlationId}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
			);
		});

		next();
	});

	// Middleware to attach projectRoot and construct tasks file path
	router.use((req, res, next) => {
		req.projectRoot = projectRoot;
		// Use standard .taskmaster directory for all operations
		req.tasksPath = path.join(
			projectRoot,
			'.taskmaster',
			'tasks',
			'tasks.json'
		);

		next();
	});

	// Enhanced tag resolution middleware with validation and recovery
	router.use(tagValidationMiddleware());

	// GET /api/health - Enhanced health check endpoint
	router.get('/health', async (req, res) => {
		try {
			// Get health status from health monitor
			const healthMonitor = getHealthMonitor();
			const healthStatus = healthMonitor
				? healthMonitor.getHealthStatus()
				: null;

			const response = {
				status: healthStatus ? healthStatus.status.toLowerCase() : 'ok',
				message: 'Task Master Web API is running',
				timestamp: new Date().toISOString(),
				version: process.env.npm_package_version || '1.0.0',
				correlationId: req.correlationId
			};

			// Add health data if monitor is available
			if (healthStatus) {
				response.health = {
					overall: healthStatus.status,
					metrics: healthStatus.metrics,
					issues: healthStatus.currentIssues,
					lastCheck: healthStatus.lastCheck
				};
			}

			// Return appropriate HTTP status based on health
			const statusCode =
				healthStatus && healthStatus.status === 'CRITICAL' ? 503 : 200;

			res.status(statusCode).json(response);
		} catch (error) {
			console.error(`[${req.correlationId}] Health check failed:`, error);
			res.status(500).json({
				status: 'error',
				message: 'Health check failed',
				timestamp: new Date().toISOString(),
				error: error.message,
				correlationId: req.correlationId
			});
		}
	});

	// GET /api - API documentation endpoint for development
	router.get('/', (req, res) => {
		res.json({
			name: 'Task Master Development API',
			version: '1.0.0',
			description:
				'REST API for Task Master CLI functionality - Development Mode',
			documentation: {
				'Core Operations': {
					'GET /api/tasks': 'List all tasks',
					'GET /api/tasks/next': 'Get next available task',
					'GET /api/tasks/:ids': 'Show specific task(s) by ID',
					'POST /api/tasks': 'Create new task',
					'PUT /api/tasks/:id': 'Update task',
					'PATCH /api/tasks/:id/status': 'Set task status',
					'DELETE /api/tasks/:id': 'Delete task'
				},
				Subtasks: {
					'POST /api/tasks/:id/subtasks': 'Add subtask',
					'PUT /api/tasks/:parentId/subtasks/:subtaskId': 'Update subtask',
					'DELETE /api/tasks/:parentId/subtasks/:subtaskId': 'Remove subtask'
				},
				'AI Operations': {
					'POST /api/tasks/:id/expand': 'Expand task with AI',
					'POST /api/research': 'Perform AI research',
					'POST /api/analysis/complexity': 'Analyze task complexity'
				},
				Tags: {
					'GET /api/tags': 'List tags',
					'POST /api/tags': 'Create tag',
					'PUT /api/tags/use/:tagName': 'Switch to tag'
				}
			},
			features: [
				'Full telemetry integration for AI operations',
				'Development-friendly error messages with stack traces',
				'Request/response logging',
				'Comprehensive input validation'
			],
			environment: 'development',
			projectRoot: req.projectRoot
		});
	});

	// GET /api/tasks - List all tasks
	router.get(
		'/tasks',
		validateQuery(listTasksQuerySchema),
		async (req, res) => {
			try {
				const { status, withSubtasks } = req.validatedQuery;

				// Call existing listTasks function with JSON output format
				const result = listTasks(
					req.tasksPath,
					status || null,
					null, // reportPath
					withSubtasks,
					'json', // outputFormat
					req.effectiveTag,
					{ projectRoot: req.projectRoot }
				);

				// Enhance response with tag context information
				const enhancedResult = {
					...result,
					tagContext: {
						effectiveTag: req.effectiveTag,
						explicitTag: req.explicitTag,
						tagSource: req.explicitTag ? 'explicit' : 'current'
					}
				};

				res.json(enhancedResult);
			} catch (error) {
				console.error('Error listing tasks:', error);
				res.status(500).json({
					error: 'Failed to list tasks',
					message: error.message,
					tagContext: {
						effectiveTag: req.effectiveTag,
						explicitTag: req.explicitTag,
						tagSource: req.explicitTag ? 'explicit' : 'current'
					}
				});
			}
		}
	);

	// GET /api/tasks/next - Get next available task
	router.get(
		'/tasks/next',
		validateQuery(showTaskQuerySchema),
		async (req, res) => {
			try {
				// Read tasks data using the same pattern as MCP server with effective tag
				const data = readJSON(req.tasksPath, req.projectRoot, req.effectiveTag);
				if (!data || !data.tasks) {
					return res.status(404).json({
						error: 'No tasks found',
						message: `No valid tasks found in tag '${req.effectiveTag}' at ${req.tasksPath}`,
						tagContext: {
							effectiveTag: req.effectiveTag,
							explicitTag: req.explicitTag,
							tagSource: req.explicitTag ? 'explicit' : 'current'
						}
					});
				}

				// Use tasks from the resolved tag context
				const tasks = data.tasks;

				// Read the complexity report (if it exists)
				const taskMasterDir = '.taskmaster';
				const complexityReportPath = path.join(
					req.projectRoot,
					taskMasterDir,
					'reports',
					req.effectiveTag !== 'master'
						? `task-complexity-report_${req.effectiveTag}.json`
						: 'task-complexity-report.json'
				);
				const complexityReport = readComplexityReport(complexityReportPath);

				// Find the next task using the same pattern as MCP server
				const nextTask = findNextTask(tasks, complexityReport);

				if (!nextTask) {
					return res.json({
						message:
							'No eligible next task found. All tasks are either completed or have unsatisfied dependencies',
						nextTask: null,
						tagContext: {
							effectiveTag: req.effectiveTag,
							explicitTag: req.explicitTag,
							tagSource: req.explicitTag ? 'explicit' : 'current'
						}
					});
				}

				// Check if it's a subtask (same logic as MCP server)
				const isSubtask =
					typeof nextTask.id === 'string' && nextTask.id.includes('.');

				res.json({
					nextTask,
					isSubtask,
					message: `Found next ${isSubtask ? 'subtask' : 'task'}: ${nextTask.title}`,
					tagContext: {
						effectiveTag: req.effectiveTag,
						explicitTag: req.explicitTag,
						tagSource: req.explicitTag ? 'explicit' : 'current'
					}
				});
			} catch (error) {
				console.error('Error finding next task:', error);
				res.status(500).json({
					error: 'Failed to find next task',
					message: error.message,
					tagContext: {
						effectiveTag: req.effectiveTag,
						explicitTag: req.explicitTag,
						tagSource: req.explicitTag ? 'explicit' : 'current'
					}
				});
			}
		}
	);

	// GET /api/tasks/:ids - Show specific task(s) by ID
	router.get(
		'/tasks/:ids',
		validateParams(taskIdsParamSchema),
		validateQuery(showTaskQuerySchema),
		async (req, res) => {
			try {
				const { ids } = req.validatedParams;

				const tasks = await getTasksById(
					req.tasksPath,
					ids,
					req.effectiveTag,
					req.projectRoot
				);

				if (tasks.length === 0) {
					return res.status(404).json({
						error: 'Tasks not found',
						message: `No tasks found with the specified IDs in tag '${req.effectiveTag}'`,
						tagContext: {
							effectiveTag: req.effectiveTag,
							explicitTag: req.explicitTag,
							tagSource: req.explicitTag ? 'explicit' : 'current'
						}
					});
				}

				// Return single task or array based on request
				const idArray = ids.split(',').map((id) => id.trim());
				const responseData = idArray.length === 1 ? tasks[0] : tasks;

				// Enhance response with tag context
				const enhancedResponse = {
					...(Array.isArray(responseData)
						? { tasks: responseData }
						: responseData),
					tagContext: {
						effectiveTag: req.effectiveTag,
						explicitTag: req.explicitTag,
						tagSource: req.explicitTag ? 'explicit' : 'current'
					}
				};

				res.json(enhancedResponse);
			} catch (error) {
				handleApiError(error, 'get tasks', res);
			}
		}
	);

	// POST /api/tasks - Create new task
	router.post('/tasks', validateBody(createTaskSchema), async (req, res) => {
		let wasSilent;

		// Move destructuring outside try block to ensure variables are accessible throughout
		const {
			prompt,
			title,
			description,
			details,
			testStrategy,
			dependencies = [],
			priority = 'medium',
			research = false
		} = req.validatedBody;

		try {
			// Enable silent mode if using AI (prompt-based task creation)
			if (prompt) {
				wasSilent = isSilentMode();
				if (!wasSilent) enableSilentMode();
			}

			// Create context object for the addTask function
			const context = createApiContext(req, 'api_create_task');

			// Prepare manual task data if using title instead of prompt
			const manualTaskData = title
				? {
						title,
						description: description || '',
						details: details || '',
						testStrategy: testStrategy || ''
					}
				: null;

			// Call existing addTask function
			const result = await addTask(
				req.tasksPath,
				prompt || null,
				dependencies,
				priority,
				context,
				'json', // outputFormat
				manualTaskData,
				research,
				req.effectiveTag
			);

			// Restore normal logging if we enabled silent mode
			if (prompt && !wasSilent && isSilentMode()) disableSilentMode();

			res.status(201).json(
				createApiResponse(
					{
						success: true,
						taskId: result.newTaskId,
						message: 'Task created successfully'
					},
					result.telemetryData
				)
			);
		} catch (error) {
			// Ensure silent mode is restored even on error
			if (prompt && !wasSilent && isSilentMode()) disableSilentMode();

			handleApiError(error, 'create task', res);
		}
	});

	// PUT /api/tasks/bulk-update - Update multiple tasks from a starting ID
	router.put(
		'/tasks/bulk-update',
		validateBody(bulkUpdateTasksSchema),
		async (req, res) => {
			let wasSilent;
			try {
				const { from, prompt, useResearch = false } = req.validatedBody;

				// Enable silent mode to prevent console logs from interfering with daemon mode
				wasSilent = isSilentMode();
				if (!wasSilent) enableSilentMode();

				// Create context object for the updateTasks function
				const context = createApiContext(req, 'api_bulk_update_tasks');

				// Call existing updateTasks function
				const result = await updateTasks(
					req.tasksPath,
					from,
					prompt,
					useResearch,
					context,
					'json', // outputFormat
					req.effectiveTag
				);

				// Restore normal logging
				if (!wasSilent && isSilentMode()) disableSilentMode();

				res.json({
					success: true,
					message: 'Tasks updated successfully',
					updatedCount: result.updatedCount || 0
				});
			} catch (error) {
				// Ensure silent mode is restored even on error
				if (!wasSilent && isSilentMode()) disableSilentMode();

				console.error('Error bulk updating tasks:', error);
				res.status(500).json({
					error: 'Failed to bulk update tasks',
					message: error.message
				});
			}
		}
	);

	// PUT /api/tasks/move-batch - Move multiple tasks (must be before /tasks/:id)
	router.put(
		'/tasks/move-batch',
		validateBody(moveBatchTasksSchema),
		async (req, res) => {
			try {
				const { from, to } = req.validatedBody;

				const fromArray = Array.isArray(from)
					? from
					: from.split(',').map((id) => id.trim());
				const toArray = Array.isArray(to)
					? to
					: to.split(',').map((id) => id.trim());

				if (fromArray.length !== toArray.length) {
					return res.status(400).json({
						error: 'Bad Request',
						message: 'From and to arrays must have the same length'
					});
				}

				// Create context object for the moveTask function
				const context = createApiContext(req, 'api_move_batch_tasks');

				const results = [];
				for (let i = 0; i < fromArray.length; i++) {
					try {
						await moveTask(
							req.tasksPath,
							fromArray[i],
							toArray[i],
							false,
							context
						);
						results.push({ from: fromArray[i], to: toArray[i], success: true });
					} catch (error) {
						results.push({
							from: fromArray[i],
							to: toArray[i],
							success: false,
							error: error.message
						});
					}
				}

				const successCount = results.filter((r) => r.success).length;

				res.json({
					success: successCount > 0,
					message: `${successCount}/${results.length} tasks moved successfully`,
					results: results,
					successCount: successCount,
					totalCount: results.length
				});
			} catch (error) {
				console.error('Error in batch move:', error);
				res.status(500).json({
					error: 'Failed to move tasks',
					message: error.message
				});
			}
		}
	);

	// PUT /api/tasks/:id - Update task
	router.put(
		'/tasks/:id',
		validateParams(taskIdParamSchema),
		validateBody(updateTaskSchema),
		async (req, res) => {
			let wasSilent;
			try {
				const { id } = req.validatedParams;
				const {
					prompt,
					useResearch = false,
					append = false
				} = req.validatedBody;
				const taskId = parseInt(id, 10);

				if (isNaN(taskId)) {
					return res.status(400).json({
						error: 'Bad Request',
						message: 'Invalid task ID - must be a number'
					});
				}

				// Enable silent mode to prevent console logs from interfering with daemon mode
				wasSilent = isSilentMode();
				if (!wasSilent) enableSilentMode();

				// Create context object for the updateTaskById function
				const context = createApiContext(req, 'api_update_task');

				// Call existing updateTaskById function
				const result = await updateTaskById(
					req.tasksPath,
					taskId,
					prompt,
					useResearch,
					context,
					'json', // outputFormat
					append
				);

				// Restore normal logging
				if (!wasSilent && isSilentMode()) disableSilentMode();

				res.json(
					createApiResponse(
						{
							success: true,
							taskId: taskId,
							message: 'Task updated successfully'
						},
						result.telemetryData
					)
				);
			} catch (error) {
				// Ensure silent mode is restored even on error
				if (!wasSilent && isSilentMode()) disableSilentMode();

				console.error('Error updating task:', error);

				// Check if it's a task not found error
				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Task not found',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to update task',
					message: error.message
				});
			}
		}
	);

	// PATCH /api/tasks/:id/status - Set task status
	router.patch(
		'/tasks/:id/status',
		validateParams(taskIdParamSchema),
		validateBody(setTaskStatusSchema),
		async (req, res) => {
			try {
				const { id: taskId } = req.validatedParams;
				const { status } = req.validatedBody;

				// Create context object for the setTaskStatus function
				const context = {
					projectRoot: req.projectRoot,
					tag: req.effectiveTag
				};

				// Call existing setTaskStatus function
				const result = await setTaskStatus(
					req.tasksPath,
					taskId,
					status,
					context,
					req.effectiveTag
				);

				res.json({
					success: true,
					taskId: taskId,
					status: status,
					message: 'Task status updated successfully'
				});
			} catch (error) {
				console.error('Error setting task status:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Task not found',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to update task status',
					message: error.message
				});
			}
		}
	);

	// DELETE /api/tasks/:id - Delete task
	router.delete(
		'/tasks/:id',
		validateParams(taskIdParamSchema),
		validateQuery(deleteTaskQuerySchema),
		async (req, res) => {
			try {
				const { id: taskId } = req.validatedParams;

				// Create context object for the removeTask function
				const context = {
					projectRoot: req.projectRoot,
					tag: req.effectiveTag
				};

				// Call existing removeTask function
				const result = await removeTask(req.tasksPath, taskId, context);

				if (!result.success) {
					return res.status(404).json({
						error: 'Task not found',
						message: result.errors.join(', ')
					});
				}

				res.status(204).send(); // No content for successful deletion
			} catch (error) {
				console.error('Error deleting task:', error);
				res.status(500).json({
					error: 'Failed to delete task',
					message: error.message
				});
			}
		}
	);

	// POST /api/tasks/:id/subtasks - Add subtask to existing task
	router.post(
		'/tasks/:id/subtasks',
		validateParams(taskIdParamSchema),
		validateBody(createSubtaskSchema),
		async (req, res) => {
			try {
				const { id } = req.validatedParams;
				const {
					title,
					description,
					details,
					status = 'pending',
					dependencies = []
				} = req.validatedBody;
				const parentId = parseInt(id, 10);

				if (isNaN(parentId)) {
					return res.status(400).json({
						error: 'Bad Request',
						message: 'Invalid parent task ID - must be a number'
					});
				}

				// Create context object for the addSubtask function
				const context = {
					projectRoot: req.projectRoot,
					tag: req.effectiveTag
				};

				// Prepare new subtask data
				const newSubtaskData = {
					title,
					description: description || '',
					details: details || '',
					status,
					dependencies
				};

				// Call existing addSubtask function
				const result = await addSubtask(
					req.tasksPath,
					parentId,
					null, // existingTaskId (not converting existing task)
					newSubtaskData,
					true, // generateFiles
					context
				);

				res.status(201).json({
					success: true,
					subtask: result,
					message: 'Subtask created successfully'
				});
			} catch (error) {
				console.error('Error creating subtask:', error);

				// Check if it's a parent task not found error
				if (
					error.message.includes('not found') ||
					error.message.includes('Parent task')
				) {
					return res.status(404).json({
						error: 'Parent task not found',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to create subtask',
					message: error.message
				});
			}
		}
	);

	// PUT /api/tasks/:parentId/subtasks/:subtaskId - Update subtask
	router.put(
		'/tasks/:parentId/subtasks/:subtaskId',
		validateParams(parentSubtaskParamSchema),
		validateBody(updateSubtaskSchema),
		async (req, res) => {
			let wasSilent;
			try {
				const { parentId, subtaskId } = req.validatedParams;
				const { prompt, useResearch = false } = req.validatedBody;
				const parentIdNum = parseInt(parentId, 10);
				const subtaskIdNum = parseInt(subtaskId, 10);

				if (isNaN(parentIdNum) || isNaN(subtaskIdNum)) {
					return res.status(400).json({
						error: 'Bad Request',
						message: 'Invalid parent task ID or subtask ID - must be numbers'
					});
				}

				const subtaskFullId = `${parentIdNum}.${subtaskIdNum}`;

				// Enable silent mode to prevent console logs from interfering with daemon mode
				wasSilent = isSilentMode();
				if (!wasSilent) enableSilentMode();

				// Create context object for the updateSubtaskById function
				const context = createApiContext(req, 'api_update_subtask');

				// Call existing updateSubtaskById function
				const result = await updateSubtaskById(
					req.tasksPath,
					subtaskFullId,
					prompt,
					useResearch,
					context,
					'json', // outputFormat
					req.effectiveTag
				);

				// Restore normal logging
				if (!wasSilent && isSilentMode()) disableSilentMode();

				res.json({
					success: true,
					subtaskId: subtaskFullId,
					message: 'Subtask updated successfully'
				});
			} catch (error) {
				// Ensure silent mode is restored even on error
				if (!wasSilent && isSilentMode()) disableSilentMode();

				console.error('Error updating subtask:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Subtask not found',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to update subtask',
					message: error.message
				});
			}
		}
	);

	// DELETE /api/tasks/:parentId/subtasks/:subtaskId - Remove subtask
	router.delete(
		'/tasks/:parentId/subtasks/:subtaskId',
		validateParams(parentSubtaskParamSchema),
		validateQuery(removeSubtaskQuerySchema),
		async (req, res) => {
			try {
				const { parentId, subtaskId } = req.validatedParams;
				const { convert = false } = req.validatedQuery;
				const parentIdNum = parseInt(parentId, 10);
				const subtaskIdNum = parseInt(subtaskId, 10);

				if (isNaN(parentIdNum) || isNaN(subtaskIdNum)) {
					return res.status(400).json({
						error: 'Bad Request',
						message: 'Invalid parent task ID or subtask ID - must be numbers'
					});
				}

				const subtaskFullId = `${parentIdNum}.${subtaskIdNum}`;

				// Create context object for the removeSubtask function
				const context = {
					projectRoot: req.projectRoot,
					tag: req.effectiveTag
				};

				// Call existing removeSubtask function
				const result = await removeSubtask(
					req.tasksPath,
					subtaskFullId,
					convert, // convert to standalone task
					true, // generateFiles
					context
				);

				res.status(204).send(); // No content for successful deletion
			} catch (error) {
				console.error('Error removing subtask:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Subtask not found',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to remove subtask',
					message: error.message
				});
			}
		}
	);

	// POST /api/tasks/:id/expand - Expand task with subtasks
	router.post(
		'/tasks/:id/expand',
		validateParams(taskIdParamSchema),
		validateBody(expandTaskSchema),
		async (req, res) => {
			let wasSilent;
			try {
				const { id } = req.validatedParams;
				const {
					num,
					useResearch = false,
					prompt,
					force = false
				} = req.validatedBody;
				const taskId = parseInt(id, 10);

				if (isNaN(taskId)) {
					return res.status(400).json({
						error: 'Bad Request',
						message: 'Invalid task ID - must be a number'
					});
				}

				// Enable silent mode to prevent console logs from interfering with daemon mode
				wasSilent = isSilentMode();
				if (!wasSilent) enableSilentMode();

				// Create context object for the expandTask function
				const context = createApiContext(req, 'api_expand_task');

				// Call existing expandTask function
				const result = await expandTask(
					req.tasksPath,
					taskId,
					num || null,
					useResearch,
					prompt || null,
					force,
					context,
					'json', // outputFormat
					req.effectiveTag
				);

				// Restore normal logging
				if (!wasSilent && isSilentMode()) disableSilentMode();

				res.json(
					createApiResponse(
						{
							success: true,
							taskId: taskId,
							message: 'Task expanded successfully',
							subtasksGenerated: result.subtasksGenerated || 0
						},
						result.telemetryData
					)
				);
			} catch (error) {
				// Ensure silent mode is restored even on error
				if (!wasSilent && isSilentMode()) disableSilentMode();

				console.error('Error expanding task:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Task not found',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to expand task',
					message: error.message
				});
			}
		}
	);

	// POST /api/tasks/expand-all - Expand all eligible tasks
	router.post(
		'/tasks/expand-all',
		validateBody(expandAllTasksSchema),
		async (req, res) => {
			let wasSilent;
			try {
				const {
					num,
					useResearch = false,
					prompt,
					force = false
				} = req.validatedBody;

				// Enable silent mode to prevent console logs from interfering with daemon mode
				wasSilent = isSilentMode();
				if (!wasSilent) enableSilentMode();

				// Create context object for the expandAllTasks function
				const context = createApiContext(req, 'api_expand_all_tasks');

				// Call existing expandAllTasks function
				const result = await expandAllTasks(
					req.tasksPath,
					num || null,
					useResearch,
					prompt || null,
					force,
					context,
					'json', // outputFormat
					req.effectiveTag
				);

				// Restore normal logging
				if (!wasSilent && isSilentMode()) disableSilentMode();

				res.json({
					success: true,
					message: 'All eligible tasks expanded successfully',
					tasksExpanded: result.tasksExpanded || 0,
					totalSubtasksGenerated: result.totalSubtasksGenerated || 0
				});
			} catch (error) {
				// Ensure silent mode is restored even on error
				if (!wasSilent && isSilentMode()) disableSilentMode();

				console.error('Error expanding all tasks:', error);
				res.status(500).json({
					error: 'Failed to expand all tasks',
					message: error.message
				});
			}
		}
	);

	// DELETE /api/tasks/:id/subtasks - Clear all subtasks from a task
	router.delete(
		'/tasks/:id/subtasks',
		validateParams(taskIdParamSchema),
		validateQuery(clearSubtasksQuerySchema),
		async (req, res) => {
			try {
				const { id: taskId } = req.validatedParams;

				// Create context object for the clearSubtasks function
				const context = {
					projectRoot: req.projectRoot,
					tag: req.effectiveTag
				};

				// Call existing clearSubtasks function
				const result = await clearSubtasks(
					req.tasksPath,
					taskId,
					false, // not clearing all tasks
					context
				);

				res.json({
					success: true,
					taskId: taskId,
					message: 'Subtasks cleared successfully'
				});
			} catch (error) {
				console.error('Error clearing subtasks:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Task not found',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to clear subtasks',
					message: error.message
				});
			}
		}
	);

	// DELETE /api/tasks/subtasks - Clear all subtasks from all tasks
	router.delete(
		'/tasks/subtasks',
		validateQuery(clearSubtasksQuerySchema),
		async (req, res) => {
			try {
				// Create context object for the clearSubtasks function
				const context = {
					projectRoot: req.projectRoot,
					tag: req.effectiveTag
				};

				// Call existing clearSubtasks function
				const result = await clearSubtasks(
					req.tasksPath,
					null, // no specific task ID
					true, // clear all subtasks
					context
				);

				res.json({
					success: true,
					message: 'All subtasks cleared successfully'
				});
			} catch (error) {
				console.error('Error clearing all subtasks:', error);
				res.status(500).json({
					error: 'Failed to clear all subtasks',
					message: error.message
				});
			}
		}
	);

	// POST /api/tasks/generate-files - Generate task files
	router.post(
		'/tasks/generate-files',
		validateBody(generateFilesSchema),
		async (req, res) => {
			try {
				const { outputDir } = req.validatedBody;

				// Create context object for the generateTaskFiles function
				const context = {
					projectRoot: req.projectRoot,
					tag: req.effectiveTag
				};

				// Call existing generateTaskFiles function
				const result = await generateTaskFiles(
					req.tasksPath,
					outputDir || null,
					context
				);

				res.json({
					success: true,
					message: 'Task files generated successfully',
					filesGenerated: result.filesGenerated || 0
				});
			} catch (error) {
				console.error('Error generating task files:', error);
				res.status(500).json({
					error: 'Failed to generate task files',
					message: error.message
				});
			}
		}
	);

	// POST /api/tasks/:id/dependencies - Add dependency
	router.post(
		'/tasks/:id/dependencies',
		validateParams(taskIdParamSchema),
		validateBody(addDependencySchema),
		async (req, res) => {
			try {
				const { id: taskId } = req.validatedParams;
				const { dependsOn } = req.validatedBody;

				// Create context object for the dependency manager
				const context = {
					projectRoot: req.projectRoot,
					tag: req.effectiveTag
				};

				// Call dependency manager to add dependency
				const result = await addDependency(
					req.tasksPath,
					taskId,
					dependsOn,
					context
				);

				res.json({
					success: true,
					taskId: taskId,
					dependsOn: dependsOn,
					message: 'Dependency added successfully'
				});
			} catch (error) {
				console.error('Error adding dependency:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Task not found',
						message: error.message
					});
				}

				if (error.message.includes('circular')) {
					return res.status(400).json({
						error: 'Circular dependency',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to add dependency',
					message: error.message
				});
			}
		}
	);

	// DELETE /api/tasks/:id/dependencies/:dependencyId - Remove dependency
	router.delete(
		'/tasks/:id/dependencies/:dependencyId',
		validateParams(dependencyParamSchema),
		validateQuery(validateDependenciesQuerySchema),
		async (req, res) => {
			try {
				const { id: taskId, dependencyId } = req.validatedParams;

				// Create context object for the dependency manager
				const context = {
					projectRoot: req.projectRoot,
					tag: req.effectiveTag
				};

				// Call dependency manager to remove dependency
				const result = await removeDependency(
					req.tasksPath,
					taskId,
					dependencyId,
					context
				);

				res.json({
					success: true,
					taskId: taskId,
					dependencyId: dependencyId,
					message: 'Dependency removed successfully'
				});
			} catch (error) {
				console.error('Error removing dependency:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Task or dependency not found',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to remove dependency',
					message: error.message
				});
			}
		}
	);

	// GET /api/tasks/dependencies/validate - Validate dependencies
	router.get(
		'/tasks/dependencies/validate',
		validateQuery(validateDependenciesQuerySchema),
		async (req, res) => {
			try {
				// TODO: TECHNICAL DEBT - validateDependenciesCommand doesn't return structured data
				// Following MCP server pattern as quick fix. Should be addressed in future refactor
				// to make core functions return proper data structures for API consumption.
				// See: scripts/modules/dependency-manager.js validateDependenciesCommand()

				// Call dependency manager to validate dependencies (ignore return value like MCP server)
				await validateDependenciesCommand(req.tasksPath, {
					context: {
						projectRoot: req.projectRoot,
						tag: req.effectiveTag
					}
				});

				// Create our own response structure (like MCP server does)
				res.json({
					success: true,
					isValid: true, // If no exception thrown, assume valid
					issues: [],
					message: 'All dependencies are valid'
				});
			} catch (error) {
				console.error('Error validating dependencies:', error);
				res.status(500).json({
					error: 'Failed to validate dependencies',
					message: error.message
				});
			}
		}
	);

	// POST /api/tasks/dependencies/fix - Fix dependency issues
	router.post(
		'/tasks/dependencies/fix',
		validateBody(fixDependenciesSchema),
		async (req, res) => {
			try {
				// TODO: TECHNICAL DEBT - fixDependenciesCommand doesn't return structured data
				// Following MCP server pattern as quick fix. Should be addressed in future refactor
				// to make core functions return proper data structures for API consumption.
				// See: scripts/modules/dependency-manager.js fixDependenciesCommand()

				// Call dependency manager to fix dependencies (ignore return value like MCP server)
				await fixDependenciesCommand(req.tasksPath, {
					context: {
						projectRoot: req.projectRoot,
						tag: req.effectiveTag
					}
				});

				// Create our own response structure (like MCP server does)
				res.json({
					success: true,
					fixed: [], // Cannot provide actual fixed items without return data
					message: 'Dependencies fixed successfully',
					fixedCount: 0 // Cannot provide actual count without return data
				});
			} catch (error) {
				console.error('Error fixing dependencies:', error);
				res.status(500).json({
					error: 'Failed to fix dependencies',
					message: error.message
				});
			}
		}
	);

	// PUT /api/tasks/:fromId/move/:toId - Move task
	router.put(
		'/tasks/:fromId/move/:toId',
		validateParams(moveTaskParamSchema),
		validateBody(moveTaskSchema),
		async (req, res) => {
			try {
				const { fromId, toId } = req.validatedParams;

				// Create context object for the moveTask function
				const context = createApiContext(req, 'api_move_task');

				// Call existing moveTask function
				const result = await moveTask(
					req.tasksPath,
					fromId,
					toId,
					false,
					context
				);

				res.json({
					success: true,
					fromId: fromId,
					toId: toId,
					message: 'Task moved successfully'
				});
			} catch (error) {
				console.error('Error moving task:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Task not found',
						message: error.message
					});
				}

				if (error.message.includes('already exists')) {
					return res.status(409).json({
						error: 'Conflict',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to move task',
					message: error.message
				});
			}
		}
	);

	// GET /api/tags - List all tags
	router.get('/tags', validateQuery(listTagsQuerySchema), async (req, res) => {
		try {
			const { showMetadata = false } = req.validatedQuery;

			// Create context object for tag management
			const context = {
				projectRoot: req.projectRoot
			};

			// Call tag management to list tags
			const result = await tags(
				req.tasksPath,
				{ showMetadata },
				context,
				'json'
			);

			res.json(result);
		} catch (error) {
			console.error('Error listing tags:', error);
			res.status(500).json({
				error: 'Failed to list tags',
				message: error.message
			});
		}
	});

	// POST /api/tags - Create new tag
	router.post(
		'/tags',
		validateBody(createTagSchema),
		validateTagOperation('create'),
		async (req, res) => {
			try {
				const {
					tagName,
					description,
					copyFromCurrent = false,
					copyFrom,
					fromBranch = false
				} = req.validatedBody;

				// Create context object for tag management
				const context = {
					projectRoot: req.projectRoot
				};

				// Call tag management to add tag
				const result = await createTag(
					req.tasksPath,
					tagName,
					{
						description: description || '',
						copyFromCurrent: copyFromCurrent,
						copyFromTag: copyFrom || null
					},
					context,
					'json'
				);

				res.status(201).json({
					success: true,
					tagName: result.tagName,
					message: 'Tag created successfully'
				});
			} catch (error) {
				console.error('Error creating tag:', error);

				if (error.message.includes('already exists')) {
					return res.status(409).json({
						error: 'Tag already exists',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to create tag',
					message: error.message
				});
			}
		}
	);

	// DELETE /api/tags/:tagName - Delete tag
	router.delete(
		'/tags/:tagName',
		validateParams(tagNameParamSchema),
		validateQuery(deleteTagQuerySchema),
		validateTagOperation('delete'),
		async (req, res) => {
			try {
				const { tagName } = req.validatedParams;
				const { force = false } = req.validatedQuery;

				// Create context object for tag management
				const context = {
					projectRoot: req.projectRoot
				};

				// Call tag management to delete tag
				const result = await deleteTag(
					req.tasksPath,
					tagName,
					{ force },
					context,
					'json'
				);

				res.status(204).send(); // No content for successful deletion
			} catch (error) {
				console.error('Error deleting tag:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Tag not found',
						message: error.message
					});
				}

				if (error.message.includes('cannot delete')) {
					return res.status(400).json({
						error: 'Cannot delete tag',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to delete tag',
					message: error.message
				});
			}
		}
	);

	// PUT /api/tags/:oldName/rename/:newName - Rename tag
	router.put(
		'/tags/:oldName/rename/:newName',
		validateParams(renameTagParamSchema),
		async (req, res) => {
			try {
				const { oldName, newName } = req.validatedParams;

				// Create context object for tag management
				const context = {
					projectRoot: req.projectRoot
				};

				// Call tag management to rename tag
				const result = await renameTag(
					req.tasksPath,
					oldName,
					newName,
					{},
					context,
					'json'
				);

				res.json({
					success: true,
					oldName: oldName,
					newName: newName,
					message: 'Tag renamed successfully'
				});
			} catch (error) {
				console.error('Error renaming tag:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Tag not found',
						message: error.message
					});
				}

				if (error.message.includes('already exists')) {
					return res.status(409).json({
						error: 'Tag name conflict',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to rename tag',
					message: error.message
				});
			}
		}
	);

	// POST /api/tags/:sourceName/copy/:targetName - Copy tag
	router.post(
		'/tags/:sourceName/copy/:targetName',
		validateParams(copyTagParamSchema),
		validateBody(copyTagSchema),
		async (req, res) => {
			try {
				const { sourceName, targetName } = req.validatedParams;
				const { description } = req.validatedBody;

				// Create context object for tag management
				const context = {
					projectRoot: req.projectRoot
				};

				// Call tag management to copy tag
				const result = await copyTag(
					req.tasksPath,
					sourceName,
					targetName,
					{ description: description || '' },
					context,
					'json'
				);

				res.status(201).json({
					success: true,
					sourceName: sourceName,
					targetName: targetName,
					message: 'Tag copied successfully'
				});
			} catch (error) {
				console.error('Error copying tag:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Source tag not found',
						message: error.message
					});
				}

				if (error.message.includes('already exists')) {
					return res.status(409).json({
						error: 'Target tag already exists',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to copy tag',
					message: error.message
				});
			}
		}
	);

	// PUT /api/tags/use/:tagName - Switch to tag
	router.put(
		'/tags/use/:tagName',
		validateParams(tagNameParamSchema),
		async (req, res) => {
			try {
				const { tagName } = req.validatedParams;

				// Check if the target tag exists before trying to switch to it
				const data = readJSON(req.tasksPath, req.projectRoot);
				if (!data) {
					return res.status(500).json({
						error: 'Failed to read tasks file',
						message: 'Could not read tasks.json file'
					});
				}

				// Check if tag exists in the data
				const rawData = data._rawTaggedData || data;
				if (!rawData[tagName]) {
					return res.status(404).json({
						error: 'Tag not found',
						message: `Tag '${tagName}' does not exist`
					});
				}

				// Create context object for tag management
				const context = {
					projectRoot: req.projectRoot
				};

				// Call tag management to use tag
				const result = await useTag(
					req.tasksPath,
					tagName,
					{},
					context,
					'json'
				);

				res.json({
					success: true,
					currentTag: tagName,
					message: `Switched to tag '${tagName}' successfully`
				});
			} catch (error) {
				console.error('Error switching tag:', error);

				if (
					error.message.includes('not found') ||
					error.message.includes('does not exist')
				) {
					return res.status(404).json({
						error: 'Tag not found',
						message: error.message
					});
				}

				res.status(500).json({
					error: 'Failed to switch tag',
					message: error.message
				});
			}
		}
	);

	// POST /api/analysis/complexity - Analyze task complexity
	router.post(
		'/analysis/complexity',
		validateBody(analyzeComplexitySchema),
		async (req, res) => {
			let wasSilent;
			try {
				const { output, threshold, useResearch = false } = req.validatedBody;

				// Enable silent mode to prevent console logs from interfering with daemon mode
				wasSilent = isSilentMode();
				if (!wasSilent) enableSilentMode();

				// Create context object for the analyzeTaskComplexity function
				const context = createApiContext(req, 'api_analyze_complexity');

				// Call existing analyzeTaskComplexity function
				const result = await analyzeTaskComplexity(
					req.tasksPath,
					output || null,
					threshold || null,
					useResearch,
					context,
					'json', // outputFormat
					req.effectiveTag
				);

				// Restore normal logging
				if (!wasSilent && isSilentMode()) disableSilentMode();

				res.json({
					success: true,
					message: 'Complexity analysis completed successfully',
					reportPath: result.reportPath,
					tasksAnalyzed: result.tasksAnalyzed || 0,
					highComplexityTasks: result.highComplexityTasks || 0
				});
			} catch (error) {
				// Ensure silent mode is restored even on error
				if (!wasSilent && isSilentMode()) disableSilentMode();

				console.error('Error analyzing complexity:', error);
				res.status(500).json({
					error: 'Failed to analyze complexity',
					message: error.message
				});
			}
		}
	);

	// GET /api/analysis/complexity-report - Get complexity report
	router.get(
		'/analysis/complexity-report',
		validateQuery(complexityReportQuerySchema),
		async (req, res) => {
			try {
				const { file } = req.validatedQuery;

				// Create context object
				const context = {
					projectRoot: req.projectRoot,
					tag: req.effectiveTag
				};

				// Construct report path
				const taskMasterDir = '.taskmaster';
				const reportPath =
					file ||
					path.join(
						req.projectRoot,
						taskMasterDir,
						'reports',
						req.effectiveTag !== 'master'
							? `task-complexity-report_${req.effectiveTag}.json`
							: 'task-complexity-report.json'
					);

				// Read and return the complexity report
				const reportData = JSON.parse(readFileSync(reportPath, 'utf8'));

				res.json({
					success: true,
					report: reportData,
					message: 'Complexity report retrieved successfully'
				});
			} catch (error) {
				console.error('Error getting complexity report:', error);

				if (error.code === 'ENOENT') {
					return res.status(404).json({
						error: 'Report not found',
						message: 'Complexity report does not exist. Run analysis first.'
					});
				}

				res.status(500).json({
					error: 'Failed to get complexity report',
					message: error.message
				});
			}
		}
	);

	// POST /api/research - Perform research query
	router.post('/research', validateBody(researchSchema), async (req, res) => {
		let wasSilent;
		try {
			const {
				query,
				taskIds,
				filePaths,
				customContext,
				includeProjectTree = false,
				detailLevel = 'medium',
				saveTo,
				saveFile = false
			} = req.validatedBody;

			// Enable silent mode to prevent console logs from interfering with daemon mode
			wasSilent = isSilentMode();
			if (!wasSilent) enableSilentMode();

			// Create context object for the research function
			const context = createApiContext(req, 'api_research');

			// Call existing research function
			const result = await performResearch(
				query,
				{
					taskIds: taskIds || null,
					filePaths: filePaths || null,
					customContext: customContext || null,
					includeProjectTree: includeProjectTree,
					detailLevel: detailLevel,
					saveTo: saveTo || null,
					saveFile: saveFile,
					tag: req.effectiveTag,
					projectRoot: req.projectRoot
				},
				context,
				'json' // outputFormat
			);

			// Restore normal logging
			if (!wasSilent && isSilentMode()) disableSilentMode();

			res.json({
				success: true,
				message: 'Research completed successfully',
				response: result.response,
				savedTo: result.savedTo || null,
				savedFile: result.savedFile || null
			});
		} catch (error) {
			// Ensure silent mode is restored even on error
			if (!wasSilent && isSilentMode()) disableSilentMode();

			console.error('Error performing research:', error);
			res.status(500).json({
				error: 'Failed to perform research',
				message: error.message
			});
		}
	});

	// POST /api/parse-prd - Parse PRD and generate tasks
	router.post('/parse-prd', validateBody(parsePrdSchema), async (req, res) => {
		let wasSilent;
		try {
			const { input, output, numTasks, force = false } = req.validatedBody;

			// Enable silent mode to prevent console logs from interfering with daemon mode
			wasSilent = isSilentMode();
			if (!wasSilent) enableSilentMode();

			// Create context object for the parsePrd function
			const context = createApiContext(req, 'api_parse_prd');

			// Call existing parsePrd function
			const result = await parsePrd(
				input,
				output || null,
				numTasks || null,
				force,
				context,
				'json', // outputFormat
				req.effectiveTag
			);

			// Restore normal logging
			if (!wasSilent && isSilentMode()) disableSilentMode();

			res.json({
				success: true,
				message: 'PRD parsed successfully',
				tasksGenerated: result.tasksGenerated || 0,
				outputFile: result.outputFile,
				tag: req.effectiveTag
			});
		} catch (error) {
			// Ensure silent mode is restored even on error
			if (!wasSilent && isSilentMode()) disableSilentMode();

			console.error('Error parsing PRD:', error);

			if (error.code === 'ENOENT') {
				return res.status(404).json({
					error: 'PRD file not found',
					message: error.message
				});
			}

			res.status(500).json({
				error: 'Failed to parse PRD',
				message: error.message
			});
		}
	});

	return router;
}

export default createApiRouter;
