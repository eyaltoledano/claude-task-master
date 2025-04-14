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
import { execSync } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { isSilentMode } from './modules/utils.js';
// import { initializeNodeProject } from './modules/init-project/node.js'; // Keep commented
// import { initializeSkeletonProject } from './modules/init-project/skeleton.js'; // Keep commented

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
function ensureDirectoryExists(dirPath, log) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
		log.info(`Created directory: ${dirPath}`);
	}
}

// Function to add shell aliases to the user's shell configuration
function addShellAliases(log) {
	const homeDir = process.env.HOME || process.env.USERPROFILE;
	let shellConfigFile;

	// Determine which shell config file to use
	if (process.env.SHELL?.includes('zsh')) {
		shellConfigFile = path.join(homeDir, '.zshrc');
	} else if (process.env.SHELL?.includes('bash')) {
		shellConfigFile = path.join(homeDir, '.bashrc');
	} else {
		log.warn('Could not determine shell type. Aliases not added.');
		return false;
	}

	try {
		// Check if file exists
		if (!fs.existsSync(shellConfigFile)) {
			log.warn(
				`Shell config file ${shellConfigFile} not found. Aliases not added.`
			);
			return false;
		}

		// Check if aliases already exist
		const configContent = fs.readFileSync(shellConfigFile, 'utf8');
		if (configContent.includes("alias tm='task-master'")) {
			log.info('Task Master aliases already exist in shell config.');
			return true;
		}

		// Add aliases to the shell config file
		const aliasBlock = `
# Task Master aliases added on ${new Date().toLocaleDateString()}
alias tm='task-master'
alias taskmaster='task-master'
`;

		fs.appendFileSync(shellConfigFile, aliasBlock);
		log.success(`Added Task Master aliases to ${shellConfigFile}`);
		log.info(
			'To use the aliases in your current terminal, run: source ' +
				shellConfigFile
		);

		return true;
	} catch (error) {
		log.error(`Failed to add aliases: ${error.message}`);
		return false;
	}
}

// Function to copy a file from the package to the target directory
function copyTemplateFile(templateName, targetPath, replacements = {}, log) {
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
			log.error(`Source file not found: ${sourcePath}`);
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
			log.info(`${targetPath} already exists, merging content...`);
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
				log.success(`Updated ${targetPath} with additional entries`);
			} else {
				log.info(`No new content to add to ${targetPath}`);
			}
			return;
		}

		// Handle .windsurfrules - append the entire content
		if (filename === '.windsurfrules') {
			log.info(
				`${targetPath} already exists, appending content instead of overwriting...`
			);
			const existingContent = fs.readFileSync(targetPath, 'utf8');

			// Add a separator comment before appending our content
			const updatedContent =
				existingContent.trim() +
				'\n\n# Added by Task Master - Development Workflow Rules\n\n' +
				content;
			fs.writeFileSync(targetPath, updatedContent);
			log.success(`Updated ${targetPath} with additional rules`);
			return;
		}

		// Handle package.json - merge dependencies
		if (filename === 'package.json') {
			log.info(`${targetPath} already exists, merging dependencies...`);
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
				log.success(
					`Updated ${targetPath} with required dependencies and scripts`
				);
			} catch (error) {
				log.error(`Failed to merge package.json: ${error.message}`);
				// Fallback to writing a backup of the existing file and creating a new one
				const backupPath = `${targetPath}.backup-${Date.now()}`;
				fs.copyFileSync(targetPath, backupPath);
				log.info(`Created backup of existing package.json at ${backupPath}`);
				fs.writeFileSync(targetPath, content);
				log.warn(
					`Replaced ${targetPath} with new content (due to JSON parsing error)`
				);
			}
			return;
		}

		// Handle README.md - offer to preserve or create a different file
		if (filename === 'README.md') {
			log.info(`${targetPath} already exists`);
			// Create a separate README file specifically for this project
			const taskMasterReadmePath = path.join(
				path.dirname(targetPath),
				'README-task-master.md'
			);
			fs.writeFileSync(taskMasterReadmePath, content);
			log.success(
				`Created ${taskMasterReadmePath} (preserved original README.md)`
			);
			return;
		}

		// For other files, warn and prompt before overwriting
		log.warn(
			`${targetPath} already exists. Skipping file creation to avoid overwriting existing content.`
		);
		return;
	}

	// If the file doesn't exist, create it normally
	fs.writeFileSync(targetPath, content);
	log.info(`Created file: ${targetPath}`);
}

// Main function to initialize a new project (Now relies solely on passed options)
async function initializeProject(options = {}, log) {
	// Use provided options or prompt if needed and not skipped
	let {
		projectName = '',
		projectDescription = '',
		projectVersion = '0.1.0',
		authorName = '',
		skipInstall = false,
		addAliases = false,
		projectType = 'skeleton', // Default project type
		providerType = 'local', // Default provider type
		targetDirectory = null, // Added targetDirectory
		yes = false
	} = options;

	// If targetDirectory wasn't passed (e.g., direct CLI usage), use current working dir
	if (!targetDirectory) {
		targetDirectory = process.cwd();
		log.info(`Target directory not specified, using current working directory: ${targetDirectory}`);
	} else {
		log.info(`Using specified target directory: ${targetDirectory}`);
	}

	// Display banner unless silent
	displayBanner();

	if (!yes) {
		// ... (Prompting logic - replace log with effectiveLog if needed) ...
		// Example:
		// effectiveLog('info', 'Proceeding with provided/prompted details...');
		 log.info('Proceeding with provided/prompted details...'); // Or keep using original log if prompting doesn't need wrapper
	} else {
		// effectiveLog('info', 'Skipping prompts due to --yes flag...');
		 log.info('Skipping prompts due to --yes flag. Using defaults/provided options.'); // Keep original log?
	}

	authorName = authorName || 'Task Master User';

	try {
		// Call createProjectStructure and capture its success/failure
		const success = await createProjectStructure(
			projectName,
			projectDescription,
			projectVersion,
			authorName,
			skipInstall,
			addAliases,
			projectType,
			providerType, // Pass providerType
			targetDirectory, // Pass validated targetDirectory
			log
		);

		if (!success) {
			throw new Error('createProjectStructure function failed.');
		}

		return true; // Indicate success from initializeProject
	} catch (error) {
		log.error(`Project initialization failed: ${error.message}`);
		log.error(`Original error stack trace from createProjectStructure:`);
		log.error(error.stack || 'No stack trace available'); 
		// Throw a new error including the original message
		throw new Error(`Initialization failed within createProjectStructure: ${error.message}`);
		// return false; // REMOVED - Throw instead
	}
}

// Helper function to promisify readline question
function promptQuestion(rl, question) {
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			resolve(answer.trim());
		});
	});
}

// Function to create the project structure
async function createProjectStructure(
	projectName,
	projectDescription,
	projectVersion,
	authorName,
	skipInstall,
	addAliases,
	projectType = 'skeleton',
	providerType = 'local', // Add providerType parameter with default
	targetDirectory, // Add targetDirectory parameter
	log
) {
	log.info(`Starting project creation in: ${targetDirectory}`);

	// 1. Dynamically load and execute project type initializer
	log.info(`Initializing project structure for type: ${projectType}...`);
	try {
		// Construct the path to the project type initializer module
		const projectInitializerPath = path.join(__dirname, 'modules', 'init-project', `${projectType}.js`);
		log.debug(`Attempting to load project initializer from: ${projectInitializerPath}`);

		if (!fs.existsSync(projectInitializerPath)) {
			throw new Error(`Project type initializer not found for type: ${projectType} at ${projectInitializerPath}`);
		}

		// Dynamically import the module
		const { initializeProject: projectInitializer } = await import(projectInitializerPath);

		if (typeof projectInitializer !== 'function') {
			throw new Error(`Invalid project initializer export for type: ${projectType}. Expected 'initializeProject' function.`);
		}

		// Execute the initializer, passing the same logger down
		await projectInitializer(targetDirectory, { projectName, projectDescription, projectVersion, authorName, skipInstall }, log);
		log.success(`Project structure initialized for type: ${projectType}`);

	} catch (error) {
		log.error(`Error initializing project type structure: ${error.message}`);
		log.error(error.stack); // Log stack trace for debugging
		throw error; // Re-throw the error to be caught by initializeProject
	}

	// 2. Dynamically load and execute provider type initializer
	log.info(`Initializing provider configuration for type: ${providerType}...`);
	try {
		// Construct the path to the provider type initializer module
		const providerInitializerPath = path.join(__dirname, 'modules', 'init-provider', `${providerType}.js`);
		log.debug(`Attempting to load provider initializer from: ${providerInitializerPath}`);

		// Ensure the directory exists before trying to access the file
		ensureDirectoryExists(path.dirname(providerInitializerPath), log);

		// Check if the specific initializer file exists
		if (!fs.existsSync(providerInitializerPath)) {
			// If the specific file doesn't exist, maybe create a placeholder or log a warning
			// For now, we'll throw an error similar to project type
			throw new Error(`Provider type initializer not found for type: ${providerType} at ${providerInitializerPath}`);
			// Alternatively, could default silently:
			// effectiveLog.warn(`Provider type initializer not found for type: ${providerType}. Skipping provider-specific setup.`);
		} else {
			// Dynamically import the module
			const { initializeProvider: providerInitializer } = await import(providerInitializerPath);

			if (typeof providerInitializer !== 'function') {
				throw new Error(`Invalid provider initializer export for type: ${providerType}. Expected 'initializeProvider' function.`);
			}

			// Execute the initializer, passing the same logger down
			await providerInitializer(targetDirectory, { projectName, projectType /* add other options if needed */ }, log);
			log.success(`Provider configuration initialized for type: ${providerType}`);
		}

	} catch (error) {
		log.error(`Error initializing provider type configuration: ${error.message}`);
		log.error(error.stack); // Log stack trace for debugging
		log.warn(`Proceeding with initialization despite provider setup error.`);
		// Do not throw here, allow initialization to continue if provider fails
	}


	// 3. Common setup (directories, core files) - Moved after dynamic initializers
	log.info('Creating common project directories...');
	ensureDirectoryExists(path.join(targetDirectory, 'scripts'), log);
	ensureDirectoryExists(path.join(targetDirectory, 'tasks'), log);
	ensureDirectoryExists(path.join(targetDirectory, '.cursor', 'rules'), log);
	// ... rest of the common setup ...

	// 4. Copy common template files (might be better inside specific initializers if they differ)
	if (log && typeof log.info === 'function')
		log.info('Copying common template files...');
	copyTemplateFile('.gitignore', path.join(targetDirectory, '.gitignore'), {}, log);
	// ... copy other common files like dev.js, READMEs, rule files ...
	// REMOVED: copyTemplateFile('dev.js', path.join(targetDirectory, 'scripts', 'dev.js'), {}, log);
	copyTemplateFile('scripts_README.md', path.join(targetDirectory, 'scripts', 'README.md'), {}, log);
	copyTemplateFile('dev_workflow.mdc', path.join(targetDirectory, '.cursor', 'rules', 'dev_workflow.mdc'), {}, log);
	copyTemplateFile('taskmaster.mdc', path.join(targetDirectory, '.cursor', 'rules', 'taskmaster.mdc'), {}, log);
	copyTemplateFile('cursor_rules.mdc', path.join(targetDirectory, '.cursor', 'rules', 'cursor_rules.mdc'), {}, log);
	copyTemplateFile('self_improve.mdc', path.join(targetDirectory, '.cursor', 'rules', 'self_improve.mdc'), {}, log);
	copyTemplateFile('README-task-master.md', path.join(targetDirectory, 'README.md'), {}, log);
	copyTemplateFile('windsurfrules', path.join(targetDirectory, '.windsurfrules'), {}, log);
	copyTemplateFile('.env.example', path.join(targetDirectory, '.env.example'), {
		PROJECT_NAME: projectName,
		PROJECT_VERSION: projectVersion,
	}, log);
	copyTemplateFile('example_prd.txt', path.join(targetDirectory, 'scripts', 'example_prd.txt'), {}, log);


	// 5. Setup MCP configuration
	setupMCPConfiguration(targetDirectory, projectName, log);

	// 6. Add shell aliases if requested
	let aliasesAdded = false;
	if (addAliases) {
		aliasesAdded = addShellAliases(log);
	}

	// 7. Initialize git repository (only if not already in one)
	if (!fs.existsSync(path.join(targetDirectory, '.git'))) {
		try {
			log.info('Initializing git repository...');
			execSync('git init', { cwd: targetDirectory, stdio: 'ignore' }); // Use cwd option
			log.success('Git repository initialized.');
		} catch (error) {
			log.error(`Failed to initialize git repository: ${error.message}`);
		}
	} else {
		log.info('Git repository already exists.');
	}

	// Final Summary
	log.success(`Project '${projectName}' initialized successfully!`);
	// Only display the boxen summary if NOT in silent mode (i.e., running via CLI)
	if (!isSilentMode()) {
		console.log(boxen(
			chalk.white(`${chalk.bold('Project Setup Complete!')}\n\n` +
			`Type: ${chalk.cyan(projectType)}\n` +
			`Provider: ${chalk.cyan(providerType)}\n` +
			`Directory: ${chalk.yellow(targetDirectory)}\n\n` +
			chalk.white.bold('Next Steps:') + '\n' +
			`1. Review ${chalk.yellow('.env.example')} and create ${chalk.yellow('.env')} with your API keys.\n` +
			`2. Create your PRD in ${chalk.yellow('scripts/prd.txt')} (or use ${chalk.yellow('--input')}).\n` +
			`3. Run ${chalk.cyan(`task-master parse-prd`)} to generate initial tasks.\n` +
			(aliasesAdded ? `4. Reload your shell or run ${chalk.cyan(`source ~/.${process.env.SHELL?.includes('zsh') ? 'zshrc' : 'bashrc'}`)} to use aliases (tm, taskmaster).\n` : '') +
			`5. Run ${chalk.cyan('task-master --help')} to see available commands.`
			),
			{ padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
		));
	} // End if (!isSilentMode())

	return true; // Indicate success at the end of the function
}

// Function to set up MCP server configuration (Keep this here for now, might make generic later)
function setupMCPConfiguration(targetDir, projectName, log) {
	log.info(`Setting up MCP configuration in ${targetDir} for ${projectName}...`);
	
	const mcpConfigDir = path.join(targetDir, '.cursor');
	const mcpConfigFile = path.join(mcpConfigDir, 'mcp.json');

	ensureDirectoryExists(mcpConfigDir, log); // Pass log here too

	const mcpConfig = {
		projectName: projectName,
		port: process.env.MCP_PORT || 3000,
		logLevel: process.env.MCP_LOG_LEVEL || 'info',
		authEnabled: false, // Example: Default auth setting
		// Add other MCP specific configurations
	};
	try {
		fs.writeFileSync(mcpConfigFile, JSON.stringify(mcpConfig, null, 2), 'utf8');
		log.success('Created mcp-server/mcp-config.json');
	} catch (error) {
		log.error(`Failed to write MCP config: ${error.message}`);
	}

	// Copy essential MCP server files (adjust paths as needed)
	const mcpUtilsSource = path.join(__dirname, 'modules', 'utils.js'); // Assumes utils are in modules
	const mcpUtilsTarget = path.join(mcpConfigDir, 'utils.js');
	if (fs.existsSync(mcpUtilsSource)) {
		 try {
			fs.copyFileSync(mcpUtilsSource, mcpUtilsTarget);
			log.info('Copied utils.js to MCP server.');
		} catch (error) {
			log.error(`Failed to copy MCP utils: ${error.message}`);
		}
	} else {
		 log.warn(`MCP utils source not found at ${mcpUtilsSource}`);
	}

	// Add placeholder files if needed (e.g., server entry point)
	const serverEntryPath = path.join(mcpConfigDir, 'server.js');
	if (!fs.existsSync(serverEntryPath)) {
		 try {
			fs.writeFileSync(serverEntryPath, '// Basic MCP Server setup\nconsole.log("MCP Server starting...");\n', 'utf8');
			log.info('Created placeholder mcp-server/mcp-config.json');
		} catch (error) {
			log.error(`Failed to create placeholder server file: ${error.message}`);
		}
	}
	log.info('MCP Server setup complete.');
}

// Ensure necessary functions are exported
export { initializeProject };
