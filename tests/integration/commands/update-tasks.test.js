import updateTasks from '../../../scripts/modules/task-manager/update-tasks.js';
import { readJSON, writeJSON } from '../../../scripts/modules/utils.js';
import fs from 'fs';
import path from 'path';

describe('update-tasks with generateObject', () => {
	const testTasksFile = path.join(process.cwd(), 'test-tasks.json');

	beforeEach(() => {
		// Create a test tasks file
		const testTasks = {
			projectName: 'Test Project',
			tasks: [
				{
					id: 1,
					title: 'Setup project structure',
					description: 'Initialize the project with proper folder structure',
					status: 'done',
					dependencies: [],
					priority: 'high',
					details: 'Create folders for src, tests, docs',
					testStrategy: 'Manual verification',
					subtasks: []
				},
				{
					id: 2,
					title: 'Implement authentication',
					description: 'Add user authentication with JWT tokens',
					status: 'pending',
					dependencies: [1],
					priority: 'high',
					details: 'Need to support OAuth2 and traditional login',
					testStrategy: null,
					subtasks: [
						{
							id: 1,
							title: 'Design auth flow',
							description: 'Create authentication flow diagrams',
							status: 'done',
							dependencies: []
						}
					]
				},
				{
					id: 3,
					title: 'Build API endpoints',
					description: 'Create RESTful API endpoints',
					status: 'in-progress',
					dependencies: [2],
					priority: 'medium',
					details: 'Use Express.js for the API',
					testStrategy: 'Integration tests with Jest',
					subtasks: []
				},
				{
					id: 4,
					title: 'Add database layer',
					description: 'Implement database models and migrations',
					status: 'pending',
					dependencies: [1],
					priority: 'high',
					details: null,
					testStrategy: null,
					subtasks: []
				}
			]
		};
		fs.writeFileSync(testTasksFile, JSON.stringify(testTasks, null, 2));
	});

	afterEach(() => {
		// Clean up test files
		if (fs.existsSync(testTasksFile)) {
			fs.unlinkSync(testTasksFile);
		}
	});

	test('should update multiple tasks with structured data', async () => {
		const result = await updateTasks(
			testTasksFile,
			2, // Update from task ID 2 onwards
			'Switch to microservices architecture with Docker containers'
		);

		expect(result).toBeDefined();
		expect(result).toHaveProperty('updatedTasks');
		expect(result).toHaveProperty('telemetryData');

		// Read the updated file
		const updatedData = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));

		// Task 1 should remain unchanged (status: done)
		const task1 = updatedData.tasks.find((t) => t.id === 1);
		expect(task1.title).toBe('Setup project structure');
		expect(task1.status).toBe('done');

		// Tasks 2, 3, and 4 should be updated
		const task2 = updatedData.tasks.find((t) => t.id === 2);
		expect(task2.description.toLowerCase()).toContain('microservice');
		// Completed subtasks should be preserved
		expect(
			task2.subtasks.find((st) => st.id === 1 && st.status === 'done')
		).toBeDefined();

		const task3 = updatedData.tasks.find((t) => t.id === 3);
		expect(task3.description.toLowerCase()).toContain('docker');

		const task4 = updatedData.tasks.find((t) => t.id === 4);
		expect(task4.description.toLowerCase()).toMatch(
			/microservice|docker|container/
		);
	}, 30000); // Increase timeout for AI call

	test('should preserve completed subtasks when updating', async () => {
		await updateTasks(
			testTasksFile,
			2,
			'Add comprehensive error handling and logging'
		);

		const updatedData = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
		const task2 = updatedData.tasks.find((t) => t.id === 2);

		// Find the completed subtask
		const completedSubtask = task2.subtasks.find((st) => st.id === 1);
		expect(completedSubtask).toBeDefined();
		expect(completedSubtask.status).toBe('done');
		expect(completedSubtask.title).toBe('Design auth flow');
		expect(completedSubtask.description).toBe(
			'Create authentication flow diagrams'
		);
	}, 30000);

	test('should handle no tasks to update', async () => {
		const result = await updateTasks(
			testTasksFile,
			10, // Start from non-existent task ID
			'Update all tasks'
		);

		expect(result).toBeUndefined();

		// File should remain unchanged
		const data = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
		expect(data.tasks.length).toBe(4);
	}, 30000);
});
