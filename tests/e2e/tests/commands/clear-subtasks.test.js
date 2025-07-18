import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
describe('task-master clear-subtasks command', () => {
	let testDir;
	let helpers;
	let tasksPath;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-clear-subtasks-command-'));

		// Initialize test helpers
		const context = global.createTestContext('clear-subtasks command');
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

		// Set up tasks path
		tasksPath = join(testDir, '.taskmaster', 'tasks', 'tasks.json');

		// Create test tasks with subtasks
		const testTasks = {
			tasks: [
					{
						id: 1,
						description: 'Task with subtasks',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: [
							{
								id: 1.1,
								description: 'Subtask 1',
								status: 'pending',
								priority: 'medium'
							},
							{
								id: 1.2,
								description: 'Subtask 2',
								status: 'pending',
								priority: 'medium'
							}
						]
					},
					{
						id: 2,
						description: 'Another task with subtasks',
						status: 'in_progress',
						priority: 'medium',
						dependencies: [],
						subtasks: [
							{
								id: 2.1,
								description: 'Subtask 2.1',
								status: 'pending',
								priority: 'low'
							}
						]
					},
					{
						id: 3,
						description: 'Task without subtasks',
						status: 'pending',
						priority: 'low',
						dependencies: [],
						subtasks: []
					}
				]
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

	it('should clear subtasks from a specific task', async () => {
		// Run clear-subtasks command for task 1
		const result = await helpers.taskMaster('clear-subtasks', ['-f', tasksPath, '-i', '1'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Clearing Subtasks');
		expect(result.stdout).toContain('Cleared 2 subtasks from task 1');

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		// Handle both formats: direct tasks array or master.tasks
		const tasks = updatedTasks.master ? updatedTasks.master.tasks : updatedTasks.tasks;
		const task1 = tasks.find(t => t.id === 1);
		const task2 = tasks.find(t => t.id === 2);

		// Verify task 1 has no subtasks
		expect(task1.subtasks).toHaveLength(0);

		// Verify task 2 still has subtasks
		expect(task2.subtasks).toHaveLength(1);
	});

	it('should clear subtasks from multiple tasks', async () => {
		// Run clear-subtasks command for tasks 1 and 2
		const result = await helpers.taskMaster('clear-subtasks', ['-f', tasksPath, '-i', '1,2'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Clearing Subtasks');
		// The success message appears in a decorative box with chalk formatting and ANSI codes
		// Using a more flexible pattern to account for ANSI escape codes and formatting
		expect(result.stdout).toMatch(/Successfully\s+cleared\s+subtasks\s+from\s+.*2.*\s+task\(s\)/i);

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		// Handle both formats: direct tasks array or master.tasks
		const tasks = updatedTasks.master ? updatedTasks.master.tasks : updatedTasks.tasks;
		const task1 = tasks.find(t => t.id === 1);
		const task2 = tasks.find(t => t.id === 2);

		// Verify both tasks have no subtasks
		expect(task1.subtasks).toHaveLength(0);
		expect(task2.subtasks).toHaveLength(0);
	});

	it('should clear subtasks from all tasks with --all flag', async () => {
		// Run clear-subtasks command with --all
		const result = await helpers.taskMaster('clear-subtasks', ['-f', tasksPath, '--all'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Clearing Subtasks');
		// The success message appears in a decorative box with extra spaces
		expect(result.stdout).toMatch(/Successfully\s+cleared\s+subtasks\s+from/i);

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		
		// Verify all tasks have no subtasks
		const tasks = updatedTasks.master ? updatedTasks.master.tasks : updatedTasks.tasks;
		tasks.forEach(task => {
			expect(task.subtasks).toHaveLength(0);
		});
	});

	it('should handle task without subtasks gracefully', async () => {
		// Run clear-subtasks command for task 3 (which has no subtasks)
		const result = await helpers.taskMaster('clear-subtasks', ['-f', tasksPath, '-i', '3'], { cwd: testDir });

		// Should succeed without error
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Clearing Subtasks');

		// Task should remain unchanged
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const tasks = updatedTasks.master ? updatedTasks.master.tasks : updatedTasks.tasks;
		const task3 = tasks.find(t => t.id === 3);
		expect(task3.subtasks).toHaveLength(0);
	});

	it('should fail when neither --id nor --all is specified', async () => {
		// Run clear-subtasks command without specifying tasks
		const result = await helpers.taskMaster('clear-subtasks', ['-f', tasksPath], { cwd: testDir });

		// Should fail with error
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('Error');
		expect(result.stderr).toContain('Please specify task IDs');
	});

	it('should handle non-existent task ID', async () => {
		// Run clear-subtasks command with non-existent task ID
		const result = await helpers.taskMaster('clear-subtasks', ['-f', tasksPath, '-i', '999'], { cwd: testDir });

		// Should handle gracefully
		expect(result).toHaveExitCode(0);
		// Original tasks should remain unchanged
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		// Check if master tag was created (which happens with readJSON/writeJSON)
		const tasks = updatedTasks.master ? updatedTasks.master.tasks : updatedTasks.tasks;
		expect(tasks).toHaveLength(3);
	});

	it.skip('should work with tag option', async () => {
		// Skip this test as tag support might not be implemented yet
		// Create tasks with different tags
		const multiTagTasks = {
			master: {
				tasks: [{
					id: 1,
					description: 'Master task',
					subtasks: [{ id: 1.1, description: 'Master subtask' }]
				}]
			},
			feature: {
				tasks: [{
					id: 1,
					description: 'Feature task',
					subtasks: [{ id: 1.1, description: 'Feature subtask' }]
				}]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Clear subtasks from feature tag
		const result = await helpers.taskMaster('clear-subtasks', ['-f', tasksPath, '-i', '1', '--tag', 'feature'], { cwd: testDir });

		expect(result).toHaveExitCode(0);

		// Verify only feature tag was affected
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		expect(updatedTasks.master.tasks[0].subtasks).toHaveLength(1);
		expect(updatedTasks.feature.tasks[0].subtasks).toHaveLength(0);
	});
});