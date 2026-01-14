/**
 * @fileoverview Integration tests for 'task-master loop' command
 *
 * Tests the loop command's CLI integration including option parsing,
 * validation errors, and help text. Note: The loop command spawns
 * Claude Code which is not available in test environments, so these
 * tests focus on pre-execution validation and CLI structure.
 *
 * @integration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTask, createTasksFile } from '@tm/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCliBinPath } from '../../helpers/test-utils.js';

// Increase hook timeout for this file - init command can be slow in CI
vi.setConfig({ hookTimeout: 30000 });

// Capture initial working directory at module load time
const initialCwd = process.cwd();

describe('loop command', () => {
	let testDir: string;
	let tasksPath: string;
	let binPath: string;

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-loop-test-'));
		process.chdir(testDir);
		process.env.TASKMASTER_SKIP_AUTO_UPDATE = '1';

		binPath = getCliBinPath();

		execSync(`node "${binPath}" init --yes`, {
			stdio: 'pipe',
			env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
		});

		tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');

		// Use fixture to create initial tasks file with some tasks
		const initialTasks = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Test Task',
					description: 'A task for testing loop',
					status: 'pending'
				})
			]
		});
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

	const runLoop = (args = ''): { output: string; exitCode: number } => {
		try {
			const output = execSync(`node "${binPath}" loop ${args}`, {
				encoding: 'utf-8',
				stdio: 'pipe',
				timeout: 5000, // Short timeout since we can't actually run claude
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

	const runHelp = (): { output: string; exitCode: number } => {
		try {
			const output = execSync(`node "${binPath}" loop --help`, {
				encoding: 'utf-8',
				stdio: 'pipe',
				env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
			});
			return { output, exitCode: 0 };
		} catch (error: any) {
			return {
				output: error.stdout?.toString() || error.stderr?.toString() || '',
				exitCode: error.status || 1
			};
		}
	};

	describe('command registration', () => {
		it('should be registered and show in help', () => {
			const { output, exitCode } = runHelp();

			expect(exitCode).toBe(0);
			expect(output).toContain('loop');
		});

		it('should show description in help', () => {
			const { output, exitCode } = runHelp();

			expect(exitCode).toBe(0);
			expect(output.toLowerCase()).toContain('claude');
			expect(output.toLowerCase()).toContain('loop');
		});
	});

	describe('option documentation', () => {
		it('should show -n/--iterations option in help', () => {
			const { output, exitCode } = runHelp();

			expect(exitCode).toBe(0);
			expect(output).toContain('-n');
			expect(output).toContain('--iterations');
		});

		it('should show -p/--prompt option in help', () => {
			const { output, exitCode } = runHelp();

			expect(exitCode).toBe(0);
			expect(output).toContain('-p');
			expect(output).toContain('--prompt');
		});

		it('should show -t/--tag option in help', () => {
			const { output, exitCode } = runHelp();

			expect(exitCode).toBe(0);
			expect(output).toContain('-t');
			expect(output).toContain('--tag');
		});

		it('should show --sandbox option in help', () => {
			const { output, exitCode } = runHelp();

			expect(exitCode).toBe(0);
			expect(output).toContain('--sandbox');
		});

		it('should show --progress-file option in help', () => {
			const { output, exitCode } = runHelp();

			expect(exitCode).toBe(0);
			expect(output).toContain('--progress-file');
		});

		it('should show --project option in help', () => {
			const { output, exitCode } = runHelp();

			expect(exitCode).toBe(0);
			expect(output).toContain('--project');
		});
	});

	describe('validation errors', () => {
		it('should reject invalid iterations (non-numeric)', () => {
			const { output, exitCode } = runLoop('-n abc');

			expect(exitCode).toBe(1);
			expect(output.toLowerCase()).toContain('invalid');
			expect(output.toLowerCase()).toContain('iterations');
		});

		it('should reject invalid iterations (negative)', () => {
			const { output, exitCode } = runLoop('-n -5');

			expect(exitCode).toBe(1);
			expect(output.toLowerCase()).toContain('invalid');
		});

		it('should reject invalid iterations (zero)', () => {
			const { output, exitCode } = runLoop('-n 0');

			expect(exitCode).toBe(1);
			expect(output.toLowerCase()).toContain('invalid');
			expect(output.toLowerCase()).toContain('iterations');
		});
	});

	describe('error messages', () => {
		it('should show helpful error for invalid iterations', () => {
			const { output, exitCode } = runLoop('-n invalid');

			expect(exitCode).toBe(1);
			// Should mention what's wrong and what's expected
			expect(output.toLowerCase()).toContain('iterations');
			expect(output.toLowerCase()).toContain('positive');
		});
	});
});
