/**
 * @fileoverview Unit tests for CodexProfile
 * Tests the Codex CLI slash command profile formatting.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dynamicCommand, staticCommand } from '../factories.js';
import { CodexProfile } from './codex-profile.js';

describe('CodexProfile', () => {
	describe('Profile metadata', () => {
		it('should have correct profile name', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act & Assert
			expect(profile.name).toBe('codex');
		});

		it('should have correct display name', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act & Assert
			expect(profile.displayName).toBe('Codex');
		});

		it('should have correct commands directory', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act & Assert
			expect(profile.commandsDir).toBe('.codex/prompts');
		});

		it('should have .md file extension', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act & Assert
			expect(profile.extension).toBe('.md');
		});
	});

	describe('supportsCommands getter', () => {
		it('should return true when commandsDir is set', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act
			const result = profile.supportsCommands;

			// Assert
			expect(result).toBe(true);
		});
	});

	describe('supportsNestedCommands property', () => {
		it('should be false for Codex profile (uses tm- prefix)', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act & Assert - Codex uses flat namespace with tm- prefix
			expect(profile.supportsNestedCommands).toBe(false);
		});
	});

	describe('getFilename()', () => {
		it('should prepend tm- prefix and append .md extension', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act
			const filename = profile.getFilename('help');

			// Assert - Codex uses flat namespace with tm- prefix
			expect(filename).toBe('tm-help.md');
		});

		it('should handle command names with hyphens', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act
			const filename = profile.getFilename('task-status');

			// Assert
			expect(filename).toBe('tm-task-status.md');
		});

		it('should handle command names with underscores', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act
			const filename = profile.getFilename('get_tasks');

			// Assert
			expect(filename).toBe('tm-get_tasks.md');
		});
	});

	describe('format() with static commands', () => {
		it('should format static command without argumentHint', () => {
			// Arrange
			const profile = new CodexProfile();
			const command = staticCommand({
				name: 'help',
				description: 'Show available commands',
				content: '# Help\n\nThis is the help content.'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('tm-help.md');
			expect(result.content).toBe(
				'---\n' +
					'description: "Show available commands"\n' +
					'---\n' +
					'# Help\n\n' +
					'This is the help content.'
			);
		});

		it('should format static command with argumentHint', () => {
			// Arrange
			const profile = new CodexProfile();
			const command = staticCommand({
				name: 'goham',
				description: 'Start Working with Hamster Brief',
				argumentHint: '[brief-url]',
				content: '# Start Working\n\nBegin your task.'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('tm-goham.md');
			expect(result.content).toBe(
				'---\n' +
					'description: "Start Working with Hamster Brief"\n' +
					'argument-hint: "[brief-url]"\n' +
					'---\n' +
					'# Start Working\n\n' +
					'Begin your task.'
			);
		});

		it('should include YAML frontmatter delimiter correctly', () => {
			// Arrange
			const profile = new CodexProfile();
			const command = staticCommand({
				name: 'test',
				description: 'Test command',
				content: 'Content here'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toMatch(/^---\n/);
			expect(result.content).toMatch(/\n---\n/);
		});

		it('should preserve multiline content', () => {
			// Arrange
			const profile = new CodexProfile();
			const multilineContent =
				'# Title\n\n## Section 1\n\nParagraph one.\n\n## Section 2\n\nParagraph two.';
			const command = staticCommand({
				name: 'docs',
				description: 'Documentation command',
				content: multilineContent
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain(multilineContent);
		});
	});

	describe('format() with dynamic commands', () => {
		it('should format dynamic command with $ARGUMENTS placeholder', () => {
			// Arrange
			const profile = new CodexProfile();
			const command = dynamicCommand(
				'search',
				'Search for items',
				'<query>',
				'Search for: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('tm-search.md');
			expect(result.content).toBe(
				'---\n' +
					'description: "Search for items"\n' +
					'argument-hint: "<query>"\n' +
					'---\n' +
					'Search for: $ARGUMENTS'
			);
		});

		it('should always include argument-hint for dynamic commands', () => {
			// Arrange
			const profile = new CodexProfile();
			const command = dynamicCommand(
				'task',
				'Manage tasks',
				'[task-id]',
				'Task ID: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain('argument-hint: "[task-id]"');
		});

		it('should preserve multiple $ARGUMENTS placeholders in content', () => {
			// Arrange
			const profile = new CodexProfile();
			const command = dynamicCommand(
				'compare',
				'Compare items',
				'<id1> <id2>',
				'First: $ARGUMENTS\nSecond: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain('First: $ARGUMENTS');
			expect(result.content).toContain('Second: $ARGUMENTS');
		});
	});

	describe('format() edge cases', () => {
		it('should handle description with double quotes', () => {
			// Arrange
			const profile = new CodexProfile();
			const command = staticCommand({
				name: 'quoted',
				description: 'Command with "quoted" text',
				content: 'Content'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain(
				'description: "Command with \\"quoted\\" text"'
			);
		});

		it('should handle empty content', () => {
			// Arrange
			const profile = new CodexProfile();
			const command = staticCommand({
				name: 'empty',
				description: 'Empty content command',
				content: ''
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('tm-empty.md');
			expect(result.content).toBe(
				'---\n' + 'description: "Empty content command"\n' + '---\n'
			);
		});

		it('should handle content that starts with frontmatter-like syntax', () => {
			// Arrange
			const profile = new CodexProfile();
			const command = staticCommand({
				name: 'nested',
				description: 'Nested frontmatter test',
				content: '---\nsome: yaml\n---\nActual content'
			});

			// Act
			const result = profile.format(command);

			// Assert
			// The profile should add its own frontmatter, preserving the content as-is
			expect(result.content).toBe(
				'---\n' +
					'description: "Nested frontmatter test"\n' +
					'---\n' +
					'---\n' +
					'some: yaml\n' +
					'---\n' +
					'Actual content'
			);
		});

		it('should handle special characters in argumentHint', () => {
			// Arrange
			const profile = new CodexProfile();
			const command = staticCommand({
				name: 'special',
				description: 'Special args',
				argumentHint: '<file-path|url> [--flag]',
				content: 'Content'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain(
				'argument-hint: "<file-path|url> [--flag]"'
			);
		});
	});

	describe('formatAll()', () => {
		it('should format multiple commands', () => {
			// Arrange
			const profile = new CodexProfile();
			const commands = [
				staticCommand({
					name: 'help',
					description: 'Show help',
					content: 'Help content'
				}),
				dynamicCommand('search', 'Search items', '<query>', 'Query: $ARGUMENTS')
			];

			// Act
			const results = profile.formatAll(commands);

			// Assert
			expect(results).toHaveLength(2);
			expect(results[0].filename).toBe('tm-help.md');
			expect(results[1].filename).toBe('tm-search.md');
		});

		it('should return empty array for empty input', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act
			const results = profile.formatAll([]);

			// Assert
			expect(results).toEqual([]);
		});
	});

	describe('isHomeRelative property', () => {
		it('should be true indicating home directory usage', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act & Assert
			expect(profile.isHomeRelative).toBe(true);
		});
	});

	describe('constructor options', () => {
		it('should use os.homedir() by default', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act
			const result = profile.getCommandsPath('/any/path');

			// Assert
			expect(result).toBe(path.join(os.homedir(), '.codex/prompts'));
		});

		it('should use provided homeDir option when specified', () => {
			// Arrange
			const customHomeDir = '/custom/home';
			const profile = new CodexProfile({ homeDir: customHomeDir });

			// Act
			const result = profile.getCommandsPath('/any/path');

			// Assert
			expect(result).toBe('/custom/home/.codex/prompts');
		});
	});

	describe('getCommandsPath()', () => {
		it('should return path in user home directory, ignoring projectRoot', () => {
			// Arrange
			const profile = new CodexProfile();
			const projectRoot = '/Users/test/my-project';

			// Act
			const result = profile.getCommandsPath(projectRoot);

			// Assert - Codex uses ~/.codex/prompts, not project-relative
			expect(result).toBe(path.join(os.homedir(), '.codex/prompts'));
		});

		it('should return same path regardless of projectRoot value', () => {
			// Arrange
			const profile = new CodexProfile();

			// Act
			const result1 = profile.getCommandsPath('/project/a');
			const result2 = profile.getCommandsPath('/project/b');

			// Assert - Both should return the same home directory path
			expect(result1).toBe(result2);
			expect(result1).toBe(path.join(os.homedir(), '.codex/prompts'));
		});
	});
});
