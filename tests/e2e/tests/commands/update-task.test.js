/**
 * Comprehensive E2E tests for update-task command (single task update)
 * Tests all aspects of single task updates including AI-powered updates
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

describe('update-task command', () => {
	let testDir;
	let helpers;
	let taskId;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-update-task-'));

		// Initialize test helpers
		const context = global.createTestContext('update-task');
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

		// Create a test task for updates
		const addResult = await helpers.taskMaster(
			'add-task',
			['--title', 'Initial task', '--description', 'Task to be updated'],
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

	describe('Basic task updates', () => {
		it('should update task description', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--description', 'Updated task description with more details'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updated task');

			// Verify update
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Updated task description');
		});

		it('should update task title', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--title', 'Completely new title'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify update
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Completely new title');
		});

		it('should update task priority', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--priority', 'high'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify update
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('high');
		});

		it('should update task details', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--details', 'Implementation notes: Use async/await pattern'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify update
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('async/await');
		});
	});

	describe('AI-powered updates', () => {
		it('should update task using AI prompt', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--prompt', 'Add security considerations and best practices'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updated task');

			// Verify AI added security content
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			const hasSecurityInfo =
				showResult.stdout.toLowerCase().includes('security') ||
				showResult.stdout.toLowerCase().includes('practice');
			expect(hasSecurityInfo).toBe(true);
		}, 60000);

		it('should enhance task with AI suggestions', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					taskId,
					'--prompt',
					'Break this down into subtasks and add implementation details'
				],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Check that task was enhanced
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			const updatedTask = tasks.master.tasks.find(
				(t) => t.id === parseInt(taskId)
			);

			// Should have more detailed content
			expect(updatedTask.details.length).toBeGreaterThan(50);
		}, 60000);

		it('should update task with research mode', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					taskId,
					'--prompt',
					'Add current industry best practices for authentication',
					'--research'
				],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);

			// Research mode should add comprehensive content
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout.length).toBeGreaterThan(500);
		}, 120000);
	});

	describe('Multiple field updates', () => {
		it('should update multiple fields at once', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					taskId,
					'--title',
					'New comprehensive title',
					'--description',
					'New detailed description',
					'--priority',
					'high',
					'--details',
					'Additional implementation notes'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify all updates
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('New comprehensive title');
			expect(showResult.stdout).toContain('New detailed description');
			expect(showResult.stdout.toLowerCase()).toContain('high');
			expect(showResult.stdout).toContain('Additional implementation notes');
		});

		it('should combine manual updates with AI prompt', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					taskId,
					'--priority',
					'high',
					'--prompt',
					'Add technical requirements and dependencies'
				],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify both manual and AI updates
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('high');
			const hasTechnicalInfo =
				showResult.stdout.toLowerCase().includes('requirement') ||
				showResult.stdout.toLowerCase().includes('dependenc');
			expect(hasTechnicalInfo).toBe(true);
		}, 60000);
	});

	describe('Task metadata updates', () => {
		it('should add tags to task', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--add-tags', 'backend,api,urgent'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify tags were added
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('backend');
			expect(showResult.stdout).toContain('api');
			expect(showResult.stdout).toContain('urgent');
		});

		it('should remove tags from task', async () => {
			// First add tags
			await helpers.taskMaster(
				'update-task',
				[taskId, '--add-tags', 'frontend,ui,design'],
				{ cwd: testDir }
			);

			// Then remove some
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--remove-tags', 'ui,design'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify tags were removed
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('frontend');
			expect(showResult.stdout).not.toContain('ui');
			expect(showResult.stdout).not.toContain('design');
		});

		it('should update due date', async () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 7);
			const dateStr = futureDate.toISOString().split('T')[0];

			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--due-date', dateStr],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify due date was set
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain(dateStr);
		});

		it('should update estimated time', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--estimated-time', '4h'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify estimated time was set
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('4h');
		});
	});

	describe('Status updates', () => {
		it('should update task status', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--status', 'in_progress'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify status change
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('in_progress');
		});

		it('should mark task as completed', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--status', 'completed'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify completion
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('completed');
		});

		it('should mark task as blocked with reason', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					taskId,
					'--status',
					'blocked',
					'--blocked-reason',
					'Waiting for API access'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify blocked status and reason
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('blocked');
			expect(showResult.stdout).toContain('Waiting for API access');
		});
	});

	describe('Append mode', () => {
		it('should append to description', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--append-description', '\nAdditional requirements added.'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify description was appended
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Task to be updated');
			expect(showResult.stdout).toContain('Additional requirements added');
		});

		it('should append to details', async () => {
			// First set some details
			await helpers.taskMaster(
				'update-task',
				[taskId, '--details', 'Initial implementation notes.'],
				{ cwd: testDir }
			);

			// Then append
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--append-details', '\nPerformance considerations added.'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify details were appended
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial implementation notes');
			expect(showResult.stdout).toContain('Performance considerations added');
		});
	});

	describe('Tag-specific updates', () => {
		it('should update task in specific tag', async () => {
			// Create a tag and move task to it
			await helpers.taskMaster('add-tag', ['feature-x'], { cwd: testDir });
			await helpers.taskMaster(
				'add-task',
				['--prompt', 'Task in feature-x', '--tag', 'feature-x'],
				{ cwd: testDir }
			);

			// Get task ID from feature-x tag
			const listResult = await helpers.taskMaster(
				'list',
				['--tag', 'feature-x'],
				{ cwd: testDir }
			);
			const featureTaskId = helpers.extractTaskId(listResult.stdout);

			// Update task in specific tag
			const result = await helpers.taskMaster(
				'update-task',
				[
					featureTaskId,
					'--description',
					'Updated in feature tag',
					'--tag',
					'feature-x'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify update in correct tag
			const showResult = await helpers.taskMaster(
				'show',
				[featureTaskId, '--tag', 'feature-x'],
				{ cwd: testDir }
			);
			expect(showResult.stdout).toContain('Updated in feature tag');
		});
	});

	describe('Output formats', () => {
		it('should output in JSON format', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--description', 'JSON test update', '--output', 'json'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Output should be valid JSON
			const jsonOutput = JSON.parse(result.stdout);
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.task).toBeDefined();
			expect(jsonOutput.task.description).toBe('JSON test update');
		});
	});

	describe('Error handling', () => {
		it('should fail with non-existent task ID', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				['99999', '--description', 'This should fail'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('not found');
		});

		it('should fail with invalid priority', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--priority', 'invalid-priority'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid priority');
		});

		it('should fail with invalid status', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--status', 'invalid-status'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid status');
		});

		it('should fail without any update parameters', async () => {
			const result = await helpers.taskMaster('update-task', [taskId], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('No updates specified');
		});
	});

	describe('Performance and edge cases', () => {
		it('should handle very long descriptions', async () => {
			const longDescription = 'This is a very detailed description. '.repeat(
				50
			);

			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--description', longDescription],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify long description was saved
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			const updatedTask = tasks.master.tasks.find(
				(t) => t.id === parseInt(taskId)
			);
			expect(updatedTask.description).toBe(longDescription);
		});

		it('should preserve task relationships during updates', async () => {
			// Add a dependency
			const depResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Dependency task', '--description', 'Must be done first'],
				{ cwd: testDir }
			);
			const depId = helpers.extractTaskId(depResult.stdout);

			await helpers.taskMaster(
				'add-dependency',
				['--id', taskId, '--depends-on', depId],
				{ cwd: testDir }
			);

			// Update the task
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--description', 'Updated with dependencies intact'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify dependency is preserved
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain(depId);
		});
	});

	describe('Dry run mode', () => {
		it('should preview updates without applying them', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[taskId, '--description', 'Dry run test', '--dry-run'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('DRY RUN');
			expect(result.stdout).toContain('Would update');

			// Verify task was NOT actually updated
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout).not.toContain('Dry run test');
		});
	});

	describe('Integration with other commands', () => {
		it('should work with expand after update', async () => {
			// Update task with AI
			await helpers.taskMaster(
				'update-task',
				[taskId, '--prompt', 'Add implementation steps'],
				{ cwd: testDir, timeout: 45000 }
			);

			// Then expand it
			const expandResult = await helpers.taskMaster(
				'expand',
				['--id', taskId],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(expandResult).toHaveExitCode(0);
			expect(expandResult.stdout).toContain('Expanded task');
		}, 90000);
	});
});
