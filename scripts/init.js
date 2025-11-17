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

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import boxen from 'boxen';
import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import inquirer from 'inquirer';
import { RULE_PROFILES } from '../src/constants/profiles.js';
import { manageGitignoreFile } from '../src/utils/manage-gitignore.js';
import {
	convertAllRulesToProfileRules,
	getRulesProfile
} from '../src/utils/rule-transformer.js';
import { updateConfigMaxTokens } from './modules/update-config-tokens.js';
import { isSilentMode } from './modules/utils.js';
import { insideGitWorkTree } from './modules/utils/git-utils.js';

// Import asset resolver
import { assetExists, readAsset } from '../src/utils/asset-resolver.js';

import { execSync } from 'child_process';
import {
	ENV_EXAMPLE_FILE,
	EXAMPLE_PRD_FILE,
	GITIGNORE_FILE,
	TASKMASTER_CONFIG_FILE,
	TASKMASTER_DIR,
	TASKMASTER_DOCS_DIR,
	TASKMASTER_REPORTS_DIR,
	TASKMASTER_STATE_FILE,
	TASKMASTER_TASKS_DIR,
	TASKMASTER_TEMPLATES_DIR
} from '../src/constants/paths.js';

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
	// Check if the asset exists
	if (!assetExists(templateName)) {
		log('error', `Source file not found: ${templateName}`);
		return;
	}

	// Read the asset content using the resolver
	let content = readAsset(templateName, 'utf8');

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

// Main function to initialize a new project
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

	// Handle boolean aliases flags
	if (options.aliases === true) {
		options.addAliases = true; // --aliases flag provided
	} else if (options.aliases === false) {
		options.addAliases = false; // --no-aliases flag provided
	}
	// If options.aliases and options.noAliases are undefined, we'll prompt for it

	// Handle boolean git flags
	if (options.git === true) {
		options.initGit = true; // --git flag provided
	} else if (options.git === false) {
		options.initGit = false; // --no-git flag provided
	}
	// If options.git and options.noGit are undefined, we'll prompt for it

	// Handle boolean gitTasks flags
	if (options.gitTasks === true) {
		options.storeTasksInGit = true; // --git-tasks flag provided
	} else if (options.gitTasks === false) {
		options.storeTasksInGit = false; // --no-git-tasks flag provided
	}
	// If options.gitTasks and options.noGitTasks are undefined, we'll prompt for it

	const skipPrompts = options.yes || (options.name && options.description);

	// if (!isSilentMode()) {
	// 	console.log('Skip prompts determined:', skipPrompts);
	// }

	let selectedRuleProfiles;
	if (options.rulesExplicitlyProvided) {
		// If --rules flag was used, always respect it.
		log(
			'info',
			`Using rule profiles provided via command line: ${options.rules.join(', ')}`
		);
		selectedRuleProfiles = options.rules;
	} else if (skipPrompts) {
		// If non-interactive (e.g., --yes) and no rules specified, default to ALL.
		log(
			'info',
			`No rules specified in non-interactive mode, defaulting to all profiles.`
		);
		selectedRuleProfiles = RULE_PROFILES;
	} else {
		// If interactive and no rules specified, default to NONE.
		// The 'rules --setup' wizard will handle selection.
		log(
			'info',
			'No rules specified; interactive setup will be launched to select profiles.'
		);
		selectedRuleProfiles = [];
	}

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
		const addAliases =
			options.addAliases !== undefined ? options.addAliases : true; // Default to true if not specified
		const initGit = options.initGit !== undefined ? options.initGit : true; // Default to true if not specified
		const storeTasksInGit =
			options.storeTasksInGit !== undefined ? options.storeTasksInGit : true; // Default to true if not specified

		if (dryRun) {
			log('info', 'DRY RUN MODE: No files will be modified');
			log('info', 'Would initialize Task Master project');
			log('info', 'Would create/update necessary project files');

			// Show flag-specific behavior
			log(
				'info',
				`${addAliases ? 'Would add shell aliases (tm, taskmaster)' : 'Would skip shell aliases'}`
			);
			log(
				'info',
				`${initGit ? 'Would initialize Git repository' : 'Would skip Git initialization'}`
			);
			log(
				'info',
				`${storeTasksInGit ? 'Would store tasks in Git' : 'Would exclude tasks from Git'}`
			);

			return {
				dryRun: true
			};
		}

		// Default to local storage in non-interactive mode unless explicitly specified
		const selectedStorage = options.storage || 'local';
		const authCredentials = null; // No auth in non-interactive mode

		createProjectStructure(
			addAliases,
			initGit,
			storeTasksInGit,
			dryRun,
			options,
			selectedRuleProfiles,
			selectedStorage,
			authCredentials
		);
	} else {
		// Interactive logic
		log('info', 'Required options not provided, proceeding with prompts.');

		try {
			// Track init_started event
			// TODO: Send to Segment telemetry when implemented
			const taskmasterId = generateTaskmasterId();
			log('debug', `Init started - taskmaster_id: ${taskmasterId}`);

			// Prompt for storage selection first
			let selectedStorage = await promptStorageSelection();

			// Track storage_selected event
			// TODO: Send to Segment telemetry when implemented
			log(
				'debug',
				`Storage selected: ${selectedStorage} - taskmaster_id: ${taskmasterId}`
			);

			// If cloud storage selected, trigger OAuth flow
			let authCredentials = null;
			if (selectedStorage === 'cloud') {
				try {
					// Import AuthManager from @tm/core
					const { AuthManager } = await import('@tm/core');
					const authManager = AuthManager.getInstance();

					// Check if already authenticated
					const existingCredentials = await authManager.getAuthCredentials();
					if (existingCredentials) {
						log('success', 'Already authenticated with Hamster');
						authCredentials = existingCredentials;
					} else {
						// Trigger OAuth flow
						log('info', 'Starting authentication flow...');
						console.log(chalk.blue('\n🔐 Authentication Required\n'));
						console.log(
							chalk.white(
								'  Selecting cloud storage will open your browser for authentication.'
							)
						);
						console.log(
							chalk.gray('  This enables sync across devices with Hamster.\n')
						);

						// Import open for browser opening
						const { default: open } = await import('open');

						authCredentials = await authManager.authenticateWithOAuth({
							openBrowser: async (authUrl) => {
								await open(authUrl);
							},
							timeout: 5 * 60 * 1000, // 5 minutes
							onAuthUrl: (authUrl) => {
								console.log(chalk.blue.bold('\n🔐 Browser Authentication\n'));
								console.log(
									chalk.white('  Opening your browser to authenticate...')
								);
								console.log(
									chalk.gray("  If the browser doesn't open, visit:")
								);
								console.log(chalk.cyan.underline(`  ${authUrl}\n`));
							},
							onWaitingForAuth: () => {
								// Spinner will be handled by auth command internally
							},
							onSuccess: () => {
								log('success', 'Authentication successful!');
							},
							onError: (error) => {
								log('error', `Authentication failed: ${error.message}`);
							}
						});

						// Track auth_completed event
						// TODO: Send to Segment telemetry when implemented
						log('debug', `Auth completed - taskmaster_id: ${taskmasterId}`);
					}
				} catch (authError) {
					log(
						'error',
						`Failed to authenticate: ${authError.message}. Falling back to local storage.`
					);
					// Fall back to local storage if auth fails
					selectedStorage = 'local';
				}
			}

			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
			// Prompt for shell aliases (skip if --aliases or --no-aliases flag was provided)
			let addAliasesPrompted = true; // Default to true
			if (options.addAliases !== undefined) {
				addAliasesPrompted = options.addAliases; // Use flag value if provided
			} else {
				const addAliasesInput = await promptQuestion(
					rl,
					chalk.cyan(
						'Add shell aliases for task-master? This lets you type "tm" instead of "task-master" (Y/n): '
					)
				);
				addAliasesPrompted = addAliasesInput.trim().toLowerCase() !== 'n';
			}

			// Git-related prompts only make sense for local storage
			// If cloud storage is selected, tasks are stored in Hamster, not Git
			let initGitPrompted = true; // Default to true
			let storeGitPrompted = true; // Default to true

			if (selectedStorage === 'local') {
				// Prompt for Git initialization (skip if --git or --no-git flag was provided)
				if (options.initGit !== undefined) {
					initGitPrompted = options.initGit; // Use flag value if provided
				} else {
					const gitInitInput = await promptQuestion(
						rl,
						chalk.cyan('Initialize a Git repository in project root? (Y/n): ')
					);
					initGitPrompted = gitInitInput.trim().toLowerCase() !== 'n';
				}

				// Prompt for Git tasks storage (skip if --git-tasks or --no-git-tasks flag was provided)
				if (options.storeTasksInGit !== undefined) {
					storeGitPrompted = options.storeTasksInGit; // Use flag value if provided
				} else {
					const gitTasksInput = await promptQuestion(
						rl,
						chalk.cyan(
							'Store tasks in Git (tasks.json and tasks/ directory)? (Y/n): '
						)
					);
					storeGitPrompted = gitTasksInput.trim().toLowerCase() !== 'n';
				}
			} else {
				// Cloud storage: skip Git prompts, but initialize Git repo anyway
				// (users may still want version control for their code)
				initGitPrompted = true;
				// Tasks are in cloud, so don't store them in Git
				storeGitPrompted = false;
			}

			// Confirm settings...
			console.log('\nTask Master Project settings:');
			console.log(
				chalk.blue('Storage:'),
				chalk.white(
					selectedStorage === 'cloud'
						? 'Hamster (Cloud Sync)'
						: 'Local File Storage'
				)
			);
			console.log(
				chalk.blue(
					'Add shell aliases (so you can use "tm" instead of "task-master"):'
				),
				chalk.white(addAliasesPrompted ? 'Yes' : 'No')
			);

			// Only show Git-related settings for local storage
			if (selectedStorage === 'local') {
				console.log(
					chalk.blue('Initialize Git repository in project root:'),
					chalk.white(initGitPrompted ? 'Yes' : 'No')
				);
				console.log(
					chalk.blue('Store tasks in Git (tasks.json and tasks/ directory):'),
					chalk.white(storeGitPrompted ? 'Yes' : 'No')
				);
			}

			const confirmInput = await promptQuestion(
				rl,
				chalk.yellow('\nDo you want to continue with these settings? (Y/n): ')
			);
			const shouldContinue = confirmInput.trim().toLowerCase() !== 'n';

			if (!shouldContinue) {
				rl.close();
				log('info', 'Project initialization cancelled by user');
				process.exit(0);
				return;
			}

			// Only run interactive rules if rules flag not provided via command line
			if (options.rulesExplicitlyProvided) {
				log(
					'info',
					`Using rule profiles provided via command line: ${selectedRuleProfiles.join(', ')}`
				);
			}

			const dryRun = options.dryRun || false;

			if (dryRun) {
				log('info', 'DRY RUN MODE: No files will be modified');
				log('info', 'Would initialize Task Master project');
				log('info', 'Would create/update necessary project files');

				// Show flag-specific behavior
				log(
					'info',
					`${addAliasesPrompted ? 'Would add shell aliases (tm, taskmaster)' : 'Would skip shell aliases'}`
				);
				log(
					'info',
					`${initGitPrompted ? 'Would initialize Git repository' : 'Would skip Git initialization'}`
				);
				log(
					'info',
					`${storeGitPrompted ? 'Would store tasks in Git' : 'Would exclude tasks from Git'}`
				);

				return {
					dryRun: true
				};
			}

			// Create structure using only necessary values
			createProjectStructure(
				addAliasesPrompted,
				initGitPrompted,
				storeGitPrompted,
				dryRun,
				options,
				selectedRuleProfiles,
				selectedStorage,
				authCredentials
			);
			rl.close();
		} catch (error) {
			if (rl) {
				rl.close();
			}
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

/**
 * Generate a unique taskmaster_id for anonymous tracking
 * @returns {string} UUID string
 */
function generateTaskmasterId() {
	return randomUUID();
}

/**
 * Update config.json with storage configuration
 * @param {string} configPath - Path to config.json file
 * @param {string} selectedStorage - Storage type ('cloud' or 'local')
 * @param {object|null} authCredentials - Auth credentials if cloud storage selected
 */
function updateStorageConfig(configPath, selectedStorage, authCredentials) {
	try {
		if (!fs.existsSync(configPath)) {
			log('warn', 'Config file does not exist, skipping storage configuration');
			return;
		}

		const configContent = fs.readFileSync(configPath, 'utf8');
		const config = JSON.parse(configContent);

		// Initialize storage config if it doesn't exist
		if (!config.storage) {
			config.storage = {};
		}

		if (selectedStorage === 'cloud') {
			// Configure for API/cloud storage
			config.storage.type = 'api';
			config.storage.apiEndpoint =
				process.env.TM_BASE_DOMAIN ||
				process.env.TM_PUBLIC_BASE_DOMAIN ||
				'https://tryhamster.com/api';

			// Note: Access token is stored in ~/.taskmaster/auth.json by AuthManager
			// We don't store it in config.json for security reasons
			log('info', 'Configured storage for cloud sync with Hamster');
		} else {
			// Configure for local file storage
			config.storage.type = 'file';
			log('info', 'Configured storage for local file storage');
		}

		// Write updated config back to file
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
		log('success', 'Storage configuration updated in config.json');
	} catch (error) {
		log('error', `Failed to update storage configuration: ${error.message}`);
	}
}

/**
 * Prompt user to select storage backend (Hamster cloud or local)
 * @returns {Promise<'cloud'|'local'>} Selected storage type
 */
async function promptStorageSelection() {
	if (isSilentMode()) {
		// Default to local in silent mode
		return 'local';
	}

	try {
		const { storageType } = await inquirer.prompt([
			{
				type: 'list',
				name: 'storageType',
				message: chalk.cyan('Choose your storage backend:'),
				choices: [
					{
						name: `${chalk.bold('☁️  Hamster (Cloud Sync)')} - Sync tasks across devices with Hamster`,
						value: 'cloud',
						short: 'Cloud'
					},
					{
						name: `${chalk.bold('📁 Local Storage')} - Keep everything on your machine`,
						value: 'local',
						short: 'Local'
					}
				],
				default: 'local'
			}
		]);

		return storageType;
	} catch (error) {
		// Handle Ctrl+C or other interruptions
		if (error.isTtyError || error.name === 'ExitPromptError') {
			log('warn', 'Storage selection cancelled, defaulting to local storage');
			return 'local';
		}
		throw error;
	}
}

// Function to create the project structure
function createProjectStructure(
	addAliases,
	initGit,
	storeTasksInGit,
	dryRun,
	options,
	selectedRuleProfiles = RULE_PROFILES,
	selectedStorage = 'local',
	authCredentials = null
) {
	const targetDir = process.cwd();
	log('info', `Initializing project in ${targetDir}`);

	// Create NEW .taskmaster directory structure (using constants)
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_DIR));
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_TASKS_DIR));
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_DOCS_DIR));
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_REPORTS_DIR));
	ensureDirectoryExists(path.join(targetDir, TASKMASTER_TEMPLATES_DIR));

	// Create initial state.json file for tag management
	createInitialStateFile(targetDir);

	// Copy template files with replacements
	const replacements = {
		year: new Date().getFullYear()
	};

	// Helper function to create rule profiles
	function _processSingleProfile(profileName) {
		const profile = getRulesProfile(profileName);
		if (profile) {
			convertAllRulesToProfileRules(targetDir, profile);
			// Also triggers MCP config setup (if applicable)
		} else {
			log('warn', `Unknown rule profile: ${profileName}`);
		}
	}

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

	// Update config.json with correct maxTokens values from supported-models.json
	const configPath = path.join(targetDir, TASKMASTER_CONFIG_FILE);
	if (updateConfigMaxTokens(configPath)) {
		log('info', 'Updated config with correct maxTokens values');
	} else {
		log('warn', 'Could not update maxTokens in config');
	}

	// Update config.json with storage configuration
	updateStorageConfig(configPath, selectedStorage, authCredentials);

	// Copy .gitignore with GitTasks preference
	try {
		const templateContent = readAsset('gitignore', 'utf8');
		manageGitignoreFile(
			path.join(targetDir, GITIGNORE_FILE),
			templateContent,
			storeTasksInGit,
			log
		);
	} catch (error) {
		log('error', `Failed to create .gitignore: ${error.message}`);
	}

	// Copy example_prd.txt to NEW location
	copyTemplateFile('example_prd.txt', path.join(targetDir, EXAMPLE_PRD_FILE));

	// Copy example_prd_rpg.txt to templates directory
	copyTemplateFile(
		'example_prd_rpg.txt',
		path.join(targetDir, TASKMASTER_TEMPLATES_DIR, 'example_prd_rpg.txt')
	);

	// Initialize git repository if git is available
	try {
		if (initGit === false) {
			log('info', 'Git initialization skipped due to --no-git flag.');
		} else if (initGit === true) {
			if (insideGitWorkTree()) {
				log(
					'info',
					'Existing Git repository detected – skipping git init despite --git flag.'
				);
			} else {
				log('info', 'Initializing Git repository due to --git flag...');
				execSync('git init', { cwd: targetDir, stdio: 'ignore' });
				log('success', 'Git repository initialized');
			}
		} else {
			// Default behavior when no flag is provided (from interactive prompt)
			if (insideGitWorkTree()) {
				log('info', 'Existing Git repository detected – skipping git init.');
			} else {
				log(
					'info',
					'No Git repository detected. Initializing one in project root...'
				);
				execSync('git init', { cwd: targetDir, stdio: 'ignore' });
				log('success', 'Git repository initialized');
			}
		}
	} catch (error) {
		log('warn', 'Git not available, skipping repository initialization');
	}

	// Only run the manual transformer if rules were provided via flags.
	// The interactive `rules --setup` wizard handles its own installation.
	if (options.rulesExplicitlyProvided || options.yes) {
		log('info', 'Generating profile rules from command-line flags...');
		for (const profileName of selectedRuleProfiles) {
			_processSingleProfile(profileName);
		}
	}

	// Add shell aliases if requested
	if (addAliases) {
		addShellAliases();
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

	// === Add Rule Profiles Setup Step ===
	if (
		!isSilentMode() &&
		!dryRun &&
		!options?.yes &&
		!options.rulesExplicitlyProvided
	) {
		console.log(
			boxen(chalk.cyan('Configuring Rule Profiles...'), {
				padding: 0.5,
				margin: { top: 1, bottom: 0.5 },
				borderStyle: 'round',
				borderColor: 'blue'
			})
		);
		log(
			'info',
			'Running interactive rules setup. Please select which rule profiles to include.'
		);
		try {
			// Correct command confirmed by you.
			execSync('npx task-master rules --setup', {
				stdio: 'inherit',
				cwd: targetDir
			});
			log('success', 'Rule profiles configured.');
		} catch (error) {
			log('error', 'Failed to configure rule profiles:', error.message);
			log('warn', 'You may need to run "task-master rules --setup" manually.');
		}
	} else if (isSilentMode() || dryRun || options?.yes) {
		// This branch can log why setup was skipped, similar to the model setup logic.
		if (options.rulesExplicitlyProvided) {
			log(
				'info',
				'Skipping interactive rules setup because --rules flag was used.'
			);
		} else {
			log('info', 'Skipping interactive rules setup in non-interactive mode.');
		}
	}
	// =====================================

	// === Add Response Language Step ===
	if (!isSilentMode() && !dryRun && !options?.yes) {
		console.log(
			boxen(chalk.cyan('Configuring Response Language...'), {
				padding: 0.5,
				margin: { top: 1, bottom: 0.5 },
				borderStyle: 'round',
				borderColor: 'blue'
			})
		);
		log(
			'info',
			'Running interactive response language setup. Please input your preferred language.'
		);
		try {
			execSync('npx task-master lang --setup', {
				stdio: 'inherit',
				cwd: targetDir
			});
			log('success', 'Response Language configured.');
		} catch (error) {
			log('error', 'Failed to configure response language:', error.message);
			log('warn', 'You may need to run "task-master lang --setup" manually.');
		}
	} else if (isSilentMode() && !dryRun) {
		log(
			'info',
			'Skipping interactive response language setup in silent (MCP) mode.'
		);
		log(
			'warn',
			'Please configure response language using "task-master models --set-response-language" or the "models" MCP tool.'
		);
	} else if (dryRun) {
		log('info', 'DRY RUN: Skipping interactive response language setup.');
	}
	// =====================================

	// === Add Model Configuration Step ===
	// Only configure models for cloud storage (Hamster)
	// Local storage doesn't require AI models for basic task management
	if (
		!isSilentMode() &&
		!dryRun &&
		!options?.yes &&
		selectedStorage === 'cloud'
	) {
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
	} else if (selectedStorage === 'local' && !dryRun) {
		log('info', 'Skipping AI model configuration for local storage.');
		log(
			'info',
			'Local storage uses file-based task management. You can configure AI models later if needed using "task-master models --setup".'
		);
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

	// Add shell aliases if requested
	if (addAliases && !dryRun) {
		log('info', 'Adding shell aliases...');
		const aliasResult = addShellAliases();
		if (aliasResult) {
			log('success', 'Shell aliases added successfully');
		}
	} else if (addAliases && dryRun) {
		log('info', 'DRY RUN: Would add shell aliases (tm, taskmaster)');
	}

	// Display success message
	if (!isSilentMode()) {
		// Show hamster ASCII art for cloud storage, regular success for local
		if (selectedStorage === 'cloud') {
			const hamsterArt = `
   ___     
  (o o)    ${chalk.green.bold('Welcome to Hamster!')}
  (  >  )  
 /|    |\\  ${chalk.white('Cloud sync enabled')}
  '----'   ${chalk.dim('Tasks synced across all your devices')}
`;
			console.log(
				boxen(hamsterArt, {
					padding: 1,
					margin: 1,
					borderStyle: 'double',
					borderColor: 'cyan',
					textAlignment: 'center'
				})
			);
		} else {
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
					'Discuss your idea with AI and ask for a PRD, and save it to .taskmaster/docs/prd.txt'
				)}\n${chalk.white('   ├─ ')}${chalk.dim('Simple projects: Use ')}${chalk.cyan('example_prd.txt')}${chalk.dim(' template')}\n${chalk.white('   └─ ')}${chalk.dim('Complex systems: Use ')}${chalk.cyan('example_prd_rpg.txt')}${chalk.dim(' template (for dependency-aware task graphs)')}\n${chalk.white('3. ')}${chalk.yellow(
					'Ask Cursor Agent (or run CLI) to parse your PRD and generate initial tasks:'
				)}\n${chalk.white('   └─ ')}${chalk.dim('MCP Tool: ')}${chalk.cyan('parse_prd')}${chalk.dim(' | CLI: ')}${chalk.cyan('task-master parse-prd .taskmaster/docs/prd.txt')}\n${chalk.white('4. ')}${chalk.yellow(
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

// Ensure necessary functions are exported
export { initializeProject, log };
