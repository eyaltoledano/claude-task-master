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

import { CONFIG, log, readJSON, writeJSON } from './utils.js';
import { getTaskProvider } from './task-provider-factory.js';

import {
	displayBanner,
	displayHelp,
	displayNextTask,
	displayTaskById,
	displayTaskList,
	displayComplexityReport,
	getStatusWithColor,
	confirmTaskOverwrite,
	startLoadingIndicator,
	stopLoadingIndicator
} from './ui.js';

import { initializeProject } from '../init.js';

import {
	addDependency,
	removeDependency,
	validateDependenciesCommand,
	fixDependenciesCommand
} from './dependency-manager.js';

import * as TaskManager from './task-manager.js';

/**
 * Configure and register CLI commands
 * @param {Object} program - Commander program instance
 */
function registerCommands(programInstance) {
	programInstance.on('option:unknown', function (unknownOption) {
		const commandName = this._name || 'unknown';
		console.error(chalk.red(`Error: Unknown option '${unknownOption}'`));
		console.error(
			chalk.yellow(
				`Run 'task-master ${commandName} --help' to see available options`
			)
		);
		process.exit(1);
	});

	programInstance.on('--help', function () {
		displayHelp();
	});

	programInstance
		.command('parse-prd')
		.description('Parse a PRD file and generate tasks')
		.argument('[file]', 'Path to the PRD file')
		.option(
			'-i, --input <file>',
			'Path to the PRD file (alternative to positional argument)'
		)
		.option('-o, --output <file>', 'Output file path', 'tasks/tasks.json')
		.option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
		.option('-f, --force', 'Skip confirmation when overwriting existing tasks')
		.action(async (file, options) => {
			const inputFile = file || options.input || 'scripts/prd.txt';
			const outputPath = options.output;
			const numTasks = parseInt(options.numTasks, 10);
			const force = options.force || false;

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

			if (!(await confirmOverwriteIfNeeded())) return;

			await TaskManager.parsePRD(inputFile, outputPath, numTasks);
		});

	programInstance
		.command('update')
		.description(
			'Update multiple tasks with ID >= "from" based on new information or implementation changes'
		)
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option(
			'--from <id>',
			'Task ID to start updating from (tasks with ID >= this value will be updated)',
			'1'
		)
		.option(
			'-p, --prompt <text>',
			'Prompt explaining the changes or new context (required)'
		)
		.option(
			'-r, --research',
			'Use Perplexity AI for research-backed task updates'
		)
		.action(async (options) => {
			const tasksPath = options.file;
			const fromId = options.from;
			const prompt = options.prompt;
			const useResearch = options.research || false;

			if (process.argv.includes('--id') || process.argv.some((arg) => arg.startsWith('--id='))) {
				console.error(
					chalk.red('Error: The update command uses --from=<id>, not --id=<id>')
				);
				console.log(chalk.yellow('\nTo update multiple tasks:'));
				console.log(
					`  task-master update --from=${fromId} --prompt="Your prompt here"`
				);
				console.log(
					chalk.yellow(
						'\nTo update a single specific task, use the update-task command instead:'
					)
				);
				console.log(
					`  task-master update-task --id=<id> --prompt="Your prompt here"`
				);
				process.exit(1);
			}

			if (!prompt) {
				console.error(
					chalk.red(
						'Error: --prompt parameter is required. Please provide information about the changes.'
					)
				);
				process.exit(1);
			}

			console.log(
				chalk.blue(
					`Updating tasks from ID/Key >= ${fromId} using ${TASK_PROVIDER_TYPE} provider...`
				)
			);
			console.log(chalk.blue(`Tasks file: ${tasksPath}`));

			if (useResearch) {
				console.log(
					chalk.blue('Using Perplexity AI for research-backed task updates')
				);
			}

			await TaskProvider.updateTasks(tasksPath, fromId, prompt, useResearch);
		});

	programInstance
		.command('update-task')
		.description(
			'Update a single specific task by ID with new information (use --id parameter)'
		)
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-i, --id <id>', 'Task ID to update (required)')
		.option(
			'-p, --prompt <text>',
			'Prompt explaining the changes or new context (required)'
		)
		.option(
			'-r, --research',
			'Use Perplexity AI for research-backed task updates'
		)
		.action(async (options) => {
			const taskId = options.id;
			const prompt = options.prompt;
			const useResearch = options.research || false;

			if (!taskId) {
				console.error(chalk.red('Error: --id parameter is required'));
				console.log(
					chalk.yellow(
						'Usage example: task-master update-task --id=23 --prompt="Update with new information"'
					)
				);
				process.exit(1);
			}

			if (!prompt) {
				console.error(
					chalk.red(
						'Error: --prompt parameter is required. Please provide information about the changes.'
					)
				);
				process.exit(1);
			}

			console.log(chalk.blue(`Updating task ${taskId}...`));
			let loadingIndicator = startLoadingIndicator('Processing update...');

			try {
				const provider = await getTaskProvider();
				const updateData = {
					prompt: prompt,
					research: useResearch,
					file: options.file
				};
				const updatedTask = await provider.updateTask(taskId, updateData);
				stopLoadingIndicator(loadingIndicator);
				console.log(chalk.green(`Successfully updated task ${taskId}:`));
				displayTaskById(updatedTask);
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to update task ${taskId}: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('update-subtask')
		.description('Append information to a specific subtask')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-i, --id <id>', 'Subtask ID to update (e.g., 12.3) (required)')
		.option('-p, --prompt <text>', 'Information to append (required)')
		.option(
			'-r, --research',
			'Use Perplexity AI for research-backed task updates'
		)
		.action(async (options) => {
			const subtaskId = options.id;
			const prompt = options.prompt;
			const useResearch = options.research || false;

			if (!subtaskId || !subtaskId.includes('.')) {
				console.error(
					chalk.red('Error: --id must be a valid subtask ID (e.g., 12.3)')
				);
				process.exit(1);
			}

			if (!prompt) {
				console.error(chalk.red('Error: --prompt parameter is required.'));
				process.exit(1);
			}

			console.log(chalk.blue(`Appending to subtask ${subtaskId}...`));
			let loadingIndicator = startLoadingIndicator('Processing update...');

			try {
				const provider = await getTaskProvider();
				const updateData = {
					prompt: prompt,
					research: useResearch,
					file: options.file
				};
				const updatedSubtask = await provider.updateSubtask(subtaskId, updateData);
				stopLoadingIndicator(loadingIndicator);
				console.log(chalk.green(`Successfully appended to subtask ${subtaskId}:`));
				displayTaskById(updatedSubtask);
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to update subtask ${subtaskId}: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('list')
		.description('List tasks, optionally filtering by status')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-s, --status <status>', 'Filter by task status')
		.option('--with-subtasks', 'Include subtasks in the list')
		.action(async (options) => {
			let loadingIndicator = startLoadingIndicator('Fetching tasks...');
			try {
				const provider = await getTaskProvider();
				const providerOptions = {
					status: options.status,
					withSubtasks: options.withSubtasks,
					file: options.file
				};
				const result = await provider.getTasks(providerOptions);

				stopLoadingIndicator(loadingIndicator);

				if (result && result.tasks) {
					displayTaskList(result.tasks, options.status, options.withSubtasks);
				} else {
					log('warn', 'No tasks found or provider returned unexpected data.');
				}
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to list tasks: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('show')
		.description('Show details for a specific task or subtask')
		.argument('[id]', 'ID of the task/subtask to show')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-i, --id <id>', 'ID of the task/subtask to show (alternative to positional argument)')
		.action(async (idArg, options) => {
			const taskId = idArg || options.id;
			if (!taskId) {
				console.error(chalk.red("Error: Please provide a task ID."));
				console.log(chalk.yellow("Usage: task-master show <taskId>"));
				process.exit(1);
			}
			let loadingIndicator = startLoadingIndicator(`Fetching details for task ${taskId}...`);
			try {
				const provider = await getTaskProvider();
				const providerOptions = { file: options.file };
				const task = await provider.getTask(taskId, providerOptions);
				stopLoadingIndicator(loadingIndicator);
				if (task) {
					displayTaskById(task);
				} else {
					log('warn', `Task with ID ${taskId} not found.`);
				}
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to show task ${taskId}: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('next')
		.description('Show the next available task based on dependencies and status')
		.option('-f, --file <file>', 'Path to the tasks file')
		.action(async (options) => {
			let loadingIndicator = startLoadingIndicator('Finding next task...');
			try {
				const provider = await getTaskProvider();
				const providerOptions = { file: options.file };
				const nextTaskResult = await provider.nextTask(providerOptions);
				stopLoadingIndicator(loadingIndicator);
				if (nextTaskResult && nextTaskResult.nextTask) {
					displayNextTask(nextTaskResult.nextTask, nextTaskResult.allTasks || []);
				} else {
					log('info', 'No pending tasks found or provider returned no next task.');
				}
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to find next task: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('set-status')
		.description('Update the status of one or more tasks')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-i, --id <id>', 'Task ID(s) to update (comma-separated)')
		.option('-s, --status <status>', 'New status to set')
		.action(async (options) => {
			if (!options.id || !options.status) {
				console.error(chalk.red('Error: Both --id and --status are required.'));
				process.exit(1);
			}
			let loadingIndicator = startLoadingIndicator(`Setting status for task(s) ${options.id} to ${options.status}...`);
			try {
				const provider = await getTaskProvider();
				const providerOptions = { file: options.file };
				await provider.setTaskStatus(options.id, options.status, providerOptions);
				stopLoadingIndicator(loadingIndicator);
				console.log(chalk.green(`Successfully set status for task(s) ${options.id} to ${options.status}.`));
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to set task status: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('expand')
		.description('Break down tasks into detailed subtasks')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option('-i, --id <id>', 'Task ID to expand')
		.option('-a, --all', 'Expand all tasks')
		.option(
			'-n, --num <number>',
			'Number of subtasks to generate',
			CONFIG.defaultSubtasks.toString()
		)
		.option(
			'--research',
			'Enable Perplexity AI for research-backed subtask generation'
		)
		.option(
			'-p, --prompt <text>',
			'Additional context to guide subtask generation'
		)
		.option(
			'--force',
			'Force regeneration of subtasks for tasks that already have them'
		)
		.action(async (options) => {
			const tasksPath = options.file;
			const taskId = options.id;
			const numSubtasks = options.num || CONFIG.defaultSubtasks;
			const useResearch = options.research || false;
			const additionalContext = options.prompt || '';
			const forceFlag = options.force || false;

			if (options.all) {
				console.log(
					chalk.blue(`Expanding all tasks with ${numSubtasks} subtasks each...`)
				);
				if (useResearch) {
					console.log(
						chalk.blue(
							'Using Perplexity AI for research-backed subtask generation'
						)
					);
				} else {
					console.log(
						chalk.yellow('Research-backed subtask generation disabled')
					);
				}
				if (additionalContext) {
					console.log(chalk.blue(`Additional context: "${additionalContext}"`));
				}
				await TaskProvider.expandAllTasks(
					tasksPath,
					numSubtasks,
					useResearch,
					additionalContext,
					forceFlag
				);
			} else if (taskId) {
				console.log(
					chalk.blue(`Expanding task ${taskId} with ${numSubtasks} subtasks...`)
				);
				if (useResearch) {
					console.log(
						chalk.blue(
							'Using Perplexity AI for research-backed subtask generation'
						)
					);
				} else {
					console.log(
						chalk.yellow('Research-backed subtask generation disabled')
					);
				}
				if (additionalContext) {
					console.log(chalk.blue(`Additional context: "${additionalContext}"`));
				}
				await TaskProvider.expandTask(
					tasksPath,
					taskId,
					numSubtasks,
					useResearch,
					additionalContext
				);
			} else {
				console.error(
					chalk.red(
						'Error: Please specify a task ID with --id=<id> or use --all to expand all tasks.'
					)
				);
			}
		});

	programInstance
		.command('analyze-complexity')
		.description(
			`Analyze tasks and generate expansion recommendations${chalk.reset('')}`
		)
		.option(
			'-o, --output <file>',
			'Output file path for the report',
			'scripts/task-complexity-report.json'
		)
		.option(
			'-m, --model <model>',
			'LLM model to use for analysis (defaults to configured model)'
		)
		.option(
			'-t, --threshold <number>',
			'Minimum complexity score to recommend expansion (1-10)',
			'5'
		)
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option(
			'-r, --research',
			'Use Perplexity AI for research-backed complexity analysis'
		)
		.action(async (options) => {
			const tasksPath = options.file || 'tasks/tasks.json';
			const outputPath = options.output;
			const modelOverride = options.model;
			const thresholdScore = parseFloat(options.threshold);
			const useResearch = options.research || false;

			console.log(chalk.blue(`Analyzing task complexity using ${TASK_PROVIDER_TYPE} provider...`));
			console.log(chalk.blue(`Output report will be saved to: ${outputPath}`));

			if (useResearch) {
				console.log(
					chalk.blue(
						'Using Perplexity AI for research-backed complexity analysis'
					)
				);
			}

			await TaskProvider.analyzeTaskComplexity({ ...options, threshold: thresholdScore });
		});

	programInstance
		.command('complexity-report')
		.description(`Display the complexity analysis report${chalk.reset('')}`)
		.option(
			'-f, --file <file>',
			'Path to the report file',
			'scripts/task-complexity-report.json'
		)
		.action(async (options) => {
			console.log(chalk.blue('Displaying complexity report from local file...'));
			displayComplexityReport(options.file);
		});

	programInstance
		.command('init')
		.description('Initialize a new project with Task Master structure')
		.option('-y, --yes', 'Skip prompts and use default values')
		.option('-n, --name <name>', 'Project name')
		.option('-d, --description <description>', 'Project description')
		.option('-v, --version <version>', 'Project version', '0.1.0')
		.option('-a, --author <author>', 'Author name')
		.option('--skip-install', 'Skip installing dependencies')
		.option('--dry-run', 'Show what would be done without making changes')
		.option('--aliases', 'Add shell aliases (tm, taskmaster)')
		.action(async (cmdOptions) => {
			console.log('DEBUG: Running init command action in commands.js');
			console.log(
				'DEBUG: Options received by action:',
				JSON.stringify(cmdOptions)
			);
			await initializeProject(cmdOptions);
		});

	programInstance
		.command('generate')
		.description('Generate task files from tasks.json')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option('-o, --output <dir>', 'Output directory', 'tasks')
		.action(async (options) => {
			if (TASK_PROVIDER_TYPE === 'jira') {
				console.warn(chalk.yellow('Warning: The `generate` command currently only operates on the local tasks.json file format. Generating based on current local state if available.'));
				await TaskManager.generateTaskFiles(options.file, options.output || path.dirname(options.file));
			} else {
				console.log(chalk.blue('Generating local task markdown files...'));
				await TaskManager.generateTaskFiles(options.file, options.output || path.dirname(options.file));
			}
		});

	programInstance
		.command('add-task')
		.description('Add a new task using AI')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-p, --prompt <text>', 'Description of the task to add (required)')
		.option('--title <title>', 'Task title (for manual task creation)')
		.option('--description <description>', 'Task description (for manual task creation)')
		.option('--details <details>', 'Implementation details (for manual task creation)')
		.option('--testStrategy <testStrategy>', 'Test strategy (for manual task creation)')
		.option('--priority <priority>', 'Task priority (high, medium, low)')
		.option('-d, --dependencies <ids>', 'Comma-separated list of task IDs this task depends on')
		.option('-r, --research', 'Use Perplexity AI for research-backed task creation')
		.action(async (options) => {
			if (!options.prompt && !options.title) {
				console.error(chalk.red("Error: Either --prompt or --title must be provided."));
				process.exit(1);
			}
			let loadingIndicator = startLoadingIndicator('Adding new task...');
			try {
				const provider = await getTaskProvider();
				const taskData = {
					prompt: options.prompt,
					title: options.title,
					description: options.description,
					details: options.details,
					testStrategy: options.testStrategy,
					priority: options.priority,
					dependencies: options.dependencies ? options.dependencies.split(',').map(id => id.trim()) : [],
					research: options.research || false,
					file: options.file
				};

				const newTask = await provider.addTask(taskData);
				stopLoadingIndicator(loadingIndicator);
				console.log(chalk.green(`Successfully added new task:`));
				displayTaskById(newTask);
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to add task: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('add-subtask')
		.description('Add a subtask to an existing task')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-p, --parent <id>', 'Parent Task ID (required)')
		.option('-i, --task-id <id>', 'Existing Task ID to convert into a subtask')
		.option('-t, --title <title>', 'Title for the new subtask (required if not using --task-id)')
		.option('-d, --description <text>', 'Description for the new subtask')
		.option('--details <text>', 'Implementation details for the new subtask')
		.option('--dependencies <ids>', 'Comma-separated dependency IDs for the new subtask')
		.option('-s, --status <status>', 'Status for the new subtask (default: pending)')
		.option('--skip-generate', 'Skip regenerating task files after adding')
		.action(async (options) => {
			if (!options.parent) {
				console.error(chalk.red('Error: --parent <id> is required.'));
				process.exit(1);
			}
			if (!options.taskId && !options.title) {
				console.error(
					chalk.red(
						'Error: Either --task-id <id> or --title <title> is required.'
					)
				);
				process.exit(1);
			}
			let loadingIndicator = startLoadingIndicator('Adding subtask...');
			try {
				const provider = await getTaskProvider();
				const subtaskData = {
					title: options.title,
					description: options.description,
					details: options.details,
					dependencies: options.dependencies ? options.dependencies.split(',').map(id => id.trim()) : [],
					status: options.status || 'pending',
				};
				const providerOptions = {
					file: options.file,
					skipGenerate: options.skipGenerate
				};

				const newSubtask = await provider.addSubtask(options.parent, options.taskId, subtaskData, providerOptions);
				stopLoadingIndicator(loadingIndicator);
				console.log(chalk.green(`Successfully added subtask ${newSubtask.id} to parent ${options.parent}:`));
				displayTaskById(newSubtask);
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to add subtask: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('remove-subtask')
		.description('Remove a subtask from its parent task')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-i, --id <id>', 'Subtask ID(s) to remove (e.g., 15.2) (required)')
		.option('-c, --convert', 'Convert the subtask to a standalone task instead of deleting')
		.option('--skip-generate', 'Skip regenerating task files after removing')
		.action(async (options) => {
			const subtaskIds = options.id;
			if (!subtaskIds) {
				console.error(chalk.red('Error: --id parameter is required.'));
				process.exit(1);
			}
			let loadingIndicator = startLoadingIndicator(`Removing subtask(s) ${subtaskIds}...`);
			try {
				const provider = await getTaskProvider();
				const providerOptions = {
					convert: options.convert || false,
					skipGenerate: options.skipGenerate,
					file: options.file
				};
				await provider.removeSubtask(subtaskIds, providerOptions);
				stopLoadingIndicator(loadingIndicator);
				console.log(chalk.green(`Successfully removed subtask(s): ${subtaskIds}`));
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to remove subtask(s): ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('remove-task')
		.description('Permanently remove a task or subtask')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-i, --id <id>', 'Task or Subtask ID to remove (required)')
		.option('-y, --yes', 'Skip confirmation prompt')
		.action(async (options) => {
			const taskId = options.id;
			if (!taskId) {
				console.error(chalk.red('Error: --id parameter is required.'));
				process.exit(1);
			}

			if (!options.yes) {
				const { confirm } = await inquirer.prompt([
					{
						type: 'confirm',
						name: 'confirm',
						message: `Are you sure you want to permanently remove task/subtask ${taskId}? This cannot be undone.`, 
						default: false,
					},
				]);
				if (!confirm) {
					console.log(chalk.yellow('Operation cancelled.'));
					return;
				}
			}

			let loadingIndicator = startLoadingIndicator(`Removing task ${taskId}...`);
			try {
				const provider = await getTaskProvider();
				const providerOptions = { file: options.file };
				await provider.removeTask(taskId, providerOptions);
				stopLoadingIndicator(loadingIndicator);
				console.log(chalk.green(`Successfully removed task/subtask: ${taskId}`));
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to remove task/subtask ${taskId}: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('add-dependency')
		.description('Add a dependency between two tasks')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-i, --id <id>', 'Task ID that will depend on another task (required)')
		.option('-d, --depends-on <id>', 'Task ID that will become a dependency (required)')
		.action(async (options) => {
			const taskId = options.id;
			const dependsOnId = options.dependsOn;
			if (!taskId || !dependsOnId) {
				console.error(chalk.red('Error: Both --id and --depends-on parameters are required.'));
				process.exit(1);
			}

			let loadingIndicator = startLoadingIndicator(`Adding dependency: ${taskId} depends on ${dependsOnId}...`);
			try {
				const provider = await getTaskProvider();
				const providerOptions = { file: options.file };
				await provider.addDependency(taskId, dependsOnId, providerOptions);
				stopLoadingIndicator(loadingIndicator);
				console.log(chalk.green(`Successfully added dependency: Task ${taskId} now depends on ${dependsOnId}`));
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to add dependency: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('remove-dependency')
		.description('Remove a dependency from a task')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-i, --id <id>', 'Task ID to remove dependency from (required)')
		.option('-d, --depends-on <id>', 'Task ID to remove as a dependency (required)')
		.action(async (options) => {
			const taskId = options.id;
			const dependsOnId = options.dependsOn;
			if (!taskId || !dependsOnId) {
				console.error(chalk.red('Error: Both --id and --depends-on parameters are required.'));
				process.exit(1);
			}

			let loadingIndicator = startLoadingIndicator(`Removing dependency: ${taskId} no longer depends on ${dependsOnId}...`);
			try {
				const provider = await getTaskProvider();
				const providerOptions = { file: options.file };
				await provider.removeDependency(taskId, dependsOnId, providerOptions);
				stopLoadingIndicator(loadingIndicator);
				console.log(chalk.green(`Successfully removed dependency: Task ${taskId} no longer depends on ${dependsOnId}`));
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to remove dependency: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('validate-dependencies')
		.description('Check tasks for dependency issues (circular, non-existent)')
		.option('-f, --file <file>', 'Path to the tasks file')
		.action(async (options) => {
			let loadingIndicator = startLoadingIndicator('Validating dependencies...');
			try {
				const provider = await getTaskProvider();
				const providerOptions = { file: options.file };
				const { valid, errors } = await provider.validateDependencies(providerOptions);
				stopLoadingIndicator(loadingIndicator);
				if (valid) {
					console.log(chalk.green('Dependency validation successful: No issues found.'));
				} else {
					console.log(chalk.red('Dependency validation failed:'));
					errors.forEach(err => console.log(chalk.red(`- ${err}`)));
					process.exit(1);
				}
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to validate dependencies: ${error.message}`);
				process.exit(1);
			}
		});

	programInstance
		.command('fix-dependencies')
		.description('Automatically fix invalid dependencies')
		.option('-f, --file <file>', 'Path to the tasks file')
		.option('-y, --yes', 'Skip confirmation prompt')
		.action(async (options) => {
			if (!options.yes) {
				const answers = await inquirer.prompt([{ type: 'confirm', name: 'confirmFix', message: 'Are you sure you want to attempt to fix invalid dependencies? This might alter your task data.', default: false }]);
				if (!answers.confirmFix) { console.log(chalk.yellow('Operation cancelled.')); return; }
			}

			let loadingIndicator = startLoadingIndicator('Attempting to fix dependencies...');
			try {
				const provider = await getTaskProvider();
				const providerOptions = { file: options.file };
				const report = await provider.fixDependencies(providerOptions);
				stopLoadingIndicator(loadingIndicator);
				console.log(chalk.green('Dependency fix attempt complete:'));
				if (report && typeof report.fixedCount === 'number') {
					if (report.fixedCount > 0) {
						console.log(chalk.green(`- ${report.fixedCount} issues fixed.`));
						if (report.details && Array.isArray(report.details)) {
							report.details.forEach(fix => console.log(chalk.cyan(`  - ${fix}`)));
						}
					} else {
						console.log(chalk.yellow('- No dependency issues found or fixed.'));
					}
				} else {
					console.log(chalk.yellow('- Fix process completed (no detailed report available from provider).'));
				}
				console.log(chalk.blue('Run `taskmaster validate-dependencies` to confirm the results.'));
			} catch (error) {
				stopLoadingIndicator(loadingIndicator, true);
				log('error', `Failed to fix dependencies: ${error.message}`);
				process.exit(1);
			}
		});

	return programInstance;
}

function setupCLI() {
	const programInstance = program
		.name('dev')
		.description('AI-driven development task management')
		.version(() => {
			try {
				const packageJsonPath = path.join(process.cwd(), 'package.json');
				if (fs.existsSync(packageJsonPath)) {
					const packageJson = JSON.parse(
						fs.readFileSync(packageJsonPath, 'utf8')
					);
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

	programInstance.helpInformation = () => {
		displayHelp();
		return '';
	};

	registerCommands(programInstance);

	return programInstance;
}

async function checkForUpdate() {
	let currentVersion = CONFIG.projectVersion;
	try {
		const packageJsonPath = path.join(
			process.cwd(),
			'node_modules',
			'task-master-ai',
			'package.json'
		);
		if (fs.existsSync(packageJsonPath)) {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			currentVersion = packageJson.version;
		}
	} catch (error) {
		log('debug', `Error reading current package version: ${error.message}`);
	}

	return new Promise((resolve) => {
		const options = {
			hostname: 'registry.npmjs.org',
			path: '/task-master-ai',
			method: 'GET',
			headers: {
				Accept: 'application/vnd.npm.install-v1+json' // Lightweight response
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

					const needsUpdate =
						compareVersions(currentVersion, latestVersion) < 0;

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

function compareVersions(v1, v2) {
	const v1Parts = v1.split('.').map((p) => parseInt(p, 10));
	const v2Parts = v2.split('.').map((p) => parseInt(p, 10));

	for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
		const v1Part = v1Parts[i] || 0;
		const v2Part = v2Parts[i] || 0;

		if (v1Part < v2Part) return -1;
		if (v1Part > v2Part) return 1;
	}

	return 0;
}

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

async function runCLI(argv = process.argv) {
	try {
		if (process.stdout.isTTY) {
			displayBanner();
		}

		if (argv.length <= 2) {
			displayHelp();
			process.exit(0);
		}

		const updateCheckPromise = checkForUpdate();

		const programInstance = setupCLI();
		await programInstance.parseAsync(argv);

		const updateInfo = await updateCheckPromise;
		if (updateInfo.needsUpdate) {
			displayUpgradeNotification(
				updateInfo.currentVersion,
				updateInfo.latestVersion
			);
		}
	} catch (error) {
		console.error(chalk.red(`Error: ${error.message}`));

		if (CONFIG.debug) {
			console.error(error);
		}

		process.exit(1);
	}
}

export { registerCommands, setupCLI, runCLI, checkForUpdate, compareVersions, displayUpgradeNotification };
