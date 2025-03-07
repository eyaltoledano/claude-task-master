#!/usr/bin/env node

console.log('Starting claude-task-init...');

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Debug information
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());
console.log('Script path:', import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define log levels and colors
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Get log level from environment or default to info
const LOG_LEVEL = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toLowerCase()] : LOG_LEVELS.info;

// Logging function
function log(level, ...args) {
  const levelValue = LOG_LEVELS[level.toLowerCase()];
  
  if (levelValue >= LOG_LEVEL) {
    const prefix = {
      debug: `${COLORS.dim}[DEBUG]${COLORS.reset}`,
      info: `${COLORS.blue}[INFO]${COLORS.reset}`,
      warn: `${COLORS.yellow}[WARN]${COLORS.reset}`,
      error: `${COLORS.red}[ERROR]${COLORS.reset}`
    }[level.toLowerCase()];
    
    console.log(prefix, ...args);
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
      sourcePath = path.join(__dirname, 'README.md');
      break;
    case 'dev_workflow.mdc':
      sourcePath = path.join(__dirname, '..', '.cursor', 'rules', 'dev_workflow.mdc');
      break;
    case 'README.md':
      sourcePath = path.join(__dirname, '..', 'README.md');
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
    const projectName = await promptQuestion(rl, 'Enter project name: ');
    const projectDescription = await promptQuestion(rl, 'Enter project description: ');
    const projectVersionInput = await promptQuestion(rl, 'Enter project version (default: 1.0.0): ');
    const authorName = await promptQuestion(rl, 'Enter your name: ');
    
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
      "chalk": "^4.1.2",
      "commander": "^11.1.0",
      "dotenv": "^16.3.1"
    }
  };
  
  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  log('info', 'Created package.json');
  
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
  
  // Copy scripts/dev.js
  copyTemplateFile('dev.js', path.join(targetDir, 'scripts', 'dev.js'));
  
  // Copy scripts/README.md
  copyTemplateFile('scripts_README.md', path.join(targetDir, 'scripts', 'README.md'));
  
  // Copy example_prd.txt
  copyTemplateFile('example_prd.txt', path.join(targetDir, 'scripts', 'example_prd.txt'));
  
  // Create main README.md
  copyTemplateFile('README.md', path.join(targetDir, 'README.md'), replacements);
  
  // Initialize git repository if git is available
  try {
    if (!fs.existsSync(path.join(targetDir, '.git'))) {
      execSync('git init', { stdio: 'ignore' });
      log('info', 'Initialized git repository');
    }
  } catch (error) {
    log('warn', 'Git not available, skipping repository initialization');
  }
  
  log('info', `${COLORS.green}${COLORS.bright}Project initialized successfully!${COLORS.reset}`);
  log('info', '');
  log('info', 'Next steps:');
  log('info', '1. Run `npm install` to install dependencies');
  log('info', '2. Create a .env file with your ANTHROPIC_API_KEY (see .env.example)');
  log('info', '3. Add your PRD to the project');
  log('info', '4. Run `npm run parse-prd -- --input=<your-prd-file.txt>` to generate tasks');
  log('info', '');
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
export {
  initializeProject,
  createProjectStructure,
  log
}; 