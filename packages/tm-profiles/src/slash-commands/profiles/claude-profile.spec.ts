import { describe, expect, it } from 'vitest';
import { ClaudeProfile } from './claude-profile.js';
import { staticCommand, dynamicCommand } from '../factories.js';

describe('ClaudeProfile', () => {
	describe('Profile metadata', () => {
		it('should have correct name', () => {
			// Arrange
			const profile = new ClaudeProfile();

			// Act & Assert
			expect(profile.name).toBe('claude');
		});

		it('should have correct displayName', () => {
			// Arrange
			const profile = new ClaudeProfile();

			// Act & Assert
			expect(profile.displayName).toBe('Claude Code');
		});

		it('should have correct commandsDir', () => {
			// Arrange
			const profile = new ClaudeProfile();

			// Act & Assert
			expect(profile.commandsDir).toBe('.claude/commands');
		});

		it('should have correct extension', () => {
			// Arrange
			const profile = new ClaudeProfile();

			// Act & Assert
			expect(profile.extension).toBe('.md');
		});
	});

	describe('supportsCommands', () => {
		it('should return true when commandsDir is not empty', () => {
			// Arrange
			const profile = new ClaudeProfile();

			// Act
			const result = profile.supportsCommands;

			// Assert
			expect(result).toBe(true);
		});
	});

	describe('getFilename', () => {
		it('should append .md extension to command name', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const commandName = 'goham';

			// Act
			const result = profile.getFilename(commandName);

			// Assert
			expect(result).toBe('goham.md');
		});

		it('should handle command names with hyphens', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const commandName = 'my-command';

			// Act
			const result = profile.getFilename(commandName);

			// Assert
			expect(result).toBe('my-command.md');
		});

		it('should handle single character command names', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const commandName = 'x';

			// Act
			const result = profile.getFilename(commandName);

			// Assert
			expect(result).toBe('x.md');
		});
	});

	describe('format() for static commands', () => {
		it('should format static command with description on first line', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = staticCommand({
				name: 'goham',
				description: 'Start Working with Hamster Brief',
				content: '# Start Working...'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(
				'Start Working with Hamster Brief\n# Start Working...'
			);
		});

		it('should return correct filename for static command', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = staticCommand({
				name: 'help',
				description: 'Show help',
				content: '# Help\n\nList of commands...'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('help.md');
		});

		it('should handle static command with empty content', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = staticCommand({
				name: 'empty',
				description: 'Empty command',
				content: ''
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe('Empty command\n');
		});

		it('should handle static command with multiline content', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = staticCommand({
				name: 'multi',
				description: 'Multiline command',
				content: '# Title\n\nParagraph 1\n\nParagraph 2'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(
				'Multiline command\n# Title\n\nParagraph 1\n\nParagraph 2'
			);
		});

		it('should include Arguments line for static command with argumentHint', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = staticCommand({
				name: 'goham',
				description: 'Start Working with Hamster Brief',
				argumentHint: '[brief-url]',
				content: '# Start Working...'
			});

			// Act
			const result = profile.format(command);

			// Assert
			// Static commands with argumentHint should include Arguments line
			expect(result.content).toBe(
				'Start Working with Hamster Brief\n\nArguments: $ARGUMENTS\n# Start Working...'
			);
		});
	});

	describe('format() for dynamic commands', () => {
		it('should format dynamic command with Arguments line', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = dynamicCommand(
				'help',
				'Help',
				'[command]',
				'Show help for Task Master AI commands...\n\nCommand: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(
				'Help\n\nArguments: $ARGUMENTS\nShow help for Task Master AI commands...\n\nCommand: $ARGUMENTS'
			);
		});

		it('should return correct filename for dynamic command', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = dynamicCommand(
				'search',
				'Search codebase',
				'<query>',
				'Search for: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('search.md');
		});

		it('should preserve $ARGUMENTS placeholder in content', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = dynamicCommand(
				'run',
				'Run command',
				'<cmd>',
				'Execute: $ARGUMENTS\n\nDone!'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain('Execute: $ARGUMENTS');
		});

		it('should handle dynamic command with multiple $ARGUMENTS placeholders', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = dynamicCommand(
				'repeat',
				'Repeat input',
				'<text>',
				'First: $ARGUMENTS\nSecond: $ARGUMENTS\nThird: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			const placeholderCount = (result.content.match(/\$ARGUMENTS/g) || [])
				.length;
			// Header has 1 + content has 3 = 4 total
			expect(placeholderCount).toBe(4);
		});

		it('should include empty line between description and Arguments line', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = dynamicCommand(
				'test',
				'Test description',
				'<arg>',
				'Content with $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			const lines = result.content.split('\n');
			expect(lines[0]).toBe('Test description');
			expect(lines[1]).toBe('');
			expect(lines[2]).toBe('Arguments: $ARGUMENTS');
		});

		it('should include empty line between Arguments line and content', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = dynamicCommand(
				'test',
				'Test',
				'<arg>',
				'Content with $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			const lines = result.content.split('\n');
			expect(lines[2]).toBe('Arguments: $ARGUMENTS');
			expect(lines[3]).toBe('Content with $ARGUMENTS');
		});
	});

	describe('format() output structure', () => {
		it('should return object with filename and content properties', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const command = staticCommand({
				name: 'test',
				description: 'Test',
				content: 'Content'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result).toHaveProperty('filename');
			expect(result).toHaveProperty('content');
			expect(typeof result.filename).toBe('string');
			expect(typeof result.content).toBe('string');
		});
	});

	describe('formatAll()', () => {
		it('should format multiple commands', () => {
			// Arrange
			const profile = new ClaudeProfile();
			const commands = [
				staticCommand({
					name: 'cmd1',
					description: 'Command 1',
					content: 'Content 1'
				}),
				dynamicCommand(
					'cmd2',
					'Command 2',
					'<arg>',
					'Content 2 with $ARGUMENTS'
				)
			];

			// Act
			const results = profile.formatAll(commands);

			// Assert
			expect(results).toHaveLength(2);
			expect(results[0].filename).toBe('cmd1.md');
			expect(results[1].filename).toBe('cmd2.md');
		});

		it('should return empty array for empty input', () => {
			// Arrange
			const profile = new ClaudeProfile();

			// Act
			const results = profile.formatAll([]);

			// Assert
			expect(results).toEqual([]);
		});
	});
});
