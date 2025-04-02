/**
 * commands.js
 * Command-line interface for the Task Master CLI
 */

import { program } from 'commander';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'fs';
import https from 'https';
import inquirer from 'inquirer';
import ora from 'ora';

import { CONFIG, log, readJSON } from './utils.js';
import {
  parsePRD,
  updateTasks,
  generateTaskFiles,
  setTaskStatus,
  listTasks,
  expandTask,
  expandAllTasks,
  clearSubtasks,
  addTask,
  addSubtask,
  removeSubtask,
  analyzeTaskComplexity,
  updateTaskById,
  updateSubtaskById,
  brainstormTaskImplementation
} from './task-manager.js';

import {
  addDependency,
  removeDependency,
  validateDependenciesCommand,
  fixDependenciesCommand
} from './dependency-manager.js';

import {
  displayBanner,
  displayHelp,
  displayNextTask,
  displayTaskById,
  displayComplexityReport,
  getStatusWithColor,
  confirmTaskOverwrite
} from './ui.js';

import { IdeationService } from './ideation-service.js';
import { DiscussionService } from './discussion-service.js';
import { PRDService } from './prd-service.js';
import { Idea } from './models/idea.js';
import { Discussion } from './models/discussion.js';
import { PRD } from './models/prd.js';
import logger, { createLogger } from './logger.js';
import errorHandler from './error-handler.js';

/**
 * Configure and register CLI commands
 * @param {Object} program - Commander program instance
 */
function registerCommands(programInstance) {
  // Add global error handler for unknown options
  programInstance.on('option:unknown', function(unknownOption) {
    const commandName = this._name || 'unknown';
    console.error(chalk.red(`Error: Unknown option '${unknownOption}'`));
    console.error(chalk.yellow(`Run 'task-master ${commandName} --help' to see available options`));
    process.exit(1);
  });
  
  // Default help
  programInstance.on('--help', function() {
    displayHelp();
  });
  
  // parse-prd command
  programInstance
    .command('parse-prd')
    .description('Parse a PRD file and generate tasks')
    .argument('[file]', 'Path to the PRD file')
    .option('-i, --input <file>', 'Path to the PRD file (alternative to positional argument)')
    .option('-o, --output <file>', 'Output file path', 'tasks/tasks.json')
    .option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
    .option('-f, --force', 'Skip confirmation when overwriting existing tasks')
    .action(async (file, options) => {
      // Use input option if file argument not provided
      const inputFile = file || options.input;
      const defaultPrdPath = 'scripts/prd.txt';
      const numTasks = parseInt(options.numTasks, 10);
      const outputPath = options.output;
      const force = options.force || false;
      
      // Helper function to check if tasks.json exists and confirm overwrite
      async function confirmOverwriteIfNeeded() {
        if (fs.existsSync(outputPath) && !force) {
          const shouldContinue = await confirmTaskOverwrite(outputPath);
          if (!shouldContinue) {
            console.log(chalk.yellow('Operation cancelled by user.'));
            return false;
          }
        }
        return true;
      }
      
      // If no input file specified, check for default PRD location
      if (!inputFile) {
        if (fs.existsSync(defaultPrdPath)) {
          console.log(chalk.blue(`Using default PRD file: ${defaultPrdPath}`));
          
          // Check for existing tasks.json before proceeding
          if (!await confirmOverwriteIfNeeded()) return;
          
          console.log(chalk.blue(`Generating ${numTasks} tasks...`));
          await parsePRD(defaultPrdPath, outputPath, numTasks);
          return;
        }
        
        console.log(chalk.yellow('No PRD file specified and default PRD file not found at scripts/prd.txt.'));
        console.log(boxen(
          chalk.white.bold('Parse PRD Help') + '\n\n' +
          chalk.cyan('Usage:') + '\n' +
          `  task-master parse-prd <prd-file.txt> [options]\n\n` +
          chalk.cyan('Options:') + '\n' +
          '  -i, --input <file>       Path to the PRD file (alternative to positional argument)\n' +
          '  -o, --output <file>      Output file path (default: "tasks/tasks.json")\n' +
          '  -n, --num-tasks <number> Number of tasks to generate (default: 10)\n' +
          '  -f, --force              Skip confirmation when overwriting existing tasks\n\n' +
          chalk.cyan('Example:') + '\n' +
          '  task-master parse-prd requirements.txt --num-tasks 15\n' +
          '  task-master parse-prd --input=requirements.txt\n' +
          '  task-master parse-prd --force\n\n' +
          chalk.yellow('Note: This command will:') + '\n' +
          '  1. Look for a PRD file at scripts/prd.txt by default\n' +
          '  2. Use the file specified by --input or positional argument if provided\n' +
          '  3. Generate tasks from the PRD and overwrite any existing tasks.json file',
          { padding: 1, borderColor: 'blue', borderStyle: 'round' }
        ));
        return;
      }
      
      // Check for existing tasks.json before proceeding with specified input file
      if (!await confirmOverwriteIfNeeded()) return;
      
      console.log(chalk.blue(`Parsing PRD file: ${inputFile}`));
      console.log(chalk.blue(`Generating ${numTasks} tasks...`));
      
      await parsePRD(inputFile, outputPath, numTasks);
    });

  // update command
  programInstance
    .command('update')
    .description('Update tasks based on new information or implementation changes')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('--from <id>', 'Task ID to start updating from (tasks with ID >= this value will be updated)', '1')
    .option('-p, --prompt <text>', 'Prompt explaining the changes or new context (required)')
    .option('-r, --research', 'Use Perplexity AI for research-backed task updates')
    .action(async (options) => {
      const tasksPath = options.file;
      const fromId = parseInt(options.from, 10);
      const prompt = options.prompt;
      const useResearch = options.research || false;
      
      if (!prompt) {
        console.error(chalk.red('Error: --prompt parameter is required. Please provide information about the changes.'));
        process.exit(1);
      }
      
      console.log(chalk.blue(`Updating tasks from ID >= ${fromId} with prompt: "${prompt}"`));
      console.log(chalk.blue(`Tasks file: ${tasksPath}`));
      
      if (useResearch) {
        console.log(chalk.blue('Using Perplexity AI for research-backed task updates'));
      }
      
      await updateTasks(tasksPath, fromId, prompt, useResearch);
    });

  // update-task command
  programInstance
    .command('update-task')
    .description('Update a single task by ID with new information')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <id>', 'Task ID to update (required)')
    .option('-p, --prompt <text>', 'Prompt explaining the changes or new context (required)')
    .option('-r, --research', 'Use Perplexity AI for research-backed task updates')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        
        // Validate required parameters
        if (!options.id) {
          console.error(chalk.red('Error: --id parameter is required'));
          console.log(chalk.yellow('Usage example: task-master update-task --id=23 --prompt="Update with new information"'));
          process.exit(1);
        }
        
        // Parse the task ID and validate it's a number
        const taskId = parseInt(options.id, 10);
        if (isNaN(taskId) || taskId <= 0) {
          console.error(chalk.red(`Error: Invalid task ID: ${options.id}. Task ID must be a positive integer.`));
          console.log(chalk.yellow('Usage example: task-master update-task --id=23 --prompt="Update with new information"'));
          process.exit(1);
        }
        
        if (!options.prompt) {
          console.error(chalk.red('Error: --prompt parameter is required. Please provide information about the changes.'));
          console.log(chalk.yellow('Usage example: task-master update-task --id=23 --prompt="Update with new information"'));
          process.exit(1);
        }
        
        const prompt = options.prompt;
        const useResearch = options.research || false;
        
        // Validate tasks file exists
        if (!fs.existsSync(tasksPath)) {
          console.error(chalk.red(`Error: Tasks file not found at path: ${tasksPath}`));
          if (tasksPath === 'tasks/tasks.json') {
            console.log(chalk.yellow('Hint: Run task-master init or task-master parse-prd to create tasks.json first'));
          } else {
            console.log(chalk.yellow(`Hint: Check if the file path is correct: ${tasksPath}`));
          }
          process.exit(1);
        }
        
        console.log(chalk.blue(`Updating task ${taskId} with prompt: "${prompt}"`));
        console.log(chalk.blue(`Tasks file: ${tasksPath}`));
        
        if (useResearch) {
          // Verify Perplexity API key exists if using research
          if (!process.env.PERPLEXITY_API_KEY) {
            console.log(chalk.yellow('Warning: PERPLEXITY_API_KEY environment variable is missing. Research-backed updates will not be available.'));
            console.log(chalk.yellow('Falling back to Claude AI for task update.'));
          } else {
            console.log(chalk.blue('Using Perplexity AI for research-backed task update'));
          }
        }
        
        const result = await updateTaskById(tasksPath, taskId, prompt, useResearch);
        
        // If the task wasn't updated (e.g., if it was already marked as done)
        if (!result) {
          console.log(chalk.yellow('\nTask update was not completed. Review the messages above for details.'));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        
        // Provide more helpful error messages for common issues
        if (error.message.includes('task') && error.message.includes('not found')) {
          console.log(chalk.yellow('\nTo fix this issue:'));
          console.log('  1. Run task-master list to see all available task IDs');
          console.log('  2. Use a valid task ID with the --id parameter');
        } else if (error.message.includes('API key')) {
          console.log(chalk.yellow('\nThis error is related to API keys. Check your environment variables.'));
        }
        
        if (CONFIG.debug) {
          console.error(error);
        }
        
        process.exit(1);
      }
    });

  // update-subtask command
  programInstance
    .command('update-subtask')
    .description('Update a subtask by appending additional timestamped information')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <id>', 'Subtask ID to update in format "parentId.subtaskId" (required)')
    .option('-p, --prompt <text>', 'Prompt explaining what information to add (required)')
    .option('-r, --research', 'Use Perplexity AI for research-backed updates')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        
        // Validate required parameters
        if (!options.id) {
          console.error(chalk.red('Error: --id parameter is required'));
          console.log(chalk.yellow('Usage example: task-master update-subtask --id=5.2 --prompt="Add more details about the API endpoint"'));
          process.exit(1);
        }
        
        // Validate subtask ID format (should contain a dot)
        const subtaskId = options.id;
        if (!subtaskId.includes('.')) {
          console.error(chalk.red(`Error: Invalid subtask ID format: ${subtaskId}. Subtask ID must be in format "parentId.subtaskId"`));
          console.log(chalk.yellow('Usage example: task-master update-subtask --id=5.2 --prompt="Add more details about the API endpoint"'));
          process.exit(1);
        }
        
        if (!options.prompt) {
          console.error(chalk.red('Error: --prompt parameter is required. Please provide information to add to the subtask.'));
          console.log(chalk.yellow('Usage example: task-master update-subtask --id=5.2 --prompt="Add more details about the API endpoint"'));
          process.exit(1);
        }
        
        const prompt = options.prompt;
        const useResearch = options.research || false;
        
        // Validate tasks file exists
        if (!fs.existsSync(tasksPath)) {
          console.error(chalk.red(`Error: Tasks file not found at path: ${tasksPath}`));
          if (tasksPath === 'tasks/tasks.json') {
            console.log(chalk.yellow('Hint: Run task-master init or task-master parse-prd to create tasks.json first'));
          } else {
            console.log(chalk.yellow(`Hint: Check if the file path is correct: ${tasksPath}`));
          }
          process.exit(1);
        }
        
        console.log(chalk.blue(`Updating subtask ${subtaskId} with prompt: "${prompt}"`));
        console.log(chalk.blue(`Tasks file: ${tasksPath}`));
        
        if (useResearch) {
          // Verify Perplexity API key exists if using research
          if (!process.env.PERPLEXITY_API_KEY) {
            console.log(chalk.yellow('Warning: PERPLEXITY_API_KEY environment variable is missing. Research-backed updates will not be available.'));
            console.log(chalk.yellow('Falling back to Claude AI for subtask update.'));
          } else {
            console.log(chalk.blue('Using Perplexity AI for research-backed subtask update'));
          }
        }
        
        const result = await updateSubtaskById(tasksPath, subtaskId, prompt, useResearch);
        
        if (!result) {
          console.log(chalk.yellow('\nSubtask update was not completed. Review the messages above for details.'));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        
        // Provide more helpful error messages for common issues
        if (error.message.includes('subtask') && error.message.includes('not found')) {
          console.log(chalk.yellow('\nTo fix this issue:'));
          console.log('  1. Run task-master list --with-subtasks to see all available subtask IDs');
          console.log('  2. Use a valid subtask ID with the --id parameter in format "parentId.subtaskId"');
        } else if (error.message.includes('API key')) {
          console.log(chalk.yellow('\nThis error is related to API keys. Check your environment variables.'));
        }
        
        if (CONFIG.debug) {
          console.error(error);
        }
        
        process.exit(1);
      }
    });

  // generate command
  programInstance
    .command('generate')
    .description('Generate task files from tasks.json')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-o, --output <dir>', 'Output directory', 'tasks')
    .action(async (options) => {
      const tasksPath = options.file;
      const outputDir = options.output;
      
      console.log(chalk.blue(`Generating task files from: ${tasksPath}`));
      console.log(chalk.blue(`Output directory: ${outputDir}`));
      
      await generateTaskFiles(tasksPath, outputDir);
    });

  // set-status command
  programInstance
    .command('set-status')
    .description('Set the status of a task')
    .option('-i, --id <id>', 'Task ID (can be comma-separated for multiple tasks)')
    .option('-s, --status <status>', 'New status (todo, in-progress, review, done)')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      const tasksPath = options.file;
      const taskId = options.id;
      const status = options.status;
      
      if (!taskId || !status) {
        console.error(chalk.red('Error: Both --id and --status are required'));
        process.exit(1);
      }
      
      console.log(chalk.blue(`Setting status of task(s) ${taskId} to: ${status}`));
      
      await setTaskStatus(tasksPath, taskId, status);
    });

  // list command
  programInstance
    .command('list')
    .description('List all tasks')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-s, --status <status>', 'Filter by status')
    .option('--with-subtasks', 'Show subtasks for each task')
    .action(async (options) => {
      const tasksPath = options.file;
      const statusFilter = options.status;
      const withSubtasks = options.withSubtasks || false;
      
      console.log(chalk.blue(`Listing tasks from: ${tasksPath}`));
      if (statusFilter) {
        console.log(chalk.blue(`Filtering by status: ${statusFilter}`));
      }
      if (withSubtasks) {
        console.log(chalk.blue('Including subtasks in listing'));
      }
      
      await listTasks(tasksPath, statusFilter, withSubtasks);
    });

  // expand command
  programInstance
    .command('expand')
    .description('Break down tasks into detailed subtasks')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <id>', 'Task ID to expand')
    .option('-a, --all', 'Expand all tasks')
    .option('-n, --num <number>', 'Number of subtasks to generate', CONFIG.defaultSubtasks.toString())
    .option('--research', 'Enable Perplexity AI for research-backed subtask generation')
    .option('-p, --prompt <text>', 'Additional context to guide subtask generation')
    .option('--force', 'Force regeneration of subtasks for tasks that already have them')
    .action(async (options) => {
      const tasksPath = options.file;
      const idArg = options.id ? parseInt(options.id, 10) : null;
      const allFlag = options.all;
      const numSubtasks = parseInt(options.num, 10);
      const forceFlag = options.force;
      const useResearch = options.research === true;
      const additionalContext = options.prompt || '';
      
      // Debug log to verify the value
      log('debug', `Research enabled: ${useResearch}`);
      
      if (allFlag) {
        console.log(chalk.blue(`Expanding all tasks with ${numSubtasks} subtasks each...`));
        if (useResearch) {
          console.log(chalk.blue('Using Perplexity AI for research-backed subtask generation'));
        } else {
          console.log(chalk.yellow('Research-backed subtask generation disabled'));
        }
        if (additionalContext) {
          console.log(chalk.blue(`Additional context: "${additionalContext}"`));
        }
        await expandAllTasks(numSubtasks, useResearch, additionalContext, forceFlag);
      } else if (idArg) {
        console.log(chalk.blue(`Expanding task ${idArg} with ${numSubtasks} subtasks...`));
        if (useResearch) {
          console.log(chalk.blue('Using Perplexity AI for research-backed subtask generation'));
        } else {
          console.log(chalk.yellow('Research-backed subtask generation disabled'));
        }
        if (additionalContext) {
          console.log(chalk.blue(`Additional context: "${additionalContext}"`));
        }
        await expandTask(idArg, numSubtasks, useResearch, additionalContext);
      } else {
        console.error(chalk.red('Error: Please specify a task ID with --id=<id> or use --all to expand all tasks.'));
      }
    });

  // analyze-complexity command
  programInstance
    .command('analyze-complexity')
    .description(`Analyze tasks and generate expansion recommendations${chalk.reset('')}`)
    .option('-o, --output <file>', 'Output file path for the report', 'scripts/task-complexity-report.json')
    .option('-m, --model <model>', 'LLM model to use for analysis (defaults to configured model)')
    .option('-t, --threshold <number>', 'Minimum complexity score to recommend expansion (1-10)', '5')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-r, --research', 'Use Perplexity AI for research-backed complexity analysis')
    .action(async (options) => {
      const tasksPath = options.file || 'tasks/tasks.json';
      const outputPath = options.output;
      const modelOverride = options.model;
      const thresholdScore = parseFloat(options.threshold);
      const useResearch = options.research || false;
      
      console.log(chalk.blue(`Analyzing task complexity from: ${tasksPath}`));
      console.log(chalk.blue(`Output report will be saved to: ${outputPath}`));
      
      if (useResearch) {
        console.log(chalk.blue('Using Perplexity AI for research-backed complexity analysis'));
      }
      
      await analyzeTaskComplexity(options);
    });

  // clear-subtasks command
  programInstance
    .command('clear-subtasks')
    .description('Clear subtasks from specified tasks')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <ids>', 'Task IDs (comma-separated) to clear subtasks from')
    .option('--all', 'Clear subtasks from all tasks')
    .action(async (options) => {
      const tasksPath = options.file;
      const taskIds = options.id;
      const all = options.all;

      if (!taskIds && !all) {
        console.error(chalk.red('Error: Please specify task IDs with --id=<ids> or use --all to clear all tasks'));
        process.exit(1);
      }

      if (all) {
        // If --all is specified, get all task IDs
        const data = readJSON(tasksPath);
        if (!data || !data.tasks) {
          console.error(chalk.red('Error: No valid tasks found'));
          process.exit(1);
        }
        const allIds = data.tasks.map(t => t.id).join(',');
        clearSubtasks(tasksPath, allIds);
      } else {
        clearSubtasks(tasksPath, taskIds);
      }
    });

  // add-task command
  programInstance
    .command('add-task')
    .description('Add a new task using AI')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-p, --prompt <text>', 'Description of the task to add (required)')
    .option('-t, --title <title>', 'Title for the new task (overrides AI generation)')
    .option('-d, --dependencies <ids>', 'Comma-separated list of task IDs this task depends on')
    .option('--priority <priority>', 'Task priority (high, medium, low)', 'medium')
    .action(async (options) => {
      // --- BEGIN ADDED LOGGING ---
      console.log('--- DEBUG: Entering add-task command action ---');
      console.log('--- DEBUG: Options received: ---');
      console.log(JSON.stringify(options, null, 2));
      console.log('--- END DEBUG ---');
      // --- END ADDED LOGGING ---

      const tasksPath = options.file;
      const prompt = options.prompt;
      const titleOverride = options.title;
      const dependencies = options.dependencies ? options.dependencies.split(',').map(id => parseInt(id.trim(), 10)) : [];
      const priority = options.priority;
      
      if (!prompt && !titleOverride) {
        console.error(chalk.red('Error: Either --prompt or --title parameter is required.'));
        process.exit(1);
      }
      
      const taskDescription = titleOverride || prompt;

      console.log(chalk.blue(`Adding new task: "${taskDescription}"`));
      console.log(chalk.blue(`Dependencies: ${dependencies.length > 0 ? dependencies.join(', ') : 'None'}`));
      console.log(chalk.blue(`Priority: ${priority}`));
      
      await addTask(tasksPath, prompt, dependencies, priority, titleOverride);
    });

  // next command
  programInstance
    .command('next')
    .description(`Show the next task to work on based on dependencies and status${chalk.reset('')}`)
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      const tasksPath = options.file;
      await displayNextTask(tasksPath);
    });

  // show command
  programInstance
    .command('show')
    .description(`Display detailed information about a specific task${chalk.reset('')}`)
    .argument('[id]', 'Task ID to show')
    .option('-i, --id <id>', 'Task ID to show')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (taskId, options) => {
      const idArg = taskId || options.id;
      
      if (!idArg) {
        console.error(chalk.red('Error: Please provide a task ID'));
        process.exit(1);
      }
      
      const tasksPath = options.file;
      await displayTaskById(tasksPath, idArg);
    });

  // add-dependency command
  programInstance
    .command('add-dependency')
    .description('Add a dependency to a task')
    .option('-i, --id <id>', 'Task ID to add dependency to')
    .option('-d, --depends-on <id>', 'Task ID that will become a dependency')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      const tasksPath = options.file;
      const taskId = options.id;
      const dependencyId = options.dependsOn;
      
      if (!taskId || !dependencyId) {
        console.error(chalk.red('Error: Both --id and --depends-on are required'));
        process.exit(1);
      }
      
      // Handle subtask IDs correctly by preserving the string format for IDs containing dots
      // Only use parseInt for simple numeric IDs
      const formattedTaskId = taskId.includes('.') ? taskId : parseInt(taskId, 10);
      const formattedDependencyId = dependencyId.includes('.') ? dependencyId : parseInt(dependencyId, 10);
      
      await addDependency(tasksPath, formattedTaskId, formattedDependencyId);
    });

  // remove-dependency command
  programInstance
    .command('remove-dependency')
    .description('Remove a dependency from a task')
    .option('-i, --id <id>', 'Task ID to remove dependency from')
    .option('-d, --depends-on <id>', 'Task ID to remove as a dependency')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      const tasksPath = options.file;
      const taskId = options.id;
      const dependencyId = options.dependsOn;
      
      if (!taskId || !dependencyId) {
        console.error(chalk.red('Error: Both --id and --depends-on are required'));
        process.exit(1);
      }
      
      // Handle subtask IDs correctly by preserving the string format for IDs containing dots
      // Only use parseInt for simple numeric IDs
      const formattedTaskId = taskId.includes('.') ? taskId : parseInt(taskId, 10);
      const formattedDependencyId = dependencyId.includes('.') ? dependencyId : parseInt(dependencyId, 10);
      
      await removeDependency(tasksPath, formattedTaskId, formattedDependencyId);
    });

  // validate-dependencies command
  programInstance
    .command('validate-dependencies')
    .description(`Identify invalid dependencies without fixing them${chalk.reset('')}`)
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      await validateDependenciesCommand(options.file);
    });

  // fix-dependencies command
  programInstance
    .command('fix-dependencies')
    .description(`Fix invalid dependencies automatically${chalk.reset('')}`)
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      await fixDependenciesCommand(options.file);
    });

  // complexity-report command
  programInstance
    .command('complexity-report')
    .description(`Display the complexity analysis report${chalk.reset('')}`)
    .option('-f, --file <file>', 'Path to the report file', 'scripts/task-complexity-report.json')
    .action(async (options) => {
      await displayComplexityReport(options.file);
    });

  // add-subtask command
  programInstance
    .command('add-subtask')
    .description('Add a subtask to an existing task')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-p, --parent <id>', 'Parent task ID (required)')
    .option('-i, --task-id <id>', 'Existing task ID to convert to subtask')
    .option('-t, --title <title>', 'Title for the new subtask (when creating a new subtask)')
    .option('-d, --description <text>', 'Description for the new subtask')
    .option('--details <text>', 'Implementation details for the new subtask')
    .option('--dependencies <ids>', 'Comma-separated list of dependency IDs for the new subtask')
    .option('-s, --status <status>', 'Status for the new subtask', 'pending')
    .option('--skip-generate', 'Skip regenerating task files')
    .action(async (options) => {
      const tasksPath = options.file;
      const parentId = options.parent;
      const existingTaskId = options.taskId;
      const generateFiles = !options.skipGenerate;
      
      if (!parentId) {
        console.error(chalk.red('Error: --parent parameter is required. Please provide a parent task ID.'));
        showAddSubtaskHelp();
        process.exit(1);
      }
      
      // Parse dependencies if provided
      let dependencies = [];
      if (options.dependencies) {
        dependencies = options.dependencies.split(',').map(id => {
          // Handle both regular IDs and dot notation
          return id.includes('.') ? id.trim() : parseInt(id.trim(), 10);
        });
      }
      
      try {
        if (existingTaskId) {
          // Convert existing task to subtask
          console.log(chalk.blue(`Converting task ${existingTaskId} to a subtask of ${parentId}...`));
          await addSubtask(tasksPath, parentId, existingTaskId, null, generateFiles);
          console.log(chalk.green(`✓ Task ${existingTaskId} successfully converted to a subtask of task ${parentId}`));
        } else if (options.title) {
          // Create new subtask with provided data
          console.log(chalk.blue(`Creating new subtask for parent task ${parentId}...`));
          
          const newSubtaskData = {
            title: options.title,
            description: options.description || '',
            details: options.details || '',
            status: options.status || 'pending',
            dependencies: dependencies
          };
          
          const subtask = await addSubtask(tasksPath, parentId, null, newSubtaskData, generateFiles);
          console.log(chalk.green(`✓ New subtask ${parentId}.${subtask.id} successfully created`));
          
          // Display success message and suggested next steps
          console.log(boxen(
            chalk.white.bold(`Subtask ${parentId}.${subtask.id} Added Successfully`) + '\n\n' +
            chalk.white(`Title: ${subtask.title}`) + '\n' +
            chalk.white(`Status: ${getStatusWithColor(subtask.status)}`) + '\n' +
            (dependencies.length > 0 ? chalk.white(`Dependencies: ${dependencies.join(', ')}`) + '\n' : '') +
            '\n' +
            chalk.white.bold('Next Steps:') + '\n' +
            chalk.cyan(`1. Run ${chalk.yellow(`task-master show ${parentId}`)} to see the parent task with all subtasks`) + '\n' +
            chalk.cyan(`2. Run ${chalk.yellow(`task-master set-status --id=${parentId}.${subtask.id} --status=in-progress`)} to start working on it`),
            { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
          ));
        } else {
          console.error(chalk.red('Error: Either --task-id or --title must be provided.'));
          console.log(boxen(
            chalk.white.bold('Usage Examples:') + '\n\n' +
            chalk.white('Convert existing task to subtask:') + '\n' +
            chalk.yellow(`  task-master add-subtask --parent=5 --task-id=8`) + '\n\n' +
            chalk.white('Create new subtask:') + '\n' +
            chalk.yellow(`  task-master add-subtask --parent=5 --title="Implement login UI" --description="Create the login form"`) + '\n\n',
            { padding: 1, borderColor: 'blue', borderStyle: 'round' }
          ));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    })
    .on('error', function(err) {
      console.error(chalk.red(`Error: ${err.message}`));
      showAddSubtaskHelp();
      process.exit(1);
    });

  // Helper function to show add-subtask command help
  function showAddSubtaskHelp() {
    console.log(boxen(
      chalk.white.bold('Add Subtask Command Help') + '\n\n' +
      chalk.cyan('Usage:') + '\n' +
      `  task-master add-subtask --parent=<id> [options]\n\n` +
      chalk.cyan('Options:') + '\n' +
      '  -p, --parent <id>         Parent task ID (required)\n' +
      '  -i, --task-id <id>        Existing task ID to convert to subtask\n' +
      '  -t, --title <title>       Title for the new subtask\n' +
      '  -d, --description <text>  Description for the new subtask\n' +
      '  --details <text>          Implementation details for the new subtask\n' +
      '  --dependencies <ids>      Comma-separated list of dependency IDs\n' +
      '  -s, --status <status>     Status for the new subtask (default: "pending")\n' +
      '  -f, --file <file>         Path to the tasks file (default: "tasks/tasks.json")\n' +
      '  --skip-generate           Skip regenerating task files\n\n' +
      chalk.cyan('Examples:') + '\n' +
      '  task-master add-subtask --parent=5 --task-id=8\n' +
      '  task-master add-subtask -p 5 -t "Implement login UI" -d "Create the login form"',
      { padding: 1, borderColor: 'blue', borderStyle: 'round' }
    ));
  }

  // remove-subtask command
  programInstance
    .command('remove-subtask')
    .description('Remove a subtask from its parent task')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <id>', 'Subtask ID(s) to remove in format "parentId.subtaskId" (can be comma-separated for multiple subtasks)')
    .option('-c, --convert', 'Convert the subtask to a standalone task instead of deleting it')
    .option('--skip-generate', 'Skip regenerating task files')
    .action(async (options) => {
      const tasksPath = options.file;
      const subtaskIds = options.id;
      const convertToTask = options.convert || false;
      const generateFiles = !options.skipGenerate;
      
      if (!subtaskIds) {
        console.error(chalk.red('Error: --id parameter is required. Please provide subtask ID(s) in format "parentId.subtaskId".'));
        showRemoveSubtaskHelp();
        process.exit(1);
      }
      
      try {
        // Split by comma to support multiple subtask IDs
        const subtaskIdArray = subtaskIds.split(',').map(id => id.trim());
        
        for (const subtaskId of subtaskIdArray) {
          // Validate subtask ID format
          if (!subtaskId.includes('.')) {
            console.error(chalk.red(`Error: Subtask ID "${subtaskId}" must be in format "parentId.subtaskId"`));
            showRemoveSubtaskHelp();
            process.exit(1);
          }
          
          console.log(chalk.blue(`Removing subtask ${subtaskId}...`));
          if (convertToTask) {
            console.log(chalk.blue('The subtask will be converted to a standalone task'));
          }
          
          const result = await removeSubtask(tasksPath, subtaskId, convertToTask, generateFiles);
          
          if (convertToTask && result) {
            // Display success message and next steps for converted task
            console.log(boxen(
              chalk.white.bold(`Subtask ${subtaskId} Converted to Task #${result.id}`) + '\n\n' +
              chalk.white(`Title: ${result.title}`) + '\n' +
              chalk.white(`Status: ${getStatusWithColor(result.status)}`) + '\n' +
              chalk.white(`Dependencies: ${result.dependencies.join(', ')}`) + '\n\n' +
              chalk.white.bold('Next Steps:') + '\n' +
              chalk.cyan(`1. Run ${chalk.yellow(`task-master show ${result.id}`)} to see details of the new task`) + '\n' +
              chalk.cyan(`2. Run ${chalk.yellow(`task-master set-status --id=${result.id} --status=in-progress`)} to start working on it`),
              { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
            ));
          } else {
            // Display success message for deleted subtask
            console.log(boxen(
              chalk.white.bold(`Subtask ${subtaskId} Removed`) + '\n\n' +
              chalk.white('The subtask has been successfully deleted.'),
              { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
            ));
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        showRemoveSubtaskHelp();
        process.exit(1);
      }
    })
    .on('error', function(err) {
      console.error(chalk.red(`Error: ${err.message}`));
      showRemoveSubtaskHelp();
      process.exit(1);
    });
    
  // Helper function to show remove-subtask command help
  function showRemoveSubtaskHelp() {
    console.log(boxen(
      chalk.white.bold('Remove Subtask Command Help') + '\n\n' +
      chalk.cyan('Usage:') + '\n' +
      `  task-master remove-subtask --id=<parentId.subtaskId> [options]\n\n` +
      chalk.cyan('Options:') + '\n' +
      '  -i, --id <id>       Subtask ID(s) to remove in format "parentId.subtaskId" (can be comma-separated, required)\n' +
      '  -c, --convert       Convert the subtask to a standalone task instead of deleting it\n' +
      '  -f, --file <file>   Path to the tasks file (default: "tasks/tasks.json")\n' +
      '  --skip-generate     Skip regenerating task files\n\n' +
      chalk.cyan('Examples:') + '\n' +
      '  task-master remove-subtask --id=5.2\n' +
      '  task-master remove-subtask --id=5.2,6.3,7.1\n' +
      '  task-master remove-subtask --id=5.2 --convert',
      { padding: 1, borderColor: 'blue', borderStyle: 'round' }
    ));
  }

  // init command (documentation only, implementation is in init.js)
  programInstance
    .command('init')
    .description('Initialize a new project with Task Master structure')
    .option('-n, --name <name>', 'Project name')
    .option('-my_name <name>', 'Project name (alias for --name)')
    .option('--my_name <name>', 'Project name (alias for --name)')
    .option('-d, --description <description>', 'Project description')
    .option('-my_description <description>', 'Project description (alias for --description)')
    .option('-v, --version <version>', 'Project version')
    .option('-my_version <version>', 'Project version (alias for --version)')
    .option('-a, --author <author>', 'Author name')
    .option('-y, --yes', 'Skip prompts and use default values')
    .option('--skip-install', 'Skip installing dependencies')
    .action(() => {
      console.log(chalk.yellow('The init command must be run as a standalone command: task-master init'));
      console.log(chalk.cyan('Example usage:'));
      console.log(chalk.white('  task-master init -n "My Project" -d "Project description"'));
      console.log(chalk.white('  task-master init -my_name "My Project" -my_description "Project description"'));
      console.log(chalk.white('  task-master init -y'));
      process.exit(0);
    });
    
  // ideate command (Implement original ChatPRD flow)
  programInstance
    .command('ideate')
    .description('Turn a raw idea into a structured product concept using AI [Original ChatPRD flow]')
    .option('-i, --idea <text>', 'Initial product/feature idea (required for non-interactive)')
    .option('-o, --output <file>', 'Output file for the concept', 'prd/concept.txt') // Default output path
    .action(async (options) => {
      const spinner = ora('Initializing ideation service...').start();
      try {
        // --- BEGIN IMPLEMENTATION --- 
        let ideaInput = options.idea;
        if (!ideaInput) {
          spinner.stop();
          // Interactive prompt if --idea is not provided
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'idea',
              message: 'Enter the initial product idea or problem statement:',
              validate: (input) => input.trim() !== '' || 'Please enter an idea.',
            },
          ]);
          ideaInput = answers.idea;
          spinner.start();
        }

        const outputFile = path.resolve(options.output); // Initial output path
        const outputDir = path.dirname(outputFile);
        let finalOutputFile = outputFile; // Path to use for saving

        // --- NEW: Check if output file exists ---
        if (fs.existsSync(outputFile)) {
            spinner.stop();
            const overwriteAnswer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: `Output concept file already exists: ${outputFile}. What would you like to do?`,
                    choices: [
                        { name: 'Overwrite the existing file', value: 'overwrite' },
                        { name: 'Create a new file (timestamped name)', value: 'new' },
                        { name: 'Cancel operation', value: 'cancel' }
                    ],
                    default: 'new'
                }
            ]);

            if (overwriteAnswer.action === 'cancel') {
                console.log(chalk.yellow('Operation cancelled by user.'));
                process.exit(0);
            } else if (overwriteAnswer.action === 'new') {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const parsedPath = path.parse(outputFile);
                finalOutputFile = path.join(parsedPath.dir, `${parsedPath.name}-${timestamp}${parsedPath.ext}`);
                console.log(chalk.blue(`Will save concept to new file: ${finalOutputFile}`));
            } else {
                // Action is 'overwrite', finalOutputFile remains the original path
                console.log(chalk.yellow(`Existing file ${outputFile} will be overwritten.`));
            }
            spinner.start();
        }
        // --- END: Check if output file exists ---

        spinner.text = 'Generating product concept...';

        // Ensure output directory exists (using the directory of the final path)
        const finalOutputDir = path.dirname(finalOutputFile);
        if (!fs.existsSync(finalOutputDir)) {
          fs.mkdirSync(finalOutputDir, { recursive: true });
          log('info', `Created output directory: ${finalOutputDir}`)
        }

        // Initialize service
        const ideationService = new IdeationService(); 
        
        // Generate the concept
        const productConcept = await ideationService.generateConcept(ideaInput); 

        // Basic check for generated content
        if (productConcept && productConcept.content) {
          fs.writeFileSync(finalOutputFile, productConcept.content);
          spinner.succeed(chalk.green(`Product concept generated successfully!`));
          console.log(chalk.cyan(`Concept saved to: ${finalOutputFile}`));
          
          // --- Offer interactive round-table --- (Using Helpers)
          const roundTableAnswer = await inquirer.prompt([
              {
                  type: 'confirm',
                  name: 'runRoundTable',
                  message: `Concept saved. Run the round-table discussion now using this concept?`,
                  default: true
              }
          ]);
          
          let discussionFilePath = null;
          let refinedConceptPath = null;
          let prdFilePath = null; // To capture potential further steps
          let conceptFilePathUsed = finalOutputFile; // Concept used for round-table

          if (roundTableAnswer.runRoundTable) {
              console.log(chalk.blue('\nInitiating round-table...'));
              try {
                  // Get round-table options interactively, using the new concept as default
                  const roundTableOptions = {
                      conceptFile: conceptFilePathUsed,
                      output: 'prd/discussion.txt',
                      participants: ['Product Manager', 'Lead Engineer', 'UX Designer'],
                      topics: [],
                      focusTopics: false
                  };
                  
                  // Get round-table options interactively
                  const resolvedRoundTableOptions = await getRoundTableOptionsInteractively(roundTableOptions, conceptFilePathUsed);
                  const roundTableResult = await runRoundTableProcess(resolvedRoundTableOptions);
                  discussionFilePath = roundTableResult.discussionFilePath;
                  conceptFilePathUsed = roundTableResult.conceptFilePath;
                
                  
                  // Offer interactive refinement if discussion was generated
                  if (discussionFilePath) {
                      // Replace placeholder with actual prompt
                      const refineAnswer = await inquirer.prompt([
                          {
                              type: 'confirm',
                              name: 'refineNow',
                              message: `Discussion saved to ${discussionFilePath}. Refine concept (${path.basename(conceptFilePathUsed)}) now?`,
                              default: true
                          }
                      ]);
                      if (refineAnswer.refineNow) {
                          // Replace placeholder with actual prompt
                          const promptAnswer = await inquirer.prompt([
                               {
                                  type: 'input',
                                  name: 'customPrompt',
                                  message: 'Optional custom prompt for refinement:',
                                  default: ''
                              }
                          ]);
                          refinedConceptPath = await runRefinementProcess(
                              conceptFilePathUsed, 
                              discussionFilePath, 
                              promptAnswer.customPrompt.trim() || null,
                              null 
                          );
                          
                          // Offer interactive PRD generation if refinement was done
                          if (refinedConceptPath) {
                              // Replace placeholder with actual prompt
                              const generatePrdAnswer = await inquirer.prompt([
                                   {
                                      type: 'confirm',
                                      name: 'generateNow',
                                      message: `Refined concept saved to ${refinedConceptPath}. Generate PRD now?`,
                                      default: true
                                  }
                              ]);
                              if (generatePrdAnswer.generateNow) {
                                  const initialPrdOptions = { conceptFile: refinedConceptPath };
                                  const resolvedPrdOptions = await getGeneratePRDOptionsInteractively(initialPrdOptions, refinedConceptPath);
                                  prdFilePath = await runGeneratePRDProcess(resolvedPrdOptions);
                              }
                          }
                      }
                  }
              } catch (roundTableError) {
                 // Handle errors from the interactive round-table flow specifically
                 console.error(chalk.red('\nRound-table process failed during interactive execution.'));
                 errorHandler.handle(roundTableError);
                 // Decide if we should still show next steps based on the initial concept
              }
          } 
          // --- End Offer --- // Note: next steps are now handled AFTER this block

        } else {
          console.error(chalk.red('Failed to generate concept content.'));
          console.error(chalk.red('Error: The AI response did not contain the expected concept content.'));
          log('error', 'Received object from IdeationService:', JSON.stringify(productConcept, null, 2)); 
        }
        // --- END IMPLEMENTATION ---
      } catch (error) {
        console.error(chalk.red('Ideation command failed.'));
        errorHandler.handle(error); 
        if (CONFIG.debug) {
          console.error('Ideate Command Error Stack:', error);
        }
        process.exit(1);
      }
      
      // --- Display Final Next Steps (After Ideate and potential Round-Table/Refine/PRD) ---
      console.log(chalk.white.bold('\nNext Steps:'));
      if (prdFilePath) {
           console.log(chalk.cyan(`1. Review the generated PRD in ${prdFilePath}`));
           console.log(chalk.cyan(`2. Run 'task-master parse-prd --input="${path.relative(process.cwd(), prdFilePath)}"' to generate tasks.`));
      } else if (refinedConceptPath) {
            console.log(chalk.cyan(`1. Review the refined concept in ${refinedConceptPath}`));
            console.log(chalk.cyan(`2. Run 'task-master generate-prd --concept-file="${path.relative(process.cwd(), refinedConceptPath)}"' manually to generate the PRD.`));
      } else if (discussionFilePath) {
           console.log(chalk.cyan(`1. Review the discussion transcript in ${discussionFilePath}`));
           console.log(chalk.cyan(`2. Run 'task-master refine-concept --concept-file="${path.relative(process.cwd(), conceptFilePathUsed)}" --discussion-file="${path.relative(process.cwd(), discussionFilePath)}"' manually to refine the concept.`)); 
      } else if (finalOutputFile) { // If only ideate completed
           console.log(chalk.cyan(`1. Review the generated concept in ${finalOutputFile}`));
           console.log(chalk.cyan(`2. Run 'task-master round-table --concept-file="${path.relative(process.cwd(), finalOutputFile)}"' manually to simulate discussion.`));
      } else {
           console.log(chalk.yellow('Operation cancelled or failed. No output generated.'));
      }
      // --- End Final Next Steps ---
    });

  // refine-concept command
  programInstance
    .command('refine-concept')
    .description('Refine a product concept based on discussion or prompts')
    .option('-c, --concept-file <file>', 'Path to the concept file to refine (required)')
    .option('-d, --discussion-file <file>', 'Path to discussion.txt to use for refinement')
    .option('-p, --prompt <text>', 'Custom prompt for refinement (e.g., \"Focus on scalability\")')
    .option('-o, --output <file>', 'Output file for the refined concept (defaults to <concept_file>_refined.txt)')
    .action(async (options) => {
        const commandSpinner = ora('Initiating concept refinement command...').start();
        let refinedFilePath = null; 
        try {
            // --- Define Helper Functions for Interactive Prompts ---
            async function promptForConceptFile(currentPath) {
                if (currentPath) return currentPath;
                const answer = await inquirer.prompt([
                    { type: 'input', name: 'conceptFile', message: 'Enter the path to the concept file to refine:', default: 'prd/concept.txt', validate: input => fs.existsSync(path.resolve(input)) || 'File not found.' }
                ]);
                return answer.conceptFile;
            }

            async function promptForRefinementSource(currentDiscussionPath, currentCustomPrompt) {
                if (currentDiscussionPath || currentCustomPrompt) return { discussionFile: currentDiscussionPath, customPrompt: currentCustomPrompt };
                
                const sourceAnswer = await inquirer.prompt([
                    { type: 'list', name: 'sourceType', message: 'How do you want to refine?', choices: ['Use discussion file', 'Use custom prompt', 'Use both'], default: 'Use discussion file'}
                ]);
                
                let discussionFile = null;
                let customPrompt = null;

                if (sourceAnswer.sourceType === 'Use discussion file' || sourceAnswer.sourceType === 'Use both') {
                    const answer = await inquirer.prompt([
                         { type: 'input', name: 'discussionFile', message: 'Path to discussion file:', default: 'prd/discussion.txt', validate: input => fs.existsSync(path.resolve(input)) || 'File not found.' }
                    ]);
                    discussionFile = answer.discussionFile;
                }
                if (sourceAnswer.sourceType === 'Use custom prompt' || sourceAnswer.sourceType === 'Use both') {
                     const answer = await inquirer.prompt([ { type: 'input', name: 'customPrompt', message: 'Custom refinement prompt:'} ]);
                     customPrompt = answer.customPrompt.trim() || null;
                }
                if (!discussionFile && !customPrompt) throw new Error('Refinement requires a source.');
                return { discussionFile, customPrompt };
            }

            async function promptForOutputPath(currentOutputPath, calculatedDefault) {
                if (currentOutputPath) return currentOutputPath;
                const answer = await inquirer.prompt([
                    { type: 'input', name: 'outputPath', message: `Output path (default: ${calculatedDefault}):`, default: calculatedDefault }
                ]);
                return answer.outputPath || calculatedDefault;
            }
            // --- End Helper Functions ---
            
            commandSpinner.stop(); // Stop for prompts

            // --- Use Helpers for Interactive Prompts --- 
            let conceptFilePathInput = await promptForConceptFile(options.conceptFile);
            const conceptFilePath = path.resolve(conceptFilePathInput);
            if (!fs.existsSync(conceptFilePath)) throw new Error(`Concept file not found: ${conceptFilePath}`);

            const source = await promptForRefinementSource(options.discussionFile, options.prompt);
            let discussionFilePathInput = source.discussionFile;
            let customPromptInput = source.customPrompt;
            const discussionFilePath = discussionFilePathInput ? path.resolve(discussionFilePathInput) : null;
            const customPrompt = customPromptInput || null;
            if (discussionFilePath && !fs.existsSync(discussionFilePath)) throw new Error(`Discussion file not found: ${discussionFilePath}`);

            const parsedPath = path.parse(conceptFilePath);
            const defaultOutputPath = path.join(parsedPath.dir, `${parsedPath.name}_refined${parsedPath.ext}`);
            let specificOutputFilePath = await promptForOutputPath(options.output, defaultOutputPath);
            specificOutputFilePath = path.resolve(specificOutputFilePath);
            // --- End Using Helpers ---
            
            commandSpinner.start(); // Resume spinner before processing

            // --- Call the Refinement Helper Function ---
            commandSpinner.text = 'Running refinement process...';
            refinedFilePath = await runRefinementProcess(
                conceptFilePath, 
                discussionFilePath, 
                customPrompt,
                specificOutputFilePath // Use the final resolved output path
            );
            
            commandSpinner.succeed(chalk.green('Refine-concept command completed.'));

            // --- Offer interactive PRD Generation --- (Keep existing logic)
            let prdFilePath = null;
            const generatePrdAnswer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'generateNow',
                    message: `Refined concept saved to ${refinedFilePath}. Generate the PRD now using this file?`,
                    default: true
                }
            ]);
            if (generatePrdAnswer.generateNow) {
                const initialPrdOptions = { conceptFile: refinedFilePath };
                const resolvedPrdOptions = await getGeneratePRDOptionsInteractively(initialPrdOptions, refinedFilePath);
                prdFilePath = await runGeneratePRDProcess(resolvedPrdOptions);
            }
            // --- End Offer ---

        } catch (error) {
             // Catch errors from validation or the helper function
             if(commandSpinner.isSpinning) commandSpinner.fail(chalk.red('Refine Concept command failed.'));
             else console.error(chalk.red('Refine Concept command failed.'));
             console.error(chalk.red(`Error details: ${error.message}`)); 
             if (CONFIG.debug && error.stack) {
               console.error('Refine Concept Command Error Stack:', error.stack);
             }
             process.exit(1);
        }
        
        // --- Display Next Steps (Adjusted) --- 
        console.log(chalk.white.bold('\nNext Steps:'));
        if (prdFilePath) { // If PRD was generated
            console.log(chalk.cyan(`1. Review the generated PRD in ${prdFilePath}`));
            console.log(chalk.cyan(`2. Run 'task-master parse-prd --input="${path.relative(process.cwd(), prdFilePath)}"' to generate tasks.`));
        } else if (refinedFilePath) { // If refinement happened but PRD was skipped
            console.log(chalk.cyan(`1. Review the refined concept in ${refinedFilePath}`));
            console.log(chalk.cyan(`2. Run 'task-master generate-prd --concept-file="${path.relative(process.cwd(), refinedFilePath)}"' manually to generate the PRD.`)); 
        } else {
            log('warn', 'Refined file path was not set. Cannot display next steps accurately.');
        }
    });

  // generate-prd command
  programInstance
    .command('generate-prd')
    .description('Generate a full PRD from the refined concept')
    .option('-c, --concept-file <file>', 'Path to the concept file (e.g., concept_refined.txt)')
    .option('-t, --template <file>', 'Path to an optional PRD template file (replaces --example-prd)')
    .option('-r, --research', 'Enable research-backed generation (e.g., using Perplexity)')
    .option('-o, --output <file>', 'Output file path for the PRD', 'prd/prd.txt')
    .option('--format <format>', 'Output format (markdown [.md], plaintext [.txt])', 'markdown') // Updated choices and descriptions
    .option('--style <style>', 'Detail level (minimal, standard, detailed)', 'standard')
    .option('--sections <list>', 'Comma-separated list of sections to include (defaults to standard sections)')
    .option('--preview', 'Show a preview before generating the full document')
    .option('-y, --yes', 'Skip preview confirmation if --preview is used')
    .action(async (options) => {
        // Use a simple outer spinner for the command setup phase
        const setupSpinner = ora('Initiating generate-prd command...').start();
        try {
            // 1. Get all options, interactively if needed
            setupSpinner.stop(); // Stop spinner during prompts
            // Suggest the refined concept as default if it exists
            const defaultConcept = fs.existsSync('prd/concept_refined.txt') ? 'prd/concept_refined.txt' : 'prd/concept.txt'; 
            const resolvedOptions = await getGeneratePRDOptionsInteractively(options, defaultConcept);
            setupSpinner.start(); // Restart spinner briefly
            setupSpinner.succeed('Options confirmed.');

            // 2. Run the generation process using the resolved options
            const prdFilePath = await runGeneratePRDProcess(resolvedOptions);

            // 3. Display final next steps if successful
            if (prdFilePath) {
                 console.log(chalk.white.bold('\nNext Steps:'));
                 console.log(chalk.cyan(`1. Review the generated PRD in ${prdFilePath}`));
                 console.log(chalk.cyan(`2. Run 'task-master parse-prd --input="${path.relative(process.cwd(), prdFilePath)}"' to generate tasks.`));
            }
            // If cancelled during preview, runGeneratePRDProcess returns null and logs message.

        } catch (error) {
             if(setupSpinner.isSpinning) setupSpinner.fail();
             // Error is logged within the helper or by the main catch
             console.error(chalk.red('Generate PRD command failed overall.'));
             // Optional: Log error message again if needed, but helpers should log specifics
             // console.error(chalk.red(`Error details: ${error.message}`)); 
             // errorHandler.handle(error); // Helpers might call this already
             if (CONFIG.debug && error.stack) {
               console.error('Generate PRD Command Top Level Error Stack:', error.stack);
             }
             process.exit(1);
        }
    });
  
  // round-table command (Refactored to use helpers)
  programInstance
    .command('round-table')
    .description('Simulate expert discussion and optionally refine concept') 
    .option('-c, --concept-file <file>', 'Path to the concept file', 'prd/concept.txt')
    .option('-o, --output <file>', 'Output file for the discussion transcript', 'prd/discussion.txt')
    .option('-p, --participants <list>', 'Comma-separated list of expert roles')
    .option('--topics <list>', 'Comma-separated list of specific topics to discuss')
    .option('--focus-topics', 'Make the discussion primarily focus on the provided topics')
    .action(async (options) => {
        const setupSpinner = ora('Initiating round-table command...').start();
        let discussionFilePath = null;
        let conceptFilePathUsed = null;
        let refinedConceptPath = null;
        let prdFilePath = null;

        try {
            // 1. Get options, interactively if needed
            setupSpinner.stop();
            const defaultConcept = options.conceptFile || 'prd/concept.txt';
            const resolvedRoundTableOptions = await getRoundTableOptionsInteractively(options, defaultConcept);
            setupSpinner.start();
            setupSpinner.succeed('Options confirmed.');

            // 2. Run the round table process
            const roundTableResult = await runRoundTableProcess(resolvedRoundTableOptions);
            discussionFilePath = roundTableResult.discussionFilePath;
            conceptFilePathUsed = roundTableResult.conceptFilePath;
            
            // 3. Offer interactive refinement if discussion was generated
            if (discussionFilePath) {
                // Replace placeholder with actual prompt
                const refineAnswer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'refineNow',
                        message: `Discussion saved to ${discussionFilePath}. Refine concept (${path.basename(conceptFilePathUsed)}) now?`,
                        default: true
                    }
                ]);
                if (refineAnswer.refineNow) {
                    // Replace placeholder with actual prompt
                    const promptAnswer = await inquirer.prompt([
                        { type: 'input', name: 'customPrompt', message: 'Optional custom prompt for refinement:', default: '' }
                    ]);
                    const customPrompt = promptAnswer.customPrompt.trim() || null;
                    
                    // Call refinement helper
                    refinedConceptPath = await runRefinementProcess(
                        conceptFilePathUsed, 
                        discussionFilePath, 
                        customPrompt,
                        null // Use default output naming (<concept>_refined.txt)
                    );
                    
                    // 4. Offer interactive PRD generation if refinement was done
                    if (refinedConceptPath) {
                         // Replace placeholder with actual prompt
                        const generatePrdAnswer = await inquirer.prompt([
                            { type: 'confirm', name: 'generateNow', message: `Refined concept saved to ${refinedConceptPath}. Generate PRD now?`, default: true }
                        ]);
                        if (generatePrdAnswer.generateNow) {
                            const initialPrdOptions = { conceptFile: refinedConceptPath };
                            const resolvedPrdOptions = await getGeneratePRDOptionsInteractively(initialPrdOptions, refinedConceptPath);
                            prdFilePath = await runGeneratePRDProcess(resolvedPrdOptions);
                        }
                    }
                }
            }
        } catch (error) {
             if(setupSpinner.isSpinning) setupSpinner.fail();
             console.error(chalk.red('Round table command failed overall.'));
             if (CONFIG.debug && error.stack) {
               console.error('Round Table Command Top Level Error Stack:', error.stack);
             }
             process.exit(1);
        }

        // Display final Next Steps based on what was last generated
        // (Keep existing next steps logic)
        console.log(chalk.white.bold('\nNext Steps:'));
        // ... (if prdFilePath, if refinedConceptPath, if discussionFilePath)
    });

  // refine-concept command (Refactored to use helpers)
  programInstance
    .command('refine-concept')
    .description('Refine a product concept based on discussion or prompts')
    .option('-c, --concept-file <file>', 'Path to the concept file to refine (required)')
    .option('-d, --discussion-file <file>', 'Path to discussion.txt to use for refinement')
    .option('-p, --prompt <text>', 'Custom prompt for refinement (e.g., \"Focus on scalability\")')
    .option('-o, --output <file>', 'Output file for the refined concept (defaults to <concept_file>_refined.txt)')
    .action(async (options) => {
        const commandSpinner = ora('Initiating concept refinement command...').start();
        let refinedFilePath = null; 
        try {
            // --- Define Helper Functions for Interactive Prompts ---
            async function promptForConceptFile(currentPath) {
                if (currentPath) return currentPath;
                const answer = await inquirer.prompt([
                    { type: 'input', name: 'conceptFile', message: 'Enter the path to the concept file to refine:', default: 'prd/concept.txt', validate: input => fs.existsSync(path.resolve(input)) || 'File not found.' }
                ]);
                return answer.conceptFile;
            }

            async function promptForRefinementSource(currentDiscussionPath, currentCustomPrompt) {
                if (currentDiscussionPath || currentCustomPrompt) return { discussionFile: currentDiscussionPath, customPrompt: currentCustomPrompt };
                
                const sourceAnswer = await inquirer.prompt([
                    { type: 'list', name: 'sourceType', message: 'How do you want to refine?', choices: ['Use discussion file', 'Use custom prompt', 'Use both'], default: 'Use discussion file'}
                ]);
                
                let discussionFile = null;
                let customPrompt = null;

                if (sourceAnswer.sourceType === 'Use discussion file' || sourceAnswer.sourceType === 'Use both') {
                    const answer = await inquirer.prompt([
                         { type: 'input', name: 'discussionFile', message: 'Path to discussion file:', default: 'prd/discussion.txt', validate: input => fs.existsSync(path.resolve(input)) || 'File not found.' }
                    ]);
                    discussionFile = answer.discussionFile;
                }
                if (sourceAnswer.sourceType === 'Use custom prompt' || sourceAnswer.sourceType === 'Use both') {
                     const answer = await inquirer.prompt([ { type: 'input', name: 'customPrompt', message: 'Custom refinement prompt:'} ]);
                     customPrompt = answer.customPrompt.trim() || null;
                }
                if (!discussionFile && !customPrompt) throw new Error('Refinement requires a source.');
                return { discussionFile, customPrompt };
            }

            async function promptForOutputPath(currentOutputPath, calculatedDefault) {
                if (currentOutputPath) return currentOutputPath;
                const answer = await inquirer.prompt([
                    { type: 'input', name: 'outputPath', message: `Output path (default: ${calculatedDefault}):`, default: calculatedDefault }
                ]);
                return answer.outputPath || calculatedDefault;
            }
            // --- End Helper Functions ---
            
            commandSpinner.stop(); // Stop for prompts

            // --- Use Helpers for Interactive Prompts --- 
            let conceptFilePathInput = await promptForConceptFile(options.conceptFile);
            const conceptFilePath = path.resolve(conceptFilePathInput);
            if (!fs.existsSync(conceptFilePath)) throw new Error(`Concept file not found: ${conceptFilePath}`);

            const source = await promptForRefinementSource(options.discussionFile, options.prompt);
            let discussionFilePathInput = source.discussionFile;
            let customPromptInput = source.customPrompt;
            const discussionFilePath = discussionFilePathInput ? path.resolve(discussionFilePathInput) : null;
            const customPrompt = customPromptInput || null;
            if (discussionFilePath && !fs.existsSync(discussionFilePath)) throw new Error(`Discussion file not found: ${discussionFilePath}`);

            const parsedPath = path.parse(conceptFilePath);
            const defaultOutputPath = path.join(parsedPath.dir, `${parsedPath.name}_refined${parsedPath.ext}`);
            let specificOutputFilePath = await promptForOutputPath(options.output, defaultOutputPath);
            specificOutputFilePath = path.resolve(specificOutputFilePath);
            // --- End Using Helpers ---
            
            commandSpinner.start(); // Resume spinner before processing

            // --- Call the Refinement Helper Function ---
            commandSpinner.text = 'Running refinement process...';
            refinedFilePath = await runRefinementProcess(
                conceptFilePath, 
                discussionFilePath, 
                customPrompt,
                specificOutputFilePath // Use the final resolved output path
            );
            
            commandSpinner.succeed(chalk.green('Refine-concept command completed.'));

            // --- Offer interactive PRD Generation --- (Keep existing logic)
            let prdFilePath = null;
            const generatePrdAnswer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'generateNow',
                    message: `Refined concept saved to ${refinedFilePath}. Generate the PRD now using this file?`,
                    default: true
                }
            ]);
            if (generatePrdAnswer.generateNow) {
                const initialPrdOptions = { conceptFile: refinedFilePath };
                const resolvedPrdOptions = await getGeneratePRDOptionsInteractively(initialPrdOptions, refinedFilePath);
                prdFilePath = await runGeneratePRDProcess(resolvedPrdOptions);
            }
            // --- End Offer ---

        } catch (error) {
             // Catch errors from validation or the helper function
             if(commandSpinner.isSpinning) commandSpinner.fail(chalk.red('Refine Concept command failed.'));
             else console.error(chalk.red('Refine Concept command failed.'));
             console.error(chalk.red(`Error details: ${error.message}`)); 
             if (CONFIG.debug && error.stack) {
               console.error('Refine Concept Command Error Stack:', error.stack);
             }
             process.exit(1);
        }
        
        // --- Display Next Steps (Adjusted) --- 
        console.log(chalk.white.bold('\nNext Steps:'));
        if (prdFilePath) { // If PRD was generated
            console.log(chalk.cyan(`1. Review the generated PRD in ${prdFilePath}`));
            console.log(chalk.cyan(`2. Run 'task-master parse-prd --input="${path.relative(process.cwd(), prdFilePath)}"' to generate tasks.`));
        } else if (refinedFilePath) { // If refinement happened but PRD was skipped
            console.log(chalk.cyan(`1. Review the refined concept in ${refinedFilePath}`));
            console.log(chalk.cyan(`2. Run 'task-master generate-prd --concept-file="${path.relative(process.cwd(), refinedFilePath)}"' manually to generate the PRD.`)); 
        } else {
            log('warn', 'Refined file path was not set. Cannot display next steps accurately.');
        }
    });

  return programInstance;
}

/**
 * Setup the CLI application
 * @returns {Object} Configured Commander program
 */
function setupCLI() {
  // Create a new program instance
  const programInstance = program
    .name('dev')
    .description('AI-driven development task management')
    .version(() => {
      // Read version directly from package.json
      try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          return packageJson.version;
        }
      } catch (error) {
        // Silently fall back to default version
      }
      return CONFIG.projectVersion; // Default fallback
    })
    .helpOption('-h, --help', 'Display help')
    .addHelpCommand(false) // Disable default help command
    .on('--help', () => {
      displayHelp(); // Use your custom help display instead
    })
    .on('-h', () => {
      displayHelp();
      process.exit(0);
    });
  
  // Modify the help option to use your custom display
  programInstance.helpInformation = () => {
    displayHelp();
    return '';
  };
  
  // Register commands
  registerCommands(programInstance);
  
  return programInstance;
}

/**
 * Check for newer version of task-master-ai
 * @returns {Promise<{currentVersion: string, latestVersion: string, needsUpdate: boolean}>}
 */
async function checkForUpdate() {
  // Get current version from package.json
  let currentVersion = CONFIG.projectVersion;
  try {
    // Try to get the version from the installed package
    const packageJsonPath = path.join(process.cwd(), 'node_modules', 'task-master-ai', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      currentVersion = packageJson.version;
    }
  } catch (error) {
    // Silently fail and use default
    log('debug', `Error reading current package version: ${error.message}`);
  }

  return new Promise((resolve) => {
    // Get the latest version from npm registry
    const options = {
      hostname: 'registry.npmjs.org',
      path: '/task-master-ai',
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.npm.install-v1+json' // Lightweight response
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const npmData = JSON.parse(data);
          const latestVersion = npmData['dist-tags']?.latest || currentVersion;
          
          // Compare versions
          const needsUpdate = compareVersions(currentVersion, latestVersion) < 0;
          
          resolve({
            currentVersion,
            latestVersion,
            needsUpdate
          });
        } catch (error) {
          log('debug', `Error parsing npm response: ${error.message}`);
          resolve({
            currentVersion,
            latestVersion: currentVersion,
            needsUpdate: false
          });
        }
      });
    });
    
    req.on('error', (error) => {
      log('debug', `Error checking for updates: ${error.message}`);
      resolve({
        currentVersion,
        latestVersion: currentVersion,
        needsUpdate: false
      });
    });
    
    // Set a timeout to avoid hanging if npm is slow
    req.setTimeout(3000, () => {
      req.abort();
      log('debug', 'Update check timed out');
      resolve({
        currentVersion,
        latestVersion: currentVersion,
        needsUpdate: false
      });
    });
    
    req.end();
  });
}

/**
 * Compare semantic versions
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if v1 = v2, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const v1Parts = v1.split('.').map(p => parseInt(p, 10));
  const v2Parts = v2.split('.').map(p => parseInt(p, 10));
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part < v2Part) return -1;
    if (v1Part > v2Part) return 1;
  }
  
  return 0;
}

/**
 * Display upgrade notification message
 * @param {string} currentVersion - Current version
 * @param {string} latestVersion - Latest version
 */
function displayUpgradeNotification(currentVersion, latestVersion) {
  const message = boxen(
    `${chalk.blue.bold('Update Available!')} ${chalk.dim(currentVersion)} → ${chalk.green(latestVersion)}\n\n` +
    `Run ${chalk.cyan('npm i task-master-ai@latest -g')} to update to the latest version with new features and bug fixes.`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderColor: 'yellow',
      borderStyle: 'round'
    }
  );
  
  console.log(message);
}

/**
 * Parse arguments and run the CLI
 * @param {Array} argv - Command-line arguments
 */
async function runCLI(argv = process.argv) {
  try {
    // Display banner if not in a pipe
    if (process.stdout.isTTY) {
      displayBanner();
    }
    
    // If no arguments provided, show help
    if (argv.length <= 2) {
      displayHelp();
      process.exit(0);
    }
    
    // Start the update check in the background - don't await yet
    const updateCheckPromise = checkForUpdate();
    
    // Setup and parse
    const programInstance = setupCLI();
    await programInstance.parseAsync(argv);
    
    // After command execution, check if an update is available
    const updateInfo = await updateCheckPromise;
    if (updateInfo.needsUpdate) {
      displayUpgradeNotification(updateInfo.currentVersion, updateInfo.latestVersion);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

// --- NEW HELPER FUNCTION for Refinement ---
/**
 * Runs the process of refining a concept file.
 * @param {string} conceptFilePath - Path to the input concept file.
 * @param {string|null} discussionFilePath - Path to the discussion file (optional).
 * @param {string|null} customPrompt - Custom refinement prompt (optional).
 * @param {string|null} specificOutputFilePath - Specific path for the output (optional, overrides default naming).
 * @returns {Promise<string>} - Path to the saved refined concept file.
 * @throws {Error} If refinement fails.
 */
async function runRefinementProcess(conceptFilePath, discussionFilePath = null, customPrompt = null, specificOutputFilePath = null) {
    const spinner = ora('Starting concept refinement...').start();
    try {
        // --- Validate Inputs (Basic) ---
        if (!conceptFilePath || !fs.existsSync(conceptFilePath)) {
            throw new Error(`Input concept file not found: ${conceptFilePath}`);
        }
        if (discussionFilePath && !fs.existsSync(discussionFilePath)) {
             throw new Error(`Input discussion file not found: ${discussionFilePath}`);
        }
        if (!discussionFilePath && !customPrompt) {
             throw new Error('Either discussion content or a custom prompt is required for refinement.');
        }

        // Determine output path
        let outputFilePath;
        if (specificOutputFilePath) {
            outputFilePath = path.resolve(specificOutputFilePath);
            log('info', `Using specified output path for refined concept: ${outputFilePath}`);
        } else {
            // Default to <concept_filename>_refined.txt
            const parsedPath = path.parse(conceptFilePath);
            outputFilePath = path.join(parsedPath.dir, `${parsedPath.name}_refined${parsedPath.ext}`);
            log('info', `Defaulting refined concept output path to: ${outputFilePath}`);
        }
        const outputDir = path.dirname(outputFilePath);

        // --- Read Input Files ---
        spinner.text = `Reading concept from ${conceptFilePath}...`;
        const conceptContent = fs.readFileSync(conceptFilePath, 'utf-8');
        let discussionContent = null;
        if (discussionFilePath) {
            spinner.text = `Reading discussion from ${discussionFilePath}...`;
            discussionContent = fs.readFileSync(discussionFilePath, 'utf-8');
        }

        // --- Refine Concept --- 
        spinner.text = 'Refining concept with AI...';
        const ideationService = new IdeationService(); 
        const refinedContent = await ideationService.refineConcept(
            conceptContent,
            discussionContent, 
            customPrompt       
        );

        // --- Save Output --- 
        if (!refinedContent || refinedContent.trim().length === 0) {
            throw new Error('AI failed to generate refined concept content.');
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            log('info', `Created output directory: ${outputDir}`)
        }
        fs.writeFileSync(outputFilePath, refinedContent);
        spinner.succeed(chalk.green('Concept refined successfully!'));
        console.log(chalk.cyan(`Refined concept saved to: ${outputFilePath}`));
        return outputFilePath; // Return the path where it was saved

    } catch (error) {
        spinner.fail(chalk.red('Concept refinement failed during the process.'));
        // Log the specific error but re-throw to be handled by the caller
        log('error', `Refinement process error: ${error.message}`);
        if (CONFIG.debug && error.stack) {
             console.error(error.stack); // Log stack in debug mode
        }
        throw error; // Re-throw the original error
    }
}
// --- END HELPER FUNCTION ---

// --- NEW HELPER FUNCTION for Interactive PRD Options ---
/**
 * Interactively prompts the user for generate-prd options if not provided.
 * @param {object} initialOptions - Options potentially provided via flags.
 * @param {string} defaultConceptPath - The default concept file path to suggest.
 * @returns {Promise<object>} - Object containing all options (from flags or prompts).
 */
async function getGeneratePRDOptionsInteractively(initialOptions, defaultConceptPath) {
    let { conceptFile, template, research, format, style, sections, preview, yes, output } = initialOptions;

    // 1. Get Concept File
    if (!conceptFile) {
        const answer = await inquirer.prompt([
            { type: 'input', name: 'conceptFile', message: 'Enter path to the concept file for PRD generation:', default: defaultConceptPath, validate: input => fs.existsSync(path.resolve(input)) || 'Concept file not found.' }
        ]);
        conceptFile = answer.conceptFile;
    }
    // No need to resolve/validate here, calling function will do it.

    // 2. Get Template File (Optional)
    if (template === undefined) { 
        const answer = await inquirer.prompt([ { type: 'confirm', name: 'useTemplate', message: 'Use a PRD template?', default: false } ]);
        if (answer.useTemplate) {
            const templateAnswer = await inquirer.prompt([ { type: 'input', name: 'templateFile', message: 'Enter path to template PRD:', validate: input => fs.existsSync(path.resolve(input)) || 'Template file not found.' } ]);
            template = templateAnswer.templateFile;
        }
    }

    // 3. Research? (Optional)
    if (research === undefined) {
        const answer = await inquirer.prompt([ { type: 'confirm', name: 'useResearch', message: 'Enable research-backed generation?', default: false } ]);
        research = answer.useResearch;
    }

    // 4. Format, Style, Sections (Optional overrides)
    const defaultSections = ['Executive Summary', 'Goals', 'Target Audience', 'Features', 'User Flow', 'Design Considerations', 'Technical Requirements', 'Success Metrics', 'Risks & Mitigations', 'Future Considerations'];
    let finalSections = sections ? sections.split(',').map(s => s.trim()) : null;
    if (format === undefined || style === undefined || !finalSections) { // Ask if any are missing
        const answer = await inquirer.prompt([ { type: 'confirm', name: 'customize', message: 'Customize format/style/sections?', default: false}]);
        if (answer.customize) {
            const customizeAnswers = await inquirer.prompt([
                { type: 'list', name: 'format', message: 'Format:', choices: ['markdown (.md)', 'plaintext (.txt)'], default: 'markdown (.md)' },
                { type: 'list', name: 'style', message: 'Style:', choices: ['minimal', 'standard', 'detailed'], default: 'standard' },
                { type: 'checkbox', name: 'sections', message: 'Sections:', choices: defaultSections, default: defaultSections }
            ]);
            format = customizeAnswers.format.split(' (')[0]; 
            style = customizeAnswers.style;
            finalSections = customizeAnswers.sections;
        } else {
            // Set defaults if not customizing and flags weren't used
            format = format || 'markdown';
            style = style || 'standard';
            finalSections = finalSections || defaultSections;
        }
    } else {
         format = format.split(' (')[0]; // Ensure format from flag is cleaned
         finalSections = finalSections || defaultSections;
    }

    // 5. Preview? (Optional)
    if (preview === undefined) {
        const answer = await inquirer.prompt([ { type: 'confirm', name: 'showPreview', message: 'Show preview first?', default: true } ]);
        preview = answer.showPreview;
    }
    
    // 6. Output File (Only ask if not provided)
    if (output === undefined) {
         const answer = await inquirer.prompt([
             { type: 'input', name: 'output', message: 'Enter output path for PRD:', default: 'prd/prd.txt' }
         ]);
         output = answer.output;
    }

    return {
        conceptFile, template, research, output, format, style, 
        sections: finalSections, // Use the processed list 
        preview, 
        yes // Pass through the -y flag if provided initially
    };
}
// --- END HELPER FUNCTION ---

// --- NEW HELPER FUNCTION for Executing PRD Generation ---
/**
 * Executes the PRD generation process using provided options.
 * @param {object} options - Fully resolved options for PRD generation.
 * @returns {Promise<string>} - Path to the saved PRD file.
 * @throws {Error} If generation or saving fails.
 */
async function runGeneratePRDProcess(options) {
    const { conceptFile, template, research, output, format, style, sections, preview, yes } = options;
    const commandSpinner = ora('Preparing PRD generation...').start(); // Use its own spinner

    try {
        const conceptFilePath = path.resolve(conceptFile);
        const templateFilePath = template ? path.resolve(template) : null;
        const outputFilePath = path.resolve(output);
        const outputDir = path.dirname(outputFilePath);

        // Validate files again just in case paths were manually entered in prompts
        if (!fs.existsSync(conceptFilePath)) throw new Error(`Concept file not found: ${conceptFilePath}`);
        if (templateFilePath && !fs.existsSync(templateFilePath)) throw new Error(`Template file not found: ${templateFilePath}`);

        commandSpinner.text = 'Reading input files...';
        const conceptContent = fs.readFileSync(conceptFilePath, 'utf-8');
        const templateContent = templateFilePath ? fs.readFileSync(templateFilePath, 'utf-8') : null;

        const prdService = new PRDService();
        const prdOptions = {
             templateContent: templateContent,
             research: research || false,
             format: format,
             style: style,
             sections: sections 
        };

         log('info', 'Generating PRD with options:', prdOptions);

        let generateConfirmed = !preview;

        // Handle Preview
        if (preview) {
            commandSpinner.text = 'Generating PRD preview...';
            try {
                const previewContent = await prdService.generatePRDPreview(conceptContent, prdOptions);
                commandSpinner.stop(); 
                console.log(chalk.cyan.bold('\n--- PRD Preview --- '));
                console.log(previewContent);
                console.log(chalk.cyan.bold('--- End Preview --- \n'));

                if (!yes) {
                    const answers = await inquirer.prompt([ { type: 'confirm', name: 'confirmGeneration', message: 'Proceed with generating the full PRD?', default: true } ]);
                    generateConfirmed = answers.confirmGeneration;
                } else {
                    generateConfirmed = true; 
                }
                if (generateConfirmed) commandSpinner.start();
            } catch (previewError) {
                commandSpinner.fail('Failed to generate PRD preview.'); throw previewError;
            }
        }

        // Generate Full PRD
        if (generateConfirmed) {
            commandSpinner.text = 'Generating full PRD document...';
            try {
                const prdResult = await prdService.generatePRD(conceptContent, prdOptions);
                if (!prdResult || !prdResult.content) throw new Error('AI failed to generate PRD content.');
                
                if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
                fs.writeFileSync(outputFilePath, prdResult.content);
                commandSpinner.succeed(chalk.green('PRD generated successfully!'));
                console.log(chalk.cyan(`Full PRD saved to: ${outputFilePath}`));
                
                // Generate MCP configuration file for Cursor
                try {
                    const projectDir = process.cwd();
                    await generateMcpConfigFile(projectDir, outputFilePath);
                } catch (mcpError) {
                    // Only log the error, don't interrupt the main flow
                    log('warn', `Error generating MCP configuration: ${mcpError.message}`);
                }
                
                return outputFilePath; // Return the final path
            } catch (prdError) {
                commandSpinner.fail('Full PRD generation failed.'); throw prdError;
            }
        } else {
            console.log(chalk.yellow('Full PRD generation cancelled by user.'));
            return null; // Indicate cancellation
        }
    } catch (error) {
        // Catch errors from file reading, validation, or generation steps
        if(commandSpinner.isSpinning) commandSpinner.fail();
        log('error', `Error during PRD generation process: ${error.message}`);
        if (CONFIG.debug && error.stack) console.error(error.stack);
        throw error; // Re-throw to be handled by the calling command action
    }
}
// --- END HELPER FUNCTION ---

// --- NEW HELPER FUNCTION for Interactive Round Table Options ---
/**
 * Interactively prompts the user for round-table options if not provided.
 * @param {object} initialOptions - Options potentially provided via flags.
 * @param {string} defaultConceptPath - The default concept file path to suggest.
 * @returns {Promise<object>} - Object containing all options (from flags or prompts).
 */
async function getRoundTableOptionsInteractively(initialOptions, defaultConceptPath) {
    let { conceptFile, output, participants, topics, focusTopics } = initialOptions;

    // 1. Get Concept File
    if (!conceptFile) {
        const answer = await inquirer.prompt([
            { type: 'input', name: 'conceptFile', message: 'Enter path to concept file:', default: defaultConceptPath, validate: input => fs.existsSync(path.resolve(input)) || 'Concept file not found.' }
        ]);
        conceptFile = answer.conceptFile;
    }

    // 2. Get Participants
    let finalParticipants = participants ? participants.split(',').map(p => p.trim()) : [];
    if (finalParticipants.length < 2) {
        console.log(chalk.yellow('At least two participants are needed.'));
        const defaultParticipants = ['Product Manager', 'Lead Engineer', 'UX Designer'];
        const answers = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selectedParticipants',
                message: 'Select participants for the round table:',
                choices: [
                    ...defaultParticipants,
                    new inquirer.Separator(),
                    { name: 'Add custom...', value: 'custom' }
                ],
                default: defaultParticipants,
                validate: (input) => input.length >= 2 || 'Please select at least two participants.'
            }
        ]);
        finalParticipants = answers.selectedParticipants;
         if (finalParticipants.includes('custom')) {
             finalParticipants = finalParticipants.filter(p => p !== 'custom');
             const customAnswers = await inquirer.prompt([
                 {
                    type: 'input',
                    name: 'customRoles',
                    message: 'Enter additional custom roles (comma-separated):',
                    filter: (input) => input.split(',').map(p => p.trim()).filter(p => p),
                }
             ]);
             finalParticipants.push(...customAnswers.customRoles);
         }
         if (finalParticipants.length < 2) { throw new Error('Less than two participants selected.'); }
    }

    // 3. Get Topics & Focus
    let topicsFromOptions = topics ? topics.split(',').map(t => t.trim()).filter(t => t) : [];
    let interactiveTopics = [];
    const focusTopicsFromFlag = focusTopics || false;
    let focusInteractiveTopics = false;

    const addTopicsAnswer = await inquirer.prompt([
        { type: 'confirm', name: 'addTopics', message: 'Add specific discussion topics?', default: false }
    ]);
    if (addTopicsAnswer.addTopics) {
        const topicAnswer = await inquirer.prompt([
            {
                type: 'input',
                name: 'topics',
                message: 'Enter comma-separated topics to discuss:',
                filter: (input) => input.split(',').map(t => t.trim()).filter(t => t)
            }
        ]);
        interactiveTopics = topicAnswer.topics || [];
        if (interactiveTopics.length > 0 && !focusTopicsFromFlag) {
            const focusChoiceAnswer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'howToTreat',
                    message: 'How should these interactively added topics be treated?',
                    choices: [
                        { name: 'Include them in the general discussion', value: 'include' },
                        { name: 'Focus the discussion primarily on these topics', value: 'focus' }
                    ],
                    default: 'include'
                }
            ]); 
            if (focusChoiceAnswer.howToTreat === 'focus') {
                 focusInteractiveTopics = true;
            }
        }
    }
    const allTopics = [...new Set([...topicsFromOptions, ...interactiveTopics])];
    const finalFocusMode = focusTopicsFromFlag || focusInteractiveTopics;

    // 4. Get Output File (Only ask if not provided)
    if (!output) {
         const answer = await inquirer.prompt([
             { type: 'input', name: 'output', message: 'Enter output path for discussion:', default: 'prd/discussion.txt' }
         ]);
         output = answer.output;
    }

    const optionsToReturn = {
        conceptFile,
        output,
        participants: finalParticipants, 
        topics: allTopics, 
        focusTopics: finalFocusMode
    };
    console.log('DEBUG: [getRoundTableOptionsInteractively] Returning options:', optionsToReturn); // Log options
    return optionsToReturn;
}
// --- END HELPER FUNCTION ---

// --- NEW HELPER FUNCTION for Executing Round Table ---
/**
 * Executes the round-table discussion process.
 * @param {object} options - Fully resolved options.
 * @returns {Promise<{discussionFilePath: string|null, conceptFilePath: string}>} - Path to saved discussion file (or null if cancelled) and the concept file used.
 * @throws {Error} If generation or saving fails.
 */
async function runRoundTableProcess(options) {
    console.log('DEBUG: [runRoundTableProcess] Entered with options:', options); 
    const { conceptFile, output, participants, topics, focusTopics } = options;
    console.log(`DEBUG: [runRoundTableProcess] Destructured conceptFile: ${conceptFile}`); 
    console.log(`DEBUG: [runRoundTableProcess] typeof conceptFile: ${typeof conceptFile}`);
    const spinner = ora('Preparing round table...').start(); 
    let finalOutputFilePath = null; 
    console.log('DEBUG: [runRoundTableProcess] About to declare conceptFilePath...'); 
    const conceptFilePath = path.resolve(conceptFile); 
    console.log(`DEBUG: [runRoundTableProcess] Declared conceptFilePath: ${conceptFilePath}`); 
    const baseOutputFilePath = path.resolve(output);
    console.log(`DEBUG: [runRoundTableProcess] Declared baseOutputFilePath: ${baseOutputFilePath}`);
    
    try {
        // Check if output file exists and handle it
        if (fs.existsSync(baseOutputFilePath)) {
            spinner.stop();
            const overwriteAnswer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: `Output file already exists: ${baseOutputFilePath}. What would you like to do?`,
                    choices: [
                        { name: 'Overwrite the existing file', value: 'overwrite' },
                        { name: 'Create a new file (timestamped name)', value: 'new' },
                        { name: 'Cancel operation', value: 'cancel' }
                    ],
                    default: 'new'
                }
            ]);

            if (overwriteAnswer.action === 'cancel') {
                console.log(chalk.yellow('Operation cancelled by user.'));
                return { discussionFilePath: null, conceptFilePath: conceptFilePath };
            } else if (overwriteAnswer.action === 'new') {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const parsedPath = path.parse(baseOutputFilePath);
                finalOutputFilePath = path.join(parsedPath.dir, `${parsedPath.name}-${timestamp}${parsedPath.ext}`);
                console.log(chalk.blue(`Will save discussion to new file: ${finalOutputFilePath}`));
            } else {
                // Action is 'overwrite'
                finalOutputFilePath = baseOutputFilePath;
                console.log(chalk.yellow(`Will overwrite existing file: ${baseOutputFilePath}`));
            }
            spinner.start();
        } else {
            finalOutputFilePath = baseOutputFilePath;
        }

        spinner.text = 'Reading concept...';
        console.log(`DEBUG: [runRoundTableProcess] Reading concept file: ${conceptFilePath}`);
        if (!fs.existsSync(conceptFilePath)) throw new Error(`Concept file not found: ${conceptFilePath}`);
        const conceptContent = fs.readFileSync(conceptFilePath, 'utf-8');
        console.log('DEBUG: [runRoundTableProcess] Concept file read successfully.');
        if (!conceptContent.trim()) throw new Error(`Concept file is empty: ${conceptFilePath}`);

        spinner.text = `Simulating discussion between ${participants.join(', ')}...`;
        if (topics && topics.length > 0) {
            spinner.text += ` Topics: ${topics.join(', ')}`;
        }

        // Ensure output directory exists
        const outputDir = path.dirname(finalOutputFilePath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`DEBUG: [runRoundTableProcess] Created output directory: ${outputDir}`);
        }
        
        console.log('DEBUG: [runRoundTableProcess] Initializing DiscussionService...');
        const discussionService = new DiscussionService();
        console.log('DEBUG: [runRoundTableProcess] DiscussionService initialized.');
        console.log('DEBUG: [runRoundTableProcess] Calling discussionService.generateDiscussion...');
        
        const discussionResult = await discussionService.generateDiscussion(
            conceptContent, 
            participants, 
            { topics: topics, focusTopics: focusTopics } 
        );
        console.log('DEBUG: [runRoundTableProcess] discussionService.generateDiscussion returned.');

        // Validate discussionResult has the expected properties
        if (!discussionResult || typeof discussionResult !== 'object' || !discussionResult.content) {
            throw new Error('Discussion generation failed: Invalid or empty result from AI');
        }

        // Save the discussion content to the file
        fs.writeFileSync(finalOutputFilePath, discussionResult.content);
        spinner.succeed(chalk.green(`Discussion saved to ${finalOutputFilePath}`));

        // Display insights if available
        if (discussionResult.insights && (
            discussionResult.insights.keyInsights.length > 0 || 
            discussionResult.insights.actionItems.length > 0
        )) {
            console.log(chalk.cyan.bold('\n--- Discussion Insights ---'));
            if (discussionResult.insights.summary) {
                console.log(chalk.white.bold('Summary:'));
                console.log(discussionResult.insights.summary);
            }
            
            if (discussionResult.insights.keyInsights.length > 0) {
                console.log(chalk.white.bold('\nKey Insights:'));
                discussionResult.insights.keyInsights.forEach((insight, i) => {
                    console.log(`${i+1}. ${insight}`);
                });
            }
            
            if (discussionResult.insights.actionItems.length > 0) {
                console.log(chalk.white.bold('\nRecommended Actions:'));
                discussionResult.insights.actionItems.forEach((item, i) => {
                    console.log(`${i+1}. ${item}`);
                });
            }
            console.log(chalk.cyan.bold('------------------------\n'));
        }

        return { 
            discussionFilePath: finalOutputFilePath, 
            conceptFilePath: conceptFilePath 
        };
        
    } catch (error) {
        spinner.fail(chalk.red('Round table process failed.'));
        console.error(chalk.red(`Error during round table process: ${error.message}`));
        if (CONFIG.debug && error.stack) {
            console.error('Round Table Command Error Stack:', error.stack);
        }
        return { discussionFilePath: null, conceptFilePath: conceptFilePath };
    }
}
// --- END HELPER FUNCTION ---

// --- NEW HELPER FUNCTION for generating the MCP configuration file ---
/**
 * Generates an MCP configuration file (.cursor/mcp.json) for Cursor integration
 * @param {string} projectDir - Project directory where the .cursor/mcp.json file will be created
 * @param {string} prdFilePath - Path to the generated PRD file 
 * @returns {Promise<string>} - Path to the generated mcp.json file
 */
async function generateMcpConfigFile(projectDir, prdFilePath) {
  try {
    const spinner = ora('Generating MCP configuration for Cursor...').start();
    
    // Create .cursor directory if it doesn't exist
    const mcpDir = path.join(projectDir, '.cursor');
    const mcpFilePath = path.join(mcpDir, 'mcp.json');
    
    if (!fs.existsSync(mcpDir)) {
      fs.mkdirSync(mcpDir, { recursive: true });
      log('info', `Created directory: ${mcpDir}`);
    }
    
    // Get relative paths for resources
    const prdRelativePath = path.relative(projectDir, prdFilePath);
    
    // Normalize path separators (convert Windows backslashes to forward slashes)
    const normalizedPrdPath = prdRelativePath.replace(/\\/g, '/');
    
    // Create a simple MCP configuration object
    const mcpConfig = {
      "mcpServers": {
        "taskmaster-cli": {
          "command": "node",
          "args": ["./mcp-server/server.js"],
          "description": "Task Master CLI - PRD and task management integration",
          "env": {
            "PRD_PATH": normalizedPrdPath
          }
        }
      }
    };
    
    // Save the configuration file
    fs.writeFileSync(mcpFilePath, JSON.stringify(mcpConfig, null, 2));
    spinner.succeed(chalk.green('Cursor MCP configuration successfully generated.'));
    console.log(chalk.cyan(`MCP file saved to: ${mcpFilePath}`));
    
    return mcpFilePath;
  } catch (error) {
    log('error', `Error generating MCP configuration: ${error.message}`);
    console.error(chalk.yellow(`Failed to generate MCP configuration: ${error.message}`));
    if (CONFIG.debug && error.stack) console.error(error.stack);
    return null;
  }
}

export {
  registerCommands,
  setupCLI,
  runCLI,
  checkForUpdate,
  compareVersions,
  displayUpgradeNotification
}; 