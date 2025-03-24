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
import { Command } from 'commander';
import { setupCursorIntegration } from '../lib/cursor-mcp-setup.js';

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
  .option('-d, --description <description>', 'Project description')
  .option('-v, --version <version>', 'Project version')
  .option('-a, --author <author>', 'Author name')
  .option('--skip-install', 'Skip installing dependencies')
  .option('--dry-run', 'Show what would be done without making changes')
  .parse(process.argv);

const options = program.opts();

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

    if (dryRun) {
      log('info', 'DRY RUN MODE: No files will be modified');
      log(
        'info',
        `Would initialize project: ${projectName} (${projectVersion})`
      );
      log('info', `Description: ${projectDescription}`);
      log('info', `Author: ${authorName || 'Not specified'}`);
      log('info', 'Would create/update necessary project files');
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
      skipInstall
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
      skipInstall
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
async function createProjectStructure(
  projectName,
  projectDescription,
  projectVersion,
  authorName,
  skipInstall
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
      chalk: '^5.3.0',
      commander: '^11.1.0',
      dotenv: '^16.3.1',
      openai: '^4.86.1',
      figlet: '^1.7.0',
      boxen: '^7.1.1',
      'gradient-string': '^2.0.2',
      'cli-table3': '^0.6.3',
      ora: '^7.0.1'
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

  // Set up Cursor integration
  log('info', 'Setting up Cursor integration for /task commands...');
  const cursorSetupResult = await setupCursorIntegration(targetDir, true);
  if (cursorSetupResult) {
    log('success', 'Cursor integration set up successfully!');
    log(
      'info',
      'You can now use commands like /task list directly in Cursor chat.'
    );
  } else {
    log(
      'warn',
      'Could not set up Cursor integration. You can run npx task-master-cursor-setup manually.'
    );
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
        chalk.cyan('npm run parse-prd -- --input=<your-prd-file.txt>') +
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

// If run directly, execute the main function
(async function main() {
  try {
    // Display the banner
    displayBanner();

    // If dry-run option is specified, just log what would be done
    if (options.dryRun) {
      log('info', 'Dry run: No changes will be made.');
      log(
        'info',
        `Project would be initialized with the following configuration:`
      );
      const projectName = options.name || 'task-master-project';
      const projectDescription =
        options.description || 'A project managed with Task Master';
      const projectVersion = options.version || '0.1.0';
      const authorName = options.author || 'AI Developer';
      log('info', `- Name: ${projectName}`);
      log('info', `- Description: ${projectDescription}`);
      log('info', `- Version: ${projectVersion}`);
      log('info', `- Author: ${authorName}`);
      log('info', `- Skip install: ${options.skipInstall || false}`);
      process.exit(0);
      return;
    }

    // Check if skipPrompts option is enabled or if all required options are provided
    if (
      options.yes ||
      (options.name && options.description && options.version && options.author)
    ) {
      const projectName = options.name || 'task-master-project';
      const projectDescription =
        options.description || 'A project managed with Task Master';
      const projectVersion = options.version || '0.1.0';
      const authorName = options.author || 'AI Developer';
      const skipInstall = options.skipInstall || false;

      log('info', 'Using provided options for project initialization:');
      log('info', `- Name: ${projectName}`);
      log('info', `- Description: ${projectDescription}`);
      log('info', `- Version: ${projectVersion}`);
      log('info', `- Author: ${authorName}`);
      log('info', `- Skip install: ${skipInstall}`);

      await createProjectStructure(
        projectName,
        projectDescription,
        projectVersion,
        authorName,
        skipInstall
      );
      process.exit(0);
      return;
    }

    // Create readline interface for prompts
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Prompt for project information
    const projectName =
      (await promptQuestion(
        rl,
        chalk.blue('Project name: ') + chalk.dim('(task-master-project) ')
      )) || 'task-master-project';
    const projectDescription =
      (await promptQuestion(
        rl,
        chalk.blue('Project description: ') +
          chalk.dim('(A project managed with Task Master) ')
      )) || 'A project managed with Task Master';
    const projectVersion =
      (await promptQuestion(
        rl,
        chalk.blue('Project version: ') + chalk.dim('(0.1.0) ')
      )) || '0.1.0';
    const authorName =
      (await promptQuestion(
        rl,
        chalk.blue('Author: ') + chalk.dim('(AI Developer) ')
      )) || 'AI Developer';

    // Prompt for whether to install dependencies
    const skipInstallResponse =
      (await promptQuestion(
        rl,
        chalk.blue('Skip installing dependencies? (yes/no): ') +
          chalk.dim('(no) ')
      )) || 'no';
    const skipInstall = skipInstallResponse.toLowerCase().startsWith('y');

    rl.close();

    log('info', `Creating project structure for '${projectName}'...`);
    await createProjectStructure(
      projectName,
      projectDescription,
      projectVersion,
      authorName,
      skipInstall
    );
    process.exit(0);
  } catch (error) {
    log('error', `Initialization failed: ${error.message}`);
    log('debug', error.stack);
    process.exit(1);
  }
})();

// Export functions for programmatic use
export { initializeProject, createProjectStructure, log };
