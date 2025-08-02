import express from 'express';
import { TASK_STATUS_OPTIONS } from '../../../constants/task-status.js';

/**
 * Create API router with TaskMaster integration
 * @param {Object} taskMaster - TaskMaster instance for accessing tasks
 * @returns {express.Router} Configured Express router
 */
export function createApiRouter(taskMaster) {
	const router = express.Router();

	// Valid status values
	const validStatuses = TASK_STATUS_OPTIONS;

	// Whitelisted safe commands for UI
	const safeCommands = [
		'list',
		'show',
		'next',
		'expand',
		'analyze-complexity',
		'complexity-report',
		'validate-dependencies',
		'tags'
	];

	/**
	 * GET /api/tasks
	 * Retrieve all tasks with optional filtering
	 */
	router.get('/tasks', (req, res, next) => {
		try {
			const { status, priority } = req.query;
			let tasks = taskMaster.tasks.tasks || [];

			// Apply filters if provided
			if (status) {
				tasks = tasks.filter(task => task.status === status);
			}
			if (priority) {
				tasks = tasks.filter(task => task.priority === priority);
			}

			// Return tasks with metadata
			res.json({
				tasks,
				metadata: {
					total: tasks.length,
					timestamp: new Date().toISOString()
				}
			});
		} catch (error) {
			next(error);
		}
	});

	/**
	 * GET /api/tasks/:id
	 * Retrieve a specific task by ID
	 */
	router.get('/tasks/:id', (req, res, next) => {
		try {
			const { id } = req.params;
			
			// Use taskMaster's getTaskById if available, otherwise search manually
			let task;
			if (taskMaster.getTaskById) {
				task = taskMaster.getTaskById(id);
			} else {
				// Search in main tasks and subtasks
				const allTasks = taskMaster.tasks.tasks || [];
				task = allTasks.find(t => t.id === id);
				
				if (!task) {
					// Search in subtasks
					for (const mainTask of allTasks) {
						if (mainTask.subtasks) {
							task = mainTask.subtasks.find(st => st.id === id);
							if (task) break;
						}
					}
				}
			}

			if (!task) {
				return res.status(404).json({ error: 'Task not found' });
			}

			res.json({ task });
		} catch (error) {
			next(error);
		}
	});

	/**
	 * PATCH /api/tasks/:id/status
	 * Update task status
	 */
	router.patch('/tasks/:id/status', async (req, res, next) => {
		try {
			const { id } = req.params;
			const { status } = req.body;

			// Validate request body
			if (!status) {
				return res.status(400).json({ error: 'Status is required' });
			}

			// Validate status value
			if (!validStatuses.includes(status)) {
				return res.status(400).json({ 
					error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
				});
			}

			// Update task status using TaskMaster
			try {
				const result = await taskMaster.setTaskStatus(id, status);
				res.json(result);
			} catch (error) {
				// Check if it's a "task not found" error
				if (error.message.includes('not found') || error.message.includes('Task not found')) {
					return res.status(404).json({ error: 'Task not found' });
				}
				throw error;
			}
		} catch (error) {
			next(error);
		}
	});

	/**
	 * POST /api/commands/:command
	 * Execute TaskMaster CLI commands
	 */
	router.post('/commands/:command', async (req, res, next) => {
		try {
			const { command } = req.params;
			const { args = [] } = req.body;

			// Validate command is in whitelist
			if (!safeCommands.includes(command)) {
				return res.status(403).json({ 
					error: `Command '${command}' is forbidden. Only safe read operations are allowed.` 
				});
			}

			// Execute command using TaskMaster
			try {
				const result = await taskMaster.executeCommand(command, args);
				res.json(result);
			} catch (error) {
				// Let the error handler deal with it
				throw error;
			}
		} catch (error) {
			next(error);
		}
	});

	// Error handling middleware
	router.use((err, req, res, next) => {
		console.error('API Error:', err.message);
		
		// Default to 500 if no status set
		const status = err.status || 500;
		
		res.status(status).json({
			error: err.message || 'Internal server error'
		});
	});

	return router;
}