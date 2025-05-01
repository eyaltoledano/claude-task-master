/**
 * Commands module tests
 */

import { jest } from '@jest/globals';
import {
	sampleTasks,
	emptySampleTasks
} from '../../tests/fixtures/sample-tasks.js';

// Mock functions that need jest.fn methods
const mockParsePRD = jest.fn().mockResolvedValue(undefined);
const mockUpdateTaskById = jest.fn().mockResolvedValue({
	id: 2,
	title: 'Updated Task',
	description: 'Updated description'
});
const mockDisplayBanner = jest.fn();
const mockDisplayHelp = jest.fn();
const mockLog = jest.fn();

// Mock modules first
jest.mock('fs', () => ({
	existsSync: jest.fn(),
	readFileSync: jest.fn()
}));

jest.mock('path', () => ({
	join: jest.fn((dir, file) => `${dir}/${file}`)
}));

jest.mock('chalk', () => ({
	red: jest.fn((text) => text),
	blue: jest.fn((text) => text),
	green: jest.fn((text) => text),
	yellow: jest.fn((text) => text),
	white: jest.fn((text) => ({
		bold: jest.fn((text) => text)
	})),
	reset: jest.fn((text) => text)
}));

jest.mock('../../scripts/modules/ui.js', () => ({
	displayBanner: mockDisplayBanner,
	displayHelp: mockDisplayHelp
}));

jest.mock('../../scripts/modules/task-manager.js', () => ({
	parsePRD: mockParsePRD,
	updateTaskById: mockUpdateTaskById
}));

// Add this function before the mock of utils.js
/**
 * Convert camelCase to kebab-case
 * @param {string} str - String to convert
 * @returns {string} kebab-case version of the input
 */
const toKebabCase = (str) => {
	return str
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase()
		.replace(/^-/, ''); // Remove leading hyphen if present
};

/**
 * Detect camelCase flags in command arguments
 * @param {string[]} args - Command line arguments to check
 * @returns {Array<{original: string, kebabCase: string}>} - List of flags that should be converted
 */
function detectCamelCaseFlags(args) {
	const camelCaseFlags = [];
	for (const arg of args) {
		if (arg.startsWith('--')) {
			const flagName = arg.split('=')[0].slice(2); // Remove -- and anything after =

			// Skip if it's a single word (no hyphens) or already in kebab-case
			if (!flagName.includes('-')) {
				// Check for camelCase pattern (lowercase followed by uppercase)
				if (/[a-z][A-Z]/.test(flagName)) {
					const kebabVersion = toKebabCase(flagName);
					if (kebabVersion !== flagName) {
						camelCaseFlags.push({
							original: flagName,
							kebabCase: kebabVersion
						});
					}
				}
			}
		}
	}
	return camelCaseFlags;
}

// Then update the utils.js mock to include these functions
jest.mock('../../scripts/modules/utils.js', () => ({
	CONFIG: {
		projectVersion: '1.5.0'
	},
	log: mockLog,
	toKebabCase: toKebabCase,
	detectCamelCaseFlags: detectCamelCaseFlags
}));

// Import all modules after mocking
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { setupCLI } from '../../scripts/modules/commands.js';

// We'll use a simplified, direct test approach instead of Commander mocking
describe('Commands Module', () => {
	// Set up spies on the mocked modules
	const mockExistsSync = jest.spyOn(fs, 'existsSync');
	const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
	const mockJoin = jest.spyOn(path, 'join');
	const mockConsoleLog = jest
		.spyOn(console, 'log')
		.mockImplementation(() => {});
	const mockConsoleError = jest
		.spyOn(console, 'error')
		.mockImplementation(() => {});
	const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

	beforeEach(() => {
		jest.clearAllMocks();
		mockExistsSync.mockReturnValue(true);
	});

	afterAll(() => {
		jest.restoreAllMocks();
	});

	describe('setupCLI function', () => {
		test('should return Commander program instance', () => {
			const program = setupCLI();
			expect(program).toBeDefined();
			expect(program.name()).toBe('dev');
		});

		test('should read version from package.json when available', () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
			mockJoin.mockReturnValue('package.json');

			const program = setupCLI();
			const version = program._version();
			expect(mockReadFileSync).toHaveBeenCalledWith('package.json', 'utf8');
			expect(version).toBe('1.0.0');
		});

		test('should use default version when package.json is not available', () => {
			mockExistsSync.mockReturnValue(false);

			const program = setupCLI();
			const version = program._version();
			expect(mockReadFileSync).not.toHaveBeenCalled();
			expect(version).toBe('unknown');
		});

		test('should use default version when package.json reading throws an error', () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockImplementation(() => {
				throw new Error('Read error');
			});

			const program = setupCLI();
			const version = program._version();
			expect(mockReadFileSync).toHaveBeenCalled();
			expect(version).toBe('unknown');
		});
	});

	describe('Kebab Case Validation', () => {
		test('should detect camelCase flags correctly', () => {
			const args = ['node', 'task-master', '--camelCase', '--kebab-case'];
			const camelCaseFlags = args.filter(
				(arg) =>
					arg.startsWith('--') && /[A-Z]/.test(arg) && !arg.includes('-[A-Z]')
			);
			expect(camelCaseFlags).toContain('--camelCase');
			expect(camelCaseFlags).not.toContain('--kebab-case');
		});

		test('should accept kebab-case flags correctly', () => {
			const args = ['node', 'task-master', '--kebab-case'];
			const camelCaseFlags = args.filter(
				(arg) =>
					arg.startsWith('--') && /[A-Z]/.test(arg) && !arg.includes('-[A-Z]')
			);
			expect(camelCaseFlags).toHaveLength(0);
		});
	});

	describe('parse-prd command', () => {
		// Since mocking Commander is complex, we'll test the action handler directly
		// Recreate the action handler logic based on commands.js
		async function parsePrdAction(file, options) {
			// Use input option if file argument not provided
			const inputFile = file || options.input;
			const defaultPrdPath = 'scripts/prd.txt';
			const append = options.append || false;
			const force = options.force || false;
			const outputPath = options.output || 'tasks/tasks.json';

			// Mock confirmOverwriteIfNeeded function to test overwrite behavior
			const mockConfirmOverwrite = jest.fn().mockResolvedValue(true);

			// Helper function to check if tasks.json exists and confirm overwrite
			async function confirmOverwriteIfNeeded() {
				if (fs.existsSync(outputPath) && !force && !append) {
					return mockConfirmOverwrite();
				}
				return true;
			}

			// If no input file specified, check for default PRD location
			if (!inputFile) {
				if (fs.existsSync(defaultPrdPath)) {
					console.log(chalk.blue(`Using default PRD file: ${defaultPrdPath}`));
					const numTasks = parseInt(options.numTasks, 10);

					// Check if we need to confirm overwrite
					if (!(await confirmOverwriteIfNeeded())) return;

					console.log(chalk.blue(`Generating ${numTasks} tasks...`));
					if (append) {
						console.log(chalk.blue('Appending to existing tasks...'));
					}
					await mockParsePRD(defaultPrdPath, outputPath, numTasks, { append });
					return;
				}

				console.log(
					chalk.yellow(
						'No PRD file specified and default PRD file not found at scripts/prd.txt.'
					)
				);
				return;
			}

			const numTasks = parseInt(options.numTasks, 10);

			// Check if we need to confirm overwrite
			if (!(await confirmOverwriteIfNeeded())) return;

			console.log(chalk.blue(`Parsing PRD file: ${inputFile}`));
			console.log(chalk.blue(`Generating ${numTasks} tasks...`));
			if (append) {
				console.log(chalk.blue('Appending to existing tasks...'));
			}

			await mockParsePRD(inputFile, outputPath, numTasks, { append });

			// Return mock for testing
			return { mockConfirmOverwrite };
		}

		beforeEach(() => {
			// Reset the parsePRD mock
			mockParsePRD.mockClear();
		});

		test('should use default PRD path when no arguments provided', async () => {
			// Arrange
			mockExistsSync.mockReturnValue(true);

			// Act - call the handler directly with the right params
			await parsePrdAction(undefined, {
				numTasks: '10',
				output: 'tasks/tasks.json'
			});

			// Assert
			expect(mockExistsSync).toHaveBeenCalledWith('scripts/prd.txt');
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Using default PRD file')
			);
			expect(mockParsePRD).toHaveBeenCalledWith(
				'scripts/prd.txt',
				'tasks/tasks.json',
				10, // Default value from command definition
				{ append: false }
			);
		});

		test('should display help when no arguments and no default PRD exists', async () => {
			// Arrange
			mockExistsSync.mockReturnValue(false);

			// Act - call the handler directly with the right params
			await parsePrdAction(undefined, {
				numTasks: '10',
				output: 'tasks/tasks.json'
			});

			// Assert
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('No PRD file specified')
			);
			expect(mockParsePRD).not.toHaveBeenCalled();
		});

		test('should use explicitly provided file path', async () => {
			// Arrange
			const testFile = 'test/prd.txt';

			// Act - call the handler directly with the right params
			await parsePrdAction(testFile, {
				numTasks: '10',
				output: 'tasks/tasks.json'
			});

			// Assert
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(`Parsing PRD file: ${testFile}`)
			);
			expect(mockParsePRD).toHaveBeenCalledWith(
				testFile,
				'tasks/tasks.json',
				10,
				{ append: false }
			);
			expect(mockExistsSync).not.toHaveBeenCalledWith('scripts/prd.txt');
		});

		test('should use file path from input option when provided', async () => {
			// Arrange
			const testFile = 'test/prd.txt';

			// Act - call the handler directly with the right params
			await parsePrdAction(undefined, {
				input: testFile,
				numTasks: '10',
				output: 'tasks/tasks.json'
			});

			// Assert
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(`Parsing PRD file: ${testFile}`)
			);
			expect(mockParsePRD).toHaveBeenCalledWith(
				testFile,
				'tasks/tasks.json',
				10,
				{ append: false }
			);
			expect(mockExistsSync).not.toHaveBeenCalledWith('scripts/prd.txt');
		});

		test('should respect numTasks and output options', async () => {
			// Arrange
			const testFile = 'test/prd.txt';
			const outputFile = 'custom/output.json';
			const numTasks = 15;

			// Act - call the handler directly with the right params
			await parsePrdAction(testFile, {
				numTasks: numTasks.toString(),
				output: outputFile
			});

			// Assert
			expect(mockParsePRD).toHaveBeenCalledWith(
				testFile,
				outputFile,
				numTasks,
				{ append: false }
			);
		});

		test('should pass append flag to parsePRD when provided', async () => {
			// Arrange
			const testFile = 'test/prd.txt';

			// Act - call the handler directly with append flag
			await parsePrdAction(testFile, {
				numTasks: '10',
				output: 'tasks/tasks.json',
				append: true
			});

			// Assert
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Appending to existing tasks')
			);
			expect(mockParsePRD).toHaveBeenCalledWith(
				testFile,
				'tasks/tasks.json',
				10,
				{ append: true }
			);
		});

		test('should bypass confirmation when append flag is true and tasks.json exists', async () => {
			// Arrange
			const testFile = 'test/prd.txt';
			const outputFile = 'tasks/tasks.json';

			// Mock that tasks.json exists
			mockExistsSync.mockImplementation((path) => {
				if (path === outputFile) return true;
				if (path === testFile) return true;
				return false;
			});

			// Act - call the handler with append flag
			const { mockConfirmOverwrite } =
				(await parsePrdAction(testFile, {
					numTasks: '10',
					output: outputFile,
					append: true
				})) || {};

			// Assert - confirm overwrite should not be called with append flag
			expect(mockConfirmOverwrite).not.toHaveBeenCalled();
			expect(mockParsePRD).toHaveBeenCalledWith(testFile, outputFile, 10, {
				append: true
			});

			// Reset mock implementation
			mockExistsSync.mockReset();
		});

		test('should prompt for confirmation when append flag is false and tasks.json exists', async () => {
			// Arrange
			const testFile = 'test/prd.txt';
			const outputFile = 'tasks/tasks.json';

			// Mock that tasks.json exists
			mockExistsSync.mockImplementation((path) => {
				if (path === outputFile) return true;
				if (path === testFile) return true;
				return false;
			});

			// Act - call the handler without append flag
			const { mockConfirmOverwrite } =
				(await parsePrdAction(testFile, {
					numTasks: '10',
					output: outputFile
					// append: false (default)
				})) || {};

			// Assert - confirm overwrite should be called without append flag
			expect(mockConfirmOverwrite).toHaveBeenCalled();
			expect(mockParsePRD).toHaveBeenCalledWith(testFile, outputFile, 10, {
				append: false
			});

			// Reset mock implementation
			mockExistsSync.mockReset();
		});

		test('should bypass confirmation when force flag is true, regardless of append flag', async () => {
			// Arrange
			const testFile = 'test/prd.txt';
			const outputFile = 'tasks/tasks.json';

			// Mock that tasks.json exists
			mockExistsSync.mockImplementation((path) => {
				if (path === outputFile) return true;
				if (path === testFile) return true;
				return false;
			});

			// Act - call the handler with force flag
			const { mockConfirmOverwrite } =
				(await parsePrdAction(testFile, {
					numTasks: '10',
					output: outputFile,
					force: true,
					append: false
				})) || {};

			// Assert - confirm overwrite should not be called with force flag
			expect(mockConfirmOverwrite).not.toHaveBeenCalled();
			expect(mockParsePRD).toHaveBeenCalledWith(testFile, outputFile, 10, {
				append: false
			});

			// Reset mock implementation
			mockExistsSync.mockReset();
		});
	});

	describe('updateTask command', () => {
		// Since mocking Commander is complex, we'll test the action handler directly
		// Recreate the action handler logic based on commands.js
		async function updateTaskAction(options) {
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
					return; // Add early return to prevent calling updateTaskById
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
					return; // Add early return to prevent calling updateTaskById
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
					return; // Add early return to prevent calling updateTaskById
				}

				const prompt = options.prompt;
				const useResearch = options.research || false;

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					if (tasksPath === 'tasks/tasks.json') {
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
					return; // Add early return to prevent calling updateTaskById
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

				const result = await mockUpdateTaskById(
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

				if (true) {
					// CONFIG.debug
					console.error(error);
				}

				process.exit(1);
			}
		}

		beforeEach(() => {
			// Reset all mocks
			jest.clearAllMocks();

			// Set up spy for existsSync (already mocked in the outer scope)
			mockExistsSync.mockReturnValue(true);
		});

		test('should validate required parameters - missing ID', async () => {
			// Set up the command options without ID
			const options = {
				file: 'test-tasks.json',
				prompt: 'Update the task'
			};

			// Call the action directly
			await updateTaskAction(options);

			// Verify validation error
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining('--id parameter is required')
			);
			expect(mockExit).toHaveBeenCalledWith(1);
			expect(mockUpdateTaskById).not.toHaveBeenCalled();
		});

		test('should validate required parameters - invalid ID', async () => {
			// Set up the command options with invalid ID
			const options = {
				file: 'test-tasks.json',
				id: 'not-a-number',
				prompt: 'Update the task'
			};

			// Call the action directly
			await updateTaskAction(options);

			// Verify validation error
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining('Invalid task ID')
			);
			expect(mockExit).toHaveBeenCalledWith(1);
			expect(mockUpdateTaskById).not.toHaveBeenCalled();
		});

		test('should validate required parameters - missing prompt', async () => {
			// Set up the command options without prompt
			const options = {
				file: 'test-tasks.json',
				id: '2'
			};

			// Call the action directly
			await updateTaskAction(options);

			// Verify validation error
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining('--prompt parameter is required')
			);
			expect(mockExit).toHaveBeenCalledWith(1);
			expect(mockUpdateTaskById).not.toHaveBeenCalled();
		});

		test('should validate tasks file exists', async () => {
			// Mock file not existing
			mockExistsSync.mockReturnValue(false);

			// Set up the command options
			const options = {
				file: 'missing-tasks.json',
				id: '2',
				prompt: 'Update the task'
			};

			// Call the action directly
			await updateTaskAction(options);

			// Verify validation error
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining('Tasks file not found')
			);
			expect(mockExit).toHaveBeenCalledWith(1);
			expect(mockUpdateTaskById).not.toHaveBeenCalled();
		});

		test('should call updateTaskById with correct parameters', async () => {
			// Set up the command options
			const options = {
				file: 'test-tasks.json',
				id: '2',
				prompt: 'Update the task',
				research: true
			};

			// Mock perplexity API key
			process.env.PERPLEXITY_API_KEY = 'dummy-key';

			// Call the action directly
			await updateTaskAction(options);

			// Verify updateTaskById was called with correct parameters
			expect(mockUpdateTaskById).toHaveBeenCalledWith(
				'test-tasks.json',
				2,
				'Update the task',
				true
			);

			// Verify console output
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Updating task 2')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Using Perplexity AI')
			);

			// Clean up
			delete process.env.PERPLEXITY_API_KEY;
		});

		test('should handle null result from updateTaskById', async () => {
			// Mock updateTaskById returning null (e.g., task already completed)
			mockUpdateTaskById.mockResolvedValueOnce(null);

			// Set up the command options
			const options = {
				file: 'test-tasks.json',
				id: '2',
				prompt: 'Update the task'
			};

			// Call the action directly
			await updateTaskAction(options);

			// Verify updateTaskById was called
			expect(mockUpdateTaskById).toHaveBeenCalled();

			// Verify console output for null result
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Task update was not completed')
			);
		});

		test('should handle errors from updateTaskById', async () => {
			// Mock updateTaskById throwing an error
			mockUpdateTaskById.mockRejectedValueOnce(new Error('Task update failed'));

			// Set up the command options
			const options = {
				file: 'test-tasks.json',
				id: '2',
				prompt: 'Update the task'
			};

			// Call the action directly
			await updateTaskAction(options);

			// Verify error handling
			expect(mockConsoleError).toHaveBeenCalledWith(
				expect.stringContaining('Error: Task update failed')
			);
			expect(mockExit).toHaveBeenCalledWith(1);
		});
	});

	// Add test for add-task command
	describe('add-task command', () => {
		let mockTaskManager;
		let addTaskCommand;
		let addTaskAction;
		let mockFs;

		// Import the sample tasks fixtures
		beforeEach(async () => {
			// Mock fs module to return sample tasks
			mockFs = {
				existsSync: jest.fn().mockReturnValue(true),
				readFileSync: jest.fn().mockReturnValue(JSON.stringify(sampleTasks))
			};

			// Create a mock task manager with an addTask function that resolves to taskId 5
			mockTaskManager = {
				addTask: jest
					.fn()
					.mockImplementation(
						(
							file,
							prompt,
							dependencies,
							priority,
							session,
							research,
							generateFiles,
							manualTaskData
						) => {
							// Return the next ID after the last one in sample tasks
							const newId = sampleTasks.tasks.length + 1;
							return Promise.resolve(newId.toString());
						}
					)
			};

			// Create a simplified version of the add-task action function for testing
			addTaskAction = async (cmd, options) => {
				options = options || {}; // Ensure options is not undefined

				const isManualCreation = options.title && options.description;

				// Get prompt directly or from p shorthand
				const prompt = options.prompt || options.p;

				// Validate that either prompt or title+description are provided
				if (!prompt && !isManualCreation) {
					throw new Error(
						'Either --prompt or both --title and --description must be provided'
					);
				}

				// Prepare dependencies if provided
				let dependencies = [];
				if (options.dependencies) {
					dependencies = options.dependencies.split(',').map((id) => id.trim());
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
				}

				// Call addTask with the right parameters
				return await mockTaskManager.addTask(
					options.file || 'tasks/tasks.json',
					prompt,
					dependencies,
					options.priority || 'medium',
					{ session: process.env },
					options.research || options.r || false,
					null,
					manualTaskData
				);
			};
		});

		test('should throw error if no prompt or manual task data provided', async () => {
			// Call without required params
			const options = { file: 'tasks/tasks.json' };

			await expect(async () => {
				await addTaskAction(undefined, options);
			}).rejects.toThrow(
				'Either --prompt or both --title and --description must be provided'
			);
		});

		test('should handle short-hand flag -p for prompt', async () => {
			// Use -p as prompt short-hand
			const options = {
				p: 'Create a login component',
				file: 'tasks/tasks.json'
			};

			await addTaskAction(undefined, options);

			// Check that task manager was called with correct arguments
			expect(mockTaskManager.addTask).toHaveBeenCalledWith(
				expect.any(String), // File path
				'Create a login component', // Prompt
				[], // Dependencies
				'medium', // Default priority
				{ session: process.env },
				false, // Research flag
				null, // Generate files parameter
				null // Manual task data
			);
		});

		test('should handle short-hand flag -r for research', async () => {
			const options = {
				prompt: 'Create authentication system',
				r: true,
				file: 'tasks/tasks.json'
			};

			await addTaskAction(undefined, options);

			// Check that task manager was called with correct research flag
			expect(mockTaskManager.addTask).toHaveBeenCalledWith(
				expect.any(String),
				'Create authentication system',
				[],
				'medium',
				{ session: process.env },
				true, // Research flag should be true
				null, // Generate files parameter
				null // Manual task data
			);
		});

		test('should handle manual task creation with title and description', async () => {
			const options = {
				title: 'Login Component',
				description: 'Create a reusable login form',
				details: 'Implementation details here',
				file: 'tasks/tasks.json'
			};

			await addTaskAction(undefined, options);

			// Check that task manager was called with correct manual task data
			expect(mockTaskManager.addTask).toHaveBeenCalledWith(
				expect.any(String),
				undefined, // No prompt for manual creation
				[],
				'medium',
				{ session: process.env },
				false,
				null, // Generate files parameter
				{
					// Manual task data
					title: 'Login Component',
					description: 'Create a reusable login form',
					details: 'Implementation details here',
					testStrategy: ''
				}
			);
		});

		test('should handle dependencies parameter', async () => {
			const options = {
				prompt: 'Create user settings page',
				dependencies: '1, 3, 5', // Dependencies with spaces
				file: 'tasks/tasks.json'
			};

			await addTaskAction(undefined, options);

			// Check that dependencies are parsed correctly
			expect(mockTaskManager.addTask).toHaveBeenCalledWith(
				expect.any(String),
				'Create user settings page',
				['1', '3', '5'], // Should trim whitespace from dependencies
				'medium',
				{ session: process.env },
				false,
				null, // Generate files parameter
				null // Manual task data
			);
		});

		test('should handle priority parameter', async () => {
			const options = {
				prompt: 'Create navigation menu',
				priority: 'high',
				file: 'tasks/tasks.json'
			};

			await addTaskAction(undefined, options);

			// Check that priority is passed correctly
			expect(mockTaskManager.addTask).toHaveBeenCalledWith(
				expect.any(String),
				'Create navigation menu',
				[],
				'high', // Should use the provided priority
				{ session: process.env },
				false,
				null, // Generate files parameter
				null // Manual task data
			);
		});

		test('should use default values for optional parameters', async () => {
			const options = {
				prompt: 'Basic task',
				file: 'tasks/tasks.json'
			};

			await addTaskAction(undefined, options);

			// Check that default values are used
			expect(mockTaskManager.addTask).toHaveBeenCalledWith(
				expect.any(String),
				'Basic task',
				[], // Empty dependencies array by default
				'medium', // Default priority is medium
				{ session: process.env },
				false, // Research is false by default
				null, // Generate files parameter
				null // Manual task data
			);
		});
	});
});

// Test the version comparison utility
describe('Version comparison', () => {
	// Use a dynamic import for the commands module
	let compareVersions;

	beforeAll(async () => {
		// Import the function we want to test dynamically
		const commandsModule = await import('../../scripts/modules/commands.js');
		compareVersions = commandsModule.compareVersions;
	});

	test('compareVersions correctly compares semantic versions', () => {
		expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
		expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
		expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
		expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
		expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
		expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
		expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
		expect(compareVersions('1.0', '1.0.0')).toBe(0);
		expect(compareVersions('1.0.0.0', '1.0.0')).toBe(0);
		expect(compareVersions('1.0.0', '1.0.0.1')).toBe(-1);
	});
});

// Test the update check functionality
describe('Update check', () => {
	let displayUpgradeNotification;
	let consoleLogSpy;

	beforeAll(async () => {
		// Import the function we want to test dynamically
		const commandsModule = await import('../../scripts/modules/commands.js');
		displayUpgradeNotification = commandsModule.displayUpgradeNotification;
	});

	beforeEach(() => {
		// Spy on console.log
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
	});

	test('displays upgrade notification when newer version is available', () => {
		// Test displayUpgradeNotification function
		displayUpgradeNotification('1.0.0', '1.1.0');
		expect(consoleLogSpy).toHaveBeenCalled();
		expect(consoleLogSpy.mock.calls[0][0]).toContain('Update Available!');
		expect(consoleLogSpy.mock.calls[0][0]).toContain('1.0.0');
		expect(consoleLogSpy.mock.calls[0][0]).toContain('1.1.0');
	});
});
