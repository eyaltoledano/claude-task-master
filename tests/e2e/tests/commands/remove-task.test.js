import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, existsSync, readFileSync } from 'fs';

describe('task-master remove-task', () => {
	let testDir;
	let helpers;

	beforeEach(() => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'tm-test-remove-'));
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

	describe('Basic removal', () => {
		it('should remove a single task', () => {
			// Create task
			const addResult = helpers.taskMaster('add-task', [
				'Task to remove',
				'-m'
			]);
			expect(addResult).toHaveExitCode(0);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Remove task
			const result = helpers.taskMaster('remove-task', [taskId, '-y']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Task removed successfully');
			expect(result.stdout).toContain(taskId);

			// Verify task is gone
			const showResult = helpers.taskMaster('show', [taskId], {
				allowFailure: true
			});
			expect(showResult.exitCode).not.toBe(0);
		});

		it('should prompt for confirmation without -y flag', () => {
			// Create task
			const addResult = helpers.taskMaster('add-task', ['Test task', '-m']);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Try to remove without confirmation (should fail or prompt)
			const result = helpers.taskMaster('remove-task', [taskId], {
				input: 'n\n' // Simulate saying "no" to confirmation
			});

			// Task should still exist
			const showResult = helpers.taskMaster('show', [taskId]);
			expect(showResult).toHaveExitCode(0);
		});

		it('should remove task with subtasks', () => {
			// Create parent task
			const parentResult = helpers.taskMaster('add-task', [
				'Parent task',
				'-m'
			]);
			const parentId = helpers.extractTaskId(parentResult.stdout);

			// Add subtasks
			helpers.taskMaster('expand', ['-i', parentId, '-n', '3'], {
				timeout: 60000
			});

			// Remove parent task
			const result = helpers.taskMaster('remove-task', [parentId, '-y']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('and 3 subtasks');

			// Verify all are gone
			const showResult = helpers.taskMaster('show', [parentId], {
				allowFailure: true
			});
			expect(showResult.exitCode).not.toBe(0);
		});
	});

	describe('Bulk removal', () => {
		it('should remove multiple tasks', () => {
			// Create multiple tasks
			const ids = [];
			for (let i = 0; i < 3; i++) {
				const result = helpers.taskMaster('add-task', [`Task ${i + 1}`, '-m']);
				ids.push(helpers.extractTaskId(result.stdout));
			}

			// Remove all
			const result = helpers.taskMaster('remove-task', [ids.join(','), '-y']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('3 tasks removed');

			// Verify all are gone
			for (const id of ids) {
				const showResult = helpers.taskMaster('show', [id], {
					allowFailure: true
				});
				expect(showResult.exitCode).not.toBe(0);
			}
		});

		it('should remove tasks by range', () => {
			// Create sequential tasks
			const ids = [];
			for (let i = 0; i < 5; i++) {
				const result = helpers.taskMaster('add-task', [`Task ${i + 1}`, '-m']);
				ids.push(helpers.extractTaskId(result.stdout));
			}

			// Remove middle range
			const result = helpers.taskMaster('remove-task', [
				'--from',
				ids[1],
				'--to',
				ids[3],
				'-y'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('3 tasks removed');

			// Verify edge tasks still exist
			const show0 = helpers.taskMaster('show', [ids[0]]);
			expect(show0).toHaveExitCode(0);

			const show4 = helpers.taskMaster('show', [ids[4]]);
			expect(show4).toHaveExitCode(0);

			// Verify middle tasks are gone
			for (let i = 1; i <= 3; i++) {
				const showResult = helpers.taskMaster('show', [ids[i]], {
					allowFailure: true
				});
				expect(showResult.exitCode).not.toBe(0);
			}
		});

		it('should remove all tasks with --all flag', () => {
			// Create multiple tasks
			for (let i = 0; i < 3; i++) {
				helpers.taskMaster('add-task', [`Task ${i + 1}`, '-m']);
			}

			// Remove all
			const result = helpers.taskMaster('remove-task', ['--all', '-y']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('All tasks removed');

			// Verify empty
			const listResult = helpers.taskMaster('list');
			expect(listResult.stdout).toContain('No tasks found');
		});
	});

	describe('Dependency handling', () => {
		it('should warn when removing task with dependents', () => {
			// Create dependency chain
			const task1 = helpers.taskMaster('add-task', ['Base task', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', [
				'Dependent task',
				'-m',
				'-d',
				id1
			]);
			const id2 = helpers.extractTaskId(task2.stdout);

			// Try to remove base task
			const result = helpers.taskMaster('remove-task', [id1, '-y']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Warning');
			expect(result.stdout).toContain('dependent tasks');
			expect(result.stdout).toContain(id2);
		});

		it('should handle cascade removal with --cascade', () => {
			// Create dependency chain
			const task1 = helpers.taskMaster('add-task', ['Base task', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', [
				'Dependent 1',
				'-m',
				'-d',
				id1
			]);
			const id2 = helpers.extractTaskId(task2.stdout);

			const task3 = helpers.taskMaster('add-task', [
				'Dependent 2',
				'-m',
				'-d',
				id2
			]);
			const id3 = helpers.extractTaskId(task3.stdout);

			// Remove with cascade
			const result = helpers.taskMaster('remove-task', [
				id1,
				'--cascade',
				'-y'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('3 tasks removed');
			expect(result.stdout).toContain('cascade');

			// Verify all are gone
			for (const id of [id1, id2, id3]) {
				const showResult = helpers.taskMaster('show', [id], {
					allowFailure: true
				});
				expect(showResult.exitCode).not.toBe(0);
			}
		});

		it('should update dependencies when removing task', () => {
			// Create chain: task1 -> task2 -> task3
			const task1 = helpers.taskMaster('add-task', ['Task 1', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', ['Task 2', '-m', '-d', id1]);
			const id2 = helpers.extractTaskId(task2.stdout);

			const task3 = helpers.taskMaster('add-task', ['Task 3', '-m', '-d', id2]);
			const id3 = helpers.extractTaskId(task3.stdout);

			// Remove middle task
			const result = helpers.taskMaster('remove-task', [id2, '-y']);
			expect(result).toHaveExitCode(0);

			// Task 3 should now depend directly on task 1
			const showResult = helpers.taskMaster('show', [id3]);
			expect(showResult).toHaveExitCode(0);
			expect(showResult.stdout).toContain('Dependencies:');
			expect(showResult.stdout).toContain(id1);
			expect(showResult.stdout).not.toContain(id2);
		});
	});

	describe('Status filtering', () => {
		it('should remove only completed tasks', () => {
			// Create tasks with different statuses
			const pending = helpers.taskMaster('add-task', ['Pending task', '-m']);
			const pendingId = helpers.extractTaskId(pending.stdout);

			const done1 = helpers.taskMaster('add-task', ['Done task 1', '-m']);
			const doneId1 = helpers.extractTaskId(done1.stdout);
			helpers.taskMaster('set-status', [doneId1, 'done']);

			const done2 = helpers.taskMaster('add-task', ['Done task 2', '-m']);
			const doneId2 = helpers.extractTaskId(done2.stdout);
			helpers.taskMaster('set-status', [doneId2, 'done']);

			// Remove only done tasks
			const result = helpers.taskMaster('remove-task', [
				'--status',
				'done',
				'-y'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('2 tasks removed');

			// Verify pending task still exists
			const showResult = helpers.taskMaster('show', [pendingId]);
			expect(showResult).toHaveExitCode(0);

			// Verify done tasks are gone
			for (const id of [doneId1, doneId2]) {
				const show = helpers.taskMaster('show', [id], {
					allowFailure: true
				});
				expect(show.exitCode).not.toBe(0);
			}
		});

		it('should remove cancelled and deferred tasks', () => {
			// Create tasks
			const cancelled = helpers.taskMaster('add-task', ['Cancelled', '-m']);
			const cancelledId = helpers.extractTaskId(cancelled.stdout);
			helpers.taskMaster('set-status', [cancelledId, 'cancelled']);

			const deferred = helpers.taskMaster('add-task', ['Deferred', '-m']);
			const deferredId = helpers.extractTaskId(deferred.stdout);
			helpers.taskMaster('set-status', [deferredId, 'deferred']);

			const active = helpers.taskMaster('add-task', ['Active', '-m']);
			const activeId = helpers.extractTaskId(active.stdout);

			// Remove cancelled and deferred
			const result = helpers.taskMaster('remove-task', [
				'--status',
				'cancelled,deferred',
				'-y'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('2 tasks removed');

			// Verify active task remains
			const showResult = helpers.taskMaster('show', [activeId]);
			expect(showResult).toHaveExitCode(0);
		});
	});

	describe('Tag context', () => {
		it('should remove tasks from specific tag', () => {
			// Create tag
			helpers.taskMaster('add-tag', ['feature']);

			// Add tasks to different tags
			const master = helpers.taskMaster('add-task', ['Master task', '-m']);
			const masterId = helpers.extractTaskId(master.stdout);

			helpers.taskMaster('use-tag', ['feature']);
			const feature = helpers.taskMaster('add-task', ['Feature task', '-m']);
			const featureId = helpers.extractTaskId(feature.stdout);

			// Remove from feature tag
			const result = helpers.taskMaster('remove-task', [
				featureId,
				'--tag',
				'feature',
				'-y'
			]);
			expect(result).toHaveExitCode(0);

			// Verify master task still exists
			helpers.taskMaster('use-tag', ['master']);
			const showResult = helpers.taskMaster('show', [masterId]);
			expect(showResult).toHaveExitCode(0);
		});
	});

	describe('Undo functionality', () => {
		it('should create backup before removal', () => {
			// Create task
			const task = helpers.taskMaster('add-task', ['Task to backup', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			// Remove task
			const result = helpers.taskMaster('remove-task', [taskId, '-y']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Backup created');

			// Check for backup file
			const backupDir = join(testDir, '.taskmaster/backups');
			expect(existsSync(backupDir)).toBe(true);
		});

		it('should show undo instructions', () => {
			// Create and remove task
			const task = helpers.taskMaster('add-task', ['Test task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			const result = helpers.taskMaster('remove-task', [taskId, '-y']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('To undo this operation');
		});
	});

	describe('Subtask removal', () => {
		it('should remove individual subtask', () => {
			// Create parent with subtasks
			const parent = helpers.taskMaster('add-task', ['Parent', '-m']);
			const parentId = helpers.extractTaskId(parent.stdout);

			helpers.taskMaster('expand', ['-i', parentId, '-n', '3'], {
				timeout: 60000
			});

			// Remove middle subtask
			const subtaskId = `${parentId}.2`;
			const result = helpers.taskMaster('remove-task', [subtaskId, '-y']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Subtask removed');

			// Verify parent still has 2 subtasks
			const showResult = helpers.taskMaster('show', [parentId]);
			expect(showResult).toHaveExitCode(0);
			expect(showResult.stdout).toContain('Subtasks (2)');
		});

		it('should renumber remaining subtasks', () => {
			// Create parent with subtasks
			const parent = helpers.taskMaster('add-task', ['Parent', '-m']);
			const parentId = helpers.extractTaskId(parent.stdout);

			helpers.taskMaster('expand', ['-i', parentId, '-n', '3'], {
				timeout: 60000
			});

			// Remove first subtask
			const result = helpers.taskMaster('remove-task', [`${parentId}.1`, '-y']);
			expect(result).toHaveExitCode(0);

			// Check remaining subtasks are renumbered
			const showResult = helpers.taskMaster('show', [parentId]);
			expect(showResult).toHaveExitCode(0);
			expect(showResult.stdout).toContain(`${parentId}.1`);
			expect(showResult.stdout).toContain(`${parentId}.2`);
			expect(showResult.stdout).not.toContain(`${parentId}.3`);
		});
	});

	describe('Error handling', () => {
		it('should handle non-existent task ID', () => {
			const result = helpers.taskMaster('remove-task', ['999', '-y'], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toMatch(/Task.*not found/i);
		});

		it('should handle invalid task ID format', () => {
			const result = helpers.taskMaster('remove-task', ['invalid-id', '-y'], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid task ID');
		});

		it('should prevent removing all tasks without confirmation', () => {
			// Create tasks
			helpers.taskMaster('add-task', ['Task 1', '-m']);
			helpers.taskMaster('add-task', ['Task 2', '-m']);

			// Try to remove all without -y
			const result = helpers.taskMaster('remove-task', ['--all'], {
				input: 'n\n'
			});

			// Tasks should still exist
			const listResult = helpers.taskMaster('list');
			expect(listResult.stdout).not.toContain('No tasks found');
		});
	});

	describe('Performance', () => {
		it('should handle bulk removal efficiently', () => {
			// Create many tasks
			const ids = [];
			for (let i = 0; i < 50; i++) {
				const result = helpers.taskMaster('add-task', [`Task ${i + 1}`, '-m']);
				ids.push(helpers.extractTaskId(result.stdout));
			}

			// Remove all at once
			const startTime = Date.now();
			const result = helpers.taskMaster('remove-task', ['--all', '-y']);
			const endTime = Date.now();

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('50 tasks removed');
			expect(endTime - startTime).toBeLessThan(5000);
		});
	});

	describe('Output options', () => {
		it('should support quiet mode', () => {
			const task = helpers.taskMaster('add-task', ['Test task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			const result = helpers.taskMaster('remove-task', [taskId, '-y', '-q']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout.split('\n').length).toBeLessThan(3);
		});

		it('should support JSON output', () => {
			// Create tasks
			const task1 = helpers.taskMaster('add-task', ['Task 1', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', ['Task 2', '-m']);
			const id2 = helpers.extractTaskId(task2.stdout);

			const result = helpers.taskMaster('remove-task', [
				`${id1},${id2}`,
				'-y',
				'--json'
			]);
			expect(result).toHaveExitCode(0);

			const json = JSON.parse(result.stdout);
			expect(json.removed).toBe(2);
			expect(json.tasks).toHaveLength(2);
			expect(json.backup).toBeDefined();
		});
	});
});
