/**
 * Comprehensive E2E tests for expand-task command
 * Tests all aspects of task expansion including single, multiple, and recursive expansion
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

describe('expand-task command', () => {
	let testDir;
	let helpers;
	let simpleTaskId;
	let complexTaskId;
	let manualTaskId;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-expand-task-'));

		// Initialize test helpers
		const context = global.createTestContext('expand-task');
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

		// Create simple task for expansion
		const simpleResult = await helpers.taskMaster(
			'add-task',
			['--prompt', 'Create a user authentication system'],
			{ cwd: testDir }
		);
		simpleTaskId = helpers.extractTaskId(simpleResult.stdout);

		// Create complex task for expansion
		const complexResult = await helpers.taskMaster(
			'add-task',
			[
				'--prompt',
				'Build a full-stack web application with React frontend and Node.js backend'
			],
			{ cwd: testDir }
		);
		complexTaskId = helpers.extractTaskId(complexResult.stdout);

		// Create manual task (no AI prompt)
		const manualResult = await helpers.taskMaster(
			'add-task',
			[
				'--title',
				'Manual task for expansion',
				'--description',
				'This is a manually created task'
			],
			{ cwd: testDir }
		);
		manualTaskId = helpers.extractTaskId(manualResult.stdout);
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Single task expansion', () => {
		it('should expand a single task', async () => {
			const result = await helpers.taskMaster(
				'expand',
				['--id', simpleTaskId],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Expanded');

			// Verify subtasks were created
			const showResult = await helpers.taskMaster('show', [simpleTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Subtasks:');
		}, 60000);

		it('should expand with custom number of subtasks', async () => {
			const result = await helpers.taskMaster(
				'expand',
				['--id', complexTaskId, '--num', '3'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Check that we got approximately 3 subtasks
			const showResult = await helpers.taskMaster('show', [complexTaskId], {
				cwd: testDir
			});
			const subtaskMatches = showResult.stdout.match(/\d+\.\d+/g);
			expect(subtaskMatches).toBeTruthy();
			expect(subtaskMatches.length).toBeGreaterThanOrEqual(2);
			expect(subtaskMatches.length).toBeLessThanOrEqual(5);
		}, 60000);

		it('should expand with research mode', async () => {
			const result = await helpers.taskMaster(
				'expand',
				['--id', simpleTaskId, '--research'],
				{ cwd: testDir, timeout: 60000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('research');
		}, 90000);

		it('should expand with additional context', async () => {
			const result = await helpers.taskMaster(
				'expand',
				[
					'--id',
					manualTaskId,
					'--prompt',
					'Focus on security best practices and testing'
				],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify context was used
			const showResult = await helpers.taskMaster('show', [manualTaskId], {
				cwd: testDir
			});
			const outputLower = showResult.stdout.toLowerCase();
			expect(outputLower).toMatch(/security|test/);
		}, 60000);
	});

	describe('Bulk expansion', () => {
		it('should expand all tasks', async () => {
			const result = await helpers.taskMaster('expand', ['--all'], {
				cwd: testDir,
				timeout: 120000
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Expanding all');

			// Verify all tasks have subtasks
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasksData = JSON.parse(readFileSync(tasksPath, 'utf8'));
			const tasks = tasksData.master.tasks;

			const tasksWithSubtasks = tasks.filter(
				(t) => t.subtasks && t.subtasks.length > 0
			);
			expect(tasksWithSubtasks.length).toBeGreaterThanOrEqual(2);
		}, 150000);

		it('should expand all with force flag', async () => {
			// First expand one task
			await helpers.taskMaster('expand', ['--id', simpleTaskId], {
				cwd: testDir
			});

			// Then expand all with force
			const result = await helpers.taskMaster('expand', ['--all', '--force'], {
				cwd: testDir,
				timeout: 120000
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('force');
		}, 150000);
	});

	describe('Specific task ranges', () => {
		it('should expand tasks by ID range', async () => {
			// Create more tasks
			await helpers.taskMaster('add-task', ['--prompt', 'Additional task 1'], {
				cwd: testDir
			});
			await helpers.taskMaster('add-task', ['--prompt', 'Additional task 2'], {
				cwd: testDir
			});

			const result = await helpers.taskMaster(
				'expand',
				['--from', '2', '--to', '4'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify tasks 2-4 were expanded
			const showResult2 = await helpers.taskMaster('show', ['2'], {
				cwd: testDir
			});
			const showResult3 = await helpers.taskMaster('show', ['3'], {
				cwd: testDir
			});
			const showResult4 = await helpers.taskMaster('show', ['4'], {
				cwd: testDir
			});

			expect(showResult2.stdout).toContain('Subtasks:');
			expect(showResult3.stdout).toContain('Subtasks:');
			expect(showResult4.stdout).toContain('Subtasks:');
		}, 120000);

		it('should expand specific task IDs', async () => {
			const result = await helpers.taskMaster(
				'expand',
				['--id', `${simpleTaskId},${complexTaskId}`],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);

			// Both tasks should have subtasks
			const showResult1 = await helpers.taskMaster('show', [simpleTaskId], {
				cwd: testDir
			});
			const showResult2 = await helpers.taskMaster('show', [complexTaskId], {
				cwd: testDir
			});

			expect(showResult1.stdout).toContain('Subtasks:');
			expect(showResult2.stdout).toContain('Subtasks:');
		}, 120000);
	});

	describe('Error handling', () => {
		it('should fail for non-existent task ID', async () => {
			const result = await helpers.taskMaster('expand', ['--id', '99999'], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('not found');
		});

		it('should skip already expanded tasks without force', async () => {
			// First expansion
			await helpers.taskMaster('expand', ['--id', simpleTaskId], {
				cwd: testDir
			});

			// Second expansion without force
			const result = await helpers.taskMaster(
				'expand',
				['--id', simpleTaskId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout.toLowerCase()).toMatch(/already|skip/);
		});

		it('should handle invalid number of subtasks', async () => {
			const result = await helpers.taskMaster(
				'expand',
				['--id', simpleTaskId, '--num', '-1'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
		});
	});

	describe('Tag support', () => {
		it('should expand tasks in specific tag', async () => {
			// Create tag and tagged task
			await helpers.taskMaster('add-tag', ['feature-tag'], { cwd: testDir });

			const taggedResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Tagged task for expansion', '--tag', 'feature-tag'],
				{ cwd: testDir }
			);
			const taggedId = helpers.extractTaskId(taggedResult.stdout);

			const result = await helpers.taskMaster(
				'expand',
				['--id', taggedId, '--tag', 'feature-tag'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify expansion in correct tag
			const showResult = await helpers.taskMaster(
				'show',
				[taggedId, '--tag', 'feature-tag'],
				{ cwd: testDir }
			);
			expect(showResult.stdout).toContain('Subtasks:');
		}, 60000);
	});

	describe('Model configuration', () => {
		it('should use specified model for expansion', async () => {
			const result = await helpers.taskMaster(
				'expand',
				['--id', simpleTaskId, '--model', 'gpt-3.5-turbo'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
		}, 60000);
	});

	describe('Output validation', () => {
		it('should create valid subtask structure', async () => {
			await helpers.taskMaster('expand', ['--id', complexTaskId], {
				cwd: testDir
			});

			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasksData = JSON.parse(readFileSync(tasksPath, 'utf8'));
			const task = tasksData.master.tasks.find(
				(t) => t.id === parseInt(complexTaskId)
			);

			expect(task.subtasks).toBeDefined();
			expect(Array.isArray(task.subtasks)).toBe(true);
			expect(task.subtasks.length).toBeGreaterThan(0);

			// Validate subtask structure
			task.subtasks.forEach((subtask, index) => {
				expect(subtask.id).toBe(`${complexTaskId}.${index + 1}`);
				expect(subtask.title).toBeTruthy();
				expect(subtask.description).toBeTruthy();
				expect(subtask.status).toBe('pending');
			});
		});

		it('should maintain task dependencies after expansion', async () => {
			// Create task with dependency
			const depResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Dependent task', '--dependencies', simpleTaskId],
				{ cwd: testDir }
			);
			const depTaskId = helpers.extractTaskId(depResult.stdout);

			// Expand the task
			await helpers.taskMaster('expand', ['--id', depTaskId], { cwd: testDir });

			// Check dependencies are preserved
			const showResult = await helpers.taskMaster('show', [depTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain(`Dependencies: ${simpleTaskId}`);
		});
	});
});
