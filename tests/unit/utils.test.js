/**
 * Utils module tests
 */

import { jest } from '@jest/globals';
import actualFs from 'fs'; // Import actual fs for type reference and for spying if not globally mocking
import actualPath from 'path'; // Import actual path for type reference

// Mock fs module: Ensure all functions are jest.fn()
const mockFsExistsSync = jest.fn();
const mockFsReadFileSync = jest.fn();
const mockFsWriteFileSync = jest.fn();
const mockFsMkdirSync = jest.fn();

jest.mock('fs', () => ({
  __esModule: true,
  existsSync: mockFsExistsSync,
  readFileSync: mockFsReadFileSync,
  writeFileSync: mockFsWriteFileSync,
  mkdirSync: mockFsMkdirSync,
}));

// Mock path module: Ensure all functions are jest.fn()
const mockPathJoin = jest.fn((...args) => args.join('/'));
const mockPathDirname = jest.fn((filePath) => filePath.split('/').slice(0, -1).join('/'));
const mockPathResolve = jest.fn((...args) => args.join('/'));
const mockPathBasename = jest.fn((filePath) => filePath.split('/').pop());
const mockPathIsAbsolute = jest.fn();

jest.mock('path', () => ({
  __esModule: true,
  join: mockPathJoin,
  dirname: mockPathDirname,
  resolve: mockPathResolve,
  basename: mockPathBasename,
  isAbsolute: mockPathIsAbsolute,
  sep: '/',
}));

// Mock chalk
jest.mock('chalk', () => ({
  red: jest.fn((text) => text),
  blue: jest.fn((text) => text),
  green: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  white: jest.fn((text) => ({
    bold: jest.fn((text) => text),
  })),
  reset: jest.fn((text) => text),
  dim: jest.fn((text) => text),
}));

// Mock console
const mockConsoleLog = jest.fn();
const mockConsoleInfo = jest.fn();
const mockConsoleWarn = jest.fn();
const mockConsoleError = jest.fn();
global.console = {
  log: mockConsoleLog,
  info: mockConsoleInfo,
  warn: mockConsoleWarn,
  error: mockConsoleError,
};

// Mock path-utils
jest.mock('../../src/utils/path-utils.js', () => ({
  __esModule: true,
  findProjectRoot: jest.fn(() => '/mock/project'),
  findConfigPath: jest.fn(() => null),
  findTasksPath: jest.fn(() => '/mock/tasks.json'),
  findComplexityReportPath: jest.fn(() => null),
  resolveTasksOutputPath: jest.fn(() => '/mock/tasks.json'),
  resolveComplexityReportOutputPath: jest.fn(() => '/mock/report.json'),
}));

// Mock task-validator
const mockValidateTasksFile = jest.fn();
const mockFormatZodError = jest.fn(zodError => {
  if (zodError && zodError.issues) {
    return zodError.issues.map(e => `Path: ${e.path.join('.')} - Issue: ${e.message}`);
  }
  return ["Mocked Zod Error String"];
});
jest.mock('../../scripts/modules/task-validator.js', () => ({
  validateTasksFile: mockValidateTasksFile,
  validateTask: jest.fn(),
  formatZodError: mockFormatZodError,
}));

// Mock config-manager
const mockGetLogLevel = jest.fn(() => 'info');
const mockGetDebugFlag = jest.fn(() => false);
jest.mock('../../scripts/modules/config-manager.js', () => ({
  getLogLevel: mockGetLogLevel,
  getDebugFlag: mockGetDebugFlag,
}));

// Import the mocked versions for use in tests
// Note: utils.js itself will be imported dynamically within describe/test blocks
// after mocks and jest.resetModules() are set up.
import fs from 'fs'; // This will be the mocked version
import path from 'path'; // This will be the mocked version


function testDetectCamelCaseFlags(args) {
  const camelCaseFlags = [];
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const flagName = arg.split('=')[0].slice(2);
      if (!flagName.includes('-') && !/[A-Z]/.test(flagName)) continue;
      if (/[a-z][A-Z]/.test(flagName)) {
        const kebabVersion = toKebabCase(flagName);
        if (kebabVersion !== flagName) {
          camelCaseFlags.push({ original: flagName, kebabCase: kebabVersion });
        }
      }
    }
  }
  return camelCaseFlags;
}

describe('Utils Module', () => {
  let utils; // To hold all imported functions from utils.js

  beforeEach(async () => {
    jest.resetModules(); // Crucial: Resets the module cache

    // Reset all manually created mock functions to clear state and calls
    mockFsExistsSync.mockReset();
    mockFsReadFileSync.mockReset();
    mockFsWriteFileSync.mockReset();
    mockFsMkdirSync.mockReset();

    mockPathJoin.mockReset().mockImplementation((...args) => args.join('/'));
    mockPathDirname.mockReset().mockImplementation((filePath) => filePath.split('/').slice(0, -1).join('/'));
    mockPathResolve.mockReset().mockImplementation((...args) => args.join('/')); // Or more sophisticated if needed
    mockPathBasename.mockReset().mockImplementation((filePath) => filePath.split('/').pop());
    mockPathIsAbsolute.mockReset();

    mockValidateTasksFile.mockReset();
    mockFormatZodError.mockReset().mockImplementation(zodError => {
      if (zodError && zodError.issues) {
        return zodError.issues.map(e => `Path: ${e.path.join('.')} - Issue: ${e.message}`);
      }
      return ["Mocked Zod Error String"];
    });

    mockGetLogLevel.mockReset().mockReturnValue('info');
    mockGetDebugFlag.mockReset().mockReturnValue(false);

    // Mock console functions directly on global.console, then clear them
    global.console.log = jest.fn();
    global.console.info = jest.fn();
    global.console.warn = jest.fn();
    global.console.error = jest.fn();

    // Default behaviors for fs mocks for most tests AFTER resetting them
    mockFsReadFileSync.mockReturnValue('{}');
    mockFsExistsSync.mockReturnValue(false);

    // Dynamically import the module to be tested AFTER all mocks are set up and reset
    try {
      utils = await import('../../scripts/modules/utils.js');
    } catch (e) {
      console.error("Error importing utils.js in beforeEach:", e); // Debug log
      throw e; // Re-throw to fail the test setup clearly
    }
  });

  describe('truncate function', () => {
    test('should return the original string if shorter than maxLength', () => expect(utils.truncate('Hello', 10)).toBe('Hello'));
    test('should truncate the string and add ellipsis if longer than maxLength', () => expect(utils.truncate('This is a long string that needs truncation', 20)).toBe('This is a long st...'));
    test('should handle empty string', () => expect(utils.truncate('', 10)).toBe(''));
    test('should return null when input is null', () => expect(utils.truncate(null, 10)).toBeNull());
    test('should return undefined when input is undefined', () => expect(utils.truncate(undefined, 10)).toBeUndefined());
    test('should handle maxLength of 0 or negative', () => {
        expect(utils.truncate('Hello', 0)).toBe('He...');
        expect(utils.truncate('Hello', -5)).toBe('...');
    });
  });

  describe.skip('log function', () => { /* ... */ });

  describe('readJSON with Zod validation', () => {
    test('should call validateTasksFile with parsed content and log warnings if tasks.json is invalid', () => {
      const fakeTasksPath = 'tasks.json';
      const rawParsedContent = { "masterS": { "tasks": [], "metadata": {"created": "2023-01-01T00:00:00Z", "updated": "2023-01-01T00:00:00Z", "description": "d"} } };
      const jsonString = JSON.stringify(rawParsedContent);
      const formattedErrorString = "Path: masterS.tasks.0.id - Issue: Expected number";

      mockFsReadFileSync.mockReturnValue(jsonString); // Configure for this specific test
      mockValidateTasksFile.mockReturnValue({ isValid: false, errors: [formattedErrorString] });

      utils.readJSON(fakeTasksPath, '/mock/project');

      expect(mockFsReadFileSync).toHaveBeenCalledWith(fakeTasksPath, 'utf8');
      expect(mockValidateTasksFile).toHaveBeenCalledWith(rawParsedContent);
      expect(global.console.warn).toHaveBeenCalledWith(expect.stringContaining(`Validation warning for ${fakeTasksPath} - ${formattedErrorString}`));
    });

    test('should return processed data even if tasks.json Zod validation fails', () => {
      const fakeTasksPath = 'tasks.json';
      const rawFileContent = { "master": {"tasks": [{"id": 1, "title": "t", "description": "d", "status": "pending"}], "metadata": {"created": "2023-01-01T00:00:00.000Z", "updated": "2023-01-01T00:00:00.000Z", "description":"desc"}}};
      mockFsReadFileSync.mockReturnValue(JSON.stringify(rawFileContent));
      mockValidateTasksFile.mockReturnValue({ isValid: false, errors: ["Formatted Zod Error 1"] });

      const result = utils.readJSON(fakeTasksPath, '/mock/project');

      expect(mockValidateTasksFile).toHaveBeenCalledWith(rawFileContent);
      expect(result).toBeDefined();
      expect(result._rawTaggedData).toEqual(rawFileContent);
      expect(result.tag).toBe('master');
      expect(result.tasks).toEqual(rawFileContent.master.tasks);
    });

    test('should not call validateTasksFile for non-tasks.json files', () => {
      const fakeOtherPath = 'other.json';
      mockFsReadFileSync.mockReturnValue('{}'); // Default should be fine
      utils.readJSON(fakeOtherPath);
      expect(mockValidateTasksFile).not.toHaveBeenCalled();
    });
  });

  describe('writeJSON with Zod validation', () => {
    test('should throw error and not write if tasks.json data is invalid by Zod', () => {
      const fakeTasksPath = 'tasks.json';
      const cleanDataToWrite = { "myTagS": { "tasks": [{"id": "wrong", "title": "t", "description":"d", "status":"pending"}], "metadata": {"created":"2023-01-01T00:00:00Z", "updated":"2023-01-01T00:00:00Z", "description":"d"} } };
      const formattedErrorString = "Path: myTagS.tasks.0.id - Issue: Expected number";
      mockValidateTasksFile.mockReturnValue({ isValid: false, errors: [formattedErrorString] });

      expect(() => {
        utils.writeJSON(fakeTasksPath, cleanDataToWrite);
      }).toThrow('Tasks file validation failed. Aborting write operation.');

      expect(mockValidateTasksFile).toHaveBeenCalledWith(cleanDataToWrite);
      expect(mockFsWriteFileSync).not.toHaveBeenCalled();
      expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining(`Validation failed for ${fakeTasksPath}. Not writing to disk.`));
      expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining(`- ${formattedErrorString}`));
    });

    test('should write to disk if tasks.json data is valid by Zod', () => {
      const fakeTasksPath = 'tasks.json';
      const cleanDataToWrite = { "myTagS": { "tasks": [{"id": 1, "title": "t", "description":"d", "status":"pending", "dependencies":[], "priority":"medium", "subtasks":[]}], "metadata": {"created":"2023-01-01T00:00:00.000Z", "updated":"2023-01-01T00:00:00.000Z", "description":"d"} } };
      mockValidateTasksFile.mockReturnValue({ isValid: true, errors: null });

      utils.writeJSON(fakeTasksPath, cleanDataToWrite);

      expect(mockValidateTasksFile).toHaveBeenCalledWith(cleanDataToWrite);
      expect(mockFsWriteFileSync).toHaveBeenCalledWith(
        fakeTasksPath,
        JSON.stringify(cleanDataToWrite, null, 2),
        'utf8'
      );
    });

    test('should write to disk for non-tasks.json files without validation call', () => {
      const fakeOtherPath = 'other.json';
      const dataToWrite = { content: "any" };

      utils.writeJSON(fakeOtherPath, dataToWrite);

      expect(mockValidateTasksFile).not.toHaveBeenCalled();
      expect(mockFsWriteFileSync).toHaveBeenCalledWith(
        fakeOtherPath,
        JSON.stringify(dataToWrite, null, 2),
        'utf8'
      );
    });
  });

  describe('readComplexityReport function', () => {
		test('should read and parse a valid complexity report', () => {
			const testReport = {
				meta: { generatedAt: new Date().toISOString() },
				complexityAnalysis: [{ taskId: 1, complexityScore: 7 }]
			};
			// Specific mock setup for this test
			mockFsExistsSync.mockImplementation(p => p.endsWith('.taskmaster/reports/task-complexity-report.json'));
			mockFsReadFileSync.mockReturnValue(JSON.stringify(testReport));
			// mockPathJoin will use its default flexible mock

			const result = utils.readComplexityReport();
			expect(mockFsExistsSync).toHaveBeenCalled(); // Check it was called
			expect(mockFsReadFileSync).toHaveBeenCalled(); // Check it was called
			expect(result).toEqual(testReport);
		});
    test('should handle missing report file', () => {
			mockFsExistsSync.mockReturnValue(false); // All paths will not exist
			// mockPathJoin will use its default flexible mock

			const result = utils.readComplexityReport();
			expect(result).toBeNull();
			expect(mockFsReadFileSync).not.toHaveBeenCalled();
		});
	});

  describe('sanitizePrompt', () => { test('should work', () => expect(utils.sanitizePrompt('"test"')).toBe('\\"test\\"'));});
  describe('findTaskInComplexityReport', () => { test('should work', () => expect(utils.findTaskInComplexityReport({complexityAnalysis:[{taskId:1}]},1)).toEqual({taskId:1}));});
  describe('taskExists', () => { test('should work', () => expect(utils.taskExists([{id:1}],1)).toBe(true));});
  describe('formatTaskId', () => { test('should work', () => expect(utils.formatTaskId(1)).toBe("1"));});
  describe('findCycles', () => { test('should work', () => expect(utils.findCycles("A", new Map())).toEqual([]));});
  describe('CLI Flag Format Validation', () => {test('toKebabCase should convert camelCase to kebab-case', () => expect(utils.toKebabCase('testOne')).toBe('test-one'));});
});
