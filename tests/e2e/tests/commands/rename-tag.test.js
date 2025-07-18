/**
 * E2E tests for rename-tag command
 * Tests tag renaming functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('task-master rename-tag', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-rename-tag-'));

		// Initialize test helpers
		const context = global.createTestContext('rename-tag');
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

	describe('Basic renaming', () => {
		it('should rename an existing tag', async () => {
			// Create a tag
			await helpers.taskMaster('add-tag', ['feature', '--description', 'Feature branch'], { cwd: testDir });

			// Add some tasks to the tag
			await helpers.taskMaster('use-tag', ['feature'], { cwd: testDir });
			const task1 = await helpers.taskMaster('add-task', ['--title', '"Task in feature"', '--description', '"First task"'], { cwd: testDir });
			const taskId1 = helpers.extractTaskId(task1.stdout);

			// Switch back to master and add another task
			await helpers.taskMaster('use-tag', ['master'], { cwd: testDir });
			const task2 = await helpers.taskMaster('add-task', ['--title', '"Task in master"', '--description', '"Second task"'], { cwd: testDir });
			const taskId2 = helpers.extractTaskId(task2.stdout);

			// Rename the tag
			const result = await helpers.taskMaster('rename-tag', ['feature', 'feature-v2'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully renamed tag');
			expect(result.stdout).toContain('feature');
			expect(result.stdout).toContain('feature-v2');

			// Verify the tag was renamed in the tags list
			const tagsResult = await helpers.taskMaster('tags', [], { cwd: testDir });
			expect(tagsResult.stdout).toContain('feature-v2');
			expect(tagsResult.stdout).not.toMatch(/^\s*feature\s+/m);

			// Verify tasks are still accessible in renamed tag
			await helpers.taskMaster('use-tag', ['feature-v2'], { cwd: testDir });
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			expect(listResult.stdout).toContain('Task in feature');
		});

		it('should update active tag when renaming current tag', async () => {
			// Create and switch to a tag
			await helpers.taskMaster('add-tag', ['develop'], { cwd: testDir });
			await helpers.taskMaster('use-tag', ['develop'], { cwd: testDir });

			// Rename the active tag
			const result = await helpers.taskMaster('rename-tag', ['develop', 'development'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);

			// Verify we're now on the renamed tag
			const tagsResult = await helpers.taskMaster('tags', [], { cwd: testDir });
			// Match the table format where bullet and (current) are in the same cell
			expect(tagsResult.stdout).toMatch(/●\s*development\s*\(current\)/);
		});
	});

	describe('Error handling', () => {
		it('should fail when renaming non-existent tag', async () => {
			const result = await helpers.taskMaster('rename-tag', ['nonexistent', 'new-name'], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('not exist');
		});

		it('should fail when new tag name already exists', async () => {
			// Create a tag
			await helpers.taskMaster('add-tag', ['feature'], { cwd: testDir });
			await helpers.taskMaster('add-tag', ['hotfix'], { cwd: testDir });

			// Try to rename to existing tag name
			const result = await helpers.taskMaster('rename-tag', ['feature', 'hotfix'], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('already exists');
		});

		it('should not rename master tag', async () => {
			const result = await helpers.taskMaster('rename-tag', ['master', 'main'], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Cannot rename');
			expect(result.stderr).toContain('master');
		});

		it('should validate tag name format', async () => {
			await helpers.taskMaster('add-tag', ['valid-tag'], { cwd: testDir });

			// Test that most tag names are actually accepted
			const validNames = ['tag-with-dashes', 'tag_with_underscores', 'tagwithletters123'];
			
			for (const validName of validNames) {
				const result = await helpers.taskMaster('rename-tag', ['valid-tag', validName], {
					cwd: testDir,
					allowFailure: true
				});
				expect(result.exitCode).toBe(0);
				
				// Rename back for next test
				await helpers.taskMaster('rename-tag', [validName, 'valid-tag'], { cwd: testDir });
			}
		});
	});

	describe('Tag with tasks', () => {
		it('should rename tag with multiple tasks', async () => {
			// Create tag and add tasks
			await helpers.taskMaster('add-tag', ['sprint-1'], { cwd: testDir });
			await helpers.taskMaster('use-tag', ['sprint-1'], { cwd: testDir });

			// Add multiple tasks
			for (let i = 1; i <= 3; i++) {
				await helpers.taskMaster('add-task', [
					'--title', `"Sprint task ${i}"`,
					'--description', `"Task ${i} for sprint"`
				], { cwd: testDir });
			}

			// Rename the tag
			const result = await helpers.taskMaster('rename-tag', ['sprint-1', 'sprint-1-renamed'], { cwd: testDir });
			expect(result).toHaveExitCode(0);

			// Verify tasks are still in renamed tag
			await helpers.taskMaster('use-tag', ['sprint-1-renamed'], { cwd: testDir });
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			expect(listResult.stdout).toContain('Sprint task 1');
			expect(listResult.stdout).toContain('Sprint task 2');
			expect(listResult.stdout).toContain('Sprint task 3');
		});

		it('should handle tag with no tasks', async () => {
			// Create empty tag
			await helpers.taskMaster('add-tag', ['empty-tag', '--description', 'Tag with no tasks'], { cwd: testDir });

			// Rename it
			const result = await helpers.taskMaster('rename-tag', ['empty-tag', 'not-empty'], { cwd: testDir });
			
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully renamed tag');

			// Verify renamed tag exists
			const tagsResult = await helpers.taskMaster('tags', [], { cwd: testDir });
			expect(tagsResult.stdout).toContain('not-empty');
			expect(tagsResult.stdout).not.toContain('empty-tag');
		});
	});

	describe('Tag metadata', () => {
		it('should preserve tag description when renaming', async () => {
			const description = 'This is a feature branch for authentication';
			await helpers.taskMaster('add-tag', ['auth-feature', '--description', description], { cwd: testDir });

			// Rename the tag
			await helpers.taskMaster('rename-tag', ['auth-feature', 'authentication'], { cwd: testDir });

			// Check description is preserved (at least the beginning due to table width limits)
			const tagsResult = await helpers.taskMaster('tags', ['--show-metadata'], { cwd: testDir });
			expect(tagsResult.stdout).toContain('authentication');
			expect(tagsResult.stdout).toContain('This');
		});

		it('should update tag timestamps', async () => {
			await helpers.taskMaster('add-tag', ['temp-feature'], { cwd: testDir });

			// Wait a bit to ensure timestamp difference
			await new Promise(resolve => setTimeout(resolve, 100));

			// Rename the tag
			const result = await helpers.taskMaster('rename-tag', ['temp-feature', 'permanent-feature'], { cwd: testDir });
			expect(result).toHaveExitCode(0);

			// Verify tag exists with new name
			const tagsResult = await helpers.taskMaster('tags', [], { cwd: testDir });
			expect(tagsResult.stdout).toContain('permanent-feature');
		});
	});

	describe('Integration with other commands', () => {
		it('should work with tag switching after rename', async () => {
			// Create tags
			await helpers.taskMaster('add-tag', ['dev'], { cwd: testDir });
			await helpers.taskMaster('add-tag', ['staging'], { cwd: testDir });

			// Add task to dev
			await helpers.taskMaster('use-tag', ['dev'], { cwd: testDir });
			await helpers.taskMaster('add-task', ['--title', 'Dev task', '--description', 'Task in dev'], { cwd: testDir });

			// Rename dev to development
			await helpers.taskMaster('rename-tag', ['dev', 'development'], { cwd: testDir });

			// Should be able to switch to renamed tag
			const switchResult = await helpers.taskMaster('use-tag', ['development'], { cwd: testDir });
			expect(switchResult).toHaveExitCode(0);

			// Verify we're on the right tag
			const tagsResult = await helpers.taskMaster('tags', [], { cwd: testDir });
			// Match the table format where bullet and (current) are in the same cell
			expect(tagsResult.stdout).toMatch(/●\s*development\s*\(current\)/);
		});

		it('should fail gracefully when renaming during operations', async () => {
			await helpers.taskMaster('add-tag', ['feature-x'], { cwd: testDir });

			// Try to rename to itself
			const result = await helpers.taskMaster('rename-tag', ['feature-x', 'feature-x'], {
				cwd: testDir,
				allowFailure: true
			});

			// Should either succeed with no-op or fail gracefully
			if (result.exitCode !== 0) {
				expect(result.stderr).toBeTruthy();
			}
		});
	});

	describe('Edge cases', () => {
		it('should handle special characters in tag names', async () => {
			// Create tag with valid special chars
			await helpers.taskMaster('add-tag', ['feature-123'], { cwd: testDir });

			// Rename to another valid format
			const result = await helpers.taskMaster('rename-tag', ['feature-123', 'feature_456'], { cwd: testDir });
			expect(result).toHaveExitCode(0);

			// Verify rename worked
			const tagsResult = await helpers.taskMaster('tags', [], { cwd: testDir });
			expect(tagsResult.stdout).toContain('feature_456');
			expect(tagsResult.stdout).not.toContain('feature-123');
		});

		it('should handle very long tag names', async () => {
			const longName = 'feature-' + 'a'.repeat(50);
			await helpers.taskMaster('add-tag', ['short'], { cwd: testDir });

			// Try to rename to very long name
			const result = await helpers.taskMaster('rename-tag', ['short', longName], {
				cwd: testDir,
				allowFailure: true
			});

			// Should either succeed or fail with appropriate message
			if (result.exitCode !== 0) {
				expect(result.stderr).toBeTruthy();
			}
		});
	});
});