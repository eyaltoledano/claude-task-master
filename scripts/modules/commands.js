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
	removeTask,
	findTaskById,
	taskExists
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
	confirmTaskOverwrite,
	startLoadingIndicator,
	stopLoadingIndicator
} from './ui.js';

import { initializeProject } from '../init.js';

/**
 * Configure and register CLI commands
 * @param {Object} program - Commander program instance
 */
function registerCommands(programInstance) {
	// Add global error handler for unknown options
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

	// Default help
	programInstance.on('--help', function () {
		displayHelp();
	});

	// parse-prd command
	programInstance
		.command('parse-prd')
		.description('Parse a PRD file and generate tasks')
		.argument('[file]', 'Path to the PRD file')
		.option(
			'-i, --input <file>',
			'Path to the PRD file (alternative to positional argument)'
		)
		.option('-o, --output <file>', 'Output file path', '.taskmaster/tasks.json')
		.option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
		.option('-f, --force', 'Skip confirmation when overwriting existing tasks')
		.option(
			'--append',
			'Append new tasks to existing tasks.json instead of overwriting'
		)
		.action(async (file, options) => {
			// Use input option if file argument not provided
			const inputFile = file || options.input;
			const defaultPrdPath = '.taskmaster/scripts/prd.txt';
			const numTasks = parseInt(options.numTasks, 10);
			const outputPath = options.output;
			const force = options.force || false;
			const append = options.append || false;

			// Helper function to check if tasks.json exists and confirm overwrite
			async function confirmOverwriteIfNeeded() {
				if (fs.existsSync(outputPath) && !force && !append) {
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
					if (!(await confirmOverwriteIfNeeded())) return;

					console.log(chalk.blue(`Generating ${numTasks} tasks...`));
					await parsePRD(defaultPrdPath, outputPath, numTasks, { append });
					return;
				}

				console.log(
					chalk.yellow(
						'No PRD file specified and default PRD file not found at .taskmaster/scripts/prd.txt.'
					)
				);
				console.log(
					boxen(
						chalk.white.bold('Parse PRD Help') +
							'\n\n' +
							chalk.cyan('Usage:') +
							'\n' +
							`  task-master parse-prd <prd-file.txt> [options]\n\n` +
							chalk.cyan('Options:') +
							'\n' +
							'  -i, --input <file>       Path to the PRD file (alternative to positional argument)\n' +
							'  -o, --output <file>      Output file path (default: ".taskmaster/tasks.json")\n' +
							'  -n, --num-tasks <number> Number of tasks to generate (default: 10)\n' +
							'  -f, --force              Skip confirmation when overwriting existing tasks\n' +
							'  --append                 Append new tasks to existing tasks.json instead of overwriting\n\n' +
							chalk.cyan('Example:') +
							'\n' +
							'  task-master parse-prd requirements.txt --num-tasks 15\n' +
							'  task-master parse-prd --input=requirements.txt\n' +
							'  task-master parse-prd --force\n' +
							'  task-master parse-prd requirements_v2.txt --append\n\n' +
							chalk.yellow('Note: This command will:') +
							'\n' +
							'  1. Look for a PRD file at .taskmaster/scripts/prd.txt by default\n' +
							'  2. Use the file specified by --input or positional argument if provided\n' +
							'  3. Generate tasks from the PRD and either:\n' +
							'     - Overwrite any existing tasks.json file (default)\n' +
							'     - Append to existing tasks.json if --append is used',
						{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
					)
				);
				return;
			}

			// Check for existing tasks.json before proceeding with specified input file
			if (!(await confirmOverwriteIfNeeded())) return;

			console.log(chalk.blue(`Parsing PRD file: ${inputFile}`));
			console.log(chalk.blue(`Generating ${numTasks} tasks...`));
			if (append) {
				console.log(chalk.blue('Appending to existing tasks...'));
			}

			await parsePRD(inputFile, outputPath, numTasks, { append });
		});

	// update command
	programInstance
		.command('update')
		.description(
			'Update multiple tasks with ID >= "from" based on new information or implementation changes'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
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
			const fromId = parseInt(options.from, 10);
			const prompt = options.prompt;
			const useResearch = options.research || false;

			// Check if there's an 'id' option which is a common mistake (instead of 'from')
			if (
				process.argv.includes('--id') ||
				process.argv.some((arg) => arg.startsWith('--id='))
			) {
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
					`Updating tasks from ID >= ${fromId} with prompt: "${prompt}"`
				)
			);
			console.log(chalk.blue(`Tasks file: ${tasksPath}`));

			if (useResearch) {
				console.log(
					chalk.blue('Using Perplexity AI for research-backed task updates')
				);
			}

			await updateTasks(tasksPath, fromId, prompt, useResearch);
		});

	// update-task command
	programInstance
		.command('update-task')
		.description(
			'Update a single specific task by ID with new information (use --id parameter)'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
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
			try {
				const tasksPath = options.file;

				// Validate required parameters
				if (!options.id) {
					console.error(chalk.red('Error: --id parameter is required'));
					console.log(
						chalk.yellow(
							'Usage example: task-master update-task --id=23 --prompt="Update with new information"'
						)
					);
					process.exit(1);
				}

				// Parse the task ID and validate it's a number
				const taskId = parseInt(options.id, 10);
				if (isNaN(taskId) || taskId <= 0) {
					console.error(
						chalk.red(
							`Error: Invalid task ID: ${options.id}. Task ID must be a positive integer.`
						)
					);
					console.log(
						chalk.yellow(
							'Usage example: task-master update-task --id=23 --prompt="Update with new information"'
						)
					);
					process.exit(1);
				}

				if (!options.prompt) {
					console.error(
						chalk.red(
							'Error: --prompt parameter is required. Please provide information about the changes.'
						)
					);
					console.log(
						chalk.yellow(
							'Usage example: task-master update-task --id=23 --prompt="Update with new information"'
						)
					);
					process.exit(1);
				}

				const prompt = options.prompt;
				const useResearch = options.research || false;

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					if (tasksPath === '.taskmaster/tasks.json') {
						console.log(
							chalk.yellow(
								'Hint: Run task-master init or task-master parse-prd to create tasks.json first'
							)
						);
					} else {
						console.log(
							chalk.yellow(
								`Hint: Check if the file path is correct: ${tasksPath}`
							)
						);
					}
					process.exit(1);
				}

				console.log(
					chalk.blue(`Updating task ${taskId} with prompt: "${prompt}"`)
				);
				console.log(chalk.blue(`Tasks file: ${tasksPath}`));

				if (useResearch) {
					// Verify Perplexity API key exists if using research
					if (!process.env.PERPLEXITY_API_KEY) {
						console.log(
							chalk.yellow(
								'Warning: PERPLEXITY_API_KEY environment variable is missing. Research-backed updates will not be available.'
							)
						);
						console.log(
							chalk.yellow('Falling back to Claude AI for task update.')
						);
					} else {
						console.log(
							chalk.blue('Using Perplexity AI for research-backed task update')
						);
					}
				}

				const result = await updateTaskById(
					tasksPath,
					taskId,
					prompt,
					useResearch
				);

				// If the task wasn't updated (e.g., if it was already marked as done)
				if (!result) {
					console.log(
						chalk.yellow(
							'\nTask update was not completed. Review the messages above for details.'
						)
					);
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error.message}`));

				// Provide more helpful error messages for common issues
				if (
					error.message.includes('task') &&
					error.message.includes('not found')
				) {
					console.log(chalk.yellow('\nTo fix this issue:'));
					console.log(
						'  1. Run task-master list to see all available task IDs'
					);
					console.log('  2. Use a valid task ID with the --id parameter');
				} else if (error.message.includes('API key')) {
					console.log(
						chalk.yellow(
							'\nThis error is related to API keys. Check your environment variables.'
						)
					);
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
		.description(
			'Update a subtask by appending additional timestamped information'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.option(
			'-i, --id <id>',
			'Subtask ID to update in format "parentId.subtaskId" (required)'
		)
		.option(
			'-p, --prompt <text>',
			'Prompt explaining what information to add (required)'
		)
		.option('-r, --research', 'Use Perplexity AI for research-backed updates')
		.action(async (options) => {
			try {
				const tasksPath = options.file;

				// Validate required parameters
				if (!options.id) {
					console.error(chalk.red('Error: --id parameter is required'));
					console.log(
						chalk.yellow(
							'Usage example: task-master update-subtask --id=5.2 --prompt="Add more details about the API endpoint"'
						)
					);
					process.exit(1);
				}

				// Validate subtask ID format (should contain a dot)
				const subtaskId = options.id;
				if (!subtaskId.includes('.')) {
					console.error(
						chalk.red(
							`Error: Invalid subtask ID format: ${subtaskId}. Subtask ID must be in format "parentId.subtaskId"`
						)
					);
					console.log(
						chalk.yellow(
							'Usage example: task-master update-subtask --id=5.2 --prompt="Add more details about the API endpoint"'
						)
					);
					process.exit(1);
				}

				if (!options.prompt) {
					console.error(
						chalk.red(
							'Error: --prompt parameter is required. Please provide information to add to the subtask.'
						)
					);
					console.log(
						chalk.yellow(
							'Usage example: task-master update-subtask --id=5.2 --prompt="Add more details about the API endpoint"'
						)
					);
					process.exit(1);
				}

				const prompt = options.prompt;
				const useResearch = options.research || false;

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					if (tasksPath === '.taskmaster/tasks.json') {
						console.log(
							chalk.yellow(
								'Hint: Run task-master init or task-master parse-prd to create tasks.json first'
							)
						);
					} else {
						console.log(
							chalk.yellow(
								`Hint: Check if the file path is correct: ${tasksPath}`
							)
						);
					}
					process.exit(1);
				}

				console.log(
					chalk.blue(`Updating subtask ${subtaskId} with prompt: "${prompt}"`)
				);
				console.log(chalk.blue(`Tasks file: ${tasksPath}`));

				if (useResearch) {
					// Verify Perplexity API key exists if using research
					if (!process.env.PERPLEXITY_API_KEY) {
						console.log(
							chalk.yellow(
								'Warning: PERPLEXITY_API_KEY environment variable is missing. Research-backed updates will not be available.'
							)
						);
						console.log(
							chalk.yellow('Falling back to Claude AI for subtask update.')
						);
					} else {
						console.log(
							chalk.blue(
								'Using Perplexity AI for research-backed subtask update'
							)
						);
					}
				}

				const result = await updateSubtaskById(
					tasksPath,
					subtaskId,
					prompt,
					useResearch
				);

				if (!result) {
					console.log(
						chalk.yellow(
							'\nSubtask update was not completed. Review the messages above for details.'
						)
					);
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error.message}`));

				// Provide more helpful error messages for common issues
				if (
					error.message.includes('subtask') &&
					error.message.includes('not found')
				) {
					console.log(chalk.yellow('\nTo fix this issue:'));
					console.log(
						'  1. Run task-master list --with-subtasks to see all available subtask IDs'
					);
					console.log(
						'  2. Use a valid subtask ID with the --id parameter in format "parentId.subtaskId"'
					);
				} else if (error.message.includes('API key')) {
					console.log(
						chalk.yellow(
							'\nThis error is related to API keys. Check your environment variables.'
						)
					);
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
		.description('Generate task files from .taskmaster/tasks.json')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.option('-o, --output <dir>', 'Output directory', '.taskmaster/tasks')
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
		.option(
			'-i, --id <id>',
			'Task ID (can be comma-separated for multiple tasks)'
		)
		.option(
			'-s, --status <status>',
			'New status (todo, in-progress, review, done)'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.action(async (options) => {
			const tasksPath = options.file;
			const taskId = options.id;
			const status = options.status;

			if (!taskId || !status) {
				console.error(chalk.red('Error: Both --id and --status are required'));
				process.exit(1);
			}

			console.log(
				chalk.blue(`Setting status of task(s) ${taskId} to: ${status}`)
			);

			await setTaskStatus(tasksPath, taskId, status);
		});

	// list command
	programInstance
		.command('list')
		.description('List all tasks')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
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
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
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
			const idArg = options.id;
			const numSubtasks = options.num || CONFIG.defaultSubtasks;
			const useResearch = options.research || false;
			const additionalContext = options.prompt || '';
			const forceFlag = options.force || false;
			const tasksPath = options.file || '.taskmaster/tasks.json';

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
				await expandAllTasks(
					tasksPath,
					numSubtasks,
					useResearch,
					additionalContext,
					forceFlag
				);
			} else if (idArg) {
				console.log(
					chalk.blue(`Expanding task ${idArg} with ${numSubtasks} subtasks...`)
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
				await expandTask(
					tasksPath,
					idArg,
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

	// analyze-complexity command
	programInstance
		.command('analyze-complexity')
		.description(
			`Analyze tasks and generate expansion recommendations${chalk.reset('')}`
		)
		.option(
			'-o, --output <file>',
			'Output file path for the report',
			'.taskmaster/scripts/task-complexity-report.json'
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
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.option(
			'-r, --research',
			'Use Perplexity AI for research-backed complexity analysis'
		)
		.action(async (options) => {
			const tasksPath = options.file || '.taskmaster/tasks.json';
			const outputPath = options.output;
			const modelOverride = options.model;
			const thresholdScore = parseFloat(options.threshold);
			const useResearch = options.research || false;

			console.log(chalk.blue(`Analyzing task complexity from: ${tasksPath}`));
			console.log(chalk.blue(`Output report will be saved to: ${outputPath}`));

			if (useResearch) {
				console.log(
					chalk.blue(
						'Using Perplexity AI for research-backed complexity analysis'
					)
				);
			}

			await analyzeTaskComplexity(options);
		});

	// clear-subtasks command
	programInstance
		.command('clear-subtasks')
		.description('Clear subtasks from specified tasks')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.option(
			'-i, --id <ids>',
			'Task IDs (comma-separated) to clear subtasks from'
		)
		.option('--all', 'Clear subtasks from all tasks')
		.action(async (options) => {
			const tasksPath = options.file;
			const taskIds = options.id;
			const all = options.all;

			if (!taskIds && !all) {
				console.error(
					chalk.red(
						'Error: Please specify task IDs with --id=<ids> or use --all to clear all tasks'
					)
				);
				process.exit(1);
			}

			if (all) {
				// If --all is specified, get all task IDs
				const data = readJSON(tasksPath);
				if (!data || !data.tasks) {
					console.error(chalk.red('Error: No valid tasks found'));
					process.exit(1);
				}
				const allIds = data.tasks.map((t) => t.id).join(',');
				clearSubtasks(tasksPath, allIds);
			} else {
				clearSubtasks(tasksPath, taskIds);
			}
		});

	// add-task command
	programInstance
		.command('add-task')
		.description('Add a new task using AI or manual input')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.option(
			'-p, --prompt <prompt>',
			'Description of the task to add (required if not using manual fields)'
		)
		.option('-t, --title <title>', 'Task title (for manual task creation)')
		.option(
			'-d, --description <description>',
			'Task description (for manual task creation)'
		)
		.option(
			'--details <details>',
			'Implementation details (for manual task creation)'
		)
		.option(
			'--test-strategy <testStrategy>',
			'Test strategy (for manual task creation)'
		)
		.option(
			'--dependencies <dependencies>',
			'Comma-separated list of task IDs this task depends on'
		)
		.option(
			'--priority <priority>',
			'Task priority (high, medium, low)',
			'medium'
		)
		.option(
			'-r, --research',
			'Whether to use research capabilities for task creation'
		)
		.action(async (options) => {
			const isManualCreation = options.title && options.description;

			// Validate that either prompt or title+description are provided
			if (!options.prompt && !isManualCreation) {
				console.error(
					chalk.red(
						'Error: Either --prompt or both --title and --description must be provided'
					)
				);
				process.exit(1);
			}

			try {
				// Prepare dependencies if provided
				let dependencies = [];
				if (options.dependencies) {
					dependencies = options.dependencies
						.split(',')
						.map((id) => parseInt(id.trim(), 10));
				}

				// Create manual task data if title and description are provided
				let manualTaskData = null;
				if (isManualCreation) {
					manualTaskData = {
						title: options.title,
						description: options.description,
						details: options.details || '',
						testStrategy: options.testStrategy || ''
					};

					console.log(
						chalk.blue(`Creating task manually with title: "${options.title}"`)
					);
					if (dependencies.length > 0) {
						console.log(
							chalk.blue(`Dependencies: [${dependencies.join(', ')}]`)
						);
					}
					if (options.priority) {
						console.log(chalk.blue(`Priority: ${options.priority}`));
					}
				} else {
					console.log(
						chalk.blue(
							`Creating task with AI using prompt: "${options.prompt}"`
						)
					);
					if (dependencies.length > 0) {
						console.log(
							chalk.blue(`Dependencies: [${dependencies.join(', ')}]`)
						);
					}
					if (options.priority) {
						console.log(chalk.blue(`Priority: ${options.priority}`));
					}
				}

				const newTaskId = await addTask(
					options.file,
					options.prompt,
					dependencies,
					options.priority,
					{
						session: process.env
					},
					options.research || false,
					null,
					manualTaskData
				);

				console.log(chalk.green(`✓ Added new task #${newTaskId}`));
				console.log(chalk.gray('Next: Complete this task or add more tasks'));
			} catch (error) {
				console.error(chalk.red(`Error adding task: ${error.message}`));
				if (error.stack && CONFIG.debug) {
					console.error(error.stack);
				}
				process.exit(1);
			}
		});

	// next command
	programInstance
		.command('next')
		.description(
			`Show the next task to work on based on dependencies and status${chalk.reset('')}`
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.action(async (options) => {
			const tasksPath = options.file;
			await displayNextTask(tasksPath);
		});

	// show command
	programInstance
		.command('show')
		.description(
			`Display detailed information about a specific task${chalk.reset('')}`
		)
		.argument('[id]', 'Task ID to show')
		.option('-i, --id <id>', 'Task ID to show')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
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
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.action(async (options) => {
			const tasksPath = options.file;
			const taskId = options.id;
			const dependencyId = options.dependsOn;

			if (!taskId || !dependencyId) {
				console.error(
					chalk.red('Error: Both --id and --depends-on are required')
				);
				process.exit(1);
			}

			// Handle subtask IDs correctly by preserving the string format for IDs containing dots
			// Only use parseInt for simple numeric IDs
			const formattedTaskId = taskId.includes('.')
				? taskId
				: parseInt(taskId, 10);
			const formattedDependencyId = dependencyId.includes('.')
				? dependencyId
				: parseInt(dependencyId, 10);

			await addDependency(tasksPath, formattedTaskId, formattedDependencyId);
		});

	// remove-dependency command
	programInstance
		.command('remove-dependency')
		.description('Remove a dependency from a task')
		.option('-i, --id <id>', 'Task ID to remove dependency from')
		.option('-d, --depends-on <id>', 'Task ID to remove as a dependency')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.action(async (options) => {
			const tasksPath = options.file;
			const taskId = options.id;
			const dependencyId = options.dependsOn;

			if (!taskId || !dependencyId) {
				console.error(
					chalk.red('Error: Both --id and --depends-on are required')
				);
				process.exit(1);
			}

			// Handle subtask IDs correctly by preserving the string format for IDs containing dots
			// Only use parseInt for simple numeric IDs
			const formattedTaskId = taskId.includes('.')
				? taskId
				: parseInt(taskId, 10);
			const formattedDependencyId = dependencyId.includes('.')
				? dependencyId
				: parseInt(dependencyId, 10);

			await removeDependency(tasksPath, formattedTaskId, formattedDependencyId);
		});

	// validate-dependencies command
	programInstance
		.command('validate-dependencies')
		.description(
			`Identify invalid dependencies without fixing them${chalk.reset('')}`
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.action(async (options) => {
			await validateDependenciesCommand(options.file);
		});

	// fix-dependencies command
	programInstance
		.command('fix-dependencies')
		.description(`Fix invalid dependencies automatically${chalk.reset('')}`)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.action(async (options) => {
			await fixDependenciesCommand(options.file);
		});

	// complexity-report command
	programInstance
		.command('complexity-report')
		.description(`Display the complexity analysis report${chalk.reset('')}`)
		.option(
			'-f, --file <file>',
			'Path to the report file',
			'.taskmaster/scripts/task-complexity-report.json'
		)
		.action(async (options) => {
			await displayComplexityReport(options.file);
		});

	// add-subtask command
	programInstance
		.command('add-subtask')
		.description('Add a subtask to an existing task')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.option('-p, --parent <id>', 'Parent task ID (required)')
		.option('-i, --task-id <id>', 'Existing task ID to convert to subtask')
		.option(
			'-t, --title <title>',
			'Title for the new subtask (when creating a new subtask)'
		)
		.option('-d, --description <text>', 'Description for the new subtask')
		.option('--details <text>', 'Implementation details for the new subtask')
		.option(
			'--dependencies <ids>',
			'Comma-separated list of dependency IDs for the new subtask'
		)
		.option('-s, --status <status>', 'Status for the new subtask', 'pending')
		.option('--skip-generate', 'Skip regenerating task files')
		.action(async (options) => {
			const tasksPath = options.file;
			const parentId = options.parent;
			const existingTaskId = options.taskId;
			const generateFiles = !options.skipGenerate;

			if (!parentId) {
				console.error(
					chalk.red(
						'Error: --parent parameter is required. Please provide a parent task ID.'
					)
				);
				showAddSubtaskHelp();
				process.exit(1);
			}

			// Parse dependencies if provided
			let dependencies = [];
			if (options.dependencies) {
				dependencies = options.dependencies.split(',').map((id) => {
					// Handle both regular IDs and dot notation
					return id.includes('.') ? id.trim() : parseInt(id.trim(), 10);
				});
			}

			try {
				if (existingTaskId) {
					// Convert existing task to subtask
					console.log(
						chalk.blue(
							`Converting task ${existingTaskId} to a subtask of ${parentId}...`
						)
					);
					await addSubtask(
						tasksPath,
						parentId,
						existingTaskId,
						null,
						generateFiles
					);
					console.log(
						chalk.green(
							`✓ Task ${existingTaskId} successfully converted to a subtask of task ${parentId}`
						)
					);
				} else if (options.title) {
					// Create new subtask with provided data
					console.log(
						chalk.blue(`Creating new subtask for parent task ${parentId}...`)
					);

					const newSubtaskData = {
						title: options.title,
						description: options.description || '',
						details: options.details || '',
						status: options.status || 'pending',
						dependencies: dependencies
					};

					const subtask = await addSubtask(
						tasksPath,
						parentId,
						null,
						newSubtaskData,
						generateFiles
					);
					console.log(
						chalk.green(
							`✓ New subtask ${parentId}.${subtask.id} successfully created`
						)
					);

					// Display success message and suggested next steps
					console.log(
						boxen(
							chalk.white.bold(
								`Subtask ${parentId}.${subtask.id} Added Successfully`
							) +
								'\n\n' +
								chalk.white(`Title: ${subtask.title}`) +
								'\n' +
								chalk.white(`Status: ${getStatusWithColor(subtask.status)}`) +
								'\n' +
								(dependencies.length > 0
									? chalk.white(`Dependencies: ${dependencies.join(', ')}`) +
										'\n'
									: '') +
								'\n' +
								chalk.white.bold('Next Steps:') +
								'\n' +
								chalk.cyan(
									`1. Run ${chalk.yellow(`task-master show ${parentId}`)} to see the parent task with all subtasks`
								) +
								'\n' +
								chalk.cyan(
									`2. Run ${chalk.yellow(`task-master set-status --id=${parentId}.${subtask.id} --status=in-progress`)} to start working on it`
								),
							{
								padding: 1,
								borderColor: 'green',
								borderStyle: 'round',
								margin: { top: 1 }
							}
						)
					);
				} else {
					console.error(
						chalk.red('Error: Either --task-id or --title must be provided.')
					);
					console.log(
						boxen(
							chalk.white.bold('Usage Examples:') +
								'\n\n' +
								chalk.white('Convert existing task to subtask:') +
								'\n' +
								chalk.yellow(
									`  task-master add-subtask --parent=5 --task-id=8`
								) +
								'\n\n' +
								chalk.white('Create new subtask:') +
								'\n' +
								chalk.yellow(
									`  task-master add-subtask --parent=5 --title="Implement login UI" --description="Create the login form"`
								) +
								'\n\n',
							{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
						)
					);
					process.exit(1);
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error.message}`));
				process.exit(1);
			}
		})
		.on('error', function (err) {
			console.error(chalk.red(`Error: ${err.message}`));
			showAddSubtaskHelp();
			process.exit(1);
		});

	// Helper function to show add-subtask command help
	function showAddSubtaskHelp() {
		console.log(
			boxen(
				chalk.white.bold('Add Subtask Command Help') +
					'\n\n' +
					chalk.cyan('Usage:') +
					'\n' +
					`  task-master add-subtask --parent=<id> [options]\n\n` +
					chalk.cyan('Options:') +
					'\n' +
					'  -p, --parent <id>         Parent task ID (required)\n' +
					'  -i, --task-id <id>        Existing task ID to convert to subtask\n' +
					'  -t, --title <title>       Title for the new subtask\n' +
					'  -d, --description <text>  Description for the new subtask\n' +
					'  --details <text>          Implementation details for the new subtask\n' +
					'  --dependencies <ids>      Comma-separated list of dependency IDs\n' +
					'  -s, --status <status>     Status for the new subtask (default: "pending")\n' +
					'  -f, --file <file>         Path to the tasks file (default: ".taskmaster/tasks.json")\n' +
					'  --skip-generate           Skip regenerating task files\n\n' +
					chalk.cyan('Examples:') +
					'\n' +
					'  task-master add-subtask --parent=5 --task-id=8\n' +
					'  task-master add-subtask -p 5 -t "Implement login UI" -d "Create the login form"',
				{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
			)
		);
	}

	// remove-subtask command
	programInstance
		.command('remove-subtask')
		.description('Remove a subtask from its parent task')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.option(
			'-i, --id <id>',
			'Subtask ID(s) to remove in format "parentId.subtaskId" (can be comma-separated for multiple subtasks)'
		)
		.option(
			'-c, --convert',
			'Convert the subtask to a standalone task instead of deleting it'
		)
		.option('--skip-generate', 'Skip regenerating task files')
		.action(async (options) => {
			const tasksPath = options.file;
			const subtaskIds = options.id;
			const convertToTask = options.convert || false;
			const generateFiles = !options.skipGenerate;

			if (!subtaskIds) {
				console.error(
					chalk.red(
						'Error: --id parameter is required. Please provide subtask ID(s) in format "parentId.subtaskId".'
					)
				);
				showRemoveSubtaskHelp();
				process.exit(1);
			}

			try {
				// Split by comma to support multiple subtask IDs
				const subtaskIdArray = subtaskIds.split(',').map((id) => id.trim());

				for (const subtaskId of subtaskIdArray) {
					// Validate subtask ID format
					if (!subtaskId.includes('.')) {
						console.error(
							chalk.red(
								`Error: Subtask ID "${subtaskId}" must be in format "parentId.subtaskId"`
							)
						);
						showRemoveSubtaskHelp();
						process.exit(1);
					}

					console.log(chalk.blue(`Removing subtask ${subtaskId}...`));
					if (convertToTask) {
						console.log(
							chalk.blue('The subtask will be converted to a standalone task')
						);
					}

					const result = await removeSubtask(
						tasksPath,
						subtaskId,
						convertToTask,
						generateFiles
					);

					if (convertToTask && result) {
						// Display success message and next steps for converted task
						console.log(
							boxen(
								chalk.white.bold(
									`Subtask ${subtaskId} Converted to Task #${result.id}`
								) +
									'\n\n' +
									chalk.white(`Title: ${result.title}`) +
									'\n' +
									chalk.white(`Status: ${getStatusWithColor(result.status)}`) +
									'\n' +
									chalk.white(
										`Dependencies: ${result.dependencies.join(', ')}`
									) +
									'\n\n' +
									chalk.white.bold('Next Steps:') +
									'\n' +
									chalk.cyan(
										`1. Run ${chalk.yellow(`task-master show ${result.id}`)} to see details of the new task`
									) +
									'\n' +
									chalk.cyan(
										`2. Run ${chalk.yellow(`task-master set-status --id=${result.id} --status=in-progress`)} to start working on it`
									),
								{
									padding: 1,
									borderColor: 'green',
									borderStyle: 'round',
									margin: { top: 1 }
								}
							)
						);
					} else {
						// Display success message for deleted subtask
						console.log(
							boxen(
								chalk.white.bold(`Subtask ${subtaskId} Removed`) +
									'\n\n' +
									chalk.white('The subtask has been successfully deleted.'),
								{
									padding: 1,
									borderColor: 'green',
									borderStyle: 'round',
									margin: { top: 1 }
								}
							)
						);
					}
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error.message}`));
				showRemoveSubtaskHelp();
				process.exit(1);
			}
		})
		.on('error', function (err) {
			console.error(chalk.red(`Error: ${err.message}`));
			showRemoveSubtaskHelp();
			process.exit(1);
		});

	// Helper function to show remove-subtask command help
	function showRemoveSubtaskHelp() {
		console.log(
			boxen(
				chalk.white.bold('Remove Subtask Command Help') +
					'\n\n' +
					chalk.cyan('Usage:') +
					'\n' +
					`  task-master remove-subtask --id=<parentId.subtaskId> [options]\n\n` +
					chalk.cyan('Options:') +
					'\n' +
					'  -i, --id <id>       Subtask ID(s) to remove in format "parentId.subtaskId" (can be comma-separated, required)\n' +
					'  -c, --convert       Convert the subtask to a standalone task instead of deleting it\n' +
					'  -f, --file <file>   Path to the tasks file (default: ".taskmaster/tasks.json")\n' +
					'  --skip-generate     Skip regenerating task files\n\n' +
					chalk.cyan('Examples:') +
					'\n' +
					'  task-master remove-subtask --id=5.2\n' +
					'  task-master remove-subtask --id=5.2,6.3,7.1\n' +
					'  task-master remove-subtask --id=5.2 --convert',
				{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
			)
		);
	}

	// remove-task command
	programInstance
		.command('remove-task')
		.description('Remove one or more tasks or subtasks permanently')
		.option(
			'-i, --id <id>',
			'ID(s) of the task(s) or subtask(s) to remove (e.g., "5" or "5.2" or "5,6,7")'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			'.taskmaster/tasks.json'
		)
		.option('-y, --yes', 'Skip confirmation prompt', false)
		.action(async (options) => {
			const tasksPath = options.file;
			const taskIds = options.id;

			if (!taskIds) {
				console.error(chalk.red('Error: Task ID is required'));
				console.error(
					chalk.yellow('Usage: task-master remove-task --id=<taskId>')
				);
				process.exit(1);
			}

			try {
				// Check if the tasks file exists and is valid
				const data = readJSON(tasksPath);
				if (!data || !data.tasks) {
					console.error(
						chalk.red(`Error: No valid tasks found in ${tasksPath}`)
					);
					process.exit(1);
				}

				// Split task IDs if comma-separated
				const taskIdArray = taskIds.split(',').map((id) => id.trim());

				// Validate all task IDs exist before proceeding
				const invalidTasks = taskIdArray.filter(
					(id) => !taskExists(data.tasks, id)
				);
				if (invalidTasks.length > 0) {
					console.error(
						chalk.red(
							`Error: The following tasks were not found: ${invalidTasks.join(', ')}`
						)
					);
					process.exit(1);
				}

				// Skip confirmation if --yes flag is provided
				if (!options.yes) {
					// Display tasks to be removed
					console.log();
					console.log(
						chalk.red.bold(
							'⚠️ WARNING: This will permanently delete the following tasks:'
						)
					);
					console.log();

					for (const taskId of taskIdArray) {
						const task = findTaskById(data.tasks, taskId);

						if (typeof taskId === 'string' && taskId.includes('.')) {
							// It's a subtask
							const [parentId, subtaskId] = taskId.split('.');
							console.log(chalk.white.bold(`Subtask ${taskId}: ${task.title}`));
							console.log(
								chalk.gray(
									`Parent Task: ${task.parentTask.id} - ${task.parentTask.title}`
								)
							);
						} else {
							// It's a main task
							console.log(chalk.white.bold(`Task ${taskId}: ${task.title}`));

							// Show if it has subtasks
							if (task.subtasks && task.subtasks.length > 0) {
								console.log(
									chalk.yellow(
										`⚠️ This task has ${task.subtasks.length} subtasks that will also be deleted!`
									)
								);
							}

							// Show if other tasks depend on it
							const dependentTasks = data.tasks.filter(
								(t) =>
									t.dependencies &&
									t.dependencies.includes(parseInt(taskId, 10))
							);

							if (dependentTasks.length > 0) {
								console.log(
									chalk.yellow(
										`⚠️ Warning: ${dependentTasks.length} other tasks depend on this task!`
									)
								);
								console.log(
									chalk.yellow('These dependencies will be removed:')
								);
								dependentTasks.forEach((t) => {
									console.log(chalk.yellow(`  - Task ${t.id}: ${t.title}`));
								});
							}
						}
						console.log();
					}

					// Prompt for confirmation
					const { confirm } = await inquirer.prompt([
						{
							type: 'confirm',
							name: 'confirm',
							message: chalk.red.bold(
								`Are you sure you want to permanently delete ${taskIdArray.length > 1 ? 'these tasks' : 'this task'}?`
							),
							default: false
						}
					]);

					if (!confirm) {
						console.log(chalk.blue('Task deletion cancelled.'));
						process.exit(0);
					}
				}

				const indicator = startLoadingIndicator('Removing tasks...');

				// Remove each task
				const results = [];
				for (const taskId of taskIdArray) {
					try {
						const result = await removeTask(tasksPath, taskId);
						results.push({ taskId, success: true, ...result });
					} catch (error) {
						results.push({ taskId, success: false, error: error.message });
					}
				}

				stopLoadingIndicator(indicator);

				// Display results
				const successfulRemovals = results.filter((r) => r.success);
				const failedRemovals = results.filter((r) => !r.success);

				if (successfulRemovals.length > 0) {
					console.log(
						boxen(
							chalk.green(
								`Successfully removed ${successfulRemovals.length} task${successfulRemovals.length > 1 ? 's' : ''}`
							) +
								'\n\n' +
								successfulRemovals
									.map((r) =>
										chalk.white(
											`✓ ${r.taskId.includes('.') ? 'Subtask' : 'Task'} ${r.taskId}`
										)
									)
									.join('\n'),
							{
								padding: 1,
								borderColor: 'green',
								borderStyle: 'round',
								margin: { top: 1 }
							}
						)
					);
				}

				if (failedRemovals.length > 0) {
					console.log(
						boxen(
							chalk.red(
								`Failed to remove ${failedRemovals.length} task${failedRemovals.length > 1 ? 's' : ''}`
							) +
								'\n\n' +
								failedRemovals
									.map((r) => chalk.white(`✗ ${r.taskId}: ${r.error}`))
									.join('\n'),
							{
								padding: 1,
								borderColor: 'red',
								borderStyle: 'round',
								margin: { top: 1 }
							}
						)
					);

					// Exit with error if any removals failed
					if (successfulRemovals.length === 0) {
						process.exit(1);
					}
				}
			} catch (error) {
				console.error(
					chalk.red(`Error: ${error.message || 'An unknown error occurred'}`)
				);
				process.exit(1);
			}
		});

	// init command (Directly calls the implementation from init.js)
	programInstance
		.command('init')
		.description('Initialize a new project with Task Master structure')
		.option('-y, --yes', 'Skip prompts and use default values')
		.option('-n, --name <name>', 'Project name')
		.option('-d, --description <description>', 'Project description')
		.option('-v, --version <version>', 'Project version', '0.1.0') // Set default here
		.option('-a, --author <author>', 'Author name')
		.option('--skip-install', 'Skip installing dependencies')
		.option('--dry-run', 'Show what would be done without making changes')
		.option('--aliases', 'Add shell aliases (tm, taskmaster)')
		.action(async (cmdOptions) => {
			// cmdOptions contains parsed arguments
			try {
				console.log('DEBUG: Running init command action in commands.js');
				console.log(
					'DEBUG: Options received by action:',
					JSON.stringify(cmdOptions)
				);
				// Directly call the initializeProject function, passing the parsed options
				await initializeProject(cmdOptions);
				// initializeProject handles its own flow, including potential process.exit()
			} catch (error) {
				console.error(
					chalk.red(`Error during initialization: ${error.message}`)
				);
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

					// Compare versions
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

export {
	registerCommands,
	setupCLI,
	runCLI,
	checkForUpdate,
	compareVersions,
	displayUpgradeNotification
};
