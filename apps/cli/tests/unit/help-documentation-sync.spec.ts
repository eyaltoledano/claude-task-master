/**
 * @fileoverview Test to ensure help documentation stays in sync with CLI commands
 *
 * This test prevents the help documentation in ui.js from becoming outdated
 * when commands are added, removed, or modified.
 *
 * The CLI has commands in two locations:
 * 1. Legacy: scripts/modules/commands.js
 * 2. Modern: apps/cli/src/commands/*.ts
 *
 * Related issues:
 * - https://github.com/eyaltoledano/claude-task-master/issues/1594
 * - https://github.com/eyaltoledano/claude-task-master/issues/1596
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

// Paths relative to the test file location
const LEGACY_COMMANDS_FILE = resolve(
	__dirname,
	'../../../../scripts/modules/commands.js'
);
const MODERN_COMMANDS_DIR = resolve(__dirname, '../../src/commands');
const UI_FILE = resolve(__dirname, '../../../../scripts/modules/ui.js');

/**
 * Extract command names from legacy commands.js
 * Looks for patterns like: .command('command-name')
 */
function extractCommandsFromLegacyCommandsJs(): string[] {
	const content = readFileSync(LEGACY_COMMANDS_FILE, 'utf-8');

	// Match .command('name') or .command("name") patterns
	const commandRegex = /\.command\(['"]([\w-]+)/g;
	const commands = new Set<string>();

	let match;
	while ((match = commandRegex.exec(content)) !== null) {
		const commandName = match[1];
		// Skip internal/utility commands that don't need help entries
		if (!['help', 'tui'].includes(commandName)) {
			commands.add(commandName);
		}
	}

	return Array.from(commands).sort();
}

/**
 * Extract command names from modern TypeScript command files
 * Looks for patterns like: super(name || 'command-name') or super('command-name')
 */
function extractCommandsFromModernTs(): string[] {
	const commands = new Set<string>();

	try {
		const files = readdirSync(MODERN_COMMANDS_DIR);

		for (const file of files) {
			if (!file.endsWith('.command.ts') || file.includes('.spec.')) continue;

			const filePath = resolve(MODERN_COMMANDS_DIR, file);
			const content = readFileSync(filePath, 'utf-8');

			// Match super(name || 'command-name') or super('command-name') patterns
			const superRegex = /super\((?:name \|\| )?['"]([^'"]+)['"]\)/g;
			let match;
			while ((match = superRegex.exec(content)) !== null) {
				commands.add(match[1]);
			}
		}
	} catch (error) {
		// Directory might not exist in some configurations
		console.warn('Could not read modern commands directory:', error);
	}

	return Array.from(commands).sort();
}

/**
 * Get all CLI commands from both legacy and modern sources
 */
function getAllCliCommands(): string[] {
	const legacy = extractCommandsFromLegacyCommandsJs();
	const modern = extractCommandsFromModernTs();
	const all = new Set([...legacy, ...modern]);
	return Array.from(all).sort();
}

/**
 * Extract command names from displayHelp() in ui.js
 * Looks for patterns like: name: 'command-name'
 */
function extractCommandsFromHelp(): string[] {
	const content = readFileSync(UI_FILE, 'utf-8');

	// Find the displayHelp function and extract command names
	// Match name: 'command-name' patterns within the commandCategories array
	const nameRegex = /name:\s*['"]([^'"]+)['"]/g;
	const commands = new Set<string>();

	let match;
	while ((match = nameRegex.exec(content)) !== null) {
		// Get the base command name (first word, without flags like --setup)
		const fullName = match[1];
		const baseName = fullName.split(/\s+/)[0];
		commands.add(baseName);
	}

	return Array.from(commands).sort();
}

/**
 * Commands that are intentionally not documented in the main help
 * These are internal, deprecated, Hamster-specific, or utility commands
 */
const INTENTIONALLY_UNDOCUMENTED = [
	// Meta/utility commands
	'help', // Meta command - shows the help itself
	'tui', // Internal TUI launcher
	'lang', // Language setting (may be deprecated)
	'migrate', // One-time migration utility
	'move', // May be internal/deprecated
	'rules', // May be internal/advanced
	'scope-up', // May be internal/advanced
	'scope-down', // May be internal/advanced

	// Hamster (cloud) specific commands - documented separately
	'auth', // Hamster authentication
	'login', // Hamster login
	'logout', // Hamster logout
	'briefs', // Hamster briefs management
	'context', // Hamster context management
	'export', // Hamster export functionality
	'export-tag', // Hamster export tag alias
	'start', // Hamster workflow start
	'loop', // Autonomous loop mode
	'generate' // May be internal or aliased
];

/**
 * Commands documented in help that map to different CLI command names
 * Format: { helpName: cliName }
 */
const COMMAND_NAME_MAPPINGS: Record<string, string> = {
	// Tags subcommands in help map to legacy CLI commands
	tags: 'tags', // tags list
	// The following are legacy commands that may still exist
	'add-tag': 'add-tag',
	'use-tag': 'use-tag',
	'delete-tag': 'delete-tag',
	'rename-tag': 'rename-tag',
	'copy-tag': 'copy-tag'
};

describe('Help Documentation Sync', () => {
	it('should have all CLI commands documented in help (or explicitly excluded)', () => {
		const cliCommands = getAllCliCommands();
		const helpCommands = extractCommandsFromHelp();

		// Find commands in CLI that are not in help
		const missingFromHelp = cliCommands.filter(
			(cmd) =>
				!helpCommands.includes(cmd) &&
				!INTENTIONALLY_UNDOCUMENTED.includes(cmd) &&
				!Object.values(COMMAND_NAME_MAPPINGS).includes(cmd)
		);

		if (missingFromHelp.length > 0) {
			console.log('\nCommands in CLI but missing from help:');
			missingFromHelp.forEach((cmd) => console.log(`  - ${cmd}`));
			console.log(
				'\nTo fix: Add these commands to displayHelp() in scripts/modules/ui.js'
			);
			console.log(
				'Or add them to INTENTIONALLY_UNDOCUMENTED if they should not be documented.\n'
			);
		}

		expect(
			missingFromHelp,
			`Commands missing from help documentation: ${missingFromHelp.join(', ')}`
		).toEqual([]);
	});

	it('should not have obsolete commands in help that no longer exist in CLI', () => {
		const cliCommands = getAllCliCommands();
		const helpCommands = extractCommandsFromHelp();

		// Find commands in help that are not in CLI
		const obsoleteInHelp = helpCommands.filter(
			(cmd) =>
				!cliCommands.includes(cmd) &&
				!INTENTIONALLY_UNDOCUMENTED.includes(cmd) &&
				!Object.keys(COMMAND_NAME_MAPPINGS).includes(cmd)
		);

		if (obsoleteInHelp.length > 0) {
			console.log('\nCommands in help but not in CLI:');
			obsoleteInHelp.forEach((cmd) => console.log(`  - ${cmd}`));
			console.log(
				'\nTo fix: Remove these commands from displayHelp() in scripts/modules/ui.js'
			);
			console.log(
				'Or add them to COMMAND_NAME_MAPPINGS if they map to different CLI command names.\n'
			);
		}

		expect(
			obsoleteInHelp,
			`Obsolete commands in help documentation: ${obsoleteInHelp.join(', ')}`
		).toEqual([]);
	});

	it('should extract commands from legacy commands.js', () => {
		const commands = extractCommandsFromLegacyCommandsJs();

		// Sanity check - we should find a reasonable number of legacy commands
		expect(commands.length).toBeGreaterThan(10);

		// Check for some known legacy commands
		expect(commands).toContain('init');
		expect(commands).toContain('parse-prd');
		expect(commands).toContain('expand');
	});

	it('should extract commands from modern TypeScript files', () => {
		const commands = extractCommandsFromModernTs();

		// Sanity check - we should find modern TypeScript commands
		expect(commands.length).toBeGreaterThan(5);

		// Check for some known modern commands
		expect(commands).toContain('list');
		expect(commands).toContain('show');
		expect(commands).toContain('tags');
	});

	it('should extract commands correctly from help', () => {
		const commands = extractCommandsFromHelp();

		// Sanity check - we should find a reasonable number of commands
		expect(commands.length).toBeGreaterThan(10);

		// Check for some known commands that should definitely exist
		expect(commands).toContain('init');
		expect(commands).toContain('list');
		expect(commands).toContain('parse-prd');
	});

	it('should combine legacy and modern commands correctly', () => {
		const allCommands = getAllCliCommands();
		const legacyCommands = extractCommandsFromLegacyCommandsJs();
		const modernCommands = extractCommandsFromModernTs();

		// All commands should include both legacy and modern
		legacyCommands.forEach((cmd) => {
			expect(allCommands).toContain(cmd);
		});
		modernCommands.forEach((cmd) => {
			expect(allCommands).toContain(cmd);
		});
	});

	// === Enhanced subcommand documentation tests (issue #1596) ===

	describe('Subcommand Documentation', () => {
		/**
		 * Extract the raw help content for analysis
		 */
		function getHelpContent(): string {
			return readFileSync(UI_FILE, 'utf-8');
		}

		it('should document tags subcommands with new unified structure', () => {
			const helpContent = getHelpContent();

			// The new tags command structure should use subcommands like:
			// tags add, tags use, tags remove, tags rename, tags copy, tags list
			const expectedTagsSubcommands = [
				'tags add',
				'tags use',
				'tags remove',
				'tags rename',
				'tags copy'
			];

			const missingSubcommands = expectedTagsSubcommands.filter(
				(subcmd) => !helpContent.includes(subcmd)
			);

			if (missingSubcommands.length > 0) {
				console.log('\nMissing tags subcommands in help:');
				missingSubcommands.forEach((cmd) => console.log(`  - ${cmd}`));
				console.log(
					'\nHelp should document the unified tags subcommand structure.'
				);
				console.log('Old style (add-tag, use-tag) should be replaced with:');
				console.log(
					'  tags add, tags use, tags remove, tags rename, tags copy\n'
				);
			}

			expect(
				missingSubcommands,
				`Missing tags subcommands: ${missingSubcommands.join(', ')}`
			).toEqual([]);
		});

		it('should not document deprecated standalone tag commands', () => {
			const helpContent = getHelpContent();

			// These old-style commands should NOT be in the help as primary commands
			// They may exist as aliases but shouldn't be documented
			const deprecatedCommands = [
				/\badd-tag\b(?!\s*\(alias)/i, // add-tag not followed by "(alias)"
				/\buse-tag\b(?!\s*\(alias)/i,
				/\bdelete-tag\b(?!\s*\(alias)/i,
				/\brename-tag\b(?!\s*\(alias)/i,
				/\bcopy-tag\b(?!\s*\(alias)/i
			];

			// Check within the Tag Management section specifically
			const tagSectionMatch = helpContent.match(
				/Tag Management.*?(?=\n\s*\n\s*[A-Z]|\n\s*\])/s
			);

			if (tagSectionMatch) {
				const tagSection = tagSectionMatch[0];
				const foundDeprecated = deprecatedCommands.filter((pattern) =>
					pattern.test(tagSection)
				);

				if (foundDeprecated.length > 0) {
					console.log(
						'\nDeprecated tag commands found in Tag Management section.'
					);
					console.log(
						'These should be replaced with unified tags subcommands.\n'
					);
				}

				expect(
					foundDeprecated.length,
					'Help should use unified tags subcommands, not deprecated standalone commands'
				).toBe(0);
			}
		});

		it('should document list command options', () => {
			const helpContent = getHelpContent();

			// Key list options that should be documented
			const expectedListOptions = [
				'--with-subtasks',
				'-w', // short for --watch
				'--ready',
				'--blocking'
			];

			// Find ALL list command entries (there may be multiple)
			const listMatches = helpContent.match(/name:\s*['"]list['"][^}]+}/g);

			if (!listMatches || listMatches.length === 0) {
				throw new Error('Could not find list command section in help');
			}

			// Combine all list sections for checking
			const allListSections = listMatches.join('\n');
			const missingOptions = expectedListOptions.filter(
				(opt) => !allListSections.includes(opt)
			);

			if (missingOptions.length > 0) {
				console.log('\nMissing list command options in help:');
				missingOptions.forEach((opt) => console.log(`  - ${opt}`));
				console.log(
					'\nThese options should be documented in the list command.\n'
				);
			}

			expect(
				missingOptions,
				`Missing list options: ${missingOptions.join(', ')}`
			).toEqual([]);
		});

		it('should document list command format options', () => {
			const helpContent = getHelpContent();

			// Format-related options
			const expectedFormatOptions = ['--json', '-f', '-c'];

			// Find ALL list command entries (there may be multiple)
			const listMatches = helpContent.match(/name:\s*['"]list['"][^}]+}/g);

			if (!listMatches || listMatches.length === 0) {
				throw new Error('Could not find list command section in help');
			}

			// Combine all list sections for checking
			const allListSections = listMatches.join('\n');
			const missingOptions = expectedFormatOptions.filter(
				(opt) => !allListSections.includes(opt)
			);

			if (missingOptions.length > 0) {
				console.log('\nMissing list format options in help:');
				missingOptions.forEach((opt) => console.log(`  - ${opt}`));
			}

			expect(
				missingOptions,
				`Missing list format options: ${missingOptions.join(', ')}`
			).toEqual([]);
		});
	});
});
