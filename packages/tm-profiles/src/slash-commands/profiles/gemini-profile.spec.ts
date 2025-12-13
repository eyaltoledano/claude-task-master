/**
 * @fileoverview Unit Tests for GeminiProfile
 * Tests the Gemini CLI slash command profile formatting and metadata.
 */

import { describe, expect, it } from 'vitest';
import { dynamicCommand, staticCommand } from '../factories.js';
import { GeminiProfile } from './gemini-profile.js';

describe('GeminiProfile', () => {
	describe('Profile Metadata', () => {
		it('should have correct profile name', () => {
			// Arrange
			const profile = new GeminiProfile();

			// Act & Assert
			expect(profile.name).toBe('gemini');
		});

		it('should have correct display name', () => {
			// Arrange
			const profile = new GeminiProfile();

			// Act & Assert
			expect(profile.displayName).toBe('Gemini');
		});

		it('should have correct commands directory', () => {
			// Arrange
			const profile = new GeminiProfile();

			// Act & Assert
			expect(profile.commandsDir).toBe('.gemini/commands');
		});

		it('should have correct file extension', () => {
			// Arrange
			const profile = new GeminiProfile();

			// Act & Assert
			expect(profile.extension).toBe('.toml');
		});
	});

	describe('supportsCommands getter', () => {
		it('should return true when commandsDir is non-empty', () => {
			// Arrange
			const profile = new GeminiProfile();

			// Act
			const result = profile.supportsCommands;

			// Assert
			expect(result).toBe(true);
		});
	});

	describe('getFilename() method', () => {
		it('should append .toml extension to command name', () => {
			// Arrange
			const profile = new GeminiProfile();

			// Act
			const filename = profile.getFilename('help');

			// Assert
			expect(filename).toBe('help.toml');
		});

		it('should handle command names with hyphens', () => {
			// Arrange
			const profile = new GeminiProfile();

			// Act
			const filename = profile.getFilename('my-command');

			// Assert
			expect(filename).toBe('my-command.toml');
		});

		it('should handle command names with underscores', () => {
			// Arrange
			const profile = new GeminiProfile();

			// Act
			const filename = profile.getFilename('my_command');

			// Assert
			expect(filename).toBe('my_command.toml');
		});

		it('should handle single character command names', () => {
			// Arrange
			const profile = new GeminiProfile();

			// Act
			const filename = profile.getFilename('x');

			// Assert
			expect(filename).toBe('x.toml');
		});
	});

	describe('format() method for static commands', () => {
		it('should format simple static command with description and prompt', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'help',
				description: 'Show available commands',
				content: '# Help\n\nList of available commands...'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('help.toml');
			expect(result.content).toBe(
				'description="Show available commands"\nprompt = """\n# Help\n\nList of available commands...\n"""\n'
			);
		});

		it('should trim content inside prompt block', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'test',
				description: 'Test command',
				content: '  \n# Test Content\n\n  '
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(
				'description="Test command"\nprompt = """\n# Test Content\n"""\n'
			);
		});

		it('should preserve multiline content in prompt block', () => {
			// Arrange
			const profile = new GeminiProfile();
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
			expect(result.filename).toBe('task-runner.toml');
			expect(result.content).toBe(
				`description="Run automated tasks"
prompt = """
${multilineContent}
"""
`
			);
		});

		it('should escape double quotes in description', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'test',
				description: 'Test "quoted" description',
				content: '# Test Content'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(
				'description="Test \\"quoted\\" description"\nprompt = """\n# Test Content\n"""\n'
			);
		});

		it('should escape multiple double quotes in description', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'test',
				description: 'Use "this" and "that" and "other"',
				content: '# Test'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain(
				'description="Use \\"this\\" and \\"that\\" and \\"other\\"'
			);
		});

		it('should preserve static command with argumentHint', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'analyze',
				description: 'Analyze codebase',
				argumentHint: '[path]',
				content: '# Analyze\n\nAnalyze the specified path.'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('analyze.toml');
			expect(result.content).toBe(
				'description="Analyze codebase"\nprompt = """\n# Analyze\n\nAnalyze the specified path.\n"""\n'
			);
		});

		it('should preserve code blocks in content', () => {
			// Arrange
			const profile = new GeminiProfile();
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
			expect(result.content).toContain('```bash');
			expect(result.content).toContain('npm run deploy');
			expect(result.content).toContain('```');
		});

		it('should preserve special characters in content', () => {
			// Arrange
			const profile = new GeminiProfile();
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
			expect(result.content).toContain('$HOME');
			expect(result.content).toContain('$PATH');
			expect(result.content).toContain('<tag>');
			expect(result.content).toContain('&');
			expect(result.content).toContain('"quotes"');
		});

		it('should handle empty content', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'empty',
				description: 'Empty command',
				content: ''
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(
				'description="Empty command"\nprompt = """\n\n"""\n'
			);
		});
	});

	describe('format() method for dynamic commands', () => {
		it('should format dynamic command with $ARGUMENTS placeholder', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = dynamicCommand(
				'review',
				'Review a pull request',
				'<pr-number>',
				'# Review PR\n\nReviewing PR: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.filename).toBe('review.toml');
			expect(result.content).toBe(
				'description="Review a pull request"\nprompt = """\n# Review PR\n\nReviewing PR: $ARGUMENTS\n"""\n'
			);
			expect(result.content).toContain('$ARGUMENTS');
		});

		it('should preserve multiple $ARGUMENTS placeholders', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = dynamicCommand(
				'compare',
				'Compare two items',
				'<item1> <item2>',
				'First: $ARGUMENTS\nSecond: $ARGUMENTS\nBoth: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			const placeholderCount = (result.content.match(/\$ARGUMENTS/g) || [])
				.length;
			expect(placeholderCount).toBe(3);
			expect(result.content).toContain('First: $ARGUMENTS');
			expect(result.content).toContain('Second: $ARGUMENTS');
			expect(result.content).toContain('Both: $ARGUMENTS');
		});

		it('should preserve $ARGUMENTS in complex markdown content', () => {
			// Arrange
			const profile = new GeminiProfile();
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
			const placeholderCount = (result.content.match(/\$ARGUMENTS/g) || [])
				.length;
			expect(placeholderCount).toBe(3);
			expect(result.content).toContain('User provided: $ARGUMENTS');
			expect(result.content).toContain('Parse the input: `$ARGUMENTS`');
			expect(result.content).toContain('Query: $ARGUMENTS');
		});

		it('should escape quotes in dynamic command description', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = dynamicCommand(
				'run',
				'Run "command" with args',
				'<cmd>',
				'Running: $ARGUMENTS'
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain(
				'description="Run \\"command\\" with args"'
			);
		});

		it('should trim content in dynamic commands', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = dynamicCommand(
				'test',
				'Test command',
				'<arg>',
				'  \nContent: $ARGUMENTS\n  '
			);

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toBe(
				'description="Test command"\nprompt = """\nContent: $ARGUMENTS\n"""\n'
			);
		});
	});

	describe('format() output structure', () => {
		it('should return object with filename and content properties', () => {
			// Arrange
			const profile = new GeminiProfile();
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

		it('should have consistent format structure across different commands', () => {
			// Arrange
			const profile = new GeminiProfile();
			const commands = [
				staticCommand({
					name: 'cmd1',
					description: 'Command 1',
					content: 'Content 1'
				}),
				dynamicCommand('cmd2', 'Command 2', '<arg>', 'Content 2 $ARGUMENTS')
			];

			// Act
			const results = commands.map((cmd) => profile.format(cmd));

			// Assert
			results.forEach((result) => {
				expect(result.content).toMatch(
					/^description=".*"\nprompt = """\n[\s\S]*\n"""\n$/
				);
			});
		});
	});

	describe('formatAll() method', () => {
		it('should format multiple commands correctly', () => {
			// Arrange
			const profile = new GeminiProfile();
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
			expect(results[0].filename).toBe('help.toml');
			expect(results[0].content).toContain('description="Show help"');
			expect(results[1].filename).toBe('run.toml');
			expect(results[1].content).toContain('description="Run a command"');
			expect(results[1].content).toContain('$ARGUMENTS');
		});

		it('should return empty array for empty input', () => {
			// Arrange
			const profile = new GeminiProfile();

			// Act
			const results = profile.formatAll([]);

			// Assert
			expect(results).toEqual([]);
		});

		it('should handle mixed static and dynamic commands', () => {
			// Arrange
			const profile = new GeminiProfile();
			const commands = [
				staticCommand({
					name: 'static1',
					description: 'Static command 1',
					content: 'Content 1'
				}),
				dynamicCommand('dynamic1', 'Dynamic command 1', '<arg>', '$ARGUMENTS'),
				staticCommand({
					name: 'static2',
					description: 'Static command 2',
					content: 'Content 2'
				})
			];

			// Act
			const results = profile.formatAll(commands);

			// Assert
			expect(results).toHaveLength(3);
			expect(results[0].filename).toBe('static1.toml');
			expect(results[1].filename).toBe('dynamic1.toml');
			expect(results[2].filename).toBe('static2.toml');
		});
	});

	describe('getCommandsPath() method', () => {
		it('should return correct absolute path for commands directory with tm subdirectory', () => {
			// Arrange
			const profile = new GeminiProfile();
			const projectRoot = '/home/user/my-project';

			// Act
			const commandsPath = profile.getCommandsPath(projectRoot);

			// Assert
			expect(commandsPath).toBe('/home/user/my-project/.gemini/commands/tm');
		});

		it('should handle project root with trailing slash', () => {
			// Arrange
			const profile = new GeminiProfile();
			const projectRoot = '/home/user/my-project/';

			// Act
			const commandsPath = profile.getCommandsPath(projectRoot);

			// Assert
			// path.join normalizes the path
			expect(commandsPath).toBe('/home/user/my-project/.gemini/commands/tm');
		});

		it('should handle Windows-style paths', () => {
			// Arrange
			const profile = new GeminiProfile();
			const projectRoot = 'C:\\Users\\user\\my-project';

			// Act
			const commandsPath = profile.getCommandsPath(projectRoot);

			// Assert
			expect(commandsPath).toContain('.gemini');
			expect(commandsPath).toContain('commands');
		});
	});

	describe('escapeForTripleQuotedString() edge cases', () => {
		it('should escape triple quotes in content to prevent TOML delimiter break', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'test',
				description: 'Test command',
				content: 'Content with """ triple quotes'
			});

			// Act
			const result = profile.format(command);

			// Assert
			// The triple quotes should be escaped so they don't break the TOML delimiter
			expect(result.content).not.toContain('Content with """ triple quotes');
			expect(result.content).toContain('Content with ""\\" triple quotes');
		});

		it('should escape multiple triple quote sequences in content', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'test',
				description: 'Test command',
				content: 'First """ and second """ here'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain('First ""\\" and second ""\\" here');
		});

		it('should handle content that is just triple quotes', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'test',
				description: 'Test command',
				content: '"""'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain('prompt = """\n""\\"\n"""');
		});
	});

	describe('escapeForPython() edge cases', () => {
		it('should handle description with only quotes', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'test',
				description: '"""',
				content: 'Content'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain('description="\\"\\"\\""');
		});

		it('should handle description with mixed quotes and text', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'test',
				description: 'Start "working" on "task" now',
				content: 'Content'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain(
				'description="Start \\"working\\" on \\"task\\" now"'
			);
		});

		it('should not escape single quotes in description', () => {
			// Arrange
			const profile = new GeminiProfile();
			const command = staticCommand({
				name: 'test',
				description: "It's a test with 'single quotes'",
				content: 'Content'
			});

			// Act
			const result = profile.format(command);

			// Assert
			expect(result.content).toContain(
				"description=\"It's a test with 'single quotes'\""
			);
			expect(result.content).not.toContain("\\'");
		});
	});
});
