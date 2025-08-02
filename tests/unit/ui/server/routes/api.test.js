import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createApiRouter } from '../../../../../src/ui/server/routes/api.js';

describe('Task API Endpoints', () => {
	let app;
	let mockTaskMaster;

	beforeEach(() => {
		// Create a fresh Express app for each test
		app = express();
		app.use(express.json());

		// Mock TaskMaster instance
		mockTaskMaster = {
			tasks: {
				tasks: [
					{
						id: '1',
						title: 'Main Task 1',
						description: 'Description 1',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: [
							{
								id: '1.1',
								title: 'Subtask 1.1',
								description: 'Subtask description',
								status: 'pending',
								priority: 'medium',
								dependencies: []
							}
						]
					},
					{
						id: '2',
						title: 'Main Task 2',
						description: 'Description 2',
						status: 'in-progress',
						priority: 'medium',
						dependencies: ['1'],
						subtasks: []
					}
				]
			},
			setTaskStatus: jest.fn().mockResolvedValue({
				success: true,
				message: 'Status updated successfully'
			}),
			executeCommand: jest.fn().mockResolvedValue({
				success: true,
				output: 'Command executed'
			}),
			getTaskById: jest.fn((id) => {
				const allTasks = [
					...mockTaskMaster.tasks.tasks,
					...mockTaskMaster.tasks.tasks.flatMap(t => t.subtasks || [])
				];
				return allTasks.find(t => t.id === id);
			})
		};

		// Mount the API router
		const apiRouter = createApiRouter(mockTaskMaster);
		app.use('/api', apiRouter);

		// Add error handler
		app.use((err, req, res, next) => {
			res.status(err.status || 500).json({
				error: err.message || 'Internal server error'
			});
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('GET /api/tasks', () => {
		it('should return all tasks with subtask hierarchy', async () => {
			const response = await request(app)
				.get('/api/tasks')
				.expect(200);

			expect(response.body).toHaveProperty('tasks');
			expect(response.body.tasks).toHaveLength(2);
			expect(response.body.tasks[0]).toHaveProperty('id', '1');
			expect(response.body.tasks[0]).toHaveProperty('subtasks');
			expect(response.body.tasks[0].subtasks).toHaveLength(1);
		});

		it('should include metadata in response', async () => {
			const response = await request(app)
				.get('/api/tasks')
				.expect(200);

			expect(response.body).toHaveProperty('metadata');
			expect(response.body.metadata).toHaveProperty('total', 2);
			expect(response.body.metadata).toHaveProperty('timestamp');
		});

		it('should support status filtering', async () => {
			const response = await request(app)
				.get('/api/tasks?status=pending')
				.expect(200);

			expect(response.body.tasks).toHaveLength(1);
			expect(response.body.tasks[0].status).toBe('pending');
		});

		it('should support priority filtering', async () => {
			const response = await request(app)
				.get('/api/tasks?priority=high')
				.expect(200);

			expect(response.body.tasks).toHaveLength(1);
			expect(response.body.tasks[0].priority).toBe('high');
		});

		it('should handle errors gracefully', async () => {
			// Override the tasks getter to throw an error
			Object.defineProperty(mockTaskMaster, 'tasks', {
				get: () => { throw new Error('File read error'); }
			});

			const response = await request(app)
				.get('/api/tasks')
				.expect(500);

			expect(response.body).toHaveProperty('error');
		});
	});

	describe('PATCH /api/tasks/:id/status', () => {
		it('should update task status', async () => {
			const response = await request(app)
				.patch('/api/tasks/1/status')
				.send({ status: 'in-progress' })
				.expect(200);

			expect(response.body).toHaveProperty('success', true);
			expect(response.body).toHaveProperty('message');
			expect(mockTaskMaster.setTaskStatus).toHaveBeenCalledWith('1', 'in-progress');
		});

		it('should validate status values', async () => {
			const response = await request(app)
				.patch('/api/tasks/1/status')
				.send({ status: 'invalid-status' })
				.expect(400);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toContain('Invalid status');
			expect(mockTaskMaster.setTaskStatus).not.toHaveBeenCalled();
		});

		it('should require status in request body', async () => {
			const response = await request(app)
				.patch('/api/tasks/1/status')
				.send({})
				.expect(400);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toContain('Status is required');
		});

		it('should handle non-existent tasks', async () => {
			mockTaskMaster.setTaskStatus.mockRejectedValue(
				new Error('Task not found')
			);

			const response = await request(app)
				.patch('/api/tasks/999/status')
				.send({ status: 'done' })
				.expect(404);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toContain('Task not found');
		});

		it('should update subtask status', async () => {
			const response = await request(app)
				.patch('/api/tasks/1.1/status')
				.send({ status: 'done' })
				.expect(200);

			expect(mockTaskMaster.setTaskStatus).toHaveBeenCalledWith('1.1', 'done');
		});
	});

	describe('POST /api/commands/:command', () => {
		it('should execute valid commands', async () => {
			const response = await request(app)
				.post('/api/commands/list')
				.send({ args: ['--status=pending'] })
				.expect(200);

			expect(response.body).toHaveProperty('success', true);
			expect(response.body).toHaveProperty('output');
			expect(mockTaskMaster.executeCommand).toHaveBeenCalledWith('list', ['--status=pending']);
		});

		it('should reject dangerous commands', async () => {
			const dangerousCommands = ['rm', 'delete', 'drop'];
			
			for (const cmd of dangerousCommands) {
				const response = await request(app)
					.post(`/api/commands/${cmd}`)
					.send({ args: [] })
					.expect(403);

				expect(response.body).toHaveProperty('error');
				expect(response.body.error).toContain('forbidden');
			}
		});

		it('should whitelist safe commands', async () => {
			const safeCommands = ['list', 'show', 'next', 'expand', 'analyze-complexity'];
			
			for (const cmd of safeCommands) {
				const response = await request(app)
					.post(`/api/commands/${cmd}`)
					.send({ args: [] })
					.expect(200);

				expect(mockTaskMaster.executeCommand).toHaveBeenCalledWith(cmd, []);
			}
		});

		it('should handle command execution errors', async () => {
			mockTaskMaster.executeCommand.mockRejectedValue(
				new Error('Command failed')
			);

			const response = await request(app)
				.post('/api/commands/list')
				.send({ args: [] })
				.expect(500);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toContain('Command failed');
		});

		it('should default args to empty array', async () => {
			const response = await request(app)
				.post('/api/commands/list')
				.send({})
				.expect(200);

			expect(mockTaskMaster.executeCommand).toHaveBeenCalledWith('list', []);
		});
	});

	describe('GET /api/tasks/:id', () => {
		it('should return specific task by ID', async () => {
			const response = await request(app)
				.get('/api/tasks/1')
				.expect(200);

			expect(response.body).toHaveProperty('task');
			expect(response.body.task.id).toBe('1');
			expect(response.body.task.title).toBe('Main Task 1');
		});

		it('should return subtask by ID', async () => {
			const response = await request(app)
				.get('/api/tasks/1.1')
				.expect(200);

			expect(response.body).toHaveProperty('task');
			expect(response.body.task.id).toBe('1.1');
			expect(response.body.task.title).toBe('Subtask 1.1');
		});

		it('should return 404 for non-existent task', async () => {
			const response = await request(app)
				.get('/api/tasks/999')
				.expect(404);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toContain('Task not found');
		});
	});

	describe('Performance', () => {
		it('should handle 100+ tasks efficiently', async () => {
			// Create 100 tasks
			const largeTasks = Array.from({ length: 100 }, (_, i) => ({
				id: `${i + 1}`,
				title: `Task ${i + 1}`,
				description: `Description ${i + 1}`,
				status: i % 2 === 0 ? 'pending' : 'done',
				priority: i % 3 === 0 ? 'high' : 'medium',
				dependencies: [],
				subtasks: []
			}));

			mockTaskMaster.tasks.tasks = largeTasks;

			const startTime = Date.now();
			const response = await request(app)
				.get('/api/tasks')
				.expect(200);

			const responseTime = Date.now() - startTime;

			expect(response.body.tasks).toHaveLength(100);
			expect(responseTime).toBeLessThan(1000); // Should respond in under 1 second
		});
	});
});