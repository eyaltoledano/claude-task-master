import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment, runCommand } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs';

describe('remove-dependency command', () => {
	let testDir;
	let tasksPath;

	beforeAll(() => {
		testDir = setupTestEnvironment('remove-dependency-command');
		tasksPath = path.join(testDir, '.taskmaster', 'tasks-master.json');
	});

	afterAll(() => {
		cleanupTestEnvironment(testDir);
	});

	beforeEach(() => {
		// Create test tasks with dependencies
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1 - Independent',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2 - Depends on 1',
						status: 'pending',
						priority: 'medium',
						dependencies: [1],
						subtasks: []
					},
					{
						id: 3,
						description: 'Task 3 - Depends on 1 and 2',
						status: 'pending',
						priority: 'low',
						dependencies: [1, 2],
						subtasks: [
							{
								id: 1,
								description: 'Subtask 3.1',
								status: 'pending',
								priority: 'medium',
								dependencies: ['1', '2']
							}
						]
					},
					{
						id: 4,
						description: 'Task 4 - Complex dependencies',
						status: 'pending',
						priority: 'high',
						dependencies: [1, 2, 3],
						subtasks: []
					}
				]
			}
		};

		// Ensure .taskmaster directory exists
		fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));
	});

	it('should remove a dependency from a task', async () => {
		// Run remove-dependency command
		const result = await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '2', '-d', '1'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Removing dependency');
		expect(result.stdout).toContain('from task 2');

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task2 = updatedTasks.master.tasks.find(t => t.id === 2);

		// Verify dependency was removed
		expect(task2.dependencies).toEqual([]);
	});

	it('should remove one dependency while keeping others', async () => {
		// Run remove-dependency command to remove dependency 1 from task 3
		const result = await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '3', '-d', '1'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task3 = updatedTasks.master.tasks.find(t => t.id === 3);

		// Verify only dependency 1 was removed, dependency 2 remains
		expect(task3.dependencies).toEqual([2]);
	});

	it('should handle removing all dependencies from a task', async () => {
		// Remove all dependencies from task 4 one by one
		await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '4', '-d', '1'],
			testDir
		);

		await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '4', '-d', '2'],
			testDir
		);

		const result = await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '4', '-d', '3'],
			testDir
		);

		expect(result.code).toBe(0);

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task4 = updatedTasks.master.tasks.find(t => t.id === 4);

		// Verify all dependencies were removed
		expect(task4.dependencies).toEqual([]);
	});

	it('should handle subtask dependencies', async () => {
		// Run remove-dependency command for subtask
		const result = await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '3.1', '-d', '1'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task3 = updatedTasks.master.tasks.find(t => t.id === 3);
		const subtask = task3.subtasks.find(s => s.id === 1);

		// Verify subtask dependency was removed
		expect(subtask.dependencies).toEqual(['2']);
	});

	it('should fail when required parameters are missing', async () => {
		// Run without --id
		const result1 = await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-d', '1'],
			testDir
		);

		expect(result1.code).toBe(1);
		expect(result1.stderr).toContain('Error');
		expect(result1.stderr).toContain('Both --id and --depends-on are required');

		// Run without --depends-on
		const result2 = await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '2'],
			testDir
		);

		expect(result2.code).toBe(1);
		expect(result2.stderr).toContain('Error');
		expect(result2.stderr).toContain('Both --id and --depends-on are required');
	});

	it('should handle removing non-existent dependency', async () => {
		// Try to remove a dependency that doesn't exist
		const result = await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '1', '-d', '999'],
			testDir
		);

		// Should succeed (no-op)
		expect(result.code).toBe(0);

		// Task should remain unchanged
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task1 = updatedTasks.master.tasks.find(t => t.id === 1);
		expect(task1.dependencies).toEqual([]);
	});

	it('should handle non-existent task', async () => {
		// Try to remove dependency from non-existent task
		const result = await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '999', '-d', '1'],
			testDir
		);

		// Should fail gracefully
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
					dependencies: [2]
				}]
			},
			feature: {
				tasks: [{
					id: 1,
					description: 'Feature task',
					dependencies: [2, 3]
				}]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Remove dependency from feature tag
		const result = await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '1', '-d', '2', '--tag', 'feature'],
			testDir
		);

		expect(result.code).toBe(0);

		// Verify only feature tag was affected
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedTasks.master.tasks[0].dependencies).toEqual([2]);
		expect(updatedTasks.feature.tasks[0].dependencies).toEqual([3]);
	});

	it('should handle mixed dependency types', async () => {
		// Create task with mixed dependency types (numbers and strings)
		const mixedTasks = {
			master: {
				tasks: [{
					id: 5,
					description: 'Task with mixed deps',
					dependencies: [1, '2', 3, '4.1'],
					subtasks: []
				}]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(mixedTasks, null, 2));

		// Remove string dependency
		const result = await runCommand(
			'remove-dependency',
			['-f', tasksPath, '-i', '5', '-d', '4.1'],
			testDir
		);

		expect(result.code).toBe(0);

		// Verify correct dependency was removed
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task5 = updatedTasks.master.tasks.find(t => t.id === 5);
		expect(task5.dependencies).toEqual([1, '2', 3]);
	});
});