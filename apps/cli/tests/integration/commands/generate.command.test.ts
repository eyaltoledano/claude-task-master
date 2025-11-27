/**
 * @fileoverview Integration tests for 'task-master generate' command
 *
 * Tests CLI-specific behavior: argument parsing, output formatting, exit codes.
 * Core file generation logic is tested in tm-core's task-file-generator.service.spec.ts.
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

describe('generate command', () => {
	let testDir: string;
	let tasksPath: string;
	let binPath: string;

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-generate-test-'));
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

	const runGenerate = (args = ''): { output: string; exitCode: number } => {
		try {
			const output = execSync(`node "${binPath}" generate ${args}`, {
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

	// ========== CLI-specific tests ==========

	it('should exit with code 0 on success', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Test Task', status: 'pending' })]
		});
		writeTasks(testData);

		const { exitCode } = runGenerate();

		expect(exitCode).toBe(0);
	});

	it('should display user-friendly message when no tasks exist', () => {
		const { output, exitCode } = runGenerate();

		expect(exitCode).toBe(0);
		expect(output.toLowerCase()).toContain('no tasks');
	});

	it('should display task count in success message', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Task 1', status: 'pending' }),
				createTask({ id: 2, title: 'Task 2', status: 'pending' }),
				createTask({ id: 3, title: 'Task 3', status: 'pending' })
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runGenerate();

		expect(exitCode).toBe(0);
		expect(output).toContain('3');
	});

	it('should mention orphaned files in output when cleaned up', () => {
		// Create tasks and generate files
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Task 1', status: 'pending' }),
				createTask({ id: 2, title: 'Task 2', status: 'pending' }),
				createTask({ id: 3, title: 'Task 3', status: 'pending' })
			]
		});
		writeTasks(testData);
		runGenerate();

		// Remove task 3 and regenerate
		const reducedData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Task 1', status: 'pending' }),
				createTask({ id: 2, title: 'Task 2', status: 'pending' })
			]
		});
		writeTasks(reducedData);

		const { output, exitCode } = runGenerate();

		expect(exitCode).toBe(0);
		expect(output.toLowerCase()).toContain('orphan');
	});

	it('should support --format json flag', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Test Task', status: 'pending' })]
		});
		writeTasks(testData);

		const { output, exitCode } = runGenerate('--format json');

		expect(exitCode).toBe(0);

		// JSON output should be parseable and contain expected fields
		// Note: output may have leading/trailing whitespace or newlines
		const jsonMatch = output.match(/\{[\s\S]*\}/);
		expect(jsonMatch).not.toBeNull();

		const parsed = JSON.parse(jsonMatch![0]);
		expect(parsed.success).toBe(true);
		expect(parsed.count).toBe(1);
	});

	it('should support --output flag for custom directory', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Test Task', status: 'pending' })]
		});
		writeTasks(testData);

		const customDir = path.join(testDir, 'custom-tasks');

		const { exitCode } = runGenerate(`--output "${customDir}"`);

		expect(exitCode).toBe(0);
		// Verify file was created in custom directory
		expect(fs.existsSync(path.join(customDir, 'task_001.md'))).toBe(true);
	});

	it('should support --tag flag', () => {
		// Create tasks under a custom tag (not master)
		const testData = {
			master: { tasks: [], metadata: {} },
			'feature-branch': {
				tasks: [createTask({ id: 1, title: 'Test Task', status: 'pending' })],
				metadata: {}
			}
		};
		writeTasks(testData);

		const { exitCode } = runGenerate('--tag feature-branch');

		expect(exitCode).toBe(0);

		// Should create tag-specific file
		const outputDir = path.join(testDir, '.taskmaster', 'tasks');
		expect(
			fs.existsSync(path.join(outputDir, 'task_001_feature-branch.md'))
		).toBe(true);
	});

	it('should show output directory in success message', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Test Task', status: 'pending' })]
		});
		writeTasks(testData);

		const { output, exitCode } = runGenerate();

		expect(exitCode).toBe(0);
		expect(output).toContain('.taskmaster/tasks');
	});

	it('should exit with non-zero code for invalid --format value', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Test Task', status: 'pending' })]
		});
		writeTasks(testData);

		const { output, exitCode } = runGenerate('--format invalid');

		expect(exitCode).not.toBe(0);
		expect(output.toLowerCase()).toMatch(/invalid|error|format/);
	});
});
