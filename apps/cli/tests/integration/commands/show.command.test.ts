/**
 * @fileoverview Integration tests for 'task-master show' command
 *
 * Tests the show command which displays detailed information about a specific task.
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

describe('show command', () => {
	let testDir: string;
	let tasksPath: string;
	let binPath: string;

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-show-test-'));
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

	const runShow = (taskId: string): { output: string; exitCode: number } => {
		try {
			const output = execSync(`node "${binPath}" show ${taskId}`, {
				encoding: 'utf-8',
				stdio: 'pipe',
				env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
			});
			return { output, exitCode: 0 };
		} catch (error: any) {
			// For errors, prioritize stderr (where error messages go)
			return {
				output: error.stderr?.toString() || error.stdout?.toString() || '',
				exitCode: error.status || 1
			};
		}
	};

	it('should display complete task details', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Detailed Task',
					description: 'A comprehensive task description',
					status: 'pending',
					priority: 'high',
					details: 'Implementation details go here',
					testStrategy: 'Unit tests and integration tests'
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runShow('1');

		expect(exitCode).toBe(0);
		expect(output).toContain('Detailed Task');
		expect(output).toContain('A comprehensive task description');
		expect(output).toContain('pending');
		expect(output).toContain('high');
		expect(output).toContain('Implementation details');
		expect(output).toContain('Unit tests and integration tests');
	});

	it('should show task with dependencies', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'First Task', status: 'done' }),
				createTask({
					id: 2,
					title: 'Second Task',
					description: 'Depends on task 1',
					status: 'pending',
					dependencies: ['1']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runShow('2');

		expect(exitCode).toBe(0);
		expect(output).toContain('Second Task');
		expect(output).toContain('Depends on task 1');
	});

	it('should show task with subtasks', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Parent Task',
					description: 'Task with multiple subtasks',
					status: 'in-progress',
					subtasks: [
						createSubtask({
							id: '1.1',
							title: 'Setup Phase',
							description: 'Initial setup',
							status: 'done',
							parentId: '1'
						}),
						createSubtask({
							id: '1.2',
							title: 'Implementation Phase',
							description: 'Build feature',
							status: 'in-progress',
							dependencies: ['1.1'],
							parentId: '1'
						}),
						createSubtask({
							id: '1.3',
							title: 'Testing Phase',
							description: 'Write tests',
							status: 'pending',
							dependencies: ['1.2'],
							parentId: '1'
						})
					]
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runShow('1');

		expect(exitCode).toBe(0);
		expect(output).toContain('Parent Task');
		expect(output).toContain('Setup Phase');
		expect(output).toContain('Implementation Phase');
		expect(output).toContain('Testing Phase');
	});

	it('should show minimal task information', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Simple Task', status: 'pending' })]
		});
		writeTasks(testData);

		const { output, exitCode } = runShow('1');

		expect(exitCode).toBe(0);
		expect(output).toContain('Simple Task');
		expect(output).toContain('pending');
	});

	it('should show task with all status types', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Done Task', status: 'done' }),
				createTask({ id: 2, title: 'Pending Task', status: 'pending' }),
				createTask({ id: 3, title: 'In Progress', status: 'in-progress' }),
				createTask({ id: 4, title: 'Review Task', status: 'review' })
			]
		});
		writeTasks(testData);

		// Test each status
		let result = runShow('1');
		expect(result.exitCode).toBe(0);
		expect(result.output).toContain('Done Task');

		result = runShow('2');
		expect(result.exitCode).toBe(0);
		expect(result.output).toContain('Pending Task');

		result = runShow('3');
		expect(result.exitCode).toBe(0);
		expect(result.output).toContain('In Progress');

		result = runShow('4');
		expect(result.exitCode).toBe(0);
		expect(result.output).toContain('Review Task');
	});

	it('should show task with priority levels', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'High Priority',
					status: 'pending',
					priority: 'high'
				}),
				createTask({
					id: 2,
					title: 'Medium Priority',
					status: 'pending',
					priority: 'medium'
				}),
				createTask({
					id: 3,
					title: 'Low Priority',
					status: 'pending',
					priority: 'low'
				})
			]
		});
		writeTasks(testData);

		let result = runShow('1');
		expect(result.output).toContain('High Priority');
		expect(result.output).toContain('high');

		result = runShow('2');
		expect(result.output).toContain('Medium Priority');
		expect(result.output).toContain('medium');

		result = runShow('3');
		expect(result.output).toContain('Low Priority');
		expect(result.output).toContain('low');
	});
});
