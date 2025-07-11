/**
 * Comprehensive E2E tests for update-tasks command (bulk update)
 * Tests all aspects of bulk task updates including AI-powered updates
 */

const {
	mkdtempSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	mkdirSync
} = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

describe('update-tasks command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-update-tasks-'));

		// Initialize test helpers
		const context = global.createTestContext('update-tasks');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(__dirname, '../../../../.env');
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
						details: 'Basic auth implementation'
					},
					{
						id: 2,
						title: 'Create database schema',
						description: 'Design database structure',
						priority: 'high',
						status: 'pending',
						details: 'PostgreSQL schema'
					},
					{
						id: 3,
						title: 'Build API endpoints',
						description: 'RESTful API development',
						priority: 'medium',
						status: 'in_progress',
						details: 'Express.js endpoints'
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
				'update-tasks',
				['--prompt', 'Add security considerations to all tasks'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updated');
			expect(result.stdout).toContain('task');

			// Verify tasks were updated
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));

			// Check that tasks have been modified (details should mention security)
			const hasSecurityUpdates = tasks.master.tasks.some(
				(t) => t.details && t.details.toLowerCase().includes('security')
			);
			expect(hasSecurityUpdates).toBe(true);
		}, 60000);

		it('should update specific tasks by IDs', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--ids', '1,3', '--prompt', 'Add performance optimization notes'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updated 2 task');
		}, 60000);

		it('should update tasks by status filter', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--status', 'pending', '--prompt', 'Add estimated time requirements'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			// Should update tasks 1 and 2 (pending status)
			expect(result.stdout).toContain('Updated 2 task');

			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));

			// Verify only pending tasks were updated
			const pendingTasks = tasks.master.tasks.filter(
				(t) => t.status === 'pending'
			);
			const hasTimeEstimates = pendingTasks.some(
				(t) =>
					t.details &&
					(t.details.includes('time') ||
						t.details.includes('hour') ||
						t.details.includes('day'))
			);
			expect(hasTimeEstimates).toBe(true);
		}, 60000);

		it('should update tasks by priority filter', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--priority', 'medium', '--prompt', 'Add testing requirements'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			// Should update tasks 1 and 3 (medium priority)
			expect(result.stdout).toContain('Updated 2 task');
		}, 60000);
	});

	describe('Research mode updates', () => {
		it('should update tasks with research-backed information', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--ids', '1', '--prompt', 'Add OAuth2 best practices', '--research'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updated');

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
					details: 'Initial security check'
				},
				{
					id: 5,
					title: 'Performance testing',
					description: 'Load testing',
					priority: 'high',
					status: 'in_progress',
					details: 'Using JMeter'
				}
			);
			writeFileSync(tasksPath, JSON.stringify(currentTasks, null, 2));

			// Update only high priority pending tasks
			const result = await helpers.taskMaster(
				'update-tasks',
				[
					'--status',
					'pending',
					'--priority',
					'high',
					'--prompt',
					'Add compliance requirements'
				],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			// Should only update task 2 and 4
			expect(result.stdout).toContain('Updated 2 task');
		}, 60000);

		it('should handle empty filter results gracefully', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				[
					'--status',
					'completed',
					'--prompt',
					'This should not update anything'
				],
				{ cwd: testDir, timeout: 30000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('No tasks found matching the criteria');
		}, 45000);
	});

	describe('Tag support', () => {
		it('should update tasks in specific tag', async () => {
			// Create a new tag with tasks
			await helpers.taskMaster('add-tag', ['feature-x'], { cwd: testDir });

			// Add task to the tag
			await helpers.taskMaster(
				'add-task',
				['--prompt', 'Feature X implementation', '--tag', 'feature-x'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster(
				'update-tasks',
				['--tag', 'feature-x', '--prompt', 'Add deployment considerations'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updated');

			// Verify task in tag was updated
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			const featureXTasks = tasks['feature-x'].tasks;
			const hasDeploymentInfo = featureXTasks.some(
				(t) => t.details && t.details.toLowerCase().includes('deploy')
			);
			expect(hasDeploymentInfo).toBe(true);
		}, 60000);

		it('should update tasks across multiple tags', async () => {
			// Create multiple tags
			await helpers.taskMaster('add-tag', ['backend'], { cwd: testDir });
			await helpers.taskMaster('add-tag', ['frontend'], { cwd: testDir });

			// Update all tasks across all tags
			const result = await helpers.taskMaster(
				'update-tasks',
				['--prompt', 'Add error handling strategies'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updated');
		}, 60000);
	});

	describe('Output formats', () => {
		it('should support JSON output format', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				[
					'--ids',
					'1',
					'--prompt',
					'Add monitoring requirements',
					'--output',
					'json'
				],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Output should be valid JSON
			const jsonOutput = JSON.parse(result.stdout);
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.updated).toBeDefined();
			expect(jsonOutput.tasks).toBeDefined();
		}, 60000);
	});

	describe('Error handling', () => {
		it('should fail without prompt', async () => {
			const result = await helpers.taskMaster('update-tasks', ['--ids', '1'], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('prompt');
		});

		it('should handle invalid task IDs gracefully', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--ids', '999,1000', '--prompt', 'Update non-existent tasks'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('No tasks found');
		});

		it('should handle invalid status filter', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--status', 'invalid-status', '--prompt', 'Test invalid status'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid status');
		});

		it('should handle invalid priority filter', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--priority', 'urgent', '--prompt', 'Test invalid priority'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid priority');
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
					details: `Details for task ${i}`
				});
			}
			writeFileSync(tasksPath, JSON.stringify(currentTasks, null, 2));

			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'update-tasks',
				['--prompt', 'Add brief implementation notes'],
				{ cwd: testDir, timeout: 120000 }
			);
			const duration = Date.now() - startTime;

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updated 20 task');
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
				'update-tasks',
				['--prompt', 'Clarify implementation order'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify dependencies are preserved
			const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			expect(updatedTasks.master.tasks[1].dependencies).toEqual([1]);
			expect(updatedTasks.master.tasks[2].dependencies).toEqual([1, 2]);
		}, 60000);
	});

	describe('Dry run mode', () => {
		it('should preview updates without applying them', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				[
					'--ids',
					'1,2',
					'--prompt',
					'Add test coverage requirements',
					'--dry-run'
				],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('DRY RUN');
			expect(result.stdout).toContain('Would update');

			// Verify tasks were NOT actually updated
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			const hasTestCoverage = tasks.master.tasks.some(
				(t) => t.details && t.details.toLowerCase().includes('test coverage')
			);
			expect(hasTestCoverage).toBe(false);
		}, 60000);
	});

	describe('Integration with other commands', () => {
		it('should work with expand command on bulk-updated tasks', async () => {
			// First bulk update
			await helpers.taskMaster(
				'update-tasks',
				['--ids', '1', '--prompt', 'Add detailed specifications'],
				{ cwd: testDir, timeout: 45000 }
			);

			// Then expand the updated task
			const expandResult = await helpers.taskMaster('expand', ['--id', '1'], {
				cwd: testDir,
				timeout: 45000
			});

			expect(expandResult).toHaveExitCode(0);
			expect(expandResult.stdout).toContain('Expanded task');
		}, 90000);
	});
});
