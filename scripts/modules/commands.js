/**
 * commands.js
 * 
 * Central registry for all CLI commands
 */

import { Command } from 'commander';

/**
 * Register all available CLI commands
 * @param {Command} program - Commander program instance to register commands with
 */
export function registerCommands(program) {
  // Task Generation Commands
  program
    .command('parse-prd')
    .description('Parse a PRD file and generate tasks (automatically runs complexity analysis after generation)')
    .argument('[file]', 'Path to the PRD file')
    .option('-o, --output <file>', 'Output file path', 'tasks/tasks.json')
    .option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
    .option('--skip-complexity', 'Skip the automatic complexity analysis step');

  program
    .command('generate')
    .description('Generate task files from tasks.json')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-o, --output <dir>', 'Output directory', 'tasks');

  // Task Management Commands
  program
    .command('set-status')
    .description('Set the status of a task')
    .option('-i, --id <id>', 'Task ID (can be comma-separated for multiple tasks)')
    .option('-s, --status <status>', 'New status (todo, in-progress, review, done)')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json');

  program
    .command('list')
    .description('List all tasks')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-s, --status <status>', 'Filter by status')
    .option('--with-subtasks', 'Show subtasks for each task');

  program
    .command('update')
    .description('Update tasks based on new information or implementation changes')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('--from <id>', 'Task ID to start updating from (tasks with ID >= this value will be updated)', '1')
    .option('-p, --prompt <text>', 'Prompt explaining the changes or new context (required)');

  program
    .command('add-task')
    .description('Add a new task using AI')
    .option('-p, --prompt <text>', 'Description of the task to add')
    .option('-d, --dependencies <ids>', 'Comma-separated list of task IDs this task depends on')
    .option('--priority <priority>', 'Task priority (high, medium, low)', 'medium')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json');

  program
    .command('add-dependency')
    .description('Add a dependency to a task')
    .option('-i, --id <id>', 'Task ID that will depend on another')
    .option('-d, --depends-on <id>', 'ID of task that will become a dependency')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json');

  program
    .command('remove-dependency')
    .description('Remove a dependency from a task')
    .option('-i, --id <id>', 'Task ID to remove dependency from')
    .option('-d, --depends-on <id>', 'Task ID to remove as a dependency')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json');

  // Task Analysis Commands
  program
    .command('analyze-complexity')
    .description('Analyze tasks and generate expansion recommendations')
    .option('-o, --output <file>', 'Output file path for the report', 'scripts/task-complexity-report.json')
    .option('-m, --model <model>', 'LLM model to use for analysis')
    .option('-t, --threshold <number>', 'Minimum complexity score to recommend expansion (1-10)', '5')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-r, --research', 'Use Perplexity AI for research-backed complexity analysis');

  program
    .command('complexity-report')
    .description('Display the complexity analysis report')
    .option('-f, --file <path>', 'Path to the report file', 'scripts/task-complexity-report.json');

  program
    .command('expand')
    .description('Break down tasks into detailed subtasks')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <id>', 'Task ID to expand')
    .option('-a, --all', 'Expand all tasks')
    .option('-n, --num <number>', 'Number of subtasks to generate', '3')
    .option('-r, --research', 'Use Perplexity AI for research-backed subtask generation')
    .option('-p, --prompt <text>', 'Additional context to guide subtask generation')
    .option('--force', 'Force regeneration of subtasks for tasks that already have them');

  program
    .command('clear-subtasks')
    .description('Clear subtasks from specified tasks')
    .option('-i, --id <id>', 'Task IDs (comma-separated) to clear subtasks from')
    .option('--all', 'Clear subtasks from all tasks')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json');

  // Task Navigation Commands
  program
    .command('next')
    .description('Show the next task to work on based on dependencies and status')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json');

  program
    .command('show')
    .description('Display detailed information about a specific task')
    .argument('<id>', 'Task ID to show')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json');

  // Dependency Management Commands
  program
    .command('validate-dependencies')
    .description('Identify invalid dependencies without fixing them')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json');

  program
    .command('fix-dependencies')
    .description('Fix invalid dependencies automatically')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json');

  return program;
}

/**
 * Setup a CLI program with all Task Master commands
 * @returns {Command} Configured commander program instance
 */
export function setupCLI() {
  const program = new Command();
  return registerCommands(program);
}

// Export the key functions
export default {
  registerCommands,
  setupCLI
};
