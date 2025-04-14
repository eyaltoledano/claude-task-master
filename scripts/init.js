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
	const effectiveLog = {
		info: (msg, ...args) => log && log.info ? log.info(msg, ...args) : console.log("[INFO]", msg, ...args),
		warn: (msg, ...args) => log && log.warn ? log.warn(msg, ...args) : console.warn("[WARN]", msg, ...args),
		error: (msg, ...args) => log && log.error ? log.error(msg, ...args) : console.error("[ERROR]", msg, ...args),
		debug: (msg, ...args) => log && log.debug ? log.debug(msg, ...args) : (process.env.DEBUG === 'true' ? console.log("[DEBUG]", msg, ...args) : null),
		success: (msg, ...args) => log && log.success ? log.success(msg, ...args) : console.log("[SUCCESS]", msg, ...args),
	};
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
		effectiveLog.info(`Created directory: ${dirPath}`);
	}
}

// Function to add shell aliases to the user's shell configuration
function addShellAliases(log) {
	const effectiveLog = {
		info: (msg, ...args) => log && log.info ? log.info(msg, ...args) : console.log("[INFO]", msg, ...args),
		warn: (msg, ...args) => log && log.warn ? log.warn(msg, ...args) : console.warn("[WARN]", msg, ...args),
		error: (msg, ...args) => log && log.error ? log.error(msg, ...args) : console.error("[ERROR]", msg, ...args),
		debug: (msg, ...args) => log && log.debug ? log.debug(msg, ...args) : (process.env.DEBUG === 'true' ? console.log("[DEBUG]", msg, ...args) : null),
		success: (msg, ...args) => log && log.success ? log.success(msg, ...args) : console.log("[SUCCESS]", msg, ...args),
	};
	const homeDir = process.env.HOME || process.env.USERPROFILE;
	let shellConfigFile;

	// Determine which shell config file to use
	if (process.env.SHELL?.includes('zsh')) {
		shellConfigFile = path.join(homeDir, '.zshrc');
	} else if (process.env.SHELL?.includes('bash')) {
		shellConfigFile = path.join(homeDir, '.bashrc');
	} else {
		effectiveLog.warn('Could not determine shell type. Aliases not added.');
		return false;
	}

	try {
		// Check if file exists
		if (!fs.existsSync(shellConfigFile)) {
			effectiveLog.warn(
				`Shell config file ${shellConfigFile} not found. Aliases not added.`
			);
			return false;
		}

		// Check if aliases already exist
		const configContent = fs.readFileSync(shellConfigFile, 'utf8');
		if (configContent.includes("alias tm='task-master'")) {
			effectiveLog.info('Task Master aliases already exist in shell config.');
			return true;
		}

		// Add aliases to the shell config file
		const aliasBlock = `
# Task Master aliases added on ${new Date().toLocaleDateString()}
alias tm='task-master'
alias taskmaster='task-master'
`;

		fs.appendFileSync(shellConfigFile, aliasBlock);
		effectiveLog.success(`Added Task Master aliases to ${shellConfigFile}`);
		effectiveLog.info(
			'To use the aliases in your current terminal, run: source ' +
				shellConfigFile
		);

		return true;
	} catch (error) {
		effectiveLog.error(`Failed to add aliases: ${error.message}`);
		return false;
	}
}

// Function to copy a file from the package to the target directory
function copyTemplateFile(templateName, targetPath, replacements = {}, log) {
	const effectiveLog = {
		info: (msg, ...args) => log && log.info ? log.info(msg, ...args) : console.log("[INFO]", msg, ...args),
		warn: (msg, ...args) => log && log.warn ? log.warn(msg, ...args) : console.warn("[WARN]", msg, ...args),
		error: (msg, ...args) => log && log.error ? log.error(msg, ...args) : console.error("[ERROR]", msg, ...args),
		debug: (msg, ...args) => log && log.debug ? log.debug(msg, ...args) : (process.env.DEBUG === 'true' ? console.log("[DEBUG]", msg, ...args) : null),
		success: (msg, ...args) => log && log.success ? log.success(msg, ...args) : console.log("[SUCCESS]", msg, ...args),
	};

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
			effectiveLog.error(`Source file not found: ${sourcePath}`);
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
			effectiveLog.info(`${targetPath} already exists, merging content...`);
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
				effectiveLog.success(`Updated ${targetPath} with additional entries`);
			} else {
				effectiveLog.info(`No new content to add to ${targetPath}`);
			}
			return;
		}

		// Handle .windsurfrules - append the entire content
		if (filename === '.windsurfrules') {
			effectiveLog.info(
				`${targetPath} already exists, appending content instead of overwriting...`
			);
			const existingContent = fs.readFileSync(targetPath, 'utf8');

			// Add a separator comment before appending our content
			const updatedContent =
				existingContent.trim() +
				'\n\n# Added by Task Master - Development Workflow Rules\n\n' +
				content;
			fs.writeFileSync(targetPath, updatedContent);
			effectiveLog.success(`Updated ${targetPath} with additional rules`);
			return;
		}

		// Handle package.json - merge dependencies
		if (filename === 'package.json') {
			effectiveLog.info(`${targetPath} already exists, merging dependencies...`);
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
				effectiveLog.success(
					`Updated ${targetPath} with required dependencies and scripts`
				);
			} catch (error) {
				effectiveLog.error(`Failed to merge package.json: ${error.message}`);
				// Fallback to writing a backup of the existing file and creating a new one
				const backupPath = `${targetPath}.backup-${Date.now()}`;
				fs.copyFileSync(targetPath, backupPath);
				effectiveLog.info(`Created backup of existing package.json at ${backupPath}`);
				fs.writeFileSync(targetPath, content);
				effectiveLog.warn(
					`Replaced ${targetPath} with new content (due to JSON parsing error)`
				);
			}
			return;
		}

		// Handle README.md - offer to preserve or create a different file
		if (filename === 'README.md') {
			effectiveLog.info(`${targetPath} already exists`);
			// Create a separate README file specifically for this project
			const taskMasterReadmePath = path.join(
				path.dirname(targetPath),
				'README-task-master.md'
			);
			fs.writeFileSync(taskMasterReadmePath, content);
			effectiveLog.success(
				`Created ${taskMasterReadmePath} (preserved original README.md)`
			);
			return;
		}

		// For other files, warn and prompt before overwriting
		effectiveLog.warn(
			`${targetPath} already exists. Skipping file creation to avoid overwriting existing content.`
		);
		return;
	}

	// If the file doesn't exist, create it normally
	fs.writeFileSync(targetPath, content);
	effectiveLog.info(`Created file: ${targetPath}`);
}

// Main function to initialize a new project (Now relies solely on passed options)
async function initializeProject(options = {}, log) {
	// Use the passed log object, fallback to console if not provided (for direct CLI use)
	const effectiveLog = {
		info: (msg, ...args) => log && log.info ? log.info(msg, ...args) : console.log("[INFO]", msg, ...args),
		warn: (msg, ...args) => log && log.warn ? log.warn(msg, ...args) : console.warn("[WARN]", msg, ...args),
		error: (msg, ...args) => log && log.error ? log.error(msg, ...args) : console.error("[ERROR]", msg, ...args),
		debug: (msg, ...args) => log && log.debug ? log.debug(msg, ...args) : (process.env.DEBUG === 'true' ? console.log("[DEBUG]", msg, ...args) : null),
		success: (msg, ...args) => log && log.success ? log.success(msg, ...args) : console.log("[SUCCESS]", msg, ...args),
	};

	// Replace internal `log` calls with `effectiveLog`
	if (!isSilentMode()) {
		// Use effectiveLog for banner if needed, or keep console?
		// displayBanner(); // Assuming banner uses console directly
	}

	let {
		projectName = '',
		projectDescription = '',
		projectVersion = '0.1.0',
		authorName = '',
		skipInstall = false,
		addAliases = false,
		projectType = 'skeleton',
		yes = false 
	} = options;

	if (!yes) {
		// ... (Prompting logic - replace log with effectiveLog if needed) ...
		// Example:
		// effectiveLog('info', 'Proceeding with provided/prompted details...');
		 effectiveLog.info('Proceeding with provided/prompted details...'); // Or keep using original log if prompting doesn't need wrapper
	} else {
		// effectiveLog('info', 'Skipping prompts due to --yes flag...');
		 effectiveLog.info('Skipping prompts due to --yes flag. Using defaults/provided options.'); // Keep original log?
	}

	authorName = authorName || 'Task Master User';

	// Pass the effectiveLog down to createProjectStructure
	// Note: createProjectStructure itself needs to accept and use the log object now
	const success = await createProjectStructure(
		projectName,
		projectDescription,
		projectVersion,
		authorName,
		skipInstall,
		addAliases,
		projectType,
		effectiveLog // Pass the logger
	);
	return success; // Return the boolean result
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
	log 
) {
	const effectiveLog = {
		info: (msg, ...args) => log && log.info ? log.info(msg, ...args) : console.log("[INFO]", msg, ...args),
		warn: (msg, ...args) => log && log.warn ? log.warn(msg, ...args) : console.warn("[WARN]", msg, ...args),
		error: (msg, ...args) => log && log.error ? log.error(msg, ...args) : console.error("[ERROR]", msg, ...args),
		debug: (msg, ...args) => log && log.debug ? log.debug(msg, ...args) : (process.env.DEBUG === 'true' ? console.log("[DEBUG]", msg, ...args) : null),
		success: (msg, ...args) => log && log.success ? log.success(msg, ...args) : console.log("[SUCCESS]", msg, ...args),
	};
	const targetDir = process.cwd();
	effectiveLog.info(`Starting project structure creation in: ${targetDir} (Type: ${projectType})`);

	try {
		// 1. --- General Setup (Language Agnostic) ---
		ensureDirectoryExists(targetDir, effectiveLog);
		effectiveLog.info(`Ensured project directory exists: ${targetDir}`);

		// Initialize Git repository if it doesn't exist
		if (!fs.existsSync(path.join(targetDir, '.git'))) {
			try {
				execSync('git init', { cwd: targetDir, stdio: 'ignore' });
				effectiveLog.success('Initialized empty Git repository.');
			} catch (gitError) {
				effectiveLog.warn(`Failed to initialize Git repository: ${gitError.message}`);
			}
		} else {
			effectiveLog.info('Git repository already exists.');
		}

		// Create scripts/config directory
		const scriptsConfigDir = path.join(targetDir, 'scripts', 'config');
		ensureDirectoryExists(scriptsConfigDir, effectiveLog);

		// Copy .gitignore (base version - language specifics handled by modules)
		copyTemplateFile('.gitignore', path.join(targetDir, '.gitignore'), {}, effectiveLog);
		effectiveLog.info('Created base .gitignore file.');

		// Create .env.example
		copyTemplateFile('env.example', path.join(targetDir, '.env.example'), {}, effectiveLog);
		effectiveLog.info('Created .env.example file.');

		// Copy Cursor rules directory
		const rulesSourceDir = path.join(__dirname, '..', '.cursor', 'rules');
		const rulesTargetDir = path.join(targetDir, '.cursor', 'rules');
		if (fs.existsSync(rulesSourceDir)) {
			ensureDirectoryExists(path.dirname(rulesTargetDir), effectiveLog);
			fs.cpSync(rulesSourceDir, rulesTargetDir, { recursive: true });
			effectiveLog.info('Copied Cursor rules to .cursor/rules/');
		}

		// Copy assets/prompts directory (if exists)
		const promptsSourceDir = path.join(__dirname, '..', 'assets', 'prompts');
		const promptsTargetDir = path.join(targetDir, 'scripts', 'prompts');
		if (fs.existsSync(promptsSourceDir)) {
			ensureDirectoryExists(promptsTargetDir, effectiveLog);
			fs.cpSync(promptsSourceDir, promptsTargetDir, { recursive: true });
			effectiveLog.info('Copied prompt templates to scripts/prompts/');
		}

		// Copy example PRD
		const examplePrdSource = path.join(__dirname, '..', 'assets', 'example_prd.txt');
		const examplePrdTarget = path.join(targetDir, 'scripts', 'example_prd.txt');
		if (fs.existsSync(examplePrdSource)) {
			ensureDirectoryExists(path.dirname(examplePrdTarget), effectiveLog);
			fs.copyFileSync(examplePrdSource, examplePrdTarget);
			effectiveLog.info('Copied example PRD to scripts/example_prd.txt');
		}

		// Copy scripts README
		copyTemplateFile(
			'scripts_README.md',
			path.join(targetDir, 'scripts', 'README.md'),
			{},
			effectiveLog
		);
		effectiveLog.info('Created scripts/README.md.');

		effectiveLog.info('Completed general setup.');

		// 2. --- Language Specific Setup (Restored Dynamic Logic) --- 
		effectiveLog.info(`Initiating setup for project type: ${projectType}...`);
		let initializerModule;
		try {
			// Dynamically import the correct module
			if (projectType === 'node') {
				// Use dynamic import for Node.js module
				initializerModule = await import('./modules/init-project/node.js');
				// Pass effectiveLog
				await initializerModule.initializeNodeProject(
					targetDir,
					projectName,
					projectVersion,
					authorName,
					skipInstall,
					effectiveLog 
				);
			} else if (projectType === 'python') {
				// Placeholder for Python
				effectiveLog.warn('Python project initialization not yet implemented.');
				// Fallback to skeleton
				initializerModule = await import('./modules/init-project/skeleton.js');
				await initializerModule.initializeSkeletonProject(targetDir, projectName, effectiveLog);
			} else { // Default to skeleton
				initializerModule = await import('./modules/init-project/skeleton.js');
				await initializerModule.initializeSkeletonProject(targetDir, projectName, effectiveLog);
			}
			effectiveLog.success(`Completed specific setup for project type: ${projectType}`);
		} catch (moduleError) {
			effectiveLog.error(`Failed during ${projectType} initialization: ${moduleError.message}`);
			effectiveLog.debug(moduleError.stack);
			throw new Error(`Initialization failed for type ${projectType}: ${moduleError.message}`);
		}

		// 3. --- Final Setup (Potentially language agnostic) ---
		// Add aliases if requested
		if (addAliases) {
			addShellAliases(effectiveLog);
		}

		effectiveLog.success('Project structure creation successfully orchestrated!');

		// Post-initialization message
		if (!isSilentMode()) {
			const nextSteps = [
				`Navigate to your project: ${chalk.cyan(`cd ${targetDir}`)}`,
				`Review the ${chalk.cyan('.env.example')} file and create a ${chalk.cyan('.env')} file with your API keys.`,
				`Create a Product Requirements Document (PRD) in ${chalk.cyan('scripts/prd.txt')} (see ${chalk.cyan('scripts/example_prd.txt')} for structure).`,
				`Generate initial tasks: ${chalk.cyan('task-master parse-prd scripts/prd.txt')}`,
				`Start development: See ${chalk.cyan('scripts/README.md')} and potentially language-specific docs.`
			];

			console.log(
				boxen(chalk.white(`${chalk.bold('Next Steps:')}\n\n${nextSteps.join('\n')}`), {
					padding: 1,
					margin: { top: 1 },
					borderStyle: 'round',
					borderColor: 'green'
				})
			);
		}

		return true;
	} catch (error) {
		effectiveLog.error(`Project structure creation failed: ${error.message}`);
		effectiveLog.debug(error.stack); 
		return false;
	}
}

// Function to set up MCP server configuration (Keep this here for now, might make generic later)
function setupMCPConfiguration(targetDir, projectName, log) {
	const effectiveLog = {
		info: (msg, ...args) => log && log.info ? log.info(msg, ...args) : console.log("[INFO]", msg, ...args),
		warn: (msg, ...args) => log && log.warn ? log.warn(msg, ...args) : console.warn("[WARN]", msg, ...args),
		error: (msg, ...args) => log && log.error ? log.error(msg, ...args) : console.error("[ERROR]", msg, ...args),
		debug: (msg, ...args) => log && log.debug ? log.debug(msg, ...args) : (process.env.DEBUG === 'true' ? console.log("[DEBUG]", msg, ...args) : null),
		success: (msg, ...args) => log && log.success ? log.success(msg, ...args) : console.log("[SUCCESS]", msg, ...args),
	};

	const mcpServerDir = path.join(targetDir, 'mcp-server');
	const mcpSrcDir = path.join(mcpServerDir, 'src');
	const mcpToolsDir = path.join(mcpSrcDir, 'tools');
	const mcpCoreDir = path.join(mcpSrcDir, 'core');
	const mcpUtilsDir = path.join(mcpCoreDir, 'utils');

	effectiveLog.info('Setting up MCP Server configuration...');
	ensureDirectoryExists(mcpServerDir, effectiveLog);
	ensureDirectoryExists(mcpSrcDir, effectiveLog);
	ensureDirectoryExists(mcpToolsDir, effectiveLog);
	ensureDirectoryExists(mcpCoreDir, effectiveLog);
	ensureDirectoryExists(mcpUtilsDir, effectiveLog);

	// Basic MCP config file
	const mcpConfig = {
		projectName: projectName,
		port: process.env.MCP_PORT || 3000,
		logLevel: process.env.MCP_LOG_LEVEL || 'info',
		authEnabled: false, // Example: Default auth setting
		// Add other MCP specific configurations
	};
	const mcpConfigPath = path.join(mcpServerDir, 'mcp-config.json');
	try {
		fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
		effectiveLog.success('Created mcp-server/mcp-config.json');
	} catch (error) {
		effectiveLog.error(`Failed to write MCP config: ${error.message}`);
	}

	// Copy essential MCP server files (adjust paths as needed)
	const mcpUtilsSource = path.join(__dirname, 'modules', 'utils.js'); // Assumes utils are in modules
	const mcpUtilsTarget = path.join(mcpUtilsDir, 'utils.js');
	if (fs.existsSync(mcpUtilsSource)) {
		 try {
			fs.copyFileSync(mcpUtilsSource, mcpUtilsTarget);
			effectiveLog.info('Copied utils.js to MCP server.');
		} catch (error) {
			effectiveLog.error(`Failed to copy MCP utils: ${error.message}`);
		}
	} else {
		 effectiveLog.warn(`MCP utils source not found at ${mcpUtilsSource}`);
	}

	// Add placeholder files if needed (e.g., server entry point)
	const serverEntryPath = path.join(mcpSrcDir, 'server.js');
	if (!fs.existsSync(serverEntryPath)) {
		 try {
			fs.writeFileSync(serverEntryPath, '// Basic MCP Server setup\nconsole.log("MCP Server starting...");\n', 'utf8');
			effectiveLog.info('Created placeholder mcp-server/src/server.js');
		} catch (error) {
			effectiveLog.error(`Failed to create placeholder server file: ${error.message}`);
		}
	}
	effectiveLog.info('MCP Server setup complete.');
}

// Ensure necessary functions are exported
export default initializeProject;
