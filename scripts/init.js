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
import { TASKMASTER_BASE_PATH } from '../mcp-server/src/core/utils/path-utils.js'; // Added import

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

// Get log level from environment or default to info
const LOG_LEVEL = process.env.LOG_LEVEL
	? LOG_LEVELS[process.env.LOG_LEVEL.toLowerCase()]
	: LOG_LEVELS.info;

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
		case '.roomodes':
			sourcePath = path.join(__dirname, '..', 'assets', 'roocode', '.roomodes');
			break;
		case 'architect-rules':
		case 'ask-rules':
		case 'boomerang-rules':
		case 'code-rules':
		case 'debug-rules':
		case 'test-rules':
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

// Main function to initialize a new project (Now relies solely on passed options)
async function initializeProject(options = {}) {
	// Receives options as argument
	// Only display banner if not in silent mode
	if (!isSilentMode()) {
		displayBanner();
	}

	// Debug logging only if not in silent mode
	if (!isSilentMode()) {
		console.log('===== DEBUG: INITIALIZE PROJECT OPTIONS RECEIVED =====');
		console.log('Full options object:', JSON.stringify(options));
		console.log('options.yes:', options.yes);
		console.log('==================================================');
	}

	// Determine if we should skip prompts based on the passed options
	const skipPrompts = options.yes;
	if (!isSilentMode()) {
		console.log('Skip prompts determined:', skipPrompts);
	}

	if (skipPrompts) {
		if (!isSilentMode()) {
			console.log('SKIPPING PROMPTS - Using defaults or provided values');
		}

		// We no longer need these variables
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

		// Create structure using only necessary values
		createProjectStructure(addAliases);
	} else {
		// Prompting logic (only runs if skipPrompts is false)
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
				process.exit(0); // Exit if cancelled
				return; // Added return for clarity
			}

			// Still respect dryRun if passed initially even when prompting
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
			createProjectStructure(addAliasesPrompted);
		} catch (error) {
			rl.close();
			log('error', `Error during prompting: ${error.message}`); // Use log function
			process.exit(1); // Exit on error during prompts
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
function createProjectStructure(addAliases) {
	const targetDir = process.cwd();
	log('info', `Initializing project in ${targetDir}`);

	// Create directories
	ensureDirectoryExists(path.join(targetDir, '.cursor', 'rules'));

	// Create Roo directories
	ensureDirectoryExists(path.join(targetDir, '.roo'));
	ensureDirectoryExists(path.join(targetDir, '.roo', 'rules'));
	for (const mode of [
		'architect',
		'ask',
		'boomerang',
		'code',
		'debug',
		'test'
	]) {
		ensureDirectoryExists(path.join(targetDir, '.roo', `rules-${mode}`));
	}

	// Create Taskmaster base directory first
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_BASE_PATH));
	// Create scripts and tasks directories inside .taskmaster/
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_BASE_PATH, 'scripts'));
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_BASE_PATH, 'tasks'));

	// Setup MCP configuration for integration with Cursor
	setupMCPConfiguration(targetDir);

	// Copy template files with replacements
	const replacements = {
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

	// Generate Roo rules from Cursor rules
	log('info', 'Generating Roo rules from Cursor rules...');
	convertAllCursorRulesToRooRules(targetDir);

	// Copy .windsurfrules
	copyTemplateFile('windsurfrules', path.join(targetDir, '.windsurfrules'));

	// Copy .roomodes for Roo Code integration
	copyTemplateFile('.roomodes', path.join(targetDir, '.roomodes'));

	// Copy Roo rule files for each mode
	const rooModes = ['architect', 'ask', 'boomerang', 'code', 'debug', 'test'];
	for (const mode of rooModes) {
		copyTemplateFile(
			`${mode}-rules`,
			path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`)
		);
	}

	// Copy example_prd.txt
	copyTemplateFile(
		'example_prd.txt',
		path.join(targetDir, TASKMASTER_BASE_PATH, 'scripts', 'example_prd.txt') // Place inside .taskmaster/scripts
	);

	// Create main README.md inside .taskmaster/scripts/
	copyTemplateFile(
		'README-task-master.md',
		path.join(
			targetDir,
			TASKMASTER_BASE_PATH,
			'scripts',
			'README-task-master.md'
		), // Place inside .taskmaster/scripts
		replacements
	);

	// Add shell aliases if requested
	if (addAliases) {
		addShellAliases();
	}

	// Display success message
	if (!isSilentMode()) {
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
	}

	// Display next steps in a nice box
	if (!isSilentMode()) {
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
			args: ['-y', 'task-master-mcp'],
			env: {
				ANTHROPIC_API_KEY: 'YOUR_ANTHROPIC_API_KEY',
				PERPLEXITY_API_KEY: 'YOUR_PERPLEXITY_API_KEY',
				MODEL: 'claude-3-7-sonnet-20250219',
				PERPLEXITY_MODEL: 'sonar-pro',
				MAX_TOKENS: '64000',
				TEMPERATURE: '0.2',
				DEFAULT_SUBTASKS: '5',
				DEFAULT_PRIORITY: 'medium'
			}
		}
	};

	// Check if mcp.json already exists
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
						(arg) => typeof arg === 'string' && arg.includes('task-master-mcp')
					)
			);

			if (hasMCPString) {
				log(
					'info',
					'Found existing task-master-mcp configuration in mcp.json, leaving untouched'
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
