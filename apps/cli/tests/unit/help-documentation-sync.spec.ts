/**
 * @fileoverview Test to ensure help documentation stays in sync with CLI commands,
 * including verification that subcommands and command options are correctly documented.
 *
 * The CLI has commands in two locations:
 * 1. Legacy: scripts/modules/commands.js
 * 2. Modern: apps/cli/src/commands/*.ts (including subdirectories like autopilot/)
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

import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';
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
 * Extract command names from modern TypeScript command files.
 * Scans top-level .command.ts files AND index.ts in immediate subdirectories
 * (e.g. autopilot/index.ts defines the 'autopilot' top-level command).
 * Subdirectory *.command.ts files are subcommands, not top-level commands.
 *
 * Looks for patterns like: super(name || 'command-name') or super('command-name')
 */
function extractCommandsFromModernTs(): string[] {
	const commands = new Set<string>();
	const filesToScan: string[] = [];

	try {
		const entries = readdirSync(MODERN_COMMANDS_DIR);

		for (const entry of entries) {
			const fullPath = resolve(MODERN_COMMANDS_DIR, entry);

			try {
				const stat = statSync(fullPath);

				if (stat.isDirectory()) {
					// For subdirectories, only check index.ts which defines the
					// top-level command (e.g. autopilot/index.ts -> 'autopilot').
					// The *.command.ts files inside are subcommands, not top-level.
					const indexPath = join(fullPath, 'index.ts');
					try {
						statSync(indexPath);
						filesToScan.push(indexPath);
					} catch {
						// No index.ts in this subdirectory
					}
				} else if (
					entry.endsWith('.command.ts') &&
					!entry.includes('.spec.') &&
					!entry.includes('.test.')
				) {
					filesToScan.push(fullPath);
				}
			} catch {
				// Skip entries that can't be stat'd
			}
		}
	} catch {
		// Directory might not exist in some configurations
	}

	for (const filePath of filesToScan) {
		try {
			const content = readFileSync(filePath, 'utf-8');

			// Match super(name || 'command-name') or super('command-name') patterns
			const superRegex = /super\((?:name \|\| )?['"]([^'"]+)['"]\)/g;
			let match;
			while ((match = superRegex.exec(content)) !== null) {
				commands.add(match[1]);
			}
		} catch {
			// File might not be readable
		}
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
 * Extract help entry names from the displayHelp() section in ui.js.
 * Returns the full name values (e.g. 'tags add', 'list', 'models --setup').
 * This is more precise than raw substring matching against the entire file.
 */
function extractHelpEntryNames(content: string): string[] {
	const nameRegex = /name:\s*['"]([^'"]+)['"]/g;
	const names: string[] = [];
	let match;
	while ((match = nameRegex.exec(content)) !== null) {
		names.push(match[1]);
	}
	return names;
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
 * Looks for .option() calls and returns the option flags.
 * Throws if the file cannot be read (fail-fast instead of returning []).
 */
function extractOptionsFromModernTs(commandFileName: string): string[] {
	const options: string[] = [];

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
	'loop', // Autonomous loop mode
	'autopilot' // AI agent orchestration - documented separately
];

/**
 * Commands documented in help that map to different CLI command names.
 *
 * TEMPORARY DURING TAG MIGRATION: This mapping exempts legacy tag commands from help
 * validation while they are being deprecated in favor of the new 'tags' subcommand structure.
 * Legacy commands to be removed: add-tag, use-tag, delete-tag, rename-tag, copy-tag
 *
 * NOTE: Only non-identity mappings belong here. Do NOT add identity mappings
 * (e.g. tags: 'tags') as they cause both sync checks to skip the command entirely,
 * meaning removal from help or CLI would go undetected.
 */
const COMMAND_NAME_MAPPINGS: Record<string, string> = {
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

		expect(
			missingFromHelp,
			`Commands missing from help documentation: ${missingFromHelp.join(', ')}. ` +
				'To fix: Add to displayHelp() in scripts/modules/ui.js, ' +
				'or add to INTENTIONALLY_UNDOCUMENTED if they should not be documented.'
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

		expect(
			obsoleteInHelp,
			`Obsolete commands in help documentation: ${obsoleteInHelp.join(', ')}. ` +
				'To fix: Remove from displayHelp() in scripts/modules/ui.js, ' +
				'or add to COMMAND_NAME_MAPPINGS if they map to different CLI command names.'
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

		// Check for some known modern commands (including subdirectory commands)
		expect(commands).toContain('list');
		expect(commands).toContain('show');
		expect(commands).toContain('tags');
		expect(commands).toContain('autopilot');
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
				const helpEntryNames = extractHelpEntryNames(helpContent);

				// Extract subcommands directly from the tags.command.ts implementation
				const implementedSubcommands =
					extractSubcommandsFromModernTs('tags.command.ts');

				// Each implemented subcommand should appear as a "tags <subcommand>" help entry,
				// UNLESS it is a default-action subcommand (e.g. "list") which is documented
				// as part of the parent command entry (name: 'tags', args: '[list] ...')
				const missingSubcommands = implementedSubcommands.filter(
					(subcmd) =>
						!TAGS_DEFAULT_ACTION_SUBCOMMANDS.includes(subcmd) &&
						!helpEntryNames.some((name) => name === `tags ${subcmd}`)
				);

				expect(
					missingSubcommands,
					`Tags subcommands missing from help: ${missingSubcommands.map((s) => 'tags ' + s).join(', ')}. ` +
						'To fix: Add to the Tag Management section in displayHelp() in ui.js'
				).toEqual([]);
			});

			it('should document the expected tags subcommand structure', () => {
				const helpContent = getHelpContent();
				const helpEntryNames = extractHelpEntryNames(helpContent);

				// The unified tags command structure should include these subcommands
				const expectedTagsSubcommands = [
					'tags add',
					'tags use',
					'tags remove',
					'tags rename',
					'tags copy'
				];

				const missingSubcommands = expectedTagsSubcommands.filter(
					(subcmd) => !helpEntryNames.includes(subcmd)
				);

				expect(
					missingSubcommands,
					`Missing tags subcommands: ${missingSubcommands.join(', ')}. ` +
						'Help should document the unified tags subcommand structure ' +
						'(tags add, tags use, tags remove, tags rename, tags copy).'
				).toEqual([]);
			});

			it('should not document deprecated standalone tag commands as primary entries', () => {
				const helpContent = getHelpContent();
				const helpEntryNames = extractHelpEntryNames(helpContent);

				// These old-style commands should NOT appear as primary help entry names.
				const deprecatedCommands = [
					'add-tag',
					'use-tag',
					'delete-tag',
					'rename-tag',
					'copy-tag'
				];

				// Check if any deprecated command appears as its own help entry name
				const foundDeprecated = deprecatedCommands.filter((cmd) =>
					helpEntryNames.some(
						(name) => name === cmd || name.startsWith(cmd + ' ')
					)
				);

				expect(
					foundDeprecated.length,
					`Deprecated tag commands found as help entries: ${foundDeprecated.join(', ')}. ` +
						'These should be replaced with unified tags subcommands.'
				).toBe(0);
			});

			it('should document tags list default action with its options', () => {
				const helpContent = getHelpContent();

				// The tags default action (list) is documented as:
				//   name: 'tags', args: '[list] [--show-metadata] [--ready]'
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

				const expectedFilterOptions = [
					'--with-subtasks',
					'--ready',
					'--blocking'
				];

				const listMatches = helpContent.match(
					/name:\s*['"]list['"][^}]+}/g
				);

				if (!listMatches || listMatches.length === 0) {
					throw new Error(
						'Could not find list command section in help'
					);
				}

				const allListSections = listMatches.join('\n');
				const missingOptions = expectedFilterOptions.filter(
					(opt) => !allListSections.includes(opt)
				);

				expect(
					missingOptions,
					`Missing list filter options: ${missingOptions.join(', ')}. ` +
						'To fix: Add to the list command entries in displayHelp()'
				).toEqual([]);
			});

			it('should document list command output format options', () => {
				const helpContent = getHelpContent();

				const expectedFormatOptions = ['--json', '-f', '-c'];

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

				expect(
					missingOptions,
					`Missing list format options: ${missingOptions.join(', ')}`
				).toEqual([]);
			});

			it('should document list command watch mode option', () => {
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

				const implementedOptions =
					extractOptionsFromModernTs('list.command.ts');

				// Fail fast if extraction returned nothing — a parse/read
				// failure would make all assertions vacuously pass
				expect(
					implementedOptions.length,
					'Should extract options from list.command.ts — ' +
						'if this fails, the option-extraction regex may need updating'
				).toBeGreaterThan(0);

				const listMatches = helpContent.match(
					/name:\s*['"]list['"][^}]+}/g
				);

				if (!listMatches || listMatches.length === 0) {
					throw new Error(
						'Could not find list command section in help'
					);
				}

				const allListSections = listMatches.join('\n');

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
						if (!implementedOptions.includes(opt.long)) return false;
						const longFound = allListSections.includes(opt.long);
						const shortFound = opt.short
							? allListSections.includes(opt.short)
							: false;
						return !longFound && !shortFound;
					}
				);

				expect(
					missingOptions.map((o) => o.long),
					`Implemented list options missing from help: ${missingOptions.map((o) => o.long).join(', ')}. ` +
						'To fix: Add to the list entries in displayHelp()'
				).toEqual([]);
			});
		});

		describe('general subcommand coverage', () => {
			it('should document every tags subcommand that exists in the source code', () => {
				const implementedSubcommands =
					extractSubcommandsFromModernTs('tags.command.ts');

				expect(
					implementedSubcommands.length,
					'Should find tags subcommands in tags.command.ts'
				).toBeGreaterThan(0);

				const helpContent = getHelpContent();
				const helpEntryNames = extractHelpEntryNames(helpContent);

				const undocumentedSubcommands = implementedSubcommands.filter(
					(subcmd) => {
						if (helpEntryNames.some((name) => name === `tags ${subcmd}`)) return false;
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

				const tagsInHelp: string[] = [];
				const tagsPattern = /name:\s*['"]tags\s+(\w+)['"]/g;
				let match;
				while ((match = tagsPattern.exec(helpContent)) !== null) {
					tagsInHelp.push(match[1]);
				}

				const phantomSubcommands = tagsInHelp.filter(
					(subcmd) => !implementedSubcommands.includes(subcmd)
				);

				expect(
					phantomSubcommands,
					`Phantom tags subcommands in help: ${phantomSubcommands.join(', ')}. ` +
						'To fix: Either implement the subcommand or remove it from help'
				).toEqual([]);
			});
		});
	});
});
