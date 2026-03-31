/**
 * help-documentation-sync.test.js
 *
 * Ensures that help documentation in scripts/modules/ui.js (displayHelp())
 * stays in sync with the actual command implementations.
 *
 * Sources of truth for commands:
 *   1. Legacy commands: scripts/modules/commands.js — .command('name') registrations
 *   2. New CLI commands: apps/cli/src/command-registry.ts — CommandRegistry entries
 *
 * Help documentation:
 *   scripts/modules/ui.js — displayHelp() commandCategories
 *
 * Related: https://github.com/eyaltoledano/claude-task-master/issues/1594
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve paths from the project root (fileURLToPath handles percent-encoding and Windows drive letters)
const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..', '..'
);

const COMMANDS_JS_PATH = path.join(
	projectRoot,
	'scripts/modules/commands.js'
);
const COMMAND_REGISTRY_TS_PATH = path.join(
	projectRoot,
	'apps/cli/src/command-registry.ts'
);
const UI_JS_PATH = path.join(projectRoot, 'scripts/modules/ui.js');

/**
 * Commands intentionally excluded from the help text.
 * Each entry requires a reason so the exclusion is auditable.
 */
const INTENTIONALLY_EXCLUDED_FROM_HELP = {
	// --- Meta / internal commands ---
	help: 'The help command itself — it displays the help, does not need a help entry',
	tui: 'Terminal UI mode — experimental/internal, not documented in help',

	// --- Deprecated legacy commands replaced by `tags` subcommands ---
	'add-tag': 'Deprecated — replaced by `tags add`',
	'delete-tag': 'Deprecated — replaced by `tags remove`',
	'use-tag': 'Deprecated — replaced by `tags use`',
	'rename-tag': 'Deprecated — replaced by `tags rename`',
	'copy-tag': 'Deprecated — replaced by `tags copy`',

	// --- Commands that are currently undocumented in help (tracked for future addition) ---
	'scope-up': 'Advanced command — not yet added to help documentation',
	'scope-down': 'Advanced command — not yet added to help documentation',
	lang: 'Language configuration — not yet added to help documentation',
	move: 'Task move command — not yet added to help documentation',
	rules: 'Rules management — not yet added to help documentation',
	migrate: 'Migration command — not yet added to help documentation',

	// --- New CLI-only commands not yet in legacy help ---
	start: 'New CLI command — not yet added to legacy help documentation',
	export: 'Hamster export command — not yet added to legacy help documentation',
	'export-tag': 'Hamster tag export — not yet added to legacy help documentation',
	autopilot: 'AI agent orchestration — not yet added to legacy help documentation',
	loop: 'Claude Code loop mode — not yet added to legacy help documentation',
	auth: 'Authentication command — not yet added to legacy help documentation',
	login: 'Login alias — not yet added to legacy help documentation',
	logout: 'Logout alias — not yet added to legacy help documentation',
	context: 'Workspace context — not yet added to legacy help documentation',
	briefs: 'Briefs management — not yet added to legacy help documentation'
};

/**
 * Extract all .command('name') registrations from the legacy commands.js file.
 * Ignores argument definitions like 'rules [action] [profiles...]' — only takes the base name.
 */
function extractLegacyCommands(fileContent) {
	const commandRegex = /\.command\(\s*'([^']+)'\s*\)/g;
	const commands = new Set();
	let match;
	while ((match = commandRegex.exec(fileContent)) !== null) {
		// Extract the base command name (first word before any space/arguments)
		const baseName = match[1].split(/\s+/)[0];
		commands.add(baseName);
	}
	return commands;
}

/**
 * Extract command names from the CommandRegistry in command-registry.ts.
 * Matches entries like: name: 'list',
 */
function extractCliRegistryCommands(fileContent) {
	// Match name fields inside the commands array
	const nameRegex = /name:\s*'([^']+)'/g;
	const commands = new Set();
	let match;
	while ((match = nameRegex.exec(fileContent)) !== null) {
		commands.add(match[1]);
	}
	return commands;
}

/**
 * Extract base command names from displayHelp() in ui.js.
 * Handles entries like 'models --setup' by taking only the base name 'models'.
 * Handles entries like 'tags add' by taking only 'tags'.
 */
function extractHelpCommands(fileContent) {
	// Only look at the content within the displayHelp function body.
	// We find the opening brace and then brace-match to the closing brace
	// so that later name: properties in ui.js are not accidentally included.
	const helpFnStart = fileContent.indexOf('function displayHelp()');
	if (helpFnStart === -1) {
		throw new Error('Could not find displayHelp() in ui.js');
	}

	const openBrace = fileContent.indexOf('{', helpFnStart);
	if (openBrace === -1) {
		throw new Error('Could not find opening brace for displayHelp()');
	}

	// Brace-match to find the end of the function body
	let depth = 0;
	let closeBrace = -1;
	for (let i = openBrace; i < fileContent.length; i++) {
		if (fileContent[i] === '{') depth++;
		else if (fileContent[i] === '}') depth--;
		if (depth === 0) {
			closeBrace = i;
			break;
		}
	}

	const helpContent = closeBrace !== -1
		? fileContent.slice(openBrace, closeBrace + 1)
		: fileContent.slice(openBrace);

	// NOTE: We intentionally extract only the base command name (first word).
	// Entries like 'tags add' -> 'tags' and 'models --setup' -> 'models'.
	// This test validates command *presence* in help, not subcommand/flag drift.
	const nameRegex = /name:\s*'([^']+)'/g;
	const commands = new Set();
	let match;
	while ((match = nameRegex.exec(helpContent)) !== null) {
		const baseName = match[1].split(/\s+/)[0];
		commands.add(baseName);
	}
	return commands;
}

/**
 * Combine legacy and CLI registry commands into a single unified set.
 */
function getAllRegisteredCommands(legacyCommands, cliRegistryCommands) {
	const all = new Set([...legacyCommands, ...cliRegistryCommands]);
	return all;
}

describe('Help Documentation Sync', () => {
	let legacyCommands;
	let cliRegistryCommands;
	let helpCommands;
	let allRegisteredCommands;

	beforeAll(() => {
		const commandsContent = fs.readFileSync(COMMANDS_JS_PATH, 'utf-8');
		const registryContent = fs.readFileSync(
			COMMAND_REGISTRY_TS_PATH,
			'utf-8'
		);
		const uiContent = fs.readFileSync(UI_JS_PATH, 'utf-8');

		legacyCommands = extractLegacyCommands(commandsContent);
		cliRegistryCommands = extractCliRegistryCommands(registryContent);
		helpCommands = extractHelpCommands(uiContent);
		allRegisteredCommands = getAllRegisteredCommands(
			legacyCommands,
			cliRegistryCommands
		);
	});

	it('should parse commands from all sources', () => {
		expect(legacyCommands.size).toBeGreaterThan(0);
		expect(cliRegistryCommands.size).toBeGreaterThan(0);
		expect(helpCommands.size).toBeGreaterThan(0);
	});

	it('should have a help entry for every registered command (or an explicit exclusion)', () => {
		const missingFromHelp = [];

		for (const cmd of allRegisteredCommands) {
			if (!helpCommands.has(cmd) && !INTENTIONALLY_EXCLUDED_FROM_HELP[cmd]) {
				missingFromHelp.push(cmd);
			}
		}

		if (missingFromHelp.length > 0) {
			const message = [
				'The following commands are registered but have NO entry in displayHelp() and',
				'are NOT in the INTENTIONALLY_EXCLUDED_FROM_HELP allow-list:',
				'',
				...missingFromHelp.map((c) => `  - ${c}`),
				'',
				'To fix: either add a help entry in scripts/modules/ui.js displayHelp(),',
				'or add the command to INTENTIONALLY_EXCLUDED_FROM_HELP in this test with a reason.'
			].join('\n');
			// Log for CI readability before the assertion throws
			console.error(message);
		}

		expect(missingFromHelp).toEqual([]);
	});

	it('should not have help entries for commands that do not exist', () => {
		const extraInHelp = [];

		for (const cmd of helpCommands) {
			if (!allRegisteredCommands.has(cmd)) {
				extraInHelp.push(cmd);
			}
		}

		if (extraInHelp.length > 0) {
			const message = [
				'The following commands appear in displayHelp() but are NOT registered',
				'in either commands.js or command-registry.ts:',
				'',
				...extraInHelp.map((c) => `  - ${c}`),
				'',
				'To fix: either register the command, or remove the stale help entry.'
			].join('\n');
			// Also log for CI readability
			console.error(message);
		}

		expect(extraInHelp).toEqual([]);
	});

	it('should have a documented reason for every intentional exclusion', () => {
		for (const [cmd, reason] of Object.entries(
			INTENTIONALLY_EXCLUDED_FROM_HELP
		)) {
			expect(reason).toBeTruthy();
			expect(typeof reason).toBe('string');
			expect(reason.length).toBeGreaterThan(5);
		}
	});

	it('should not have stale entries in the exclusion list', () => {
		const staleExclusions = [];

		for (const cmd of Object.keys(INTENTIONALLY_EXCLUDED_FROM_HELP)) {
			// If the command is now in help AND still in the exclusion list, that's stale
			if (helpCommands.has(cmd) && allRegisteredCommands.has(cmd)) {
				staleExclusions.push(cmd);
			}
			// If the command doesn't exist anywhere anymore, the exclusion is orphaned
			if (!allRegisteredCommands.has(cmd) && !helpCommands.has(cmd)) {
				staleExclusions.push(`${cmd} (orphaned — command no longer exists)`);
			}
		}

		if (staleExclusions.length > 0) {
			console.error(
				'Stale entries in INTENTIONALLY_EXCLUDED_FROM_HELP:\n' +
					staleExclusions.map((c) => `  - ${c}`).join('\n') +
					'\nRemove these entries since they are no longer needed.'
			);
		}

		expect(staleExclusions).toEqual([]);
	});

	it('should detect when a new command file is added to apps/cli/src/commands/ without registry entry', () => {
		// Get all .command.ts files in the commands directory
		const commandsDir = path.join(
			projectRoot,
			'apps/cli/src/commands'
		);
		const commandFiles = fs
			.readdirSync(commandsDir)
			.filter(
				(f) =>
					f.endsWith('.command.ts') &&
					!f.endsWith('.spec.ts') &&
					!f.endsWith('.test.ts')
			)
			.map((f) => f.replace('.command.ts', ''));

		const registryNames = [...cliRegistryCommands];

		const unregisteredFiles = commandFiles.filter(
			(name) => !registryNames.includes(name)
		);

		if (unregisteredFiles.length > 0) {
			console.error(
				'Command files exist without registry entries:\n' +
					unregisteredFiles
						.map((c) => `  - apps/cli/src/commands/${c}.command.ts`)
						.join('\n') +
					'\nAdd these to apps/cli/src/command-registry.ts'
			);
		}

		expect(unregisteredFiles).toEqual([]);
	});
});
