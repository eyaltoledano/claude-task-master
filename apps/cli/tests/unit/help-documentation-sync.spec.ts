/**
 * @fileoverview Test to ensure help documentation stays in sync with CLI commands,
 * including verification that subcommands and command options are correctly documented.
 *
 * The CLI has commands in two locations:
 * 1. Legacy: scripts/modules/commands.js
 * 2. Modern: apps/cli/src/commands/*.ts
 *
 * Help documentation lives in displayHelp() within scripts/modules/ui.js.
 *
 * This test catches two categories of drift:
 * - Command-level: commands exist in CLI but not in help (or vice versa)
 * - Subcommand-level: subcommands/options are missing or outdated in help
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
 * Extract the full help content from ui.js for subcommand/option analysis
 */
function getHelpContent(): string {
	return readFileSync(UI_FILE, 'utf-8');
}

/**
 * Extract subcommands registered on a modern TypeScript command class
 * Looks for .command('subcommand-name') calls within addXxxCommand methods
 * or this.command('subcommand-name') patterns
 */
function extractSubcommandsFromModernTs(commandFileName: string): string[] {
	const subcommands: string[] = [];

	try {
		const filePath = resolve(MODERN_COMMANDS_DIR, commandFileName);
		const content = readFileSync(filePath, 'utf-8');

		// Match this.command('subcommand-name') patterns (how Commander subcommands are registered)
		const subcommandRegex = /this\.command\(['"](\w[\w-]*)(?:\s[^'"]*)?['"]\)/g;
		let match;
		while ((match = subcommandRegex.exec(content)) !== null) {
			subcommands.push(match[1]);
		}
	} catch {
		// File might not exist
	}

	return subcommands.sort();
}

/**
 * Tags subcommands that serve as the default action and may be documented
 * as part of the parent command entry rather than as a separate "tags <subcommand>" line.
 *
 * For example, "tags list" is the default action, so help shows:
 *   name: 'tags', args: '[list] [--show-metadata] [--ready]'
 * instead of:
 *   name: 'tags list', args: '...'
 *
 * These are excluded from the "must appear as 'tags <subcmd>'" checks.
 */
const TAGS_DEFAULT_ACTION_SUBCOMMANDS = ['list'];

/**
 * Extract options registered on a modern TypeScript command class
 * Looks for .option() calls and returns the option flags
 */
function extractOptionsFromModernTs(commandFileName: string): string[] {
	const options: string[] = [];

	try {
		const filePath = resolve(MODERN_COMMANDS_DIR, commandFileName);
		const content = readFileSync(filePath, 'utf-8');

		// Match .option('flags', ...) patterns - extract the flags portion
		const optionRegex = /\.option\(\s*['"]([-\w,\s/<>]+)['"]/g;
		let match;
		while ((match = optionRegex.exec(content)) !== null) {
			const flagStr = match[1];
			// Extract long option name (e.g., --watch from '-w, --watch')
			const longMatch = flagStr.match(/--([\w-]+)/);
			if (longMatch) {
				options.push(`--${longMatch[1]}`);
			}
			// Extract short option name (e.g., -w from '-w, --watch')
			const shortMatch = flagStr.match(/^-(\w)/);
			if (shortMatch) {
				options.push(`-${shortMatch[1]}`);
			}
		}
	} catch {
		// File might not exist
	}

	return [...new Set(options)].sort();
}

/**
 * Commands that are intentionally not documented in the main help.
 * These are internal, deprecated, Hamster-specific, or utility commands.
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
	'loop' // Autonomous loop mode
];

/**
 * Commands documented in help that map to different CLI command names.
 *
 * TEMPORARY DURING TAG MIGRATION: This mapping exempts legacy tag commands from help
 * validation while they are being deprecated in favor of the new 'tags' subcommand structure.
 * Legacy commands to be removed: add-tag, use-tag, delete-tag, rename-tag, copy-tag
 */
const COMMAND_NAME_MAPPINGS: Record<string, string> = {
	// Tags subcommands in help map to legacy CLI commands
	tags: 'tags', // tags list
	// The following are legacy commands being deprecated
	'add-tag': 'add-tag',
	'use-tag': 'use-tag',
	'delete-tag': 'delete-tag',
	'rename-tag': 'rename-tag',
	'copy-tag': 'copy-tag'
};

// ============================================================
// Tests
// ============================================================

describe('Help Documentation Sync', () => {
	// ----------------------------------------------------------
	// Command-level sync tests (from #1595)
	// ----------------------------------------------------------

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

	// ----------------------------------------------------------
	// Subcommand documentation tests (issue #1596)
	// ----------------------------------------------------------

	describe('Subcommand Documentation', () => {
		describe('tags subcommands', () => {
			it('should document all tags subcommands from the actual CLI implementation', () => {
				const helpContent = getHelpContent();

				// Extract subcommands directly from the tags.command.ts implementation
				const implementedSubcommands =
					extractSubcommandsFromModernTs('tags.command.ts');

				// Each implemented subcommand should appear as "tags <subcommand>" in help,
				// UNLESS it is a default-action subcommand (e.g. "list") which is documented
				// as part of the parent command entry (name: 'tags', args: '[list] ...')
				const missingSubcommands = implementedSubcommands.filter(
					(subcmd) =>
						!TAGS_DEFAULT_ACTION_SUBCOMMANDS.includes(subcmd) &&
						!helpContent.includes(`tags ${subcmd}`)
				);

				if (missingSubcommands.length > 0) {
					console.log('\nTags subcommands in CLI but missing from help:');
					missingSubcommands.forEach((cmd) =>
						console.log(`  - tags ${cmd}`)
					);
					console.log(
						'\nTo fix: Add these to the Tag Management section in displayHelp() in ui.js\n'
					);
				}

				expect(
					missingSubcommands,
					`Tags subcommands missing from help: ${missingSubcommands.map((s) => `tags ${s}`).join(', ')}`
				).toEqual([]);
			});

			it('should document the expected tags subcommand structure', () => {
				const helpContent = getHelpContent();

				// The unified tags command structure should include these subcommands
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
					console.log(
						'Old style (add-tag, use-tag) should be replaced with:'
					);
					console.log(
						'  tags add, tags use, tags remove, tags rename, tags copy\n'
					);
				}

				expect(
					missingSubcommands,
					`Missing tags subcommands: ${missingSubcommands.join(', ')}`
				).toEqual([]);
			});

			it('should not document deprecated standalone tag commands as primary entries', () => {
				const helpContent = getHelpContent();

				// These old-style commands should NOT appear as primary command names in the
				// Tag Management section. They may exist elsewhere as legacy aliases.
				const deprecatedPatterns = [
					/\badd-tag\b(?!\s*\(alias)/i,
					/\buse-tag\b(?!\s*\(alias)/i,
					/\bdelete-tag\b(?!\s*\(alias)/i,
					/\brename-tag\b(?!\s*\(alias)/i,
					/\bcopy-tag\b(?!\s*\(alias)/i
				];

				// Try to isolate the Tag Management section
				const tagSectionMatch = helpContent.match(
					/Tag Management.*?(?=\n\s*\n\s*[A-Z]|\n\s*\])/s
				);

				if (!tagSectionMatch) {
					console.warn(
						'Could not isolate Tag Management section - checking entire help content instead'
					);
				}

				const sectionToCheck = tagSectionMatch
					? tagSectionMatch[0]
					: helpContent;
				const foundDeprecated = deprecatedPatterns.filter((pattern) =>
					pattern.test(sectionToCheck)
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
			});

			it('should document tags list default action with its options', () => {
				const helpContent = getHelpContent();

				// The tags default action (list) is documented as:
				//   name: 'tags', args: '[list] [--show-metadata] [--ready]'
				// So we look for the tags entry and verify its args include the list keyword
				// and the key options for the list subcommand

				// Find the tag management section in the help
				const tagsEntries = helpContent.match(
					/name:\s*['"]tags['"]\s*,\s*args:\s*['"][^'"]*['"]/g
				);

				expect(
					tagsEntries,
					'Should find a tags command entry in help'
				).not.toBeNull();

				const allTagsArgs = tagsEntries!.join('\n');

				expect(
					allTagsArgs.includes('list'),
					'tags command should document list as default action'
				).toBe(true);
				expect(
					allTagsArgs.includes('--show-metadata'),
					'tags command should document --show-metadata option'
				).toBe(true);
				expect(
					allTagsArgs.includes('--ready'),
					'tags command should document --ready option'
				).toBe(true);
			});
		});

		describe('list command options', () => {
			it('should document key list command filtering options', () => {
				const helpContent = getHelpContent();

				// Key filtering options from the actual list.command.ts implementation
				const expectedFilterOptions = [
					'--with-subtasks',
					'--ready',
					'--blocking'
				];

				// Find ALL list command entries (there may be multiple rows)
				const listMatches = helpContent.match(
					/name:\s*['"]list['"][^}]+}/g
				);

				if (!listMatches || listMatches.length === 0) {
					throw new Error(
						'Could not find list command section in help'
					);
				}

				// Combine all list sections for checking
				const allListSections = listMatches.join('\n');
				const missingOptions = expectedFilterOptions.filter(
					(opt) => !allListSections.includes(opt)
				);

				if (missingOptions.length > 0) {
					console.log('\nMissing list command filtering options in help:');
					missingOptions.forEach((opt) => console.log(`  - ${opt}`));
					console.log(
						'\nTo fix: Add these to the list command entries in displayHelp()\n'
					);
				}

				expect(
					missingOptions,
					`Missing list filter options: ${missingOptions.join(', ')}`
				).toEqual([]);
			});

			it('should document list command output format options', () => {
				const helpContent = getHelpContent();

				// Format-related options
				const expectedFormatOptions = ['--json', '-f', '-c'];

				// Find ALL list command entries
				const listMatches = helpContent.match(
					/name:\s*['"]list['"][^}]+}/g
				);

				if (!listMatches || listMatches.length === 0) {
					throw new Error(
						'Could not find list command section in help'
					);
				}

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

			it('should document list command watch mode option', () => {
				const helpContent = getHelpContent();

				// Watch mode should be documented
				const listMatches = helpContent.match(
					/name:\s*['"]list['"][^}]+}/g
				);

				if (!listMatches || listMatches.length === 0) {
					throw new Error(
						'Could not find list command section in help'
					);
				}

				const allListSections = listMatches.join('\n');

				// Check for watch mode (-w or --watch)
				expect(
					allListSections.includes('-w') ||
						allListSections.includes('--watch'),
					'list command should document watch mode (-w/--watch)'
				).toBe(true);
			});

			it('should document list command cross-tag listing option', () => {
				const helpContent = getHelpContent();

				const listMatches = helpContent.match(
					/name:\s*['"]list['"][^}]+}/g
				);

				if (!listMatches || listMatches.length === 0) {
					throw new Error(
						'Could not find list command section in help'
					);
				}

				const allListSections = listMatches.join('\n');

				expect(
					allListSections.includes('--all-tags'),
					'list command should document --all-tags option'
				).toBe(true);
			});

			it('should document list command options that match the actual implementation', () => {
				const helpContent = getHelpContent();

				// Extract options from the actual list.command.ts implementation
				const implementedOptions =
					extractOptionsFromModernTs('list.command.ts');

				// Find ALL list command entries
				const listMatches = helpContent.match(
					/name:\s*['"]list['"][^}]+}/g
				);

				if (!listMatches || listMatches.length === 0) {
					throw new Error(
						'Could not find list command section in help'
					);
				}

				const allListSections = listMatches.join('\n');

				// Options that are important enough to require documentation.
				// Each entry is [longFlag, shortFlag?] - the option is considered documented
				// if EITHER the long form or the short form appears in help.
				// (some internal options like --silent and --no-header may be intentionally undocumented)
				const documentationRequired: Array<{ long: string; short?: string }> = [
					{ long: '--with-subtasks' },
					{ long: '--ready' },
					{ long: '--blocking' },
					{ long: '--all-tags' },
					{ long: '--json' },
					{ long: '--watch', short: '-w' }
				];

				const missingOptions = documentationRequired.filter(
					(opt) => {
						// Only check options that are actually implemented
						if (!implementedOptions.includes(opt.long)) return false;
						// Accept either long or short form in help
						const longFound = allListSections.includes(opt.long);
						const shortFound = opt.short
							? allListSections.includes(opt.short)
							: false;
						return !longFound && !shortFound;
					}
				);

				if (missingOptions.length > 0) {
					console.log(
						'\nList options implemented in CLI but missing from help:'
					);
					missingOptions.forEach((opt) => console.log(`  - ${opt.long}`));
					console.log(
						'\nTo fix: Add these to the list entries in displayHelp()\n'
					);
				}

				expect(
					missingOptions.map((o) => o.long),
					`Implemented list options missing from help: ${missingOptions.map((o) => o.long).join(', ')}`
				).toEqual([]);
			});
		});

		describe('general subcommand coverage', () => {
			it('should document every tags subcommand that exists in the source code', () => {
				const implementedSubcommands =
					extractSubcommandsFromModernTs('tags.command.ts');

				// Verify we are actually extracting subcommands (sanity check)
				expect(
					implementedSubcommands.length,
					'Should find tags subcommands in tags.command.ts'
				).toBeGreaterThan(0);

				const helpContent = getHelpContent();

				// Every subcommand defined in the source should be mentioned in help,
				// either as "tags <subcmd>" (explicit entry) or within the parent tags
				// entry's args field (for default-action subcommands like "list")
				const undocumentedSubcommands = implementedSubcommands.filter(
					(subcmd) => {
						// Check if documented as "tags <subcmd>" entry
						if (helpContent.includes(`tags ${subcmd}`)) return false;
						// Check if it is a default-action subcommand documented in
						// the parent entry's args (e.g. name: 'tags', args: '[list] ...')
						if (TAGS_DEFAULT_ACTION_SUBCOMMANDS.includes(subcmd)) {
							const tagsEntry = helpContent.match(
								/name:\s*['"]tags['"]\s*,\s*args:\s*['"]([^'"]*)['"]/
							);
							if (tagsEntry && tagsEntry[1].includes(subcmd)) return false;
						}
						return true;
					}
				);

				expect(
					undocumentedSubcommands,
					`Undocumented tags subcommands: ${undocumentedSubcommands.join(', ')}`
				).toEqual([]);
			});

			it('should not have tags subcommands in help that do not exist in the source', () => {
				const implementedSubcommands =
					extractSubcommandsFromModernTs('tags.command.ts');
				const helpContent = getHelpContent();

				// Extract "tags xxx" patterns from help (explicit subcommand entries)
				const tagsInHelp: string[] = [];
				const tagsPattern = /name:\s*['"]tags\s+(\w+)['"]/g;
				let match;
				while ((match = tagsPattern.exec(helpContent)) !== null) {
					tagsInHelp.push(match[1]);
				}

				// Every tags subcommand in help should actually exist in source
				const phantomSubcommands = tagsInHelp.filter(
					(subcmd) => !implementedSubcommands.includes(subcmd)
				);

				if (phantomSubcommands.length > 0) {
					console.log(
						'\nTags subcommands in help but not implemented:'
					);
					phantomSubcommands.forEach((cmd) =>
						console.log(`  - tags ${cmd}`)
					);
					console.log(
						'\nTo fix: Either implement the subcommand or remove it from help\n'
					);
				}

				expect(
					phantomSubcommands,
					`Phantom tags subcommands in help: ${phantomSubcommands.join(', ')}`
				).toEqual([]);
			});
		});
	});
});
