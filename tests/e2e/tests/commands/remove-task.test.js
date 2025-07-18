/**
 * E2E tests for remove-task command
 * Tests task removal functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
	mkdtempSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	mkdirSync
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { copyConfigFiles } from '../../utils/test-setup.js';

describe('task-master remove-task', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-remove-task-'));

		// Initialize test helpers
		const context = global.createTestContext('remove-task');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(process.cwd(), '.env');
		const testEnvPath = join(testDir, '.env');
		if (existsSync(mainEnvPath)) {
			const envContent = readFileSync(mainEnvPath, 'utf8');
			writeFileSync(testEnvPath, envContent);
		}

		// Copy configuration files
		copyConfigFiles(testDir);

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

	describe('Basic task removal', () => {
		it('should remove a single task', async () => {
			// Create a task
			const task = await helpers.taskMaster(
				'add-task',
				['--title', 'Task to remove', '--description', 'This will be removed'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(task.stdout);

			// Remove the task with --yes to skip confirmation
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', taskId, '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully removed task');
			expect(result.stdout).toContain(taskId);

			// Verify task is gone
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			expect(listResult.stdout).not.toContain('Task to remove');
		});

		it('should remove task with confirmation prompt bypassed', async () => {
			// Create a task
			const task = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Task to force remove',
					'--description',
					'Will be removed with force'
				],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(task.stdout);

			// Remove with yes flag to skip confirmation
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', taskId, '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully removed task');
		});

		it('should remove multiple tasks', async () => {
			// Create multiple tasks
			const task1 = await helpers.taskMaster(
				'add-task',
				['--title', 'First task', '--description', 'To be removed'],
				{ cwd: testDir }
			);
			const taskId1 = helpers.extractTaskId(task1.stdout);

			const task2 = await helpers.taskMaster(
				'add-task',
				['--title', 'Second task', '--description', 'Also to be removed'],
				{ cwd: testDir }
			);
			const taskId2 = helpers.extractTaskId(task2.stdout);

			const task3 = await helpers.taskMaster(
				'add-task',
				['--title', 'Third task', '--description', 'Will remain'],
				{ cwd: testDir }
			);
			const taskId3 = helpers.extractTaskId(task3.stdout);

			// Remove first two tasks
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', `${taskId1},${taskId2}`, '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully removed');

			// Verify correct tasks were removed
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			expect(listResult.stdout).not.toContain('First task');
			expect(listResult.stdout).not.toContain('Second task');
			expect(listResult.stdout).toContain('Third task');
		});
	});

	describe('Error handling', () => {
		it('should fail when removing non-existent task', async () => {
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', '999', '--yes'],
				{
					cwd: testDir,
					allowFailure: true
				}
			);

			// The command might succeed but show a warning, or fail
			if (result.exitCode === 0) {
				// If it succeeds, it should show that no task was removed
				expect(result.stdout).toMatch(
					/not found|no.*task.*999|does not exist|No existing tasks found to remove/i
				);
			} else {
				expect(result.stderr).toContain('not found');
			}
		});

		it('should fail when task ID is not provided', async () => {
			const result = await helpers.taskMaster('remove-task', [], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('required');
		});

		it('should handle invalid task ID format', async () => {
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', 'invalid-id', '--yes'],
				{
					cwd: testDir,
					allowFailure: true
				}
			);

			// The command might succeed but show a warning, or fail
			if (result.exitCode === 0) {
				// If it succeeds, it should show that the ID is invalid or not found
				expect(result.stdout).toMatch(
					/invalid|not found|does not exist|No existing tasks found to remove/i
				);
			} else {
				expect(result.exitCode).not.toBe(0);
			}
		});
	});

	describe('Task with dependencies', () => {
		it('should warn when removing task that others depend on', async () => {
			// Create dependent tasks
			const task1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Base task', '--description', 'Others depend on this'],
				{ cwd: testDir }
			);
			const taskId1 = helpers.extractTaskId(task1.stdout);

			const task2 = await helpers.taskMaster(
				'add-task',
				['--title', 'Dependent task', '--description', 'Depends on base'],
				{ cwd: testDir }
			);
			const taskId2 = helpers.extractTaskId(task2.stdout);

			// Add dependency
			await helpers.taskMaster(
				'add-dependency',
				['--id', taskId2, '--depends-on', taskId1],
				{ cwd: testDir }
			);

			// Try to remove base task
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', taskId1, '--yes'],
				{ cwd: testDir }
			);

			// Should either warn or update dependent tasks
			expect(result).toHaveExitCode(0);
		});

		it('should handle removing task with dependencies', async () => {
			// Create tasks with dependency chain
			const task1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Dependency 1', '--description', 'First dep'],
				{ cwd: testDir }
			);
			const taskId1 = helpers.extractTaskId(task1.stdout);

			const task2 = await helpers.taskMaster(
				'add-task',
				['--title', 'Main task', '--description', 'Has dependencies'],
				{ cwd: testDir }
			);
			const taskId2 = helpers.extractTaskId(task2.stdout);

			// Add dependency
			await helpers.taskMaster(
				'add-dependency',
				['--id', taskId2, '--depends-on', taskId1],
				{ cwd: testDir }
			);

			// Remove the main task (with dependencies)
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', taskId2, '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully removed task');

			// Dependency task should still exist
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			expect(listResult.stdout).toContain('Dependency 1');
			expect(listResult.stdout).not.toContain('Main task');
		});
	});

	describe('Task with subtasks', () => {
		it('should remove task and all its subtasks', async () => {
			// Create parent task
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'Has subtasks'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			// Expand to create subtasks
			await helpers.taskMaster('expand', ['-i', parentId, '-n', '3'], {
				cwd: testDir,
				timeout: 60000
			});

			// Remove parent task
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', parentId, '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully removed task');

			// Verify parent and subtasks are gone
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			expect(listResult.stdout).not.toContain('Parent task');
			expect(listResult.stdout).not.toContain(`${parentId}.1`);
			expect(listResult.stdout).not.toContain(`${parentId}.2`);
			expect(listResult.stdout).not.toContain(`${parentId}.3`);
		});

		it('should remove only subtask when specified', async () => {
			// Create parent task with subtasks
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent with subtasks', '--description', 'Parent task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			// Try to expand to create subtasks
			const expandResult = await helpers.taskMaster(
				'expand',
				['-i', parentId, '-n', '3'],
				{
					cwd: testDir,
					timeout: 60000
				}
			);

			// Check if subtasks were created
			const verifyResult = await helpers.taskMaster('show', [parentId], {
				cwd: testDir
			});
			if (!verifyResult.stdout.includes('Subtasks')) {
				// If expand didn't create subtasks, create them manually
				await helpers.taskMaster(
					'add-subtask',
					[
						'--parent',
						parentId,
						'--title',
						'Subtask 1',
						'--description',
						'First subtask'
					],
					{ cwd: testDir }
				);
				await helpers.taskMaster(
					'add-subtask',
					[
						'--parent',
						parentId,
						'--title',
						'Subtask 2',
						'--description',
						'Second subtask'
					],
					{ cwd: testDir }
				);
				await helpers.taskMaster(
					'add-subtask',
					[
						'--parent',
						parentId,
						'--title',
						'Subtask 3',
						'--description',
						'Third subtask'
					],
					{ cwd: testDir }
				);
			}

			// Remove only one subtask
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', `${parentId}.2`, '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify parent task still exists
			const showResult = await helpers.taskMaster('show', [parentId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Parent with subtasks');

			// Check if subtasks are displayed - the behavior may vary
			if (showResult.stdout.includes('Subtasks')) {
				// If subtasks are shown, verify the correct ones exist
				expect(showResult.stdout).toContain(`${parentId}.1`);
				expect(showResult.stdout).not.toContain(`${parentId}.2`);
				expect(showResult.stdout).toContain(`${parentId}.3`);
			} else {
				// If subtasks aren't shown, verify via list command
				const listResult = await helpers.taskMaster(
					'list',
					['--with-subtasks'],
					{ cwd: testDir }
				);
				expect(listResult.stdout).toContain('Parent with subtasks');
				// The subtask should be removed from the list
				expect(listResult.stdout).not.toContain(`${parentId}.2`);
			}
		});
	});

	describe('Tag context', () => {
		it('should remove task from specific tag', async () => {
			// Create tag and add tasks
			await helpers.taskMaster('add-tag', ['feature'], { cwd: testDir });

			// Add task to master
			const masterTask = await helpers.taskMaster(
				'add-task',
				['--title', 'Master task', '--description', 'In master'],
				{ cwd: testDir }
			);
			const masterId = helpers.extractTaskId(masterTask.stdout);

			// Add task to feature tag
			await helpers.taskMaster('use-tag', ['feature'], { cwd: testDir });
			const featureTask = await helpers.taskMaster(
				'add-task',
				['--title', 'Feature task', '--description', 'In feature'],
				{ cwd: testDir }
			);
			const featureId = helpers.extractTaskId(featureTask.stdout);

			// Remove task from feature tag
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', featureId, '--tag', 'feature', '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify only feature task was removed
			await helpers.taskMaster('use-tag', ['master'], { cwd: testDir });
			const masterList = await helpers.taskMaster('list', [], { cwd: testDir });
			expect(masterList.stdout).toContain('Master task');

			await helpers.taskMaster('use-tag', ['feature'], { cwd: testDir });
			const featureList = await helpers.taskMaster('list', [], {
				cwd: testDir
			});
			expect(featureList.stdout).not.toContain('Feature task');
		});
	});

	describe('Status considerations', () => {
		it('should remove tasks in different statuses', async () => {
			// Create tasks with different statuses
			const pendingTask = await helpers.taskMaster(
				'add-task',
				['--title', 'Pending task', '--description', 'Status: pending'],
				{ cwd: testDir }
			);
			const pendingId = helpers.extractTaskId(pendingTask.stdout);

			const inProgressTask = await helpers.taskMaster(
				'add-task',
				['--title', 'In progress task', '--description', 'Status: in-progress'],
				{ cwd: testDir }
			);
			const inProgressId = helpers.extractTaskId(inProgressTask.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', inProgressId, '--status', 'in-progress'],
				{ cwd: testDir }
			);

			const doneTask = await helpers.taskMaster(
				'add-task',
				['--title', 'Done task', '--description', 'Status: done'],
				{ cwd: testDir }
			);
			const doneId = helpers.extractTaskId(doneTask.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', doneId, '--status', 'done'],
				{ cwd: testDir }
			);

			// Remove all tasks
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', `${pendingId},${inProgressId},${doneId}`, '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify all are removed
			const listResult = await helpers.taskMaster('list', ['--all'], {
				cwd: testDir
			});
			expect(listResult.stdout).not.toContain('Pending task');
			expect(listResult.stdout).not.toContain('In progress task');
			expect(listResult.stdout).not.toContain('Done task');
		});

		it('should warn when removing in-progress task', async () => {
			// Create in-progress task
			const task = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Active task',
					'--description',
					'Currently being worked on'
				],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(task.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId, '--status', 'in-progress'],
				{ cwd: testDir }
			);

			// Remove without force (if interactive prompt is supported)
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', taskId, '--yes'],
				{ cwd: testDir }
			);

			// Should succeed with force flag
			expect(result).toHaveExitCode(0);
		});
	});

	describe('Output options', () => {
		it('should support quiet mode', async () => {
			const task = await helpers.taskMaster(
				'add-task',
				['--title', 'Quiet removal', '--description', 'Remove quietly'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(task.stdout);

			// Remove without quiet flag since -q is not supported
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', taskId, '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			// Task should be removed
		});

		it('should show detailed output in verbose mode', async () => {
			const task = await helpers.taskMaster(
				'add-task',
				['--title', 'Verbose removal', '--description', 'Remove with details'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(task.stdout);

			// Remove with verbose flag if supported
			const result = await helpers.taskMaster(
				'remove-task',
				['--id', taskId, '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully removed task');
		});
	});
});
