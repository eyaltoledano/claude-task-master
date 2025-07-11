import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment, runCommand } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs';

describe('clear-subtasks command', () => {
	let testDir;
	let tasksPath;

	beforeAll(() => {
		testDir = setupTestEnvironment('clear-subtasks-command');
		tasksPath = path.join(testDir, '.taskmaster', 'tasks-master.json');
	});

	afterAll(() => {
		cleanupTestEnvironment(testDir);
	});

	beforeEach(() => {
		// Create test tasks with subtasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task with subtasks',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: [
							{
								id: 1.1,
								description: 'Subtask 1',
								status: 'pending',
								priority: 'medium'
							},
							{
								id: 1.2,
								description: 'Subtask 2',
								status: 'pending',
								priority: 'medium'
							}
						]
					},
					{
						id: 2,
						description: 'Another task with subtasks',
						status: 'in_progress',
						priority: 'medium',
						dependencies: [],
						subtasks: [
							{
								id: 2.1,
								description: 'Subtask 2.1',
								status: 'pending',
								priority: 'low'
							}
						]
					},
					{
						id: 3,
						description: 'Task without subtasks',
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

	it('should clear subtasks from a specific task', async () => {
		// Run clear-subtasks command for task 1
		const result = await runCommand(
			'clear-subtasks',
			['-f', tasksPath, '-i', '1'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Clearing subtasks');
		expect(result.stdout).toContain('task 1');

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task1 = updatedTasks.master.tasks.find(t => t.id === 1);
		const task2 = updatedTasks.master.tasks.find(t => t.id === 2);

		// Verify task 1 has no subtasks
		expect(task1.subtasks).toHaveLength(0);

		// Verify task 2 still has subtasks
		expect(task2.subtasks).toHaveLength(1);
	});

	it('should clear subtasks from multiple tasks', async () => {
		// Run clear-subtasks command for tasks 1 and 2
		const result = await runCommand(
			'clear-subtasks',
			['-f', tasksPath, '-i', '1,2'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Clearing subtasks');
		expect(result.stdout).toContain('tasks 1, 2');

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task1 = updatedTasks.master.tasks.find(t => t.id === 1);
		const task2 = updatedTasks.master.tasks.find(t => t.id === 2);

		// Verify both tasks have no subtasks
		expect(task1.subtasks).toHaveLength(0);
		expect(task2.subtasks).toHaveLength(0);
	});

	it('should clear subtasks from all tasks with --all flag', async () => {
		// Run clear-subtasks command with --all
		const result = await runCommand(
			'clear-subtasks',
			['-f', tasksPath, '--all'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Clearing subtasks');
		expect(result.stdout).toContain('all tasks');

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		
		// Verify all tasks have no subtasks
		updatedTasks.master.tasks.forEach(task => {
			expect(task.subtasks).toHaveLength(0);
		});
	});

	it('should handle task without subtasks gracefully', async () => {
		// Run clear-subtasks command for task 3 (which has no subtasks)
		const result = await runCommand(
			'clear-subtasks',
			['-f', tasksPath, '-i', '3'],
			testDir
		);

		// Should succeed without error
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Clearing subtasks');

		// Task should remain unchanged
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task3 = updatedTasks.master.tasks.find(t => t.id === 3);
		expect(task3.subtasks).toHaveLength(0);
	});

	it('should fail when neither --id nor --all is specified', async () => {
		// Run clear-subtasks command without specifying tasks
		const result = await runCommand(
			'clear-subtasks',
			['-f', tasksPath],
			testDir
		);

		// Should fail with error
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Error');
		expect(result.stderr).toContain('Please specify task IDs');
	});

	it('should handle non-existent task ID', async () => {
		// Run clear-subtasks command with non-existent task ID
		const result = await runCommand(
			'clear-subtasks',
			['-f', tasksPath, '-i', '999'],
			testDir
		);

		// Should handle gracefully
		expect(result.code).toBe(0);
		// Original tasks should remain unchanged
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedTasks.master.tasks).toHaveLength(3);
	});

	it('should work with tag option', async () => {
		// Create tasks with different tags
		const multiTagTasks = {
			master: {
				tasks: [{
					id: 1,
					description: 'Master task',
					subtasks: [{ id: 1.1, description: 'Master subtask' }]
				}]
			},
			feature: {
				tasks: [{
					id: 1,
					description: 'Feature task',
					subtasks: [{ id: 1.1, description: 'Feature subtask' }]
				}]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Clear subtasks from feature tag
		const result = await runCommand(
			'clear-subtasks',
			['-f', tasksPath, '-i', '1', '--tag', 'feature'],
			testDir
		);

		expect(result.code).toBe(0);

		// Verify only feature tag was affected
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedTasks.master.tasks[0].subtasks).toHaveLength(1);
		expect(updatedTasks.feature.tasks[0].subtasks).toHaveLength(0);
	});
});