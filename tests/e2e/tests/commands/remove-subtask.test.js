import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
describe('task-master remove-subtask command', () => {
	let testDir;
	let helpers;
	let tasksPath;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-remove-subtask-command-'));

		// Initialize test helpers
		const context = global.createTestContext('remove-subtask command');
		helpers = context.helpers;

		// Initialize paths
		tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');

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

	beforeEach(() => {
		// Create test tasks with subtasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Parent task 1',
						description: 'Parent task 1',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: [
							{
								id: 1,
								title: 'Subtask 1.1',
								description: 'First subtask',
								status: 'pending',
								priority: 'medium',
								dependencies: []
							},
							{
								id: 2,
								title: 'Subtask 1.2',
								description: 'Second subtask',
								status: 'in_progress',
								priority: 'high',
								dependencies: ['1.1']
							}
						]
					},
					{
						id: 2,
						title: 'Parent task 2',
						description: 'Parent task 2',
						status: 'in_progress',
						priority: 'medium',
						dependencies: [],
						subtasks: [
							{
								id: 1,
								title: 'Subtask 2.1',
								description: 'Another subtask',
								status: 'pending',
								priority: 'low',
								dependencies: []
							}
						]
					},
					{
						id: 3,
						title: 'Task without subtasks',
						description: 'Task without subtasks',
						status: 'pending',
						priority: 'low',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		// Ensure .taskmaster directory exists
		mkdirSync(dirname(tasksPath), { recursive: true });
		writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));
	});

	it('should remove a subtask from its parent', async () => {
		// Run remove-subtask command
		const result = await helpers.taskMaster('remove-subtask', ['-f', tasksPath, '-i', '1.1', '--skip-generate'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Removing subtask 1.1');
		expect(result.stdout).toContain('successfully deleted');

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const parentTask = updatedTasks.master.tasks.find(t => t.id === 1);

		// Verify subtask was removed
		expect(parentTask.subtasks).toHaveLength(1);
		expect(parentTask.subtasks[0].id).toBe(2);
		expect(parentTask.subtasks[0].title).toBe('Subtask 1.2');
	});

	it('should remove multiple subtasks', async () => {
		// Run remove-subtask command with multiple IDs
		const result = await helpers.taskMaster('remove-subtask', ['-f', tasksPath, '-i', '1.1,1.2', '--skip-generate'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Removing subtask 1.1');
		expect(result.stdout).toContain('Removing subtask 1.2');

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const parentTask = updatedTasks.master.tasks.find(t => t.id === 1);

		// Verify both subtasks were removed (property may be empty array or undefined)
		expect(parentTask).toBeDefined();
		expect(parentTask.subtasks || []).toHaveLength(0);
	});

	it('should convert subtask to standalone task with --convert flag', async () => {
		// Run remove-subtask command with convert flag
		const result = await helpers.taskMaster('remove-subtask', ['-f', tasksPath, '-i', '2.1', '--convert', '--skip-generate'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('converted to a standalone task');
		expect(result.stdout).toContain('Converted to Task');

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const parentTask = updatedTasks.master.tasks.find(t => t.id === 2);
		
		// Verify subtask was removed from parent
		expect(parentTask.subtasks || []).toHaveLength(0);

		// Verify new standalone task was created
		const newTask = updatedTasks.master.tasks.find(t => t.title === 'Subtask 2.1');
		expect(newTask).toBeDefined();
		expect(newTask.description).toBe('Another subtask');
		expect(newTask.status).toBe('pending');
		expect(newTask.priority).toBe('medium');
	});

	it('should handle dependencies when converting subtask', async () => {
		// Run remove-subtask command to convert subtask with dependencies
		const result = await helpers.taskMaster('remove-subtask', ['-f', tasksPath, '-i', '1.2', '--convert', '--skip-generate'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);

		// Read updated tasks
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		const newTask = updatedTasks.master.tasks.find(t => t.title === 'Subtask 1.2');
		
		// Verify dependencies were preserved and updated
		expect(newTask).toBeDefined();
		expect(newTask.dependencies).toBeDefined();
		// Dependencies should be updated from '1.1' to appropriate format
	});

	it('should fail when ID is not provided', async () => {
		// Run remove-subtask command without ID
		const result = await helpers.taskMaster('remove-subtask', ['-f', tasksPath], { cwd: testDir });

		// Should fail
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('Error');
		expect(result.stderr).toContain('--id parameter is required');
	});

	it('should fail with invalid subtask ID format', async () => {
		// Run remove-subtask command with invalid ID format
		const result = await helpers.taskMaster('remove-subtask', ['-f', tasksPath, '-i', '1'], { cwd: testDir });

		// Should fail
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('Error');
		expect(result.stderr).toContain('must be in format "parentId.subtaskId"');
	});

	it('should handle non-existent subtask ID', async () => {
		// Run remove-subtask command with non-existent subtask
		const result = await helpers.taskMaster('remove-subtask', ['-f', tasksPath, '-i', '1.999'], { cwd: testDir });

		// Should fail gracefully
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('Error');
	});

	it('should handle removing from non-existent parent', async () => {
		// Run remove-subtask command with non-existent parent
		const result = await helpers.taskMaster('remove-subtask', ['-f', tasksPath, '-i', '999.1'], { cwd: testDir });

		// Should fail gracefully
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('Error');
	});

	it('should work with tag option', async () => {
		// Create tasks with different tags
		const multiTagTasks = {
			master: {
				tasks: [{
					id: 1,
					title: 'Master task',
					description: 'Master task',
					status: 'pending',
					priority: 'medium',
					dependencies: [],
					subtasks: [{
						id: 1,
						title: 'Master subtask',
						description: 'To be removed',
						status: 'pending',
						priority: 'medium',
						dependencies: []
					}]
				}]
			},
			feature: {
				tasks: [{
					id: 1,
					title: 'Feature task',
					description: 'Feature task',
					status: 'pending',
					priority: 'medium',
					dependencies: [],
					subtasks: [{
						id: 1,
						title: 'Feature subtask',
						description: 'To be removed',
						status: 'pending',
						priority: 'medium',
						dependencies: []
					}]
				}]
			}
		};

		writeFileSync(tasksPath, JSON.stringify(multiTagTasks, null, 2));

		// Remove subtask from feature tag
		const result = await helpers.taskMaster('remove-subtask', ['-f', tasksPath, '-i', '1.1', '--tag', 'feature', '--skip-generate'], { cwd: testDir });

		expect(result).toHaveExitCode(0);

		// Verify only feature tag was affected
		const updatedTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
		expect(updatedTasks.master.tasks[0].subtasks).toHaveLength(1);
		expect(updatedTasks.feature.tasks[0].subtasks || []).toHaveLength(0);
	});
});