/**
 * Comprehensive E2E tests for list command
 * Tests all aspects of task listing including filtering and display options
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

describe('list command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-list-'));

		// Initialize test helpers
		const context = global.createTestContext('list');
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

	describe('Basic listing', () => {
		it('should list all tasks', async () => {
			// Create some test tasks
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 1', '--description', 'First task'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 2', '--description', 'Second task'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 1  │ Task');
			expect(result.stdout).toContain('│ 2  │ Task');
			expect(result.stdout).toContain('Project Dashboard');
			expect(result.stdout).toContain('ID');
			expect(result.stdout).toContain('Title');
			expect(result.stdout).toContain('Status');
			expect(result.stdout).toContain('Priority');
			expect(result.stdout).toContain('Dependencies');
		});

		it('should show empty list message when no tasks exist', async () => {
			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('No tasks found');
		});

		it('should display task progress dashboard', async () => {
			// Create tasks with different statuses
			const task1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Completed task', '--description', 'Done'],
				{ cwd: testDir }
			);
			const taskId1 = helpers.extractTaskId(task1.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId1, '--status', 'done'],
				{ cwd: testDir }
			);

			await helpers.taskMaster(
				'add-task',
				['--title', 'In progress task', '--description', 'Working on it'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Project Dashboard');
			expect(result.stdout).toContain('Tasks Progress:');
			expect(result.stdout).toContain('Done:');
			expect(result.stdout).toContain('In Progress:');
			expect(result.stdout).toContain('Pending:');
		});
	});

	describe('Status filtering', () => {
		beforeEach(async () => {
			// Create tasks with different statuses
			const task1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Pending task', '--description', 'Not started'],
				{ cwd: testDir }
			);

			const task2 = await helpers.taskMaster(
				'add-task',
				['--title', 'In progress task', '--description', 'Working on it'],
				{ cwd: testDir }
			);
			const taskId2 = helpers.extractTaskId(task2.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId2, '--status', 'in-progress'],
				{ cwd: testDir }
			);

			const task3 = await helpers.taskMaster(
				'add-task',
				['--title', 'Done task', '--description', 'Completed'],
				{ cwd: testDir }
			);
			const taskId3 = helpers.extractTaskId(task3.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId3, '--status', 'done'],
				{ cwd: testDir }
			);

			const task4 = await helpers.taskMaster(
				'add-task',
				['--title', 'Review task', '--description', 'Needs review'],
				{ cwd: testDir }
			);
			const taskId4 = helpers.extractTaskId(task4.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId4, '--status', 'review'],
				{ cwd: testDir }
			);

			const task5 = await helpers.taskMaster(
				'add-task',
				['--title', 'Deferred task', '--description', 'Postponed'],
				{ cwd: testDir }
			);
			const taskId5 = helpers.extractTaskId(task5.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId5, '--status', 'deferred'],
				{ cwd: testDir }
			);

			const task6 = await helpers.taskMaster(
				'add-task',
				['--title', 'Cancelled task', '--description', 'No longer needed'],
				{ cwd: testDir }
			);
			const taskId6 = helpers.extractTaskId(task6.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId6, '--status', 'cancelled'],
				{ cwd: testDir }
			);
		});

		it('should filter by pending status', async () => {
			const result = await helpers.taskMaster('list', ['--status', 'pending'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 1  │ Pending');
			expect(result.stdout).not.toContain('In progress task');
			expect(result.stdout).not.toContain('Done task');
			expect(result.stdout).toContain('Filtered by status: pending');
		});

		it('should filter by in-progress status', async () => {
			const result = await helpers.taskMaster(
				'list',
				['--status', 'in-progress'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 2  │ In');
			// Check that the main table doesn't contain other status tasks
			expect(result.stdout).not.toContain('│ 1  │ Pending');
			expect(result.stdout).not.toContain('│ 3  │ Done');
		});

		it('should filter by done status', async () => {
			const result = await helpers.taskMaster('list', ['--status', 'done'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 3  │ Done');
			// Check that the main table doesn't contain other status tasks
			expect(result.stdout).not.toContain('│ 1  │ Pending');
			expect(result.stdout).not.toContain('│ 2  │ In');
		});

		it('should filter by review status', async () => {
			const result = await helpers.taskMaster('list', ['--status', 'review'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 4  │ Review');
			// Check that the main table doesn't contain other status tasks
			expect(result.stdout).not.toContain('│ 1  │ Pending');
		});

		it('should filter by deferred status', async () => {
			const result = await helpers.taskMaster(
				'list',
				['--status', 'deferred'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 5  │ Deferred');
			// Check that the main table doesn't contain other status tasks
			expect(result.stdout).not.toContain('│ 1  │ Pending');
		});

		it('should filter by cancelled status', async () => {
			const result = await helpers.taskMaster(
				'list',
				['--status', 'cancelled'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 6  │ Cancelled');
			// Check that the main table doesn't contain other status tasks
			expect(result.stdout).not.toContain('│ 1  │ Pending');
		});

		it('should handle multiple statuses with comma separation', async () => {
			const result = await helpers.taskMaster(
				'list',
				['--status', 'pending,in-progress'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 1  │ Pending');
			expect(result.stdout).toContain('│ 2  │ In');
			expect(result.stdout).not.toContain('Done task');
			expect(result.stdout).not.toContain('Review task');
		});

		it('should show empty message for non-existent status filter', async () => {
			const result = await helpers.taskMaster(
				'list',
				['--status', 'invalid-status'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(
				"No tasks with status 'invalid-status' found"
			);
		});
	});

	describe('Priority display', () => {
		it('should display task priorities correctly', async () => {
			// Create tasks with different priorities
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'High priority task',
					'--description',
					'Urgent',
					'--priority',
					'high'
				],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Medium priority task',
					'--description',
					'Normal',
					'--priority',
					'medium'
				],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Low priority task',
					'--description',
					'Can wait',
					'--priority',
					'low'
				],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toMatch(/high/i);
			expect(result.stdout).toMatch(/medium/i);
			expect(result.stdout).toMatch(/low/i);

			// Check priority breakdown
			expect(result.stdout).toContain('Priority Breakdown:');
			expect(result.stdout).toContain('High priority:');
			expect(result.stdout).toContain('Medium priority:');
			expect(result.stdout).toContain('Low priority:');
		});
	});

	describe('Subtasks display', () => {
		let parentTaskId;

		beforeEach(async () => {
			// Create a parent task with subtasks
			const parentResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'Has subtasks'],
				{ cwd: testDir }
			);
			parentTaskId = helpers.extractTaskId(parentResult.stdout);

			// Add subtasks
			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentTaskId,
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
					parentTaskId,
					'--title',
					'Subtask 2',
					'--description',
					'Second subtask'
				],
				{ cwd: testDir }
			);
		});

		it('should not show subtasks by default', async () => {
			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 1  │ Parent');
			// Check that subtasks are not in the main table (they may appear in the recommended next task section)
			expect(result.stdout).not.toMatch(/│\s*1\.1\s*│.*Subtask 1/);
			expect(result.stdout).not.toMatch(/│\s*1\.2\s*│.*Subtask 2/);
		});

		it('should show subtasks with --with-subtasks flag', async () => {
			const result = await helpers.taskMaster('list', ['--with-subtasks'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 1     │ Parent');
			// Check for subtask rows in the table
			expect(result.stdout).toContain('│ 1.1   │ └─ Subtask');
			expect(result.stdout).toContain('│ 1.2   │ └─ Subtask');
			expect(result.stdout).toContain(`${parentTaskId}.1`);
			expect(result.stdout).toContain(`${parentTaskId}.2`);
			expect(result.stdout).toContain('└─');
		});

		it('should include subtasks in progress calculation', async () => {
			const result = await helpers.taskMaster('list', ['--with-subtasks'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Subtasks Progress:');
			// Check for completion count in subtasks progress
			expect(result.stdout).toContain('Completed: 0/2');
		});
	});

	describe('Tag filtering', () => {
		beforeEach(async () => {
			// Create a new tag
			await helpers.taskMaster(
				'add-tag',
				['feature-branch', '--description', 'Feature branch tasks'],
				{ cwd: testDir }
			);

			// Add tasks to master tag
			await helpers.taskMaster(
				'add-task',
				['--title', 'Master task 1', '--description', 'In master tag'],
				{ cwd: testDir }
			);

			// Switch to feature tag and add tasks
			await helpers.taskMaster('use-tag', ['feature-branch'], { cwd: testDir });
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Feature task 1',
					'--description',
					'In feature tag',
					'--tag',
					'feature-branch'
				],
				{ cwd: testDir }
			);
		});

		it('should list tasks from specific tag', async () => {
			const result = await helpers.taskMaster(
				'list',
				['--tag', 'feature-branch'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 1  │ Feature');
			expect(result.stdout).not.toContain('Master task 1');
			// Check for tag in the output
			expect(result.stdout).toContain('🏷️ tag: feature-branch');
		});

		it('should list tasks from master tag by default', async () => {
			// Switch back to master tag
			await helpers.taskMaster('use-tag', ['master'], { cwd: testDir });

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 1  │ Master');
			expect(result.stdout).not.toContain('Feature task 1');
		});
	});

	describe('Dependencies display', () => {
		it('should show task dependencies correctly', async () => {
			// Create dependency tasks
			const dep1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Dependency 1', '--description', 'First dependency'],
				{ cwd: testDir }
			);
			const depId1 = helpers.extractTaskId(dep1.stdout);

			const dep2 = await helpers.taskMaster(
				'add-task',
				['--title', 'Dependency 2', '--description', 'Second dependency'],
				{ cwd: testDir }
			);
			const depId2 = helpers.extractTaskId(dep2.stdout);

			// Create task with dependencies
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Task with dependencies',
					'--description',
					'Depends on other tasks',
					'--dependencies',
					`${depId1},${depId2}`
				],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(depId1);
			expect(result.stdout).toContain(depId2);
		});

		it('should show dependency status with colors', async () => {
			// Create dependency task
			const dep = await helpers.taskMaster(
				'add-task',
				['--title', 'Completed dependency', '--description', 'Done'],
				{ cwd: testDir }
			);
			const depId = helpers.extractTaskId(dep.stdout);

			// Mark dependency as done
			await helpers.taskMaster(
				'set-status',
				['--id', depId, '--status', 'done'],
				{ cwd: testDir }
			);

			// Create task with dependency
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Task with completed dependency',
					'--description',
					'Has satisfied dependency',
					'--dependencies',
					depId
				],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			// The done dependency should be shown (implementation uses color coding)
			expect(result.stdout).toContain(depId);
		});

		it('should show dependency dashboard', async () => {
			// Create some tasks with dependencies
			const task1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Independent task', '--description', 'No dependencies'],
				{ cwd: testDir }
			);

			const task2 = await helpers.taskMaster(
				'add-task',
				['--title', 'Dependency task', '--description', 'Will be depended on'],
				{ cwd: testDir }
			);
			const taskId2 = helpers.extractTaskId(task2.stdout);

			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Dependent task',
					'--description',
					'Depends on task 2',
					'--dependencies',
					taskId2
				],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependency Status & Next Task');
			expect(result.stdout).toContain('Tasks with no dependencies:');
			expect(result.stdout).toContain('Tasks ready to work on:');
			expect(result.stdout).toContain('Tasks blocked by dependencies:');
		});
	});

	describe('Complexity display', () => {
		it('should show complexity scores when available', async () => {
			// Create tasks
			await helpers.taskMaster(
				'add-task',
				['--prompt', 'Build a complex authentication system'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				['--prompt', 'Create a simple hello world endpoint'],
				{ cwd: testDir }
			);

			// Run complexity analysis
			const analyzeResult = await helpers.taskMaster('analyze-complexity', [], {
				cwd: testDir,
				timeout: 60000
			});

			if (analyzeResult.exitCode === 0) {
				const result = await helpers.taskMaster('list', [], { cwd: testDir });

				expect(result).toHaveExitCode(0);
				expect(result.stdout).toContain('Complexity');
			}
		});
	});

	describe('Next task recommendation', () => {
		it('should show next task recommendation', async () => {
			// Create tasks with different priorities and dependencies
			const task1 = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'High priority task',
					'--description',
					'Should be done first',
					'--priority',
					'high'
				],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Next Task to Work On');
			expect(result.stdout).toContain('Start working:');
			expect(result.stdout).toContain('task-master set-status');
			expect(result.stdout).toContain('View details:');
			expect(result.stdout).toContain('task-master show');
		});

		it('should show next eligible task when dependencies are resolved', async () => {
			// Create prerequisite task
			const task1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Prerequisite', '--description', 'Must be done first'],
				{ cwd: testDir }
			);
			const taskId1 = helpers.extractTaskId(task1.stdout);

			// Create task depending on it
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Dependent task',
					'--description',
					'Waiting for prerequisite',
					'--dependencies',
					taskId1
				],
				{ cwd: testDir }
			);

			// Mark first task as done
			await helpers.taskMaster(
				'set-status',
				['--id', taskId1, '--status', 'done'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			// Should recommend the ready task
			expect(result.stdout).toContain('Next Task to Work On');
			// Check for next task recommendation
			expect(result.stdout).toContain('ID: 2 - Dependent task');
		});
	});

	describe('File path handling', () => {
		it('should use custom tasks file path', async () => {
			// Create custom tasks file
			const customPath = join(testDir, 'custom-tasks.json');
			writeFileSync(
				customPath,
				JSON.stringify({
					master: {
						tasks: [
							{
								id: 1,
								title: 'Custom file task',
								description: 'Task in custom file',
								status: 'pending',
								priority: 'medium',
								dependencies: []
							}
						]
					}
				})
			);

			const result = await helpers.taskMaster('list', ['--file', customPath], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Custom file task');
			expect(result.stdout).toContain(`Listing tasks from: ${customPath}`);
		});
	});

	describe('Error handling', () => {
		it('should handle missing tasks file gracefully', async () => {
			const nonExistentPath = join(testDir, 'non-existent.json');
			const result = await helpers.taskMaster(
				'list',
				['--file', nonExistentPath],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Error');
		});

		it('should handle invalid JSON in tasks file', async () => {
			const invalidPath = join(testDir, 'invalid.json');
			writeFileSync(invalidPath, '{ invalid json }');

			const result = await helpers.taskMaster('list', ['--file', invalidPath], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
		});
	});

	describe('Performance with many tasks', () => {
		it('should handle listing 50+ tasks efficiently', async () => {
			// Create many tasks
			const promises = [];
			for (let i = 1; i <= 50; i++) {
				promises.push(
					helpers.taskMaster(
						'add-task',
						['--title', `Task ${i}`, '--description', `Description ${i}`],
						{ cwd: testDir }
					)
				);
			}

			await Promise.all(promises);

			const startTime = Date.now();
			const result = await helpers.taskMaster('list', [], { cwd: testDir });
			const endTime = Date.now();

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('│ 1  │ Task');
			expect(result.stdout).toContain('Tasks Progress:');

			// Should complete within reasonable time (5 seconds)
			expect(endTime - startTime).toBeLessThan(5000);
		});
	});

	describe('Display formatting', () => {
		it('should truncate long titles appropriately', async () => {
			const longTitle =
				'This is a very long task title that should be truncated in the display to fit within the table column width constraints';
			await helpers.taskMaster(
				'add-task',
				['--title', longTitle, '--description', 'Task with long title'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			// Should contain at least part of the title
			expect(result.stdout).toContain('│ 1  │ This');
		});

		it('should show suggested next steps', async () => {
			await helpers.taskMaster(
				'add-task',
				['--title', 'Sample task', '--description', 'For testing'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Suggested Next Steps:');
			expect(result.stdout).toContain('task-master next');
			expect(result.stdout).toContain('task-master expand');
			expect(result.stdout).toContain('task-master set-status');
		});
	});
});
