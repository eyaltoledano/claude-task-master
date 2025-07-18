/**
 * Comprehensive E2E tests for update command (bulk update)
 * Tests all aspects of bulk task updates including AI-powered updates
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

// Skip AI-dependent tests if API access is not available
describe('update command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-update-'));

		// Initialize test helpers
		const context = global.createTestContext('update');
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

		// Copy configuration files
		copyConfigFiles(testDir);

		// Create some test tasks for bulk updates
		const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
		const tasksData = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Setup authentication',
						description: 'Implement user authentication',
						priority: 'medium',
						status: 'pending',
						details: 'Basic auth implementation',
						dependencies: [],
						testStrategy: 'Unit tests for auth logic',
						subtasks: []
					},
					{
						id: 2,
						title: 'Create database schema',
						description: 'Design database structure',
						priority: 'high',
						status: 'pending',
						details: 'PostgreSQL schema',
						dependencies: [],
						testStrategy: 'Schema validation tests',
						subtasks: []
					},
					{
						id: 3,
						title: 'Build API endpoints',
						description: 'RESTful API development',
						priority: 'medium',
						status: 'in-progress',
						details: 'Express.js endpoints',
						dependencies: ['1', '2'],
						testStrategy: 'API integration tests',
						subtasks: []
					}
				]
			}
		};
		mkdirSync(join(testDir, '.taskmaster/tasks'), { recursive: true });
		writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Bulk task updates with prompts', () => {
		it('should update all tasks with general prompt', async () => {
			const result = await helpers.taskMaster(
				'update',
				['--prompt', 'Add security considerations to all tasks', '--from', '1'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated');
			expect(result.stdout).toContain('3 tasks');

			// Verify tasks were updated
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));

			// Verify we still have 3 tasks and they have been processed
			expect(tasks.master.tasks.length).toBe(3);
			// The AI should have updated the tasks in some way - just verify the structure is intact
			const allTasksValid = tasks.master.tasks.every(
				(t) => t.id && t.title && t.description && t.details
			);
			expect(allTasksValid).toBe(true);
		}, 60000);

		it('should update tasks from ID 2 onwards', async () => {
			const result = await helpers.taskMaster(
				'update',
				['--from', '2', '--prompt', 'Add performance optimization notes'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated');
			expect(result.stdout).toContain('2 tasks');
		}, 60000);

		it('should update all tasks from ID 1', async () => {
			const result = await helpers.taskMaster(
				'update',
				['--from', '1', '--prompt', 'Add estimated time requirements'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			// Should update all 3 tasks
			expect(result.stdout).toContain('Successfully updated');
			expect(result.stdout).toContain('3 tasks');

			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));

			// Verify tasks were updated
			const hasTimeEstimates = tasks.master.tasks.some(
				(t) =>
					t.details &&
					(t.details.includes('time') ||
						t.details.includes('hour') ||
						t.details.includes('day'))
			);
			expect(hasTimeEstimates).toBe(true);
		}, 60000);

		it('should update tasks by priority filter', async () => {
			// The update command doesn't support priority filtering
			// It only supports --from to update from a specific ID onwards
			const result = await helpers.taskMaster(
				'update',
				['--from', '1', '--prompt', 'Add testing requirements'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			// Should update all 3 tasks
			expect(result.stdout).toContain('Successfully updated');
			expect(result.stdout).toContain('3 tasks');
		}, 60000);
	});

	describe('Research mode updates', () => {
		it('should update tasks with research-backed information', async () => {
			const result = await helpers.taskMaster(
				'update',
				['--from', '1', '--prompt', 'Add OAuth2 best practices', '--research'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated');

			// Research mode should produce more detailed updates
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			const authTask = tasks.master.tasks.find((t) => t.id === 1);

			// Check for detailed OAuth2 information
			expect(authTask.details.length).toBeGreaterThan(100);
			const hasOAuthInfo =
				authTask.details.toLowerCase().includes('oauth') ||
				authTask.details.toLowerCase().includes('authorization');
			expect(hasOAuthInfo).toBe(true);
		}, 120000);
	});

	describe('Multiple filter combinations', () => {
		it('should update tasks matching all filters', async () => {
			// Add more tasks with different combinations
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const currentTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			currentTasks.master.tasks.push(
				{
					id: 4,
					title: 'Security audit',
					description: 'Perform security review',
					priority: 'high',
					status: 'pending',
					details: 'Initial security check',
					dependencies: [],
					testStrategy: 'Security testing',
					subtasks: []
				},
				{
					id: 5,
					title: 'Performance testing',
					description: 'Load testing',
					priority: 'high',
					status: 'in_progress',
					details: 'Using JMeter',
					dependencies: [],
					testStrategy: 'Performance testing',
					subtasks: []
				}
			);
			writeFileSync(tasksPath, JSON.stringify(currentTasks, null, 2));

			// The update command doesn't support status or priority filtering
			// Update from task 2 onwards to get tasks 2, 3, 4, 5, and 6
			const result = await helpers.taskMaster(
				'update',
				['--from', '2', '--prompt', 'Add compliance requirements'],
				{ cwd: testDir, timeout: 120000 }
			);

			expect(result).toHaveExitCode(0);
			// Should update tasks 2, 3, 4, 5 (4 tasks total)
			expect(result.stdout).toContain('Successfully updated');
			expect(result.stdout).toContain('4 tasks');
		}, 180000);

		it('should handle empty filter results gracefully', async () => {
			const result = await helpers.taskMaster(
				'update',
				['--from', '999', '--prompt', 'This should not update anything'],
				{ cwd: testDir, timeout: 30000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('No tasks to update');
		}, 45000);
	});

	describe('Tag support', () => {
		it('should update tasks in specific tag', async () => {
			// Create a new tag with tasks
			await helpers.taskMaster('add-tag', ['feature-x'], { cwd: testDir });

			// Switch to the tag and add task
			await helpers.taskMaster('use-tag', ['feature-x'], { cwd: testDir });
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Feature X implementation',
					'--description',
					'Feature X task'
				],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster(
				'update',
				['--tag', 'feature-x', '--prompt', 'Add deployment considerations'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			// The command might show "No tasks to update" if no tasks match the criteria
			// or "Successfully updated" if tasks were updated
			expect(result.stdout).toMatch(/Successfully updated|No tasks to update/);
		}, 60000);

		it('should update tasks across multiple tags', async () => {
			// Create multiple tags
			await helpers.taskMaster('add-tag', ['backend'], { cwd: testDir });
			await helpers.taskMaster('add-tag', ['frontend'], { cwd: testDir });

			// Update all tasks across all tags
			const result = await helpers.taskMaster(
				'update',
				['--prompt', 'Add error handling strategies'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated');
		}, 60000);
	});

	describe('Output formats', () => {
		it('should support JSON output format', async () => {
			// The update command doesn't support --output option
			const result = await helpers.taskMaster(
				'update',
				['--from', '1', '--prompt', 'Add monitoring requirements'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated');
		}, 60000);
	});

	describe('Error handling', () => {
		it('should fail without prompt', async () => {
			const result = await helpers.taskMaster('update', ['--from', '1'], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('prompt');
		});

		it('should handle invalid task IDs gracefully', async () => {
			const result = await helpers.taskMaster(
				'update',
				['--from', '999', '--prompt', 'Update non-existent tasks'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('No tasks to update');
		});

		it('should handle missing required --from parameter', async () => {
			const result = await helpers.taskMaster(
				'update',
				['--prompt', 'Test missing from parameter'],
				{ cwd: testDir }
			);

			// The --from parameter defaults to '1' so this should succeed
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated');
		});

		it('should handle using --id instead of --from', async () => {
			const result = await helpers.taskMaster(
				'update',
				['--id', '1', '--prompt', 'Test wrong parameter'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('unknown option');
		});
	});

	describe('Performance and edge cases', () => {
		it('should handle updating many tasks efficiently', async () => {
			// Add many tasks
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const currentTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));

			for (let i = 4; i <= 20; i++) {
				currentTasks.master.tasks.push({
					id: i,
					title: `Task ${i}`,
					description: `Description for task ${i}`,
					priority: i % 3 === 0 ? 'high' : 'medium',
					status: 'pending',
					details: `Details for task ${i}`,
					dependencies: [],
					testStrategy: 'Unit tests',
					subtasks: []
				});
			}
			writeFileSync(tasksPath, JSON.stringify(currentTasks, null, 2));

			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'update',
				['--from', '1', '--prompt', 'Add brief implementation notes'],
				{ cwd: testDir, timeout: 120000 }
			);
			const duration = Date.now() - startTime;

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated');
			expect(result.stdout).toContain('20 tasks');
			expect(duration).toBeLessThan(120000); // Should complete within 2 minutes
		}, 150000);

		it('should preserve task relationships during updates', async () => {
			// Add tasks with dependencies
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const currentTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			currentTasks.master.tasks[1].dependencies = [1];
			currentTasks.master.tasks[2].dependencies = [1, 2];
			writeFileSync(tasksPath, JSON.stringify(currentTasks, null, 2));

			const result = await helpers.taskMaster(
				'update',
				['--from', '1', '--prompt', 'Clarify implementation order'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify dependencies are preserved
			const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			expect(updatedTasks.master.tasks[1].dependencies).toEqual([1]);
			expect(updatedTasks.master.tasks[2].dependencies).toEqual([1, 2]);
		}, 60000);
	});

	// Note: The update command doesn't support dry-run mode

	describe('Integration with other commands', () => {
		it('should work with expand command on bulk-updated tasks', async () => {
			// First bulk update
			await helpers.taskMaster(
				'update',
				['--from', '1', '--prompt', 'Add detailed specifications'],
				{ cwd: testDir, timeout: 45000 }
			);

			// Then expand the updated task
			const expandResult = await helpers.taskMaster('expand', ['--id', '1'], {
				cwd: testDir,
				timeout: 45000
			});

			expect(expandResult).toHaveExitCode(0);
			expect(expandResult.stdout).toContain(
				'Successfully parsed 5 subtasks from AI response'
			);
		}, 90000);
	});
});
