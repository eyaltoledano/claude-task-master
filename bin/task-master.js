#!/usr/bin/env node

/**
 * Claude Task Master CLI
 * Main entry point for globally installed package
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { Command } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Set OpenAI API key if not already set
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "PLACEHOLDER_API_KEY";

// Get package information
const packageJson = require('../package.json');
const version = packageJson.version;

// Get paths to script files
const devScriptPath = resolve(__dirname, '../scripts/dev.js');
const initScriptPath = resolve(__dirname, '../scripts/init.js');

// Helper function to run dev.js with arguments
function runDevScript(args) {
  const child = spawn('node', [devScriptPath, ...args], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  child.on('close', (code) => {
    process.exit(code);
  });
}

// Set up the command-line interface
const program = new Command();

program
  .name('task-master')
  .description('Claude Task Master CLI')
  .version(version);

program
  .command('init')
  .description('Initialize a new project')
  .option('-y, --yes', 'Skip prompts and use default values')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --description <description>', 'Project description')
  .option('-v, --version <version>', 'Project version')
  .option('-a, --author <author>', 'Author name')
  .option('--skip-install', 'Skip installing dependencies')
  .option('--dry-run', 'Show what would be done without making changes')
  .action((options) => {
    // Pass through any options to the init script
    const args = ['--yes', 'name', 'description', 'version', 'author', 'skip-install', 'dry-run']
      .filter(opt => options[opt])
      .map(opt => {
        if (opt === 'yes' || opt === 'skip-install' || opt === 'dry-run') {
          return `--${opt}`;
        }
        return `--${opt}=${options[opt]}`;
      });
    
    const child = spawn('node', [initScriptPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      process.exit(code);
    });
  });

program
  .command('dev')
  .description('Run the dev.js script')
  .allowUnknownOption(true)
  .action(() => {
    const args = process.argv.slice(process.argv.indexOf('dev') + 1);
    runDevScript(args);
  });

// Add shortcuts for common dev.js commands
program
  .command('list')
  .description('List all tasks')
  .option('-s, --status <status>', 'Filter by status')
  .option('--with-subtasks', 'Show subtasks for each task')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .action((options) => {
    const args = ['list'];
    if (options.status) args.push('--status', options.status);
    if (options.withSubtasks) args.push('--with-subtasks');
    if (options.file) args.push('--file', options.file);
    runDevScript(args);
  });

program
  .command('next')
  .description('Show the next task to work on')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .action((options) => {
    const args = ['next'];
    if (options.file) args.push('--file', options.file);
    runDevScript(args);
  });

program
  .command('generate')
  .description('Generate task files')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-o, --output <dir>', 'Output directory', 'tasks')
  .action((options) => {
    const args = ['generate'];
    if (options.file) args.push('--file', options.file);
    if (options.output) args.push('--output', options.output);
    runDevScript(args);
  });

// Add all other commands from dev.js
program
  .command('parse-prd')
  .description('Parse a PRD file and generate tasks')
  .argument('<file>', 'Path to the PRD file')
  .option('-o, --output <file>', 'Output file path', 'tasks/tasks.json')
  .option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
  .option('--ai-provider <provider>', 'AI provider to use (openai or openrouter)', 'openai')
  .action((file, options) => {
    if (options.aiProvider) {
      process.env.AI_PROVIDER = options.aiProvider;
    }
    const args = ['parse-prd', file];
    if (options.output) args.push('--output', options.output);
    if (options.numTasks) args.push('--num-tasks', options.numTasks);
    runDevScript(args);
  });

program
  .command('update')
  .description('Update tasks based on new information or implementation changes')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('--from <id>', 'Task ID to start updating from', '1')
  .option('-p, --prompt <text>', 'Prompt explaining the changes or new context (required)')
  .action((options) => {
    const args = ['update'];
    if (options.file) args.push('--file', options.file);
    if (options.from) args.push('--from', options.from);
    if (options.prompt) args.push('--prompt', options.prompt);
    runDevScript(args);
  });

program
  .command('set-status')
  .description('Set the status of a task')
  .option('-i, --id <id>', 'Task ID (can be comma-separated for multiple tasks)')
  .option('-s, --status <status>', 'New status (todo, in-progress, review, done)')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .action((options) => {
    const args = ['set-status'];
    if (options.id) args.push('--id', options.id);
    if (options.status) args.push('--status', options.status);
    if (options.file) args.push('--file', options.file);
    runDevScript(args);
  });

program
  .command('expand')
  .description('Expand tasks with subtasks')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-i, --id <id>', 'Task ID to expand')
  .option('-a, --all', 'Expand all tasks')
  .option('-n, --num <number>', 'Number of subtasks to generate')
  .option('-r, --no-research', 'Disable Perplexity AI for research-backed subtask generation')
  .option('-p, --prompt <text>', 'Additional context to guide subtask generation')
  .option('--force', 'Force regeneration of subtasks for tasks that already have them')
  .option('--ai-provider <provider>', 'AI provider to use (openai or openrouter)', 'openai')
  .action((options) => {
    const args = ['expand'];
    if (options.file) args.push('--file', options.file);
    if (options.id) args.push('--id', options.id);
    if (options.all) args.push('--all');
    if (options.num) args.push('--num', options.num);
    if (!options.research) args.push('--no-research');
    if (options.prompt) args.push('--prompt', options.prompt);
    if (options.force) args.push('--force');
    if (options.aiProvider) args.push('--ai-provider', options.aiProvider);
    runDevScript(args);
  });

program
  .command('analyze-complexity')
  .description('Analyze tasks and generate complexity-based expansion recommendations')
  .option('-o, --output <file>', 'Output file path for the report', 'scripts/task-complexity-report.json')
  .option('-m, --model <model>', 'LLM model to use for analysis')
  .option('-t, --threshold <number>', 'Minimum complexity score to recommend expansion (1-10)', '5')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-r, --research', 'Use Perplexity AI for research-backed complexity analysis')
  .action((options) => {
    const args = ['analyze-complexity'];
    if (options.output) args.push('--output', options.output);
    if (options.model) args.push('--model', options.model);
    if (options.threshold) args.push('--threshold', options.threshold);
    if (options.file) args.push('--file', options.file);
    if (options.research) args.push('--research');
    runDevScript(args);
  });

program
  .command('clear-subtasks')
  .description('Clear subtasks from specified tasks')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-i, --id <ids>', 'Task IDs (comma-separated) to clear subtasks from')
  .option('--all', 'Clear subtasks from all tasks')
  .action((options) => {
    const args = ['clear-subtasks'];
    if (options.file) args.push('--file', options.file);
    if (options.id) args.push('--id', options.id);
    if (options.all) args.push('--all');
    runDevScript(args);
  });

program
  .command('add-task')
  .description('Add a new task to tasks.json using AI')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-p, --prompt <text>', 'Description of the task to add (required)')
  .option('-d, --dependencies <ids>', 'Comma-separated list of task IDs this task depends on')
  .option('--priority <priority>', 'Task priority (high, medium, low)', 'medium')
  .action((options) => {
    const args = ['add-task'];
    if (options.file) args.push('--file', options.file);
    if (options.prompt) args.push('--prompt', options.prompt);
    if (options.dependencies) args.push('--dependencies', options.dependencies);
    if (options.priority) args.push('--priority', options.priority);
    runDevScript(args);
  });

program
  .command('show')
  .description('Show details of a specific task by ID')
  .argument('[id]', 'Task ID to show')
  .option('-i, --id <id>', 'Task ID to show (alternative to argument)')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .action((id, options) => {
    const args = ['show'];
    if (id) args.push(id);
    else if (options.id) args.push('--id', options.id);
    if (options.file) args.push('--file', options.file);
    runDevScript(args);
  });

program
  .command('add-dependency')
  .description('Add a dependency to a task')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-i, --id <id>', 'ID of the task to add dependency to')
  .option('-d, --depends-on <id>', 'ID of the task to add as dependency')
  .action((options) => {
    const args = ['add-dependency'];
    if (options.file) args.push('--file', options.file);
    if (options.id) args.push('--id', options.id);
    if (options.dependsOn) args.push('--depends-on', options.dependsOn);
    runDevScript(args);
  });

program
  .command('remove-dependency')
  .description('Remove a dependency from a task')
  .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-i, --id <id>', 'ID of the task to remove dependency from')
  .option('-d, --depends-on <id>', 'ID of the task to remove as dependency')
  .action((options) => {
    const args = ['remove-dependency'];
    if (options.file) args.push('--file', options.file);
    if (options.id) args.push('--id', options.id);
    if (options.dependsOn) args.push('--depends-on', options.dependsOn);
    runDevScript(args);
  });

program
  .command('validate-dependencies')
  .description('Check for and identify invalid dependencies in tasks')
  .option('-f, --file <path>', 'Path to the tasks.json file', 'tasks/tasks.json')
  .action((options) => {
    const args = ['validate-dependencies'];
    if (options.file) args.push('--file', options.file);
    runDevScript(args);
  });

program
  .command('fix-dependencies')
  .description('Find and fix all invalid dependencies in tasks.json and task files')
  .option('-f, --file <path>', 'Path to the tasks.json file', 'tasks/tasks.json')
  .action((options) => {
    const args = ['fix-dependencies'];
    if (options.file) args.push('--file', options.file);
    runDevScript(args);
  });

program
  .command('complexity-report')
  .description('Display the complexity analysis report')
  .option('-f, --file <path>', 'Path to the complexity report file', 'scripts/task-complexity-report.json')
  .action((options) => {
    const args = ['complexity-report'];
    if (options.file) args.push('--file', options.file);
    runDevScript(args);
  });

program.parse(process.argv);
