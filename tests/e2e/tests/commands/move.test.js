/**
 * Comprehensive E2E tests for move command
 * Tests moving tasks and subtasks to different positions
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
const path = require('path');

describe('move command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-move-'));

		// Initialize test helpers
		const context = global.createTestContext('move');
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

	describe('Moving tasks to different positions', () => {
		it('should move a task to a new ID', async () => {
			// Create test tasks
			const task1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Task 1', '--description', 'First task'],
				{ cwd: testDir }
			);
			const taskId1 = helpers.extractTaskId(task1.stdout);

			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 2', '--description', 'Second task'],
				{ cwd: testDir }
			);

			// Move task 1 to position 3
			const result = await helpers.taskMaster(
				'move',
				['--from', taskId1, '--to', '3'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`Successfully moved task/subtask ${taskId1} to 3`);

			// Verify the move
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			expect(tasks.master.tasks.find(t => t.id === 3)).toBeDefined();
			expect(tasks.master.tasks.find(t => t.id === 3).title).toBe('Task 1');
			expect(tasks.master.tasks.find(t => t.id === parseInt(taskId1))).toBeUndefined();
		});

		it('should handle moving to an existing task ID', async () => {
			// Create test tasks
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 1', '--description', 'First task'],
				{ cwd: testDir }
			);
			const task2 = await helpers.taskMaster(
				'add-task',
				['--title', 'Task 2', '--description', 'Second task'],
				{ cwd: testDir }
			);
			const taskId2 = helpers.extractTaskId(task2.stdout);

			// Try to move task 1 to task 2's position
			const result = await helpers.taskMaster(
				'move',
				['--from', '1', '--to', taskId2],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('already exists');
		});

		it('should handle moving to the same position', async () => {
			// Create a task
			const task = await helpers.taskMaster(
				'add-task',
				['--title', 'Task 1', '--description', 'First task'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(task.stdout);

			// Move task to same position
			const result = await helpers.taskMaster(
				'move',
				['--from', taskId, '--to', taskId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`Skipping ${taskId} -> ${taskId} (same ID)`);
		});

		it('should update dependencies when moving a task', async () => {
			// Create dependency task
			const task1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Dependency', '--description', 'Will be depended on'],
				{ cwd: testDir }
			);
			const taskId1 = helpers.extractTaskId(task1.stdout);

			// Create task that depends on it
			await helpers.taskMaster(
				'add-task',
				[
					'--title', 
					'Dependent task', 
					'--description', 
					'Depends on task 1',
					'--dependencies',
					taskId1
				],
				{ cwd: testDir }
			);

			// Move dependency task to new ID
			const result = await helpers.taskMaster(
				'move',
				['--from', taskId1, '--to', '5'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify dependencies were updated
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			const dependentTask = tasks.master.tasks.find(t => t.title === 'Dependent task');
			expect(dependentTask.dependencies).toContain(5);
			expect(dependentTask.dependencies).not.toContain(parseInt(taskId1));
		});
	});

	describe('Moving subtasks within parent', () => {
		let parentTaskId;

		beforeEach(async () => {
			// Create parent task
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
			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentTaskId,
					'--title',
					'Subtask 3',
					'--description',
					'Third subtask'
				],
				{ cwd: testDir }
			);
		});

		it('should move subtask within the same parent', async () => {
			const fromId = `${parentTaskId}.1`;
			const toId = `${parentTaskId}.3`;

			const result = await helpers.taskMaster(
				'move',
				['--from', fromId, '--to', toId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`Successfully moved task/subtask ${fromId} to ${toId}`);

			// Verify the move
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			const parent = tasks.master.tasks.find(t => t.id === parseInt(parentTaskId));
			
			// Subtask 1 should now be after subtask 3
			const subtaskTitles = parent.subtasks.map(st => st.title);
			expect(subtaskTitles.indexOf('Subtask 1')).toBeGreaterThan(subtaskTitles.indexOf('Subtask 3'));
		});

		it('should move subtask to first position', async () => {
			const fromId = `${parentTaskId}.3`;
			const toId = `${parentTaskId}.1`;

			const result = await helpers.taskMaster(
				'move',
				['--from', fromId, '--to', toId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify the move
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			const parent = tasks.master.tasks.find(t => t.id === parseInt(parentTaskId));
			
			// Subtask 3 should now be before subtask 1
			const subtaskTitles = parent.subtasks.map(st => st.title);
			expect(subtaskTitles.indexOf('Subtask 3')).toBeLessThan(subtaskTitles.indexOf('Subtask 1'));
		});

		it('should handle moving to non-existent subtask position', async () => {
			const fromId = `${parentTaskId}.1`;
			const toId = `${parentTaskId}.99`; // Non-existent position

			const result = await helpers.taskMaster(
				'move',
				['--from', fromId, '--to', toId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Should move to end when position doesn't exist
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			const parent = tasks.master.tasks.find(t => t.id === parseInt(parentTaskId));
			
			// Subtask 1 should be at the end
			const lastSubtask = parent.subtasks[parent.subtasks.length - 1];
			expect(lastSubtask.title).toBe('Subtask 1');
		});
	});

	describe('Moving subtasks between parents', () => {
		let parentTaskId1, parentTaskId2;

		beforeEach(async () => {
			// Create two parent tasks
			const parent1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent 1', '--description', 'First parent'],
				{ cwd: testDir }
			);
			parentTaskId1 = helpers.extractTaskId(parent1.stdout);

			const parent2 = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent 2', '--description', 'Second parent'],
				{ cwd: testDir }
			);
			parentTaskId2 = helpers.extractTaskId(parent2.stdout);

			// Add subtasks to parent 1
			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentTaskId1,
					'--title',
					'Subtask A',
					'--description',
					'From parent 1'
				],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentTaskId1,
					'--title',
					'Subtask B',
					'--description',
					'From parent 1'
				],
				{ cwd: testDir }
			);

			// Add subtasks to parent 2
			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentTaskId2,
					'--title',
					'Subtask X',
					'--description',
					'From parent 2'
				],
				{ cwd: testDir }
			);
		});

		it('should move subtask from one parent to another', async () => {
			const fromId = `${parentTaskId1}.1`; // Subtask A
			const toId = `${parentTaskId2}.2`; // After Subtask X

			const result = await helpers.taskMaster(
				'move',
				['--from', fromId, '--to', toId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify the move
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			const parent1 = tasks.master.tasks.find(t => t.id === parseInt(parentTaskId1));
			const parent2 = tasks.master.tasks.find(t => t.id === parseInt(parentTaskId2));

			// Parent 1 should have one less subtask
			expect(parent1.subtasks.length).toBe(1);
			expect(parent1.subtasks.find(st => st.title === 'Subtask A')).toBeUndefined();

			// Parent 2 should have the moved subtask
			expect(parent2.subtasks.length).toBe(2);
			expect(parent2.subtasks.find(st => st.title === 'Subtask A')).toBeDefined();
		});

		it('should handle moving to empty parent', async () => {
			// Create parent with no subtasks
			const parent3 = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent 3', '--description', 'Empty parent'],
				{ cwd: testDir }
			);
			const parentTaskId3 = helpers.extractTaskId(parent3.stdout);

			const fromId = `${parentTaskId1}.1`;
			const toId = `${parentTaskId3}.1`;

			const result = await helpers.taskMaster(
				'move',
				['--from', fromId, '--to', toId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify the move
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			const parent3Task = tasks.master.tasks.find(t => t.id === parseInt(parentTaskId3));

			expect(parent3Task.subtasks).toBeDefined();
			expect(parent3Task.subtasks.length).toBe(1);
			expect(parent3Task.subtasks[0].title).toBe('Subtask A');
		});
	});

	describe('Converting between tasks and subtasks', () => {
		it('should convert subtask to task', async () => {
			// Create parent with subtask
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'Has subtask'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentId,
					'--title',
					'Subtask to promote',
					'--description',
					'Will become a task'
				],
				{ cwd: testDir }
			);

			// Move subtask to task
			const fromId = `${parentId}.1`;
			const toId = '10';

			const result = await helpers.taskMaster(
				'move',
				['--from', fromId, '--to', toId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`Converted subtask ${fromId} to task ${toId}`);

			// Verify conversion
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			
			// Should exist as task
			const newTask = tasks.master.tasks.find(t => t.id === 10);
			expect(newTask).toBeDefined();
			expect(newTask.title).toBe('Subtask to promote');

			// Should not exist as subtask anymore
			const parentTask = tasks.master.tasks.find(t => t.id === parseInt(parentId));
			expect(parentTask.subtasks.length).toBe(0);
		});

		it('should convert task to subtask', async () => {
			// Create regular task
			const task = await helpers.taskMaster(
				'add-task',
				['--title', 'Task to demote', '--description', 'Will become subtask'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(task.stdout);

			// Create parent task
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'Will receive subtask'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			// Move task to subtask
			const toId = `${parentId}.1`;

			const result = await helpers.taskMaster(
				'move',
				['--from', taskId, '--to', toId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`Converted task ${taskId} to subtask ${toId}`);

			// Verify conversion
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			
			// Should not exist as task
			const oldTask = tasks.master.tasks.find(t => t.id === parseInt(taskId));
			expect(oldTask).toBeUndefined();

			// Should exist as subtask
			const parentTask = tasks.master.tasks.find(t => t.id === parseInt(parentId));
			expect(parentTask.subtasks).toBeDefined();
			expect(parentTask.subtasks.length).toBe(1);
			expect(parentTask.subtasks[0].title).toBe('Task to demote');
		});

		it('should handle task with subtasks when converting to subtask', async () => {
			// Create task with subtasks
			const task = await helpers.taskMaster(
				'add-task',
				['--title', 'Task with subtasks', '--description', 'Has children'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(task.stdout);

			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					taskId,
					'--title',
					'Child subtask',
					'--description',
					'Subtask of task'
				],
				{ cwd: testDir }
			);

			// Create parent task
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'New parent', '--description', 'Will receive task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			// Move task with subtasks to become subtask
			const toId = `${parentId}.1`;

			const result = await helpers.taskMaster(
				'move',
				['--from', taskId, '--to', toId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify the task's subtasks are preserved (or handled appropriately)
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			const parentTask = tasks.master.tasks.find(t => t.id === parseInt(parentId));
			
			// The converted subtask should exist
			expect(parentTask.subtasks[0].title).toBe('Task with subtasks');
		});
	});

	describe('Batch moving multiple tasks', () => {
		it('should move multiple tasks at once', async () => {
			// Create test tasks
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 1', '--description', 'First'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 2', '--description', 'Second'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 3', '--description', 'Third'],
				{ cwd: testDir }
			);

			// Move multiple tasks
			const result = await helpers.taskMaster(
				'move',
				['--from', '1,2', '--to', '10,11'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Moving multiple tasks');
			expect(result.stdout).toContain('Successfully moved task/subtask 1 to 10');
			expect(result.stdout).toContain('Successfully moved task/subtask 2 to 11');

			// Verify moves
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			
			expect(tasks.master.tasks.find(t => t.id === 10)).toBeDefined();
			expect(tasks.master.tasks.find(t => t.id === 11)).toBeDefined();
			expect(tasks.master.tasks.find(t => t.id === 1)).toBeUndefined();
			expect(tasks.master.tasks.find(t => t.id === 2)).toBeUndefined();
		});

		it('should handle mismatched source and destination counts', async () => {
			const result = await helpers.taskMaster(
				'move',
				['--from', '1,2,3', '--to', '10,11'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('number of source and destination IDs must match');
		});

		it('should skip same ID moves in batch', async () => {
			// Create tasks
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 1', '--description', 'First'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 2', '--description', 'Second'],
				{ cwd: testDir }
			);

			// Move with one same ID
			const result = await helpers.taskMaster(
				'move',
				['--from', '1,2', '--to', '1,3'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Skipping 1 -> 1 (same ID)');
			expect(result.stdout).toContain('Successfully moved task/subtask 2 to 3');
		});
	});

	describe('Tag support', () => {
		beforeEach(async () => {
			// Create a new tag
			await helpers.taskMaster(
				'add-tag',
				['feature-branch', '--description', 'Feature work'],
				{ cwd: testDir }
			);

			// Add tasks to feature tag
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Feature task 1',
					'--description',
					'In feature branch',
					'--tag',
					'feature-branch'
				],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Feature task 2',
					'--description',
					'Also in feature branch',
					'--tag',
					'feature-branch'
				],
				{ cwd: testDir }
			);
		});

		it('should move tasks within a specific tag', async () => {
			const result = await helpers.taskMaster(
				'move',
				['--from', '1', '--to', '3', '--tag', 'feature-branch'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify move in correct tag
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			
			expect(tasks['feature-branch'].tasks.find(t => t.id === 3)).toBeDefined();
			expect(tasks['feature-branch'].tasks.find(t => t.id === 3).title).toBe('Feature task 1');
		});

		it('should respect current tag when no tag specified', async () => {
			// Switch to feature tag
			await helpers.taskMaster('use-tag', ['feature-branch'], { cwd: testDir });

			const result = await helpers.taskMaster(
				'move',
				['--from', '2', '--to', '4'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify move happened in feature tag
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			
			expect(tasks['feature-branch'].tasks.find(t => t.id === 4)).toBeDefined();
			expect(tasks['feature-branch'].tasks.find(t => t.id === 4).title).toBe('Feature task 2');
		});
	});

	describe('Error handling', () => {
		it('should handle missing --from parameter', async () => {
			const result = await helpers.taskMaster(
				'move',
				['--to', '5'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Both --from and --to parameters are required');
		});

		it('should handle missing --to parameter', async () => {
			const result = await helpers.taskMaster(
				'move',
				['--from', '1'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Both --from and --to parameters are required');
		});

		it('should handle non-existent source task', async () => {
			const result = await helpers.taskMaster(
				'move',
				['--from', '999', '--to', '1000'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('not found');
		});

		it('should handle non-existent source subtask', async () => {
			// Create parent task
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent', '--description', 'Parent task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			const result = await helpers.taskMaster(
				'move',
				['--from', `${parentId}.99`, '--to', `${parentId}.1`],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('not found');
		});

		it('should handle non-existent parent task', async () => {
			const result = await helpers.taskMaster(
				'move',
				['--from', '999.1', '--to', '1000.1'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('not found');
		});

		it('should handle invalid task file', async () => {
			const invalidPath = join(testDir, 'invalid.json');
			writeFileSync(invalidPath, '{ invalid json }');

			const result = await helpers.taskMaster(
				'move',
				['--from', '1', '--to', '2', '--file', invalidPath],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
		});
	});

	describe('Edge cases', () => {
		it('should handle moving first task', async () => {
			// Create multiple tasks
			await helpers.taskMaster(
				'add-task',
				['--title', 'First task', '--description', 'Task 1'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				['--title', 'Second task', '--description', 'Task 2'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster(
				'move',
				['--from', '1', '--to', '3'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify order
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			const taskIds = tasks.master.tasks.map(t => t.id);
			
			expect(taskIds.indexOf(3)).toBeGreaterThan(taskIds.indexOf(2));
		});

		it('should handle moving last task', async () => {
			// Create multiple tasks
			await helpers.taskMaster(
				'add-task',
				['--title', 'First task', '--description', 'Task 1'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				['--title', 'Second task', '--description', 'Task 2'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				['--title', 'Third task', '--description', 'Task 3'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster(
				'move',
				['--from', '3', '--to', '0'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Task should be moved with new ID
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			
			expect(tasks.master.tasks.find(t => t.id === 0)).toBeDefined();
			expect(tasks.master.tasks.find(t => t.id === 0).title).toBe('Third task');
		});

		it('should preserve task properties when moving', async () => {
			// Create task with all properties
			const task = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Complex task',
					'--description',
					'Has all properties',
					'--priority',
					'high',
					'--details',
					'Detailed information',
					'--test-strategy',
					'Unit tests required'
				],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(task.stdout);

			// Set status
			await helpers.taskMaster(
				'set-status',
				['--id', taskId, '--status', 'in-progress'],
				{ cwd: testDir }
			);

			// Move the task
			const result = await helpers.taskMaster(
				'move',
				['--from', taskId, '--to', '10'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify all properties preserved
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			const movedTask = tasks.master.tasks.find(t => t.id === 10);

			expect(movedTask.title).toBe('Complex task');
			expect(movedTask.description).toBe('Has all properties');
			expect(movedTask.priority).toBe('high');
			expect(movedTask.details).toBe('Detailed information');
			expect(movedTask.testStrategy).toBe('Unit tests required');
			expect(movedTask.status).toBe('in-progress');
		});

		it('should handle moving with subtask dependencies', async () => {
			// Create parent with subtasks that have dependencies
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent', '--description', 'Has dependent subtasks'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentId,
					'--title',
					'Subtask 1',
					'--description',
					'First'
				],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentId,
					'--title',
					'Subtask 2',
					'--description',
					'Depends on 1',
					'--dependencies',
					`${parentId}.1`
				],
				{ cwd: testDir }
			);

			// Move parent task to new ID
			const result = await helpers.taskMaster(
				'move',
				['--from', parentId, '--to', '10'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify subtask dependencies were updated
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = helpers.readJson(tasksPath);
			const movedParent = tasks.master.tasks.find(t => t.id === 10);

			expect(movedParent.subtasks[1].dependencies).toContain('10.1');
			expect(movedParent.subtasks[1].dependencies).not.toContain(`${parentId}.1`);
		});
	});

	describe('Performance', () => {
		it('should handle moving tasks efficiently with many tasks', async () => {
			// Create many tasks
			const promises = [];
			for (let i = 1; i <= 20; i++) {
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
			const result = await helpers.taskMaster(
				'move',
				['--from', '10', '--to', '25'],
				{ cwd: testDir }
			);
			const endTime = Date.now();

			expect(result).toHaveExitCode(0);
			// Should complete within reasonable time (2 seconds)
			expect(endTime - startTime).toBeLessThan(2000);
		});
	});

	describe('File generation', () => {
		it('should regenerate task files after move', async () => {
			// Create task
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task to move', '--description', 'Will be moved'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster(
				'move',
				['--from', '1', '--to', '5'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Check if task file was regenerated
			const taskFilePath = join(testDir, '.taskmaster/tasks/5.md');
			expect(existsSync(taskFilePath)).toBe(true);

			// Old task file should be removed
			const oldTaskFilePath = join(testDir, '.taskmaster/tasks/1.md');
			expect(existsSync(oldTaskFilePath)).toBe(false);
		});
	});
});