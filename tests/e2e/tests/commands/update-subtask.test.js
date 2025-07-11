/**
 * Comprehensive E2E tests for update-subtask command
 * Tests all aspects of subtask updates including AI-powered updates
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

describe('update-subtask command', () => {
	let testDir;
	let helpers;
	let parentTaskId;
	let subtaskId;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-update-subtask-'));

		// Initialize test helpers
		const context = global.createTestContext('update-subtask');
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

		// Create a parent task with subtask
		const parentResult = await helpers.taskMaster(
			'add-task',
			['--title', 'Parent task', '--description', 'Task with subtasks'],
			{ cwd: testDir }
		);
		parentTaskId = helpers.extractTaskId(parentResult.stdout);

		// Create a subtask
		const subtaskResult = await helpers.taskMaster(
			'add-subtask',
			[parentTaskId, 'Initial subtask'],
			{ cwd: testDir }
		);
		// Extract subtask ID (should be like "1.1")
		const match = subtaskResult.stdout.match(/subtask #?(\d+\.\d+)/i);
		subtaskId = match ? match[1] : '1.1';
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Basic subtask updates', () => {
		it('should update subtask title', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, 'Updated subtask title'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updated subtask');

			// Verify update
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Updated subtask title');
		});

		it('should update subtask with additional notes', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--notes', 'Implementation details: Use async/await'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify notes were added
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('async/await');
		});

		it('should update subtask status', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--status', 'completed'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify status update
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('completed');
		});
	});

	describe('AI-powered subtask updates', () => {
		it('should update subtask using AI prompt', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--prompt', 'Add implementation steps and best practices'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Updated subtask');

			// Verify AI enhanced the subtask
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			const parentTask = tasks.master.tasks.find(
				(t) => t.id === parseInt(parentTaskId)
			);
			const subtask = parentTask.subtasks.find((s) => s.id === subtaskId);

			// Should have more detailed content
			expect(subtask.title.length).toBeGreaterThan(20);
		}, 60000);

		it('should enhance subtask with technical details', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					subtaskId,
					'--prompt',
					'Add technical requirements and edge cases to consider'
				],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Check that subtask was enhanced
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			const hasEnhancement =
				showResult.stdout.toLowerCase().includes('requirement') ||
				showResult.stdout.toLowerCase().includes('edge case') ||
				showResult.stdout.toLowerCase().includes('consider');
			expect(hasEnhancement).toBe(true);
		}, 60000);

		it('should update subtask with research mode', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					subtaskId,
					'--prompt',
					'Add industry best practices for error handling',
					'--research'
				],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);

			// Research mode should add comprehensive content
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			const hasResearchContent =
				showResult.stdout.toLowerCase().includes('error') ||
				showResult.stdout.toLowerCase().includes('handling') ||
				showResult.stdout.toLowerCase().includes('practice');
			expect(hasResearchContent).toBe(true);
		}, 120000);
	});

	describe('Multiple subtask updates', () => {
		it('should update multiple subtasks sequentially', async () => {
			// Create another subtask
			const subtask2Result = await helpers.taskMaster(
				'add-subtask',
				[parentTaskId, 'Second subtask'],
				{ cwd: testDir }
			);
			const match = subtask2Result.stdout.match(/subtask #?(\d+\.\d+)/i);
			const subtaskId2 = match ? match[1] : '1.2';

			// Update first subtask
			await helpers.taskMaster(
				'update-subtask',
				[subtaskId, 'First subtask updated'],
				{ cwd: testDir }
			);

			// Update second subtask
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId2, 'Second subtask updated'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify both updates
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('First subtask updated');
			expect(showResult.stdout).toContain('Second subtask updated');
		});
	});

	describe('Subtask metadata updates', () => {
		it('should add priority to subtask', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--priority', 'high'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify priority was set
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('high');
		});

		it('should add estimated time to subtask', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--estimated-time', '2h'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify estimated time was set
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('2h');
		});

		it('should add assignee to subtask', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--assignee', 'john.doe@example.com'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify assignee was set
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('john.doe');
		});
	});

	describe('Combined updates', () => {
		it('should update title and notes together', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					subtaskId,
					'New comprehensive title',
					'--notes',
					'Additional implementation details'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify both updates
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('New comprehensive title');
			expect(showResult.stdout).toContain('Additional implementation details');
		});

		it('should combine manual update with AI prompt', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					subtaskId,
					'--status',
					'in_progress',
					'--prompt',
					'Add acceptance criteria'
				],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify both manual and AI updates
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('in_progress');
			const hasAcceptanceCriteria =
				showResult.stdout.toLowerCase().includes('acceptance') ||
				showResult.stdout.toLowerCase().includes('criteria');
			expect(hasAcceptanceCriteria).toBe(true);
		}, 60000);
	});

	describe('Append mode', () => {
		it('should append to subtask notes', async () => {
			// First set some notes
			await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--notes', 'Initial notes.'],
				{ cwd: testDir }
			);

			// Then append
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--append-notes', '\nAdditional considerations.'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify notes were appended
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial notes');
			expect(showResult.stdout).toContain('Additional considerations');
		});
	});

	describe('Nested subtasks', () => {
		it('should update nested subtask', async () => {
			// Create a nested subtask
			const nestedResult = await helpers.taskMaster(
				'add-subtask',
				[subtaskId, 'Nested subtask'],
				{ cwd: testDir }
			);
			const match = nestedResult.stdout.match(/subtask #?(\d+\.\d+\.\d+)/i);
			const nestedId = match ? match[1] : '1.1.1';

			// Update nested subtask
			const result = await helpers.taskMaster(
				'update-subtask',
				[nestedId, 'Updated nested subtask'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify update
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Updated nested subtask');
		});
	});

	describe('Tag-specific subtask updates', () => {
		it('should update subtask in specific tag', async () => {
			// Create a tag and add task to it
			await helpers.taskMaster('add-tag', ['feature-y'], { cwd: testDir });

			// Create task in tag
			const tagTaskResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Task in feature-y', '--tag', 'feature-y'],
				{ cwd: testDir }
			);
			const tagTaskId = helpers.extractTaskId(tagTaskResult.stdout);

			// Add subtask to tagged task
			const tagSubtaskResult = await helpers.taskMaster(
				'add-subtask',
				[tagTaskId, 'Subtask in feature tag'],
				{ cwd: testDir, options: ['--tag', 'feature-y'] }
			);
			const match = tagSubtaskResult.stdout.match(/subtask #?(\d+\.\d+)/i);
			const tagSubtaskId = match ? match[1] : '1.1';

			// Update subtask in specific tag
			const result = await helpers.taskMaster(
				'update-subtask',
				[tagSubtaskId, 'Updated in feature tag', '--tag', 'feature-y'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify update in correct tag
			const showResult = await helpers.taskMaster(
				'show',
				[tagTaskId, '--tag', 'feature-y'],
				{ cwd: testDir }
			);
			expect(showResult.stdout).toContain('Updated in feature tag');
		});
	});

	describe('Output formats', () => {
		it('should output in JSON format', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, 'JSON test update', '--output', 'json'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Output should be valid JSON
			const jsonOutput = JSON.parse(result.stdout);
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.subtask).toBeDefined();
			expect(jsonOutput.subtask.title).toBe('JSON test update');
			expect(jsonOutput.parentTaskId).toBe(parseInt(parentTaskId));
		});
	});

	describe('Error handling', () => {
		it('should fail with non-existent subtask ID', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				['99.99', 'This should fail'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('not found');
		});

		it('should fail with invalid subtask ID format', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				['invalid-id', 'This should fail'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid subtask ID');
		});

		it('should fail with invalid priority', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--priority', 'invalid-priority'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid priority');
		});

		it('should fail with invalid status', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--status', 'invalid-status'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid status');
		});
	});

	describe('Performance and edge cases', () => {
		it('should handle very long subtask titles', async () => {
			const longTitle = 'This is a very detailed subtask title. '.repeat(10);

			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, longTitle],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify long title was saved
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			const parentTask = tasks.master.tasks.find(
				(t) => t.id === parseInt(parentTaskId)
			);
			const subtask = parentTask.subtasks.find((s) => s.id === subtaskId);
			expect(subtask.title).toBe(longTitle);
		});

		it('should update subtask without affecting parent task', async () => {
			const originalParentTitle = 'Parent task';

			// Update subtask
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, 'Completely different subtask'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify parent task remains unchanged
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain(originalParentTitle);
		});

		it('should handle subtask updates with special characters', async () => {
			const specialTitle =
				'Subtask with special chars: @#$% & "quotes" \'apostrophes\'';

			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, specialTitle],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify special characters were preserved
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('@#$%');
		});
	});

	describe('Dry run mode', () => {
		it('should preview updates without applying them', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, 'Dry run test', '--dry-run'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('DRY RUN');
			expect(result.stdout).toContain('Would update');

			// Verify subtask was NOT actually updated
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).not.toContain('Dry run test');
			expect(showResult.stdout).toContain('Initial subtask');
		});
	});

	describe('Integration with other commands', () => {
		it('should reflect updates in parent task expansion', async () => {
			// Update subtask with AI
			await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--prompt', 'Add detailed implementation steps'],
				{ cwd: testDir, timeout: 45000 }
			);

			// Expand parent task
			const expandResult = await helpers.taskMaster(
				'expand',
				['--id', parentTaskId],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(expandResult).toHaveExitCode(0);
			expect(expandResult.stdout).toContain('Expanded task');

			// Should include updated subtask information
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			const hasImplementationSteps =
				showResult.stdout.toLowerCase().includes('implementation') ||
				showResult.stdout.toLowerCase().includes('step');
			expect(hasImplementationSteps).toBe(true);
		}, 90000);

		it('should update subtask after parent task status change', async () => {
			// Change parent task status
			await helpers.taskMaster('set-status', [parentTaskId, 'in_progress'], {
				cwd: testDir
			});

			// Update subtask
			const result = await helpers.taskMaster(
				'update-subtask',
				[subtaskId, '--status', 'in_progress'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify both statuses
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('in_progress');
		});
	});
});
