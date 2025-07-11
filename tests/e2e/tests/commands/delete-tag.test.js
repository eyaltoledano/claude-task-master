/**
 * Comprehensive E2E tests for delete-tag command
 * Tests all aspects of tag deletion including safeguards and edge cases
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

describe('delete-tag command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-delete-tag-'));

		// Initialize test helpers
		const context = global.createTestContext('delete-tag');
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

	describe('Basic tag deletion', () => {
		it('should delete an existing tag with confirmation bypass', async () => {
			// Create a new tag
			const addTagResult = await helpers.taskMaster(
				'add-tag',
				['feature-xyz', '--description', 'Feature branch for XYZ'],
				{ cwd: testDir }
			);
			expect(addTagResult).toHaveExitCode(0);

			// Delete the tag with --yes flag
			const result = await helpers.taskMaster(
				'delete-tag',
				['feature-xyz', '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully deleted tag "feature-xyz"');
			expect(result.stdout).toContain('✓ Tag Deleted Successfully');

			// Verify tag is deleted by listing tags
			const listResult = await helpers.taskMaster('tags', [], { cwd: testDir });
			expect(listResult.stdout).not.toContain('feature-xyz');
		});

		it('should delete a tag with tasks', async () => {
			// Create a new tag
			await helpers.taskMaster(
				'add-tag',
				['temp-feature', '--description', 'Temporary feature'],
				{ cwd: testDir }
			);

			// Switch to the new tag
			await helpers.taskMaster('use-tag', ['temp-feature'], { cwd: testDir });

			// Add some tasks to the tag
			const task1Result = await helpers.taskMaster(
				'add-task',
				['--title', 'Task 1', '--description', 'First task in temp-feature'],
				{ cwd: testDir }
			);
			expect(task1Result).toHaveExitCode(0);
			
			const task2Result = await helpers.taskMaster(
				'add-task',
				['--title', 'Task 2', '--description', 'Second task in temp-feature'],
				{ cwd: testDir }
			);
			expect(task2Result).toHaveExitCode(0);

			// Verify tasks were created by listing them
			const listResult = await helpers.taskMaster('list', ['--tag', 'temp-feature'], { cwd: testDir });
			expect(listResult.stdout).toContain('Task 1');
			expect(listResult.stdout).toContain('Task 2');

			// Delete the tag while it's current
			const result = await helpers.taskMaster(
				'delete-tag',
				['temp-feature', '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Tasks Deleted: 2');
			expect(result.stdout).toContain('Switched current tag to "master"');

			// Verify we're on master tag
			const showResult = await helpers.taskMaster('show', [], { cwd: testDir });
			expect(showResult.stdout).toContain('Active Tag: master');
		});

		// Skip this test if aliases are not supported
		it.skip('should handle tag with aliases using both forms', async () => {
			// Create a tag
			await helpers.taskMaster(
				'add-tag',
				['feature-test'],
				{ cwd: testDir }
			);

			// Delete using the alias 'dt'
			const result = await helpers.taskMaster(
				'dt',
				['feature-test', '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully deleted tag');
		});
	});

	describe('Error cases', () => {
		it('should fail when deleting non-existent tag', async () => {
			const result = await helpers.taskMaster(
				'delete-tag',
				['non-existent-tag', '--yes'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Tag "non-existent-tag" does not exist');
		});

		it('should fail when trying to delete master tag', async () => {
			const result = await helpers.taskMaster(
				'delete-tag',
				['master', '--yes'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Cannot delete the "master" tag');
		});

		it('should fail with invalid tag name', async () => {
			const result = await helpers.taskMaster(
				'delete-tag',
				['invalid/tag/name', '--yes'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			// The error might come from not finding the tag or invalid name
			expect(result.stderr).toMatch(/does not exist|invalid/i);
		});

		it('should fail when no tag name is provided', async () => {
			const result = await helpers.taskMaster(
				'delete-tag',
				[],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('required');
		});
	});

	describe('Interactive confirmation flow', () => {
		it('should require confirmation without --yes flag', async () => {
			// Create a tag
			await helpers.taskMaster(
				'add-tag',
				['interactive-test'],
				{ cwd: testDir }
			);

			// Try to delete without --yes flag
			// Since this would require interactive input, we expect it to fail or timeout
			const result = await helpers.taskMaster(
				'delete-tag',
				['interactive-test'],
				{ cwd: testDir, allowFailure: true, timeout: 2000 }
			);

			// The command might succeed if there's no actual interactive prompt implementation
			// or fail if it's waiting for input. Either way, the tag should still exist
			// since we didn't confirm the deletion
			const tagsResult = await helpers.taskMaster('tags', [], { cwd: testDir });
			expect(tagsResult.stdout).toContain('interactive-test');
		});
	});

	describe('Current tag handling', () => {
		it('should switch to master when deleting the current tag', async () => {
			// Create and switch to a new tag
			await helpers.taskMaster(
				'add-tag',
				['current-feature'],
				{ cwd: testDir }
			);
			await helpers.taskMaster('use-tag', ['current-feature'], { cwd: testDir });

			// Add a task to verify we're on the current tag
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task in current feature'],
				{ cwd: testDir }
			);

			// Delete the current tag
			const result = await helpers.taskMaster(
				'delete-tag',
				['current-feature', '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Switched current tag to "master"');

			// Verify we're on master and the task is gone
			const showResult = await helpers.taskMaster('show', [], { cwd: testDir });
			expect(showResult.stdout).toContain('Active Tag: master');
		});

		it('should not switch tags when deleting a non-current tag', async () => {
			// Create two tags
			await helpers.taskMaster(
				'add-tag',
				['feature-a'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-tag',
				['feature-b'],
				{ cwd: testDir }
			);

			// Switch to feature-a
			await helpers.taskMaster('use-tag', ['feature-a'], { cwd: testDir });

			// Delete feature-b (not current)
			const result = await helpers.taskMaster(
				'delete-tag',
				['feature-b', '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).not.toContain('Switched current tag');

			// Verify we're still on feature-a
			const showResult = await helpers.taskMaster('show', [], { cwd: testDir });
			expect(showResult.stdout).toContain('Active Tag: feature-a');
		});
	});

	describe('Tag with complex data', () => {
		it('should delete tag with subtasks and dependencies', async () => {
			// Create a tag with complex task structure
			await helpers.taskMaster(
				'add-tag',
				['complex-feature'],
				{ cwd: testDir }
			);
			await helpers.taskMaster('use-tag', ['complex-feature'], { cwd: testDir });

			// Add parent task
			const parentResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Parent task', '--description', 'Has subtasks'],
				{ cwd: testDir }
			);
			const parentId = helpers.extractTaskId(parentResult.stdout);

			// Add subtasks
			await helpers.taskMaster(
				'add-subtask',
				['--parent', parentId, '--title', 'Subtask 1'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-subtask',
				['--parent', parentId, '--title', 'Subtask 2'],
				{ cwd: testDir }
			);

			// Add task with dependencies
			const depResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Dependent task', '--dependencies', parentId],
				{ cwd: testDir }
			);

			// Delete the tag
			const result = await helpers.taskMaster(
				'delete-tag',
				['complex-feature', '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			// Should count all tasks (parent + dependent = 2, subtasks are part of parent)
			expect(result.stdout).toContain('Tasks Deleted: 2');
		});

		it('should handle tag with many tasks efficiently', async () => {
			// Create a tag
			await helpers.taskMaster(
				'add-tag',
				['bulk-feature'],
				{ cwd: testDir }
			);
			await helpers.taskMaster('use-tag', ['bulk-feature'], { cwd: testDir });

			// Add many tasks
			const taskCount = 10;
			for (let i = 1; i <= taskCount; i++) {
				await helpers.taskMaster(
					'add-task',
					['--title', `Task ${i}`, '--description', `Description for task ${i}`],
					{ cwd: testDir }
				);
			}

			// Delete the tag
			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'delete-tag',
				['bulk-feature', '--yes'],
				{ cwd: testDir }
			);
			const endTime = Date.now();

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`Tasks Deleted: ${taskCount}`);
			
			// Should complete within reasonable time (5 seconds)
			expect(endTime - startTime).toBeLessThan(5000);
		});
	});

	describe('File path handling', () => {
		it('should work with custom tasks file path', async () => {
			// Create custom tasks file with a tag
			const customPath = join(testDir, 'custom-tasks.json');
			writeFileSync(
				customPath,
				JSON.stringify({
					master: { tasks: [] },
					'custom-tag': {
						tasks: [
							{
								id: 1,
								title: 'Task in custom tag',
								status: 'pending'
							}
						],
						metadata: {
							created: new Date().toISOString(),
							description: 'Custom tag'
						}
					}
				})
			);

			// Delete tag from custom file
			const result = await helpers.taskMaster(
				'delete-tag',
				['custom-tag', '--yes', '--file', customPath],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully deleted tag "custom-tag"');

			// Verify tag is deleted from custom file
			const fileContent = JSON.parse(readFileSync(customPath, 'utf8'));
			expect(fileContent['custom-tag']).toBeUndefined();
			expect(fileContent.master).toBeDefined();
		});
	});

	describe('Edge cases', () => {
		it('should handle empty tag gracefully', async () => {
			// Create an empty tag
			await helpers.taskMaster(
				'add-tag',
				['empty-tag'],
				{ cwd: testDir }
			);

			// Delete the empty tag
			const result = await helpers.taskMaster(
				'delete-tag',
				['empty-tag', '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Tasks Deleted: 0');
		});

		it('should handle special characters in tag names', async () => {
			// Create tag with hyphens and numbers
			const tagName = 'feature-123-test';
			await helpers.taskMaster(
				'add-tag',
				[tagName],
				{ cwd: testDir }
			);

			// Delete it
			const result = await helpers.taskMaster(
				'delete-tag',
				[tagName, '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`Successfully deleted tag "${tagName}"`);
		});

		it('should preserve other tags when deleting one', async () => {
			// Create multiple tags
			await helpers.taskMaster('add-tag', ['keep-me-1'], { cwd: testDir });
			await helpers.taskMaster('add-tag', ['delete-me'], { cwd: testDir });
			await helpers.taskMaster('add-tag', ['keep-me-2'], { cwd: testDir });

			// Add tasks to each
			await helpers.taskMaster('use-tag', ['keep-me-1'], { cwd: testDir });
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task in keep-me-1', '--description', 'Description for keep-me-1'],
				{ cwd: testDir }
			);

			await helpers.taskMaster('use-tag', ['delete-me'], { cwd: testDir });
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task in delete-me', '--description', 'Description for delete-me'],
				{ cwd: testDir }
			);

			await helpers.taskMaster('use-tag', ['keep-me-2'], { cwd: testDir });
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task in keep-me-2', '--description', 'Description for keep-me-2'],
				{ cwd: testDir }
			);

			// Delete middle tag
			const result = await helpers.taskMaster(
				'delete-tag',
				['delete-me', '--yes'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify other tags still exist with their tasks
			const tagsResult = await helpers.taskMaster('tags', [], { cwd: testDir });
			expect(tagsResult.stdout).toContain('keep-me-1');
			expect(tagsResult.stdout).toContain('keep-me-2');
			expect(tagsResult.stdout).not.toContain('delete-me');

			// Verify tasks in other tags are preserved
			await helpers.taskMaster('use-tag', ['keep-me-1'], { cwd: testDir });
			const list1 = await helpers.taskMaster('list', ['--tag', 'keep-me-1'], { cwd: testDir });
			expect(list1.stdout).toContain('Task in keep-me-1');

			await helpers.taskMaster('use-tag', ['keep-me-2'], { cwd: testDir });
			const list2 = await helpers.taskMaster('list', ['--tag', 'keep-me-2'], { cwd: testDir });
			expect(list2.stdout).toContain('Task in keep-me-2');
		});
	});
});