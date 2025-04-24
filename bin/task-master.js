#!/usr/bin/env node

/**
 * Task Master
 * Copyright (c) 2025 Eyal Toledano, Ralph Khreish
 *
 * This software is licensed under the MIT License with Commons Clause.
 * You may use this software for any purpose, including commercial applications,
 * and modify and redistribute it freely, subject to the following restrictions:
 *
 * 1. You may not sell this software or offer it as a service.
 * 2. The origin of this software must not be misrepresented.
 * 3. Altered source versions must be plainly marked as such.
 *
 * For the full license text, see the LICENSE file in the root directory.
 */

/**
 * Claude Task Master CLI
 * Main entry point for globally installed package
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { Command } from 'commander';
import { displayHelp, displayBanner } from '../scripts/modules/ui.js';
import { registerCommands } from '../scripts/modules/commands.js';
import { detectCamelCaseFlags } from '../scripts/modules/utils.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Get package information
const packageJson = require('../package.json');
const version = packageJson.version;

// Get paths to script files
const devScriptPath = resolve(__dirname, '../scripts/dev.js');
const initScriptPath = resolve(__dirname, '../scripts/init.js');

// Helper function to run dev.js with arguments
function runDevScript(args) {
	// Debug: Show the transformed arguments when DEBUG=1 is set
	if (process.env.DEBUG === '1') {
		console.error('\nDEBUG - CLI Wrapper Analysis:');
		console.error('- Original command: ' + process.argv.join(' '));
		console.error('- Transformed args: ' + args.join(' '));
		console.error(
			'- dev.js will receive: node ' +
				devScriptPath +
				' ' +
				args.join(' ') +
				'\n'
		);
	}

	// For testing: If TEST_MODE is set, just print args and exit
	if (process.env.TEST_MODE === '1') {
		console.log('Would execute:');
		console.log(`node ${devScriptPath} ${args.join(' ')}`);
		process.exit(0);
		return;
	}

	const child = spawn('node', [devScriptPath, ...args], {
		stdio: 'inherit',
		cwd: process.cwd()
	});

	child.on('close', (code) => {
		process.exit(code);
	});
}

// Helper function to detect camelCase and convert to kebab-case
const toKebabCase = (str) => str.replace(/([A-Z])/g, '-$1').toLowerCase();

/**
 * Create a wrapper action that passes the command to dev.js
 * @param {string} commandName - The name of the command
 * @returns {Function} Wrapper action function
 */
function createDevScriptAction(commandName) {
	return (options, cmd) => {
		// Check for camelCase flags and error out with helpful message
		const camelCaseFlags = detectCamelCaseFlags(process.argv);

		// If camelCase flags were found, show error and exit
		if (camelCaseFlags.length > 0) {
			console.error('\nError: Please use kebab-case for CLI flags:');
			camelCaseFlags.forEach((flag) => {
				console.error(`  Instead of: --${flag.original}`);
				console.error(`  Use:        --${flag.kebabCase}`);
			});
			console.error(
				'\nExample: task-master parse-prd --num-tasks=5 instead of --numTasks=5\n'
			);
			process.exit(1);
		}

		// Since we've ensured no camelCase flags, we can now just:
		// 1. Start with the command name
		const args = [commandName];

		// 3. Get positional arguments and explicit flags from the command line
		const commandArgs = [];
		const positionals = new Set(); // Track positional args we've seen

		// Find the command in raw process.argv to extract args
		const commandIndex = process.argv.indexOf(commandName);
		if (commandIndex !== -1) {
			// Process all args after the command name
			for (let i = commandIndex + 1; i < process.argv.length; i++) {
				const arg = process.argv[i];

				if (arg.startsWith('--')) {
					// It's a flag - pass through as is
					commandArgs.push(arg);
					// Skip the next arg if this is a flag with a value (not --flag=value format)
					if (
						!arg.includes('=') &&
						i + 1 < process.argv.length &&
						!process.argv[i + 1].startsWith('--')
					) {
						commandArgs.push(process.argv[++i]);
					}
				} else if (!positionals.has(arg)) {
					// It's a positional argument we haven't seen
					commandArgs.push(arg);
					positionals.add(arg);
				}
			}
		}

		// Add all command line args we collected
		args.push(...commandArgs);

		// 4. Add default options from Commander if not specified on command line
		// Track which options we've seen on the command line
		const userOptions = new Set();
		for (const arg of commandArgs) {
			if (arg.startsWith('--')) {
				// Extract option name (without -- and value)
				const name = arg.split('=')[0].slice(2);
				userOptions.add(name);

				// Add the kebab-case version too, to prevent duplicates
				const kebabName = name.replace(/([A-Z])/g, '-$1').toLowerCase();
				userOptions.add(kebabName);

				// Add the camelCase version as well
				const camelName = kebabName.replace(/-([a-z])/g, (_, letter) =>
					letter.toUpperCase()
				);
				userOptions.add(camelName);
			}
		}

		// Add Commander-provided defaults for options not specified by user
		Object.entries(options).forEach(([key, value]) => {
			// Debug output to see what keys we're getting
			if (process.env.DEBUG === '1') {
				console.error(`DEBUG - Processing option: ${key} = ${value}`);
			}

			// Special case for numTasks > num-tasks (a known problem case)
			if (key === 'numTasks') {
				if (process.env.DEBUG === '1') {
					console.error('DEBUG - Converting numTasks to num-tasks');
				}
				if (!userOptions.has('num-tasks') && !userOptions.has('numTasks')) {
					args.push(`--num-tasks=${value}`);
				}
				return;
			}

			// Skip built-in Commander properties and options the user provided
			if (
				['parent', 'commands', 'options', 'rawArgs'].includes(key) ||
				userOptions.has(key)
			) {
				return;
			}

			// Also check the kebab-case version of this key
			const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
			if (userOptions.has(kebabKey)) {
				return;
			}

			// Add default values, using kebab-case for the parameter name
			if (value !== undefined) {
				if (typeof value === 'boolean') {
					if (value === true) {
						args.push(`--${kebabKey}`);
					} else if (value === false && key === 'generate') {
						args.push('--skip-generate');
					}
				} else {
					// Always use kebab-case for option names
					args.push(`--${kebabKey}=${value}`);
				}
			}
		});

		// Special handling for parent parameter (uses -p)
		if (options.parent && !args.includes('-p') && !userOptions.has('parent')) {
			args.push('-p', options.parent);
		}

		// Debug output for troubleshooting
		if (process.env.DEBUG === '1') {
			console.error('DEBUG - Command args:', commandArgs);
			console.error('DEBUG - User options:', Array.from(userOptions));
			console.error('DEBUG - Commander options:', options);
			console.error('DEBUG - Final args:', args);
		}

		// Run the script with our processed args
		runDevScript(args);
	};
}

// // Special case for the 'init' command which uses a different script
// function registerInitCommand(program) {
// 	program
// 		.command('init')
// 		.description('Initialize a new project')
// 		.option('-y, --yes', 'Skip prompts and use default values')
// 		.option('-n, --name <name>', 'Project name')
// 		.option('-d, --description <description>', 'Project description')
// 		.option('-v, --version <version>', 'Project version')
// 		.option('-a, --author <author>', 'Author name')
// 		.option('--skip-install', 'Skip installing dependencies')
// 		.option('--dry-run', 'Show what would be done without making changes')
// 		.action((options) => {
// 			// Pass through any options to the init script
// 			const args = [
// 				'--yes',
// 				'name',
// 				'description',
// 				'version',
// 				'author',
// 				'skip-install',
// 				'dry-run'
// 			]
// 				.filter((opt) => options[opt])
// 				.map((opt) => {
// 					if (opt === 'yes' || opt === 'skip-install' || opt === 'dry-run') {
// 						return `--${opt}`;
// 					}
// 					return `--${opt}=${options[opt]}`;
// 				});

// 			const child = spawn('node', [initScriptPath, ...args], {
// 				stdio: 'inherit',
// 				cwd: process.cwd()
// 			});

// 			child.on('close', (code) => {
// 				process.exit(code);
// 			});
// 		});
// }

// Set up the command-line interface
const program = new Command();

program
	.name('task-master')
	.description('Claude Task Master CLI')
	.version(version)
	.addHelpText('afterAll', () => {
		// Use the same help display function as dev.js for consistency
		displayHelp();
		return ''; // Return empty string to prevent commander's default help
	});

// Add custom help option to directly call our help display
program.helpOption('-h, --help', 'Display help information');
program.on('--help', () => {
	displayHelp();
});

// // Add special case commands
// registerInitCommand(program);

program
	.command('dev')
	.description('Run the dev.js script')
	.action(() => {
		const args = process.argv.slice(process.argv.indexOf('dev') + 1);
		runDevScript(args);
	});

// Use a temporary Command instance to get all command definitions
const tempProgram = new Command();
registerCommands(tempProgram);

// For each command in the temp instance, add a modified version to our actual program
tempProgram.commands.forEach((cmd) => {
	if (['dev'].includes(cmd.name())) {
		// Skip commands we've already defined specially
		return;
	}

	// Create a new command with the same name and description
	const newCmd = program.command(cmd.name()).description(cmd.description());

	// Copy all options
	cmd.options.forEach((opt) => {
		newCmd.option(opt.flags, opt.description, opt.defaultValue);
	});

	// Set the action to proxy to dev.js
	newCmd.action(createDevScriptAction(cmd.name()));
});

/**
 * Checks for legacy project structure and notifies the user if found.
 */
function checkAndNotifyLegacyStructure() {
	const projectRoot = process.cwd();
	const legacyTaskJsonPath = path.join(projectRoot, 'tasks.json'); // Old location
	const legacyTasksDirPath = path.join(projectRoot, 'tasks'); // Old dir
	const legacyScriptsDirPath = path.join(projectRoot, 'scripts'); // Old dir
	const newStructurePath = path.join(projectRoot, '.taskmaster');
	const markerFileName = '.migration_notice_shown';
	const markerFilePath = path.join(legacyScriptsDirPath, markerFileName); // Place marker in old scripts dir

	const hasLegacyTasksJson = fs.existsSync(legacyTaskJsonPath);
	const hasLegacyTasksDir = fs.existsSync(legacyTasksDirPath);
	const hasLegacyScriptsDir = fs.existsSync(legacyScriptsDirPath);
	const hasNewStructure = fs.existsSync(newStructurePath);

	// Detect legacy structure: old files/dirs exist AND new .taskmaster dir does NOT exist
	const isLegacyStructure =
		(hasLegacyTasksJson || hasLegacyTasksDir || hasLegacyScriptsDir) &&
		!hasNewStructure;

	if (isLegacyStructure) {
		// Check if the notification has already been shown (marker file exists)
		// We only check for the marker if the legacy scripts dir exists
		let noticeShown = false;
		if (hasLegacyScriptsDir) {
			try {
				noticeShown = fs.existsSync(markerFilePath);
			} catch (err) {
				// Ignore errors reading marker, proceed as if not shown
				if (process.env.DEBUG === '1') {
					console.error(
						chalk.yellow(
							`Debug: Error checking for marker file ${markerFilePath}: ${err.message}`
						)
					);
				}
			}
		}

		if (!noticeShown) {
			console.log(chalk.yellow.bold('\n--- Task Master Structure Update ---'));
			console.log(
				chalk.yellow(
					'Task Master now uses a `.taskmaster/` directory to keep project files organized.'
				)
			);
			console.log(
				chalk.yellow(
					'We detected that this project is using the older structure.'
				)
			);
			console.log(chalk.yellow('\nRecommendation:'));
			console.log(
				chalk.yellow(
					'1. Create a `.taskmaster` directory in your project root.'
				)
			);
			console.log(
				chalk.yellow(
					'2. Manually move your existing `tasks.json`, `tasks/` directory, and `scripts/` directory into `.taskmaster/`.'
				)
			);
			console.log(chalk.yellow('\nExample:'));
			console.log(chalk.gray('   mv tasks.json .taskmaster/tasks.json'));
			console.log(chalk.gray('   mv tasks .taskmaster/tasks'));
			console.log(chalk.gray('   mv scripts .taskmaster/scripts'));
			console.log(
				chalk.yellow(
					'\nA detailed migration guide will be provided soon (Task 2.2).'
				)
			);
			console.log(chalk.yellow.bold('------------------------------------\n'));

			// Create the marker file in the legacy scripts directory if it exists
			if (hasLegacyScriptsDir) {
				try {
					fs.writeFileSync(
						markerFilePath,
						`Notified on: ${new Date().toISOString()}\n`
					);
					if (process.env.DEBUG === '1') {
						console.error(
							chalk.gray(`Debug: Created marker file ${markerFilePath}`)
						);
					}
				} catch (err) {
					console.error(
						chalk.red(
							`Warning: Could not create migration marker file at ${markerFilePath}. You might see this message again. Error: ${err.message}`
						)
					);
				}
			} else {
				// If scripts dir doesn't exist, we can't create the marker there.
				// The user will see the message again, which is acceptable in this edge case.
				if (process.env.DEBUG === '1') {
					console.error(
						chalk.yellow(
							`Debug: Legacy scripts directory not found at ${legacyScriptsDirPath}. Cannot create marker file.`
						)
					);
				}
			}
		}
	}
}

// Check for legacy structure before parsing args, unless it's the 'init' command
const commandName = process.argv[2]; // Get the command name (e.g., 'list', 'init')
if (commandName !== 'init') {
	checkAndNotifyLegacyStructure();
}

// Parse the command line arguments
program.parse(process.argv);

// Add global error handling for unknown commands and options
process.on('uncaughtException', (err) => {
	// Check if this is a commander.js unknown option error
	if (err.code === 'commander.unknownOption') {
		const option = err.message.match(/'([^']+)'/)?.[1];
		const commandArg = process.argv.find(
			(arg) =>
				!arg.startsWith('-') &&
				arg !== 'task-master' &&
				!arg.includes('/') &&
				arg !== 'node'
		);
		const command = commandArg || 'unknown';

		console.error(chalk.red(`Error: Unknown option '${option}'`));
		console.error(
			chalk.yellow(
				`Run 'task-master ${command} --help' to see available options for this command`
			)
		);
		process.exit(1);
	}

	// Check if this is a commander.js unknown command error
	if (err.code === 'commander.unknownCommand') {
		const command = err.message.match(/'([^']+)'/)?.[1];

		console.error(chalk.red(`Error: Unknown command '${command}'`));
		console.error(
			chalk.yellow(`Run 'task-master --help' to see available commands`)
		);
		process.exit(1);
	}

	// Handle other uncaught exceptions
	console.error(chalk.red(`Error: ${err.message}`));
	if (process.env.DEBUG === '1') {
		console.error(err);
	}
	process.exit(1);
});

// Show help if no command was provided (just 'task-master' with no args)
if (process.argv.length <= 2) {
	displayBanner();
	displayHelp();
	process.exit(0);
}

// Add exports at the end of the file
if (typeof module !== 'undefined') {
	module.exports = {
		detectCamelCaseFlags
	};
}
