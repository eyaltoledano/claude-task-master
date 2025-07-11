import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment, runCommand } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs';

describe('validate-dependencies command', () => {
	let testDir;
	let tasksPath;

	beforeAll(() => {
		testDir = setupTestEnvironment('validate-dependencies-command');
		tasksPath = path.join(testDir, '.taskmaster', 'tasks-master.json');
	});

	afterAll(() => {
		cleanupTestEnvironment(testDir);
	});

	it('should validate tasks with no dependency issues', async () => {
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
					},
					{
						id: 3,
						description: 'Task 3',
						status: 'pending',
						priority: 'low',
						dependencies: [1, 2],
						subtasks: []
					}
				]
			}
		};

		fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
		fs.writeFileSync(tasksPath, JSON.stringify(validTasks, null, 2));

		// Run validate-dependencies command
		const result = await runCommand(
			'validate-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Should succeed with no issues
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Validating dependencies');
		expect(result.stdout).toContain('All dependencies are valid');
	});

	it('should detect circular dependencies', async () => {
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

		// Run validate-dependencies command
		const result = await runCommand(
			'validate-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Should detect circular dependency
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Circular dependency detected');
		expect(result.stdout).toContain('Task 1');
		expect(result.stdout).toContain('Task 2');
		expect(result.stdout).toContain('Task 3');
	});

	it('should detect missing dependencies', async () => {
		// Create test tasks with missing dependencies
		const missingDepTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [999], // Non-existent task
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1, 888], // Mix of valid and invalid
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(missingDepTasks, null, 2));

		// Run validate-dependencies command
		const result = await runCommand(
			'validate-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Should detect missing dependencies
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('dependency issues found');
		expect(result.stdout).toContain('Task 1');
		expect(result.stdout).toContain('missing: 999');
		expect(result.stdout).toContain('Task 2');
		expect(result.stdout).toContain('missing: 888');
	});

	it('should validate subtask dependencies', async () => {
		// Create test tasks with subtask dependencies
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
								dependencies: ['999'] // Invalid dependency
							},
							{
								id: 2,
								description: 'Subtask 1.2',
								status: 'pending',
								priority: 'low',
								dependencies: ['1.1'] // Valid subtask dependency
							}
						]
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

		fs.writeFileSync(tasksPath, JSON.stringify(subtaskDepTasks, null, 2));

		// Run validate-dependencies command
		const result = await runCommand(
			'validate-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Should detect invalid subtask dependency
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('dependency issues found');
		expect(result.stdout).toContain('Subtask 1.1');
		expect(result.stdout).toContain('missing: 999');
	});

	it('should detect self-dependencies', async () => {
		// Create test tasks with self-dependencies
		const selfDepTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [1], // Self-dependency
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: [
							{
								id: 1,
								description: 'Subtask 2.1',
								status: 'pending',
								priority: 'low',
								dependencies: ['2.1'] // Self-dependency
							}
						]
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(selfDepTasks, null, 2));

		// Run validate-dependencies command
		const result = await runCommand(
			'validate-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Should detect self-dependencies
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('dependency issues found');
		expect(result.stdout).toContain('depends on itself');
	});

	it('should handle completed task dependencies', async () => {
		// Create test tasks where some dependencies are completed
		const completedDepTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'done',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1], // Depends on completed task (valid)
						subtasks: []
					},
					{
						id: 3,
						description: 'Task 3',
						status: 'done',
						priority: 'low',
						dependencies: [2], // Completed task depends on pending (might be flagged)
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(completedDepTasks, null, 2));

		// Run validate-dependencies command
		const result = await runCommand(
			'validate-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Check output
		expect(result.code).toBe(0);
		// Depending on implementation, might flag completed tasks with pending dependencies
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
					dependencies: [2] // Valid within tag
				}, {
					id: 2,
					description: 'Feature task 2',
					dependencies: []
				}]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Validate feature tag
		const result = await runCommand(
			'validate-dependencies',
			['-f', tasksPath, '--tag', 'feature'],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('All dependencies are valid');

		// Validate master tag
		const result2 = await runCommand(
			'validate-dependencies',
			['-f', tasksPath, '--tag', 'master'],
			testDir
		);

		expect(result2.code).toBe(0);
		expect(result2.stdout).toContain('dependency issues found');
		expect(result2.stdout).toContain('missing: 999');
	});

	it('should handle empty task list', async () => {
		// Create empty tasks file
		const emptyTasks = {
			master: {
				tasks: []
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(emptyTasks, null, 2));

		// Run validate-dependencies command
		const result = await runCommand(
			'validate-dependencies',
			['-f', tasksPath],
			testDir
		);

		// Should handle gracefully
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('No tasks');
	});
});