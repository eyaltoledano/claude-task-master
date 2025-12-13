/**
 * @fileoverview Integration Tests for RooProfile
 * Tests actual filesystem operations using addSlashCommands and removeSlashCommands methods.
 *
 * RooProfile details:
 * - commandsDir: '.roo/commands'
 * - extension: '.md'
 * - Format: YAML frontmatter with description and optional argument-hint
 * - supportsNestedCommands: false (uses tm- prefix for filenames)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { RooProfile } from '../../src/slash-commands/profiles/roo-profile.js';
import {
	staticCommand,
	dynamicCommand
} from '../../src/slash-commands/factories.js';

describe('RooProfile Integration Tests', () => {
	let tempDir: string;
	let rooProfile: RooProfile;

	beforeEach(() => {
		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roo-profile-test-'));
		rooProfile = new RooProfile();
	});

	afterEach(() => {
		// Clean up temporary directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('addSlashCommands', () => {
		it('should create the .roo/commands directory', () => {
			// Arrange
			const testCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Test command',
					content: '# Test Content'
				})
			];

			// Act
			const result = rooProfile.addSlashCommands(tempDir, testCommands);

			// Assert
			const commandsDir = path.join(tempDir, '.roo', 'commands');
			expect(fs.existsSync(commandsDir)).toBe(true);
			expect(fs.statSync(commandsDir).isDirectory()).toBe(true);
			expect(result.success).toBe(true);
		});

		it('should write files with frontmatter and tm- prefix', () => {
			// Arrange
			const testCommands = [
				staticCommand({
					name: 'plain-test',
					description: 'Plain test command',
					content: '# Original Content\n\nThis should remain unchanged.'
				})
			];

			// Act
			rooProfile.addSlashCommands(tempDir, testCommands);

			// Assert
			const filePath = path.join(
				tempDir,
				'.roo',
				'commands',
				'tm-plain-test.md'
			);
			expect(fs.existsSync(filePath)).toBe(true);

			const content = fs.readFileSync(filePath, 'utf-8');
			// Roo uses YAML frontmatter for metadata
			expect(content).toBe(
				'---\ndescription: Plain test command\n---\n\n# Original Content\n\nThis should remain unchanged.'
			);
		});

		it('should include argument-hint in frontmatter for dynamic commands', () => {
			// Arrange
			const testCommands = [
				dynamicCommand(
					'dynamic-test',
					'Dynamic test command',
					'[task-id]',
					'Process task: $ARGUMENTS\n\nThis processes the specified task.'
				)
			];

			// Act
			rooProfile.addSlashCommands(tempDir, testCommands);

			// Assert
			const filePath = path.join(
				tempDir,
				'.roo',
				'commands',
				'tm-dynamic-test.md'
			);
			expect(fs.existsSync(filePath)).toBe(true);

			const content = fs.readFileSync(filePath, 'utf-8');
			// Roo uses YAML frontmatter with argument-hint
			expect(content).toBe(
				'---\ndescription: Dynamic test command\nargument-hint: [task-id]\n---\n\nProcess task: $ARGUMENTS\n\nThis processes the specified task.'
			);
			expect(content).toContain('$ARGUMENTS');
		});

		it('should return success result with correct count', () => {
			// Arrange
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
				dynamicCommand(
					'cmd3',
					'Third command',
					'[arg]',
					'Content 3: $ARGUMENTS'
				)
			];

			// Act
			const result = rooProfile.addSlashCommands(tempDir, testCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(3);
			expect(result.directory).toBe(path.join(tempDir, '.roo', 'commands'));
			expect(result.files).toHaveLength(3);
			expect(result.files).toContain('tm-cmd1.md');
			expect(result.files).toContain('tm-cmd2.md');
			expect(result.files).toContain('tm-cmd3.md');
		});

		it('should overwrite existing files on re-run', () => {
			// Arrange
			const initialCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Initial description',
					content: 'Initial content'
				})
			];

			// Act - First run
			rooProfile.addSlashCommands(tempDir, initialCommands);

			const filePath = path.join(tempDir, '.roo', 'commands', 'tm-test-cmd.md');
			const initialContent = fs.readFileSync(filePath, 'utf-8');
			expect(initialContent).toBe(
				'---\ndescription: Initial description\n---\n\nInitial content'
			);

			// Act - Re-run with updated command
			const updatedCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Updated description',
					content: 'Updated content'
				})
			];

			rooProfile.addSlashCommands(tempDir, updatedCommands);

			// Assert
			const updatedContent = fs.readFileSync(filePath, 'utf-8');
			expect(updatedContent).toBe(
				'---\ndescription: Updated description\n---\n\nUpdated content'
			);
			expect(updatedContent).not.toContain('Initial');
		});

		it('should handle multiple commands with mixed types', () => {
			// Arrange
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

			// Act
			const result = rooProfile.addSlashCommands(tempDir, testCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(3);

			// Verify all files exist (with tm- prefix)
			const static1Path = path.join(
				tempDir,
				'.roo',
				'commands',
				'tm-static1.md'
			);
			const dynamic1Path = path.join(
				tempDir,
				'.roo',
				'commands',
				'tm-dynamic1.md'
			);
			const static2Path = path.join(
				tempDir,
				'.roo',
				'commands',
				'tm-static2.md'
			);

			expect(fs.existsSync(static1Path)).toBe(true);
			expect(fs.existsSync(dynamic1Path)).toBe(true);
			expect(fs.existsSync(static2Path)).toBe(true);

			// Verify content includes frontmatter
			const static1Content = fs.readFileSync(static1Path, 'utf-8');
			expect(static1Content).toBe(
				'---\ndescription: Static command 1\n---\n\nStatic content 1'
			);

			const dynamic1Content = fs.readFileSync(dynamic1Path, 'utf-8');
			expect(dynamic1Content).toBe(
				'---\ndescription: Dynamic command 1\nargument-hint: [id]\n---\n\nDynamic content $ARGUMENTS'
			);
		});

		it('should handle empty command list', () => {
			// Act
			const result = rooProfile.addSlashCommands(tempDir, []);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
			expect(result.files).toHaveLength(0);
		});

		it('should preserve multiline content with frontmatter', () => {
			// Arrange
			const multilineContent = `# Task Runner

## Description
Run automated tasks for the project.

## Steps
1. Check dependencies
2. Run build
3. Execute tests
4. Generate report`;

			const testCommands = [
				staticCommand({
					name: 'task-runner',
					description: 'Run automated tasks',
					content: multilineContent
				})
			];

			// Act
			rooProfile.addSlashCommands(tempDir, testCommands);

			// Assert
			const filePath = path.join(
				tempDir,
				'.roo',
				'commands',
				'tm-task-runner.md'
			);
			const content = fs.readFileSync(filePath, 'utf-8');
			expect(content).toBe(
				'---\ndescription: Run automated tasks\n---\n\n' + multilineContent
			);
		});

		it('should preserve code blocks and special characters in content with frontmatter', () => {
			// Arrange
			const contentWithCode = `# Deploy

Run the deployment:

\`\`\`bash
npm run deploy
\`\`\`

Use \`$HOME\` and \`$PATH\` variables. Also: <tag> & "quotes"`;

			const testCommands = [
				staticCommand({
					name: 'deploy',
					description: 'Deploy the application',
					content: contentWithCode
				})
			];

			// Act
			rooProfile.addSlashCommands(tempDir, testCommands);

			// Assert
			const filePath = path.join(tempDir, '.roo', 'commands', 'tm-deploy.md');
			const content = fs.readFileSync(filePath, 'utf-8');
			expect(content).toBe(
				'---\ndescription: Deploy the application\n---\n\n' + contentWithCode
			);
			expect(content).toContain('```bash');
			expect(content).toContain('$HOME');
			expect(content).toContain('<tag> & "quotes"');
		});
	});

	describe('removeSlashCommands', () => {
		it('should remove only TaskMaster commands and preserve user files', () => {
			// Arrange - Add TaskMaster commands
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

			rooProfile.addSlashCommands(tempDir, tmCommands);

			// Create a user file manually
			const commandsDir = path.join(tempDir, '.roo', 'commands');
			const userFilePath = path.join(commandsDir, 'user-custom.md');
			fs.writeFileSync(userFilePath, 'User custom command\n\nUser content');

			// Act - Remove TaskMaster commands
			const result = rooProfile.removeSlashCommands(tempDir, tmCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
			expect(result.files).toHaveLength(2);

			// Verify TaskMaster files are removed (tm- prefix is added automatically)
			expect(fs.existsSync(path.join(commandsDir, 'tm-cmd1.md'))).toBe(false);
			expect(fs.existsSync(path.join(commandsDir, 'tm-cmd2.md'))).toBe(false);

			// Verify user file is preserved
			expect(fs.existsSync(userFilePath)).toBe(true);
			const userContent = fs.readFileSync(userFilePath, 'utf-8');
			expect(userContent).toContain('User custom command');
		});

		it('should remove empty directory after cleanup', () => {
			// Arrange
			const testCommands = [
				staticCommand({
					name: 'only-cmd',
					description: 'Only command',
					content: 'Only content'
				})
			];

			rooProfile.addSlashCommands(tempDir, testCommands);

			const commandsDir = path.join(tempDir, '.roo', 'commands');
			expect(fs.existsSync(commandsDir)).toBe(true);

			// Act - Remove all TaskMaster commands
			const result = rooProfile.removeSlashCommands(tempDir, testCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(1);
			// Directory should be removed when empty (default behavior)
			expect(fs.existsSync(commandsDir)).toBe(false);
		});

		it('should keep directory when user files remain', () => {
			// Arrange
			const tmCommands = [
				staticCommand({
					name: 'cmd',
					description: 'TaskMaster command',
					content: 'TM Content'
				})
			];

			rooProfile.addSlashCommands(tempDir, tmCommands);

			// Add user file
			const commandsDir = path.join(tempDir, '.roo', 'commands');
			const userFilePath = path.join(commandsDir, 'my-command.md');
			fs.writeFileSync(userFilePath, 'My custom command');

			// Act - Remove TaskMaster commands
			const result = rooProfile.removeSlashCommands(tempDir, tmCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(1);
			// Directory should still exist because user file remains
			expect(fs.existsSync(commandsDir)).toBe(true);
			expect(fs.existsSync(userFilePath)).toBe(true);
		});

		it('should handle removal when no files exist', () => {
			// Arrange
			const testCommands = [
				staticCommand({
					name: 'nonexistent',
					description: 'Non-existent command',
					content: 'Content'
				})
			];

			// Act - Don't add commands, just try to remove
			const result = rooProfile.removeSlashCommands(tempDir, testCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
			expect(result.files).toHaveLength(0);
		});

		it('should handle removal when directory does not exist', () => {
			// Arrange
			const testCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Test command',
					content: 'Content'
				})
			];

			// Ensure .roo/commands doesn't exist
			const commandsDir = path.join(tempDir, '.roo', 'commands');
			expect(fs.existsSync(commandsDir)).toBe(false);

			// Act
			const result = rooProfile.removeSlashCommands(tempDir, testCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		it('should remove mixed command types', () => {
			// Arrange
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

			rooProfile.addSlashCommands(tempDir, testCommands);

			const commandsDir = path.join(tempDir, '.roo', 'commands');
			expect(fs.existsSync(path.join(commandsDir, 'tm-static-cmd.md'))).toBe(
				true
			);
			expect(fs.existsSync(path.join(commandsDir, 'tm-dynamic-cmd.md'))).toBe(
				true
			);

			// Act
			const result = rooProfile.removeSlashCommands(tempDir, testCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
			expect(fs.existsSync(path.join(commandsDir, 'tm-static-cmd.md'))).toBe(
				false
			);
			expect(fs.existsSync(path.join(commandsDir, 'tm-dynamic-cmd.md'))).toBe(
				false
			);
			// Directory should be removed since it's empty
			expect(fs.existsSync(commandsDir)).toBe(false);
		});

		it('should not remove directory when removeEmptyDir is false', () => {
			// Arrange
			const testCommands = [
				staticCommand({
					name: 'test-cmd',
					description: 'Test command',
					content: 'Content'
				})
			];

			rooProfile.addSlashCommands(tempDir, testCommands);

			const commandsDir = path.join(tempDir, '.roo', 'commands');
			expect(fs.existsSync(commandsDir)).toBe(true);

			// Act - Remove with removeEmptyDir=false
			const result = rooProfile.removeSlashCommands(
				tempDir,
				testCommands,
				false
			);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(1);
			// Directory should still exist even though it's empty
			expect(fs.existsSync(commandsDir)).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('should handle commands with special characters in names', () => {
			// Arrange
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

			// Act
			const result = rooProfile.addSlashCommands(tempDir, testCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(2);

			const commandsDir = path.join(tempDir, '.roo', 'commands');
			expect(fs.existsSync(path.join(commandsDir, 'tm-test-cmd-123.md'))).toBe(
				true
			);
			expect(
				fs.existsSync(path.join(commandsDir, 'tm-test_underscore.md'))
			).toBe(true);
		});

		it('should preserve exact formatting in complex content with frontmatter', () => {
			// Arrange
			const complexContent = `# Search Command

## Input
User provided: $ARGUMENTS

## Steps
1. Parse the input: \`$ARGUMENTS\`
2. Search for matches
3. Display results

\`\`\`
Query: $ARGUMENTS
\`\`\``;

			const testCommands = [
				dynamicCommand(
					'search',
					'Search the codebase',
					'<query>',
					complexContent
				)
			];

			// Act
			rooProfile.addSlashCommands(tempDir, testCommands);

			// Assert
			const filePath = path.join(tempDir, '.roo', 'commands', 'tm-search.md');
			const content = fs.readFileSync(filePath, 'utf-8');
			expect(content).toBe(
				'---\ndescription: Search the codebase\nargument-hint: <query>\n---\n\n' +
					complexContent
			);
			// Verify all $ARGUMENTS placeholders are preserved
			expect(content.match(/\$ARGUMENTS/g)?.length).toBe(3);
		});
	});
});
