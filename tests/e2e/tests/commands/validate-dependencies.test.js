import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
describe('task-master validate-dependencies command', () => {
	let testDir;
	let helpers;
	let tasksPath;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-validate-dependencies-command-'));

		// Initialize test helpers
		const context = global.createTestContext('validate-dependencies command');
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

		// Set up tasks path
		tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
		
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

	it('should validate tasks with no dependency issues', async () => {
		// Create test tasks with valid dependencies
		const validTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1],
						subtasks: []
					},
					{
						id: 3,
						description: 'Task 3',
						status: 'pending',
						priority: 'low',
						dependencies: [1, 2],
						subtasks: []
					}
				]
			}
		};

		mkdirSync(dirname(tasksPath), { recursive: true });
		writeFileSync(tasksPath, JSON.stringify(validTasks, null, 2));

		// Run validate-dependencies command
		const result = await helpers.taskMaster('validate-dependencies', ['-f', tasksPath], { cwd: testDir });

		// Should succeed with no issues
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Checking for invalid dependencies');
		expect(result.stdout).toContain('All Dependencies Are Valid');
	});

	it('should detect circular dependencies', async () => {
		// Create test tasks with circular dependencies
		const circularTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [3], // Circular: 1 -> 3 -> 2 -> 1
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1],
						subtasks: []
					},
					{
						id: 3,
						description: 'Task 3',
						status: 'pending',
						priority: 'low',
						dependencies: [2],
						subtasks: []
					}
				]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(circularTasks, null, 2));

		// Run validate-dependencies command
		const result = await helpers.taskMaster('validate-dependencies', ['-f', tasksPath], { cwd: testDir });

		// Should detect circular dependency
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('[CIRCULAR]');
		expect(result.stdout).toContain('Task 1');
		expect(result.stdout).toContain('Task 2');
		expect(result.stdout).toContain('Task 3');
	});

	it('should detect missing dependencies', async () => {
		// Create test tasks with missing dependencies
		const missingDepTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [999], // Non-existent task
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1, 888], // Mix of valid and invalid
						subtasks: []
					}
				]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(missingDepTasks, null, 2));

		// Run validate-dependencies command
		const result = await helpers.taskMaster('validate-dependencies', ['-f', tasksPath], { cwd: testDir });

		// Should detect missing dependencies
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Dependency validation failed');
		expect(result.stdout).toContain('Task 1');
		expect(result.stdout).toContain('999');
		expect(result.stdout).toContain('Task 2');
		expect(result.stdout).toContain('888');
	});

	it('should validate subtask dependencies', async () => {
		// Create test tasks with subtask dependencies
		const subtaskDepTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: [
							{
								id: 1,
								description: 'Subtask 1.1',
								status: 'pending',
								priority: 'medium',
								dependencies: ['999'] // Invalid dependency
							},
							{
								id: 2,
								description: 'Subtask 1.2',
								status: 'pending',
								priority: 'low',
								dependencies: ['1.1'] // Valid subtask dependency
							}
						]
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(subtaskDepTasks, null, 2));

		// Run validate-dependencies command
		const result = await helpers.taskMaster('validate-dependencies', ['-f', tasksPath], { cwd: testDir });

		// Should detect invalid subtask dependency
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Dependency validation failed');
		expect(result.stdout).toContain('Subtask 1.1');
		expect(result.stdout).toContain('999');
	});

	it('should detect self-dependencies', async () => {
		// Create test tasks with self-dependencies
		const selfDepTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [1], // Self-dependency
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: [
							{
								id: 1,
								description: 'Subtask 2.1',
								status: 'pending',
								priority: 'low',
								dependencies: ['2.1'] // Self-dependency
							}
						]
					}
				]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(selfDepTasks, null, 2));

		// Run validate-dependencies command
		const result = await helpers.taskMaster('validate-dependencies', ['-f', tasksPath], { cwd: testDir });

		// Should detect self-dependencies
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Dependency validation failed');
		expect(result.stdout).toContain('depends on itself');
	});

	it('should handle completed task dependencies', async () => {
		// Create test tasks where some dependencies are completed
		const completedDepTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1',
						status: 'done',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2',
						status: 'pending',
						priority: 'medium',
						dependencies: [1], // Depends on completed task (valid)
						subtasks: []
					},
					{
						id: 3,
						description: 'Task 3',
						status: 'done',
						priority: 'low',
						dependencies: [2], // Completed task depends on pending (might be flagged)
						subtasks: []
					}
				]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(completedDepTasks, null, 2));

		// Run validate-dependencies command
		const result = await helpers.taskMaster('validate-dependencies', ['-f', tasksPath], { cwd: testDir });

		// Check output
		expect(result).toHaveExitCode(0);
		// Depending on implementation, might flag completed tasks with pending dependencies
	});

	it('should work with tag option', async () => {
		// Create tasks with different tags
		const multiTagTasks = {
			master: {
				tasks: [{
					id: 1,
					description: 'Master task',
					dependencies: [999] // Invalid
				}]
			},
			feature: {
				tasks: [{
					id: 1,
					description: 'Feature task',
					dependencies: [2] // Valid within tag
				}, {
					id: 2,
					description: 'Feature task 2',
					dependencies: []
				}]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Validate feature tag
		const result = await helpers.taskMaster('validate-dependencies', ['-f', tasksPath, '--tag', 'feature'], { cwd: testDir });

		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('All Dependencies Are Valid');

		// Validate master tag
		const result2 = await helpers.taskMaster('validate-dependencies', ['-f', tasksPath, '--tag', 'master'], { cwd: testDir });

		expect(result2.exitCode).toBe(0);
		expect(result2.stdout).toContain('Dependency validation failed');
		expect(result2.stdout).toContain('999');
	});

	it('should handle empty task list', async () => {
		// Create empty tasks file
		const emptyTasks = {
			master: {
				tasks: []
			}
		};

		writeFileSync(tasksPath, JSON.stringify(emptyTasks, null, 2));

		// Run validate-dependencies command
		const result = await helpers.taskMaster('validate-dependencies', ['-f', tasksPath], { cwd: testDir });

		// Should handle gracefully
		expect(result).toHaveExitCode(0);
		// Just check for the content without worrying about exact table formatting
		expect(result.stdout).toMatch(/Tasks checked:\s*0/);
	});
});