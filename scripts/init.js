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

// Function to copy a file from the package to the target directory
function copyTemplateFile(templateName, targetPath, replacements = {}) {
  // Get the file content from the appropriate source directory
  let sourcePath;
  
  // Map template names to their actual source paths
  switch(templateName) {
    case 'dev.js':
      sourcePath = path.join(__dirname, 'dev.js');
      break;
    case 'scripts_README.md':
      sourcePath = path.join(__dirname, '..', 'assets', 'scripts_README.md');
      break;
    case 'dev_workflow.mdc':
      sourcePath = path.join(__dirname, '..', '.cursor', 'rules', 'dev_workflow.mdc');
      break;
    case 'cursor_rules.mdc':
      sourcePath = path.join(__dirname, '..', '.cursor', 'rules', 'cursor_rules.mdc');
      break;
    case 'self_improve.mdc':
      sourcePath = path.join(__dirname, '..', '.cursor', 'rules', 'self_improve.mdc');
      break;
    case 'README-task-master.md':
      sourcePath = path.join(__dirname, '..', 'README-task-master.md');
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
  
  // Write the content to the target path
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
    
    createProjectStructure(projectName, projectDescription, projectVersion, authorName);
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
    const projectName = await promptQuestion(rl, chalk.cyan('Enter project name: '));
    const projectDescription = await promptQuestion(rl, chalk.cyan('Enter project description: '));
    const projectVersionInput = await promptQuestion(rl, chalk.cyan('Enter project version (default: 1.0.0): '));
    const authorName = await promptQuestion(rl, chalk.cyan('Enter your name: '));
    
    // Set default version if not provided
    const projectVersion = projectVersionInput.trim() ? projectVersionInput : '1.0.0';
    
    // Close the readline interface
    rl.close();
    
    // Create the project structure
    createProjectStructure(projectName, projectDescription, projectVersion, authorName);
    
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
function createProjectStructure(projectName, projectDescription, projectVersion, authorName) {
  const targetDir = process.cwd();
  log('info', `Initializing project in ${targetDir}`);
  
  // Create directories
  ensureDirectoryExists(path.join(targetDir, '.cursor', 'rules'));
  ensureDirectoryExists(path.join(targetDir, 'scripts'));
  ensureDirectoryExists(path.join(targetDir, 'tasks'));
  
  // Create package.json
  const packageJson = {
    name: projectName.toLowerCase().replace(/\s+/g, '-'),
    version: projectVersion,
    description: projectDescription,
    author: authorName,
    type: "module",
    scripts: {
      "dev": "node scripts/dev.js",
      "list": "node scripts/dev.js list",
      "generate": "node scripts/dev.js generate",
      "parse-prd": "node scripts/dev.js parse-prd"
    },
    dependencies: {
      "@anthropic-ai/sdk": "^0.39.0",
      "chalk": "^5.3.0",
      "commander": "^11.1.0",
      "dotenv": "^16.3.1",
      "openai": "^4.86.1",
      "figlet": "^1.7.0",
      "boxen": "^7.1.1",
      "gradient-string": "^2.0.2",
      "cli-table3": "^0.6.3",
      "ora": "^7.0.1"
    }
  };
  
  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  log('success', 'Created package.json');
  
  // Copy template files with replacements
  const replacements = {
    projectName,
    projectDescription,
    projectVersion,
    authorName,
    year: new Date().getFullYear()
  };
  
  // Copy .env.example
  copyTemplateFile('env.example', path.join(targetDir, '.env.example'), replacements);
  
  // Copy .gitignore
  copyTemplateFile('gitignore', path.join(targetDir, '.gitignore'));
  
  // Copy dev_workflow.mdc
  copyTemplateFile('dev_workflow.mdc', path.join(targetDir, '.cursor', 'rules', 'dev_workflow.mdc'));
  
  // Copy cursor_rules.mdc
  copyTemplateFile('cursor_rules.mdc', path.join(targetDir, '.cursor', 'rules', 'cursor_rules.mdc'));
  
  // Copy self_improve.mdc
  copyTemplateFile('self_improve.mdc', path.join(targetDir, '.cursor', 'rules', 'self_improve.mdc'));
  
  // Copy scripts/dev.js
  copyTemplateFile('dev.js', path.join(targetDir, 'scripts', 'dev.js'));
  
  // Copy scripts/README.md
  copyTemplateFile('scripts_README.md', path.join(targetDir, 'scripts', 'README.md'));
  
  // Copy example_prd.txt
  copyTemplateFile('example_prd.txt', path.join(targetDir, 'scripts', 'example_prd.txt'));
  
  // Create main README.md
  copyTemplateFile('README-task-master.md', path.join(targetDir, 'README.md'), replacements);
  
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
  console.log(boxen(chalk.cyan('Installing dependencies...'), {
    padding: 0.5,
    margin: 0.5,
    borderStyle: 'round',
    borderColor: 'blue'
  }));
  
  try {
    execSync('npm install', { stdio: 'inherit', cwd: targetDir });
    log('success', 'Dependencies installed successfully!');
  } catch (error) {
    log('error', 'Failed to install dependencies:', error.message);
    log('error', 'Please run npm install manually');
  }
  
  // Display success message
  console.log(boxen(
    warmGradient.multiline(figlet.textSync('Success!', { font: 'Standard' })) + 
    '\n' + chalk.green('Project initialized successfully!'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'green'
    }
  ));
  
  // Display next steps in a nice box
  console.log(boxen(
    chalk.cyan.bold('Things you can now do:') + '\n\n' +
    chalk.white('1. ') + chalk.yellow('Rename .env.example to .env and add your ANTHROPIC_API_KEY and PERPLEXITY_API_KEY') + '\n' +
    chalk.white('2. ') + chalk.yellow('Discuss your idea with AI, and once ready ask for a PRD using the example_prd.txt file, and save what you get to scripts/PRD.txt') + '\n' +
    chalk.white('3. ') + chalk.yellow('Ask Cursor Agent to parse your PRD.txt and generate tasks') + '\n' +
    chalk.white('   └─ ') + chalk.dim('You can also run ') + chalk.cyan('npm run parse-prd -- --input=<your-prd-file.txt>') + '\n' +
    chalk.white('4. ') + chalk.yellow('Ask Cursor to analyze the complexity of your tasks') + '\n' +
    chalk.white('5. ') + chalk.yellow('Ask Cursor which task is next to determine where to start') + '\n' +
    chalk.white('6. ') + chalk.yellow('Ask Cursor to expand any complex tasks that are too large or complex.') + '\n' +
    chalk.white('7. ') + chalk.yellow('Ask Cursor to set the status of a task, or multiple tasks. Use the task id from the task lists.') + '\n' +
    chalk.white('8. ') + chalk.yellow('Ask Cursor to update all tasks from a specific task id based on new learnings or pivots in your project.') + '\n' +
    chalk.white('9. ') + chalk.green.bold('Ship it!') + '\n\n' +
    chalk.dim('* Review the README.md file to learn how to use other commands via Cursor Agent.'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
      title: 'Getting Started',
      titleAlignment: 'center'
    }
  ));
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
    "task-master-ai": {
      "command": "npx",
      "args": [
        "task-master-ai",
        "mcp-server"
      ]
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
      if (!mcpConfig.mcpServers["task-master-ai"]) {
        mcpConfig.mcpServers["task-master-ai"] = newMCPServer["task-master-ai"];
        log('info', 'Added task-master-ai server to existing MCP configuration');
      } else {
        log('info', 'task-master-ai server already configured in mcp.json');
      }
      
      // Write the updated configuration
      fs.writeFileSync(
        mcpJsonPath, 
        JSON.stringify(mcpConfig, null, 4)
      );
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
        "mcpServers": newMCPServer
      };
      
      fs.writeFileSync(mcpJsonPath, JSON.stringify(newMCPConfig, null, 4));
      log('warn', 'Created new MCP configuration file (backup of original file was created if it existed)');
    }
  } else {
    // If mcp.json doesn't exist, create it
    const newMCPConfig = {
      "mcpServers": newMCPServer
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
    await initializeProject();
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
