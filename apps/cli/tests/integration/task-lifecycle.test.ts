/**
 * @fileoverview Integration tests for basic task lifecycle operations
 *
 * TESTING PHILOSOPHY:
 * - These are TRUE integration tests - we spawn real CLI processes
 * - We use real file system operations (temp directories)
 * - We verify behavior by checking file system changes
 * - We avoid mocking except for AI SDK to save costs
 *
 * WHY TEST FILE CHANGES INSTEAD OF CLI OUTPUT:
 * - CLI output is formatted for humans (colors, boxes, tables)
 * - File system changes are the source of truth
 * - More stable - UI can change, but data format is stable
 *
 * @integration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCliBinPath } from '../helpers/test-utils.js';

// Capture initial working directory at module load time
const initialCwd = process.cwd();

describe('Task Lifecycle Integration Tests', () => {
	let testDir: string;
	let tasksPath: string;
	let binPath: string;

	/**
	 * SETUP PATTERN:
	 * Before each test, we:
	 * 1. Create an isolated temp directory (no cross-test pollution)
	 * 2. Change into it (CLI commands run in this context)
	 * 3. Initialize a fresh Task Master project
	 * 4. Skip auto-updates for deterministic timing
	 */
	beforeEach(() => {
		// Create isolated test environment in OS temp directory
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-test-'));
		process.chdir(testDir);

		// Disable auto-update checks for deterministic test timing
		process.env.TASKMASTER_SKIP_AUTO_UPDATE = '1';

		// Path to the compiled CLI binary we're testing
		// Binary is built to root dist/ directory, not apps/cli/dist/
		binPath = getCliBinPath();

		// Initialize a fresh Task Master project
		execSync(`node "${binPath}" init --yes`, {
			stdio: 'pipe',
			env: {
				...process.env,
				TASKMASTER_SKIP_AUTO_UPDATE: '1'
			}
		});

		// Path where tasks.json will be stored
		tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');

		// Create initial tasks.json (init doesn't create it until first task added)
		const initialTasks = {
			master: {
				tasks: [],
				metadata: {
					created: new Date().toISOString(),
					description: 'Test tasks'
				}
			}
		};
		fs.writeFileSync(tasksPath, JSON.stringify(initialTasks, null, 2));
	});

	/**
	 * CLEANUP PATTERN:
	 * After each test:
	 * 1. Change back to original directory (can't delete current dir)
	 * 2. Delete the temp directory recursively
	 * 3. Clean up environment variables
	 *
	 * WHY: Prevents "directory in use" errors and disk space leaks
	 */
	afterEach(() => {
		try {
			// Restore to the original working directory captured at module load
			process.chdir(initialCwd);
		} catch (error) {
			// Fallback to home directory if initial directory no longer exists
			process.chdir(os.homedir());
		}

		// Remove test directory and all contents
		if (testDir && fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}

		// Clean up environment
		delete process.env.TASKMASTER_SKIP_AUTO_UPDATE;
	});

	/**
	 * TEST HELPER: Read tasks from tasks.json
	 *
	 * EDUCATIONAL NOTE:
	 * We read the actual file from disk, not mocked data.
	 * This validates that the CLI actually wrote what we expect.
	 */
	const readTasks = () => {
		const content = fs.readFileSync(tasksPath, 'utf-8');
		return JSON.parse(content);
	};

	/**
	 * TEST HELPER: Write tasks to tasks.json
	 *
	 * EDUCATIONAL NOTE:
	 * We manually create test data by writing to the real file system.
	 * This simulates different project states without AI calls.
	 */
	const writeTasks = (tasksData: any) => {
		fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
	};

	/**
	 * TEST HELPER: Run a CLI command with auto-update disabled
	 *
	 * EDUCATIONAL NOTE:
	 * This helper ensures TASKMASTER_SKIP_AUTO_UPDATE is always set,
	 * avoiding repetition and ensuring consistent test behavior.
	 */
	const runCommand = (command: string, options: any = {}) => {
		return execSync(`node "${binPath}" ${command}`, {
			...options,
			env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
		});
	};

	describe('task-master init', () => {
		it('should initialize project structure', () => {
			// ASSERTION PATTERN:
			// We verify the actual directory structure was created
			expect(fs.existsSync(path.join(testDir, '.taskmaster'))).toBe(true);
			expect(fs.existsSync(path.join(testDir, '.taskmaster', 'tasks'))).toBe(
				true
			);
			expect(fs.existsSync(path.join(testDir, '.taskmaster', 'docs'))).toBe(
				true
			);
			expect(fs.existsSync(path.join(testDir, '.taskmaster', 'reports'))).toBe(
				true
			);
			expect(
				fs.existsSync(path.join(testDir, '.taskmaster', 'config.json'))
			).toBe(true);
			expect(
				fs.existsSync(path.join(testDir, '.taskmaster', 'state.json'))
			).toBe(true);
		});
	});

	describe('task-master set-status', () => {
		it('should update task status from pending to done', () => {
			// ARRANGE: Create a pending task
			const testData = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Task to Complete',
							description: 'A task we will mark as done',
							status: 'pending',
							priority: 'high',
							dependencies: [],
							details: 'Implementation details',
							testStrategy: 'Test strategy',
							subtasks: []
						}
					],
					metadata: {
						created: new Date().toISOString()
					}
				}
			};
			writeTasks(testData);

			// ACT: Mark task as done via CLI
			runCommand('set-status --id=1 --status=done', { stdio: 'pipe' });

			// ASSERT: Verify status was updated in actual file
			const tasks = readTasks();
			// Note: CLI may convert id from number to string
			const updatedTask = tasks.master.tasks.find((t: any) => t.id == 1); // == handles both number and string
			expect(updatedTask).toBeDefined();
			expect(updatedTask.status).toBe('done');
			expect(updatedTask.title).toBe('Task to Complete'); // Other fields unchanged
		});

		it('should update subtask status', () => {
			// ARRANGE: Create task with subtasks
			const testData = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Parent Task',
							description: 'Parent task description',
							status: 'in-progress',
							priority: 'high',
							dependencies: [],
							details: 'Parent task details',
							testStrategy: 'Test strategy',
							subtasks: [
								{
									id: '1',
									title: 'First Subtask',
									description: 'Subtask to complete',
									status: 'pending',
									priority: 'medium',
									dependencies: [],
									details: 'Subtask details'
								},
								{
									id: '2',
									title: 'Second Subtask',
									description: 'Second subtask',
									status: 'pending',
									priority: 'medium',
									dependencies: ['1.1'],
									details: 'Second subtask details'
								}
							]
						}
					],
					metadata: {
						created: new Date().toISOString(),
						description: 'Test tasks'
					}
				}
			};
			writeTasks(testData);

			// ACT: Mark subtask as done
			runCommand('set-status --id=1.1 --status=done', { stdio: 'pipe' });

			// ASSERT: Verify subtask status updated
			const tasks = readTasks();
			const parentTask = tasks.master.tasks.find((t: any) => t.id == 1);
			expect(parentTask).toBeDefined();
			const subtask = parentTask.subtasks.find((s: any) => s.id == 1);
			expect(subtask).toBeDefined();
			expect(subtask.status).toBe('done');

			// Verify other subtask unchanged
			const otherSubtask = parentTask.subtasks.find((s: any) => s.id == 2);
			expect(otherSubtask.status).toBe('pending');
		});

		it('should handle multiple status changes in sequence', () => {
			// ARRANGE: Create task
			const testData = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Task',
							status: 'pending',
							dependencies: [],
							subtasks: []
						}
					],
					metadata: {
						created: new Date().toISOString()
					}
				}
			};
			writeTasks(testData);

			// ACT & ASSERT: Change status multiple times
			runCommand('set-status --id=1 --status=in-progress', { stdio: 'pipe' });
			let tasks = readTasks();
			expect(tasks.master.tasks[0].status).toBe('in-progress');

			runCommand('set-status --id=1 --status=review', { stdio: 'pipe' });
			tasks = readTasks();
			expect(tasks.master.tasks[0].status).toBe('review');

			runCommand('set-status --id=1 --status=done', { stdio: 'pipe' });
			tasks = readTasks();
			expect(tasks.master.tasks[0].status).toBe('done');
		});

		it('should reject invalid status values', () => {
			// ARRANGE: Create task
			const testData = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Task',
							status: 'pending',
							dependencies: [],
							subtasks: []
						}
					],
					metadata: {
						created: new Date().toISOString()
					}
				}
			};
			writeTasks(testData);

			// ACT & ASSERT: Should throw on invalid status
			expect(() => {
				runCommand('set-status --id=1 --status=invalid', { stdio: 'pipe' });
			}).toThrow();

			// Verify status unchanged
			const tasks = readTasks();
			expect(tasks.master.tasks[0].status).toBe('pending');
		});
	});

	/**
	 * EDUCATIONAL NOTE: Real-World Workflow Test
	 *
	 * This test demonstrates a realistic workflow:
	 * 1. Start with pending tasks
	 * 2. Mark them as in-progress
	 * 3. Complete them one by one
	 * 4. Verify final state
	 *
	 * This is the kind of flow a real developer would follow.
	 */
	describe('Realistic Task Workflow', () => {
		it('should support typical development workflow', () => {
			// ARRANGE: Create realistic project tasks
			const testData = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Setup Environment',
							description: 'Install dependencies and configure',
							status: 'pending',
							priority: 'high',
							dependencies: [],
							subtasks: []
						},
						{
							id: 2,
							title: 'Write Tests',
							description: 'Create test suite',
							status: 'pending',
							priority: 'high',
							dependencies: [1],
							subtasks: []
						},
						{
							id: 3,
							title: 'Implement Feature',
							description: 'Write actual code',
							status: 'pending',
							priority: 'medium',
							dependencies: [2],
							subtasks: []
						}
					],
					metadata: {
						created: new Date().toISOString(),
						description: 'Sample project'
					}
				}
			};
			writeTasks(testData);

			// ACT & ASSERT: Work through tasks in realistic order

			// Developer starts task 1
			runCommand('set-status --id=1 --status=in-progress');
			let tasks = readTasks();
			expect(tasks.master.tasks[0].status).toBe('in-progress');

			// Developer completes task 1
			runCommand('set-status --id=1 --status=done');
			tasks = readTasks();
			expect(tasks.master.tasks[0].status).toBe('done');

			// Developer starts task 2
			runCommand('set-status --id=2 --status=in-progress');
			tasks = readTasks();
			expect(tasks.master.tasks[1].status).toBe('in-progress');

			// Developer completes task 2
			runCommand('set-status --id=2 --status=done');
			tasks = readTasks();
			expect(tasks.master.tasks[1].status).toBe('done');

			// Developer starts and completes task 3
			runCommand('set-status --id=3 --status=in-progress');
			runCommand('set-status --id=3 --status=done');
			tasks = readTasks();
			expect(tasks.master.tasks[2].status).toBe('done');

			// Verify final state: all tasks done
			expect(tasks.master.tasks.every((t: any) => t.status === 'done')).toBe(
				true
			);
		});
	});
});
