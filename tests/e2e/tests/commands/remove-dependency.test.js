import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
describe('task-master remove-dependency command', () => {
	let testDir;
	let helpers;
	let tasksPath;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-remove-dependency-command-'));

		// Initialize test helpers
		const context = global.createTestContext('remove-dependency command');
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
		tasksPath = join(testDir, '.taskmaster', 'tasks', 'tasks.json');

		// Create test tasks with dependencies
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task 1 - Independent',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					},
					{
						id: 2,
						description: 'Task 2 - Depends on 1',
						status: 'pending',
						priority: 'medium',
						dependencies: [1],
						subtasks: []
					},
					{
						id: 3,
						description: 'Task 3 - Depends on 1 and 2',
						status: 'pending',
						priority: 'low',
						dependencies: [1, 2],
						subtasks: [
							{
								id: 1,
								description: 'Subtask 3.1',
								status: 'pending',
								priority: 'medium',
								dependencies: ['1', '2']
							}
						]
					},
					{
						id: 4,
						description: 'Task 4 - Complex dependencies',
						status: 'pending',
						priority: 'high',
						dependencies: [1, 2, 3],
						subtasks: []
					}
				]
			}
		};

		// Ensure .taskmaster directory exists
		mkdirSync(dirname(tasksPath), { recursive: true });
		writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it('should remove a dependency from a task', async () => {
		// Run remove-dependency command
		const result = await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '2', '-d', '1'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Removing dependency');
		expect(result.stdout).toContain('from task 2');

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const task2 = updatedTasks.master.tasks.find(t => t.id === 2);

		// Verify dependency was removed
		expect(task2.dependencies).toEqual([]);
	});

	it('should remove one dependency while keeping others', async () => {
		// Run remove-dependency command to remove dependency 1 from task 3
		const result = await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '3', '-d', '1'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const task3 = updatedTasks.master.tasks.find(t => t.id === 3);

		// Verify only dependency 1 was removed, dependency 2 remains
		expect(task3.dependencies).toEqual([2]);
	});

	it('should handle removing all dependencies from a task', async () => {
		// Remove all dependencies from task 4 one by one
		await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '4', '-d', '1'], { cwd: testDir });

		await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '4', '-d', '2'], { cwd: testDir });

		const result = await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '4', '-d', '3'], { cwd: testDir });

		expect(result).toHaveExitCode(0);

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const task4 = updatedTasks.master.tasks.find(t => t.id === 4);

		// Verify all dependencies were removed
		expect(task4.dependencies).toEqual([]);
	});

	it('should handle subtask dependencies', async () => {
		// Run remove-dependency command for subtask
		const result = await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '3.1', '-d', '1'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const task3 = updatedTasks.master.tasks.find(t => t.id === 3);
		const subtask = task3.subtasks.find(s => s.id === 1);

		// Verify subtask dependency was removed
		expect(subtask.dependencies).toEqual(['2']);
	});

	it('should fail when required parameters are missing', async () => {
		// Run without --id
		const result1 = await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-d', '1'], { cwd: testDir, allowFailure: true });

		expect(result1.exitCode).not.toBe(0);
		expect(result1.stderr).toContain('Error');
		expect(result1.stderr).toContain('Both --id and --depends-on are required');

		// Run without --depends-on
		const result2 = await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '2'], { cwd: testDir, allowFailure: true });

		expect(result2.exitCode).not.toBe(0);
		expect(result2.stderr).toContain('Error');
		expect(result2.stderr).toContain('Both --id and --depends-on are required');
	});

	it('should handle removing non-existent dependency', async () => {
		// Try to remove a dependency that doesn't exist
		const result = await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '1', '-d', '999'], { cwd: testDir });

		// Should succeed (no-op)
		expect(result).toHaveExitCode(0);

		// Task should remain unchanged
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const task1 = updatedTasks.master.tasks.find(t => t.id === 1);
		expect(task1.dependencies).toEqual([]);
	});

	it('should handle non-existent task', async () => {
		// Try to remove dependency from non-existent task
		const result = await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '999', '-d', '1'], { cwd: testDir, allowFailure: true });

		// Should fail gracefully
		expect(result.exitCode).not.toBe(0);
		// The command might succeed gracefully or show error - let's just check it doesn't crash
		if (result.stderr) {
			expect(result.stderr.length).toBeGreaterThan(0);
		}
	});

	it('should work with tag option', async () => {
		// Create tasks with different tags
		const multiTagTasks = {
			master: {
				tasks: [{
					id: 1,
					description: 'Master task',
					dependencies: [2]
				}]
			},
			feature: {
				tasks: [{
					id: 1,
					description: 'Feature task',
					dependencies: [2, 3]
				}]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Remove dependency from feature tag
		const result = await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '1', '-d', '2', '--tag', 'feature'], { cwd: testDir });

		expect(result).toHaveExitCode(0);

		// Verify only feature tag was affected
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		expect(updatedTasks.master.tasks[0].dependencies).toEqual([2]);
		expect(updatedTasks.feature.tasks[0].dependencies).toEqual([3]);
	});

	it('should handle mixed dependency types', async () => {
		// Create task with mixed dependency types (numbers and strings)
		const mixedTasks = {
			master: {
				tasks: [{
					id: 5,
					description: 'Task with mixed deps',
					dependencies: [1, '2', 3, '4.1'],
					subtasks: []
				}]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(mixedTasks, null, 2));

		// Remove string dependency
		const result = await helpers.taskMaster('remove-dependency', ['-f', tasksPath, '-i', '5', '-d', '4.1'], { cwd: testDir });

		expect(result).toHaveExitCode(0);

		// Verify correct dependency was removed
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const task5 = updatedTasks.master.tasks.find(t => t.id === 5);
		expect(task5.dependencies).toEqual([1, '2', 3]);
	});
});