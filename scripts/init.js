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

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { isSilentMode } from './modules/utils.js';
import { convertAllCursorRulesToRooRules } from './modules/rule-transformer.js';
import { execSync } from 'child_process';
import {
	EXAMPLE_PRD_FILE,
	TASKMASTER_CONFIG_FILE,
	TASKMASTER_TEMPLATES_DIR,
	TASKMASTER_DIR,
	TASKMASTER_TASKS_DIR,
	TASKMASTER_DOCS_DIR,
	TASKMASTER_REPORTS_DIR,
	TASKMASTER_STATE_FILE,
	ENV_EXAMPLE_FILE,
	GITIGNORE_FILE
} from '../src/constants/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define log levels
const LOG_LEVELS = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	success: 4
};

// Determine log level from environment variable or default to 'info'
const LOG_LEVEL = process.env.TASKMASTER_LOG_LEVEL
	? LOG_LEVELS[process.env.TASKMASTER_LOG_LEVEL.toLowerCase()]
	: LOG_LEVELS.info; // Default to info

// Create a color gradient for the banner
const coolGradient = gradient(['#00b4d8', '#0077b6', '#03045e']);
const warmGradient = gradient(['#fb8b24', '#e36414', '#9a031e']);

// Display a fancy banner
function displayBanner() {
	if (isSilentMode()) return;

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

		// Only output to console if not in silent mode
		if (!isSilentMode()) {
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
			`To use the aliases in your current terminal, run: source ${shellConfigFile}`
		);

		return true;
	} catch (error) {
		log('error', `Failed to add aliases: ${error.message}`);
		return false;
	}
}

// Function to create initial state.json file for tag management
function createInitialStateFile(targetDir) {
	const stateFilePath = path.join(targetDir, TASKMASTER_STATE_FILE);

	// Check if state.json already exists
	if (fs.existsSync(stateFilePath)) {
		log('info', 'State file already exists, preserving current configuration');
		return;
	}

	// Create initial state configuration
	const initialState = {
		currentTag: 'master',
		lastSwitched: new Date().toISOString(),
		branchTagMapping: {},
		migrationNoticeShown: false
	};

	try {
		fs.writeFileSync(stateFilePath, JSON.stringify(initialState, null, 2));
		log('success', `Created initial state file: ${stateFilePath}`);
		log('info', 'Default tag set to "master" for task organization');
	} catch (error) {
		log('error', `Failed to create state file: ${error.message}`);
	}
}

// Function to copy a file from the package to the target directory
function copyTemplateFile(templateName, targetPath, replacements = {}) {
	// Get the file content from the appropriate source directory
	let sourcePath;

	// Map template names to their actual source paths
	switch (templateName) {
		// case 'scripts_README.md':
		// 	sourcePath = path.join(__dirname, '..', 'assets', 'scripts_README.md');
		// 	break;
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
			// case 'README-task-master.md':
			// 	sourcePath = path.join(__dirname, '..', 'README-task-master.md');
			break;
		case 'windsurfrules':
			sourcePath = path.join(__dirname, '..', 'assets', '.windsurfrules');
			break;
		case '.roomodes':
			sourcePath = path.join(__dirname, '..', 'assets', 'roocode', '.roomodes');
			break;
		case 'architect-rules':
		case 'ask-rules':
		case 'boomerang-rules':
		case 'code-rules':
		case 'debug-rules':
		case 'test-rules': {
			// Extract the mode name from the template name (e.g., 'architect' from 'architect-rules')
			const mode = templateName.split('-')[0];
			sourcePath = path.join(
				__dirname,
				'..',
				'assets',
				'roocode',
				'.roo',
				`rules-${mode}`,
				templateName
			);
			break;
		}
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
				const updatedContent = `${existingContent.trim()}\n\n# Added by Task Master AI\n${newLines.join('\n')}`;
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
			const updatedContent = `${existingContent.trim()}\n\n# Added by Task Master - Development Workflow Rules\n\n${content}`;
			fs.writeFileSync(targetPath, updatedContent);
			log('success', `Updated ${targetPath} with additional rules`);
			return;
		}

		// Handle README.md - offer to preserve or create a different file
		if (filename === 'README-task-master.md') {
			log('info', `${targetPath} already exists`);
			// Create a separate README file specifically for this project
			const taskMasterReadmePath = path.join(
				path.dirname(targetPath),
				'README-task-master.md'
			);
			fs.writeFileSync(taskMasterReadmePath, content);
			log(
				'success',
				`Created ${taskMasterReadmePath} (preserved original README-task-master.md)`
			);
			return;
		}

		// For other files, warn and prompt before overwriting
		log('warn', `${targetPath} already exists, skipping.`);
		return;
	}

	// If the file doesn't exist, create it normally
	fs.writeFileSync(targetPath, content);
	log('info', `Created file: ${targetPath}`);
}

// Main function to initialize a new project (No longer needs isInteractive logic)
async function initializeProject(options = {}) {
	// Receives options as argument
	// Only display banner if not in silent mode
	if (!isSilentMode()) {
		displayBanner();
	}

	// Debug logging only if not in silent mode
	// if (!isSilentMode()) {
	// 	console.log('===== DEBUG: INITIALIZE PROJECT OPTIONS RECEIVED =====');
	// 	console.log('Full options object:', JSON.stringify(options));
	// 	console.log('options.yes:', options.yes);
	// 	console.log('==================================================');
	// }

	const skipPrompts = options.yes || (options.name && options.description);

	// if (!isSilentMode()) {
	// 	console.log('Skip prompts determined:', skipPrompts);
	// }

	if (skipPrompts) {
		if (!isSilentMode()) {
			console.log('SKIPPING PROMPTS - Using defaults or provided values');
		}

		// Use provided options or defaults
		const projectName = options.name || 'task-master-project';
		const projectDescription =
			options.description || 'A project managed with Task Master AI';
		const projectVersion = options.version || '0.1.0';
		const authorName = options.author || 'Vibe coder';
		const dryRun = options.dryRun || false;
		const addAliases = options.aliases || false;

		if (dryRun) {
			log('info', 'DRY RUN MODE: No files will be modified');
			log('info', 'Would initialize Task Master project');
			log('info', 'Would create/update necessary project files');
			if (addAliases) {
				log('info', 'Would add shell aliases for task-master');
			}
			return {
				dryRun: true
			};
		}

		createProjectStructure(addAliases, dryRun, options);
	} else {
		// Interactive logic
		log('info', 'Required options not provided, proceeding with prompts.');
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

		try {
			// Only prompt for shell aliases
			const addAliasesInput = await promptQuestion(
				rl,
				chalk.cyan(
					'Add shell aliases for task-master? This lets you type "tm" instead of "task-master" (Y/n): '
				)
			);
			const addAliasesPrompted = addAliasesInput.trim().toLowerCase() !== 'n';

			// Confirm settings...
			console.log('\nTask Master Project settings:');
			console.log(
				chalk.blue(
					'Add shell aliases (so you can use "tm" instead of "task-master"):'
				),
				chalk.white(addAliasesPrompted ? 'Yes' : 'No')
			);

			const confirmInput = await promptQuestion(
				rl,
				chalk.yellow('\nDo you want to continue with these settings? (Y/n): ')
			);
			const shouldContinue = confirmInput.trim().toLowerCase() !== 'n';
			rl.close();

			if (!shouldContinue) {
				log('info', 'Project initialization cancelled by user');
				process.exit(0);
				return;
			}

			const dryRun = options.dryRun || false;

			if (dryRun) {
				log('info', 'DRY RUN MODE: No files will be modified');
				log('info', 'Would initialize Task Master project');
				log('info', 'Would create/update necessary project files');
				if (addAliasesPrompted) {
					log('info', 'Would add shell aliases for task-master');
				}
				return {
					dryRun: true
				};
			}

			// Create structure using only necessary values
			createProjectStructure(addAliasesPrompted, dryRun, options);
		} catch (error) {
			rl.close();
			log('error', `Error during initialization process: ${error.message}`);
			process.exit(1);
		}
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
function createProjectStructure(addAliases, dryRun, options) {
	const targetDir = process.cwd();
	log('info', `Initializing project in ${targetDir}`);

	// Define Roo modes locally (external integration, not part of core Task Master)
	const ROO_MODES = ['architect', 'ask', 'boomerang', 'code', 'debug', 'test'];

	// Create directories
	ensureDirectoryExists(path.join(targetDir, '.cursor/rules'));

	// Create Roo directories
	ensureDirectoryExists(path.join(targetDir, '.roo'));
	ensureDirectoryExists(path.join(targetDir, '.roo/rules'));
	for (const mode of ROO_MODES) {
		ensureDirectoryExists(path.join(targetDir, '.roo', `rules-${mode}`));
	}

	// Create NEW .taskmaster directory structure (using constants)
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_DIR));
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_TASKS_DIR));
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_DOCS_DIR));
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_REPORTS_DIR));
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_TEMPLATES_DIR));

	// Create initial state.json file for tag management
	createInitialStateFile(targetDir);

	// Setup MCP configuration for integration with Cursor
	setupMCPConfiguration(targetDir);

	// Copy template files with replacements
	const replacements = {
		year: new Date().getFullYear()
	};

	// Copy .env.example
	copyTemplateFile(
		'env.example',
		path.join(targetDir, ENV_EXAMPLE_FILE),
		replacements
	);

	// Copy config.json with project name to NEW location
	copyTemplateFile(
		'config.json',
		path.join(targetDir, TASKMASTER_CONFIG_FILE),
		{
			...replacements
		}
	);

	// Copy .gitignore
	copyTemplateFile('gitignore', path.join(targetDir, GITIGNORE_FILE));

	// Copy dev_workflow.mdc
	copyTemplateFile(
		'dev_workflow.mdc',
		path.join(targetDir, '.cursor/rules/dev_workflow.mdc')
	);

	// Copy taskmaster.mdc
	copyTemplateFile(
		'taskmaster.mdc',
		path.join(targetDir, '.cursor/rules/taskmaster.mdc')
	);

	// Copy cursor_rules.mdc
	copyTemplateFile(
		'cursor_rules.mdc',
		path.join(targetDir, '.cursor/rules/cursor_rules.mdc')
	);

	// Copy self_improve.mdc
	copyTemplateFile(
		'self_improve.mdc',
		path.join(targetDir, '.cursor/rules/self_improve.mdc')
	);

	// Generate Roo rules from Cursor rules
	log('info', 'Generating Roo rules from Cursor rules...');
	convertAllCursorRulesToRooRules(targetDir);

	// Copy .windsurfrules
	copyTemplateFile('windsurfrules', path.join(targetDir, '.windsurfrules'));

	// Copy .roomodes for Roo Code integration
	copyTemplateFile('.roomodes', path.join(targetDir, '.roomodes'));

	// Copy Roo rule files for each mode
	for (const mode of ROO_MODES) {
		copyTemplateFile(
			`${mode}-rules`,
			path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`)
		);
	}

	// Copy example_prd.txt to NEW location
	copyTemplateFile('example_prd.txt', path.join(targetDir, EXAMPLE_PRD_FILE));

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
	const npmInstallOptions = {
		cwd: targetDir,
		// Default to inherit for interactive CLI, change if silent
		stdio: 'inherit'
	};

	if (isSilentMode()) {
		// If silent (MCP mode), suppress npm install output
		npmInstallOptions.stdio = 'ignore';
		log('info', 'Running npm install silently...'); // Log our own message
	} else {
		// Interactive mode, show the boxen message
		console.log(
			boxen(chalk.cyan('Installing dependencies...'), {
				padding: 0.5,
				margin: 0.5,
				borderStyle: 'round',
				borderColor: 'blue'
			})
		);
	}

	// === Add Model Configuration Step ===
	if (!isSilentMode() && !dryRun && !options?.yes) {
		console.log(
			boxen(chalk.cyan('Configuring AI Models...'), {
				padding: 0.5,
				margin: { top: 1, bottom: 0.5 },
				borderStyle: 'round',
				borderColor: 'blue'
			})
		);
		log(
			'info',
			'Running interactive model setup. Please select your preferred AI models.'
		);
		try {
			execSync('npx task-master models --setup', {
				stdio: 'inherit',
				cwd: targetDir
			});
			log('success', 'AI Models configured.');
		} catch (error) {
			log('error', 'Failed to configure AI models:', error.message);
			log('warn', 'You may need to run "task-master models --setup" manually.');
		}
	} else if (isSilentMode() && !dryRun) {
		log('info', 'Skipping interactive model setup in silent (MCP) mode.');
		log(
			'warn',
			'Please configure AI models using "task-master models --set-..." or the "models" MCP tool.'
		);
	} else if (dryRun) {
		log('info', 'DRY RUN: Skipping interactive model setup.');
	} else if (options?.yes) {
		log('info', 'Skipping interactive model setup due to --yes flag.');
		log(
			'info',
			'Default AI models will be used. You can configure different models later using "task-master models --setup" or "task-master models --set-..." commands.'
		);
	}
	// ====================================

	// Display success message
	if (!isSilentMode()) {
		console.log(
			boxen(
				`${warmGradient.multiline(
					figlet.textSync('Success!', { font: 'Standard' })
				)}\n${chalk.green('Project initialized successfully!')}`,
				{
					padding: 1,
					margin: 1,
					borderStyle: 'double',
					borderColor: 'green'
				}
			)
		);
	}

	// Display next steps in a nice box
	if (!isSilentMode()) {
		console.log(
			boxen(
				`${chalk.cyan.bold('Things you should do next:')}\n\n${chalk.white('1. ')}${chalk.yellow(
					'Configure AI models (if needed) and add API keys to `.env`'
				)}\n${chalk.white('   ├─ ')}${chalk.dim('Models: Use `task-master models` commands')}\n${chalk.white('   └─ ')}${chalk.dim(
					'Keys: Add provider API keys to .env (or inside the MCP config file i.e. .cursor/mcp.json)'
				)}\n${chalk.white('2. ')}${chalk.yellow(
					'Discuss your idea with AI and ask for a PRD using example_prd.txt, and save it to scripts/PRD.txt'
				)}\n${chalk.white('3. ')}${chalk.yellow(
					'Ask Cursor Agent (or run CLI) to parse your PRD and generate initial tasks:'
				)}\n${chalk.white('   └─ ')}${chalk.dim('MCP Tool: ')}${chalk.cyan('parse_prd')}${chalk.dim(' | CLI: ')}${chalk.cyan('task-master parse-prd scripts/prd.txt')}\n${chalk.white('4. ')}${chalk.yellow(
					'Ask Cursor to analyze the complexity of the tasks in your PRD using research'
				)}\n${chalk.white('   └─ ')}${chalk.dim('MCP Tool: ')}${chalk.cyan('analyze_project_complexity')}${chalk.dim(' | CLI: ')}${chalk.cyan('task-master analyze-complexity')}\n${chalk.white('5. ')}${chalk.yellow(
					'Ask Cursor to expand all of your tasks using the complexity analysis'
				)}\n${chalk.white('6. ')}${chalk.yellow('Ask Cursor to begin working on the next task')}\n${chalk.white('7. ')}${chalk.yellow(
					'Add new tasks anytime using the add-task command or MCP tool'
				)}\n${chalk.white('8. ')}${chalk.yellow(
					'Ask Cursor to set the status of one or many tasks/subtasks at a time. Use the task id from the task lists.'
				)}\n${chalk.white('9. ')}${chalk.yellow(
					'Ask Cursor to update all tasks from a specific task id based on new learnings or pivots in your project.'
				)}\n${chalk.white('10. ')}${chalk.green.bold('Ship it!')}\n\n${chalk.dim(
					'* Review the README.md file to learn how to use other commands via Cursor Agent.'
				)}\n${chalk.dim(
					'* Use the task-master command without arguments to see all available commands.'
				)}`,
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
}

// Function to setup MCP configuration for Cursor integration
function setupMCPConfiguration(targetDir) {
	const mcpDirPath = path.join(targetDir, '.cursor');
	const mcpJsonPath = path.join(mcpDirPath, 'mcp.json');

	log('info', 'Setting up MCP configuration for Cursor integration...');

	// Create .cursor directory if it doesn't exist
	ensureDirectoryExists(mcpDirPath);

	// New MCP config to be added - references the installed package
	const newMCPServer = {
		'task-master-ai': {
			command: 'npx',
			args: ['-y', '--package=task-master-ai', 'task-master-ai'],
			env: {
				ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY_HERE',
				PERPLEXITY_API_KEY: 'PERPLEXITY_API_KEY_HERE',
				OPENAI_API_KEY: 'OPENAI_API_KEY_HERE',
				GOOGLE_API_KEY: 'GOOGLE_API_KEY_HERE',
				XAI_API_KEY: 'XAI_API_KEY_HERE',
				OPENROUTER_API_KEY: 'OPENROUTER_API_KEY_HERE',
				MISTRAL_API_KEY: 'MISTRAL_API_KEY_HERE',
				AZURE_OPENAI_API_KEY: 'AZURE_OPENAI_API_KEY_HERE',
				OLLAMA_API_KEY: 'OLLAMA_API_KEY_HERE'
			}
		}
	};

	// Check if mcp.json already existsimage.png
	if (fs.existsSync(mcpJsonPath)) {
		log(
			'info',
			'MCP configuration file already exists, checking for existing task-master-mcp...'
		);
		try {
			// Read existing config
			const mcpConfig = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));

			// Initialize mcpServers if it doesn't exist
			if (!mcpConfig.mcpServers) {
				mcpConfig.mcpServers = {};
			}

			// Check if any existing server configuration already has task-master-mcp in its args
			const hasMCPString = Object.values(mcpConfig.mcpServers).some(
				(server) =>
					server.args &&
					server.args.some(
						(arg) => typeof arg === 'string' && arg.includes('task-master-ai')
					)
			);

			if (hasMCPString) {
				log(
					'info',
					'Found existing task-master-ai MCP configuration in mcp.json, leaving untouched'
				);
				return; // Exit early, don't modify the existing configuration
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

// Ensure necessary functions are exported
export { initializeProject, log }; // Only export what's needed by commands.js
