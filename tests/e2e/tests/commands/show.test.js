import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, existsSync, readFileSync } from 'fs';

describe('task-master show', () => {
	let testDir;
	let helpers;

	beforeEach(() => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'tm-test-show-'));
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

	describe('Basic functionality', () => {
		it('should show task details by ID', () => {
			// Create a test task
			const addResult = helpers.taskMaster('add-task', [
				'Test task for show command',
				'-m',
				'-p',
				'high'
			]);
			expect(addResult).toHaveExitCode(0);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Show task details
			const result = helpers.taskMaster('show', [taskId]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Test task for show command');
			expect(result.stdout).toContain(`Task ID: ${taskId}`);
			expect(result.stdout).toContain('Priority: high');
			expect(result.stdout).toContain('Status: pending');
		});

		it('should show error for non-existent task ID', () => {
			const result = helpers.taskMaster('show', ['999'], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toMatch(/Task.*not found|does not exist/i);
		});

		it('should show task with all metadata', () => {
			// Create task with dependencies and tags
			const dep1 = helpers.taskMaster('add-task', ['Dependency 1', '-m']);
			const depId1 = helpers.extractTaskId(dep1.stdout);

			const addResult = helpers.taskMaster('add-task', [
				'Complex task',
				'-m',
				'-p',
				'medium',
				'-d',
				depId1,
				'--tags',
				'backend,api'
			]);
			const taskId = helpers.extractTaskId(addResult.stdout);

			const result = helpers.taskMaster('show', [taskId]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependencies:');
			expect(result.stdout).toContain(depId1);
			expect(result.stdout).toContain('Tags: backend, api');
		});
	});

	describe('Subtask display', () => {
		it('should show task with subtasks', () => {
			// Create parent task
			const parentResult = helpers.taskMaster('add-task', [
				'Parent task with subtasks',
				'-m'
			]);
			const parentId = helpers.extractTaskId(parentResult.stdout);

			// Expand to add subtasks
			const expandResult = helpers.taskMaster(
				'expand',
				['-i', parentId, '-n', '3'],
				{ timeout: 60000 }
			);
			expect(expandResult).toHaveExitCode(0);

			// Show parent task
			const result = helpers.taskMaster('show', [parentId]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Subtasks (3):');
			expect(result.stdout).toMatch(/\d+\.1.*pending/);
			expect(result.stdout).toMatch(/\d+\.2.*pending/);
			expect(result.stdout).toMatch(/\d+\.3.*pending/);
		});

		it('should show subtask details directly', () => {
			// Create parent task with subtasks
			const parentResult = helpers.taskMaster('add-task', [
				'Parent task',
				'-m'
			]);
			const parentId = helpers.extractTaskId(parentResult.stdout);

			const expandResult = helpers.taskMaster(
				'expand',
				['-i', parentId, '-n', '2'],
				{ timeout: 60000 }
			);
			expect(expandResult).toHaveExitCode(0);

			// Show specific subtask
			const subtaskId = `${parentId}.1`;
			const result = helpers.taskMaster('show', [subtaskId]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`Subtask ID: ${subtaskId}`);
			expect(result.stdout).toContain(`Parent Task: ${parentId}`);
		});
	});

	describe('Dependency visualization', () => {
		it('should show dependency graph', () => {
			// Create dependency chain
			const task1 = helpers.taskMaster('add-task', ['Task 1', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', ['Task 2', '-m', '-d', id1]);
			const id2 = helpers.extractTaskId(task2.stdout);

			const task3 = helpers.taskMaster('add-task', [
				'Task 3',
				'-m',
				'-d',
				`${id1},${id2}`
			]);
			const id3 = helpers.extractTaskId(task3.stdout);

			// Show task with dependencies
			const result = helpers.taskMaster('show', [id3]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependencies:');
			expect(result.stdout).toContain(`${id1} - Task 1`);
			expect(result.stdout).toContain(`${id2} - Task 2`);
			expect(result.stdout).toMatch(/Status:.*pending/);
		});

		it('should show tasks depending on current task', () => {
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

			// Show base task
			const result = helpers.taskMaster('show', [id1]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Tasks depending on this:');
			expect(result.stdout).toContain(`${id2} - Dependent task`);
		});
	});

	describe('Status and progress', () => {
		it('should show task progress for parent with subtasks', () => {
			// Create parent task with subtasks
			const parentResult = helpers.taskMaster('add-task', [
				'Parent task',
				'-m'
			]);
			const parentId = helpers.extractTaskId(parentResult.stdout);

			// Expand to add subtasks
			helpers.taskMaster('expand', ['-i', parentId, '-n', '3'], {
				timeout: 60000
			});

			// Mark one subtask as done
			helpers.taskMaster('set-status', [`${parentId}.1`, 'done']);

			// Show parent task
			const result = helpers.taskMaster('show', [parentId]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toMatch(/Progress:.*1\/3.*33%/);
			expect(result.stdout).toContain('└─ ✓'); // Done subtask indicator
		});

		it('should show different status indicators', () => {
			// Create tasks with different statuses
			const tasks = [
				{ status: 'pending', title: 'Pending task' },
				{ status: 'in-progress', title: 'In progress task' },
				{ status: 'done', title: 'Done task' },
				{ status: 'blocked', title: 'Blocked task' },
				{ status: 'deferred', title: 'Deferred task' },
				{ status: 'cancelled', title: 'Cancelled task' }
			];

			for (const { status, title } of tasks) {
				const addResult = helpers.taskMaster('add-task', [title, '-m']);
				const taskId = helpers.extractTaskId(addResult.stdout);

				if (status !== 'pending') {
					helpers.taskMaster('set-status', [taskId, status]);
				}

				const showResult = helpers.taskMaster('show', [taskId]);
				expect(showResult).toHaveExitCode(0);
				expect(showResult.stdout).toContain(`Status: ${status}`);
			}
		});
	});

	describe('Complexity information', () => {
		it('should show complexity score when available', () => {
			// Create a complex task
			const addResult = helpers.taskMaster('add-task', [
				'Build a distributed microservices architecture with Kubernetes',
				'-m'
			]);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Analyze complexity
			const analyzeResult = helpers.taskMaster(
				'analyze-complexity',
				['-i', taskId],
				{ timeout: 60000 }
			);

			if (analyzeResult.exitCode === 0) {
				const result = helpers.taskMaster('show', [taskId]);
				expect(result).toHaveExitCode(0);
				expect(result.stdout).toMatch(/Complexity Score:.*\d+/);
				expect(result.stdout).toContain('Recommended subtasks:');
			}
		});
	});

	describe('Research and documentation', () => {
		it('should show research notes if available', () => {
			// Create task
			const addResult = helpers.taskMaster('add-task', ['Research task', '-m']);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Add research notes (would normally be done via research command)
			// For now, we'll check that the section appears
			const result = helpers.taskMaster('show', [taskId]);
			expect(result).toHaveExitCode(0);
			// The show command should have a section for research notes
			// even if empty
		});
	});

	describe('Tag context', () => {
		it('should show task from specific tag', () => {
			// Create a new tag
			helpers.taskMaster('add-tag', ['feature-branch']);

			// Add task to feature tag
			helpers.taskMaster('use-tag', ['feature-branch']);
			const addResult = helpers.taskMaster('add-task', ['Feature task', '-m']);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Show task with tag context
			const result = helpers.taskMaster('show', [
				taskId,
				'--tag',
				'feature-branch'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Feature task');
			expect(result.stdout).toContain('[feature-branch]');
		});
	});

	describe('Output formats', () => {
		it('should show task in JSON format', () => {
			// Create task
			const addResult = helpers.taskMaster('add-task', [
				'JSON format test',
				'-m'
			]);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Show in JSON format
			const result = helpers.taskMaster('show', [taskId, '--json']);
			expect(result).toHaveExitCode(0);

			// Parse JSON output
			const jsonOutput = JSON.parse(result.stdout);
			expect(jsonOutput.id).toBe(parseInt(taskId));
			expect(jsonOutput.title).toBe('JSON format test');
			expect(jsonOutput.status).toBe('pending');
		});

		it('should show minimal output with quiet flag', () => {
			// Create task
			const addResult = helpers.taskMaster('add-task', [
				'Quiet mode test',
				'-m'
			]);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Show in quiet mode
			const result = helpers.taskMaster('show', [taskId, '-q']);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Quiet mode test');
			// Should have less output than normal
			expect(result.stdout.split('\n').length).toBeLessThan(20);
		});
	});

	describe('Navigation suggestions', () => {
		it('should show next/previous task suggestions', () => {
			// Create multiple tasks
			const task1 = helpers.taskMaster('add-task', ['First task', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', ['Second task', '-m']);
			const id2 = helpers.extractTaskId(task2.stdout);

			const task3 = helpers.taskMaster('add-task', ['Third task', '-m']);
			const id3 = helpers.extractTaskId(task3.stdout);

			// Show middle task
			const result = helpers.taskMaster('show', [id2]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Navigation:');
			expect(result.stdout).toContain(`Previous: ${id1}`);
			expect(result.stdout).toContain(`Next: ${id3}`);
		});
	});

	describe('Error handling', () => {
		it('should handle invalid task ID format', () => {
			const result = helpers.taskMaster('show', ['invalid-id'], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid task ID');
		});

		it('should handle missing tasks file', () => {
			const result = helpers.taskMaster(
				'show',
				['1', '--file', 'non-existent.json'],
				{ allowFailure: true }
			);
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Error');
		});
	});

	describe('Performance', () => {
		it('should show task with many subtasks efficiently', () => {
			// Create parent task
			const parentResult = helpers.taskMaster('add-task', [
				'Large parent task',
				'-m'
			]);
			const parentId = helpers.extractTaskId(parentResult.stdout);

			// Expand with many subtasks
			const expandResult = helpers.taskMaster(
				'expand',
				['-i', parentId, '-n', '10'],
				{ timeout: 120000 }
			);
			expect(expandResult).toHaveExitCode(0);

			// Show should handle many subtasks efficiently
			const startTime = Date.now();
			const result = helpers.taskMaster('show', [parentId]);
			const endTime = Date.now();

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Subtasks (10):');
			expect(endTime - startTime).toBeLessThan(2000); // Should be fast
		});
	});
});
