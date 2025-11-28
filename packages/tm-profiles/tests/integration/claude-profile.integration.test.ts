import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ClaudeProfile } from '../../src/slash-commands/profiles/claude-profile.js';
import {
	staticCommand,
	dynamicCommand
} from '../../src/slash-commands/factories.js';

describe('ClaudeProfile Integration Tests', () => {
	let tempDir: string;
	let claudeProfile: ClaudeProfile;

	beforeEach(() => {
		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-profile-test-'));
		claudeProfile = new ClaudeProfile();
	});

	afterEach(() => {
		// Clean up temporary directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('addSlashCommands', () => {
		it('should create the .claude/commands/tm directory (nested structure)', async () => {
			const testCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Test command',
					content: '# Test Content'
				})
			];

			const result = claudeProfile.addSlashCommands(tempDir, testCommands);

			// Claude supports nested commands, so files go to .claude/commands/tm/
			const commandsDir = path.join(tempDir, '.claude', 'commands', 'tm');
			expect(fs.existsSync(commandsDir)).toBe(true);
			expect(fs.statSync(commandsDir).isDirectory()).toBe(true);
		});

		it('should write correctly formatted static command files', async () => {
			const testCommands = [
				staticCommand({
					name: 'static-test',
					description: 'Static test command',
					content: '# Static Content\n\nThis is a test.'
				})
			];

			const result = claudeProfile.addSlashCommands(tempDir, testCommands);

			// Files go to .claude/commands/tm/ subdirectory
			const filePath = path.join(
				tempDir,
				'.claude',
				'commands',
				'tm',
				'static-test.md'
			);
			expect(fs.existsSync(filePath)).toBe(true);

			const content = fs.readFileSync(filePath, 'utf-8');
			const expectedContent =
				'Static test command\n# Static Content\n\nThis is a test.';
			expect(content).toBe(expectedContent);
		});

		it('should write correctly formatted dynamic command files with argumentHint', () => {
			const testCommands = [
				dynamicCommand(
					'dynamic-test',
					'Dynamic test command',
					'[task-id]',
					'Process task: $ARGUMENTS\n\nThis processes the specified task.'
				)
			];

			const result = claudeProfile.addSlashCommands(tempDir, testCommands);

			// Files go to .claude/commands/tm/ subdirectory
			const filePath = path.join(
				tempDir,
				'.claude',
				'commands',
				'tm',
				'dynamic-test.md'
			);
			expect(fs.existsSync(filePath)).toBe(true);

			const content = fs.readFileSync(filePath, 'utf-8');
			const expectedContent =
				'Dynamic test command\n\n' +
				'Arguments: $ARGUMENTS\n' +
				'Process task: $ARGUMENTS\n\n' +
				'This processes the specified task.';
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

			const result = claudeProfile.addSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(3);
			expect(result.files).toHaveLength(3);
		});

		it('should overwrite existing files on re-run', () => {
			const initialCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Initial description',
					content: 'Initial content'
				})
			];

			claudeProfile.addSlashCommands(tempDir, initialCommands);

			// Files go to .claude/commands/tm/ subdirectory
			const filePath = path.join(
				tempDir,
				'.claude',
				'commands',
				'tm',
				'test-cmd.md'
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

			claudeProfile.addSlashCommands(tempDir, updatedCommands);

			const updatedContent = fs.readFileSync(filePath, 'utf-8');
			expect(updatedContent).toContain('Updated description');
			expect(updatedContent).toContain('Updated content');
			expect(updatedContent).not.toContain('Initial');
		});

		it('should handle multiple commands with mixed types', async () => {
			const testCommands = [
				staticCommand({
					name: 'static1',
					description: 'Static command 1',
					content: 'Static content 1'
				}),
				dynamicCommand(
					'dynamic1',
					'Dynamic command 1',
					'[id]',
					'Dynamic content $ARGUMENTS'
				),
				staticCommand({
					name: 'static2',
					description: 'Static command 2',
					content: 'Static content 2'
				})
			];

			const result = claudeProfile.addSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(3);

			// Files go to .claude/commands/tm/ subdirectory
			const commandsDir = path.join(tempDir, '.claude', 'commands', 'tm');
			const static1Path = path.join(commandsDir, 'static1.md');
			const dynamic1Path = path.join(commandsDir, 'dynamic1.md');
			const static2Path = path.join(commandsDir, 'static2.md');

			expect(fs.existsSync(static1Path)).toBe(true);
			expect(fs.existsSync(dynamic1Path)).toBe(true);
			expect(fs.existsSync(static2Path)).toBe(true);

			// Verify dynamic command format
			const dynamic1Content = fs.readFileSync(dynamic1Path, 'utf-8');
			expect(dynamic1Content).toContain('Arguments: $ARGUMENTS');
		});
	});

	describe('removeSlashCommands', () => {
		it('should remove only TaskMaster commands and preserve user files', async () => {
			// Add TaskMaster commands
			const tmCommands = [
				staticCommand({
					name: 'tm-cmd1',
					description: 'TaskMaster command 1',
					content: 'TM Content 1'
				}),
				staticCommand({
					name: 'tm-cmd2',
					description: 'TaskMaster command 2',
					content: 'TM Content 2'
				})
			];

			claudeProfile.addSlashCommands(tempDir, tmCommands);

			// TaskMaster commands go to .claude/commands/tm/ subdirectory
			const tmDir = path.join(tempDir, '.claude', 'commands', 'tm');
			const userFilePath = path.join(tmDir, 'user-custom.md');
			fs.writeFileSync(userFilePath, 'User custom command\n\nUser content');

			// Remove TaskMaster commands
			const result = claudeProfile.removeSlashCommands(tempDir, tmCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(2);

			// Verify TaskMaster files are removed
			expect(fs.existsSync(path.join(tmDir, 'tm-cmd1.md'))).toBe(false);
			expect(fs.existsSync(path.join(tmDir, 'tm-cmd2.md'))).toBe(false);

			// Verify user file is preserved
			expect(fs.existsSync(userFilePath)).toBe(true);
			const userContent = fs.readFileSync(userFilePath, 'utf-8');
			expect(userContent).toContain('User custom command');
		});

		it('should remove empty tm directory after cleanup', async () => {
			const testCommands = [
				staticCommand({
					name: 'only-cmd',
					description: 'Only command',
					content: 'Only content'
				})
			];

			const result = claudeProfile.addSlashCommands(tempDir, testCommands);

			// Commands go to .claude/commands/tm/
			const tmDir = path.join(tempDir, '.claude', 'commands', 'tm');
			expect(fs.existsSync(tmDir)).toBe(true);

			// Remove all TaskMaster commands
			claudeProfile.removeSlashCommands(tempDir, testCommands);

			// tm directory should be removed when empty
			expect(fs.existsSync(tmDir)).toBe(false);
		});

		it('should keep tm directory when user files remain', async () => {
			const tmCommands = [
				staticCommand({
					name: 'tm-cmd',
					description: 'TaskMaster command',
					content: 'TM Content'
				})
			];

			claudeProfile.addSlashCommands(tempDir, tmCommands);

			// Add user file in the tm directory
			const tmDir = path.join(tempDir, '.claude', 'commands', 'tm');
			const userFilePath = path.join(tmDir, 'my-command.md');
			fs.writeFileSync(userFilePath, 'My custom command');

			// Remove TaskMaster commands
			const result = claudeProfile.removeSlashCommands(tempDir, tmCommands);

			// Directory should still exist because user file remains
			expect(fs.existsSync(tmDir)).toBe(true);
			expect(fs.existsSync(userFilePath)).toBe(true);
		});

		it('should handle removal when no files exist', async () => {
			const testCommands = [
				staticCommand({
					name: 'nonexistent',
					description: 'Non-existent command',
					content: 'Content'
				})
			];

			// Don't add commands, just try to remove
			const result = claudeProfile.removeSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		it('should handle removal when directory does not exist', async () => {
			const testCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Test command',
					content: 'Content'
				})
			];

			// Ensure .claude/commands/tm doesn't exist
			const tmDir = path.join(tempDir, '.claude', 'commands', 'tm');
			expect(fs.existsSync(tmDir)).toBe(false);

			const result = claudeProfile.removeSlashCommands(tempDir, testCommands);

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

			claudeProfile.addSlashCommands(tempDir, testCommands);

			// Files go to .claude/commands/tm/ subdirectory
			const tmDir = path.join(tempDir, '.claude', 'commands', 'tm');
			expect(fs.existsSync(path.join(tmDir, 'static-cmd.md'))).toBe(true);
			expect(fs.existsSync(path.join(tmDir, 'dynamic-cmd.md'))).toBe(true);

			const result = claudeProfile.removeSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
			expect(fs.existsSync(path.join(tmDir, 'static-cmd.md'))).toBe(false);
			expect(fs.existsSync(path.join(tmDir, 'dynamic-cmd.md'))).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('should handle empty command list', () => {
			const result = claudeProfile.addSlashCommands(tempDir, []);

			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		it('should handle commands with special characters in names', async () => {
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

			const result = claudeProfile.addSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(2);

			// Files go to .claude/commands/tm/ subdirectory
			const tmDir = path.join(tempDir, '.claude', 'commands', 'tm');
			expect(fs.existsSync(path.join(tmDir, 'test-cmd-123.md'))).toBe(true);
			expect(fs.existsSync(path.join(tmDir, 'test_underscore.md'))).toBe(true);
		});

		it('should handle commands with multiline content', async () => {
			const testCommands = [
				staticCommand({
					name: 'multiline',
					description: 'Multiline command',
					content: 'Line 1\nLine 2\nLine 3\n\nParagraph 2'
				})
			];

			const result = claudeProfile.addSlashCommands(tempDir, testCommands);

			// Files go to .claude/commands/tm/ subdirectory
			const filePath = path.join(
				tempDir,
				'.claude',
				'commands',
				'tm',
				'multiline.md'
			);
			const content = fs.readFileSync(filePath, 'utf-8');

			expect(content).toContain('Line 1\nLine 2\nLine 3');
			expect(content).toContain('Paragraph 2');
		});

		it('should preserve exact formatting in content', async () => {
			const testCommands = [
				staticCommand({
					name: 'formatted',
					description: 'Formatted command',
					content: '# Heading\n\n- Item 1\n- Item 2\n\n```code\nblock\n```'
				})
			];

			const result = claudeProfile.addSlashCommands(tempDir, testCommands);

			// Files go to .claude/commands/tm/ subdirectory
			const filePath = path.join(
				tempDir,
				'.claude',
				'commands',
				'tm',
				'formatted.md'
			);
			const content = fs.readFileSync(filePath, 'utf-8');

			expect(content).toContain('# Heading');
			expect(content).toContain('- Item 1\n- Item 2');
			expect(content).toContain('```code\nblock\n```');
		});
	});
});
