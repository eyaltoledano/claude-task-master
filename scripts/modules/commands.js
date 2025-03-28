/**
 * commands.js
 * Command-line interface for the Task Master CLI
 */

import { program } from 'commander';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'fs';

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
  analyzeTaskComplexity
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
  getStatusWithColor
} from './ui.js';

// Import the AI status command
import { initAiStatusCommand } from '../commands/ai-status-command.js';
// Import the AI test command
import { initAiTestCommand } from '../commands/ai-test-command.js';
// Import the recovery command
import { initRecoveryCommand } from '../commands/recovery-command.js';

/**
 * Configure and register CLI commands
 * @param {Object} program - Commander program instance
 */
function registerCommands(programInstance) {
  // Default help
  programInstance.on('--help', function() {
    displayHelp();
  });
  
  // Register AI status command
  initAiStatusCommand(programInstance);
  
  // Register AI test command
  initAiTestCommand(programInstance);
  
  // Register recovery command
  initRecoveryCommand(programInstance);
  
  // parse-prd command
  programInstance
    .command('parse-prd')
    .description('Parse a PRD file and generate tasks')
    .argument('[file]', 'Path to the PRD file')
    .option('-i, --input <file>', 'Path to the PRD file (alternative to positional argument)')
    .option('-o, --output <file>', 'Output file path', 'tasks/tasks.json')
    .option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
    .action(async (file, options) => {
      // Use input option if file argument not provided
      const inputFile = file || options.input;
      const defaultPrdPath = 'scripts/prd.txt';
      
      // If no input file specified, check for default PRD location
      if (!inputFile) {
        if (fs.existsSync(defaultPrdPath)) {
          console.log(chalk.blue(`Using default PRD file: ${defaultPrdPath}`));
          const numTasks = parseInt(options.numTasks, 10);
          const outputPath = options.output;
          
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
          '  -n, --num-tasks <number> Number of tasks to generate (default: 10)\n\n' +
          chalk.cyan('Example:') + '\n' +
          '  task-master parse-prd requirements.txt --num-tasks 15\n' +
          '  task-master parse-prd --input=requirements.txt\n\n' +
          chalk.yellow('Note: This command will:') + '\n' +
          '  1. Look for a PRD file at scripts/prd.txt by default\n' +
          '  2. Use the file specified by --input or positional argument if provided\n' +
          '  3. Generate tasks from the PRD and overwrite any existing tasks.json file',
          { padding: 1, borderColor: 'blue', borderStyle: 'round' }
        ));
        return;
      }
      
      const numTasks = parseInt(options.numTasks, 10);
      const outputPath = options.output;
      
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
    .option('-d, --dependencies <ids>', 'Comma-separated list of task IDs this task depends on')
    .option('--priority <priority>', 'Task priority (high, medium, low)', 'medium')
    .action(async (options) => {
      const tasksPath = options.file;
      const prompt = options.prompt;
      const dependencies = options.dependencies ? options.dependencies.split(',').map(id => parseInt(id.trim(), 10)) : [];
      const priority = options.priority;
      
      if (!prompt) {
        console.error(chalk.red('Error: --prompt parameter is required. Please provide a task description.'));
        process.exit(1);
      }
      
      console.log(chalk.blue(`Adding new task with description: "${prompt}"`));
      console.log(chalk.blue(`Dependencies: ${dependencies.length > 0 ? dependencies.join(', ') : 'None'}`));
      console.log(chalk.blue(`Priority: ${priority}`));
      
      await addTask(tasksPath, prompt, dependencies, priority);
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
      
      await addDependency(tasksPath, parseInt(taskId, 10), parseInt(dependencyId, 10));
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
      
      await removeDependency(tasksPath, parseInt(taskId, 10), parseInt(dependencyId, 10));
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
    .option('--no-generate', 'Skip regenerating task files')
    .action(async (options) => {
      const tasksPath = options.file;
      const parentId = options.parent;
      const existingTaskId = options.taskId;
      const generateFiles = options.generate;
      
      if (!parentId) {
        console.error(chalk.red('Error: --parent parameter is required. Please provide a parent task ID.'));
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
    });

  // remove-subtask command
  programInstance
    .command('remove-subtask')
    .description('Remove a subtask from its parent task')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <id>', 'Subtask ID to remove in format "parentId.subtaskId" (required)')
    .option('-c, --convert', 'Convert the subtask to a standalone task instead of deleting it')
    .option('--no-generate', 'Skip regenerating task files')
    .action(async (options) => {
      const tasksPath = options.file;
      const subtaskId = options.id;
      const convertToTask = options.convert || false;
      const generateFiles = options.generate;
      
      if (!subtaskId) {
        console.error(chalk.red('Error: --id parameter is required. Please provide a subtask ID in format "parentId.subtaskId".'));
        process.exit(1);
      }
      
      try {
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
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
    
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

  // generate-prd command (main workflow)
  programInstance
    .command('generate-prd')
    .description('Generate a Product Requirements Document (PRD) through a guided process')
    .option('-i, --idea <text>', 'Initial product/feature idea')
    .option('-o, --output <dir>', 'Output directory for generated files', 'prd')
    .option('-f, --flow <stages>', 'Custom flow with comma-separated stages', 'ideate,round-table,refine-concept,generate-prd')
    .action(async (options) => {
      try {
        const idea = options.idea || '';
        const outputDir = options.output;
        const flow = options.flow;
        
        // Mostrar el banner personalizado de PRD
        displayBanner(true);
        
        console.log(chalk.blue('Starting PRD generation workflow...'));
        console.log(chalk.blue(`Output directory: ${outputDir}`));
        console.log(chalk.blue(`Flow stages: ${flow}`));
        
        const { generatePRDWorkflow } = await import('./task-manager.js');
        await generatePRDWorkflow(idea, outputDir, flow);
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
    
  // ideate command (convert idea to concept)
  programInstance
    .command('ideate')
    .description('Turn a raw idea into a structured product concept through interactive prompts')
    .option('-i, --idea <text>', 'Initial product/feature idea (optional, will prompt if not provided)')
    .option('-o, --output <file>', 'Output file for the concept', 'prd/concept.txt')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('-f, --format <format>', 'Output format (txt or json)', 'txt')
    .action(async (options) => {
      try {
        // Mostrar el banner personalizado de PRD
        displayBanner(true);
        
        // Import display integration
        const { withDisplay } = await import('./command-display.js');
        
        // Use withDisplay wrapper for consistent error handling and display
        await withDisplay(async (opts) => {
          const { display } = opts;
          const idea = options.idea;
          const outputFile = options.outputFile || options.output;
          const outputFormat = options.format || 'txt';
          
          // Show start message with improved formatting
          display.log('info', 'Starting interactive concept generation...');
          
          if (idea) {
            display.log('info', `Using provided idea: "${idea}"`);
          }
          
          display.log('info', `Output will be saved to: ${outputFile}`);
          
          // Import and execute the core function
          const { ideateProductConcept } = await import('./task-manager.js');
          const result = await ideateProductConcept(idea, outputFile);
          
          // Display results with the new templates
          if (result?.conceptId) {
            // Show success message with better formatting
            display.displaySuccess({
              title: 'Concept Generated Successfully',
              message: `Product concept has been generated and saved to ${outputFile}`,
              details: `Concept ID: ${result.conceptId}`,
              nextSteps: [
                `Review the complete concept in ${outputFile}`,
                `Run 'task-master round-table --concept-file=${outputFile}' to gather expert feedback`,
                `Or proceed directly to 'task-master generate-prd-file --concept-file=${outputFile}'`
              ]
            });
          }
          
          return result;
        })(options);
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
    
  // round-table command (simulate expert discussion)
  programInstance
    .command('round-table')
    .description('Simulate a discussion between domain experts to generate insights')
    .option('-c, --concept-file <file>', 'Path to the concept file', 'prd/concept.txt')
    .option('-p, --participants <experts>', 'Comma-separated list of expert names/descriptions')
    .option('-o, --output <file>', 'Output file for the discussion', 'prd/discussion.txt')
    .option('-r, --refine-concept', 'Apply recommendations to concept file')
    .option('-s, --summary', 'Extract and display summary insights')
    .option('-i, --insights-file <file>', 'Path to save extracted insights (JSON format)')
    .action(async (options) => {
      try {
        // Mostrar el banner personalizado de PRD
        displayBanner(true);
        
        // Import display integration
        const { withDisplay } = await import('./command-display.js');
        
        // Use withDisplay wrapper for consistent error handling and display
        await withDisplay(async (opts) => {
          const { display } = opts;
          
          // Check if we have participants (required for non-interactive mode)
          if (!options.participants && process.env.NON_INTERACTIVE === 'true') {
            display.displayError({
              title: 'Missing Required Parameter',
              message: 'Error: --participants parameter is required in non-interactive mode',
              tips: [
                'Provide a comma-separated list of experts with --participants',
                'Example: --participants="Product Manager,UX Designer,Software Engineer"'
              ]
            });
            process.exit(1);
          }
          
          // Import the interactive round table function
          const { interactiveRoundTable } = await import('./round-table-command.js');
          
          // Set summary extraction flag based on option
          if (options.summary) {
            options.extractSummary = true;
          }
          
          // Run the interactive round table
          const result = await interactiveRoundTable(options, display);
          
          // Display success message with the new templates
          if (result?.hasDiscussion) {
            if (result.summaryExtracted && result.insights) {
              // Use the dedicated template for displaying insights
              const insightsDisplay = (await import('./display-templates.js')).default.discussionInsights(result.insights);
              console.log(insightsDisplay);
              
              display.displaySuccess({
                title: 'Expert Discussion and Insights Generated',
                message: `Discussion has been generated and insights extracted`,
                details: `Participants: ${result.participants.join(', ')}`,
                nextSteps: [
                  `Full discussion saved to: ${result.outputFile}`,
                  `Extracted insights saved to: ${result.insightsFile}`,
                  result.conceptRefined 
                    ? `The concept file (${result.conceptFile}) has been updated with recommendations`
                    : `Run 'task-master refine-concept --concept-file=${result.conceptFile} --discussion-file=${result.outputFile}' to apply recommendations`,
                  `Or proceed directly to 'task-master generate-prd-file --concept-file=${result.conceptFile}'`
                ]
              });
            } else {
              display.displaySuccess({
                title: 'Expert Discussion Generated',
                message: `Discussion has been generated and saved to ${result.outputFile}`,
                details: `Participants: ${result.participants.join(', ')}`,
                nextSteps: [
                  `Review the discussion in ${result.outputFile}`,
                  result.conceptRefined 
                    ? `The concept file (${result.conceptFile}) has been updated with recommendations`
                    : `Run 'task-master refine-concept --concept-file=${result.conceptFile} --discussion-file=${result.outputFile}' to apply recommendations`,
                  `Or proceed directly to 'task-master generate-prd-file --concept-file=${result.conceptFile}'`
                ]
              });
            }
          }
          
          return result;
        })(options);
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
    
  // refine-concept command (improve concept)
  programInstance
    .command('refine-concept')
    .description('Improve and deepen a concept with additional insights')
    .option('-c, --concept-file <file>', 'Path to the concept file', 'prd/concept.txt')
    .option('-p, --prompt <text>', 'Custom prompt for refinement')
    .option('-d, --discussion-file <file>', 'Path to discussion file to incorporate insights', '')
    .option('-o, --output <file>', 'Output file for the refined concept', 'prd/concept.txt')
    .option('--no-history', 'Disable version history tracking')
    .option('--no-preview', 'Skip showing change preview')
    .option('--skip-feedback', 'Skip showing real-time feedback')
    .action(async (options) => {
      try {
        // Mostrar el banner personalizado de PRD
        displayBanner(true);
        
        // Import display integration
        const { withDisplay } = await import('./command-display.js');
        
        // Use withDisplay wrapper for consistent error handling and display
        await withDisplay(async (opts) => {
          const { display } = opts;
          
          // Check if we have at least a prompt or discussion file in non-interactive mode
          if (!options.prompt && !options.discussionFile && process.env.NON_INTERACTIVE === 'true') {
            display.displayError({
              title: 'Missing Required Parameter',
              message: 'Error: Either --prompt or --discussion-file must be provided in non-interactive mode',
              tips: [
                'Provide a custom prompt with --prompt="Your refinement prompt"',
                'Or specify a discussion file with --discussion-file=path/to/discussion.txt'
              ]
            });
            process.exit(1);
          }
          
          // Import the interactive refine concept function
          const { interactiveRefineConcept } = await import('./refine-concept-command.js');
          
          // Run the interactive refine concept command
          const result = await interactiveRefineConcept(options, display);
          
          // Display success message with the new templates
          if (result?.hasRefinement) {
            // Get the concept title
            const title = result.refinedContent 
              ? result.refinedContent.split('\n')[0].replace(/^#+\s+/, '') 
              : 'Concept';
            
            display.displaySuccess({
              title: 'Concept Refinement Complete',
              message: `Refined concept "${title}" has been saved`,
              details: `Output file: ${result.outputFile}`,
              nextSteps: [
                `Review the refined concept in ${result.outputFile}`,
                `Run 'task-master generate-prd-file --concept-file=${result.outputFile}' to create a PRD`
              ]
            });
          }
          
          return result;
        })(options);
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
    
  // generate-prd-file command (convert concept to PRD)
  programInstance
    .command('generate-prd-file')
    .description('Convert a concept into a detailed PRD')
    .option('-c, --concept-file <file>', 'Path to the concept file', 'prd/concept.txt')
    .option('-t, --template <file>', 'Reference template structure', '')
    .option('-o, --output <file>', 'Output file for the PRD', 'prd/prd.txt')
    .option('-r, --research', 'Use Perplexity AI for research-backed generation')
    .option('-i, --interactive', 'Use interactive mode with prompts')
    .option('-p, --preview', 'Show a preview of the PRD before generating')
    .option('-f, --format <format>', 'Output format (markdown, plaintext, html)', 'markdown')
    .option('-s, --style <style>', 'Detail level (standard, detailed, minimal)', 'standard')
    .option('--sections <list>', 'Comma-separated list of sections to include', parseList)
    .action(async (options) => {
      try {
        // Mostrar el banner personalizado de PRD
        displayBanner(true);
        
        // Check if interactive mode is enabled
        if (options.interactive) {
          console.log(chalk.blue('Starting interactive PRD generation...'));
          
          // Import the interactive module
          const { interactivePRDGeneration } = await import('./prd-command.js');
          
          // Get options from interactive session
          const prdOptions = await interactivePRDGeneration(options);
          
          // If the user cancelled, return early
          if (!prdOptions.success) {
            console.log(chalk.yellow(prdOptions.message));
            return;
          }
          
          // Generate PRD with the interactive options
          const { generatePRDFile } = await import('./task-manager.js');
          await generatePRDFile(
            prdOptions.conceptFile,
            prdOptions.templateFile,
            prdOptions.outputFile,
            prdOptions.useResearch,
            prdOptions.detailedParams
          );
        } else {
          // Non-interactive mode
          console.log(chalk.blue('Starting PRD generation...'));
          
          // Check if concept file exists
          const fs = await import('fs');
          if (!fs.existsSync(options.conceptFile)) {
            console.error(chalk.red(`Concept file not found: ${options.conceptFile}`));
            return;
          }
          
          // Validate format option
          const validFormats = ['markdown', 'plaintext', 'html'];
          if (!validFormats.includes(options.format)) {
            console.error(chalk.red(`Invalid format: ${options.format}. Must be one of: ${validFormats.join(', ')}`));
            return;
          }
          
          // Validate style option
          const validStyles = ['standard', 'detailed', 'minimal'];
          if (!validStyles.includes(options.style)) {
            console.error(chalk.red(`Invalid style: ${options.style}. Must be one of: ${validStyles.join(', ')}`));
            return;
          }
          
          // Prepare detailed parameters
          const detailedParams = {
            format: options.format,
            style: options.style
          };
          
          // Add sections if provided
          if (options.sections && options.sections.length > 0) {
            detailedParams.sections = options.sections;
          }
          
          // Adjust file extension based on format if needed
          if (options.format !== 'plaintext') {
            const path = await import('path');
            const outputExt = path.extname(options.output);
            if (outputExt === '.txt' || outputExt === '') {
              const basePath = outputExt === '' ? options.output : options.output.slice(0, -4);
              const newExt = options.format === 'markdown' ? '.md' : '.html';
              options.output = basePath + newExt;
            }
          }
          
          // Show preview if requested
          if (options.preview) {
            try {
              console.log(chalk.blue('Generating PRD preview...'));
              const boxen = (await import('boxen')).default;
              const { generatePRDPreview } = await import('./ai-services.js');
              
              // Read concept file
              const conceptContent = fs.readFileSync(options.conceptFile, 'utf8');
              
              // Generate and display preview
              const previewContent = await generatePRDPreview(
                conceptContent,
                options.template,
                options.research,
                detailedParams
              );
              
              console.log(chalk.green('\nPRD Preview:'));
              console.log(boxen(previewContent, {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'blue',
                width: 80,
                wrap: {
                  wrapWidth: 76,
                  trim: true,
                  hard: true
                }
              }));
              
              // Ask for confirmation to proceed
              const { prompt } = await import('./utils.js');
              const proceed = await prompt('Generate full PRD with these parameters? (y/N): ');
              if (proceed.toLowerCase() !== 'y') {
                console.log(chalk.yellow('PRD generation cancelled.'));
                return;
              }
            } catch (error) {
              console.error(chalk.red(`Error generating preview: ${error.message}`));
              
              // Ask user if they want to continue despite preview error
              const { prompt } = await import('./utils.js');
              const proceed = await prompt('Continue with PRD generation anyway? (y/N): ');
              if (proceed.toLowerCase() !== 'y') {
                console.log(chalk.yellow('PRD generation cancelled.'));
                return;
              }
            }
          }
          
          try {
            // Generate PRD with CLI options
            const { generatePRDFile } = await import('./task-manager.js');
            await generatePRDFile(
              options.conceptFile,
              options.template,
              options.output,
              options.research,
              detailedParams
            );
          } catch (error) {
            console.error(chalk.red(`Error generating PRD: ${error.message}`));
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
    
  // Add more commands as needed...
  
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
    
    // Setup and parse
    const programInstance = setupCLI();
    await programInstance.parseAsync(argv);
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

/**
 * Parse a comma-separated list into an array
 * @param {string} value - Comma-separated list
 * @returns {string[]} Parsed array
 */
function parseList(value) {
  if (!value) return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

export {
  registerCommands,
  setupCLI,
  runCLI
}; 