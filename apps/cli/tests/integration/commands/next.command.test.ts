/**
 * @fileoverview Integration tests for 'task-master next' command
 *
 * Tests the next command which finds the next available task based on dependencies.
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

describe('next command', () => {
	let testDir: string;
	let tasksPath: string;
	let binPath: string;

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-next-test-'));
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

	const runNext = (): { output: string; exitCode: number } => {
		try {
			const output = execSync(`node "${binPath}" next`, {
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

	it('should find first pending task with no dependencies', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'First Available Task',
					description: 'No dependencies',
					status: 'pending'
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		expect(output).toContain('First Available Task');
	});

	it('should return task when dependencies are completed', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Prerequisite', status: 'done' }),
				createTask({
					id: 2,
					title: 'Ready Task',
					description: 'Dependencies met',
					status: 'pending',
					dependencies: ['1']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		expect(output).toContain('Ready Task');
	});

	it('should skip tasks with incomplete dependencies', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Foundation Task', status: 'pending' }),
				createTask({
					id: 2,
					title: 'Blocked Task',
					status: 'pending',
					dependencies: ['1']
				}),
				createTask({ id: 3, title: 'Independent Task', status: 'pending' })
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		// Should return either task 1 or task 3 (both have no dependencies)
		const hasFoundation = output.includes('Foundation Task');
		const hasIndependent = output.includes('Independent Task');
		expect(hasFoundation || hasIndependent).toBe(true);
		expect(output).not.toContain('Blocked Task');
	});

	it('should handle complex dependency chain', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Level 1', status: 'done' }),
				createTask({
					id: 2,
					title: 'Level 2',
					status: 'done',
					dependencies: ['1']
				}),
				createTask({
					id: 3,
					title: 'Level 3 - Next',
					description: 'Should be next',
					status: 'pending',
					dependencies: ['1', '2']
				}),
				createTask({
					id: 4,
					title: 'Level 3 - Blocked',
					status: 'pending',
					dependencies: ['3']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		expect(output).toContain('Level 3 - Next');
		expect(output).not.toContain('Blocked');
	});

	it('should skip already completed tasks', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Already Done', status: 'done' }),
				createTask({ id: 2, title: 'Also Done', status: 'done' }),
				createTask({ id: 3, title: 'Next Up', status: 'pending' })
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		expect(output).toContain('Next Up');
		expect(output).not.toContain('Already Done');
		expect(output).not.toContain('Also Done');
	});

	it('should handle empty task list', () => {
		const testData = createTasksFile();
		writeTasks(testData);

		const { output } = runNext();

		expect(output.toLowerCase()).toContain('no');
	});

	it('should handle all tasks completed', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Done 1', status: 'done' }),
				createTask({ id: 2, title: 'Done 2', status: 'done' }),
				createTask({ id: 3, title: 'Done 3', status: 'done' })
			]
		});
		writeTasks(testData);

		const { output } = runNext();

		expect(output.toLowerCase()).toContain('no');
	});

	it('should find first task in linear dependency chain', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Step 1', status: 'done' }),
				createTask({
					id: 2,
					title: 'Step 2',
					status: 'done',
					dependencies: ['1']
				}),
				createTask({
					id: 3,
					title: 'Step 3',
					status: 'pending',
					dependencies: ['2']
				}),
				createTask({
					id: 4,
					title: 'Step 4',
					status: 'pending',
					dependencies: ['3']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		expect(output).toContain('Step 3');
		expect(output).not.toContain('Step 4');
	});

	it('should find task among multiple ready tasks', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Foundation', status: 'done' }),
				createTask({
					id: 2,
					title: 'Ready Task A',
					status: 'pending',
					dependencies: ['1']
				}),
				createTask({
					id: 3,
					title: 'Ready Task B',
					status: 'pending',
					dependencies: ['1']
				}),
				createTask({
					id: 4,
					title: 'Ready Task C',
					status: 'pending',
					dependencies: ['1']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		// Should return one of the ready tasks
		const hasReadyA = output.includes('Ready Task A');
		const hasReadyB = output.includes('Ready Task B');
		const hasReadyC = output.includes('Ready Task C');
		expect(hasReadyA || hasReadyB || hasReadyC).toBe(true);
	});
});
