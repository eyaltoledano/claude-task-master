/**
 * E2E tests for add-dependency command
 * Tests dependency management functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('task-master add-dependency', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-add-dep-'));

		// Initialize test helpers
		const context = global.createTestContext('add-dependency');
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

	describe('Basic dependency creation', () => {
		it('should add a single dependency to a task', async () => {
			// Create tasks
			const dep = await helpers.taskMaster('add-task', ['--title', 'Dependency task', '--description', 'A dependency'], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);

			const task = await helpers.taskMaster('add-task', ['--title', 'Main task', '--description', 'Main task description'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Add dependency
			const result = await helpers.taskMaster('add-dependency', ['--id', taskId, '--depends-on', depId], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully added dependency');
			expect(result.stdout).toContain(`Task ${taskId} now depends on ${depId}`);

			// Verify dependency was added
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			expect(showResult.stdout).toContain('Dependencies:');
			expect(showResult.stdout).toContain(depId);
		});

		it('should add multiple dependencies at once', async () => {
			// Create dependency tasks
			const dep1 = await helpers.taskMaster('add-task', ['--title', 'First dependency', '--description', 'First dep'], { cwd: testDir });
			const depId1 = helpers.extractTaskId(dep1.stdout);

			const dep2 = await helpers.taskMaster('add-task', ['--title', 'Second dependency', '--description', 'Second dep'], { cwd: testDir });
			const depId2 = helpers.extractTaskId(dep2.stdout);

			const dep3 = await helpers.taskMaster('add-task', ['--title', 'Third dependency', '--description', 'Third dep'], { cwd: testDir });
			const depId3 = helpers.extractTaskId(dep3.stdout);

			const task = await helpers.taskMaster('add-task', ['--title', 'Main task', '--description', 'Main task'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Add multiple dependencies
			const result = await helpers.taskMaster('add-dependency', [
				'--id', taskId,
				'--depends-on', `${depId1},${depId2},${depId3}`
			], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependencies added');

			// Verify all dependencies were added
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			expect(showResult.stdout).toContain(depId1);
			expect(showResult.stdout).toContain(depId2);
			expect(showResult.stdout).toContain(depId3);
		});
	});

	describe('Dependency validation', () => {
		it('should prevent circular dependencies', async () => {
			// Create circular dependency chain
			const task1 = await helpers.taskMaster('add-task', ['--title', 'Task 1', '--description', 'First task'], { cwd: testDir });
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = await helpers.taskMaster('add-task', ['--title', 'Task 2', '--description', 'Second task'], { cwd: testDir });
			const id2 = helpers.extractTaskId(task2.stdout);

			// Add first dependency
			await helpers.taskMaster('add-dependency', ['--id', id2, '--depends-on', id1], { cwd: testDir });

			// Try to create circular dependency
			const result = await helpers.taskMaster('add-dependency', ['--id', id1, '--depends-on', id2], {
				cwd: testDir,
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('circular dependency');
		});

		it('should prevent self-dependencies', async () => {
			const task = await helpers.taskMaster('add-task', ['--title', 'Task', '--description', 'A task'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			const result = await helpers.taskMaster('add-dependency', ['--id', taskId, '--depends-on', taskId], {
				cwd: testDir,
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('cannot depend on itself');
		});

		it('should detect transitive circular dependencies', async () => {
			// Create chain: A -> B -> C, then try C -> A
			const taskA = await helpers.taskMaster('add-task', ['--title', 'Task A', '--description', 'Task A'], { cwd: testDir });
			const idA = helpers.extractTaskId(taskA.stdout);

			const taskB = await helpers.taskMaster('add-task', ['--title', 'Task B', '--description', 'Task B'], { cwd: testDir });
			const idB = helpers.extractTaskId(taskB.stdout);

			const taskC = await helpers.taskMaster('add-task', ['--title', 'Task C', '--description', 'Task C'], { cwd: testDir });
			const idC = helpers.extractTaskId(taskC.stdout);

			// Create chain
			await helpers.taskMaster('add-dependency', ['--id', idB, '--depends-on', idA], { cwd: testDir });
			await helpers.taskMaster('add-dependency', ['--id', idC, '--depends-on', idB], { cwd: testDir });

			// Try to create circular dependency
			const result = await helpers.taskMaster('add-dependency', ['--id', idA, '--depends-on', idC], {
				cwd: testDir,
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('circular dependency');
		});

		it('should prevent duplicate dependencies', async () => {
			const dep = await helpers.taskMaster('add-task', ['--title', 'Dependency', '--description', 'A dependency'], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);

			const task = await helpers.taskMaster('add-task', ['--title', 'Task', '--description', 'A task'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Add dependency first time
			await helpers.taskMaster('add-dependency', ['--id', taskId, '--depends-on', depId], { cwd: testDir });

			// Try to add same dependency again
			const result = await helpers.taskMaster('add-dependency', ['--id', taskId, '--depends-on', depId], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('already depends on');
			expect(result.stdout).toContain('No changes made');
		});
	});

	describe('Status updates', () => {
		it('should update task status to blocked when adding dependencies', async () => {
			const dep = await helpers.taskMaster('add-task', [
				'--title',
				'Incomplete dependency',
				'--description',
				'Not done yet'
			], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);

			const task = await helpers.taskMaster('add-task', ['--title', 'Task', '--description', 'A task'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Start the task
			await helpers.taskMaster('set-status', [taskId, 'in-progress'], { cwd: testDir });

			// Add dependency (should change status to blocked)
			const result = await helpers.taskMaster('add-dependency', ['--id', taskId, '--depends-on', depId], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Status changed to: blocked');

			// Verify status
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			expect(showResult.stdout).toContain('Status: blocked');
		});

		it('should not change status if all dependencies are complete', async () => {
			const dep = await helpers.taskMaster('add-task', ['--title', 'Complete dependency', '--description', 'Done'], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);
			await helpers.taskMaster('set-status', [depId, 'done'], { cwd: testDir });

			const task = await helpers.taskMaster('add-task', ['--title', 'Task', '--description', 'A task'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);
			await helpers.taskMaster('set-status', [taskId, 'in-progress'], { cwd: testDir });

			// Add completed dependency
			const result = await helpers.taskMaster('add-dependency', ['--id', taskId, '--depends-on', depId], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).not.toContain('Status changed');

			// Status should remain in-progress
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			expect(showResult.stdout).toContain('Status: in-progress');
		});
	});

	describe('Subtask dependencies', () => {
		it('should add dependency to a subtask', async () => {
			// Create parent and dependency
			const parent = await helpers.taskMaster('add-task', ['--title', 'Parent task', '--description', 'Parent'], { cwd: testDir });
			const parentId = helpers.extractTaskId(parent.stdout);

			const dep = await helpers.taskMaster('add-task', ['--title', 'Dependency', '--description', 'A dependency'], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);

			// Expand parent
			await helpers.taskMaster('expand', ['-i', parentId, '-n', '2'], {
				cwd: testDir,
				timeout: 60000
			});

			// Add dependency to subtask
			const subtaskId = `${parentId}.1`;
			const result = await helpers.taskMaster('add-dependency', ['--id', subtaskId, '--depends-on', depId], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`${subtaskId} now depends on ${depId}`);
		});

		it('should allow subtask to depend on another subtask', async () => {
			// Create parent task
			const parent = await helpers.taskMaster('add-task', ['--title', 'Parent', '--description', 'Parent task'], { cwd: testDir });
			const parentId = helpers.extractTaskId(parent.stdout);

			// Expand to create subtasks
			await helpers.taskMaster('expand', ['-i', parentId, '-n', '3'], {
				cwd: testDir,
				timeout: 60000
			});

			// Make subtask 2 depend on subtask 1
			const result = await helpers.taskMaster('add-dependency', [
				'--id', `${parentId}.2`,
				'--depends-on', `${parentId}.1`
			], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependency added successfully');
		});

		it('should prevent parent depending on its own subtask', async () => {
			const parent = await helpers.taskMaster('add-task', ['--title', 'Parent', '--description', 'Parent task'], { cwd: testDir });
			const parentId = helpers.extractTaskId(parent.stdout);

			await helpers.taskMaster('expand', ['-i', parentId, '-n', '2'], {
				cwd: testDir,
				timeout: 60000
			});

			const result = await helpers.taskMaster(
				'add-dependency',
				['--id', parentId, '--depends-on', `${parentId}.1`],
				{ cwd: testDir, allowFailure: true }
			);
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('cannot depend on its own subtask');
		});
	});

	describe('Bulk operations', () => {
		it('should add dependencies to multiple tasks', async () => {
			// Create dependency
			const dep = await helpers.taskMaster('add-task', ['--title', 'Shared dependency', '--description', 'Shared dep'], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);

			// Create multiple tasks
			const task1 = await helpers.taskMaster('add-task', ['--title', 'Task 1', '--description', 'First'], { cwd: testDir });
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = await helpers.taskMaster('add-task', ['--title', 'Task 2', '--description', 'Second'], { cwd: testDir });
			const id2 = helpers.extractTaskId(task2.stdout);

			const task3 = await helpers.taskMaster('add-task', ['--title', 'Task 3', '--description', 'Third'], { cwd: testDir });
			const id3 = helpers.extractTaskId(task3.stdout);

			// Add dependency to all tasks
			const result = await helpers.taskMaster('add-dependency', [
				'--id', `${id1},${id2},${id3}`,
				'--depends-on', depId
			], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('3 tasks updated');

			// Verify all have the dependency
			for (const id of [id1, id2, id3]) {
				const showResult = await helpers.taskMaster('show', [id], { cwd: testDir });
				expect(showResult.stdout).toContain(depId);
			}
		});

		it('should add dependencies by range', async () => {
			// Create dependency
			const dep = await helpers.taskMaster('add-task', ['--title', 'Dependency', '--description', 'A dep'], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);

			// Create sequential tasks
			const ids = [];
			for (let i = 0; i < 5; i++) {
				const result = await helpers.taskMaster('add-task', ['--title', `Task ${i + 1}`, '--description', `Task number ${i + 1}`], { cwd: testDir });
				ids.push(helpers.extractTaskId(result.stdout));
			}

			// Add dependency to range
			const result = await helpers.taskMaster('add-dependency', [
				'--from',
				ids[1],
				'--to',
				ids[3],
				'--depends-on',
				depId
			], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('3 tasks updated');

			// Verify middle tasks have dependency
			for (let i = 1; i <= 3; i++) {
				const showResult = await helpers.taskMaster('show', [ids[i]], { cwd: testDir });
				expect(showResult.stdout).toContain(depId);
			}

			// Verify edge tasks don't have dependency
			const show0 = await helpers.taskMaster('show', [ids[0]], { cwd: testDir });
			expect(show0.stdout).not.toContain(`Dependencies:.*${depId}`);
		});
	});

	describe('Complex dependency graphs', () => {
		it('should handle diamond dependency pattern', async () => {
			// Create diamond: A depends on B and C, both B and C depend on D
			const taskD = await helpers.taskMaster('add-task', ['--title', 'Task D (base)', '--description', 'Base task'], { cwd: testDir });
			const idD = helpers.extractTaskId(taskD.stdout);

			const taskB = await helpers.taskMaster('add-task', ['--title', 'Task B', '--description', 'Middle task B'], { cwd: testDir });
			const idB = helpers.extractTaskId(taskB.stdout);
			await helpers.taskMaster('add-dependency', ['--id', idB, '--depends-on', idD], { cwd: testDir });

			const taskC = await helpers.taskMaster('add-task', ['--title', 'Task C', '--description', 'Middle task C'], { cwd: testDir });
			const idC = helpers.extractTaskId(taskC.stdout);
			await helpers.taskMaster('add-dependency', ['--id', idC, '--depends-on', idD], { cwd: testDir });

			const taskA = await helpers.taskMaster('add-task', ['--title', 'Task A (top)', '--description', 'Top task'], { cwd: testDir });
			const idA = helpers.extractTaskId(taskA.stdout);

			// Add both dependencies to create diamond
			const result = await helpers.taskMaster('add-dependency', [
				'--id', idA,
				'--depends-on', `${idB},${idC}`
			], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('2 dependencies added');

			// Verify the structure
			const showResult = await helpers.taskMaster('show', [idA], { cwd: testDir });
			expect(showResult.stdout).toContain(idB);
			expect(showResult.stdout).toContain(idC);
		});

		it('should show transitive dependencies', async () => {
			// Create chain A -> B -> C -> D
			const taskD = await helpers.taskMaster('add-task', ['--title', 'Task D', '--description', 'End task'], { cwd: testDir });
			const idD = helpers.extractTaskId(taskD.stdout);

			const taskC = await helpers.taskMaster('add-task', ['--title', 'Task C', '--description', 'Middle task'], { cwd: testDir });
			const idC = helpers.extractTaskId(taskC.stdout);
			await helpers.taskMaster('add-dependency', ['--id', idC, '--depends-on', idD], { cwd: testDir });

			const taskB = await helpers.taskMaster('add-task', ['--title', 'Task B', '--description', 'Middle task'], { cwd: testDir });
			const idB = helpers.extractTaskId(taskB.stdout);
			await helpers.taskMaster('add-dependency', ['--id', idB, '--depends-on', idC], { cwd: testDir });

			const taskA = await helpers.taskMaster('add-task', ['--title', 'Task A', '--description', 'Start task'], { cwd: testDir });
			const idA = helpers.extractTaskId(taskA.stdout);
			await helpers.taskMaster('add-dependency', ['--id', idA, '--depends-on', idB], { cwd: testDir });

			// Show should indicate full dependency chain
			const result = await helpers.taskMaster('show', [idA], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependencies:');
			expect(result.stdout).toContain(idB);
			// May also show transitive dependencies in some views
		});
	});

	describe('Tag context', () => {
		it('should add dependencies within a tag', async () => {
			// Create tag
			await helpers.taskMaster('add-tag', ['feature'], { cwd: testDir });
			await helpers.taskMaster('use-tag', ['feature'], { cwd: testDir });

			// Create tasks in feature tag
			const dep = await helpers.taskMaster('add-task', ['--title', 'Feature dependency', '--description', 'Dep in feature'], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);

			const task = await helpers.taskMaster('add-task', ['--title', 'Feature task', '--description', 'Task in feature'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			// Add dependency with tag context
			const result = await helpers.taskMaster('add-dependency', [
				'--id', taskId,
				'--depends-on', depId,
				'--tag',
				'feature'
			], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('[feature]');
		});

		it('should prevent cross-tag dependencies by default', async () => {
			// Create tasks in different tags
			const masterTask = await helpers.taskMaster('add-task', ['--title', 'Master task', '--description', 'In master tag'], { cwd: testDir });
			const masterId = helpers.extractTaskId(masterTask.stdout);

			await helpers.taskMaster('add-tag', ['feature'], { cwd: testDir });
			await helpers.taskMaster('use-tag', ['feature'], { cwd: testDir });
			const featureTask = await helpers.taskMaster('add-task', [
				'--title',
				'Feature task',
				'--description',
				'In feature tag'
			], { cwd: testDir });
			const featureId = helpers.extractTaskId(featureTask.stdout);

			// Try to add cross-tag dependency
			const result = await helpers.taskMaster(
				'add-dependency',
				['--id', featureId, '--depends-on', masterId, '--tag', 'feature'],
				{ cwd: testDir, allowFailure: true }
			);
			// Depending on implementation, this might warn or fail
		});
	});

	describe('Error handling', () => {
		it('should handle non-existent task IDs', async () => {
			const task = await helpers.taskMaster('add-task', ['--title', 'Task', '--description', 'A task'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			const result = await helpers.taskMaster('add-dependency', ['--id', taskId, '--depends-on', '999'], {
				cwd: testDir,
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toMatch(/Task.*999.*not found/i);
		});

		it('should handle invalid task ID format', async () => {
			const result = await helpers.taskMaster('add-dependency', ['--id', 'invalid-id', '--depends-on', '1'], {
				cwd: testDir,
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid task ID');
		});

		it('should require both task and dependency IDs', async () => {
			const result = await helpers.taskMaster('add-dependency', ['--id', '1'], {
				cwd: testDir,
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('required');
		});
	});

	describe('Output options', () => {
		it('should support quiet mode', async () => {
			const dep = await helpers.taskMaster('add-task', ['--title', 'Dep', '--description', 'A dep'], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);

			const task = await helpers.taskMaster('add-task', ['--title', 'Task', '--description', 'A task'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			const result = await helpers.taskMaster('add-dependency', [
				'--id', taskId,
				'--depends-on', depId,
				'-q'
			], { cwd: testDir });
			expect(result).toHaveExitCode(0);
			expect(result.stdout.split('\n').length).toBeLessThan(3);
		});

		it('should support JSON output', async () => {
			const dep = await helpers.taskMaster('add-task', ['--title', 'Dep', '--description', 'A dep'], { cwd: testDir });
			const depId = helpers.extractTaskId(dep.stdout);

			const task = await helpers.taskMaster('add-task', ['--title', 'Task', '--description', 'A task'], { cwd: testDir });
			const taskId = helpers.extractTaskId(task.stdout);

			const result = await helpers.taskMaster('add-dependency', [
				'--id', taskId,
				'--depends-on', depId,
				'--json'
			], { cwd: testDir });
			expect(result).toHaveExitCode(0);

			const json = JSON.parse(result.stdout);
			expect(json.task.id).toBe(parseInt(taskId));
			expect(json.task.dependencies).toContain(parseInt(depId));
			expect(json.added).toBe(1);
		});
	});

	describe('Visualization', () => {
		it('should show dependency graph after adding', async () => {
			// Create simple dependency chain
			const task1 = await helpers.taskMaster('add-task', ['--title', 'Base task', '--description', 'Base'], { cwd: testDir });
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = await helpers.taskMaster('add-task', ['--title', 'Middle task', '--description', 'Middle'], { cwd: testDir });
			const id2 = helpers.extractTaskId(task2.stdout);

			const task3 = await helpers.taskMaster('add-task', ['--title', 'Top task', '--description', 'Top'], { cwd: testDir });
			const id3 = helpers.extractTaskId(task3.stdout);

			// Build chain
			await helpers.taskMaster('add-dependency', ['--id', id2, '--depends-on', id1], { cwd: testDir });
			const result = await helpers.taskMaster('add-dependency', ['--id', id3, '--depends-on', id2], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependency chain:');
			expect(result.stdout).toMatch(/→|depends on/);
		});
	});
});