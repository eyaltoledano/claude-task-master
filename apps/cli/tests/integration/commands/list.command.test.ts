/**
 * @fileoverview Integration tests for 'task-master list' command
 *
 * Tests the list command which displays all tasks with optional filtering.
 *
 * @integration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSubtask, createTask, createTasksFile } from '@tm/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCliBinPath } from '../../helpers/test-utils.js';

// Capture initial working directory at module load time
const initialCwd = process.cwd();

describe('list command', () => {
	let testDir: string;
	let tasksPath: string;
	let binPath: string;

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-list-test-'));
		process.chdir(testDir);
		process.env.TASKMASTER_SKIP_AUTO_UPDATE = '1';

		binPath = getCliBinPath();

		execSync(`node "${binPath}" init --yes`, {
			stdio: 'pipe',
			env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
		});

		tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');

		// Use fixture to create initial empty tasks file
		const initialTasks = createTasksFile();
		fs.writeFileSync(tasksPath, JSON.stringify(initialTasks, null, 2));
	});

	afterEach(() => {
		try {
			// Restore to the original working directory captured at module load
			process.chdir(initialCwd);
		} catch {
			// Fallback to home directory if initial directory no longer exists
			process.chdir(os.homedir());
		}

		if (testDir && fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}

		delete process.env.TASKMASTER_SKIP_AUTO_UPDATE;
	});

	const writeTasks = (tasksData: any) => {
		fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
	};

	const runList = (args = ''): { output: string; exitCode: number } => {
		try {
			const output = execSync(`node "${binPath}" list ${args}`, {
				encoding: 'utf-8',
				stdio: 'pipe',
				env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
			});
			return { output, exitCode: 0 };
		} catch (error: any) {
			return {
				output: error.stderr?.toString() || error.stdout?.toString() || '',
				exitCode: error.status || 1
			};
		}
	};

	it('should display message when no tasks exist', () => {
		const { output, exitCode } = runList();

		expect(exitCode).toBe(0);
		expect(output).toContain('No tasks found');
	});

	it('should list all tasks with correct information', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Setup Environment',
					description: 'Install and configure',
					status: 'done',
					priority: 'high'
				}),
				createTask({
					id: 2,
					title: 'Write Tests',
					description: 'Create test suite',
					status: 'in-progress',
					priority: 'high',
					dependencies: ['1']
				}),
				createTask({
					id: 3,
					title: 'Implement Feature',
					description: 'Build the thing',
					status: 'pending',
					priority: 'medium',
					dependencies: ['2']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runList();

		expect(exitCode).toBe(0);
		expect(output).toContain('Setup Environment');
		expect(output).toContain('Write Tests');
		expect(output).toContain('Implement Feature');
	});

	it('should display task statuses', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Done Task',
					status: 'done',
					priority: 'high'
				}),
				createTask({
					id: 2,
					title: 'Pending Task',
					status: 'pending',
					priority: 'high'
				}),
				createTask({
					id: 3,
					title: 'In Progress',
					status: 'in-progress',
					priority: 'high'
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runList();

		expect(exitCode).toBe(0);
		// Should show status indicators (exact format may vary)
		expect(output.toLowerCase()).toContain('done');
		expect(output.toLowerCase()).toContain('pending');
		expect(output.toLowerCase()).toContain('progress');
	});

	it('should show subtasks when --with-subtasks flag is used', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Parent Task',
					status: 'in-progress',
					subtasks: [
						createSubtask({
							id: '1.1',
							title: 'First Subtask',
							status: 'done',
							parentId: '1'
						}),
						createSubtask({
							id: '1.2',
							title: 'Second Subtask',
							status: 'pending',
							parentId: '1'
						})
					]
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runList('--with-subtasks');

		expect(exitCode).toBe(0);
		expect(output).toContain('Parent Task');
		expect(output).toContain('First Subtask');
		expect(output).toContain('Second Subtask');
	});

	it('should handle tasks with dependencies', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Foundation', status: 'done' }),
				createTask({
					id: 2,
					title: 'Dependent Task',
					status: 'pending',
					dependencies: ['1']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runList();

		expect(exitCode).toBe(0);
		expect(output).toContain('Foundation');
		expect(output).toContain('Dependent Task');
	});

	it('should display multiple tasks in order', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Task One', status: 'pending' }),
				createTask({ id: 2, title: 'Task Two', status: 'pending' }),
				createTask({ id: 3, title: 'Task Three', status: 'pending' }),
				createTask({ id: 4, title: 'Task Four', status: 'pending' }),
				createTask({ id: 5, title: 'Task Five', status: 'pending' })
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runList();

		expect(exitCode).toBe(0);
		expect(output).toContain('Task One');
		expect(output).toContain('Task Two');
		expect(output).toContain('Task Three');
		expect(output).toContain('Task Four');
		expect(output).toContain('Task Five');
	});

	describe('error handling - validation errors should surface to CLI', () => {
		it('should display validation error when task has missing description', () => {
			// Create intentionally invalid task data bypassing fixtures
			const testData = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Invalid Task',
							description: '', // ❌ Invalid - empty description
							status: 'pending',
							priority: 'high',
							dependencies: [],
							details: '',
							testStrategy: '',
							subtasks: []
						}
					],
					metadata: {
						version: '1.0.0',
						lastModified: new Date().toISOString(),
						taskCount: 1,
						completedCount: 0
					}
				}
			};
			writeTasks(testData);

			const { output, exitCode } = runList();

			expect(exitCode).toBe(1);
			expect(output.toLowerCase()).toContain('description');
			expect(output.toLowerCase()).toContain('required');
			// Should NOT contain the generic wrapped error message
			expect(output).not.toContain('Failed to get task list');
		});

		it('should display validation error when task has missing title', () => {
			const testData = {
				master: {
					tasks: [
						{
							id: 1,
							title: '', // ❌ Invalid - empty title
							description: 'A task without a title',
							status: 'pending',
							priority: 'high',
							dependencies: [],
							details: '',
							testStrategy: '',
							subtasks: []
						}
					],
					metadata: {
						version: '1.0.0',
						lastModified: new Date().toISOString(),
						taskCount: 1,
						completedCount: 0
					}
				}
			};
			writeTasks(testData);

			const { output, exitCode } = runList();

			expect(exitCode).toBe(1);
			expect(output.toLowerCase()).toContain('title');
			expect(output.toLowerCase()).toContain('required');
			expect(output).not.toContain('Failed to get task list');
		});

		it('should display validation error when task has only whitespace in description', () => {
			const testData = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Task with whitespace description',
							description: '   ', // ❌ Invalid - only whitespace
							status: 'pending',
							priority: 'high',
							dependencies: [],
							details: '',
							testStrategy: '',
							subtasks: []
						}
					],
					metadata: {
						version: '1.0.0',
						lastModified: new Date().toISOString(),
						taskCount: 1,
						completedCount: 0
					}
				}
			};
			writeTasks(testData);

			const { output, exitCode } = runList();

			expect(exitCode).toBe(1);
			expect(output.toLowerCase()).toContain('description');
			expect(output.toLowerCase()).toContain('required');
		});

		it('should display validation error for first invalid task when multiple tasks exist', () => {
			const testData = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Valid Task',
							description: 'This one is fine',
							status: 'pending',
							priority: 'high',
							dependencies: [],
							details: '',
							testStrategy: '',
							subtasks: []
						},
						{
							id: 2,
							title: 'Invalid Task',
							description: '', // ❌ Invalid - this should trigger error
							status: 'pending',
							priority: 'high',
							dependencies: [],
							details: '',
							testStrategy: '',
							subtasks: []
						},
						{
							id: 3,
							title: 'Another Valid Task',
							description: 'This would be fine too',
							status: 'pending',
							priority: 'high',
							dependencies: [],
							details: '',
							testStrategy: '',
							subtasks: []
						}
					],
					metadata: {
						version: '1.0.0',
						lastModified: new Date().toISOString(),
						taskCount: 3,
						completedCount: 0
					}
				}
			};
			writeTasks(testData);

			const { output, exitCode } = runList();

			expect(exitCode).toBe(1);
			expect(output.toLowerCase()).toContain('description');
			expect(output.toLowerCase()).toContain('required');
		});

		it('should handle all valid tasks without errors', () => {
			// This test verifies the fix doesn't break valid scenarios
			const testData = createTasksFile({
				tasks: [
					createTask({
						id: 1,
						title: 'Valid Task 1',
						description: 'This task is valid',
						status: 'pending',
						priority: 'high'
					}),
					createTask({
						id: 2,
						title: 'Valid Task 2',
						description: 'This task is also valid',
						status: 'done',
						priority: 'medium'
					})
				]
			});
			writeTasks(testData);

			const { output, exitCode } = runList();

			expect(exitCode).toBe(0);
			expect(output).toContain('Valid Task 1');
			expect(output).toContain('Valid Task 2');
		});
	});
});
