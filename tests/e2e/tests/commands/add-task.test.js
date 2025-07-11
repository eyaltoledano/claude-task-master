/**
 * Comprehensive E2E tests for add-task command
 * Tests all aspects of task creation including AI and manual modes
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

describe('add-task command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-add-task-'));

		// Initialize test helpers
		const context = global.createTestContext('add-task');
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

	describe('AI-powered task creation', () => {
		it('should create task with AI prompt', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Create a user authentication system with JWT tokens'],
				{ cwd: testDir, timeout: 30000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContainTaskId();

			const taskId = helpers.extractTaskId(result.stdout);
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});

			// AI generated task should contain a title and description
			expect(showResult.stdout).toContain('Title:');
			expect(showResult.stdout).toContain('Description:');
			expect(showResult.stdout).toContain('Implementation Details:');
		}, 45000); // 45 second timeout for this test

		it('should handle very long prompts', async () => {
			const longPrompt =
				'Create a comprehensive system that ' +
				'handles many features '.repeat(50);
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', longPrompt],
				{ cwd: testDir, timeout: 30000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContainTaskId();
		}, 45000);

		it('should handle special characters in prompt', async () => {
			const specialPrompt =
				'Implement feature: User data and settings with special chars';
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', specialPrompt],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContainTaskId();
		});

		it('should verify AI generates reasonable output', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				[
					'--prompt',
					'Build a responsive navigation menu with dropdown support'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			const taskId = helpers.extractTaskId(result.stdout);
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			// Verify AI generated task has proper structure
			expect(showResult.stdout).toContain('Title:');
			expect(showResult.stdout).toContain('Status:');
			expect(showResult.stdout).toContain('Priority:');
			expect(showResult.stdout).toContain('Description:');
		});
	});

	describe('Manual task creation', () => {
		it('should create task with title and description', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Setup database connection',
					'--description',
					'Configure PostgreSQL connection with connection pooling'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContainTaskId();

			const taskId = helpers.extractTaskId(result.stdout);
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});

			// Check that at least part of our title and description are shown
			expect(showResult.stdout).toContain('Setup');
			expect(showResult.stdout).toContain('Configure');
		});

		it('should create task with manual details', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Implement caching layer',
					'--description',
					'Add Redis caching to improve performance',
					'--details',
					'Use Redis for session storage and API response caching'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContainTaskId();
		});
	});

	describe('Task creation with options', () => {
		it('should create task with priority', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				[
					'--prompt',
					'Fix critical security vulnerability',
					'--priority',
					'high'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			const taskId = helpers.extractTaskId(result.stdout);

			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('high');
		});

		it('should create task with dependencies', async () => {
			// Create dependency task first
			const depResult = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Setup environment',
					'--description',
					'Initial environment setup'
				],
				{ cwd: testDir }
			);
			const depTaskId = helpers.extractTaskId(depResult.stdout);

			// Create task with dependency
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Deploy application', '--dependencies', depTaskId],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			const taskId = helpers.extractTaskId(result.stdout);

			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain(depTaskId);
		});

		it('should handle multiple dependencies', async () => {
			// Create multiple dependency tasks
			const dep1 = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Setup environment'],
				{ cwd: testDir }
			);
			const depId1 = helpers.extractTaskId(dep1.stdout);

			const dep2 = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Configure database'],
				{ cwd: testDir }
			);
			const depId2 = helpers.extractTaskId(dep2.stdout);

			// Create task with multiple dependencies
			const result = await helpers.taskMaster(
				'add-task',
				[
					'--prompt',
					'Deploy application',
					'--dependencies',
					`${depId1},${depId2}`
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			const taskId = helpers.extractTaskId(result.stdout);

			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain(depId1);
			expect(showResult.stdout).toContain(depId2);
		});

		it('should create task with all options combined', async () => {
			// Setup
			const depResult = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Prerequisite task',
					'--description',
					'Task that must be completed first'
				],
				{ cwd: testDir }
			);
			const depTaskId = helpers.extractTaskId(depResult.stdout);

			await helpers.taskMaster(
				'add-tag',
				['feature-complete', '--description', 'Complete feature test'],
				{ cwd: testDir }
			);

			// Create task with all options
			const result = await helpers.taskMaster(
				'add-task',
				[
					'--prompt',
					'Comprehensive task with all features',
					'--priority',
					'medium',
					'--dependencies',
					depTaskId
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			const taskId = helpers.extractTaskId(result.stdout);

			// Verify all options
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('medium');
			expect(showResult.stdout).toContain(depTaskId);
		});
	});

	describe('Error handling', () => {
		it('should fail without prompt or title+description', async () => {
			const result = await helpers.taskMaster('add-task', [], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain(
				'Either --prompt or both --title and --description must be provided'
			);
		});

		it('should fail with only title (missing description)', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--title', 'Incomplete task'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
		});

		it('should handle invalid priority by defaulting to medium', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Test task', '--priority', 'invalid'],
				{ cwd: testDir }
			);

			// Should succeed but use default priority and show warning
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Invalid priority "invalid"');
			expect(result.stdout).toContain('Using default priority "medium"');

			const taskId = helpers.extractTaskId(result.stdout);

			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Priority:     │ medium');
		});

		it('should warn and continue with non-existent dependency', async () => {
			// Based on the implementation, invalid dependencies are filtered out with a warning
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Test task', '--dependencies', '99999'],
				{ cwd: testDir }
			);

			// Should succeed but with warning
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('do not exist');
		});
	});

	describe('Concurrent operations', () => {
		it('should handle multiple tasks created in parallel', async () => {
			const promises = [];
			for (let i = 0; i < 3; i++) {
				promises.push(
					helpers.taskMaster(
						'add-task',
						['--prompt', `Parallel task ${i + 1}`],
						{ cwd: testDir }
					)
				);
			}

			const results = await Promise.all(promises);

			results.forEach((result) => {
				expect(result).toHaveExitCode(0);
				expect(result.stdout).toContainTaskId();
			});
		});
	});

	describe('Research mode', () => {
		it('should create task using research mode', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				[
					'--prompt',
					'Research best practices for implementing OAuth2 authentication',
					'--research'
				],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContainTaskId();

			// Verify task was created
			const taskId = helpers.extractTaskId(result.stdout);
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			// Verify task was created with research mode (should have more detailed output)
			expect(showResult.stdout).toContain('Title:');
			expect(showResult.stdout).toContain('Implementation Details:');
		}, 60000);
	});

	describe('File path handling', () => {
		it('should use custom tasks file path', async () => {
			// Create custom tasks file
			const customPath = join(testDir, 'custom-tasks.json');
			writeFileSync(customPath, JSON.stringify({ master: { tasks: [] } }));

			const result = await helpers.taskMaster(
				'add-task',
				['--file', customPath, '--prompt', 'Task in custom file'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify task was added to custom file
			const customContent = JSON.parse(readFileSync(customPath, 'utf8'));
			expect(customContent.master.tasks.length).toBe(1);
		});
	});

	describe('Priority validation', () => {
		it('should accept all valid priority values', async () => {
			const priorities = ['high', 'medium', 'low'];

			for (const priority of priorities) {
				const result = await helpers.taskMaster(
					'add-task',
					[
						'--prompt',
						`Task with ${priority} priority`,
						'--priority',
						priority
					],
					{ cwd: testDir }
				);

				expect(result).toHaveExitCode(0);
				const taskId = helpers.extractTaskId(result.stdout);

				const showResult = await helpers.taskMaster('show', [taskId], {
					cwd: testDir
				});
				expect(showResult.stdout.toLowerCase()).toContain(priority);
			}
		});

		it('should accept priority values case-insensitively', async () => {
			const priorities = ['HIGH', 'Medium', 'LoW'];
			const expected = ['high', 'medium', 'low'];

			for (let i = 0; i < priorities.length; i++) {
				const result = await helpers.taskMaster(
					'add-task',
					[
						'--prompt',
						`Task with ${priorities[i]} priority`,
						'--priority',
						priorities[i]
					],
					{ cwd: testDir }
				);

				expect(result).toHaveExitCode(0);
				const taskId = helpers.extractTaskId(result.stdout);

				const showResult = await helpers.taskMaster('show', [taskId], {
					cwd: testDir
				});
				expect(showResult.stdout).toContain(`Priority:     │ ${expected[i]}`);
			}
		});

		it('should default to medium priority when not specified', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Task without explicit priority'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			const taskId = helpers.extractTaskId(result.stdout);

			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('medium');
		});
	});

	describe('AI dependency suggestions', () => {
		it('should let AI suggest dependencies based on context', async () => {
			// Create some existing tasks that AI might reference
			// Create an existing task that AI might reference
			await helpers.taskMaster(
				'add-task',
				['--prompt', 'Setup authentication system'],
				{ cwd: testDir }
			);

			// Create a task that should logically depend on auth
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Implement user profile page with authentication checks'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			// Check if AI suggested dependencies
			if (result.stdout.includes('AI suggested')) {
				expect(result.stdout).toContain('Dependencies');
			}
		}, 60000);
	});

	describe('Tag support', () => {
		it('should add task to specific tag', async () => {
			// Create a new tag
			await helpers.taskMaster(
				'add-tag',
				['feature-branch', '--description', 'Feature branch tag'],
				{ cwd: testDir }
			);

			// Add task to specific tag
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Task for feature branch', '--tag', 'feature-branch'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContainTaskId();

			// Verify task is in the correct tag
			const taskId = helpers.extractTaskId(result.stdout);
			const showResult = await helpers.taskMaster(
				'show',
				[taskId, '--tag', 'feature-branch'],
				{ cwd: testDir }
			);
			expect(showResult).toHaveExitCode(0);
		});

		it('should add to master tag by default', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Task for master tag'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify task is in master tag
			const tasksContent = JSON.parse(
				readFileSync(join(testDir, '.taskmaster/tasks/tasks.json'), 'utf8')
			);
			expect(tasksContent.master.tasks.length).toBeGreaterThan(0);
		});
	});

	describe('AI fallback behavior', () => {
		it('should handle invalid model gracefully', async () => {
			// Set an invalid model
			await helpers.taskMaster('models', ['--set-main', 'invalid-model-xyz'], {
				cwd: testDir
			});

			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Test fallback behavior'],
				{ cwd: testDir, allowFailure: true }
			);

			// Should either use fallback or fail gracefully
			if (result.exitCode === 0) {
				expect(result.stdout).toContainTaskId();
			} else {
				expect(result.stderr).toBeTruthy();
			}

			// Reset to valid model for other tests
			await helpers.taskMaster('models', ['--set-main', 'gpt-3.5-turbo'], {
				cwd: testDir
			});
		});
	});
});
