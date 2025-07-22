import expandTask from '../../../scripts/modules/task-manager/expand-task.js';
import { readJSON, writeJSON } from '../../../scripts/modules/utils.js';
import fs from 'fs';
import path from 'path';

describe('expand-task with generateObject', () => {
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
					subtasks: []
				},
				{
					id: 3,
					title: 'Build API endpoints',
					description: 'Create RESTful API endpoints',
					status: 'pending',
					dependencies: [2],
					priority: 'medium',
					details: null,
					testStrategy: null,
					subtasks: [
						{
							id: 1,
							title: 'Design API schema',
							description: 'Create OpenAPI specification',
							dependencies: [],
							details: 'Use OpenAPI 3.0 specification',
							status: 'done'
						}
					]
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

	test('should expand task with structured subtasks', async () => {
		const result = await expandTask(
			testTasksFile,
			'2', // taskId as string
			3, // numSubtasks
			false, // force
			'Break down authentication into implementation steps' // additionalContext
		);

		expect(result).toHaveProperty('task');
		expect(result).toHaveProperty('telemetryData');

		const { task } = result;

		// Verify task was expanded
		expect(task.id).toBe(2);
		expect(task.subtasks).toBeDefined();
		expect(Array.isArray(task.subtasks)).toBe(true);
		expect(task.subtasks.length).toBeGreaterThan(0);

		// Verify subtask structure
		const subtask = task.subtasks[0];
		expect(subtask).toHaveProperty('id');
		expect(subtask).toHaveProperty('title');
		expect(subtask).toHaveProperty('description');
		expect(subtask).toHaveProperty('dependencies');
		expect(subtask).toHaveProperty('details');
		expect(subtask).toHaveProperty('status', 'pending');

		// Verify task was written back to file
		const savedData = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
		const savedTask = savedData.tasks.find((t) => t.id === 2);
		expect(savedTask.subtasks.length).toBe(task.subtasks.length);
	}, 30000); // Increase timeout for AI call

	test('should append subtasks when force=false', async () => {
		// First expansion
		await expandTask(testTasksFile, '3', 2, false);

		const dataAfterFirst = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
		const taskAfterFirst = dataAfterFirst.tasks.find((t) => t.id === 3);
		const initialSubtaskCount = taskAfterFirst.subtasks.length;

		// Second expansion (append)
		await expandTask(
			testTasksFile,
			'3',
			2,
			false,
			'Add more implementation details'
		);

		const dataAfterSecond = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
		const taskAfterSecond = dataAfterSecond.tasks.find((t) => t.id === 3);

		// Should have more subtasks than before
		expect(taskAfterSecond.subtasks.length).toBeGreaterThan(
			initialSubtaskCount
		);
	}, 60000);

	test('should replace subtasks when force=true', async () => {
		// First expansion
		await expandTask(testTasksFile, '3', 2, false);

		// Second expansion with force=true
		const result = await expandTask(
			testTasksFile,
			'3',
			3,
			true,
			'Complete redesign needed'
		);

		const savedData = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
		const savedTask = savedData.tasks.find((t) => t.id === 3);

		// Should have exactly 3 subtasks (replaced, not appended)
		expect(savedTask.subtasks.length).toBe(3);
	}, 60000);
});
