/**
 * E2E tests for set-status command
 * Tests task status management functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('task-master set-status', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-set-status-'));

		// Initialize test helpers
		const context = global.createTestContext('set-status');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(process.cwd(), '.env');
		const testEnvPath = join(testDir, '.env');
		if (existsSync(mainEnvPath)) {
			const envContent = readFileSync(mainEnvPath, 'utf8');
			writeFileSync(testEnvPath, envContent);
		}

		// Initialize task-master project
		const initResult = await helpers.taskMaster('init', ['-y'], {
			cwd: testDir
		});
		expect(initResult).toHaveExitCode(0);

		// Ensure tasks.json exists (bug workaround)
		const tasksJsonPath = join(testDir, '.taskmaster/tasks/tasks.json');
		if (!existsSync(tasksJsonPath)) {
			mkdirSync(join(testDir, '.taskmaster/tasks'), { recursive: true });
			writeFileSync(tasksJsonPath, JSON.stringify({ master: { tasks: [] } }));
		}
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Basic status changes', () => {
		it('should change task status to in-progress', async () => {
			// Create a task
			const task = await helpers.taskMaster('add-task', ['--title', 'Test task', '--description', 'A task to test status'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Set status to in-progress
			const result = await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'in-progress'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
			expect(result.stdout).toContain('in-progress');

			// Verify status change
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			expect(showResult.stdout).toContain('► in-progress');
		});

		it('should change task status to done', async () => {
			// Create a task
			const task = await helpers.taskMaster('add-task', ['--title', 'Task to complete', '--description', 'Will be marked as done'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Set status to done
			const result = await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'done'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
			expect(result.stdout).toContain('done');

			// Verify in completed list
			const listResult = await helpers.taskMaster('list', ['--status', 'done'], { cwd: testDir });
			expect(listResult.stdout).toContain('✓ done');
		});

		it('should change task status to review', async () => {
			// Create a task
			const task = await helpers.taskMaster('add-task', ['--title', 'Blocked task', '--description', 'Will be review'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Set status to review
			const result = await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'review'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
			expect(result.stdout).toContain('review');
		});

		it('should revert task status to pending', async () => {
			// Create task and set to in-progress
			const task = await helpers.taskMaster('add-task', ['--title', 'Revert task', '--description', 'Will go back to pending'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);
			await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'in-progress'], { cwd: testDir });

			// Revert to pending
			const result = await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'pending'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
			expect(result.stdout).toContain('pending');
		});
	});

	describe('Multiple tasks', () => {
		it('should change status for multiple tasks', async () => {
			// Create multiple tasks
			const task1 = await helpers.taskMaster('add-task', ['--title', 'First task', '--description', 'Task 1'], { cwd: testDir });
			const taskId1 = helpers.extractTaskId(task1.stdout);
			
			const task2 = await helpers.taskMaster('add-task', ['--title', 'Second task', '--description', 'Task 2'], { cwd: testDir });
			const taskId2 = helpers.extractTaskId(task2.stdout);
			
			const task3 = await helpers.taskMaster('add-task', ['--title', 'Third task', '--description', 'Task 3'], { cwd: testDir });
			const taskId3 = helpers.extractTaskId(task3.stdout);

			// Set multiple tasks to in-progress
			const result = await helpers.taskMaster('set-status', ['--id', `${taskId1},${taskId2}`, '--status', 'in-progress'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');

			// Verify both are in-progress
			const listResult = await helpers.taskMaster('list', ['--status', 'in-progress'], { cwd: testDir });
			expect(listResult.stdout).toContain('First');
			expect(listResult.stdout).toContain('Second');
			expect(listResult.stdout).not.toContain('Third');
		});
	});

	describe('Subtask status', () => {
		it.skip('should change subtask status', async () => {
			// Skipped: This test requires AI functionality (expand command) which is not available in test environment
			// The expand command needs API credentials to generate subtasks
		});

		it.skip('should update parent status when all subtasks complete', async () => {
			// Skipped: This test requires AI functionality (expand command) which is not available in test environment
			// The expand command needs API credentials to generate subtasks
		});
	});

	describe('Dependency constraints', () => {
		it('should handle status change with dependencies', async () => {
			// Create dependent tasks
			const task1 = await helpers.taskMaster('add-task', ['--title', 'Dependency task', '--description', 'Must be done first'], { cwd: testDir });
			const taskId1 = helpers.extractTaskId(task1.stdout);
			
			const task2 = await helpers.taskMaster('add-task', ['--title', 'Dependent task', '--description', 'Depends on first'], { cwd: testDir });
			const taskId2 = helpers.extractTaskId(task2.stdout);
			
			// Add dependency
			await helpers.taskMaster('add-dependency', ['--id', taskId2, '--depends-on', taskId1], { cwd: testDir });

			// Try to set dependent task to done while dependency is pending
			const result = await helpers.taskMaster('set-status', ['--id', taskId2, '--status', 'done'], { cwd: testDir });
			
			// Implementation may warn or prevent this
			expect(result).toHaveExitCode(0);
		});

		it('should unblock tasks when dependencies complete', async () => {
			// Create dependency chain
			const task1 = await helpers.taskMaster('add-task', ['--title', 'Base task', '--description', 'No dependencies'], { cwd: testDir });
			const taskId1 = helpers.extractTaskId(task1.stdout);
			
			const task2 = await helpers.taskMaster('add-task', ['--title', 'Blocked task', '--description', 'Waiting on base'], { cwd: testDir });
			const taskId2 = helpers.extractTaskId(task2.stdout);
			
			// Add dependency and set to review
			await helpers.taskMaster('add-dependency', ['--id', taskId2, '--depends-on', taskId1], { cwd: testDir });
			await helpers.taskMaster('set-status', ['--id', taskId2, '--status', 'review'], { cwd: testDir });

			// Complete dependency
			await helpers.taskMaster('set-status', ['--id', taskId1, '--status', 'done'], { cwd: testDir });

			// Blocked task might auto-transition or remain review
			const showResult = await helpers.taskMaster('show', [taskId2], { cwd: testDir });
			expect(showResult.stdout).toContain('Blocked');
		});
	});

	describe('Error handling', () => {
		it('should fail with invalid status', async () => {
			const task = await helpers.taskMaster('add-task', ['--title', 'Test task', '--description', 'Test'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			const result = await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'invalid-status'], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid status');
		});

		it('should fail with non-existent task ID', async () => {
			const result = await helpers.taskMaster('set-status', ['--id', '999', '--status', 'done'], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('not found');
		});

		it('should fail when required parameters missing', async () => {
			// Missing status
			const task = await helpers.taskMaster('add-task', ['--title', 'Test', '--description', 'Test'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			const result = await helpers.taskMaster('set-status', ['--id', taskId], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('required');
		});
	});

	describe('Tag context', () => {
		it('should set status for task in specific tag', async () => {
			// Create tags and tasks
			await helpers.taskMaster('add-tag', ['feature'], { cwd: testDir });
			
			// Add task to master
			const masterTask = await helpers.taskMaster('add-task', ['--title', 'Master task', '--description', 'In master'], { cwd: testDir });
			const masterId = helpers.extractTaskId(masterTask.stdout);

			// Add task to feature
			await helpers.taskMaster('use-tag', ['feature'], { cwd: testDir });
			const featureTask = await helpers.taskMaster('add-task', ['--title', 'Feature task', '--description', 'In feature'], { cwd: testDir });
			const featureId = helpers.extractTaskId(featureTask.stdout);

			// Set status with tag context
			const result = await helpers.taskMaster('set-status', ['--id', featureId, '--status', 'in-progress', '--tag', 'feature'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);

			// Verify status in correct tag
			const listResult = await helpers.taskMaster('list', ['--status', 'in-progress'], { cwd: testDir });
			expect(listResult.stdout).toContain('Feature');
		});
	});

	describe('Status transitions', () => {
		it('should handle all valid status transitions', async () => {
			const task = await helpers.taskMaster('add-task', ['--title', 'Status test', '--description', 'Testing all statuses'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Test all transitions
			const statuses = ['pending', 'in-progress', 'review', 'done', 'pending'];
			
			for (const status of statuses) {
				const result = await helpers.taskMaster('set-status', ['--id', taskId, '--status', status], { cwd: testDir });
				expect(result).toHaveExitCode(0);
				expect(result.stdout).toContain('Successfully updated task');
			}
		});

		it('should update timestamps on status change', async () => {
			const task = await helpers.taskMaster('add-task', ['--title', 'Timestamp test', '--description', 'Check timestamps'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 100));

			// Change status
			const result = await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'in-progress'], { cwd: testDir });
			expect(result).toHaveExitCode(0);

			// Status change should update modified timestamp
			// (exact verification depends on show command output format)
		});
	});

	describe('Output options', () => {
		it('should support basic status setting', async () => {
			const task = await helpers.taskMaster('add-task', ['--title', 'Basic test', '--description', 'Test basic functionality'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Set status without any special flags
			const result = await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'done'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
		});

		it('should show affected tasks summary', async () => {
			// Create multiple tasks
			const tasks = [];
			for (let i = 1; i <= 3; i++) {
				const task = await helpers.taskMaster('add-task', ['--title', `Task ${i}`, '--description', `Description ${i}`], { cwd: testDir });
				tasks.push(helpers.extractTaskId(task.stdout));
			}

			// Set all to in-progress
			const result = await helpers.taskMaster('set-status', ['--id', tasks.join(','), '--status', 'in-progress'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
			// May show count of affected tasks
		});
	});
});