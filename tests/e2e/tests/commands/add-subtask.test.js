import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment, runCommand } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs';

describe('add-subtask command', () => {
	let testDir;
	let tasksPath;

	beforeAll(() => {
		testDir = setupTestEnvironment('add-subtask-command');
		tasksPath = path.join(testDir, '.taskmaster', 'tasks-master.json');
	});

	afterAll(() => {
		cleanupTestEnvironment(testDir);
	});

	beforeEach(() => {
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Parent task',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Another parent task',
						status: 'in_progress',
						priority: 'medium',
						dependencies: [],
						subtasks: [
							{
								id: 1,
								description: 'Existing subtask',
								status: 'pending',
								priority: 'low'
							}
						]
					},
					{
						id: 3,
						description: 'Task to be converted',
						status: 'pending',
						priority: 'low',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		// Ensure .taskmaster directory exists
		fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));
	});

	it('should add a new subtask to a parent task', async () => {
		// Run add-subtask command
		const result = await runCommand(
			'add-subtask',
			[
				'-f', tasksPath,
				'--parent', '1',
				'--title', 'New subtask',
				'--description', 'This is a new subtask',
				'--skip-generate'
			],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Creating new subtask');
		expect(result.stdout).toContain('successfully created');
		expect(result.stdout).toContain('1.1'); // subtask ID

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const parentTask = updatedTasks.master.tasks.find(t => t.id === 1);

		// Verify subtask was added
		expect(parentTask.subtasks).toHaveLength(1);
		expect(parentTask.subtasks[0].id).toBe(1);
		expect(parentTask.subtasks[0].title).toBe('New subtask');
		expect(parentTask.subtasks[0].description).toBe('This is a new subtask');
		expect(parentTask.subtasks[0].status).toBe('pending');
	});

	it('should add a subtask with custom status and details', async () => {
		// Run add-subtask command with more options
		const result = await runCommand(
			'add-subtask',
			[
				'-f', tasksPath,
				'--parent', '1',
				'--title', 'Advanced subtask',
				'--description', 'Subtask with details',
				'--details', 'Implementation details here',
				'--status', 'in_progress',
				'--skip-generate'
			],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const parentTask = updatedTasks.master.tasks.find(t => t.id === 1);
		const newSubtask = parentTask.subtasks[0];

		// Verify subtask properties
		expect(newSubtask.title).toBe('Advanced subtask');
		expect(newSubtask.description).toBe('Subtask with details');
		expect(newSubtask.details).toBe('Implementation details here');
		expect(newSubtask.status).toBe('in_progress');
	});

	it('should add a subtask with dependencies', async () => {
		// Run add-subtask command with dependencies
		const result = await runCommand(
			'add-subtask',
			[
				'-f', tasksPath,
				'--parent', '2',
				'--title', 'Subtask with deps',
				'--dependencies', '2.1,1',
				'--skip-generate'
			],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const parentTask = updatedTasks.master.tasks.find(t => t.id === 2);
		const newSubtask = parentTask.subtasks.find(s => s.title === 'Subtask with deps');

		// Verify dependencies
		expect(newSubtask.dependencies).toEqual(['2.1', 1]);
	});

	it('should convert an existing task to a subtask', async () => {
		// Run add-subtask command to convert task 3 to subtask of task 1
		const result = await runCommand(
			'add-subtask',
			[
				'-f', tasksPath,
				'--parent', '1',
				'--task-id', '3',
				'--skip-generate'
			],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Converting task 3');
		expect(result.stdout).toContain('successfully converted');

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const parentTask = updatedTasks.master.tasks.find(t => t.id === 1);
		const originalTask3 = updatedTasks.master.tasks.find(t => t.id === 3);

		// Verify task 3 was removed from top-level tasks
		expect(originalTask3).toBeUndefined();

		// Verify task 3 is now a subtask of task 1
		expect(parentTask.subtasks).toHaveLength(1);
		const convertedSubtask = parentTask.subtasks[0];
		expect(convertedSubtask.description).toBe('Task to be converted');
	});

	it('should fail when parent ID is not provided', async () => {
		// Run add-subtask command without parent
		const result = await runCommand(
			'add-subtask',
			[
				'-f', tasksPath,
				'--title', 'Orphan subtask'
			],
			testDir
		);

		// Should fail
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Error');
		expect(result.stderr).toContain('--parent parameter is required');
	});

	it('should fail when neither task-id nor title is provided', async () => {
		// Run add-subtask command without task-id or title
		const result = await runCommand(
			'add-subtask',
			[
				'-f', tasksPath,
				'--parent', '1'
			],
			testDir
		);

		// Should fail
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Error');
		expect(result.stderr).toContain('Either --task-id or --title must be provided');
	});

	it('should handle non-existent parent task', async () => {
		// Run add-subtask command with non-existent parent
		const result = await runCommand(
			'add-subtask',
			[
				'-f', tasksPath,
				'--parent', '999',
				'--title', 'Lost subtask'
			],
			testDir
		);

		// Should fail
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Error');
	});

	it('should handle non-existent task ID for conversion', async () => {
		// Run add-subtask command with non-existent task-id
		const result = await runCommand(
			'add-subtask',
			[
				'-f', tasksPath,
				'--parent', '1',
				'--task-id', '999'
			],
			testDir
		);

		// Should fail
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Error');
	});

	it('should work with tag option', async () => {
		// Create tasks with different tags
		const multiTagTasks = {
			master: {
				tasks: [{
					id: 1,
					description: 'Master task',
					subtasks: []
				}]
			},
			feature: {
				tasks: [{
					id: 1,
					description: 'Feature task',
					subtasks: []
				}]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Add subtask to feature tag
		const result = await runCommand(
			'add-subtask',
			[
				'-f', tasksPath,
				'--parent', '1',
				'--title', 'Feature subtask',
				'--tag', 'feature',
				'--skip-generate'
			],
			testDir
		);

		expect(result.code).toBe(0);

		// Verify only feature tag was affected
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedTasks.master.tasks[0].subtasks).toHaveLength(0);
		expect(updatedTasks.feature.tasks[0].subtasks).toHaveLength(1);
		expect(updatedTasks.feature.tasks[0].subtasks[0].title).toBe('Feature subtask');
	});
});