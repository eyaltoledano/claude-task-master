/**
 * @fileoverview Integration tests for CodexProfile
 * Tests actual filesystem operations for slash command management.
 *
 * Note: Codex stores prompts in ~/.codex/prompts (home directory), not project-relative.
 * Tests use the homeDir option to redirect writes to a temp directory.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodexProfile } from '../../src/slash-commands/profiles/codex-profile.js';
import {
	staticCommand,
	dynamicCommand
} from '../../src/slash-commands/factories.js';

describe('CodexProfile Integration Tests', () => {
	let tempDir: string;
	let codexProfile: CodexProfile;

	beforeEach(() => {
		// Create a temporary directory to act as the "home" directory for testing
		// Codex prompts go in ~/.codex/prompts, so we override homeDir to tempDir
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-profile-test-'));
		codexProfile = new CodexProfile({ homeDir: tempDir });
	});

	afterEach(() => {
		// Clean up temporary directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('addSlashCommands', () => {
		it('should create the .codex/prompts directory', () => {
			const testCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Test command',
					content: '# Test Content'
				})
			];

			const result = codexProfile.addSlashCommands(tempDir, testCommands);

			const commandsDir = path.join(tempDir, '.codex', 'prompts');
			expect(fs.existsSync(commandsDir)).toBe(true);
			expect(fs.statSync(commandsDir).isDirectory()).toBe(true);
			expect(result.success).toBe(true);
		});

		it('should write files with YAML frontmatter and tm- prefix', () => {
			const testCommands = [
				staticCommand({
					name: 'static-test',
					description: 'Test description',
					content: '# Test Content'
				})
			];

			const result = codexProfile.addSlashCommands(tempDir, testCommands);

			// Codex uses tm- prefix since supportsNestedCommands = false
			const filePath = path.join(
				tempDir,
				'.codex',
				'prompts',
				'tm-static-test.md'
			);
			expect(fs.existsSync(filePath)).toBe(true);
			expect(result.success).toBe(true);

			const content = fs.readFileSync(filePath, 'utf-8');

			// Verify YAML frontmatter structure
			expect(content).toContain('---');
			expect(content).toContain('description: "Test description"');
			expect(content).toContain('# Test Content');

			// Verify it does NOT include argument-hint (static command without argumentHint)
			expect(content).not.toContain('argument-hint:');

			// Verify exact format
			const expectedContent =
				'---\ndescription: "Test description"\n---\n# Test Content';
			expect(content).toBe(expectedContent);
		});

		it('should include argument-hint only when argumentHint is present', () => {
			const testCommands = [
				staticCommand({
					name: 'with-hint',
					description: 'Command with hint',
					argumentHint: '[args]',
					content: 'Content here'
				})
			];

			const result = codexProfile.addSlashCommands(tempDir, testCommands);

			const filePath = path.join(
				tempDir,
				'.codex',
				'prompts',
				'tm-with-hint.md'
			);
			expect(fs.existsSync(filePath)).toBe(true);
			expect(result.success).toBe(true);

			const content = fs.readFileSync(filePath, 'utf-8');

			// Verify argument-hint is included
			expect(content).toContain('argument-hint: "[args]"');

			// Verify exact format
			const expectedContent =
				'---\ndescription: "Command with hint"\nargument-hint: "[args]"\n---\nContent here';
			expect(content).toBe(expectedContent);
		});

		it('should format dynamic commands with argument-hint', () => {
			const testCommands = [
				dynamicCommand(
					'dynamic-test',
					'Dynamic command',
					'<task-id>',
					'Process: $ARGUMENTS'
				)
			];

			const result = codexProfile.addSlashCommands(tempDir, testCommands);

			const filePath = path.join(
				tempDir,
				'.codex',
				'prompts',
				'tm-dynamic-test.md'
			);
			expect(fs.existsSync(filePath)).toBe(true);
			expect(result.success).toBe(true);

			const content = fs.readFileSync(filePath, 'utf-8');

			// Dynamic commands should include argument-hint
			expect(content).toContain('argument-hint: "<task-id>"');
			expect(content).toContain('Process: $ARGUMENTS');

			// Verify exact format
			const expectedContent =
				'---\ndescription: "Dynamic command"\nargument-hint: "<task-id>"\n---\nProcess: $ARGUMENTS';
			expect(content).toBe(expectedContent);
		});

		it('should return success result with correct count', () => {
			const testCommands = [
				staticCommand({
					name: 'cmd1',
					description: 'First command',
					content: 'Content 1'
				}),
				staticCommand({
					name: 'cmd2',
					description: 'Second command',
					content: 'Content 2'
				}),
				dynamicCommand('cmd3', 'Third command', '[arg]', 'Content $ARGUMENTS')
			];

			const result = codexProfile.addSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(3);
			expect(result.files).toHaveLength(3);
			expect(result.directory).toBe(path.join(tempDir, '.codex', 'prompts'));
			expect(result.files).toContain('tm-cmd1.md');
			expect(result.files).toContain('tm-cmd2.md');
			expect(result.files).toContain('tm-cmd3.md');
		});

		it('should handle multiline content in YAML frontmatter format', () => {
			const testCommands = [
				staticCommand({
					name: 'multiline',
					description: 'Multiline test',
					content: '# Title\n\nParagraph 1\n\nParagraph 2'
				})
			];

			const result = codexProfile.addSlashCommands(tempDir, testCommands);

			const filePath = path.join(
				tempDir,
				'.codex',
				'prompts',
				'tm-multiline.md'
			);
			const content = fs.readFileSync(filePath, 'utf-8');

			expect(result.success).toBe(true);
			expect(content).toContain('# Title');
			expect(content).toContain('Paragraph 1');
			expect(content).toContain('Paragraph 2');
		});

		it('should handle commands with special characters in descriptions', () => {
			const testCommands = [
				staticCommand({
					name: 'special',
					description: 'Command with "quotes" and special chars',
					content: 'Content'
				})
			];

			const result = codexProfile.addSlashCommands(tempDir, testCommands);

			const filePath = path.join(tempDir, '.codex', 'prompts', 'tm-special.md');
			const content = fs.readFileSync(filePath, 'utf-8');

			expect(result.success).toBe(true);
			expect(content).toContain(
				'description: "Command with \\"quotes\\" and special chars"'
			);
		});
	});

	describe('removeSlashCommands', () => {
		it('should remove only TaskMaster commands and preserve user files', () => {
			// Add TaskMaster commands
			const tmCommands = [
				staticCommand({
					name: 'cmd1',
					description: 'TaskMaster command 1',
					content: 'TM Content 1'
				}),
				staticCommand({
					name: 'cmd2',
					description: 'TaskMaster command 2',
					content: 'TM Content 2'
				})
			];

			codexProfile.addSlashCommands(tempDir, tmCommands);

			// Create a user file manually
			const commandsDir = path.join(tempDir, '.codex', 'prompts');
			const userFilePath = path.join(commandsDir, 'user-custom.md');
			fs.writeFileSync(
				userFilePath,
				'---\ndescription: "User command"\n---\nUser content'
			);

			// Remove TaskMaster commands
			const result = codexProfile.removeSlashCommands(tempDir, tmCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(2);

			// Verify TaskMaster files are removed (they have tm- prefix)
			expect(fs.existsSync(path.join(commandsDir, 'tm-cmd1.md'))).toBe(false);
			expect(fs.existsSync(path.join(commandsDir, 'tm-cmd2.md'))).toBe(false);

			// Verify user file is preserved
			expect(fs.existsSync(userFilePath)).toBe(true);
			const userContent = fs.readFileSync(userFilePath, 'utf-8');
			expect(userContent).toContain('User command');
		});

		it('should remove empty directory after cleanup', () => {
			const testCommands = [
				staticCommand({
					name: 'only-cmd',
					description: 'Only command',
					content: 'Only content'
				})
			];

			codexProfile.addSlashCommands(tempDir, testCommands);

			const commandsDir = path.join(tempDir, '.codex', 'prompts');
			expect(fs.existsSync(commandsDir)).toBe(true);

			// Remove all TaskMaster commands
			const result = codexProfile.removeSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(1);

			// Directory should be removed when empty
			expect(fs.existsSync(commandsDir)).toBe(false);
		});

		it('should keep directory when user files remain', () => {
			const tmCommands = [
				staticCommand({
					name: 'cmd',
					description: 'TaskMaster command',
					content: 'TM Content'
				})
			];

			codexProfile.addSlashCommands(tempDir, tmCommands);

			// Add user file
			const commandsDir = path.join(tempDir, '.codex', 'prompts');
			const userFilePath = path.join(commandsDir, 'my-command.md');
			fs.writeFileSync(
				userFilePath,
				'---\ndescription: "My custom command"\n---\nMy content'
			);

			// Remove TaskMaster commands
			const result = codexProfile.removeSlashCommands(tempDir, tmCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(1);

			// Directory should still exist
			expect(fs.existsSync(commandsDir)).toBe(true);
			expect(fs.existsSync(userFilePath)).toBe(true);
		});

		it('should handle removal when no files exist', () => {
			const testCommands = [
				staticCommand({
					name: 'nonexistent',
					description: 'Non-existent command',
					content: 'Content'
				})
			];

			// Don't add commands, just try to remove
			const result = codexProfile.removeSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		it('should handle removal when directory does not exist', () => {
			const testCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Test command',
					content: 'Content'
				})
			];

			// Ensure .codex/prompts doesn't exist
			const commandsDir = path.join(tempDir, '.codex', 'prompts');
			expect(fs.existsSync(commandsDir)).toBe(false);

			const result = codexProfile.removeSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		it('should remove mixed command types', () => {
			const testCommands = [
				staticCommand({
					name: 'static-cmd',
					description: 'Static command',
					content: 'Static content'
				}),
				dynamicCommand(
					'dynamic-cmd',
					'Dynamic command',
					'[arg]',
					'Dynamic content $ARGUMENTS'
				)
			];

			codexProfile.addSlashCommands(tempDir, testCommands);

			const commandsDir = path.join(tempDir, '.codex', 'prompts');
			expect(fs.existsSync(path.join(commandsDir, 'tm-static-cmd.md'))).toBe(
				true
			);
			expect(fs.existsSync(path.join(commandsDir, 'tm-dynamic-cmd.md'))).toBe(
				true
			);

			const result = codexProfile.removeSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
			expect(fs.existsSync(path.join(commandsDir, 'tm-static-cmd.md'))).toBe(
				false
			);
			expect(fs.existsSync(path.join(commandsDir, 'tm-dynamic-cmd.md'))).toBe(
				false
			);
		});
	});

	describe('edge cases', () => {
		it('should handle empty command list', () => {
			const result = codexProfile.addSlashCommands(tempDir, []);

			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		it('should handle commands with hyphens and underscores in names', () => {
			const testCommands = [
				staticCommand({
					name: 'test-cmd-123',
					description: 'Test with numbers',
					content: 'Content'
				}),
				staticCommand({
					name: 'test_underscore',
					description: 'Test with underscore',
					content: 'Content'
				})
			];

			const result = codexProfile.addSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(2);

			const commandsDir = path.join(tempDir, '.codex', 'prompts');
			expect(fs.existsSync(path.join(commandsDir, 'tm-test-cmd-123.md'))).toBe(
				true
			);
			expect(
				fs.existsSync(path.join(commandsDir, 'tm-test_underscore.md'))
			).toBe(true);
		});

		it('should preserve exact formatting in content', () => {
			const testCommands = [
				staticCommand({
					name: 'formatted',
					description: 'Formatted command',
					content: '# Heading\n\n- Item 1\n- Item 2\n\n```code\nblock\n```'
				})
			];

			codexProfile.addSlashCommands(tempDir, testCommands);

			const filePath = path.join(
				tempDir,
				'.codex',
				'prompts',
				'tm-formatted.md'
			);
			const content = fs.readFileSync(filePath, 'utf-8');

			expect(content).toContain('# Heading');
			expect(content).toContain('- Item 1\n- Item 2');
			expect(content).toContain('```code\nblock\n```');
		});

		it('should handle empty content', () => {
			const testCommands = [
				staticCommand({
					name: 'empty',
					description: 'Empty content',
					content: ''
				})
			];

			const result = codexProfile.addSlashCommands(tempDir, testCommands);

			const filePath = path.join(tempDir, '.codex', 'prompts', 'tm-empty.md');
			const content = fs.readFileSync(filePath, 'utf-8');

			expect(result.success).toBe(true);
			// Should only have frontmatter
			expect(content).toBe('---\ndescription: "Empty content"\n---\n');
		});

		it('should overwrite existing files on re-run', () => {
			const initialCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Initial description',
					content: 'Initial content'
				})
			];

			codexProfile.addSlashCommands(tempDir, initialCommands);

			const filePath = path.join(
				tempDir,
				'.codex',
				'prompts',
				'tm-test-cmd.md'
			);
			const initialContent = fs.readFileSync(filePath, 'utf-8');
			expect(initialContent).toContain('Initial description');
			expect(initialContent).toContain('Initial content');

			// Re-run with updated command
			const updatedCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Updated description',
					content: 'Updated content'
				})
			];

			codexProfile.addSlashCommands(tempDir, updatedCommands);

			const updatedContent = fs.readFileSync(filePath, 'utf-8');
			expect(updatedContent).toContain('Updated description');
			expect(updatedContent).toContain('Updated content');
			expect(updatedContent).not.toContain('Initial');
		});
	});
});
