import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment, runCommand } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs';

describe('next command', () => {
	let testDir;
	let tasksPath;
	let complexityReportPath;

	beforeAll(() => {
		testDir = setupTestEnvironment('next-command');
		tasksPath = path.join(testDir, '.taskmaster', 'tasks-master.json');
		complexityReportPath = path.join(testDir, '.taskmaster', 'complexity-report.json');
	});

	afterAll(() => {
		cleanupTestEnvironment(testDir);
	});

	it('should show the next available task', async () => {
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Completed task',
						status: 'done',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Next available task',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 3,
						description: 'Blocked task',
						status: 'pending',
						priority: 'medium',
						dependencies: [2],
						subtasks: []
					}
				]
			}
		};

		// Ensure .taskmaster directory exists
		fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run next command
		const result = await runCommand(
			'next',
			['-f', tasksPath],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Next Task');
		expect(result.stdout).toContain('Task 2');
		expect(result.stdout).toContain('Next available task');
		expect(result.stdout).toContain('Status: pending');
		expect(result.stdout).toContain('Priority: high');
	});

	it('should prioritize tasks based on complexity report', async () => {
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Low complexity task',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'High complexity task',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		// Create complexity report
		const complexityReport = {
			tasks: [
				{
					id: 1,
					complexity: {
						score: 3,
						factors: {
							technical: 'low',
							scope: 'small'
						}
					}
				},
				{
					id: 2,
					complexity: {
						score: 8,
						factors: {
							technical: 'high',
							scope: 'large'
						}
					}
				}
			]
		};

		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));
		fs.writeFileSync(complexityReportPath, JSON.stringify(complexityReport, null, 2));

		// Run next command with complexity report
		const result = await runCommand(
			'next',
			['-f', tasksPath, '-r', complexityReportPath],
			testDir
		);

		// Should prioritize lower complexity task
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Task 1');
		expect(result.stdout).toContain('Low complexity task');
	});

	it('should handle dependencies correctly', async () => {
		// Create test tasks with dependencies
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Prerequisite task',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Dependent task',
						status: 'pending',
						priority: 'critical',
						dependencies: [1],
						subtasks: []
					},
					{
						id: 3,
						description: 'Independent task',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run next command
		const result = await runCommand(
			'next',
			['-f', tasksPath],
			testDir
		);

		// Should show task 1 (prerequisite) even though task 2 has higher priority
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Task 1');
		expect(result.stdout).toContain('Prerequisite task');
	});

	it('should skip in-progress tasks', async () => {
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'In progress task',
						status: 'in_progress',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Available pending task',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run next command
		const result = await runCommand(
			'next',
			['-f', tasksPath],
			testDir
		);

		// Should show pending task, not in-progress
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Task 2');
		expect(result.stdout).toContain('Available pending task');
	});

	it('should handle all tasks completed', async () => {
		// Create test tasks - all done
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Completed task 1',
						status: 'done',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Completed task 2',
						status: 'done',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run next command
		const result = await runCommand(
			'next',
			['-f', tasksPath],
			testDir
		);

		// Should indicate no tasks available
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('All tasks are completed');
	});

	it('should handle blocked tasks', async () => {
		// Create test tasks - all blocked
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Blocked task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [2],
						subtasks: []
					},
					{
						id: 2,
						description: 'Blocked task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1],
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run next command
		const result = await runCommand(
			'next',
			['-f', tasksPath],
			testDir
		);

		// Should indicate circular dependency or all blocked
		expect(result.code).toBe(0);
		expect(result.stdout.toLowerCase()).toMatch(/circular|blocked|no.*available/);
	});

	it('should work with tag option', async () => {
		// Create tasks with different tags
		const multiTagTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Master task',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					}
				]
			},
			feature: {
				tasks: [
					{
						id: 1,
						description: 'Feature task',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Run next command with feature tag
		const result = await runCommand(
			'next',
			['-f', tasksPath, '--tag', 'feature'],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Feature task');
		expect(result.stdout).not.toContain('Master task');
	});

	it('should handle empty task list', async () => {
		// Create empty tasks file
		const emptyTasks = {
			master: {
				tasks: []
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(emptyTasks, null, 2));

		// Run next command
		const result = await runCommand(
			'next',
			['-f', tasksPath],
			testDir
		);

		// Should handle gracefully
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('No tasks');
	});
});