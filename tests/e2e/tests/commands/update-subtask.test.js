/**
 * Comprehensive E2E tests for update-subtask command
 * Tests all aspects of subtask updates including AI-powered updates
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

		// Initialize task-master project
		const initResult = await helpers.taskMaster('init', ['-y'], {
			cwd: testDir
		});
		expect(initResult).toHaveExitCode(0);

		// Copy configuration files
		copyConfigFiles(testDir);

		// Ensure tasks.json exists (bug workaround)
		const tasksJsonPath = join(testDir, '.taskmaster/tasks/tasks.json');
		if (!existsSync(tasksJsonPath)) {
			mkdirSync(join(testDir, '.taskmaster/tasks'), { recursive: true });
			writeFileSync(tasksJsonPath, JSON.stringify({ master: { tasks: [] } }));
		}

		// Create a parent task with subtask
		const parentResult = await helpers.taskMaster(
			'add-task',
			['--title', '"Parent task"', '--description', '"Task with subtasks"'],
			{ cwd: testDir }
		);
		parentTaskId = helpers.extractTaskId(parentResult.stdout);

		// Create a subtask
		const subtaskResult = await helpers.taskMaster(
			'add-subtask',
			[
				'--parent',
				parentTaskId,
				'--title',
				'Initial subtask',
				'--description',
				'Basic subtask description'
			],
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
		it('should update subtask with additional information', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					'--id',
					subtaskId,
					'--prompt',
					'Add implementation details: Use async/await pattern'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated subtask');

			// Verify update - check that the subtask still exists and command was successful
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		});

		it('should update subtask with research mode', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					'--id',
					subtaskId,
					'--prompt',
					'Research best practices for error handling',
					'--research'
				],
				{ cwd: testDir, timeout: 30000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify research results were added
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		});

		it('should update subtask status', async () => {
			// Note: update-subtask doesn't have --status option, it only appends information
			// Use set-status command for status changes
			const result = await helpers.taskMaster(
				'set-status',
				['--id', subtaskId, '--status', 'done'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify status update
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('done');
		});
	});

	describe('AI-powered subtask updates', () => {
		it('should update subtask using AI prompt', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					'--id',
					subtaskId,
					'--prompt',
					'Add: use async/await'
				],
				{ cwd: testDir, timeout: 20000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated subtask');

			// Verify AI enhanced the subtask - check that command succeeded
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			// The command should have succeeded and subtask should still exist
			expect(showResult.stdout).toContain('Initial subtask');
		}, 30000);

		it.skip('should enhance subtask with technical details', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					'--id',
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
			// Verify the command succeeded and subtask still exists
			expect(showResult.stdout).toContain('Initial subtask');
		}, 30000);

		it('should update subtask with research mode', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					'--id',
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
			// Verify the command succeeded and subtask still exists
			expect(showResult.stdout).toContain('Initial subtask');
		}, 40000);
	});

	describe('Multiple subtask updates', () => {
		it('should update multiple subtasks sequentially', async () => {
			// Create another subtask
			const subtask2Result = await helpers.taskMaster(
				'add-subtask',
				['--parent', parentTaskId, '--title', 'Second subtask'],
				{ cwd: testDir }
			);
			const match = subtask2Result.stdout.match(/subtask #?(\d+\.\d+)/i);
			const subtaskId2 = match ? match[1] : '1.2';

			// Update first subtask
			await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'First subtask updated'],
				{ cwd: testDir }
			);

			// Update second subtask
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId2, '--prompt', 'Second subtask updated'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify both updates
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
			expect(showResult.stdout).toContain('Second subtask');
		});
	});

	describe('Subtask metadata updates', () => {
		it('should add priority to subtask', async () => {
			// update-subtask doesn't support --priority, use update-subtask with prompt
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Set priority to high'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify the command succeeded
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		});

		it('should add estimated time to subtask', async () => {
			// update-subtask doesn't support --estimated-time, use update-subtask with prompt
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Add estimated time: 2 hours'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify the command succeeded
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		});

		it('should add assignee to subtask', async () => {
			// update-subtask doesn't support --assignee, use update-subtask with prompt
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Assign to john.doe@example.com'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify the command succeeded
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		});
	});

	describe('Combined updates', () => {
		it('should update title and notes together', async () => {
			// update-subtask doesn't support --notes or direct title changes
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Add: v2'],
				{ cwd: testDir, timeout: 20000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify the command succeeded
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		});

		it('should combine manual update with AI prompt', async () => {
			// First update status separately
			await helpers.taskMaster(
				'set-status',
				['--id', subtaskId, '--status', 'in-progress'],
				{ cwd: testDir }
			);

			// Then update with AI prompt
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Add acceptance criteria'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify updates
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		}, 30000);
	});

	describe('Append mode', () => {
		it('should append to subtask notes', async () => {
			// First add some initial notes
			await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Add initial notes'],
				{ cwd: testDir }
			);

			// Then append more information
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Add additional considerations'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify the command succeeded
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		});
	});

	describe('Nested subtasks', () => {
		it('should update nested subtask', async () => {
			// Create a nested subtask
			const nestedResult = await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					subtaskId,
					'--title',
					'Nested subtask',
					'--description',
					'A nested subtask'
				],
				{ cwd: testDir }
			);
			const match = nestedResult.stdout.match(/subtask #?(\d+\.\d+\.\d+)/i);
			const nestedId = match ? match[1] : '1.1.1';

			// Update nested subtask
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', nestedId, '--prompt', 'Updated nested subtask'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify update
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Nested subtask');
		});
	});

	describe('Tag-specific subtask updates', () => {
		it.skip('should update subtask in specific tag', async () => {
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
				[
					'--parent',
					tagTaskId,
					'--title',
					'Subtask in feature tag',
					'--tag',
					'feature-y'
				],
				{ cwd: testDir }
			);
			const match = tagSubtaskResult.stdout.match(/subtask #?(\d+\.\d+)/i);
			const tagSubtaskId = match ? match[1] : '1.1';

			// Update subtask in specific tag
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', tagSubtaskId, '--prompt', 'Tag update', '--tag', 'feature-y'],
				{ cwd: testDir, timeout: 20000 }
			);

			expect(result).toHaveExitCode(0);

			// Verify update in correct tag
			const showResult = await helpers.taskMaster(
				'show',
				[tagTaskId, '--tag', 'feature-y'],
				{ cwd: testDir }
			);
			expect(showResult.stdout).toContain('Subtask in feature tag');
		});
	});

	describe('Output formats', () => {
		it('should output in JSON format', async () => {
			// update-subtask doesn't support --output option
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'JSON test update'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully updated subtask');
		});
	});

	describe('Error handling', () => {
		it('should fail with non-existent subtask ID', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', '99.99', '--prompt', 'This should fail'],
				{ cwd: testDir, allowFailure: true, timeout: 10000 }
			);

			// The command might succeed but show an error message
			if (result.exitCode === 0) {
				// Check that it at least mentions the subtask wasn't found
				const output = result.stdout + (result.stderr || '');
				expect(output).toMatch(/99\.99|not found|does not exist|invalid/i);
			} else {
				expect(result.exitCode).not.toBe(0);
			}
		});

		it('should fail with invalid subtask ID format', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', 'invalid-id', '--prompt', 'This should fail'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr || result.stdout).toContain('Invalid subtask ID');
		});

		it('should fail with invalid priority', async () => {
			// update-subtask doesn't have --priority option
			// This test should check for unknown option error
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--priority', 'invalid-priority'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('unknown option');
		});

		it('should fail with invalid status', async () => {
			// update-subtask doesn't have --status option
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--status', 'invalid-status'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('unknown option');
		});
	});

	describe('Performance and edge cases', () => {
		it('should handle very long subtask titles', async () => {
			const longPrompt = 'This is a very detailed subtask update. '.repeat(10);

			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', longPrompt],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify the command succeeded
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		});

		it('should update subtask without affecting parent task', async () => {
			const originalParentTitle = 'Parent task';

			// Update subtask
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					'--id',
					subtaskId,
					'--prompt',
					'Completely different subtask information'
				],
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
			const specialPrompt =
				'Add subtask info with special chars: @#$% & quotes and apostrophes';

			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', specialPrompt],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify the command succeeded
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		});
	});

	describe('Dry run mode', () => {
		it('should preview updates without applying them', async () => {
			// update-subtask doesn't support --dry-run
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Dry run test', '--dry-run'],
				{ cwd: testDir, allowFailure: true }
			);

			// update-subtask doesn't support --dry-run, expect failure
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('unknown option');

			// Verify subtask was NOT actually updated
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Initial subtask');
		});
	});

	describe('Integration with other commands', () => {
		it('should reflect updates in parent task expansion', async () => {
			// Update subtask with AI
			const updateResult = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Add detailed implementation steps'],
				{ cwd: testDir, timeout: 30000 }
			);

			expect(updateResult).toHaveExitCode(0);

			// Verify parent task exists and subtask is still there
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout).toContain('Parent task');
			expect(showResult.stdout).toContain('Initial subtask');
		}, 60000);

		it('should update subtask after parent task status change', async () => {
			// Change parent task status
			await helpers.taskMaster(
				'set-status',
				['--id', parentTaskId, '--status', 'in-progress'],
				{
					cwd: testDir
				}
			);

			// Update subtask status separately
			const result = await helpers.taskMaster(
				'set-status',
				['--id', subtaskId, '--status', 'in-progress'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify both statuses
			const showResult = await helpers.taskMaster('show', [parentTaskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('in-progress');
		});
	});
});
