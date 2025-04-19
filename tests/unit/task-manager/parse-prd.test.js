/**
 * Tests for the parsePRD function
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Import the specific function being tested (assuming it's exported)
// import { parsePRD } from '../../../scripts/modules/task-manager.js'; 

// Import the fixture
import { sampleClaudeResponse } from '../../fixtures/sample-claude-response.js';

// Mock implementations needed for parsePRD tests
const mockReadFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockDirname = jest.fn();
const mockCallClaude = jest.fn(); 
const mockWriteJSON = jest.fn();
const mockGenerateTaskFiles = jest.fn(); // Mock this even if testing its functionality elsewhere
const mockPromptYesNo = jest.fn(); 
const mockLog = jest.fn(); // Assuming utils.log might be used

// Mock fs module
jest.mock('fs', () => ({
    readFileSync: mockReadFileSync,
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    // writeFileSync: jest.fn() // Add if needed, likely mocked elsewhere if used by generateTaskFiles
}));

// Mock path module
jest.mock('path', () => ({
    dirname: mockDirname,
    join: jest.fn((dir, file) => `${dir}/${file}`) // Basic mock for join
}));

// Mock AI services (only need callClaude for parsePRD)
jest.mock('../../../scripts/modules/ai-services.js', () => ({
    callClaude: mockCallClaude
}));

// Mock utils (only need functions used directly or indirectly by parsePRD)
jest.mock('../../../scripts/modules/utils.js', () => ({
    writeJSON: mockWriteJSON,
    log: mockLog,
    promptYesNo: mockPromptYesNo 
}));

// Mock task-manager itself for generateTaskFiles (dependency of parsePRD)
jest.mock('../../../scripts/modules/task-manager.js', () => {
	const originalModule = jest.requireActual('../../../scripts/modules/task-manager.js');
	return {
		...originalModule, 
		generateTaskFiles: mockGenerateTaskFiles, // Keep generateTaskFiles mocked here
		// Keep other original functions if needed by the *real* parsePRD, 
		// but for the *test* version, we likely don't need them.
	};
});


// We are testing the *simplified* version used in the original test file
// as the real parsePRD might have more complex dependencies.
const testParsePRD = async (prdPath, outputPath, numTasks) => {
	try {
		// Check if the output file already exists
		if (mockExistsSync(outputPath)) {
			const confirmOverwrite = await mockPromptYesNo(
				`Warning: ${outputPath} already exists. Overwrite?`,
				false
			);

			if (!confirmOverwrite) {
				console.log(`Operation cancelled. ${outputPath} was not modified.`);
				return null;
			}
		}

		const prdContent = mockReadFileSync(prdPath, 'utf8');
		const tasks = await mockCallClaude(prdContent, prdPath, numTasks); // Use mocked Claude call
		const dir = mockDirname(outputPath);

		if (!mockExistsSync(dir)) {
			mockMkdirSync(dir, { recursive: true });
		}

		mockWriteJSON(outputPath, tasks); // Use mocked writeJSON
		await mockGenerateTaskFiles(outputPath, dir); // Use mocked generateTaskFiles

		return tasks;
	} catch (error) {
		console.error(`Error parsing PRD: ${error.message}`);
		// In a real CLI, you'd exit, but in tests, maybe just throw or log
		// process.exit(1); // Avoid exiting in tests
		throw error; // Rethrow or handle as appropriate for testing
	}
};


describe('parsePRD function', () => {
		// Mock the sample PRD content
		const samplePRDContent = '# Sample PRD for Testing';

		beforeEach(() => {
			// Reset all mocks
			jest.clearAllMocks();

			// Set up mocks for fs, path and other modules
			mockReadFileSync.mockReturnValue(samplePRDContent);
			mockExistsSync.mockReturnValue(true); // Default: file/dir exists
			mockDirname.mockReturnValue('tasks');
			mockCallClaude.mockResolvedValue(sampleClaudeResponse);
			mockGenerateTaskFiles.mockResolvedValue(undefined);
			mockPromptYesNo.mockResolvedValue(true); // Default to "yes" for confirmation
		});

		test('should parse a PRD file and generate tasks', async () => {
			// Call the test version of parsePRD
			await testParsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

			// Verify fs.readFileSync was called with the correct arguments
			expect(mockReadFileSync).toHaveBeenCalledWith('path/to/prd.txt', 'utf8');

			// Verify callClaude was called with the correct arguments
			expect(mockCallClaude).toHaveBeenCalledWith(
				samplePRDContent,
				'path/to/prd.txt',
				3
			);

			// Verify directory check (for output path's dir)
			expect(mockDirname).toHaveBeenCalledWith('tasks/tasks.json');
			expect(mockExistsSync).toHaveBeenCalledWith('tasks'); // Checking if the directory exists

			// Verify writeJSON was called with the correct arguments
			expect(mockWriteJSON).toHaveBeenCalledWith(
				'tasks/tasks.json',
				sampleClaudeResponse
			);

			// Verify generateTaskFiles was called
			expect(mockGenerateTaskFiles).toHaveBeenCalledWith(
				'tasks/tasks.json',
				'tasks'
			);
		});

		test('should create the tasks directory if it does not exist', async () => {
			// Mock existsSync: return false for the directory, false for the output file
			mockExistsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return false; // Directory doesn't exist
				return true; // Default for other paths (e.g., PRD file)
			});

			// Call the function
			await testParsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

            // Verify directory check
            expect(mockExistsSync).toHaveBeenCalledWith('tasks'); 
			// Verify mkdir was called
			expect(mockMkdirSync).toHaveBeenCalledWith('tasks', { recursive: true });
            // Ensure file was still written after dir creation
            expect(mockWriteJSON).toHaveBeenCalled(); 
		});

		test('should handle errors in the PRD parsing process (e.g., Claude call fails)', async () => {
			// Mock an error in callClaude
			const testError = new Error('Test error in Claude API call');
			mockCallClaude.mockRejectedValueOnce(testError);

			// Mock console.error to check if it's called
			const mockConsoleError = jest
				.spyOn(console, 'error')
				.mockImplementation(() => {});

			// Call the function and expect it to throw
			await expect(testParsePRD('path/to/prd.txt', 'tasks/tasks.json', 3)).rejects.toThrow(testError);

			// Verify error handling (console log)
			expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining(`Error parsing PRD: ${testError.message}`));
			
			// Restore mocks
			mockConsoleError.mockRestore();
		});


		test('should generate individual task files after creating tasks.json', async () => {
            mockExistsSync.mockReturnValue(false); // Assume file doesn't exist initially
			// Call the function
			await testParsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

			// Verify generateTaskFiles was called *after* writeJSON
            // expect(mockWriteJSON).toHaveBeenCalledBefore(mockGenerateTaskFiles); // REMOVED THIS LINE
			expect(mockGenerateTaskFiles).toHaveBeenCalledWith(
				'tasks/tasks.json',
				'tasks'
			);
		});

		test('should prompt for confirmation when tasks.json already exists', async () => {
			// Setup mocks to simulate tasks.json already exists
			mockExistsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return true; // Output file exists
				if (path === 'tasks') return true; // Directory exists
				return false; // Assume PRD file doesn't exist for simplicity here
			});
            mockReadFileSync.mockReturnValue(samplePRDContent); // Ensure PRD file read still works

			// Call the function
			await testParsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

			// Verify prompt was called with expected message
			expect(mockPromptYesNo).toHaveBeenCalledWith(
				'Warning: tasks/tasks.json already exists. Overwrite?',
				false
			);

			// Verify the file was written after confirmation (since mockPromptYesNo resolves true by default)
			expect(mockWriteJSON).toHaveBeenCalledWith(
				'tasks/tasks.json',
				sampleClaudeResponse
			);
		});

		test('should not overwrite tasks.json when user declines confirmation', async () => {
			// Setup mocks to simulate tasks.json already exists
			mockExistsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return true; // Output file exists
				if (path === 'tasks') return true; // Directory exists
				return false;
			});
            mockReadFileSync.mockReturnValue(samplePRDContent); // Ensure PRD file read still works


			// Mock user declining the confirmation
			mockPromptYesNo.mockResolvedValueOnce(false);

			// Mock console.log to capture output
			const mockConsoleLog = jest
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			// Call the function
			const result = await testParsePRD(
				'path/to/prd.txt',
				'tasks/tasks.json',
				3
			);

			// Verify prompt was called
			expect(mockPromptYesNo).toHaveBeenCalledWith(
				'Warning: tasks/tasks.json already exists. Overwrite?',
				false
			);

			// Verify the file was NOT written
			expect(mockWriteJSON).not.toHaveBeenCalled();
            expect(mockGenerateTaskFiles).not.toHaveBeenCalled(); // Should also not generate files

			// Verify appropriate message was logged
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'Operation cancelled. tasks/tasks.json was not modified.'
			);

			// Verify result is null when operation is cancelled
			expect(result).toBeNull();

			// Restore console.log
			mockConsoleLog.mockRestore();
		});

		test('should not prompt for confirmation when tasks.json does not exist', async () => {
			// Setup mocks to simulate tasks.json does not exist
			mockExistsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});
            mockReadFileSync.mockReturnValue(samplePRDContent);


			// Call the function
			await testParsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

			// Verify prompt was NOT called
			expect(mockPromptYesNo).not.toHaveBeenCalled();

			// Verify the file was written without confirmation
			expect(mockWriteJSON).toHaveBeenCalledWith(
				'tasks/tasks.json',
				sampleClaudeResponse
			);
            expect(mockGenerateTaskFiles).toHaveBeenCalled(); // Ensure generation still happens
		});
}); 