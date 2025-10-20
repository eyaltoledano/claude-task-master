import { describe, it, expect, beforeEach } from 'vitest';
import { CommitMessageGenerator } from './commit-message-generator.js';

describe('CommitMessageGenerator', () => {
	let generator: CommitMessageGenerator;

	beforeEach(() => {
		generator = new CommitMessageGenerator();
	});

	describe('generateMessage', () => {
		it('should generate basic conventional commit message', () => {
			const message = generator.generateMessage({
				type: 'feat',
				description: 'add user authentication',
				changedFiles: ['packages/tm-core/src/auth/auth-manager.ts']
			});

			expect(message).toContain('feat(core): add user authentication');
		});

		it('should include scope from changed files', () => {
			const message = generator.generateMessage({
				type: 'fix',
				description: 'resolve CLI argument parsing',
				changedFiles: ['packages/cli/src/commands/start.ts']
			});

			expect(message).toContain('fix(cli): resolve CLI argument parsing');
		});

		it('should include task metadata in commit body', () => {
			const message = generator.generateMessage({
				type: 'feat',
				description: 'implement feature',
				changedFiles: ['packages/tm-core/src/index.ts'],
				taskId: '5.3',
				phase: 'GREEN'
			});

			expect(message).toContain('Task: 5.3');
			expect(message).toContain('Phase: GREEN');
		});

		it('should include test results metadata', () => {
			const message = generator.generateMessage({
				type: 'test',
				description: 'add unit tests',
				changedFiles: ['packages/tm-core/src/auth/auth.test.ts'],
				testsPassing: 42,
				testsFailing: 0
			});

			expect(message).toContain('Tests: 42 passing');
		});

		it('should include failing test count when present', () => {
			const message = generator.generateMessage({
				type: 'fix',
				description: 'fix test failures',
				changedFiles: ['packages/tm-core/src/index.ts'],
				testsPassing: 40,
				testsFailing: 2
			});

			expect(message).toContain('Tests: 40 passing, 2 failing');
		});

		it('should include custom body text', () => {
			const message = generator.generateMessage({
				type: 'feat',
				description: 'add new feature',
				changedFiles: ['packages/tm-core/src/index.ts'],
				body: 'This is a detailed explanation\nof the changes made.'
			});

			expect(message).toContain('This is a detailed explanation');
			expect(message).toContain('of the changes made.');
		});

		it('should handle multiple changed files with different scopes', () => {
			const message = generator.generateMessage({
				type: 'refactor',
				description: 'reorganize code structure',
				changedFiles: [
					'packages/cli/src/index.ts',
					'packages/tm-core/src/index.ts'
				]
			});

			// Should use CLI scope (higher priority due to count or priority)
			expect(message).toMatch(/refactor\((cli|core)\):/);
		});

		it('should handle test files and detect test scope', () => {
			const message = generator.generateMessage({
				type: 'test',
				description: 'add integration tests',
				changedFiles: ['packages/tm-core/src/workflow/workflow.test.ts']
			});

			expect(message).toContain('test(test):');
		});

		it('should handle docs changes', () => {
			const message = generator.generateMessage({
				type: 'docs',
				description: 'update README',
				changedFiles: ['README.md', 'docs/guide.md']
			});

			expect(message).toContain('docs(docs):');
		});

		it('should omit scope if not detected', () => {
			const message = generator.generateMessage({
				type: 'chore',
				description: 'update dependencies',
				changedFiles: []
			});

			expect(message).toContain('chore(repo): update dependencies');
		});

		it('should support manual scope override', () => {
			const message = generator.generateMessage({
				type: 'feat',
				description: 'add feature',
				changedFiles: ['packages/tm-core/src/index.ts'],
				scope: 'api'
			});

			expect(message).toContain('feat(api): add feature');
		});

		it('should handle breaking changes indicator', () => {
			const message = generator.generateMessage({
				type: 'feat',
				description: 'change API structure',
				changedFiles: ['packages/tm-core/src/index.ts'],
				breaking: true
			});

			expect(message).toContain('feat(core)!: change API structure');
		});

		it('should format complete message with all metadata', () => {
			const message = generator.generateMessage({
				type: 'feat',
				description: 'implement TDD workflow',
				changedFiles: ['packages/tm-core/src/workflow/orchestrator.ts'],
				body: 'Implemented complete RED-GREEN-COMMIT cycle with state persistence.',
				taskId: '4.1',
				phase: 'GREEN',
				testsPassing: 74,
				testsFailing: 0
			});

			expect(message).toContain('feat(core): implement TDD workflow');
			expect(message).toContain('Implemented complete RED-GREEN-COMMIT cycle');
			expect(message).toContain('Task: 4.1');
			expect(message).toContain('Phase: GREEN');
			expect(message).toContain('Tests: 74 passing');
		});
	});

	describe('validateConventionalCommit', () => {
		it('should validate correct conventional commit format', () => {
			const message = 'feat(core): add feature\n\nDetails here.';
			const result = generator.validateConventionalCommit(message);

			expect(result.isValid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it('should detect missing type', () => {
			const message = 'add feature';
			const result = generator.validateConventionalCommit(message);

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toContain('Invalid conventional commit format');
		});

		it('should detect invalid type', () => {
			const message = 'invalid(core): add feature';
			const result = generator.validateConventionalCommit(message);

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should detect missing description', () => {
			const message = 'feat(core):';
			const result = generator.validateConventionalCommit(message);

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toContain('Invalid conventional commit format');
		});

		it('should accept valid types', () => {
			const validTypes = [
				'feat',
				'fix',
				'docs',
				'style',
				'refactor',
				'test',
				'chore'
			];

			for (const type of validTypes) {
				const message = `${type}(core): do something`;
				const result = generator.validateConventionalCommit(message);

				expect(result.isValid).toBe(true);
			}
		});

		it('should accept breaking change indicator', () => {
			const message = 'feat(core)!: breaking change';
			const result = generator.validateConventionalCommit(message);

			expect(result.isValid).toBe(true);
		});

		it('should accept message without scope', () => {
			const message = 'fix: resolve issue';
			const result = generator.validateConventionalCommit(message);

			expect(result.isValid).toBe(true);
		});
	});

	describe('parseCommitMessage', () => {
		it('should parse conventional commit message', () => {
			const message = 'feat(core): add feature\n\nDetailed explanation.';
			const parsed = generator.parseCommitMessage(message);

			expect(parsed.type).toBe('feat');
			expect(parsed.scope).toBe('core');
			expect(parsed.description).toBe('add feature');
			expect(parsed.body).toContain('Detailed explanation.');
			expect(parsed.breaking).toBe(false);
		});

		it('should parse breaking change indicator', () => {
			const message = 'feat(core)!: breaking change';
			const parsed = generator.parseCommitMessage(message);

			expect(parsed.type).toBe('feat');
			expect(parsed.breaking).toBe(true);
		});

		it('should parse message without scope', () => {
			const message = 'fix: resolve issue';
			const parsed = generator.parseCommitMessage(message);

			expect(parsed.type).toBe('fix');
			expect(parsed.scope).toBeUndefined();
			expect(parsed.description).toBe('resolve issue');
		});

		it('should handle multiline body', () => {
			const message = 'feat: add feature\n\nLine 1\nLine 2\nLine 3';
			const parsed = generator.parseCommitMessage(message);

			expect(parsed.body).toContain('Line 1');
			expect(parsed.body).toContain('Line 2');
			expect(parsed.body).toContain('Line 3');
		});
	});

	describe('edge cases', () => {
		it('should handle empty changed files list', () => {
			const message = generator.generateMessage({
				type: 'chore',
				description: 'general maintenance',
				changedFiles: []
			});

			expect(message).toContain('chore(repo):');
		});

		it('should handle very long description', () => {
			const longDesc = 'a'.repeat(200);
			const message = generator.generateMessage({
				type: 'feat',
				description: longDesc,
				changedFiles: ['packages/tm-core/src/index.ts']
			});

			expect(message).toContain(longDesc);
		});

		it('should handle special characters in description', () => {
			const message = generator.generateMessage({
				type: 'fix',
				description: 'resolve issue with $special @characters #123',
				changedFiles: ['packages/tm-core/src/index.ts']
			});

			expect(message).toContain('$special @characters #123');
		});

		it('should handle zero passing tests', () => {
			const message = generator.generateMessage({
				type: 'test',
				description: 'add failing test',
				changedFiles: ['test.ts'],
				testsPassing: 0,
				testsFailing: 1
			});

			expect(message).toContain('Tests: 0 passing, 1 failing');
		});
	});
});
