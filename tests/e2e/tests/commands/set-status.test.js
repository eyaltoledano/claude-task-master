import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, existsSync, readFileSync } from 'fs';

describe('task-master set-status', () => {
	let testDir;
	let helpers;

	beforeEach(() => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'tm-test-set-status-'));
		process.chdir(testDir);

		// Get helpers from global context
		helpers = global.testHelpers;

		// Copy .env if exists
		const envPath = join(process.cwd(), '../../.env');
		if (existsSync(envPath)) {
			const envContent = readFileSync(envPath, 'utf-8');
			helpers.writeFile('.env', envContent);
		}

		// Initialize task-master project
		const initResult = helpers.taskMaster('init', ['-y']);
		expect(initResult).toHaveExitCode(0);

		// Ensure tasks.json exists
		const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
		if (!helpers.fileExists(tasksPath)) {
			helpers.writeFile(tasksPath, JSON.stringify({ tasks: [] }, null, 2));
		}
	});

	afterEach(() => {
		// Clean up test directory
		process.chdir('..');
		rmSync(testDir, { recursive: true, force: true });
	});

	describe('Basic status changes', () => {
		it('should change task status to in-progress', () => {
			// Create a test task
			const addResult = helpers.taskMaster('add-task', ['Test task', '-m']);
			expect(addResult).toHaveExitCode(0);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Set status to in-progress
			const result = helpers.taskMaster('set-status', [taskId, 'in-progress']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Status updated');
			expect(result.stdout).toContain('in-progress');

			// Verify status changed
			const showResult = helpers.taskMaster('show', [taskId]);
			expect(showResult.stdout).toContain('Status: in-progress');
		});

		it('should change task status to done', () => {
			// Create task
			const addResult = helpers.taskMaster('add-task', [
				'Task to complete',
				'-m'
			]);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Set status to done
			const result = helpers.taskMaster('set-status', [taskId, 'done']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('✓ Completed');

			// Verify
			const showResult = helpers.taskMaster('show', [taskId]);
			expect(showResult.stdout).toContain('Status: done');
		});

		it('should support all valid statuses', () => {
			const statuses = [
				'pending',
				'in-progress',
				'done',
				'blocked',
				'deferred',
				'cancelled'
			];

			for (const status of statuses) {
				const addResult = helpers.taskMaster('add-task', [
					`Task for ${status}`,
					'-m'
				]);
				const taskId = helpers.extractTaskId(addResult.stdout);

				const result = helpers.taskMaster('set-status', [taskId, status]);
				expect(result).toHaveExitCode(0);
				expect(result.stdout.toLowerCase()).toContain(status);
			}
		});
	});

	describe('Subtask status changes', () => {
		it('should change subtask status', () => {
			// Create parent task with subtasks
			const parentResult = helpers.taskMaster('add-task', [
				'Parent task',
				'-m'
			]);
			const parentId = helpers.extractTaskId(parentResult.stdout);

			// Expand to add subtasks
			const expandResult = helpers.taskMaster(
				'expand',
				['-i', parentId, '-n', '2'],
				{ timeout: 60000 }
			);
			expect(expandResult).toHaveExitCode(0);

			// Set subtask status
			const subtaskId = `${parentId}.1`;
			const result = helpers.taskMaster('set-status', [subtaskId, 'done']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Subtask completed');

			// Verify parent task shows progress
			const showResult = helpers.taskMaster('show', [parentId]);
			expect(showResult.stdout).toMatch(/Progress:.*1\/2/);
		});

		it('should update parent status when all subtasks complete', () => {
			// Create parent task with subtasks
			const parentResult = helpers.taskMaster('add-task', [
				'Parent task',
				'-m'
			]);
			const parentId = helpers.extractTaskId(parentResult.stdout);

			// Add subtasks
			helpers.taskMaster('expand', ['-i', parentId, '-n', '2'], {
				timeout: 60000
			});

			// Complete all subtasks
			helpers.taskMaster('set-status', [`${parentId}.1`, 'done']);
			const result = helpers.taskMaster('set-status', [
				`${parentId}.2`,
				'done'
			]);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('All subtasks completed');
			expect(result.stdout).toContain(
				'Parent task automatically marked as done'
			);

			// Verify parent is done
			const showResult = helpers.taskMaster('show', [parentId]);
			expect(showResult.stdout).toContain('Status: done');
		});
	});

	describe('Bulk status updates', () => {
		it('should update status for multiple tasks', () => {
			// Create multiple tasks
			const task1 = helpers.taskMaster('add-task', ['Task 1', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', ['Task 2', '-m']);
			const id2 = helpers.extractTaskId(task2.stdout);

			const task3 = helpers.taskMaster('add-task', ['Task 3', '-m']);
			const id3 = helpers.extractTaskId(task3.stdout);

			// Update multiple tasks
			const result = helpers.taskMaster('set-status', [
				`${id1},${id2},${id3}`,
				'in-progress'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('3 tasks updated');

			// Verify all changed
			for (const id of [id1, id2, id3]) {
				const showResult = helpers.taskMaster('show', [id]);
				expect(showResult.stdout).toContain('Status: in-progress');
			}
		});

		it('should update all pending tasks', () => {
			// Create tasks with mixed statuses
			const task1 = helpers.taskMaster('add-task', ['Pending 1', '-m']);
			const task2 = helpers.taskMaster('add-task', ['Pending 2', '-m']);

			const task3 = helpers.taskMaster('add-task', ['Already done', '-m']);
			const id3 = helpers.extractTaskId(task3.stdout);
			helpers.taskMaster('set-status', [id3, 'done']);

			// Update all pending tasks
			const result = helpers.taskMaster('set-status', [
				'--all',
				'in-progress',
				'--filter-status',
				'pending'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('2 tasks updated');

			// Verify already done task unchanged
			const showResult = helpers.taskMaster('show', [id3]);
			expect(showResult.stdout).toContain('Status: done');
		});
	});

	describe('Dependency handling', () => {
		it('should warn when setting blocked task to in-progress', () => {
			// Create dependency
			const dep = helpers.taskMaster('add-task', ['Dependency', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);

			// Create blocked task
			const task = helpers.taskMaster('add-task', [
				'Blocked task',
				'-m',
				'-d',
				depId
			]);
			const taskId = helpers.extractTaskId(task.stdout);

			// Try to set to in-progress
			const result = helpers.taskMaster('set-status', [taskId, 'in-progress']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Warning');
			expect(result.stdout).toContain('has incomplete dependencies');
		});

		it('should unblock dependent tasks when dependency completes', () => {
			// Create dependency chain
			const task1 = helpers.taskMaster('add-task', ['First task', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', [
				'Dependent task',
				'-m',
				'-d',
				id1
			]);
			const id2 = helpers.extractTaskId(task2.stdout);

			// Complete first task
			const result = helpers.taskMaster('set-status', [id1, 'done']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Unblocked tasks:');
			expect(result.stdout).toContain(`${id2} - Dependent task`);
		});

		it('should handle force flag for blocked tasks', () => {
			// Create blocked task
			const dep = helpers.taskMaster('add-task', ['Incomplete dep', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);

			const task = helpers.taskMaster('add-task', [
				'Force complete',
				'-m',
				'-d',
				depId
			]);
			const taskId = helpers.extractTaskId(task.stdout);

			// Force complete despite dependencies
			const result = helpers.taskMaster('set-status', [
				taskId,
				'done',
				'--force'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Force completing');
			expect(result.stdout).not.toContain('Warning');

			// Verify it's done
			const showResult = helpers.taskMaster('show', [taskId]);
			expect(showResult.stdout).toContain('Status: done');
		});
	});

	describe('Status transitions', () => {
		it('should prevent invalid status transitions', () => {
			// Create completed task
			const task = helpers.taskMaster('add-task', ['Completed task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);
			helpers.taskMaster('set-status', [taskId, 'done']);

			// Try to set back to pending
			const result = helpers.taskMaster('set-status', [taskId, 'pending']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Warning');
			expect(result.stdout).toContain('Unusual status transition');
		});

		it('should allow reopening cancelled tasks', () => {
			// Create and cancel task
			const task = helpers.taskMaster('add-task', ['Cancelled task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);
			helpers.taskMaster('set-status', [taskId, 'cancelled']);

			// Reopen task
			const result = helpers.taskMaster('set-status', [taskId, 'pending']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Task reopened');
		});
	});

	describe('Tag context', () => {
		it('should update status for task in specific tag', () => {
			// Create tag and task
			helpers.taskMaster('add-tag', ['feature']);
			helpers.taskMaster('use-tag', ['feature']);

			const task = helpers.taskMaster('add-task', ['Feature task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			// Update status with tag context
			const result = helpers.taskMaster('set-status', [
				taskId,
				'done',
				'--tag',
				'feature'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('[feature]');
			expect(result.stdout).toContain('Status updated');
		});
	});

	describe('Interactive features', () => {
		it('should show next task suggestion after completing', () => {
			// Create multiple tasks
			helpers.taskMaster('add-task', ['Task 1', '-m', '-p', 'high']);
			const task2 = helpers.taskMaster('add-task', [
				'Task 2',
				'-m',
				'-p',
				'high'
			]);
			const id2 = helpers.extractTaskId(task2.stdout);

			// Complete first task
			const result = helpers.taskMaster('set-status', [id2, 'done']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Next suggested task:');
			expect(result.stdout).toContain('Task 1');
		});

		it('should provide time tracking prompts', () => {
			// Create task
			const task = helpers.taskMaster('add-task', ['Timed task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			// Start task
			const startResult = helpers.taskMaster('set-status', [
				taskId,
				'in-progress'
			]);
			expect(startResult).toHaveExitCode(0);
			expect(startResult.stdout).toContain('Started at:');

			// Complete task
			const endResult = helpers.taskMaster('set-status', [taskId, 'done']);
			expect(endResult).toHaveExitCode(0);
			expect(endResult.stdout).toContain('Time spent:');
		});
	});

	describe('Error handling', () => {
		it('should handle invalid task ID', () => {
			const result = helpers.taskMaster('set-status', ['999', 'done'], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toMatch(/Task.*not found/i);
		});

		it('should handle invalid status value', () => {
			const task = helpers.taskMaster('add-task', ['Test task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			const result = helpers.taskMaster(
				'set-status',
				[taskId, 'invalid-status'],
				{ allowFailure: true }
			);
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid status');
			expect(result.stderr).toContain('pending, in-progress, done');
		});

		it('should handle missing required arguments', () => {
			const result = helpers.taskMaster('set-status', [], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('required');
		});
	});

	describe('Batch operations', () => {
		it('should handle range-based updates', () => {
			// Create sequential tasks
			const ids = [];
			for (let i = 0; i < 5; i++) {
				const result = helpers.taskMaster('add-task', [`Task ${i + 1}`, '-m']);
				ids.push(helpers.extractTaskId(result.stdout));
			}

			// Update range
			const result = helpers.taskMaster('set-status', [
				'--from',
				ids[1],
				'--to',
				ids[3],
				'in-progress'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('3 tasks updated');

			// Verify middle tasks updated
			for (let i = 1; i <= 3; i++) {
				const showResult = helpers.taskMaster('show', [ids[i]]);
				expect(showResult.stdout).toContain('Status: in-progress');
			}

			// Verify edge tasks not updated
			const show0 = helpers.taskMaster('show', [ids[0]]);
			expect(show0.stdout).toContain('Status: pending');
		});
	});

	describe('Output options', () => {
		it('should support quiet mode', () => {
			const task = helpers.taskMaster('add-task', ['Test task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			const result = helpers.taskMaster('set-status', [taskId, 'done', '-q']);
			expect(result).toHaveExitCode(0);
			// Quiet mode should have minimal output
			expect(result.stdout.split('\n').length).toBeLessThan(3);
		});

		it('should support JSON output', () => {
			const task = helpers.taskMaster('add-task', ['Test task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			const result = helpers.taskMaster('set-status', [
				taskId,
				'done',
				'--json'
			]);
			expect(result).toHaveExitCode(0);

			const json = JSON.parse(result.stdout);
			expect(json.updated).toBe(1);
			expect(json.tasks[0].id).toBe(parseInt(taskId));
			expect(json.tasks[0].status).toBe('done');
		});
	});
});
