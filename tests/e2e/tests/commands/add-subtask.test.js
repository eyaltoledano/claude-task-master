/**
 * E2E tests for add-subtask command
 * Tests subtask creation and conversion functionality
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

describe('task-master add-subtask', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-add-subtask-'));

		// Initialize test helpers
		const context = global.createTestContext('add-subtask');
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

	describe('Basic subtask creation', () => {
		it('should add a new subtask to a parent task', async () => {
			// Create parent task
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'A parent task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			// Add subtask
			const result = await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentId,
					'--title',
					'New subtask',
					'--description',
					'This is a new subtask',
					'--skip-generate'
				],
				{ cwd: testDir }
			);

			// Verify success
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Creating new subtask');
			expect(result.stdout).toContain('successfully created');
			expect(result.stdout).toContain(`${parentId}.1`); // subtask ID

			// Verify subtask was added
			const showResult = await helpers.taskMaster('show', [parentId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('New'); // Truncated in table
			expect(showResult.stdout).toContain('Subtasks'); // Section header
		});

		it('should add a subtask with custom status and details', async () => {
			// Create parent task
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'A parent task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			// Add subtask with custom options
			const result = await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentId,
					'--title',
					'Advanced subtask',
					'--description',
					'Subtask with details',
					'--details',
					'Implementation details here',
					'--status',
					'in-progress',
					'--skip-generate'
				],
				{ cwd: testDir }
			);

			// Verify success
			expect(result).toHaveExitCode(0);

			// Verify subtask properties
			const showResult = await helpers.taskMaster('show', [`${parentId}.1`], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Advanced'); // Truncated in table
			expect(showResult.stdout).toContain('Subtask'); // Part of description
			expect(showResult.stdout).toContain('Implementation'); // Part of details
			expect(showResult.stdout).toContain('in-progress');
		});

		it('should add a subtask with dependencies', async () => {
			// Create dependency task
			const dep = await helpers.taskMaster(
				'add-task',
				['--title', 'Dependency task', '--description', 'A dependency'],
				{ cwd: testDir }
			);
			const depId = helpers.extractTaskId(dep.stdout);

			// Create parent task and subtask
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'A parent task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			// Add first subtask
			await helpers.taskMaster(
				'add-subtask',
				['--parent', parentId, '--title', 'First subtask', '--skip-generate'],
				{ cwd: testDir }
			);

			// Add second subtask with dependencies
			const result = await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentId,
					'--title',
					'Subtask with deps',
					'--dependencies',
					`${parentId}.1,${depId}`,
					'--skip-generate'
				],
				{ cwd: testDir }
			);

			// Verify success
			expect(result).toHaveExitCode(0);

			// Verify subtask was created (dependencies may not show in standard show output)
			const showResult = await helpers.taskMaster('show', [`${parentId}.2`], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Subtask'); // Part of title
		});
	});

	describe('Task conversion', () => {
		it('should convert an existing task to a subtask', async () => {
			// Create tasks
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'A parent task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			const taskToConvert = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Task to be converted',
					'--description',
					'This will become a subtask'
				],
				{ cwd: testDir }
			);
			const convertId = helpers.extractTaskId(taskToConvert.stdout);

			// Convert task to subtask
			const result = await helpers.taskMaster(
				'add-subtask',
				['--parent', parentId, '--task-id', convertId, '--skip-generate'],
				{ cwd: testDir }
			);

			// Verify success
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`Converting task ${convertId}`);
			expect(result.stdout).toContain('successfully converted');

			// Verify task was converted
			const showParent = await helpers.taskMaster('show', [parentId], {
				cwd: testDir
			});
			expect(showParent.stdout).toContain('Task'); // Truncated title in table

			// Verify original task no longer exists as top-level
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			expect(listResult.stdout).not.toContain(`${convertId}:`);
		});
	});

	describe('Error handling', () => {
		it('should fail when parent ID is not provided', async () => {
			const result = await helpers.taskMaster(
				'add-subtask',
				['--title', 'Orphan subtask'],
				{
					cwd: testDir,
					allowFailure: true
				}
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('--parent parameter is required');
		});

		it('should fail when neither task-id nor title is provided', async () => {
			// Create parent task first
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'A parent task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			const result = await helpers.taskMaster(
				'add-subtask',
				['--parent', parentId],
				{
					cwd: testDir,
					allowFailure: true
				}
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain(
				'Either --task-id or --title must be provided'
			);
		});

		it('should handle non-existent parent task', async () => {
			const result = await helpers.taskMaster(
				'add-subtask',
				['--parent', '999', '--title', 'Lost subtask'],
				{
					cwd: testDir,
					allowFailure: true
				}
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Error');
		});

		it('should handle non-existent task ID for conversion', async () => {
			// Create parent task first
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'A parent task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			const result = await helpers.taskMaster(
				'add-subtask',
				['--parent', parentId, '--task-id', '999'],
				{
					cwd: testDir,
					allowFailure: true
				}
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Error');
		});
	});

	describe('Tag context', () => {
		it('should work with tag option', async () => {
			// Create tag and switch to it
			await helpers.taskMaster('add-tag', ['feature'], { cwd: testDir });
			await helpers.taskMaster('use-tag', ['feature'], { cwd: testDir });

			// Create parent task in feature tag
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Feature task', '--description', 'A feature task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			// Add subtask to feature tag
			const result = await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentId,
					'--title',
					'Feature subtask',
					'--tag',
					'feature',
					'--skip-generate'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify subtask is in feature tag
			const showResult = await helpers.taskMaster(
				'show',
				[parentId, '--tag', 'feature'],
				{ cwd: testDir }
			);
			expect(showResult.stdout).toContain('Feature'); // Truncated title

			// Verify master tag is unaffected
			await helpers.taskMaster('use-tag', ['master'], { cwd: testDir });
			const masterList = await helpers.taskMaster('list', [], { cwd: testDir });
			expect(masterList.stdout).not.toContain('Feature subtask');
		});
	});

	describe('Output format', () => {
		it('should create subtask successfully with standard output', async () => {
			// Create parent task
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'A parent task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			const result = await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentId,
					'--title',
					'Standard subtask',
					'--skip-generate'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Creating new subtask');
			expect(result.stdout).toContain('successfully created');
		});

		it('should display success box with next steps', async () => {
			// Create parent task
			const parent = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'A parent task'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parent.stdout);

			const result = await helpers.taskMaster(
				'add-subtask',
				['--parent', parentId, '--title', 'Success subtask', '--skip-generate'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Next Steps:');
			expect(result.stdout).toContain('task-master show');
			expect(result.stdout).toContain('task-master set-status');
		});
	});
});
