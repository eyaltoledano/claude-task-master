import { jest } from '@jest/globals';

// Mock fs module before importing anything that uses it
jest.mock('fs', () => ({
	readFileSync: jest.fn(),
	writeFileSync: jest.fn(),
	existsSync: jest.fn(),
	mkdirSync: jest.fn()
}));

// Import modules after mocking
import fs from 'fs';
import { convertRuleToProfileRule } from '../../../src/utils/rule-transformer.js';
import { cursorProfile } from '../../../src/profiles/cursor.js';

describe('Cursor Rule Transformer', () => {
	// Set up spies on the mocked modules
	const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
	const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync');
	const mockExistsSync = jest.spyOn(fs, 'existsSync');
	const mockMkdirSync = jest.spyOn(fs, 'mkdirSync');
	const mockConsoleError = jest
		.spyOn(console, 'error')
		.mockImplementation(() => {});

	beforeEach(() => {
		jest.clearAllMocks();
		// Setup default mocks
		mockReadFileSync.mockReturnValue('');
		mockWriteFileSync.mockImplementation(() => {});
		mockExistsSync.mockReturnValue(true);
		mockMkdirSync.mockImplementation(() => {});
	});

	afterAll(() => {
		jest.restoreAllMocks();
	});

	it('should correctly convert basic terms', () => {
		const testContent = `---
description: Test Cursor rule for basic terms
globs: **/*
alwaysApply: true
---

This is a Cursor rule that references cursor.so and uses the word Cursor multiple times.
Also has references to .mdc files.`;

		// Mock file read to return our test content
		mockReadFileSync.mockReturnValue(testContent);

		// Call the actual function
		const result = convertRuleToProfileRule(
			'source.mdc',
			'target.mdc',
			cursorProfile
		);

		// Verify the function succeeded
		expect(result).toBe(true);

		// Verify file operations were called correctly
		expect(mockReadFileSync).toHaveBeenCalledWith('source.mdc', 'utf8');
		expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

		// Get the transformed content that was written
		const writeCall = mockWriteFileSync.mock.calls[0];
		const transformedContent = writeCall[1];

		// Verify transformations (Cursor profile should keep everything the same)
		expect(transformedContent).toContain('Cursor');
		expect(transformedContent).toContain('cursor.so');
		expect(transformedContent).toContain('.mdc');
		expect(transformedContent).toContain('Cursor rule');
	});

	it('should correctly convert tool references', () => {
		const testContent = `---
description: Test Cursor rule for tool references
globs: **/*
alwaysApply: true
---

- Use the search tool to find code
- The edit_file tool lets you modify files
- run_command executes terminal commands
- use_mcp connects to external services`;

		// Mock file read to return our test content
		mockReadFileSync.mockReturnValue(testContent);

		// Call the actual function
		const result = convertRuleToProfileRule(
			'source.mdc',
			'target.mdc',
			cursorProfile
		);

		// Verify the function succeeded
		expect(result).toBe(true);

		// Get the transformed content that was written
		const writeCall = mockWriteFileSync.mock.calls[0];
		const transformedContent = writeCall[1];

		// Verify transformations (Cursor uses standard tool names, so no transformation)
		expect(transformedContent).toContain('search tool');
		expect(transformedContent).toContain('edit_file tool');
		expect(transformedContent).toContain('run_command');
		expect(transformedContent).toContain('use_mcp');
	});

	it('should correctly update file references', () => {
		const testContent = `---
description: Test Cursor rule for file references
globs: **/*
alwaysApply: true
---

This references [dev_workflow.mdc](mdc:.cursor/rules/dev_workflow.mdc) and 
[taskmaster.mdc](mdc:.cursor/rules/taskmaster.mdc).`;

		// Mock file read to return our test content
		mockReadFileSync.mockReturnValue(testContent);

		// Call the actual function
		const result = convertRuleToProfileRule(
			'source.mdc',
			'target.mdc',
			cursorProfile
		);

		// Verify the function succeeded
		expect(result).toBe(true);

		// Get the transformed content that was written
		const writeCall = mockWriteFileSync.mock.calls[0];
		const transformedContent = writeCall[1];

		// Verify transformations (Cursor should keep the same references but in taskmaster subdirectory)
		expect(transformedContent).toContain(
			'(mdc:.cursor/rules/taskmaster/dev_workflow.mdc)'
		);
		expect(transformedContent).toContain(
			'(mdc:.cursor/rules/taskmaster/taskmaster.mdc)'
		);
	});

	it('should handle file read errors', () => {
		// Mock file read to throw an error
		mockReadFileSync.mockImplementation(() => {
			throw new Error('File not found');
		});

		// Call the actual function
		const result = convertRuleToProfileRule(
			'nonexistent.mdc',
			'target.mdc',
			cursorProfile
		);

		// Verify the function failed gracefully
		expect(result).toBe(false);

		// Verify writeFileSync was not called
		expect(mockWriteFileSync).not.toHaveBeenCalled();

		// Verify error was logged
		expect(mockConsoleError).toHaveBeenCalledWith(
			'Error converting rule file: File not found'
		);
	});

	it('should handle file write errors', () => {
		const testContent = 'test content';
		mockReadFileSync.mockReturnValue(testContent);

		// Mock file write to throw an error
		mockWriteFileSync.mockImplementation(() => {
			throw new Error('Permission denied');
		});

		// Call the actual function
		const result = convertRuleToProfileRule(
			'source.mdc',
			'target.mdc',
			cursorProfile
		);

		// Verify the function failed gracefully
		expect(result).toBe(false);

		// Verify error was logged
		expect(mockConsoleError).toHaveBeenCalledWith(
			'Error converting rule file: Permission denied'
		);
	});

	it('should create target directory if it does not exist', () => {
		const testContent = 'test content';
		mockReadFileSync.mockReturnValue(testContent);

		// Mock directory doesn't exist initially
		mockExistsSync.mockReturnValue(false);

		// Call the actual function
		convertRuleToProfileRule(
			'source.mdc',
			'some/deep/path/target.mdc',
			cursorProfile
		);

		// Verify directory creation was called
		expect(mockMkdirSync).toHaveBeenCalledWith('some/deep/path', {
			recursive: true
		});
	});
});
