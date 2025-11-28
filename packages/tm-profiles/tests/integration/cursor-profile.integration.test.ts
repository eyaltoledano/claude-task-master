/**
 * @fileoverview Integration tests for CursorProfile
 *
 * These tests verify actual filesystem operations using addSlashCommands
 * and removeSlashCommands methods. Tests ensure that:
 * - Directory creation works correctly (files go to .cursor/commands/tm/)
 * - Files are written with correct content (no transformation)
 * - Commands can be added and removed
 * - User files are preserved during cleanup
 * - Empty directories are cleaned up
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CursorProfile } from '../../src/slash-commands/profiles/cursor-profile.js';
import {
	staticCommand,
	dynamicCommand
} from '../../src/slash-commands/factories.js';

describe('CursorProfile - Integration Tests', () => {
	let tempDir: string;
	let cursorProfile: CursorProfile;

	// Test commands created inline
	const testStaticCommand = staticCommand({
		name: 'help',
		description: 'Show available commands',
		content: '# Help\n\nList of available Task Master commands.'
	});

	const testDynamicCommand = dynamicCommand(
		'goham',
		'Start Working with Hamster Brief',
		'[brief-url]',
		'# Start Working\n\nBrief URL: $ARGUMENTS\n\nThis command helps you start working on a Hamster brief.'
	);

	const testCommands = [testStaticCommand, testDynamicCommand];

	beforeEach(() => {
		// Create temporary directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-profile-test-'));
		cursorProfile = new CursorProfile();
	});

	afterEach(() => {
		// Clean up temporary directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('addSlashCommands', () => {
		it('should create the .cursor/commands/tm directory (nested structure)', () => {
			// Verify directory doesn't exist before
			const tmDir = path.join(tempDir, '.cursor', 'commands', 'tm');
			expect(fs.existsSync(tmDir)).toBe(false);

			// Add commands
			cursorProfile.addSlashCommands(tempDir, testCommands);

			// Verify tm directory exists after (nested structure)
			expect(fs.existsSync(tmDir)).toBe(true);
			expect(fs.statSync(tmDir).isDirectory()).toBe(true);
		});

		it('should write files with content unchanged (no transformation)', () => {
			cursorProfile.addSlashCommands(tempDir, testCommands);

			// Cursor supports nested commands, files go to .cursor/commands/tm/
			const tmDir = path.join(tempDir, '.cursor', 'commands', 'tm');

			// Verify static command (help.md)
			const helpPath = path.join(tmDir, 'help.md');
			expect(fs.existsSync(helpPath)).toBe(true);
			const helpContent = fs.readFileSync(helpPath, 'utf-8');
			expect(helpContent).toBe(
				'# Help\n\nList of available Task Master commands.'
			);

			// Verify dynamic command (goham.md)
			const gohamPath = path.join(tmDir, 'goham.md');
			expect(fs.existsSync(gohamPath)).toBe(true);
			const gohamContent = fs.readFileSync(gohamPath, 'utf-8');
			expect(gohamContent).toBe(
				'# Start Working\n\nBrief URL: $ARGUMENTS\n\nThis command helps you start working on a Hamster brief.'
			);

			// Verify $ARGUMENTS placeholder is NOT transformed
			expect(gohamContent).toContain('$ARGUMENTS');
		});

		it('should return success result with correct count', () => {
			const result = cursorProfile.addSlashCommands(tempDir, testCommands);

			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
			// Path includes tm/ subdirectory for nested structure
			expect(result.directory).toBe(
				path.join(tempDir, '.cursor', 'commands', 'tm')
			);
			expect(result.files).toEqual(['help.md', 'goham.md']);
			expect(result.error).toBeUndefined();
		});

		it('should overwrite existing files on re-run', () => {
			// Files go to .cursor/commands/tm/
			const tmDir = path.join(tempDir, '.cursor', 'commands', 'tm');

			// First run
			cursorProfile.addSlashCommands(tempDir, testCommands);
			const originalContent = fs.readFileSync(
				path.join(tmDir, 'help.md'),
				'utf-8'
			);
			expect(originalContent).toBe(
				'# Help\n\nList of available Task Master commands.'
			);

			// Modify the content of test command
			const modifiedCommand = staticCommand({
				name: 'help',
				description: 'Show available commands',
				content: '# Help - Updated\n\nThis is updated content.'
			});

			// Second run with modified command
			const result = cursorProfile.addSlashCommands(tempDir, [modifiedCommand]);

			// Verify file was overwritten
			const updatedContent = fs.readFileSync(
				path.join(tmDir, 'help.md'),
				'utf-8'
			);
			expect(updatedContent).toBe(
				'# Help - Updated\n\nThis is updated content.'
			);
			expect(result.success).toBe(true);
			expect(result.count).toBe(1);
		});

		it('should handle commands with special characters in content', () => {
			const specialCommand = staticCommand({
				name: 'special',
				description: 'Command with special characters',
				content:
					'# Special\n\n```bash\necho "Hello $USER"\n```\n\n- Item 1\n- Item 2\n\n**Bold** and *italic*'
			});

			cursorProfile.addSlashCommands(tempDir, [specialCommand]);

			// Files go to .cursor/commands/tm/
			const tmDir = path.join(tempDir, '.cursor', 'commands', 'tm');
			const specialPath = path.join(tmDir, 'special.md');
			const content = fs.readFileSync(specialPath, 'utf-8');

			// Verify content is preserved exactly
			expect(content).toBe(
				'# Special\n\n```bash\necho "Hello $USER"\n```\n\n- Item 1\n- Item 2\n\n**Bold** and *italic*'
			);
		});
	});

	describe('removeSlashCommands', () => {
		beforeEach(() => {
			// Add commands before testing removal
			cursorProfile.addSlashCommands(tempDir, testCommands);
		});

		it('should remove only TaskMaster commands (preserve user files)', () => {
			// Files go to .cursor/commands/tm/
			const tmDir = path.join(tempDir, '.cursor', 'commands', 'tm');

			// Create a user's custom command file in the tm directory
			const userCommandPath = path.join(tmDir, 'custom-user-command.md');
			fs.writeFileSync(
				userCommandPath,
				'# Custom User Command\n\nThis is a user-created command.'
			);

			// Verify all files exist before removal
			expect(fs.existsSync(path.join(tmDir, 'help.md'))).toBe(true);
			expect(fs.existsSync(path.join(tmDir, 'goham.md'))).toBe(true);
			expect(fs.existsSync(userCommandPath)).toBe(true);

			// Remove TaskMaster commands
			const result = cursorProfile.removeSlashCommands(tempDir, testCommands);

			// Verify TaskMaster commands removed
			expect(fs.existsSync(path.join(tmDir, 'help.md'))).toBe(false);
			expect(fs.existsSync(path.join(tmDir, 'goham.md'))).toBe(false);

			// Verify user's custom file preserved
			expect(fs.existsSync(userCommandPath)).toBe(true);
			expect(fs.readFileSync(userCommandPath, 'utf-8')).toBe(
				'# Custom User Command\n\nThis is a user-created command.'
			);

			// Verify result
			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
			// File order is not guaranteed, so check both files are present
			expect(result.files).toHaveLength(2);
			expect(result.files).toContain('help.md');
			expect(result.files).toContain('goham.md');
		});

		it('should remove empty tm directory after cleanup', () => {
			// Files go to .cursor/commands/tm/
			const tmDir = path.join(tempDir, '.cursor', 'commands', 'tm');

			// Verify directory exists with files
			expect(fs.existsSync(tmDir)).toBe(true);
			expect(fs.readdirSync(tmDir).length).toBe(2);

			// Remove all commands (should cleanup empty directory)
			const result = cursorProfile.removeSlashCommands(
				tempDir,
				testCommands,
				true
			);

			// Verify tm directory removed
			expect(fs.existsSync(tmDir)).toBe(false);
			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
		});

		it('should not remove directory if removeEmptyDir is false', () => {
			// Files go to .cursor/commands/tm/
			const tmDir = path.join(tempDir, '.cursor', 'commands', 'tm');

			// Remove commands but keep directory
			const result = cursorProfile.removeSlashCommands(
				tempDir,
				testCommands,
				false
			);

			// Verify directory still exists (but empty)
			expect(fs.existsSync(tmDir)).toBe(true);
			expect(fs.statSync(tmDir).isDirectory()).toBe(true);
			expect(fs.readdirSync(tmDir).length).toBe(0);
			expect(result.success).toBe(true);
		});

		it('should handle removal when directory does not exist', () => {
			const nonExistentDir = path.join(tempDir, 'nonexistent');

			// Remove commands from non-existent directory
			const result = cursorProfile.removeSlashCommands(
				nonExistentDir,
				testCommands
			);

			// Should succeed with 0 count
			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
			expect(result.files).toEqual([]);
		});

		it('should be case-insensitive when matching command names', () => {
			// Files go to .cursor/commands/tm/
			const tmDir = path.join(tempDir, '.cursor', 'commands', 'tm');

			// Check if filesystem is case-sensitive (Linux) or case-insensitive (macOS/Windows)
			const testFile = path.join(tmDir, 'TEST-CASE.md');
			fs.writeFileSync(testFile, 'test');
			const isCaseSensitive = !fs.existsSync(path.join(tmDir, 'test-case.md'));
			fs.rmSync(testFile);

			// Create command with different casing from test commands
			const upperCaseFile = path.join(tmDir, 'HELP.md');
			fs.writeFileSync(upperCaseFile, '# Upper case help');

			// Remove using lowercase name
			const result = cursorProfile.removeSlashCommands(tempDir, testCommands);

			// help.md should always be removed
			expect(fs.existsSync(path.join(tmDir, 'help.md'))).toBe(false);

			if (isCaseSensitive) {
				// On case-sensitive filesystems, HELP.md is treated as different file
				expect(fs.existsSync(upperCaseFile)).toBe(true);
				expect(result.count).toBe(2); // help.md, goham.md
				// Clean up
				fs.rmSync(upperCaseFile);
			} else {
				// On case-insensitive filesystems (macOS/Windows), both should be removed
				// because the filesystem treats help.md and HELP.md as the same file
				expect(fs.existsSync(upperCaseFile)).toBe(false);
				expect(result.count).toBe(2); // help.md (which is the same as HELP.md), goham.md
			}
		});
	});

	describe('Profile configuration', () => {
		it('should have correct profile properties', () => {
			expect(cursorProfile.name).toBe('cursor');
			expect(cursorProfile.displayName).toBe('Cursor');
			expect(cursorProfile.commandsDir).toBe('.cursor/commands');
			expect(cursorProfile.extension).toBe('.md');
			expect(cursorProfile.supportsCommands).toBe(true);
			expect(cursorProfile.supportsNestedCommands).toBe(true);
		});

		it('should generate correct filenames (no prefix for nested structure)', () => {
			// Cursor supports nested commands, so no tm- prefix
			expect(cursorProfile.getFilename('help')).toBe('help.md');
			expect(cursorProfile.getFilename('goham')).toBe('goham.md');
		});

		it('should generate correct commands path with tm subdirectory', () => {
			// Path includes tm/ subdirectory for nested structure
			const expectedPath = path.join(tempDir, '.cursor', 'commands', 'tm');
			expect(cursorProfile.getCommandsPath(tempDir)).toBe(expectedPath);
		});
	});

	describe('Round-trip operations', () => {
		it('should successfully add, remove, and re-add commands', () => {
			// Files go to .cursor/commands/tm/
			const tmDir = path.join(tempDir, '.cursor', 'commands', 'tm');

			// Add commands
			const addResult1 = cursorProfile.addSlashCommands(tempDir, testCommands);
			expect(addResult1.success).toBe(true);
			expect(fs.existsSync(path.join(tmDir, 'help.md'))).toBe(true);

			// Remove commands
			const removeResult = cursorProfile.removeSlashCommands(
				tempDir,
				testCommands
			);
			expect(removeResult.success).toBe(true);
			expect(fs.existsSync(tmDir)).toBe(false);

			// Re-add commands
			const addResult2 = cursorProfile.addSlashCommands(tempDir, testCommands);
			expect(addResult2.success).toBe(true);
			expect(fs.existsSync(path.join(tmDir, 'help.md'))).toBe(true);

			// Verify content is still correct
			const content = fs.readFileSync(path.join(tmDir, 'help.md'), 'utf-8');
			expect(content).toBe('# Help\n\nList of available Task Master commands.');
		});
	});
});
