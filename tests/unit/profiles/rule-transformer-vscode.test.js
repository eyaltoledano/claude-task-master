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
import { vscodeProfile } from '../../../src/profiles/vscode.js';

describe('VS Code Rule Transformer', () => {
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
Also has references to .mdc files and cursor rules.`;

		// Mock file read to return our test content
		mockReadFileSync.mockReturnValue(testContent);

		// Call the actual function
		const result = convertRuleToProfileRule(
			'source.mdc',
			'target.md',
			vscodeProfile
		);

		// Verify the function succeeded
		expect(result).toBe(true);

		// Verify file operations were called correctly
		expect(mockReadFileSync).toHaveBeenCalledWith('source.mdc', 'utf8');
		expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

		// Get the transformed content that was written
		const writeCall = mockWriteFileSync.mock.calls[0];
		const transformedContent = writeCall[1];

		// Verify transformations
		expect(transformedContent).toContain('VS Code');
		expect(transformedContent).toContain('code.visualstudio.com');
		expect(transformedContent).toContain('.md');
		expect(transformedContent).toContain('vscode rules'); // "cursor rules" -> "vscode rules"
		expect(transformedContent).toContain('applyTo: "**/*"'); // globs -> applyTo transformation
		expect(transformedContent).not.toContain('cursor.so');
		expect(transformedContent).not.toContain('Cursor rule');
		expect(transformedContent).not.toContain('globs:');
		expect(transformedContent).not.toContain('alwaysApply:');
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
			'target.md',
			vscodeProfile
		);

		// Verify the function succeeded
		expect(result).toBe(true);

		// Get the transformed content that was written
		const writeCall = mockWriteFileSync.mock.calls[0];
		const transformedContent = writeCall[1];

		// Verify transformations (VS Code uses standard tool names, so no transformation)
		expect(transformedContent).toContain('search tool');
		expect(transformedContent).toContain('edit_file tool');
		expect(transformedContent).toContain('run_command');
		expect(transformedContent).toContain('use_mcp');
		expect(transformedContent).toContain('applyTo: "**/*"'); // globs -> applyTo transformation
	});

	it('should correctly update file references and directory paths', () => {
		const testContent = `---
description: Test Cursor rule for file references
globs: .cursor/rules/*.md
alwaysApply: true
---

This references [dev_workflow.mdc](mdc:.cursor/rules/dev_workflow.mdc) and 
[taskmaster.mdc](mdc:.cursor/rules/taskmaster.mdc).
Files are in the .cursor/rules directory and we should reference the rules directory.`;

		// Mock file read to return our test content
		mockReadFileSync.mockReturnValue(testContent);

		// Call the actual function
		const result = convertRuleToProfileRule(
			'source.mdc',
			'target.instructions.md',
			vscodeProfile
		);

		// Verify the function succeeded
		expect(result).toBe(true);

		// Get the transformed content that was written
		const writeCall = mockWriteFileSync.mock.calls[0];
		const transformedContent = writeCall[1];

		// Verify transformations specific to VS Code
		expect(transformedContent).toContain(
			'applyTo: ".github/instructions/*.md"'
		); // globs -> applyTo with path transformation
		expect(transformedContent).toContain(
			'(.github/instructions/dev_workflow.instructions.md)'
		); // File path transformation - no taskmaster subdirectory for VS Code
		expect(transformedContent).toContain(
			'(.github/instructions/taskmaster.instructions.md)'
		); // File path transformation - no taskmaster subdirectory for VS Code
		expect(transformedContent).toContain('instructions directory'); // "rules directory" -> "instructions directory"
		expect(transformedContent).not.toContain('(mdc:.cursor/rules/');
		expect(transformedContent).not.toContain('.cursor/rules');
		expect(transformedContent).not.toContain('globs:');
		expect(transformedContent).not.toContain('rules directory');
	});

	it('should transform globs to applyTo with various patterns', () => {
		const testContent = `---
description: Test VS Code applyTo transformation
globs: .cursor/rules/*.md
alwaysApply: true
---

Another section:
globs: **/*.ts
final: true

Last one:
globs: src/**/*
---`;

		// Mock file read to return our test content
		mockReadFileSync.mockReturnValue(testContent);

		// Call the actual function
		const result = convertRuleToProfileRule(
			'source.mdc',
			'target.md',
			vscodeProfile
		);

		// Verify the function succeeded
		expect(result).toBe(true);

		// Get the transformed content that was written
		const writeCall = mockWriteFileSync.mock.calls[0];
		const transformedContent = writeCall[1];

		// Verify all globs transformations
		expect(transformedContent).toContain(
			'applyTo: ".github/instructions/*.md"'
		); // Path transformation applied
		expect(transformedContent).toContain('applyTo: "**/*.ts"'); // Pattern with quotes
		expect(transformedContent).toContain('applyTo: "src/**/*"'); // Complex pattern with quotes
		expect(transformedContent).not.toContain('globs:'); // No globs should remain
	});

	it('should handle VS Code MCP configuration paths correctly', () => {
		const testContent = `---
description: Test MCP configuration paths
globs: **/*
alwaysApply: true
---

MCP configuration is at .cursor/mcp.json for Cursor.
The .cursor/rules directory contains rules.
Update your .cursor/mcp.json file accordingly.`;

		// Mock file read to return our test content
		mockReadFileSync.mockReturnValue(testContent);

		// Call the actual function
		const result = convertRuleToProfileRule(
			'source.mdc',
			'target.md',
			vscodeProfile
		);

		// Verify the function succeeded
		expect(result).toBe(true);

		// Get the transformed content that was written
		const writeCall = mockWriteFileSync.mock.calls[0];
		const transformedContent = writeCall[1];

		// Verify MCP paths are correctly transformed
		expect(transformedContent).toContain('.vscode/mcp.json'); // MCP config in .vscode
		expect(transformedContent).toContain('.github/instructions'); // Rules/instructions in .github/instructions
		expect(transformedContent).not.toContain('.cursor/mcp.json');
		expect(transformedContent).not.toContain('.cursor/rules');
	});

	it('should handle file read errors', () => {
		// Mock file read to throw an error
		mockReadFileSync.mockImplementation(() => {
			throw new Error('File not found');
		});

		// Call the actual function
		const result = convertRuleToProfileRule(
			'nonexistent.mdc',
			'target.md',
			vscodeProfile
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
			'target.md',
			vscodeProfile
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
			'.github/instructions/deep/path/target.md',
			vscodeProfile
		);

		// Verify directory creation was called
		expect(mockMkdirSync).toHaveBeenCalledWith(
			'.github/instructions/deep/path',
			{
				recursive: true
			}
		);
	});
});
