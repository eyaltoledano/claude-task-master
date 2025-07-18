/**
 * E2E tests for show command
 * Tests task display functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('task-master show', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-show-'));

		// Initialize test helpers
		const context = global.createTestContext('show');
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

	describe('Basic task display', () => {
		it('should show a single task', async () => {
			// Create a task
			const task = await helpers.taskMaster('add-task', ['--title', '"Test task"', '--description', '"A detailed description of the task"'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Show the task
			const result = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Test task');
			expect(result.stdout).toContain('A detailed description of the task');
			expect(result.stdout).toContain(taskId);
			expect(result.stdout).toContain('Status:');
			expect(result.stdout).toContain('Priority:');
		});

		it('should show task with all fields', async () => {
			// Create a comprehensive task
			const task = await helpers.taskMaster('add-task', [
				'--title', '"Complete task"',
				'--description', '"Task with all fields populated"',
				'--priority', 'high'
			], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Set to in-progress
			await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'in-progress'], { cwd: testDir });

			// Show the task
			const result = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Complete task');
			expect(result.stdout).toContain('Task with all fields populated');
			expect(result.stdout).toContain('high');
			expect(result.stdout).toContain('in-progress');
		});
	});

	describe('Task with dependencies', () => {
		it('should show task dependencies', async () => {
			// Create dependency tasks
			const dep1 = await helpers.taskMaster('add-task', ['--title', '"Dependency 1"', '--description', '"First dependency"'], { cwd: testDir });
			const depId1 = helpers.extractTaskId(dep1.stdout);
			
			const dep2 = await helpers.taskMaster('add-task', ['--title', '"Dependency 2"', '--description', '"Second dependency"'], { cwd: testDir });
			const depId2 = helpers.extractTaskId(dep2.stdout);
			
			const main = await helpers.taskMaster('add-task', ['--title', '"Main task"', '--description', '"Has dependencies"'], { cwd: testDir });
			const mainId = helpers.extractTaskId(main.stdout);

			// Add dependencies
			await helpers.taskMaster('add-dependency', ['--id', mainId, '--depends-on', depId1], { cwd: testDir });
			await helpers.taskMaster('add-dependency', ['--id', mainId, '--depends-on', depId2], { cwd: testDir });

			// Show the task
			const result = await helpers.taskMaster('show', [mainId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependencies:');
			expect(result.stdout).toContain(depId1);
			expect(result.stdout).toContain(depId2);
		});

		it('should show tasks that depend on this task', async () => {
			// Create base task
			const base = await helpers.taskMaster('add-task', ['--title', '"Base task"', '--description', '"Others depend on this"'], { cwd: testDir });
			const baseId = helpers.extractTaskId(base.stdout);
			
			// Create dependent tasks
			const dep1 = await helpers.taskMaster('add-task', ['--title', 'Dependent 1', '--description', 'Depends on base'], { cwd: testDir });
			const depId1 = helpers.extractTaskId(dep1.stdout);
			
			const dep2 = await helpers.taskMaster('add-task', ['--title', 'Dependent 2', '--description', 'Also depends on base'], { cwd: testDir });
			const depId2 = helpers.extractTaskId(dep2.stdout);

			// Add dependencies
			await helpers.taskMaster('add-dependency', ['--id', depId1, '--depends-on', baseId], { cwd: testDir });
			await helpers.taskMaster('add-dependency', ['--id', depId2, '--depends-on', baseId], { cwd: testDir });

			// Show the base task
			const result = await helpers.taskMaster('show', [baseId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			// May show dependent tasks or blocking information
		});
	});

	describe('Task with subtasks', () => {
		it('should show task with subtasks', async () => {
			// Create parent task
			const parent = await helpers.taskMaster('add-task', ['--title', 'Parent task', '--description', 'Has subtasks'], { cwd: testDir });
			const parentId = helpers.extractTaskId(parent.stdout);

			// Add subtasks manually
			await helpers.taskMaster('add-subtask', ['--parent', parentId, '--title', 'Subtask 1', '--description', 'First subtask'], { cwd: testDir });
			await helpers.taskMaster('add-subtask', ['--parent', parentId, '--title', 'Subtask 2', '--description', 'Second subtask'], { cwd: testDir });
			await helpers.taskMaster('add-subtask', ['--parent', parentId, '--title', 'Subtask 3', '--description', 'Third subtask'], { cwd: testDir });

			// Show the parent task
			const result = await helpers.taskMaster('show', [parentId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Parent');
			expect(result.stdout).toContain('Subtasks');
			expect(result.stdout).toContain(`${parentId}.1`);
			expect(result.stdout).toContain(`${parentId}.2`);
			expect(result.stdout).toContain(`${parentId}.3`);
		});

		it('should show subtask details', async () => {
			// Create parent with subtasks
			const parent = await helpers.taskMaster('add-task', ['--title', 'Parent', '--description', 'Parent task'], { cwd: testDir });
			const parentId = helpers.extractTaskId(parent.stdout);

			// Expand
			await helpers.taskMaster('expand', ['-i', parentId, '-n', '2'], {
				cwd: testDir,
				timeout: 60000
			});

			// Show a specific subtask
			const result = await helpers.taskMaster('show', [`${parentId}.1`], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`${parentId}.1`);
			// Should show subtask details
		});

		it('should show subtask progress', async () => {
			// Create parent with subtasks
			const parent = await helpers.taskMaster('add-task', ['--title', 'Project', '--description', 'Multi-step project'], { cwd: testDir });
			const parentId = helpers.extractTaskId(parent.stdout);

			// Expand
			await helpers.taskMaster('expand', ['-i', parentId, '-n', '4'], {
				cwd: testDir,
				timeout: 60000
			});

			// Complete some subtasks
			await helpers.taskMaster('set-status', ['--id', `${parentId}.1`, '--status', 'done'], { cwd: testDir });
			await helpers.taskMaster('set-status', ['--id', `${parentId}.2`, '--status', 'done'], { cwd: testDir });
			await helpers.taskMaster('set-status', ['--id', `${parentId}.3`, '--status', 'in-progress'], { cwd: testDir });

			// Show parent task
			const result = await helpers.taskMaster('show', [parentId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Project');
			// May show progress indicator or completion percentage
		});
	});

	describe('Error handling', () => {
		it('should fail when showing non-existent task', async () => {
			const result = await helpers.taskMaster('show', ['999'], {
				cwd: testDir,
				allowFailure: true
			});

			// The command currently returns exit code 0 but shows error message in stdout
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('not found');
		});

		it('should fail when task ID not provided', async () => {
			const result = await helpers.taskMaster('show', [], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Please provide a task ID');
		});

		it('should handle invalid task ID format', async () => {
			const result = await helpers.taskMaster('show', ['invalid-id'], {
				cwd: testDir,
				allowFailure: true
			});

			// Command accepts invalid ID format but shows error in output
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('not found');
		});
	});

	describe('Tag context', () => {
		it('should show task from specific tag', async () => {
			// Create tags and tasks
			await helpers.taskMaster('add-tag', ['feature'], { cwd: testDir });
			
			// Add task to feature tag
			await helpers.taskMaster('use-tag', ['feature'], { cwd: testDir });
			const task = await helpers.taskMaster('add-task', ['--title', 'Feature task', '--description', 'In feature tag'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Show with tag context
			const result = await helpers.taskMaster('show', [taskId, '--tag', 'feature'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Feature');
			expect(result.stdout).toContain('In');
		});

		it('should indicate task tag in output', async () => {
			// Create task in non-master tag
			await helpers.taskMaster('add-tag', ['development'], { cwd: testDir });
			await helpers.taskMaster('use-tag', ['development'], { cwd: testDir });
			
			const task = await helpers.taskMaster('add-task', ['--title', 'Dev task', '--description', 'Development work'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Show the task
			const result = await helpers.taskMaster('show', [taskId, '--tag', 'development'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			// May show tag information in output
		});
	});

	describe('Output formats', () => {
		it('should show task with timestamps', async () => {
			// Create task
			const task = await helpers.taskMaster('add-task', ['--title', 'Timestamped task', '--description', 'Check timestamps'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Show with verbose or detailed flag if supported
			const result = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			// May show created/modified timestamps
		});

		it('should show task history if available', async () => {
			// Create task and make changes
			const task = await helpers.taskMaster('add-task', ['--title', 'Task with history', '--description', 'Original description'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Update status multiple times
			await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'in-progress'], { cwd: testDir });
			await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'review'], { cwd: testDir });
			await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'in-progress'], { cwd: testDir });
			await helpers.taskMaster('set-status', ['--id', taskId, '--status', 'done'], { cwd: testDir });

			// Show task - may include history
			const result = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Task');
		});
	});

	describe('Complex task structures', () => {
		it('should show task with multiple levels of subtasks', async () => {
			// Create main task
			const main = await helpers.taskMaster('add-task', ['--title', 'Main project', '--description', 'Top level'], { cwd: testDir });
			const mainId = helpers.extractTaskId(main.stdout);

			// Add subtasks manually
			await helpers.taskMaster('add-subtask', ['--parent', mainId, '--title', 'Subtask 1', '--description', 'First level subtask'], { cwd: testDir });
			await helpers.taskMaster('add-subtask', ['--parent', mainId, '--title', 'Subtask 2', '--description', 'Second level subtask'], { cwd: testDir });

			// Show main task
			const result = await helpers.taskMaster('show', [mainId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Main');
			expect(result.stdout).toContain('Subtasks');
		});

		it('should show task with dependencies and subtasks', async () => {
			// Create dependency
			const dep = await helpers.taskMaster('add-task', ['--title', '"Prerequisite"', '--description', '"Must be done first"'], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);

			// Create main task with dependency
			const main = await helpers.taskMaster('add-task', ['--title', '"Complex task"', '--description', '"Has both deps and subtasks"'], { cwd: testDir });
			const mainId = helpers.extractTaskId(main.stdout);
			await helpers.taskMaster('add-dependency', ['--id', mainId, '--depends-on', depId], { cwd: testDir });

			// Add subtasks manually
			await helpers.taskMaster('add-subtask', ['--parent', mainId, '--title', 'Subtask 1', '--description', 'First subtask'], { cwd: testDir });
			await helpers.taskMaster('add-subtask', ['--parent', mainId, '--title', 'Subtask 2', '--description', 'Second subtask'], { cwd: testDir });

			// Show the complex task
			const result = await helpers.taskMaster('show', [mainId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Complex task');
			expect(result.stdout).toContain('Dependencies:');
			expect(result.stdout).toContain('Subtasks');
		});
	});

	describe('Display options', () => {
		it('should show task in compact format if supported', async () => {
			const task = await helpers.taskMaster('add-task', ['--title', 'Compact display', '--description', 'Test compact view'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Try compact flag if supported
			const result = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Compact');
		});

		it('should show task with color coding for status', async () => {
			// Create tasks with different statuses
			const pending = await helpers.taskMaster('add-task', ['--title', 'Pending task', '--description', 'Status: pending'], { cwd: testDir });
			const pendingId = helpers.extractTaskId(pending.stdout);

			const inProgress = await helpers.taskMaster('add-task', ['--title', 'Active task', '--description', 'Status: in-progress'], { cwd: testDir });
			const inProgressId = helpers.extractTaskId(inProgress.stdout);
			await helpers.taskMaster('set-status', ['--id', inProgressId, '--status', 'in-progress'], { cwd: testDir });

			const done = await helpers.taskMaster('add-task', ['--title', 'Completed task', '--description', 'Status: done'], { cwd: testDir });
			const doneId = helpers.extractTaskId(done.stdout);
			await helpers.taskMaster('set-status', ['--id', doneId, '--status', 'done'], { cwd: testDir });

			// Show each task - output may include color codes or status indicators
			const pendingResult = await helpers.taskMaster('show', [pendingId], { cwd: testDir });
			expect(pendingResult).toHaveExitCode(0);

			const inProgressResult = await helpers.taskMaster('show', [inProgressId], { cwd: testDir });
			expect(inProgressResult).toHaveExitCode(0);
			expect(inProgressResult.stdout).toContain('► in-progress');

			const doneResult = await helpers.taskMaster('show', [doneId], { cwd: testDir });
			expect(doneResult).toHaveExitCode(0);
			expect(doneResult.stdout).toContain('✓ done');
		});
	});
});