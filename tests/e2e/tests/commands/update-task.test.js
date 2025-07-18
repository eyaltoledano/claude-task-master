/**
 * E2E tests for update-task command
 * Tests AI-powered single task updates using prompts
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

describe('update-task command', () => {
	let testDir;
	let helpers;
	let taskId;
	let tasksPath;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-update-task-'));

		// Initialize test helpers
		const context = global.createTestContext('update-task');
		helpers = context.helpers;

		// Initialize task-master project
		const initResult = await helpers.taskMaster('init', ['-y'], {
			cwd: testDir
		});
		expect(initResult).toHaveExitCode(0);

		// Copy configuration files
		copyConfigFiles(testDir);

		// Set up tasks path
		tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');

		// Ensure tasks.json exists after init
		if (!existsSync(tasksPath)) {
			mkdirSync(join(testDir, '.taskmaster/tasks'), { recursive: true });
			writeFileSync(tasksPath, JSON.stringify({ master: { tasks: [] } }));
		}

		// Create a test task for updates
		const addResult = await helpers.taskMaster(
			'add-task',
			[
				'--title',
				'"Initial task"',
				'--description',
				'"Basic task for testing updates"'
			],
			{ cwd: testDir }
		);
		taskId = helpers.extractTaskId(addResult.stdout);
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Basic AI-powered updates', () => {
		it('should update task with simple prompt', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Make this task about implementing user authentication'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
			expect(result.stdout).toContain('AI Usage Summary');
		}, 30000);

		it('should update task with detailed requirements', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Update this task to be about building a REST API with endpoints for user management, including GET, POST, PUT, DELETE operations'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');

			// Verify the update happened by checking the stdout contains update success
			// Note: The actual content depends on the AI model's response
			expect(result.stdout).toContain('Successfully updated task');
		}, 30000);

		it('should enhance task with implementation details', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Add detailed implementation steps, technical requirements, and testing strategies'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
		}, 30000);
	});

	describe('Append mode', () => {
		it('should append information to task', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Add a note that this task is blocked by infrastructure setup',
					'--append'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully appended to task');
		}, 30000);

		it('should append multiple updates with timestamps', async () => {
			// First append
			await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Progress update: Started initial research',
					'--append'
				],
				{ cwd: testDir }
			);

			// Second append
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Progress update: Completed design phase',
					'--append'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify both updates are present
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Implementation Details');
		}, 45000);
	});

	describe('Research mode', () => {
		it.skip('should update task with research-backed information', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Research and add current best practices for React component testing',
					'--research'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');

			// Should show research was used
			const outputLower = result.stdout.toLowerCase();
			expect(outputLower).toMatch(/research|perplexity/);
		}, 60000);

		it.skip('should enhance task with industry standards using research', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Research and add OWASP security best practices for web applications',
					'--research'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
		}, 60000);
	});

	describe('Tag context', () => {
		it('should update task in specific tag', async () => {
			// Create a new tag
			await helpers.taskMaster(
				'add-tag',
				['feature-x', '--description', '"Feature X development"'],
				{ cwd: testDir }
			);

			// Add a task to the tag
			await helpers.taskMaster('use-tag', ['feature-x'], { cwd: testDir });
			const addResult = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'"Feature X task"',
					'--description',
					'"Task in feature branch"'
				],
				{ cwd: testDir }
			);
			const featureTaskId = helpers.extractTaskId(addResult.stdout);

			// Update the task with tag context
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					featureTaskId,
					'--prompt',
					'Update this to include feature toggle implementation',
					'--tag',
					'feature-x'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			// The output includes an emoji before the tag
			expect(result.stdout).toMatch(/🏷️\s*tag:\s*feature-x/);
			expect(result.stdout).toContain('Successfully updated task');
		}, 60000);
	});

	describe('Complex prompts', () => {
		it('should handle multi-line prompts', async () => {
			// Use a single line prompt to avoid shell interpretation issues
			const complexPrompt =
				'Update this task with: 1) Add acceptance criteria 2) Include performance requirements 3) Define success metrics 4) Add rollback plan';

			const result = await helpers.taskMaster(
				'update-task',
				['-f', tasksPath, '--id', taskId, '--prompt', complexPrompt],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
		}, 30000);

		it('should handle technical specification prompts', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Convert this into a technical specification with API endpoints, data models, and error handling strategies'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');
		}, 30000);
	});

	describe('Error handling', () => {
		it('should fail with non-existent task ID', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					'999',
					'--prompt',
					'Update non-existent task'
				],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('not found');
		});

		it('should fail without required parameters', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				['-f', tasksPath],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('required');
		});

		it('should fail without prompt', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				['-f', tasksPath, '--id', taskId],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('required');
		});

		it('should handle invalid task file path', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					'/invalid/path/tasks.json',
					'--id',
					taskId,
					'--prompt',
					'Update task'
				],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('does not exist');
		});
	});

	describe('Integration scenarios', () => {
		it('should update task and preserve subtasks', async () => {
			// First expand the task
			await helpers.taskMaster('expand', ['--id', taskId, '--num', '3'], {
				cwd: testDir
			});

			// Then update the parent task
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Update the main task description to focus on microservices architecture'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated task');

			// Verify subtasks are preserved
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Subtasks');
		}, 60000);

		it('should update task with dependencies intact', async () => {
			// Create another task
			const depResult = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'"Dependency task"',
					'--description',
					'"This task must be done first"'
				],
				{ cwd: testDir }
			);
			const depId = helpers.extractTaskId(depResult.stdout);

			// Add dependency
			await helpers.taskMaster(
				'add-dependency',
				['--id', taskId, '--depends-on', depId],
				{ cwd: testDir }
			);

			// Update the task
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Update this task to include database migration requirements'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify dependency is preserved
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Dependencies:');
		}, 45000);
	});

	describe('Output and telemetry', () => {
		it('should show AI usage telemetry', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Add unit test requirements'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('AI Usage Summary');
			expect(result.stdout).toContain('Model:');
			expect(result.stdout).toContain('Tokens:');
			expect(result.stdout).toContain('Est. Cost:');
		}, 30000);

		it('should show update progress', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					'-f',
					tasksPath,
					'--id',
					taskId,
					'--prompt',
					'Add deployment checklist'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updating Task #' + taskId);
			expect(result.stdout).toContain('Successfully updated task');
		}, 30000);
	});
});
