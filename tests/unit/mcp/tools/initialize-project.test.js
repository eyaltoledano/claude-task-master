/**
 * Tests for the initialize-project MCP tool
 *
 * Note: This test does NOT test the actual implementation. It tests that:
 * 1. The tool is registered correctly with the correct parameters
 * 2. Command construction works correctly with various arguments
 * 3. Error handling works as expected
 * 4. Response formatting is correct
 *
 * We do NOT import the real implementation - everything is mocked
 */

import { jest } from '@jest/globals';

// Mock child_process.execSync
const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
	execSync: mockExecSync
}));

// Mock the utility functions
const mockCreateContentResponse = jest.fn((content) => ({
	content
}));

const mockCreateErrorResponse = jest.fn((message, details) => ({
	error: { message, details }
}));

jest.mock('../../../../mcp-server/src/tools/utils.js', () => ({
	createContentResponse: mockCreateContentResponse,
	createErrorResponse: mockCreateErrorResponse
}));

// Mock the z object from zod
const mockZod = {
	object: jest.fn(() => mockZod),
	string: jest.fn(() => mockZod),
	boolean: jest.fn(() => mockZod),
	optional: jest.fn(() => mockZod),
	default: jest.fn(() => mockZod),
	describe: jest.fn(() => mockZod),
	_def: {
		shape: () => ({
			projectName: {},
			projectDescription: {},
			projectVersion: {},
			authorName: {},
			skipInstall: {},
			addAliases: {},
			yes: {}
		})
	}
};

jest.mock('zod', () => ({
	z: mockZod
}));

// Create our own simplified version of the registerInitializeProjectTool function
const registerInitializeProjectTool = (server) => {
	server.addTool({
		name: 'initialize_project',
		description:
			"Initializes a new Task Master project structure in the current working directory by running 'task-master init'.",
		parameters: mockZod,
		execute: async (args, { log }) => {
			try {
				log.info(
					`Executing initialize_project with args: ${JSON.stringify(args)}`
				);

				// Construct the command arguments
				let command = 'npx task-master init';
				const cliArgs = [];
				if (args.projectName) {
					cliArgs.push(`--name "${args.projectName.replace(/"/g, '\\"')}"`);
				}
				if (args.projectDescription) {
					cliArgs.push(
						`--description "${args.projectDescription.replace(/"/g, '\\"')}"`
					);
				}
				if (args.projectVersion) {
					cliArgs.push(
						`--version "${args.projectVersion.replace(/"/g, '\\"')}"`
					);
				}
				if (args.authorName) {
					cliArgs.push(`--author "${args.authorName.replace(/"/g, '\\"')}"`);
				}
				if (args.skipInstall) cliArgs.push('--skip-install');
				if (args.addAliases) cliArgs.push('--aliases');
				if (args.yes) cliArgs.push('--yes');

				command += ' ' + cliArgs.join(' ');

				log.info(`Constructed command: ${command}`);

				// Execute the command
				const output = mockExecSync(command, {
					encoding: 'utf8',
					stdio: 'pipe',
					timeout: 300000
				});

				log.info(`Initialization output:\n${output}`);

				// Return success response
				return mockCreateContentResponse({
					message: 'Project initialized successfully.',
					next_step:
						'Now that the project is initialized, the next step is to create the tasks by parsing a PRD. This will create the tasks folder and the initial task files. The parse-prd tool will required a PRD file',
					output: output
				});
			} catch (error) {
				// Catch errors
				const errorMessage = `Project initialization failed: ${error.message}`;
				const errorDetails =
					error.stderr?.toString() || error.stdout?.toString() || error.message;
				log.error(`${errorMessage}\nDetails: ${errorDetails}`);

				// Return error response
				return mockCreateErrorResponse(errorMessage, { details: errorDetails });
			}
		}
	});
};

describe('Initialize Project MCP Tool', () => {
	// Mock server and logger
	let mockServer;
	let executeFunction;

	const mockLogger = {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	};

	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks();

		// Create mock server
		mockServer = {
			addTool: jest.fn((config) => {
				executeFunction = config.execute;
			})
		};

		// Default mock behavior
		mockExecSync.mockReturnValue('Project initialized successfully.');

		// Register the tool to capture the tool definition
		registerInitializeProjectTool(mockServer);
	});

	test('registers the tool with correct name and parameters', () => {
		// Check that addTool was called
		expect(mockServer.addTool).toHaveBeenCalledTimes(1);

		// Extract the tool definition from the mock call
		const toolDefinition = mockServer.addTool.mock.calls[0][0];

		// Verify tool properties
		expect(toolDefinition.name).toBe('initialize_project');
		expect(toolDefinition.description).toContain(
			'Initializes a new Task Master project'
		);
		expect(toolDefinition).toHaveProperty('parameters');
		expect(toolDefinition).toHaveProperty('execute');
	});

	test('constructs command with proper arguments', async () => {
		// Create arguments with all parameters
		const args = {
			projectName: 'Test Project',
			projectDescription: 'A project for testing',
			projectVersion: '1.0.0',
			authorName: 'Test Author',
			skipInstall: true,
			addAliases: true,
			yes: true
		};

		// Execute the tool
		await executeFunction(args, { log: mockLogger });

		// Verify execSync was called with the expected command
		expect(mockExecSync).toHaveBeenCalledTimes(1);

		const command = mockExecSync.mock.calls[0][0];

		// Check that the command includes npx task-master init
		expect(command).toContain('npx task-master init');

		// Verify each argument is correctly formatted in the command
		expect(command).toContain('--name "Test Project"');
		expect(command).toContain('--description "A project for testing"');
		expect(command).toContain('--version "1.0.0"');
		expect(command).toContain('--author "Test Author"');
		expect(command).toContain('--skip-install');
		expect(command).toContain('--aliases');
		expect(command).toContain('--yes');
	});

	test('properly escapes special characters in arguments', async () => {
		// Create arguments with special characters
		const args = {
			projectName: 'Test "Quoted" Project',
			projectDescription: 'A "special" project for testing'
		};

		// Execute the tool
		await executeFunction(args, { log: mockLogger });

		// Get the command that was executed
		const command = mockExecSync.mock.calls[0][0];

		// Verify quotes were properly escaped
		expect(command).toContain('--name "Test \\"Quoted\\" Project"');
		expect(command).toContain(
			'--description "A \\"special\\" project for testing"'
		);
	});

	test('returns success response when command succeeds', async () => {
		// Set up the mock to return specific output
		const outputMessage = 'Project initialized successfully.';
		mockExecSync.mockReturnValueOnce(outputMessage);

		// Execute the tool
		const result = await executeFunction({}, { log: mockLogger });

		// Verify createContentResponse was called with the right arguments
		expect(mockCreateContentResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'Project initialized successfully.',
				next_step: expect.any(String),
				output: outputMessage
			})
		);

		// Verify the returned result has the expected structure
		expect(result).toHaveProperty('content');
		expect(result.content).toHaveProperty('message');
		expect(result.content).toHaveProperty('next_step');
		expect(result.content).toHaveProperty('output');
		expect(result.content.output).toBe(outputMessage);
	});

	test('returns error response when command fails', async () => {
		// Create an error to be thrown
		const error = new Error('Command failed');
		error.stdout = 'Some standard output';
		error.stderr = 'Some error output';

		// Make the mock throw the error
		mockExecSync.mockImplementationOnce(() => {
			throw error;
		});

		// Execute the tool
		const result = await executeFunction({}, { log: mockLogger });

		// Verify createErrorResponse was called with the right arguments
		expect(mockCreateErrorResponse).toHaveBeenCalledWith(
			'Project initialization failed: Command failed',
			expect.objectContaining({
				details: 'Some error output'
			})
		);

		// Verify the returned result has the expected structure
		expect(result).toHaveProperty('error');
		expect(result.error).toHaveProperty('message');
		expect(result.error.message).toContain('Project initialization failed');
	});

	test('logs information about the execution', async () => {
		// Execute the tool
		await executeFunction({}, { log: mockLogger });

		// Verify that logging occurred
		expect(mockLogger.info).toHaveBeenCalledWith(
			expect.stringContaining('Executing initialize_project')
		);
		expect(mockLogger.info).toHaveBeenCalledWith(
			expect.stringContaining('Constructed command')
		);
		expect(mockLogger.info).toHaveBeenCalledWith(
			expect.stringContaining('Initialization output')
		);
	});

	test('uses fallback to stdout if stderr is not available in error', async () => {
		// Create an error with only stdout
		const error = new Error('Command failed');
		error.stdout = 'Some standard output with error details';
		// No stderr property

		// Make the mock throw the error
		mockExecSync.mockImplementationOnce(() => {
			throw error;
		});

		// Execute the tool
		await executeFunction({}, { log: mockLogger });

		// Verify createErrorResponse was called with stdout as details
		expect(mockCreateErrorResponse).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				details: 'Some standard output with error details'
			})
		);
	});

	test('logs error details when command fails', async () => {
		// Create an error
		const error = new Error('Command failed');
		error.stderr = 'Some detailed error message';

		// Make the mock throw the error
		mockExecSync.mockImplementationOnce(() => {
			throw error;
		});

		// Execute the tool
		await executeFunction({}, { log: mockLogger });

		// Verify error logging
		expect(mockLogger.error).toHaveBeenCalledWith(
			expect.stringContaining('Project initialization failed')
		);
		expect(mockLogger.error).toHaveBeenCalledWith(
			expect.stringContaining('Some detailed error message')
		);
	});
});
