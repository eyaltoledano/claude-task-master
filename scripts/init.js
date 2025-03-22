#!/usr/bin/env node

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
const LOG_LEVEL = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toLowerCase()] : LOG_LEVELS.info;

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
  console.log(chalk.dim('by ') + chalk.cyan.underline('https://x.com/eyaltoledano'));

  console.log(boxen(chalk.white(`${chalk.bold('Initializing')} your new project`), {
    padding: 1,
    margin: { top: 0, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'cyan'
  }));
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
  ensureDirectoryExists(path.join(targetDir, 'scripts', 'task-master'));
  ensureDirectoryExists(path.join(targetDir, 'tasks'));

  // Handle package.json - check if it exists first
  const packageJsonPath = path.join(targetDir, 'package.json');
  let existingPackageJson = {};

  if (fs.existsSync(packageJsonPath)) {
    try {
      existingPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      log('info', 'Found existing package.json, will update it');
    } catch (error) {
      log('error', 'Failed to parse existing package.json:', error.message);
      // Continue with empty object if parsing fails
    }
  }

  // Create task-master scripts to add to package.json
  const taskMasterScripts = {
    "task-master:dev": "node scripts/task-master/dev.js",
    "task-master:list": "node scripts/task-master/dev.js list",
    "task-master:next": "node scripts/task-master/dev.js next",
    "task-master:generate": "node scripts/task-master/dev.js generate",
    "task-master:parse-prd": "node scripts/task-master/dev.js parse-prd",
    "task-master:expand": "node scripts/task-master/dev.js expand",
    "task-master:show": "node scripts/task-master/dev.js show",
    "task-master:set-status": "node scripts/task-master/dev.js set-status",
    "task-master:analyze": "node scripts/task-master/dev.js analyze-complexity",
    "task-master:complexity": "node scripts/task-master/dev.js complexity-report",
    "task-master:update": "node scripts/task-master/dev.js update"
  };

  // Task-master dependencies
  const taskMasterDependencies = {
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
  };

  // Update or create package.json
  const updatedPackageJson = {
    ...existingPackageJson,
    // Only set these if they don't exist
    name: existingPackageJson.name || projectName.toLowerCase().replace(/\s+/g, '-'),
    version: existingPackageJson.version || projectVersion,
    description: existingPackageJson.description || projectDescription,
    author: existingPackageJson.author || authorName,
    type: existingPackageJson.type || "module",
    // Merge scripts
    scripts: {
      ...(existingPackageJson.scripts || {}),
      ...taskMasterScripts
    },
    // Merge dependencies, keeping existing versions
    dependencies: {
      ...(existingPackageJson.dependencies || {}),
      // Only add dependencies that don't exist
      ...Object.fromEntries(
        Object.entries(taskMasterDependencies).filter(
          ([name]) => !existingPackageJson.dependencies || !existingPackageJson.dependencies[name]
        )
      )
    }
  };

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(updatedPackageJson, null, 2)
  );
  log('success', 'Updated package.json');

  // Copy template files with replacements
  const replacements = {
    projectName,
    projectDescription,
    projectVersion,
    authorName,
    year: new Date().getFullYear()
  };

  // Handle .env.example - append Task Master entries if it exists
  const envExamplePath = path.join(targetDir, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    log('info', '.env.example already exists, will append Task Master entries');

    // Read our template env.example file
    const templateEnvPath = path.join(__dirname, '..', 'assets', 'env.example');

    if (fs.existsSync(templateEnvPath)) {
      const existingEnv = fs.readFileSync(envExamplePath, 'utf8');
      const templateEnv = fs.readFileSync(templateEnvPath, 'utf8');

      // Process templateEnv with replacements
      let processedTemplateEnv = templateEnv;
      Object.entries(replacements).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        processedTemplateEnv = processedTemplateEnv.replace(regex, value);
      });

      // Split into lines for comparison
      const existingLines = existingEnv.split('\n');
      const templateLines = processedTemplateEnv.split('\n');

      // Extract variable names for comparison
      const getVarName = (line) => {
        const match = line.match(/^([A-Z0-9_]+)=/);
        return match ? match[1] : null;
      };

      // Find variables from the template that don't exist in the current file
      const existingVars = existingLines
        .map(getVarName)
        .filter(Boolean);

      const newLines = templateLines.filter(line => {
        // Skip empty lines or comments when checking
        if (!line.trim() || line.trim().startsWith('#')) return false;

        const varName = getVarName(line);
        return varName && !existingVars.includes(varName);
      });

      if (newLines.length > 0) {
        // Add our header and the new entries
        const appendContent = `\n\n# Added by Task Master AI\n${newLines.join('\n')}\n`;
        fs.appendFileSync(envExamplePath, appendContent);
        log('success', 'Appended Task Master entries to .env.example');
      } else {
        log('info', 'All Task Master variables already in .env.example, no changes needed');
      }
    } else {
      log('warn', 'Could not find template env.example file, skipping update');
    }
  } else {
    // Copy env.example if it doesn't exist
    copyTemplateFile('env.example', envExamplePath, replacements);
  }

  // Handle .gitignore - append Task Master entries if it exists
  const gitignorePath = path.join(targetDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    log('info', '.gitignore already exists, will append Task Master entries');

    // Read our template gitignore file
    const templateGitignorePath = path.join(__dirname, '..', 'assets', 'gitignore');

    if (fs.existsSync(templateGitignorePath)) {
      const existingGitignore = fs.readFileSync(gitignorePath, 'utf8');
      const templateGitignore = fs.readFileSync(templateGitignorePath, 'utf8');

      // Split into lines for comparison
      const existingLines = existingGitignore.split('\n');
      const templateLines = templateGitignore.split('\n');

      // Find lines from the template that don't exist in the current file
      const newLines = templateLines.filter(line => {
        // Skip empty lines or comments when checking for duplicates
        if (!line.trim() || line.trim().startsWith('#')) return false;
        return !existingLines.some(existing => existing.trim() === line.trim());
      });

      if (newLines.length > 0) {
        // Add our header and the new entries
        const appendContent = `\n\n# Added by Task Master AI\n${newLines.join('\n')}\n`;
        fs.appendFileSync(gitignorePath, appendContent);
        log('success', 'Appended Task Master entries to .gitignore');
      } else {
        log('info', 'All Task Master entries already in .gitignore, no changes needed');
      }
    } else {
      log('warn', 'Could not find template gitignore file, skipping update');
    }
  } else {
    // Copy gitignore if it doesn't exist
    copyTemplateFile('gitignore', gitignorePath);
  }

  // Handle cursor rules files
  const cursorRuleFiles = [
    {
      sourceName: 'dev_workflow.mdc',
      targetPath: path.join(targetDir, '.cursor', 'rules', 'dev_workflow.mdc')
    },
    {
      sourceName: 'cursor_rules.mdc',
      targetPath: path.join(targetDir, '.cursor', 'rules', 'cursor_rules.mdc')
    },
    {
      sourceName: 'self_improve.mdc',
      targetPath: path.join(targetDir, '.cursor', 'rules', 'self_improve.mdc')
    }
  ];

  // Process each cursor rule file
  for (const ruleFile of cursorRuleFiles) {
    let ruleSourcePath;
    switch (ruleFile.sourceName) {
      case 'dev_workflow.mdc':
      case 'cursor_rules.mdc':
      case 'self_improve.mdc':
        ruleSourcePath = path.join(
          __dirname,
          '..',
          '.cursor',
          'rules',
          ruleFile.sourceName
        );
        break;
      default:
        // For other files that don't have direct equivalents
        ruleSourcePath = path.join(
          __dirname,
          '..',
          'assets',
          ruleFile.sourceName
        );
    }

    if (!fs.existsSync(ruleSourcePath)) {
      log('warn', `Source rule file not found: ${ruleSourcePath}`);
      continue;
    }

    // Skip if the target file already exists
    if (fs.existsSync(ruleFile.targetPath)) {
      log('info', `${path.basename(ruleFile.targetPath)} already exists, skipping...`);
      continue;
    }

    // Ensure the directory exists
    ensureDirectoryExists(path.dirname(ruleFile.targetPath));

    // Copy the file with replacements
    let content = fs.readFileSync(ruleSourcePath, 'utf8');

    // Replace placeholders with values
    for (const [key, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    fs.writeFileSync(ruleFile.targetPath, content);
    log('success', `Created ${path.basename(ruleFile.targetPath)}`);
  }

  // Copy dev.js to task-master subfolder only
  copyTemplateFile('dev.js', path.join(targetDir, 'scripts', 'task-master', 'dev.js'));

  // Copy scripts/README.md to task-master subfolder only
  copyTemplateFile('scripts_README.md', path.join(targetDir, 'scripts', 'task-master', 'README.md'));

  // Copy example_prd.txt to task-master subfolder only
  copyTemplateFile('example_prd.txt', path.join(targetDir, 'scripts', 'task-master', 'example_prd.txt'));

  // Handle README.md - append Task Master info instead of replacing
  const readmePath = path.join(targetDir, 'README.md');
  if (fs.existsSync(readmePath)) {
    log('info', 'Found existing README.md, will append Task Master information');

    // Get task master README content
    const taskMasterReadmePath = path.join(__dirname, '..', 'README-task-master.md');
    let taskMasterContent = '';

    if (fs.existsSync(taskMasterReadmePath)) {
      taskMasterContent = fs.readFileSync(taskMasterReadmePath, 'utf8');

      // Replace placeholders with values
      for (const [key, value] of Object.entries(replacements)) {
        taskMasterContent = taskMasterContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }

      // Append to existing README with a clear divider
      const divider = '\n\n## Task Master AI\n\n';
      fs.appendFileSync(readmePath, divider + taskMasterContent);
      log('success', 'Appended Task Master information to README.md');
    } else {
      log('warn', 'Could not find Task Master README template, skipping README update');
    }
  } else {
    // Create main README.md if it doesn't exist
    copyTemplateFile('README-task-master.md', readmePath, replacements);
  }

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
    // Detect the package manager being used in the project
    let packageManager = 'npm';

    // Check for lock files to determine the package manager
    if (fs.existsSync(path.join(targetDir, 'yarn.lock'))) {
      packageManager = 'yarn';
    } else if (fs.existsSync(path.join(targetDir, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
    } else if (fs.existsSync(path.join(targetDir, 'bun.lockb'))) {
      packageManager = 'bun';
    }

    log('info', `Detected package manager: ${packageManager}`);

    // Run the appropriate install command
    execSync(`${packageManager} install`, { stdio: 'inherit', cwd: targetDir });
    log('success', 'Dependencies installed successfully!');
  } catch (error) {
    log('error', 'Failed to install dependencies:', error.message);
    log('warn', 'Please run the appropriate install command manually (npm install, yarn, pnpm install, or bun install)');
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
    chalk.white('2. ') + chalk.yellow('Discuss your idea with AI, and once ready ask for a PRD using the example_prd.txt file, and save what you get to scripts/task-master/PRD.txt') + '\n' +
    chalk.white('3. ') + chalk.yellow('Ask Cursor Agent to parse your PRD.txt and generate tasks with the task-master commands') + '\n' +
    chalk.white('   └─ ') + chalk.dim('You can also run ') + chalk.cyan('npm run task-master:parse-prd -- --input=<your-prd-file.txt>') + '\n' +
    chalk.white('4. ') + chalk.yellow('Ask Cursor to analyze the complexity of your tasks') + '\n' +
    chalk.white('   └─ ') + chalk.dim('Or run ') + chalk.cyan('npm run task-master:analyze') + '\n' +
    chalk.white('5. ') + chalk.yellow('Ask Cursor which task is next to determine where to start') + '\n' +
    chalk.white('   └─ ') + chalk.dim('Or run ') + chalk.cyan('npm run task-master:next') + '\n' +
    chalk.white('6. ') + chalk.yellow('Ask Cursor to expand any complex tasks that are too large or complex.') + '\n' +
    chalk.white('   └─ ') + chalk.dim('Or run ') + chalk.cyan('npm run task-master:expand -- --id=<task-id>') + '\n' +
    chalk.white('7. ') + chalk.yellow('Ask Cursor to set the status of a task, or multiple tasks. Use the task id from the task lists.') + '\n' +
    chalk.white('   └─ ') + chalk.dim('Or run ') + chalk.cyan('npm run task-master:set-status -- --id=<task-id> --status=done') + '\n' +
    chalk.white('8. ') + chalk.yellow('Ask Cursor to update all tasks from a specific task id based on new learnings or pivots in your project.') + '\n' +
    chalk.white('   └─ ') + chalk.dim('Or run ') + chalk.cyan('npm run task-master:update -- --from=<task-id> --prompt="<explanation>"') + '\n' +
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

