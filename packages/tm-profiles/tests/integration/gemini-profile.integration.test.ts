/**
 * @fileoverview Integration Tests for GeminiProfile
 * Tests actual filesystem operations for adding and removing slash commands.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GeminiProfile } from '../../src/slash-commands/profiles/gemini-profile.js';
import {
	staticCommand,
	dynamicCommand
} from '../../src/slash-commands/factories.js';

describe('GeminiProfile Integration Tests', () => {
	let tempDir: string;
	let profile: GeminiProfile;

	beforeEach(() => {
		// Create temporary directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-profile-test-'));
		profile = new GeminiProfile();
	});

	afterEach(() => {
		// Clean up temporary directory after each test
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('addSlashCommands()', () => {
		it('should create the .gemini/commands directory', () => {
			// Arrange
			const commands = [
				staticCommand({
					name: 'help',
					description: 'Show help',
					content: '# Help Content'
				})
			];

			// Act
			const result = profile.addSlashCommands(tempDir, commands);

			// Assert
			expect(result.success).toBe(true);
			const commandsDir = path.join(tempDir, '.gemini/commands');
			expect(fs.existsSync(commandsDir)).toBe(true);
			expect(fs.statSync(commandsDir).isDirectory()).toBe(true);
		});

		it('should write files with Python-style format (description="...", prompt = """...""")', () => {
			// Arrange
			const commands = [
				staticCommand({
					name: 'test',
					description: 'Test description',
					content: '# Test Content'
				})
			];

			// Act
			const result = profile.addSlashCommands(tempDir, commands);

			// Assert
			expect(result.success).toBe(true);
			const filePath = path.join(tempDir, '.gemini/commands/tm/test.toml');
			expect(fs.existsSync(filePath)).toBe(true);

			const fileContent = fs.readFileSync(filePath, 'utf-8');
			expect(fileContent).toBe(
				'description="Test description"\nprompt = """\n# Test Content\n"""\n'
			);
		});

		it('should return success result with correct count', () => {
			// Arrange
			const commands = [
				staticCommand({
					name: 'help',
					description: 'Show help',
					content: '# Help'
				}),
				staticCommand({
					name: 'deploy',
					description: 'Deploy app',
					content: '# Deploy'
				}),
				dynamicCommand(
					'review',
					'Review PR',
					'<pr-number>',
					'# Review\n\nPR: $ARGUMENTS'
				)
			];

			// Act
			const result = profile.addSlashCommands(tempDir, commands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(3);
			expect(result.files).toHaveLength(3);
			expect(result.files).toContain('help.toml');
			expect(result.files).toContain('deploy.toml');
			expect(result.files).toContain('review.toml');
			expect(result.directory).toBe(path.join(tempDir, '.gemini/commands/tm'));
		});

		it('should properly escape double quotes in description', () => {
			// Arrange
			const commands = [
				staticCommand({
					name: 'test',
					description: 'Test "quoted" description',
					content: '# Test Content'
				})
			];

			// Act
			const result = profile.addSlashCommands(tempDir, commands);

			// Assert
			expect(result.success).toBe(true);
			const filePath = path.join(tempDir, '.gemini/commands/tm/test.toml');
			const fileContent = fs.readFileSync(filePath, 'utf-8');
			expect(fileContent).toContain(
				'description="Test \\"quoted\\" description"'
			);
		});

		it('should handle multiple commands with different types', () => {
			// Arrange
			const commands = [
				staticCommand({
					name: 'static-cmd',
					description: 'Static command',
					content: '# Static Content\n\nThis is static.'
				}),
				dynamicCommand(
					'dynamic-cmd',
					'Dynamic command',
					'<arg>',
					'# Dynamic Content\n\nArgument: $ARGUMENTS'
				)
			];

			// Act
			const result = profile.addSlashCommands(tempDir, commands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(2);

			// Verify static command
			const staticFilePath = path.join(
				tempDir,
				'.gemini/commands/tm/static-cmd.toml'
			);
			const staticContent = fs.readFileSync(staticFilePath, 'utf-8');
			expect(staticContent).toContain('description="Static command"');
			expect(staticContent).toContain('# Static Content');
			expect(staticContent).not.toContain('$ARGUMENTS');

			// Verify dynamic command
			const dynamicFilePath = path.join(
				tempDir,
				'.gemini/commands/tm/dynamic-cmd.toml'
			);
			const dynamicContent = fs.readFileSync(dynamicFilePath, 'utf-8');
			expect(dynamicContent).toContain('description="Dynamic command"');
			expect(dynamicContent).toContain('Argument: $ARGUMENTS');
		});

		it('should create directory recursively if parent directories do not exist', () => {
			// Arrange
			const commands = [
				staticCommand({
					name: 'test',
					description: 'Test',
					content: '# Test'
				})
			];

			// Act
			const result = profile.addSlashCommands(tempDir, commands);

			// Assert
			expect(result.success).toBe(true);
			const commandsDir = path.join(tempDir, '.gemini/commands/tm');
			expect(fs.existsSync(commandsDir)).toBe(true);
		});

		it('should work when directory already exists', () => {
			// Arrange
			const commandsDir = path.join(tempDir, '.gemini/commands/tm');
			fs.mkdirSync(commandsDir, { recursive: true });

			const commands = [
				staticCommand({
					name: 'test',
					description: 'Test',
					content: '# Test'
				})
			];

			// Act
			const result = profile.addSlashCommands(tempDir, commands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(1);
		});
	});

	describe('removeSlashCommands()', () => {
		it('should remove only TaskMaster commands (preserves user files)', () => {
			// Arrange
			const commandsDir = path.join(tempDir, '.gemini/commands/tm');
			fs.mkdirSync(commandsDir, { recursive: true });

			// Add TaskMaster commands
			const tmCommands = [
				staticCommand({
					name: 'help',
					description: 'Show help',
					content: '# Help'
				}),
				staticCommand({
					name: 'deploy',
					description: 'Deploy',
					content: '# Deploy'
				})
			];
			profile.addSlashCommands(tempDir, tmCommands);

			// Add user's custom command
			const userFilePath = path.join(commandsDir, 'my-custom-command.toml');
			fs.writeFileSync(
				userFilePath,
				'description="My custom command"\nprompt = """\n# Custom\n"""\n'
			);

			// Act
			const result = profile.removeSlashCommands(tempDir, tmCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
			expect(result.files).toContain('help.toml');
			expect(result.files).toContain('deploy.toml');

			// Verify TaskMaster commands are removed
			expect(fs.existsSync(path.join(commandsDir, 'help.toml'))).toBe(false);
			expect(fs.existsSync(path.join(commandsDir, 'deploy.toml'))).toBe(false);

			// Verify user's custom command is preserved
			expect(fs.existsSync(userFilePath)).toBe(true);
		});

		it('should remove empty directory after cleanup', () => {
			// Arrange
			const commands = [
				staticCommand({
					name: 'test',
					description: 'Test',
					content: '# Test'
				})
			];

			// Add commands first
			profile.addSlashCommands(tempDir, commands);

			const commandsDir = path.join(tempDir, '.gemini/commands/tm');
			expect(fs.existsSync(commandsDir)).toBe(true);

			// Act
			const result = profile.removeSlashCommands(tempDir, commands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(1);

			// Directory should be removed since it's empty
			expect(fs.existsSync(commandsDir)).toBe(false);
		});

		it('should not remove directory if user files remain (removeEmptyDir=true)', () => {
			// Arrange
			const commandsDir = path.join(tempDir, '.gemini/commands/tm');
			fs.mkdirSync(commandsDir, { recursive: true });

			// Add TaskMaster command
			const tmCommands = [
				staticCommand({
					name: 'help',
					description: 'Help',
					content: '# Help'
				})
			];
			profile.addSlashCommands(tempDir, tmCommands);

			// Add user's custom command
			const userFilePath = path.join(commandsDir, 'my-command.toml');
			fs.writeFileSync(
				userFilePath,
				'description="User"\nprompt = """\n# User\n"""\n'
			);

			// Act
			const result = profile.removeSlashCommands(tempDir, tmCommands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(1);

			// Directory should still exist because user file remains
			expect(fs.existsSync(commandsDir)).toBe(true);
			expect(fs.existsSync(userFilePath)).toBe(true);
		});

		it('should not remove directory if removeEmptyDir=false', () => {
			// Arrange
			const commands = [
				staticCommand({
					name: 'test',
					description: 'Test',
					content: '# Test'
				})
			];

			// Add command first
			profile.addSlashCommands(tempDir, commands);

			const commandsDir = path.join(tempDir, '.gemini/commands/tm');

			// Act
			const result = profile.removeSlashCommands(tempDir, commands, false);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(1);

			// Directory should still exist because removeEmptyDir=false
			expect(fs.existsSync(commandsDir)).toBe(true);

			// Verify directory is empty
			const remainingFiles = fs.readdirSync(commandsDir);
			expect(remainingFiles).toHaveLength(0);
		});

		it('should return success with count 0 if directory does not exist', () => {
			// Arrange
			const commands = [
				staticCommand({
					name: 'test',
					description: 'Test',
					content: '# Test'
				})
			];

			// Act (directory doesn't exist)
			const result = profile.removeSlashCommands(tempDir, commands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
			expect(result.files).toHaveLength(0);
		});

		it('should handle removing subset of commands', () => {
			// Arrange
			const commandsDir = path.join(tempDir, '.gemini/commands/tm');
			fs.mkdirSync(commandsDir, { recursive: true });

			const allCommands = [
				staticCommand({
					name: 'help',
					description: 'Help',
					content: '# Help'
				}),
				staticCommand({
					name: 'deploy',
					description: 'Deploy',
					content: '# Deploy'
				}),
				staticCommand({
					name: 'test',
					description: 'Test',
					content: '# Test'
				})
			];

			// Add all commands
			profile.addSlashCommands(tempDir, allCommands);

			// Remove only 'help' and 'test'
			const commandsToRemove = [allCommands[0], allCommands[2]];

			// Act
			const result = profile.removeSlashCommands(tempDir, commandsToRemove);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
			expect(result.files).toContain('help.toml');
			expect(result.files).toContain('test.toml');

			// Verify removed commands
			expect(fs.existsSync(path.join(commandsDir, 'help.toml'))).toBe(false);
			expect(fs.existsSync(path.join(commandsDir, 'test.toml'))).toBe(false);

			// Verify 'deploy' remains
			expect(fs.existsSync(path.join(commandsDir, 'deploy.toml'))).toBe(true);
		});

		it('should match commands case-insensitively', () => {
			// Arrange
			const commandsDir = path.join(tempDir, '.gemini/commands/tm');
			fs.mkdirSync(commandsDir, { recursive: true });

			// Create file with uppercase in name
			const upperFilePath = path.join(commandsDir, 'HELP.toml');
			fs.writeFileSync(
				upperFilePath,
				'description="Help"\nprompt = """\n# Help\n"""\n'
			);

			const commands = [
				staticCommand({
					name: 'help',
					description: 'Help',
					content: '# Help'
				})
			];

			// Act
			const result = profile.removeSlashCommands(tempDir, commands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(1);
			expect(fs.existsSync(upperFilePath)).toBe(false);
		});
	});

	describe('Full workflow: add then remove', () => {
		it('should successfully add and then remove commands', () => {
			// Arrange
			const commands = [
				staticCommand({
					name: 'help',
					description: 'Show help',
					content: '# Help Content'
				}),
				dynamicCommand(
					'review',
					'Review PR',
					'<pr-number>',
					'# Review\n\nPR: $ARGUMENTS'
				)
			];

			const commandsDir = path.join(tempDir, '.gemini/commands');
			const tmDir = path.join(commandsDir, 'tm');

			// Act - Add commands
			const addResult = profile.addSlashCommands(tempDir, commands);

			// Assert - Add worked
			expect(addResult.success).toBe(true);
			expect(addResult.count).toBe(2);
			expect(fs.existsSync(tmDir)).toBe(true);
			expect(fs.existsSync(path.join(tmDir, 'help.toml'))).toBe(true);
			expect(fs.existsSync(path.join(tmDir, 'review.toml'))).toBe(true);

			// Act - Remove commands
			const removeResult = profile.removeSlashCommands(tempDir, commands);

			// Assert - Remove worked
			expect(removeResult.success).toBe(true);
			expect(removeResult.count).toBe(2);
			// The tm subdirectory should be removed
			expect(fs.existsSync(tmDir)).toBe(false);
		});
	});
});
