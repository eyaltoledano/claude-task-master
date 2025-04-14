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
 * Claude Task Master
 * A task management system for AI-driven development with Claude
 */

// This file serves as the main entry point for the package
// The primary functionality is provided through the CLI commands

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { Command } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Get package information
const packageJson = require('./package.json');

// Export the path to the dev.js script for programmatic usage
export const devScriptPath = resolve(__dirname, './scripts/dev.js');

// Export a function to initialize a new project programmatically
export const initProject = async (options = {}) => {
	const init = await import('./scripts/init.js');
	return init.initializeProject(options);
};

// Export a function to run init as a CLI command
export const runInitCLI = async (options = {}) => {
	try {
		const init = await import('./scripts/init.js');
		const result = await init.initializeProject(options);
		return result;
	} catch (error) {
		console.error('Initialization failed:', error.message);
		if (process.env.DEBUG === 'true') {
			console.error('Debug stack trace:', error.stack);
		}
		throw error; // Re-throw to be handled by the command handler
	}
};

// Export version information
export const version = packageJson.version;

// CLI implementation
if (import.meta.url === `file://${process.argv[1]}`) {
	const program = new Command();

	program
		.name('task-master')
		.description('Claude Task Master CLI')
		.version(version);

	program
		.command('init')
		.description('Initialize a new project')
		.option('-y, --yes', 'Skip prompts and use default values')
		.option('-n, --name <n>', 'Project name')
		.option('-d, --description <description>', 'Project description')
		.option('-v, --version <version>', 'Project version', '0.1.0')
		.option('-a, --author <author>', 'Author name')
		.option('--skip-install', 'Skip installing dependencies')
		.option('--dry-run', 'Show what would be done without making changes')
		.option('--aliases', 'Add shell aliases (tm, taskmaster)')
		.action(async (cmdOptions) => {
			try {
				await runInitCLI(cmdOptions);
			} catch (err) {
				console.error('Init failed:', err.message);
				process.exit(1);
			}
		});

	program
		.command('dev')
		.description('Run the dev.js script')
		.allowUnknownOption(true)
		.action(() => {
			const args = process.argv.slice(process.argv.indexOf('dev') + 1);
			const child = spawn('node', [devScriptPath, ...args], {
				stdio: 'inherit',
				cwd: process.cwd()
			});

			child.on('close', (code) => {
				process.exit(code);
			});
		});

	// Add shortcuts for common dev.js commands
	program
		.command('list')
		.description('List all tasks')
		.action(() => {
			const child = spawn('node', [devScriptPath, 'list'], {
				stdio: 'inherit',
				cwd: process.cwd()
			});

			child.on('close', (code) => {
				process.exit(code);
			});
		});

	program
		.command('next')
		.description('Show the next task to work on')
		.action(() => {
			const child = spawn('node', [devScriptPath, 'next'], {
				stdio: 'inherit',
				cwd: process.cwd()
			});

			child.on('close', (code) => {
				process.exit(code);
			});
		});

	program
		.command('generate')
		.description('Generate task files')
		.action(() => {
			const child = spawn('node', [devScriptPath, 'generate'], {
				stdio: 'inherit',
				cwd: process.cwd()
			});

			child.on('close', (code) => {
				process.exit(code);
			});
		});

	program.parse(process.argv);
}
