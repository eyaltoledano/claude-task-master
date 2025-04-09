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

console.log('Starting task-master-ai...');

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { Command } from 'commander';

// Debug information
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());
console.log('Script path:', import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure the CLI program
const program = new Command();
program
	.name('task-master-init')
	.description('Initialize a new Claude Task Master project')
	.version('1.0.0') // Will be replaced by prepare-package script
	.option('-y, --yes', 'Skip prompts and use default values')
	.option('-n, --name <name>', 'Project name')
	.option('-my_name <name>', 'Project name (alias for --name)')
	.option('-d, --description <description>', 'Project description')
	.option(
		'-my_description <description>',
		'Project description (alias for --description)'
	)
	.option('-v, --version <version>', 'Project version')
	.option('-my_version <version>', 'Project version (alias for --version)')
	.option('--my_name <name>', 'Project name (alias for --name)')
	.option('-a, --author <author>', 'Author name')
	.option('--skip-install', 'Skip installing dependencies')
	.option('--dry-run', 'Show what would be done without making changes')
	.option('--aliases', 'Add shell aliases (tm, taskmaster)')
	.parse(process.argv);

const options = program.opts();

// Map custom aliases to standard options
if (options.my_name && !options.name) {
	options.name = options.my_name;
}
if (options.my_description && !options.description) {
	options.description = options.my_description;
}
if (options.my_version && !options.version) {
	options.version = options.my_version;
}

// Define log levels
const LOG_LEVELS = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	success: 4
};

// Get log level from environment or default to info
const LOG_LEVEL = process.env.LOG_LEVEL
	? LOG_LEVELS[process.env.LOG_LEVEL.toLowerCase()]
	: LOG_LEVELS.info;

// Create a color gradient for the banner
const coolGradient = gradient(['#00b4d8', '#0077b6', '#03045e']);
const warmGradient = gradient(['#fb8b24', '#e36414', '#9a031e']);

// Display a fancy banner
function displayBanner() {
	console.clear();
	const bannerText = figlet.textSync('Task Master AI', {
		font: 'Standard',
		horizontalLayout: 'default',
		verticalLayout: 'default'
	});

	console.log(coolGradient(bannerText));

	// Add creator credit line below the banner
	console.log(
		chalk.dim('by ') + chalk.cyan.underline('https://x.com/eyaltoledano')
	);

	console.log(
		boxen(chalk.white(`${chalk.bold('Initializing')} your new project`), {
			padding: 1,
			margin: { top: 0, bottom: 1 },
			borderStyle: 'round',
			borderColor: 'cyan'
		})
	);
}

// Logging function with icons and colors
function log(level, ...args) {
	const icons = {
		debug: chalk.gray('🔍'),
		info: chalk.blue('ℹ️'),
		warn: chalk.yellow('⚠️'),
		error: chalk.red('❌'),
		success: chalk.green('✅')
	};

	if (LOG_LEVELS[level] >= LOG_LEVEL) {
		const icon = icons[level] || '';

		if (level === 'error') {
			console.error(icon, chalk.red(...args));
		} else if (level === 'warn') {
			console.warn(icon, chalk.yellow(...args));
		} else if (level === 'success') {
			console.log(icon, chalk.green(...args));
		} else if (level === 'info') {
			console.log(icon, chalk.blue(...args));
		} else {
			console.log(icon, ...args);
		}
	}

	// Write to debug log if DEBUG=true
	if (process.env.DEBUG === 'true') {
		const logMessage = `[${level.toUpperCase()}] ${args.join(' ')}\n`;
		fs.appendFileSync('init-debug.log', logMessage);
	}
}

// Function to create directory if it doesn't exist
function ensureDirectoryExists(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
		log('info', `Created directory: ${dirPath}`);
	}
}

// Function to add shell aliases to the user's shell configuration
function addShellAliases() {
	const homeDir = process.env.HOME || process.env.USERPROFILE;
	let shellConfigFile;

	// Determine which shell config file to use
	if (process.env.SHELL?.includes('zsh')) {
		shellConfigFile = path.join(homeDir, '.zshrc');
	} else if (process.env.SHELL?.includes('bash')) {
		shellConfigFile = path.join(homeDir, '.bashrc');
	} else {
		log('warn', 'Could not determine shell type. Aliases not added.');
		return false;
	}

	try {
		// Check if file exists
		if (!fs.existsSync(shellConfigFile)) {
			log(
				'warn',
				`Shell config file ${shellConfigFile} not found. Aliases not added.`
			);
			return false;
		}

		// Check if aliases already exist
		const configContent = fs.readFileSync(shellConfigFile, 'utf8');
		if (configContent.includes("alias tm='task-master'")) {
			log('info', 'Task Master aliases already exist in shell config.');
			return true;
		}

		// Add aliases to the shell config file
		const aliasBlock = `
# Task Master aliases added on ${new Date().toLocaleDateString()}
alias tm='task-master'
alias taskmaster='task-master'
`;

		fs.appendFileSync(shellConfigFile, aliasBlock);
		log('success', `Added Task Master aliases to ${shellConfigFile}`);
		log(
			'info',
			'To use the aliases in your current terminal, run: source ' +
				shellConfigFile
		);

		return true;
	} catch (error) {
		log('error', `Failed to add aliases: ${error.message}`);
		return false;
	}
}

// Function to copy a file from the package to the target directory
function copyTemplateFile(templateName, targetPath, replacements = {}) {
	// Get the file content from the appropriate source directory
	let sourcePath;

	// Map template names to their actual source paths
	switch (templateName) {
		case 'dev.js':
			sourcePath = path.join(__dirname, 'dev.js');
			break;
		case 'scripts_README.md':
			sourcePath = path.join(__dirname, '..', 'assets', 'scripts_README.md');
			break;
		case 'dev_workflow.mdc':
			sourcePath = path.join(
				__dirname,
				'..',
				'.cursor',
				'rules',
				'dev_workflow.mdc'
			);
			break;
		case 'taskmaster.mdc':
			sourcePath = path.join(
				__dirname,
				'..',
				'.cursor',
				'rules',
				'taskmaster.mdc'
			);
			break;
		case 'cursor_rules.mdc':
			sourcePath = path.join(
				__dirname,
				'..',
				'.cursor',
				'rules',
				'cursor_rules.mdc'
			);
			break;
		case 'self_improve.mdc':
			sourcePath = path.join(
				__dirname,
				'..',
				'.cursor',
				'rules',
				'self_improve.mdc'
			);
			break;
		case 'README-task-master.md':
			sourcePath = path.join(__dirname, '..', 'README-task-master.md');
			break;
		case 'windsurfrules':
			sourcePath = path.join(__dirname, '..', 'assets', '.windsurfrules');
			break;
		default:
			// For other files like env.example, gitignore, etc. that don't have direct equivalents
			sourcePath = path.join(__dirname, '..', 'assets', templateName);
	}

	// Check if the source file exists
	if (!fs.existsSync(sourcePath)) {
		// Fall back to templates directory for files that might not have been moved yet
		sourcePath = path.join(__dirname, '..', 'assets', templateName);
		if (!fs.existsSync(sourcePath)) {
			log('error', `Source file not found: ${sourcePath}`);
			return;
		}
	}

	let content = fs.readFileSync(sourcePath, 'utf8');

	// Replace placeholders with actual values
	Object.entries(replacements).forEach(([key, value]) => {
		const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
		content = content.replace(regex, value);
	});

	// Handle special files that should be merged instead of overwritten
	if (fs.existsSync(targetPath)) {
		const filename = path.basename(targetPath);

		// Handle .gitignore - append lines that don't exist
		if (filename === '.gitignore') {
			log('info', `${targetPath} already exists, merging content...`);
			const existingContent = fs.readFileSync(targetPath, 'utf8');
			const existingLines = new Set(
				existingContent.split('\n').map((line) => line.trim())
			);
			const newLines = content
				.split('\n')
				.filter((line) => !existingLines.has(line.trim()));

			if (newLines.length > 0) {
				// Add a comment to separate the original content from our additions
				const updatedContent =
					existingContent.trim() +
					'\n\n# Added by Claude Task Master\n' +
					newLines.join('\n');
				fs.writeFileSync(targetPath, updatedContent);
				log('success', `Updated ${targetPath} with additional entries`);
			} else {
				log('info', `No new content to add to ${targetPath}`);
			}
			return;
		}

		// Handle .windsurfrules - append the entire content
		if (filename === '.windsurfrules') {
			log(
				'info',
				`${targetPath} already exists, appending content instead of overwriting...`
			);
			const existingContent = fs.readFileSync(targetPath, 'utf8');

			// Add a separator comment before appending our content
			const updatedContent =
				existingContent.trim() +
				'\n\n# Added by Task Master - Development Workflow Rules\n\n' +
				content;
			fs.writeFileSync(targetPath, updatedContent);
			log('success', `Updated ${targetPath} with additional rules`);
			return;
		}

		// Handle package.json - merge dependencies
		if (filename === 'package.json') {
			log('info', `${targetPath} already exists, merging dependencies...`);
			try {
				const existingPackageJson = JSON.parse(
					fs.readFileSync(targetPath, 'utf8')
				);
				const newPackageJson = JSON.parse(content);

				// Merge dependencies, preferring existing versions in case of conflicts
				existingPackageJson.dependencies = {
					...newPackageJson.dependencies,
					...existingPackageJson.dependencies
				};

				// Add our scripts if they don't already exist
				existingPackageJson.scripts = {
					...existingPackageJson.scripts,
					...Object.fromEntries(
						Object.entries(newPackageJson.scripts).filter(
							([key]) => !existingPackageJson.scripts[key]
						)
					)
				};

				// Preserve existing type if present
				if (!existingPackageJson.type && newPackageJson.type) {
					existingPackageJson.type = newPackageJson.type;
				}

				fs.writeFileSync(
					targetPath,
					JSON.stringify(existingPackageJson, null, 2)
				);
				log(
					'success',
					`Updated ${targetPath} with required dependencies and scripts`
				);
			} catch (error) {
				log('error', `Failed to merge package.json: ${error.message}`);
				// Fallback to writing a backup of the existing file and creating a new one
				const backupPath = `${targetPath}.backup-${Date.now()}`;
				fs.copyFileSync(targetPath, backupPath);
				log('info', `Created backup of existing package.json at ${backupPath}`);
				fs.writeFileSync(targetPath, content);
				log(
					'warn',
					`Replaced ${targetPath} with new content (due to JSON parsing error)`
				);
			}
			return;
		}

		// Handle README.md - offer to preserve or create a different file
		if (filename === 'README.md') {
			log('info', `${targetPath} already exists`);
			// Create a separate README file specifically for this project
			const taskMasterReadmePath = path.join(
				path.dirname(targetPath),
				'README-task-master.md'
			);
			fs.writeFileSync(taskMasterReadmePath, content);
			log(
				'success',
				`Created ${taskMasterReadmePath} (preserved original README.md)`
			);
			return;
		}

		// For other files, warn and prompt before overwriting
		log(
			'warn',
			`${targetPath} already exists. Skipping file creation to avoid overwriting existing content.`
		);
		return;
	}

	// If the file doesn't exist, create it normally
	fs.writeFileSync(targetPath, content);
	log('info', `Created file: ${targetPath}`);
}

// Main function to initialize a new project
async function initializeProject(options = {}) {
	// Display the banner
	displayBanner();

	// If options are provided, use them directly without prompting
	if (options.projectName && options.projectDescription) {
		const projectName = options.projectName;
		const projectDescription = options.projectDescription;
		const projectVersion = options.projectVersion || '1.0.0';
		const authorName = options.authorName || '';
		const dryRun = options.dryRun || false;
		const skipInstall = options.skipInstall || false;
		const addAliases = options.addAliases || false;

		if (dryRun) {
			log('info', 'DRY RUN MODE: No files will be modified');
			log(
				'info',
				`Would initialize project: ${projectName} (${projectVersion})`
			);
			log('info', `Description: ${projectDescription}`);
			log('info', `Author: ${authorName || 'Not specified'}`);
			log('info', 'Would create/update necessary project files');
			if (addAliases) {
				log('info', 'Would add shell aliases for task-master');
			}
			if (!skipInstall) {
				log('info', 'Would install dependencies');
			}
			return {
				projectName,
				projectDescription,
				projectVersion,
				authorName,
				dryRun: true
			};
		}

		createProjectStructure(
			projectName,
			projectDescription,
			projectVersion,
			authorName,
			skipInstall,
			addAliases
		);
		return {
			projectName,
			projectDescription,
			projectVersion,
			authorName
		};
	}

	// Otherwise, prompt the user for input
	// Create readline interface only when needed
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	try {
		const projectName = await promptQuestion(
			rl,
			chalk.cyan('Enter project name: ')
		);
		const projectDescription = await promptQuestion(
			rl,
			chalk.cyan('Enter project description: ')
		);
		const projectVersionInput = await promptQuestion(
			rl,
			chalk.cyan('Enter project version (default: 1.0.0): ')
		);
		const authorName = await promptQuestion(
			rl,
			chalk.cyan('Enter your name: ')
		);

		// Ask about shell aliases
		const addAliasesInput = await promptQuestion(
			rl,
			chalk.cyan('Add shell aliases for task-master? (Y/n): ')
		);
		const addAliases = addAliasesInput.trim().toLowerCase() !== 'n';

		// Set default version if not provided
		const projectVersion = projectVersionInput.trim()
			? projectVersionInput
			: '1.0.0';

		// Confirm settings
		console.log('\nProject settings:');
		console.log(chalk.blue('Name:'), chalk.white(projectName));
		console.log(chalk.blue('Description:'), chalk.white(projectDescription));
		console.log(chalk.blue('Version:'), chalk.white(projectVersion));
		console.log(
			chalk.blue('Author:'),
			chalk.white(authorName || 'Not specified')
		);
		console.log(
			chalk.blue('Add shell aliases:'),
			chalk.white(addAliases ? 'Yes' : 'No')
		);

		const confirmInput = await promptQuestion(
			rl,
			chalk.yellow('\nDo you want to continue with these settings? (Y/n): ')
		);
		const shouldContinue = confirmInput.trim().toLowerCase() !== 'n';

		// Close the readline interface
		rl.close();

		if (!shouldContinue) {
			log('info', 'Project initialization cancelled by user');
			return null;
		}

		const dryRun = options.dryRun || false;
		const skipInstall = options.skipInstall || false;

		if (dryRun) {
			log('info', 'DRY RUN MODE: No files will be modified');
			log('info', 'Would create/update necessary project files');
			if (addAliases) {
				log('info', 'Would add shell aliases for task-master');
			}
			if (!skipInstall) {
				log('info', 'Would install dependencies');
			}
			return {
				projectName,
				projectDescription,
				projectVersion,
				authorName,
				dryRun: true
			};
		}

		// Create the project structure
		createProjectStructure(
			projectName,
			projectDescription,
			projectVersion,
			authorName,
			skipInstall,
			addAliases
		);

		return {
			projectName,
			projectDescription,
			projectVersion,
			authorName
		};
	} catch (error) {
		// Make sure to close readline on error
		rl.close();
		throw error;
	}
}

// Helper function to promisify readline question
function promptQuestion(rl, question) {
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			resolve(answer);
		});
	});
}

// Function to create the project structure
function createProjectStructure(
	projectName,
	projectDescription,
	projectVersion,
	authorName,
	skipInstall,
	addAliases
) {
	const targetDir = process.cwd();
	log('info', `Initializing project in ${targetDir}`);

	// Create directories
	ensureDirectoryExists(path.join(targetDir, '.cursor', 'rules'));
	ensureDirectoryExists(path.join(targetDir, 'scripts'));
	ensureDirectoryExists(path.join(targetDir, 'tasks'));

	// Define our package.json content
	const packageJson = {
		name: projectName.toLowerCase().replace(/\s+/g, '-'),
		version: projectVersion,
		description: projectDescription,
		author: authorName,
		type: 'module',
		scripts: {
			dev: 'node scripts/dev.js',
			list: 'node scripts/dev.js list',
			generate: 'node scripts/dev.js generate',
			'parse-prd': 'node scripts/dev.js parse-prd'
		},
		dependencies: {
			'@anthropic-ai/sdk': '^0.39.0',
			boxen: '^8.0.1',
			chalk: '^4.1.2',
			commander: '^11.1.0',
			'cli-table3': '^0.6.5',
			cors: '^2.8.5',
			dotenv: '^16.3.1',
			express: '^4.21.2',
			fastmcp: '^1.20.5',
			figlet: '^1.8.0',
			'fuse.js': '^7.0.0',
			'gradient-string': '^3.0.0',
			helmet: '^8.1.0',
			inquirer: '^12.5.0',
			jsonwebtoken: '^9.0.2',
			'lru-cache': '^10.2.0',
			openai: '^4.89.0',
			ora: '^8.2.0'
		}
	};

	// Check if package.json exists and merge if it does
	const packageJsonPath = path.join(targetDir, 'package.json');
	if (fs.existsSync(packageJsonPath)) {
		log('info', 'package.json already exists, merging content...');
		try {
			const existingPackageJson = JSON.parse(
				fs.readFileSync(packageJsonPath, 'utf8')
			);

			// Preserve existing fields but add our required ones
			const mergedPackageJson = {
				...existingPackageJson,
				scripts: {
					...existingPackageJson.scripts,
					...Object.fromEntries(
						Object.entries(packageJson.scripts).filter(
							([key]) =>
								!existingPackageJson.scripts ||
								!existingPackageJson.scripts[key]
						)
					)
				},
				dependencies: {
					...(existingPackageJson.dependencies || {}),
					...Object.fromEntries(
						Object.entries(packageJson.dependencies).filter(
							([key]) =>
								!existingPackageJson.dependencies ||
								!existingPackageJson.dependencies[key]
						)
					)
				}
			};

			// Ensure type is set if not already present
			if (!mergedPackageJson.type && packageJson.type) {
				mergedPackageJson.type = packageJson.type;
			}

			fs.writeFileSync(
				packageJsonPath,
				JSON.stringify(mergedPackageJson, null, 2)
			);
			log('success', 'Updated package.json with required fields');
		} catch (error) {
			log('error', `Failed to merge package.json: ${error.message}`);
			// Create a backup before potentially modifying
			const backupPath = `${packageJsonPath}.backup-${Date.now()}`;
			fs.copyFileSync(packageJsonPath, backupPath);
			log('info', `Created backup of existing package.json at ${backupPath}`);
			fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
			log(
				'warn',
				'Created new package.json (backup of original file was created)'
			);
		}
	} else {
		// If package.json doesn't exist, create it
		fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
		log('success', 'Created package.json');
	}

	// Setup MCP configuration for integration with Cursor
	setupMCPConfiguration(targetDir, packageJson.name);

	// Copy template files with replacements
	const replacements = {
		projectName,
		projectDescription,
		projectVersion,
		authorName,
		year: new Date().getFullYear()
	};

	// Copy .env.example
	copyTemplateFile(
		'env.example',
		path.join(targetDir, '.env.example'),
		replacements
	);

	// Copy .gitignore
	copyTemplateFile('gitignore', path.join(targetDir, '.gitignore'));

	// Copy dev_workflow.mdc
	copyTemplateFile(
		'dev_workflow.mdc',
		path.join(targetDir, '.cursor', 'rules', 'dev_workflow.mdc')
	);

	// Copy taskmaster.mdc
	copyTemplateFile(
		'taskmaster.mdc',
		path.join(targetDir, '.cursor', 'rules', 'taskmaster.mdc')
	);

	// Copy cursor_rules.mdc
	copyTemplateFile(
		'cursor_rules.mdc',
		path.join(targetDir, '.cursor', 'rules', 'cursor_rules.mdc')
	);

	// Copy self_improve.mdc
	copyTemplateFile(
		'self_improve.mdc',
		path.join(targetDir, '.cursor', 'rules', 'self_improve.mdc')
	);

	// Copy .windsurfrules
	copyTemplateFile('windsurfrules', path.join(targetDir, '.windsurfrules'));

	// Copy scripts/dev.js
	copyTemplateFile('dev.js', path.join(targetDir, 'scripts', 'dev.js'));

	// Copy scripts/README.md
	copyTemplateFile(
		'scripts_README.md',
		path.join(targetDir, 'scripts', 'README.md')
	);

	// Copy example_prd.txt
	copyTemplateFile(
		'example_prd.txt',
		path.join(targetDir, 'scripts', 'example_prd.txt')
	);

	// Create main README.md
	copyTemplateFile(
		'README-task-master.md',
		path.join(targetDir, 'README.md'),
		replacements
	);

	// Initialize git repository if git is available
	try {
		if (!fs.existsSync(path.join(targetDir, '.git'))) {
			log('info', 'Initializing git repository...');
			execSync('git init', { stdio: 'ignore' });
			log('success', 'Git repository initialized');
		}
	} catch (error) {
		log('warn', 'Git not available, skipping repository initialization');
	}

	// Run npm install automatically
	console.log(
		boxen(chalk.cyan('Installing dependencies...'), {
			padding: 0.5,
			margin: 0.5,
			borderStyle: 'round',
			borderColor: 'blue'
		})
	);

	try {
		if (!skipInstall) {
			execSync('npm install', { stdio: 'inherit', cwd: targetDir });
			log('success', 'Dependencies installed successfully!');
		} else {
			log('info', 'Dependencies installation skipped');
		}
	} catch (error) {
		log('error', 'Failed to install dependencies:', error.message);
		log('error', 'Please run npm install manually');
	}

	// Display success message
	console.log(
		boxen(
			warmGradient.multiline(
				figlet.textSync('Success!', { font: 'Standard' })
			) +
				'\n' +
				chalk.green('Project initialized successfully!'),
			{
				padding: 1,
				margin: 1,
				borderStyle: 'double',
				borderColor: 'green'
			}
		)
	);

	// Add shell aliases if requested
	if (addAliases) {
		addShellAliases();
	}

	// Display next steps in a nice box
	console.log(
		boxen(
			chalk.cyan.bold('Things you can now do:') +
				'\n\n' +
				chalk.white('1. ') +
				chalk.yellow(
					'Rename .env.example to .env and add your ANTHROPIC_API_KEY and PERPLEXITY_API_KEY'
				) +
				'\n' +
				chalk.white('2. ') +
				chalk.yellow(
					'Discuss your idea with AI, and once ready ask for a PRD using the example_prd.txt file, and save what you get to scripts/PRD.txt'
				) +
				'\n' +
				chalk.white('3. ') +
				chalk.yellow(
					'Ask Cursor Agent to parse your PRD.txt and generate tasks'
				) +
				'\n' +
				chalk.white('   └─ ') +
				chalk.dim('You can also run ') +
				chalk.cyan('task-master parse-prd <your-prd-file.txt>') +
				'\n' +
				chalk.white('4. ') +
				chalk.yellow('Ask Cursor to analyze the complexity of your tasks') +
				'\n' +
				chalk.white('5. ') +
				chalk.yellow(
					'Ask Cursor which task is next to determine where to start'
				) +
				'\n' +
				chalk.white('6. ') +
				chalk.yellow(
					'Ask Cursor to expand any complex tasks that are too large or complex.'
				) +
				'\n' +
				chalk.white('7. ') +
				chalk.yellow(
					'Ask Cursor to set the status of a task, or multiple tasks. Use the task id from the task lists.'
				) +
				'\n' +
				chalk.white('8. ') +
				chalk.yellow(
					'Ask Cursor to update all tasks from a specific task id based on new learnings or pivots in your project.'
				) +
				'\n' +
				chalk.white('9. ') +
				chalk.green.bold('Ship it!') +
				'\n\n' +
				chalk.dim(
					'* Review the README.md file to learn how to use other commands via Cursor Agent.'
				),
			{
				padding: 1,
				margin: 1,
				borderStyle: 'round',
				borderColor: 'yellow',
				title: 'Getting Started',
				titleAlignment: 'center'
			}
		)
	);
}

// Function to setup MCP configuration for Cursor integration
function setupMCPConfiguration(targetDir, projectName) {
	const mcpDirPath = path.join(targetDir, '.cursor');
	const mcpJsonPath = path.join(mcpDirPath, 'mcp.json');

	log('info', 'Setting up MCP configuration for Cursor integration...');

	// Create .cursor directory if it doesn't exist
	ensureDirectoryExists(mcpDirPath);

	// New MCP config to be added - references the installed package
	const newMCPServer = {
		'task-master-ai': {
			command: 'npx',
			args: ['-y', '--package', 'task-master-ai', 'task-master-mcp'],
			env: {
				ANTHROPIC_API_KEY: '%ANTHROPIC_API_KEY%',
				PERPLEXITY_API_KEY: '%PERPLEXITY_API_KEY%',
				MODEL: 'claude-3-7-sonnet-20250219',
				PERPLEXITY_MODEL: 'sonar-pro',
				MAX_TOKENS: 64000,
				TEMPERATURE: 0.3,
				DEFAULT_SUBTASKS: 5,
				DEFAULT_PRIORITY: 'medium'
			}
		}
	};

	// Check if mcp.json already exists
	if (fs.existsSync(mcpJsonPath)) {
		log('info', 'MCP configuration file already exists, updating...');
		try {
			// Read existing config
			const mcpConfig = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));

			// Initialize mcpServers if it doesn't exist
			if (!mcpConfig.mcpServers) {
				mcpConfig.mcpServers = {};
			}

			// Add the task-master-ai server if it doesn't exist
			if (!mcpConfig.mcpServers['task-master-ai']) {
				mcpConfig.mcpServers['task-master-ai'] = newMCPServer['task-master-ai'];
				log(
					'info',
					'Added task-master-ai server to existing MCP configuration'
				);
			} else {
				log('info', 'task-master-ai server already configured in mcp.json');
			}

			// Write the updated configuration
			fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 4));
			log('success', 'Updated MCP configuration file');
		} catch (error) {
			log('error', `Failed to update MCP configuration: ${error.message}`);
			// Create a backup before potentially modifying
			const backupPath = `${mcpJsonPath}.backup-${Date.now()}`;
			if (fs.existsSync(mcpJsonPath)) {
				fs.copyFileSync(mcpJsonPath, backupPath);
				log('info', `Created backup of existing mcp.json at ${backupPath}`);
			}

			// Create new configuration
			const newMCPConfig = {
				mcpServers: newMCPServer
			};

			fs.writeFileSync(mcpJsonPath, JSON.stringify(newMCPConfig, null, 4));
			log(
				'warn',
				'Created new MCP configuration file (backup of original file was created if it existed)'
			);
		}
	} else {
		// If mcp.json doesn't exist, create it
		const newMCPConfig = {
			mcpServers: newMCPServer
		};

		fs.writeFileSync(mcpJsonPath, JSON.stringify(newMCPConfig, null, 4));
		log('success', 'Created MCP configuration file for Cursor integration');
	}

	// Add note to console about MCP integration
	log('info', 'MCP server will use the installed task-master-ai package');
}

// Run the initialization if this script is executed directly
// The original check doesn't work with npx and global commands
// if (process.argv[1] === fileURLToPath(import.meta.url)) {
// Instead, we'll always run the initialization if this file is the main module
console.log('Checking if script should run initialization...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv:', process.argv);

// Always run initialization when this file is loaded directly
// This works with both direct node execution and npx/global commands
(async function main() {
	try {
		console.log('Starting initialization...');

		// Check if we should use the CLI options or prompt for input
		if (options.yes || (options.name && options.description)) {
			// When using --yes flag or providing name and description, use CLI options
			await initializeProject({
				projectName: options.name || 'task-master-project',
				projectDescription:
					options.description ||
					'A task management system for AI-driven development',
				projectVersion: options.version || '1.0.0',
				authorName: options.author || '',
				dryRun: options.dryRun || false,
				skipInstall: options.skipInstall || false,
				addAliases: options.aliases || false
			});
		} else {
			// Otherwise, prompt for input normally
			await initializeProject({
				dryRun: options.dryRun || false,
				skipInstall: options.skipInstall || false
			});
		}

		// Process should exit naturally after completion
		console.log('Initialization completed, exiting...');
		process.exit(0);
	} catch (error) {
		console.error('Failed to initialize project:', error);
		log('error', 'Failed to initialize project:', error);
		process.exit(1);
	}
})();

// Export functions for programmatic use
export { initializeProject, createProjectStructure, log };
