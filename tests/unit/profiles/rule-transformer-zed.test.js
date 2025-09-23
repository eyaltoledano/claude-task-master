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
import { zedProfile } from '../../../src/profiles/zed.js';

describe('Zed Rule Transformer', () => {
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

		// Mock file system operations
		mockExistsSync.mockReturnValue(true);

		// Call the function
		const result = convertRuleToProfileRule(
			'test-source.mdc',
			'test-target.md',
			zedProfile
		);

		// Verify the result
		expect(result).toBe(true);
		expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

		// Get the transformed content
		const transformedContent = mockWriteFileSync.mock.calls[0][1];

		// Verify Cursor -> Zed transformations
		expect(transformedContent).toContain('zed.dev');
		expect(transformedContent).toContain('Zed');
		expect(transformedContent).not.toContain('cursor.so');
		expect(transformedContent).not.toContain('Cursor');
		expect(transformedContent).toContain('.md');
		expect(transformedContent).not.toContain('.mdc');
	});

	it('should handle URL transformations', () => {
		const testContent = `Visit https://cursor.so/docs for more information.
Also check out cursor.so and www.cursor.so for updates.`;

		mockReadFileSync.mockReturnValue(testContent);
		mockExistsSync.mockReturnValue(true);

		const result = convertRuleToProfileRule(
			'test-source.mdc',
			'test-target.md',
			zedProfile
		);

		expect(result).toBe(true);
		const transformedContent = mockWriteFileSync.mock.calls[0][1];

		// Verify URL transformations
		expect(transformedContent).toContain('https://zed.dev');
		expect(transformedContent).toContain('zed.dev');
		expect(transformedContent).not.toContain('cursor.so');
	});

	it('should handle file extension transformations', () => {
		const testContent = `This rule references file.mdc and another.mdc file.
Use the .mdc extension for all rule files.`;

		mockReadFileSync.mockReturnValue(testContent);
		mockExistsSync.mockReturnValue(true);

		const result = convertRuleToProfileRule(
			'test-source.mdc',
			'test-target.md',
			zedProfile
		);

		expect(result).toBe(true);
		const transformedContent = mockWriteFileSync.mock.calls[0][1];

		// Verify file extension transformations
		expect(transformedContent).toContain('file.md');
		expect(transformedContent).toContain('another.md');
		expect(transformedContent).toContain('.md extension');
		expect(transformedContent).not.toContain('.mdc');
	});

	it('should handle case variations', () => {
		const testContent = `CURSOR, Cursor, cursor should all be transformed.`;

		mockReadFileSync.mockReturnValue(testContent);
		mockExistsSync.mockReturnValue(true);

		const result = convertRuleToProfileRule(
			'test-source.mdc',
			'test-target.md',
			zedProfile
		);

		expect(result).toBe(true);
		const transformedContent = mockWriteFileSync.mock.calls[0][1];

		// Verify case transformations
		// Due to regex order, the case-insensitive rule runs first:
		// CURSOR -> Zed (because it starts with 'C'), Cursor -> Zed, cursor -> zed
		expect(transformedContent).toContain('Zed');
		expect(transformedContent).toContain('zed');
		expect(transformedContent).not.toContain('CURSOR');
		expect(transformedContent).not.toContain('Cursor');
		expect(transformedContent).not.toContain('cursor');
	});

	it('should create target directory if it does not exist', () => {
		const testContent = 'Test content';
		mockReadFileSync.mockReturnValue(testContent);
		mockExistsSync.mockReturnValue(false);

		const result = convertRuleToProfileRule(
			'test-source.mdc',
			'nested/path/test-target.md',
			zedProfile
		);

		expect(result).toBe(true);
		expect(mockMkdirSync).toHaveBeenCalledWith('nested/path', {
			recursive: true
		});
	});

	it('should handle file system errors gracefully', () => {
		mockReadFileSync.mockImplementation(() => {
			throw new Error('File not found');
		});

		const result = convertRuleToProfileRule(
			'test-source.mdc',
			'test-target.md',
			zedProfile
		);

		expect(result).toBe(false);
		expect(mockConsoleError).toHaveBeenCalledWith(
			'Error converting rule file: File not found'
		);
	});

	it('should handle write errors gracefully', () => {
		mockReadFileSync.mockReturnValue('Test content');
		mockWriteFileSync.mockImplementation(() => {
			throw new Error('Write permission denied');
		});

		const result = convertRuleToProfileRule(
			'test-source.mdc',
			'test-target.md',
			zedProfile
		);

		expect(result).toBe(false);
		expect(mockConsoleError).toHaveBeenCalledWith(
			'Error converting rule file: Write permission denied'
		);
	});

	it('should verify profile configuration', () => {
		expect(zedProfile.profileName).toBe('zed');
		expect(zedProfile.displayName).toBe('Zed');
		expect(zedProfile.profileDir).toBe('.zed');
		expect(zedProfile.mcpConfig).toBe(true);
		expect(zedProfile.mcpConfigName).toBe('settings.json');
		expect(zedProfile.mcpConfigPath).toBe('.zed/settings.json');
		expect(zedProfile.includeDefaultRules).toBe(false);
		expect(zedProfile.fileMap).toEqual({
			'AGENTS.md': '.rules'
		});
	});
});
