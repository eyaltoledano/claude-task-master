/**
 * @fileoverview Unit Tests for OpenCodeProfile
 * Tests the OpenCode slash command profile formatting and metadata.
 */

import { describe, it, expect } from 'vitest';
import { OpenCodeProfile } from './opencode-profile.js';
import { staticCommand, dynamicCommand } from '../factories.js';

describe('OpenCodeProfile', () => {
	describe('Profile Metadata', () => {
		it('should have correct profile name', () => {
			// Arrange
			const profile = new OpenCodeProfile();

			// Act & Assert
			expect(profile.name).toBe('opencode');
		});

		it('should have correct display name', () => {
			// Arrange
			const profile = new OpenCodeProfile();

			// Act & Assert
			expect(profile.displayName).toBe('OpenCode');
		});

		it('should have correct commands directory', () => {
			// Arrange
			const profile = new OpenCodeProfile();

			// Act & Assert
			expect(profile.commandsDir).toBe('.opencode/command');
		});

		it('should have correct file extension', () => {
			// Arrange
			const profile = new OpenCodeProfile();

			// Act & Assert
			expect(profile.extension).toBe('.md');
		});
	});

	describe('supportsCommands getter', () => {
		it('should return true when commandsDir is non-empty', () => {
			// Arrange
			const profile = new OpenCodeProfile();

			// Act
			const result = profile.supportsCommands;

			// Assert
			expect(result).toBe(true);
		});
	});

	describe('supportsNestedCommands property', () => {
		it('should be false (uses tm- prefix instead of subdirectory)', () => {
			// Arrange
			const profile = new OpenCodeProfile();

			// Act & Assert
			expect(profile.supportsNestedCommands).toBe(false);
		});
	});

	describe('getFilename() method', () => {
		it('should add tm- prefix and .md extension to command name', () => {
			// Arrange
			const profile = new OpenCodeProfile();

			// Act
			const filename = profile.getFilename('help');

			// Assert
			expect(filename).toBe('tm-help.md');
		});

		it('should handle command names with hyphens', () => {
			// Arrange
			const profile = new OpenCodeProfile();

			// Act
			const filename = profile.getFilename('my-command');

			// Assert
			expect(filename).toBe('tm-my-command.md');
		});

		it('should handle command names with underscores', () => {
			// Arrange
			const profile = new OpenCodeProfile();

			// Act
			const filename = profile.getFilename('my_command');

			// Assert
			expect(filename).toBe('tm-my_command.md');
		});
	});

	describe('format() method for static commands', () => {
		it('should add frontmatter with description for simple static command', () => {
			// Arrange
			const profile = new OpenCodeProfile();
			const command = staticCommand({
				name: 'help',
				description: 'Show available commands',
				content: '# Help\n\nList of available commands...'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('tm-help.md');
			expect(result.content).toBe(
				'---\ndescription: Show available commands\n---\n# Help\n\nList of available commands...'
			);
		});

		it('should preserve multiline content with frontmatter', () => {
			// Arrange
			const profile = new OpenCodeProfile();
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
			expect(result.filename).toBe('tm-task-runner.md');
			expect(result.content).toBe(
				'---\ndescription: Run automated tasks\n---\n' + multilineContent
			);
		});

		it('should preserve code blocks in content with frontmatter', () => {
			// Arrange
			const profile = new OpenCodeProfile();
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
			expect(result.content).toBe(
				'---\ndescription: Deploy the application\n---\n' + contentWithCode
			);
		});

		it('should preserve special characters in content with frontmatter', () => {
			// Arrange
			const profile = new OpenCodeProfile();
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
			expect(result.content).toBe(
				'---\ndescription: Command with special chars\n---\n' +
					contentWithSpecialChars
			);
		});
	});

	describe('format() method for dynamic commands', () => {
		it('should include description in frontmatter and preserve $ARGUMENTS placeholder', () => {
			// Arrange
			const profile = new OpenCodeProfile();
			const command = dynamicCommand(
				'review',
				'Review a pull request',
				'<pr-number>',
				'# Review PR\n\nReviewing PR: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('tm-review.md');
			expect(result.content).toBe(
				'---\ndescription: Review a pull request\n---\n# Review PR\n\nReviewing PR: $ARGUMENTS'
			);
			expect(result.content).toContain('$ARGUMENTS');
		});

		it('should preserve multiple $ARGUMENTS placeholders with frontmatter', () => {
			// Arrange
			const profile = new OpenCodeProfile();
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
				'---\ndescription: Compare two items\n---\nFirst: $ARGUMENTS\nSecond: $ARGUMENTS\nBoth: $ARGUMENTS'
			);
			expect(result.content.match(/\$ARGUMENTS/g)?.length).toBe(3);
		});

		it('should preserve $ARGUMENTS in complex markdown content with frontmatter', () => {
			// Arrange
			const profile = new OpenCodeProfile();
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
			expect(result.content).toBe(
				'---\ndescription: Search the codebase\n---\n' + complexContent
			);
			expect(result.content.match(/\$ARGUMENTS/g)?.length).toBe(3);
		});
	});

	describe('formatAll() method', () => {
		it('should format multiple commands correctly with frontmatter', () => {
			// Arrange
			const profile = new OpenCodeProfile();
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
			expect(results[0].filename).toBe('tm-help.md');
			expect(results[0].content).toBe(
				'---\ndescription: Show help\n---\n# Help Content'
			);
			expect(results[1].filename).toBe('tm-run.md');
			expect(results[1].content).toBe(
				'---\ndescription: Run a command\n---\nRunning: $ARGUMENTS'
			);
		});

		it('should return empty array for empty input', () => {
			// Arrange
			const profile = new OpenCodeProfile();

			// Act
			const results = profile.formatAll([]);

			// Assert
			expect(results).toEqual([]);
		});
	});

	describe('getCommandsPath() method', () => {
		it('should return correct absolute path for commands directory', () => {
			// Arrange
			const profile = new OpenCodeProfile();
			const projectRoot = '/home/user/my-project';

			// Act
			const commandsPath = profile.getCommandsPath(projectRoot);

			// Assert
			expect(commandsPath).toBe('/home/user/my-project/.opencode/command');
		});

		it('should handle project root with trailing slash', () => {
			// Arrange
			const profile = new OpenCodeProfile();
			const projectRoot = '/home/user/my-project/';

			// Act
			const commandsPath = profile.getCommandsPath(projectRoot);

			// Assert
			// path.join normalizes the path
			expect(commandsPath).toBe('/home/user/my-project/.opencode/command');
		});
	});
});
