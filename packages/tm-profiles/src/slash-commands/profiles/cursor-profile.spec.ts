/**
 * @fileoverview Unit Tests for CursorProfile
 * Tests the Cursor slash command profile formatting and metadata.
 */

import { describe, it, expect } from 'vitest';
import { CursorProfile } from './cursor-profile.js';
import { staticCommand, dynamicCommand } from '../factories.js';

describe('CursorProfile', () => {
	describe('Profile Metadata', () => {
		it('should have correct profile name', () => {
			// Arrange
			const profile = new CursorProfile();

			// Act & Assert
			expect(profile.name).toBe('cursor');
		});

		it('should have correct display name', () => {
			// Arrange
			const profile = new CursorProfile();

			// Act & Assert
			expect(profile.displayName).toBe('Cursor');
		});

		it('should have correct commands directory', () => {
			// Arrange
			const profile = new CursorProfile();

			// Act & Assert
			expect(profile.commandsDir).toBe('.cursor/commands');
		});

		it('should have correct file extension', () => {
			// Arrange
			const profile = new CursorProfile();

			// Act & Assert
			expect(profile.extension).toBe('.md');
		});
	});

	describe('supportsCommands getter', () => {
		it('should return true when commandsDir is non-empty', () => {
			// Arrange
			const profile = new CursorProfile();

			// Act
			const result = profile.supportsCommands;

			// Assert
			expect(result).toBe(true);
		});
	});

	describe('getFilename() method', () => {
		it('should append .md extension to command name', () => {
			// Arrange
			const profile = new CursorProfile();

			// Act
			const filename = profile.getFilename('help');

			// Assert
			expect(filename).toBe('help.md');
		});

		it('should handle command names with hyphens', () => {
			// Arrange
			const profile = new CursorProfile();

			// Act
			const filename = profile.getFilename('my-command');

			// Assert
			expect(filename).toBe('my-command.md');
		});

		it('should handle command names with underscores', () => {
			// Arrange
			const profile = new CursorProfile();

			// Act
			const filename = profile.getFilename('my_command');

			// Assert
			expect(filename).toBe('my_command.md');
		});
	});

	describe('format() method for static commands', () => {
		it('should return content unchanged for simple static command', () => {
			// Arrange
			const profile = new CursorProfile();
			const command = staticCommand({
				name: 'help',
				description: 'Show available commands',
				content: '# Help\n\nList of available commands...'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('help.md');
			expect(result.content).toBe('# Help\n\nList of available commands...');
		});

		it('should preserve multiline content exactly', () => {
			// Arrange
			const profile = new CursorProfile();
			const multilineContent = `# Task Runner

## Description
Run automated tasks for the project.

## Steps
1. Check dependencies
2. Run build
3. Execute tests
4. Generate report`;

			const command = staticCommand({
				name: 'task-runner',
				description: 'Run automated tasks',
				content: multilineContent
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('task-runner.md');
			expect(result.content).toBe(multilineContent);
		});

		it('should preserve static command with argumentHint', () => {
			// Arrange
			const profile = new CursorProfile();
			const command = staticCommand({
				name: 'analyze',
				description: 'Analyze codebase',
				argumentHint: '[path]',
				content: '# Analyze\n\nAnalyze the specified path.'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('analyze.md');
			expect(result.content).toBe('# Analyze\n\nAnalyze the specified path.');
		});

		it('should preserve code blocks in content', () => {
			// Arrange
			const profile = new CursorProfile();
			const contentWithCode = `# Deploy

Run the deployment:

\`\`\`bash
npm run deploy
\`\`\`

Done!`;

			const command = staticCommand({
				name: 'deploy',
				description: 'Deploy the application',
				content: contentWithCode
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(contentWithCode);
		});

		it('should preserve special characters in content', () => {
			// Arrange
			const profile = new CursorProfile();
			const contentWithSpecialChars =
				'# Special\n\nUse `$HOME` and `$PATH` variables. Also: <tag> & "quotes"';

			const command = staticCommand({
				name: 'special',
				description: 'Command with special chars',
				content: contentWithSpecialChars
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(contentWithSpecialChars);
		});
	});

	describe('format() method for dynamic commands', () => {
		it('should preserve $ARGUMENTS placeholder unchanged', () => {
			// Arrange
			const profile = new CursorProfile();
			const command = dynamicCommand(
				'review',
				'Review a pull request',
				'<pr-number>',
				'# Review PR\n\nReviewing PR: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('review.md');
			expect(result.content).toBe('# Review PR\n\nReviewing PR: $ARGUMENTS');
			expect(result.content).toContain('$ARGUMENTS');
		});

		it('should preserve multiple $ARGUMENTS placeholders', () => {
			// Arrange
			const profile = new CursorProfile();
			const command = dynamicCommand(
				'compare',
				'Compare two items',
				'<item1> <item2>',
				'First: $ARGUMENTS\nSecond: $ARGUMENTS\nBoth: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(
				'First: $ARGUMENTS\nSecond: $ARGUMENTS\nBoth: $ARGUMENTS'
			);
			expect(result.content.match(/\$ARGUMENTS/g)?.length).toBe(3);
		});

		it('should preserve $ARGUMENTS in complex markdown content', () => {
			// Arrange
			const profile = new CursorProfile();
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

			const command = dynamicCommand(
				'search',
				'Search the codebase',
				'<query>',
				complexContent
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(complexContent);
			expect(result.content.match(/\$ARGUMENTS/g)?.length).toBe(3);
		});
	});

	describe('formatAll() method', () => {
		it('should format multiple commands correctly', () => {
			// Arrange
			const profile = new CursorProfile();
			const commands = [
				staticCommand({
					name: 'help',
					description: 'Show help',
					content: '# Help Content'
				}),
				dynamicCommand('run', 'Run a command', '<cmd>', 'Running: $ARGUMENTS')
			];

			// Act
			const results = profile.formatAll(commands);

			// Assert
			expect(results).toHaveLength(2);
			expect(results[0].filename).toBe('help.md');
			expect(results[0].content).toBe('# Help Content');
			expect(results[1].filename).toBe('run.md');
			expect(results[1].content).toBe('Running: $ARGUMENTS');
		});

		it('should return empty array for empty input', () => {
			// Arrange
			const profile = new CursorProfile();

			// Act
			const results = profile.formatAll([]);

			// Assert
			expect(results).toEqual([]);
		});
	});

	describe('getCommandsPath() method', () => {
		it('should return correct absolute path for commands directory with tm subdirectory', () => {
			// Arrange
			const profile = new CursorProfile();
			const projectRoot = '/home/user/my-project';

			// Act
			const commandsPath = profile.getCommandsPath(projectRoot);

			// Assert - Cursor supports nested commands, so path includes tm/ subdirectory
			expect(commandsPath).toBe('/home/user/my-project/.cursor/commands/tm');
		});

		it('should handle project root with trailing slash', () => {
			// Arrange
			const profile = new CursorProfile();
			const projectRoot = '/home/user/my-project/';

			// Act
			const commandsPath = profile.getCommandsPath(projectRoot);

			// Assert - path.join normalizes the path, includes tm/ subdirectory
			expect(commandsPath).toBe('/home/user/my-project/.cursor/commands/tm');
		});
	});

	describe('supportsNestedCommands property', () => {
		it('should be true for Cursor profile', () => {
			// Arrange
			const profile = new CursorProfile();

			// Assert - Cursor supports nested command directories
			expect(profile.supportsNestedCommands).toBe(true);
		});
	});
});
