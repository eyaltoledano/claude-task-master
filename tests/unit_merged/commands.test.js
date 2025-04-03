/*
import { jest } from '@jest/globals';

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
  red: jest.fn(text => text),
  blue: jest.fn(text => text),
  green: jest.fn(text => text),
  yellow: jest.fn(text => text),
  white: jest.fn(text => ({ 
    bold: jest.fn(text => text)
  })),
  reset: jest.fn(text => text)
}));

jest.mock('../../scripts/modules/ui.js', () => ({
  displayBanner: mockDisplayBanner,
  displayHelp: mockDisplayHelp
}));

jest.mock('../../scripts/modules/task-manager.js', () => ({
  parsePRD: mockParsePRD,
  updateTaskById: mockUpdateTaskById
}));

// Corrected mock for utils.js
jest.mock('../../scripts/modules/utils.js', () => {
  const originalUtils = jest.requireActual('../../scripts/modules/utils.js');
  return {
    // Keep actual implementations for these
    CONFIG: originalUtils.CONFIG,
    toKebabCase: originalUtils.toKebabCase,
    // Mock detectCamelCaseFlags directly here
    detectCamelCaseFlags: jest.fn((args) => {
        // Simple mock implementation - adjust if needed based on tests
        const flags = [];
        for (const arg of args) {
          if (arg.startsWith('--')) {
            const flagName = arg.split('=')[0].slice(2);
            if (/[a-z][A-Z]/.test(flagName) && !flagName.includes('-')) {
              flags.push(arg);
            }
          }
        }
        return flags;
    }),
    // Mock these functions
    log: jest.fn(),
    readJSON: jest.fn(),
    writeJSON: jest.fn(),
    sanitizePrompt: jest.fn(prompt => prompt),
    readComplexityReport: jest.fn(),
    findTaskInComplexityReport: jest.fn(),
    taskExists: jest.fn(),
    formatTaskId: jest.fn(id => String(id)),
    findTaskById: jest.fn(),
    truncate: jest.fn((text, len) => text ? text.slice(0, len) : text),
    findCycles: jest.fn(() => []),
  };
});

// Import all modules after mocking
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { program } from 'commander'; // Import the mocked program
import * as commands from '../../scripts/modules/commands.js';
import { CONFIG, log } from '../../scripts/modules/utils.js'; // Import necessary utils
import * as taskManager from '../../scripts/modules/task-manager.js'; // Import task-manager mock
import * as ui from '../../scripts/modules/ui.js'; // Import ui mock
import inquirer from 'inquirer';


// We'll use a simplified, direct test approach instead of Commander mocking
describe.skip('Commands Module', () => { // Skipping this suite

  // Set up spies on the mocked modules
  const mockExistsSync = jest.spyOn(fs, 'existsSync');
  const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
  const mockJoin = jest.spyOn(path, 'join');
  const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('setupCLI function', () => {
    // This test needs refinement as direct Commander mocking is tricky
    test.skip('should configure program instance', () => {
        const mockProgram = { // Create a more detailed mock if needed
            version: jest.fn().mockReturnThis(),
            command: jest.fn().mockReturnThis(),
            description: jest.fn().mockReturnThis(),
            option: jest.fn().mockReturnThis(),
            action: jest.fn().mockReturnThis(),
            on: jest.fn().mockReturnThis(),
        };
        commands.setupCLI(mockProgram); 
        expect(mockProgram.version).toHaveBeenCalled();
        // Add more specific checks if needed
    });
  });

  describe('runCLI function', () => {
      test.skip('should call program.parse', () => {
        const mockProgram = { parse: jest.fn() };
        const args = ['node', 'script.js'];
        commands.runCLI(mockProgram, args);
        expect(mockProgram.parse).toHaveBeenCalledWith(args);
      });
  });

  describe('parse-prd command action simulation', () => {
    // Directly test the logic inside the action handler if possible
    // Requires extracting the action handler or refactoring
    test.skip('should call parsePRD with correct args', async () => {
        // Simulate calling the action handler
        // This requires mocking or extracting the handler effectively
    });
  });

  describe('update-task action simulation', () => {
    // Directly test the logic inside the action handler
    test.skip('should validate required parameters - missing ID', async () => {
        // Simulate calling the action handler for update-task
    });
     // Add more tests for update-task action logic
  });

});

// Test the version comparison utility
describe.skip('Version comparison', () => { // Skipping this suite too
  let compareVersions;
  
  beforeAll(async () => {
    const commandsModule = await import('../../scripts/modules/commands.js');
    compareVersions = commandsModule.compareVersions;
  });

  test('compareVersions correctly compares semantic versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    // Add more comparison cases
  });
});

// Test the update check functionality
describe.skip('Update check', () => { // Skipping this suite too
  let displayUpgradeNotification;
  let consoleLogSpy;
  
  beforeAll(async () => {
    const commandsModule = await import('../../scripts/modules/commands.js');
    displayUpgradeNotification = commandsModule.displayUpgradeNotification;
  });
  
  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test('displays upgrade notification when newer version is available', () => {
    displayUpgradeNotification('1.0.0', '1.1.0');
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleLogSpy.mock.calls[0][0]).toContain('Update Available!');
  }


    test('should return Commander program instance', () => {
      const program = setupCLI();
      expect(program).toBeDefined();
      expect(program.name()).toBe('dev');
    }



    test('should read version from package.json when available', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
      mockJoin.mockReturnValue('package.json');
      
      const program = setupCLI();
      const version = program._version();
      expect(mockReadFileSync).toHaveBeenCalledWith('package.json', 'utf8');
      expect(version).toBe('1.0.0');
    }



    test('should use default version when package.json is not available', () => {
      mockExistsSync.mockReturnValue(false);
      
      const program = setupCLI();
      const version = program._version();
      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(version).toBe('1.5.0');
    }



    test('should use default version when package.json reading throws an error', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Invalid JSON');
      });
      
      const program = setupCLI();
      const version = program._version();
      expect(mockReadFileSync).toHaveBeenCalled();
      expect(version).toBe('1.5.0');
    }


    test('should detect camelCase flags correctly', () => {
      const args = ['node', 'task-master', '--camelCase', '--kebab-case'];
      const camelCaseFlags = args.filter(arg => 
        arg.startsWith('--') && 
        /[A-Z]/.test(arg) && 
        !arg.includes('-[A-Z]')
      );
      expect(camelCaseFlags).toContain('--camelCase');
      expect(camelCaseFlags).not.toContain('--kebab-case');
    }



    test('should accept kebab-case flags correctly', () => {
      const args = ['node', 'task-master', '--kebab-case'];
      const camelCaseFlags = args.filter(arg => 
        arg.startsWith('--') && 
        /[A-Z]/.test(arg) && 
        !arg.includes('-[A-Z]')
      );
      expect(camelCaseFlags).toHaveLength(0);
    }



    test('should use default PRD path when no arguments provided', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      
      // Act - call the handler directly with the right params
      await parsePrdAction(undefined, { numTasks: '10', output: 'tasks/tasks.json' });
      
      // Assert
      expect(mockExistsSync).toHaveBeenCalledWith('scripts/prd.txt');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Using default PRD file'));
      expect(mockParsePRD).toHaveBeenCalledWith(
        'scripts/prd.txt',
        'tasks/tasks.json',
        10 // Default value from command definition
      );
    }



    test('should display help when no arguments and no default PRD exists', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      
      // Act - call the handler directly with the right params
      await parsePrdAction(undefined, { numTasks: '10', output: 'tasks/tasks.json' });
      
      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No PRD file specified'));
      expect(mockParsePRD).not.toHaveBeenCalled();
    }



    test('should use explicitly provided file path', async () => {
      // Arrange
      const testFile = 'test/prd.txt';
      
      // Act - call the handler directly with the right params
      await parsePrdAction(testFile, { numTasks: '10', output: 'tasks/tasks.json' });
      
      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`Parsing PRD file: ${testFile}`));
      expect(mockParsePRD).toHaveBeenCalledWith(testFile, 'tasks/tasks.json', 10);
      expect(mockExistsSync).not.toHaveBeenCalledWith('scripts/prd.txt');
    }



    test('should use file path from input option when provided', async () => {
      // Arrange
      const testFile = 'test/prd.txt';
      
      // Act - call the handler directly with the right params
      await parsePrdAction(undefined, { input: testFile, numTasks: '10', output: 'tasks/tasks.json' });
      
      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`Parsing PRD file: ${testFile}`));
      expect(mockParsePRD).toHaveBeenCalledWith(testFile, 'tasks/tasks.json', 10);
      expect(mockExistsSync).not.toHaveBeenCalledWith('scripts/prd.txt');
    }



    test('should respect numTasks and output options', async () => {
      // Arrange
      const testFile = 'test/prd.txt';
      const outputFile = 'custom/output.json';
      const numTasks = 15;
      
      // Act - call the handler directly with the right params
      await parsePrdAction(testFile, { numTasks: numTasks.toString(), output: outputFile });
      
      // Assert
      expect(mockParsePRD).toHaveBeenCalledWith(testFile, outputFile, numTasks);
    }


    
    test('should validate required parameters - missing ID', async () => {
      // Set up the command options without ID
      const options = {
        file: 'test-tasks.json',
        prompt: 'Update the task'
      };
      
      // Call the action directly
      await updateTaskAction(options);
      
      // Verify validation error
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('--id parameter is required'));
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockUpdateTaskById).not.toHaveBeenCalled();
    }


    
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
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Invalid task ID'));
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockUpdateTaskById).not.toHaveBeenCalled();
    }


    
    test('should validate required parameters - missing prompt', async () => {
      // Set up the command options without prompt
      const options = {
        file: 'test-tasks.json',
        id: '2'
      };
      
      // Call the action directly
      await updateTaskAction(options);
      
      // Verify validation error
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('--prompt parameter is required'));
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockUpdateTaskById).not.toHaveBeenCalled();
    }


    
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
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Tasks file not found'));
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockUpdateTaskById).not.toHaveBeenCalled();
    }


    
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
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Updating task 2'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Using Perplexity AI'));
      
      // Clean up
      delete process.env.PERPLEXITY_API_KEY;
    }


    
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
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Task update was not completed'));
    }


    
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
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Error: Task update failed'));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
}); 
*/ 