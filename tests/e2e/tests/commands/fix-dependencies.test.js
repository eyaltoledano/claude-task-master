import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment, runCommand } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs';

describe('fix-dependencies command', () => {
	let testDir;
	let tasksPath;

	beforeAll(() => {
		testDir = setupTestEnvironment('fix-dependencies-command');
		tasksPath = path.join(testDir, '.taskmaster', 'tasks-master.json');
	});

	afterAll(() => {
		cleanupTestEnvironment(testDir);
	});

	beforeEach(() => {
		// Ensure .taskmaster directory exists
		fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
	});

	it('should fix missing dependencies by removing them', async () => {
		// Create test tasks with missing dependencies
		const tasksWithMissingDeps = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [999, 888], // Non-existent tasks
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1, 777], // Mix of valid and invalid
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(tasksWithMissingDeps, null, 2));

		// Run fix-dependencies command
		const result = await runCommand(
			'fix-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Fixing dependencies');
		expect(result.stdout).toContain('Fixed');

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task1 = updatedTasks.master.tasks.find(t => t.id === 1);
		const task2 = updatedTasks.master.tasks.find(t => t.id === 2);

		// Verify missing dependencies were removed
		expect(task1.dependencies).toEqual([]);
		expect(task2.dependencies).toEqual([1]); // Only valid dependency remains
	});

	it('should fix circular dependencies', async () => {
		// Create test tasks with circular dependencies
		const circularTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [3], // Circular: 1 -> 3 -> 2 -> 1
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1],
						subtasks: []
					},
					{
						id: 3,
						description: 'Task 3',
						status: 'pending',
						priority: 'low',
						dependencies: [2],
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(circularTasks, null, 2));

		// Run fix-dependencies command
		const result = await runCommand(
			'fix-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Fixed circular dependency');

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		
		// At least one dependency in the circle should be removed
		const dependencies = [
			updatedTasks.master.tasks.find(t => t.id === 1).dependencies,
			updatedTasks.master.tasks.find(t => t.id === 2).dependencies,
			updatedTasks.master.tasks.find(t => t.id === 3).dependencies
		];

		// Verify circular dependency was broken
		const totalDeps = dependencies.reduce((sum, deps) => sum + deps.length, 0);
		expect(totalDeps).toBeLessThan(3); // At least one dependency removed
	});

	it('should fix self-dependencies', async () => {
		// Create test tasks with self-dependencies
		const selfDepTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [1, 2], // Self-dependency + valid dependency
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(selfDepTasks, null, 2));

		// Run fix-dependencies command
		const result = await runCommand(
			'fix-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Fixed');

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task1 = updatedTasks.master.tasks.find(t => t.id === 1);

		// Verify self-dependency was removed
		expect(task1.dependencies).toEqual([2]);
	});

	it('should fix subtask dependencies', async () => {
		// Create test tasks with invalid subtask dependencies
		const subtaskDepTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: [
							{
								id: 1,
								description: 'Subtask 1.1',
								status: 'pending',
								priority: 'medium',
								dependencies: ['999', '1.1'] // Invalid + self-dependency
							},
							{
								id: 2,
								description: 'Subtask 1.2',
								status: 'pending',
								priority: 'low',
								dependencies: ['1.1'] // Valid
							}
						]
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(subtaskDepTasks, null, 2));

		// Run fix-dependencies command
		const result = await runCommand(
			'fix-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Fixed');

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task1 = updatedTasks.master.tasks.find(t => t.id === 1);
		const subtask1 = task1.subtasks.find(s => s.id === 1);
		const subtask2 = task1.subtasks.find(s => s.id === 2);

		// Verify invalid dependencies were removed
		expect(subtask1.dependencies).toEqual([]);
		expect(subtask2.dependencies).toEqual(['1.1']); // Valid dependency remains
	});

	it('should handle tasks with no dependency issues', async () => {
		// Create test tasks with valid dependencies
		const validTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1],
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(validTasks, null, 2));

		// Run fix-dependencies command
		const result = await runCommand(
			'fix-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Should succeed with no changes
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('No dependency issues found');

		// Verify tasks remain unchanged
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedTasks).toEqual(validTasks);
	});

	it('should work with tag option', async () => {
		// Create tasks with different tags
		const multiTagTasks = {
			master: {
				tasks: [{
					id: 1,
					description: 'Master task',
					dependencies: [999] // Invalid
				}]
			},
			feature: {
				tasks: [{
					id: 1,
					description: 'Feature task',
					dependencies: [888] // Invalid
				}]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Fix dependencies in feature tag only
		const result = await runCommand(
			'fix-dependencies',
			['-f', tasksPath, '--tag', 'feature'],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Fixed');

		// Verify only feature tag was fixed
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedTasks.master.tasks[0].dependencies).toEqual([999]); // Unchanged
		expect(updatedTasks.feature.tasks[0].dependencies).toEqual([]); // Fixed
	});

	it('should handle complex dependency chains', async () => {
		// Create test tasks with complex invalid dependencies
		const complexTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [2, 999], // Valid + invalid
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [3, 4], // All valid
						subtasks: []
					},
					{
						id: 3,
						description: 'Task 3',
						status: 'pending',
						priority: 'low',
						dependencies: [1], // Creates indirect cycle
						subtasks: []
					},
					{
						id: 4,
						description: 'Task 4',
						status: 'pending',
						priority: 'low',
						dependencies: [888, 777], // All invalid
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(complexTasks, null, 2));

		// Run fix-dependencies command
		const result = await runCommand(
			'fix-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Fixed');

		// Read updated tasks
		const updatedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const task1 = updatedTasks.master.tasks.find(t => t.id === 1);
		const task4 = updatedTasks.master.tasks.find(t => t.id === 4);

		// Verify invalid dependencies were removed
		expect(task1.dependencies).not.toContain(999);
		expect(task4.dependencies).toEqual([]);
	});

	it('should handle empty task list', async () => {
		// Create empty tasks file
		const emptyTasks = {
			master: {
				tasks: []
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(emptyTasks, null, 2));

		// Run fix-dependencies command
		const result = await runCommand(
			'fix-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Should handle gracefully
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('No tasks');
	});
});