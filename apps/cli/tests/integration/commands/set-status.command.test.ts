/**
 * @fileoverview Integration tests for 'task-master set-status' command
 *
 * Tests the set-status command which updates task status.
 * Extracted from task-lifecycle.test.ts for better organization.
 *
 * @integration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTask, createTasksFile } from '@tm/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCliBinPath } from '../../helpers/test-utils.js';

// Capture initial working directory at module load time
const initialCwd = process.cwd();

describe('set-status command', () => {
	let testDir: string;
	let tasksPath: string;
	let binPath: string;

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-status-test-'));
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

	const readTasks = () => {
		const content = fs.readFileSync(tasksPath, 'utf-8');
		return JSON.parse(content);
	};

	const writeTasks = (tasksData: any) => {
		fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
	};

	const runSetStatus = (id: number, status: string) => {
		return execSync(
			`node "${binPath}" set-status --id=${id} --status=${status}`,
			{
				stdio: 'pipe',
				env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
			}
		);
	};

	it('should update task status from pending to done', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Task to Complete',
					description: 'A task we will mark as done',
					status: 'pending',
					priority: 'high',
					details: 'Implementation details',
					testStrategy: 'Test strategy'
				})
			]
		});
		writeTasks(testData);

		runSetStatus(1, 'done');

		const tasks = readTasks();
		const updatedTask = tasks.master.tasks.find((t: any) => t.id == 1);
		expect(updatedTask).toBeDefined();
		expect(updatedTask.status).toBe('done');
		expect(updatedTask.title).toBe('Task to Complete');
	});

	it('should handle multiple status changes in sequence', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Task', status: 'pending' })]
		});
		writeTasks(testData);

		runSetStatus(1, 'in-progress');
		let tasks = readTasks();
		expect(tasks.master.tasks[0].status).toBe('in-progress');

		runSetStatus(1, 'review');
		tasks = readTasks();
		expect(tasks.master.tasks[0].status).toBe('review');

		runSetStatus(1, 'done');
		tasks = readTasks();
		expect(tasks.master.tasks[0].status).toBe('done');
	});

	it('should reject invalid status values', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Task', status: 'pending' })]
		});
		writeTasks(testData);

		expect(() => {
			runSetStatus(1, 'invalid');
		}).toThrow();

		const tasks = readTasks();
		expect(tasks.master.tasks[0].status).toBe('pending');
	});

	it('should update status to all valid values', () => {
		const validStatuses = [
			'pending',
			'in-progress',
			'done',
			'review',
			'deferred',
			'cancelled'
		];

		for (const status of validStatuses) {
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Test', status: 'pending' })]
			});
			writeTasks(testData);

			runSetStatus(1, status);

			const tasks = readTasks();
			expect(tasks.master.tasks[0].status).toBe(status);
		}
	});

	it('should preserve other task fields when updating status', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Preserve Fields',
					description: 'Original description',
					status: 'pending',
					priority: 'high',
					dependencies: ['2'],
					details: 'Original details',
					testStrategy: 'Original strategy'
				})
			]
		});
		writeTasks(testData);

		runSetStatus(1, 'done');

		const tasks = readTasks();
		const task = tasks.master.tasks[0];
		expect(task.status).toBe('done');
		expect(task.title).toBe('Preserve Fields');
		expect(task.description).toBe('Original description');
		expect(task.priority).toBe('high');
		expect(task.dependencies).toEqual(['2']);
		expect(task.details).toBe('Original details');
		expect(task.testStrategy).toBe('Original strategy');
	});

	it('should handle multiple tasks correctly', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Task 1', status: 'pending' }),
				createTask({ id: 2, title: 'Task 2', status: 'pending' }),
				createTask({ id: 3, title: 'Task 3', status: 'pending' })
			]
		});
		writeTasks(testData);

		runSetStatus(2, 'done');

		const tasks = readTasks();
		expect(tasks.master.tasks[0].status).toBe('pending'); // Task 1 unchanged
		expect(tasks.master.tasks[1].status).toBe('done'); // Task 2 updated
		expect(tasks.master.tasks[2].status).toBe('pending'); // Task 3 unchanged
	});
});
