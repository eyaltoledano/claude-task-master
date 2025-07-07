/**
 * GitWorkflowManager Unit Tests - Phase 1.1 Implementation
 *
 * Tests systematic git commit handling following dev_workflow.mdc patterns
 * Coverage: git status validation, commit message generation, workflow integration
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { GitWorkflowManager } from '../../../services/GitWorkflowManager.js';
import { execSync } from 'child_process';
import fs from 'fs/promises';

// Mock child_process and fs
jest.mock('child_process');
jest.mock('fs/promises');

describe('GitWorkflowManager - Phase 1.1 Tests', () => {
	let gitManager;
	const mockProjectRoot = '/test/project';

	beforeEach(() => {
		jest.clearAllMocks();
		gitManager = new GitWorkflowManager(mockProjectRoot);

		// Mock git status output
		execSync.mockImplementation((command) => {
			if (command.includes('git status --porcelain')) {
				return Buffer.from('M  src/test.js\n?? newfile.js\n');
			}
			if (command.includes('git rev-parse --show-toplevel')) {
				return Buffer.from(mockProjectRoot);
			}
			return Buffer.from('');
		});
	});

	describe('Git Status Validation', () => {
		test('should detect uncommitted changes', async () => {
			const status = await gitManager.validateCommitReadiness('/test/worktree');

			expect(status.hasUncommittedChanges).toBe(true);
			expect(status.modifiedFiles).toContain('src/test.js');
			expect(status.untrackedFiles).toContain('newfile.js');
		});

		test('should detect clean working directory', async () => {
			execSync.mockImplementation((command) => {
				if (command.includes('git status --porcelain')) {
					return Buffer.from('');
				}
				return Buffer.from('');
			});

			const status = await gitManager.validateCommitReadiness('/test/worktree');

			expect(status.hasUncommittedChanges).toBe(false);
			expect(status.modifiedFiles).toHaveLength(0);
			expect(status.untrackedFiles).toHaveLength(0);
		});

		test('should handle git errors gracefully', async () => {
			execSync.mockImplementation(() => {
				throw new Error('Git command failed');
			});

			const status = await gitManager.validateCommitReadiness('/test/worktree');

			expect(status.error).toBeDefined();
			expect(status.hasUncommittedChanges).toBe(null);
		});
	});

	describe('Commit Message Generation', () => {
		test('should generate proper subtask commit message', () => {
			const message = gitManager.generateCommitMessage(
				'feat',
				{
					taskId: '4',
					subtaskId: '4.1',
					title: 'Initialize Express server'
				},
				'Set up basic Express configuration'
			);

			expect(message).toMatch(
				/^feat\(task-4\): Complete subtask 4\.1 - Initialize Express server/
			);
			expect(message).toContain('Set up basic Express configuration');
			expect(message).toContain('Subtask 4.1:');
			expect(message).toContain('Relates to Task 4:');
		});

		test('should generate test commit message', () => {
			const message = gitManager.generateCommitMessage(
				'test',
				{
					taskId: '4',
					title: 'Express server setup'
				},
				'Add unit tests for Express endpoints'
			);

			expect(message).toMatch(
				/^test\(task-4\): Add comprehensive tests for Task 4/
			);
			expect(message).toContain('Add unit tests for Express endpoints');
			expect(message).toContain(
				'Task 4: Express server setup - Testing complete'
			);
		});

		test('should handle different commit types', () => {
			const types = ['feat', 'fix', 'docs', 'refactor', 'chore'];

			types.forEach((type) => {
				const message = gitManager.generateCommitMessage(
					type,
					{
						taskId: '5',
						title: 'Test task'
					},
					'Test description'
				);

				expect(message).toMatch(new RegExp(`^${type}\\(task-5\\):`));
			});
		});
	});

	describe('Subtask Progress Commits', () => {
		test('should commit subtask progress successfully', async () => {
			execSync.mockImplementation((command) => {
				if (command.includes('git add .')) return Buffer.from('');
				if (command.includes('git commit'))
					return Buffer.from('commit-hash-123');
				return Buffer.from('');
			});

			const result = await gitManager.commitSubtaskProgress(
				'/test/worktree',
				'4.1',
				'Implement user authentication',
				{
					findings: 'Successfully integrated JWT tokens',
					decisions: 'Used bcrypt for password hashing'
				}
			);

			expect(result.success).toBe(true);
			expect(result.commitHash).toBeDefined();
			expect(execSync).toHaveBeenCalledWith(
				expect.stringContaining('git add .'),
				expect.any(Object)
			);
			expect(execSync).toHaveBeenCalledWith(
				expect.stringContaining('git commit'),
				expect.any(Object)
			);
		});

		test('should handle commit failures', async () => {
			execSync.mockImplementation((command) => {
				if (command.includes('git commit')) {
					throw new Error('Nothing to commit');
				}
				return Buffer.from('');
			});

			const result = await gitManager.commitSubtaskProgress(
				'/test/worktree',
				'4.1',
				'Test commit'
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Nothing to commit');
		});
	});

	describe('Test Commits', () => {
		test('should create separate test commits', async () => {
			execSync.mockImplementation(() => Buffer.from('test-commit-456'));

			const result = await gitManager.commitTestsForTask(
				'/test/worktree',
				{
					taskId: '4',
					title: 'User authentication'
				},
				{
					testFiles: ['test/auth.test.js', 'test/jwt.test.js'],
					coverage: '95%'
				}
			);

			expect(result.success).toBe(true);
			expect(result.commitHash).toBeDefined();
			expect(execSync).toHaveBeenCalledWith(
				expect.stringContaining(
					'test(task-4): Add comprehensive tests for Task 4'
				),
				expect.any(Object)
			);
		});
	});

	describe('Git Status Retrieval', () => {
		test('should get detailed git status', async () => {
			execSync.mockImplementation((command) => {
				if (command.includes('git status --porcelain')) {
					return Buffer.from('M  src/test.js\nA  src/new.js\nD  src/old.js\n');
				}
				if (command.includes('git log')) {
					return Buffer.from('commit abc123\nAuthor: Test\nDate: 2025-01-01\n');
				}
				return Buffer.from('');
			});

			const status = await gitManager.getGitStatus('/test/worktree');

			expect(status.modifiedFiles).toContain('src/test.js');
			expect(status.addedFiles).toContain('src/new.js');
			expect(status.deletedFiles).toContain('src/old.js');
			expect(status.lastCommit).toBeDefined();
		});
	});

	describe('Error Handling and Recovery', () => {
		test('should handle git not installed', async () => {
			execSync.mockImplementation(() => {
				throw new Error('git: command not found');
			});

			const status = await gitManager.validateCommitReadiness('/test/worktree');

			expect(status.error).toContain('git: command not found');
			expect(status.hasUncommittedChanges).toBe(null);
		});

		test('should handle invalid worktree path', async () => {
			execSync.mockImplementation(() => {
				throw new Error('fatal: not a git repository');
			});

			const result = await gitManager.commitSubtaskProgress(
				'/invalid/path',
				'4.1',
				'test'
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain('not a git repository');
		});

		test('should validate commit message format', () => {
			const isValid = gitManager.validateCommitMessageFormat(
				'feat(task-4): Complete subtask 4.1 - Test\n\nDetails here'
			);

			expect(isValid.isValid).toBe(true);
			expect(isValid.errors).toHaveLength(0);
		});

		test('should reject invalid commit message format', () => {
			const isValid = gitManager.validateCommitMessageFormat('bad message');

			expect(isValid.isValid).toBe(false);
			expect(isValid.errors.length).toBeGreaterThan(0);
		});
	});

	describe('Integration Features', () => {
		test('should support custom commit options', async () => {
			const result = await gitManager.commitSubtaskProgress(
				'/test/worktree',
				'4.1',
				'Test commit',
				{
					includeDetails: true,
					skipHooks: true,
					author: 'Test User <test@example.com>'
				}
			);

			expect(execSync).toHaveBeenCalledWith(
				expect.stringContaining('--no-verify'),
				expect.any(Object)
			);
		});

		test('should generate file statistics', async () => {
			execSync.mockImplementation((command) => {
				if (command.includes('git diff --stat')) {
					return Buffer.from(
						'2 files changed, 15 insertions(+), 3 deletions(-)'
					);
				}
				return Buffer.from('');
			});

			const stats = await gitManager.getCommitStats('/test/worktree');

			expect(stats.filesChanged).toBe(2);
			expect(stats.insertions).toBe(15);
			expect(stats.deletions).toBe(3);
		});
	});
});
