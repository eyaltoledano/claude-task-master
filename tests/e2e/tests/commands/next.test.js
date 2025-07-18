import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
describe('task-master next command', () => {
	let testDir;
	let helpers;
	let tasksPath;
	let complexityReportPath;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-next-command-'));

		// Initialize test helpers
		const context = global.createTestContext('next command');
		helpers = context.helpers;

		// Initialize paths
		tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
		complexityReportPath = join(testDir, '.taskmaster/task-complexity-report.json');

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
		if (!existsSync(tasksPath)) {
			mkdirSync(join(testDir, '.taskmaster/tasks'), { recursive: true });
			writeFileSync(tasksPath, JSON.stringify({ master: { tasks: [] } }));
		}
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it('should show the next available task', async () => {
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Completed task',
						description: 'A completed task',
						status: 'done',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						title: 'Next available task',
						description: 'The next available task',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 3,
						title: 'Blocked task',
						description: 'A blocked task',
						status: 'pending',
						priority: 'medium',
						dependencies: [2],
						subtasks: []
					}
				]
			}
		};

		// Ensure .taskmaster directory exists
		mkdirSync(dirname(tasksPath), { recursive: true });
		writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run next command
		const result = await helpers.taskMaster('next', ['-f', tasksPath], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Next Task: #2');
		expect(result.stdout).toContain('Next available task');
		expect(result.stdout).toContain('The next available task');
		expect(result.stdout).toContain('Priority:');
		expect(result.stdout).toContain('high');
	});

	it('should prioritize tasks based on complexity report', async () => {
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Low complexity task',
						description: 'A simple task with low complexity',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						title: 'High complexity task',
						description: 'A complex task with high complexity',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		// Create complexity report
		const complexityReport = {
			tasks: [
				{
					id: 1,
					complexity: {
						score: 3,
						factors: {
							technical: 'low',
							scope: 'small'
						}
					}
				},
				{
					id: 2,
					complexity: {
						score: 8,
						factors: {
							technical: 'high',
							scope: 'large'
						}
					}
				}
			]
		};

		writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));
		writeFileSync(complexityReportPath, JSON.stringify(complexityReport, null, 2));

		// Run next command with complexity report
		const result = await helpers.taskMaster('next', ['-f', tasksPath, '-r', complexityReportPath], { cwd: testDir });

		// Should prioritize lower complexity task
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Next Task: #1');
		expect(result.stdout).toContain('Low complexity task');
	});

	it('should handle dependencies correctly', async () => {
		// Create test tasks with dependencies
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Prerequisite task',
						description: 'A task that others depend on',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						title: 'Dependent task',
						description: 'A task that depends on task 1',
						status: 'pending',
						priority: 'critical',
						dependencies: [1],
						subtasks: []
					},
					{
						id: 3,
						title: 'Independent task',
						description: 'A task with no dependencies',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run next command
		const result = await helpers.taskMaster('next', ['-f', tasksPath], { cwd: testDir });

		// Should show task 1 (prerequisite) even though task 2 has higher priority
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Next Task: #1');
		expect(result.stdout).toContain('Prerequisite task');
	});

	it('should skip in-progress tasks', async () => {
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'In progress task',
						description: 'A task currently in progress',
						status: 'in_progress',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						title: 'Available pending task',
						description: 'A task available for starting',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run next command
		const result = await helpers.taskMaster('next', ['-f', tasksPath], { cwd: testDir });

		// Should show pending task, not in-progress
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Next Task: #2');
		expect(result.stdout).toContain('Available pending task');
	});

	it('should handle all tasks completed', async () => {
		// Create test tasks - all done
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Completed task 1',
						status: 'done',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Completed task 2',
						status: 'done',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run next command
		const result = await helpers.taskMaster('next', ['-f', tasksPath], { cwd: testDir });

		// Should indicate no tasks available
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('No eligible tasks found');
	});

	it('should handle blocked tasks', async () => {
		// Create test tasks - all blocked
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Blocked task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [2],
						subtasks: []
					},
					{
						id: 2,
						description: 'Blocked task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1],
						subtasks: []
					}
				]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run next command
		const result = await helpers.taskMaster('next', ['-f', tasksPath], { cwd: testDir });

		// Should indicate circular dependency or all blocked
		expect(result).toHaveExitCode(0);
		expect(result.stdout.toLowerCase()).toMatch(/circular|blocked|no.*eligible/);
	});

	it('should work with tag option', async () => {
		// Create tasks with different tags
		const multiTagTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Master task',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					}
				]
			},
			feature: {
				tasks: [
					{
						id: 1,
						description: 'Feature task',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Run next command with feature tag
		const result = await helpers.taskMaster('next', ['-f', tasksPath, '--tag', 'feature'], { cwd: testDir });

		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Feature task');
		expect(result.stdout).not.toContain('Master task');
	});

	it('should handle empty task list', async () => {
		// Create empty tasks file
		const emptyTasks = {
			master: {
				tasks: []
			}
		};

		writeFileSync(tasksPath, JSON.stringify(emptyTasks, null, 2));

		// Run next command
		const result = await helpers.taskMaster('next', ['-f', tasksPath], { cwd: testDir });

		// Should handle gracefully
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('No eligible tasks found');
	});
});