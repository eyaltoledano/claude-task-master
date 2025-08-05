import { jest } from '@jest/globals';

// Mock fs module before importing anything that uses it
jest.mock('fs', () => ({
	readFileSync: jest.fn(),
	writeFileSync: jest.fn(),
	existsSync: jest.fn(),
	mkdirSync: jest.fn(),
	readdirSync: jest.fn(),
	copyFileSync: jest.fn()
}));

// Mock the log function
jest.mock('../../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	isSilentMode: jest.fn().mockReturnValue(false)
}));

// Import modules after mocking
import fs from 'fs';
import { convertRuleToProfileRule } from '../../../src/utils/rule-transformer.js';
import { kiroProfile } from '../../../src/profiles/kiro.js';

describe('Kiro Rule Transformer', () => {
	// Set up spies on the mocked modules
	const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
	const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync');
	const mockExistsSync = jest.spyOn(fs, 'existsSync');
	const mockMkdirSync = jest.spyOn(fs, 'mkdirSync');
	const mockConsoleError = jest
		.spyOn(console, 'error')
		.mockImplementation(() => {});
	jest.spyOn(console, 'log').mockImplementation(() => {});

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
			kiroProfile
		);

		// Verify the result
		expect(result).toBe(true);
		expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

		// Get the transformed content
		const transformedContent = mockWriteFileSync.mock.calls[0][1];

		// Verify Cursor -> Kiro transformations
		expect(transformedContent).toContain('kiro.dev');
		expect(transformedContent).toContain('Kiro');
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
			kiroProfile
		);

		expect(result).toBe(true);
		const transformedContent = mockWriteFileSync.mock.calls[0][1];

		// Verify URL transformations
		expect(transformedContent).toContain('https://kiro.dev');
		expect(transformedContent).toContain('kiro.dev');
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
			kiroProfile
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
			kiroProfile
		);

		expect(result).toBe(true);
		const transformedContent = mockWriteFileSync.mock.calls[0][1];

		// Verify case transformations
		// Due to regex order, the case-insensitive rule runs first:
		// CURSOR -> Kiro (because it starts with 'C'), Cursor -> Kiro, cursor -> kiro
		expect(transformedContent).toContain('Kiro');
		expect(transformedContent).toContain('kiro');
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
			kiroProfile
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
			kiroProfile
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
			kiroProfile
		);

		expect(result).toBe(false);
		expect(mockConsoleError).toHaveBeenCalledWith(
			'Error converting rule file: Write permission denied'
		);
	});

	it('should verify profile configuration', () => {
		expect(kiroProfile.profileName).toBe('kiro');
		expect(kiroProfile.displayName).toBe('Kiro');
		expect(kiroProfile.profileDir).toBe('.kiro');
		expect(kiroProfile.mcpConfig).toBe(true);
		expect(kiroProfile.mcpConfigName).toBe('settings/mcp.json');
		expect(kiroProfile.mcpConfigPath).toBe('.kiro/settings/mcp.json');
		expect(kiroProfile.includeDefaultRules).toBe(true);
		expect(kiroProfile.fileMap).toEqual({
			'rules/cursor_rules.mdc': 'kiro_rules.md',
			'rules/dev_workflow.mdc': 'dev_workflow.md',
			'rules/self_improve.mdc': 'self_improve.md',
			'rules/taskmaster.mdc': 'taskmaster.md',
			'rules/taskmaster_hooks_workflow.mdc': 'taskmaster_hooks_workflow.md'
		});
	});

	describe('onPostConvert lifecycle hook', () => {
		const mockReaddirSync = jest.spyOn(fs, 'readdirSync');
		const mockCopyFileSync = jest.spyOn(fs, 'copyFileSync');

		beforeEach(() => {
			jest.clearAllMocks();
			// Setup default mock implementation that doesn't throw
			mockCopyFileSync.mockImplementation(() => {});
		});

		it('should copy hook files when kiro-hooks directory exists', () => {
			const projectRoot = '/test/project';
			const assetsDir = '/test/assets';
			const hookFiles = [
				'tm-test-hook1.kiro.hook',
				'tm-test-hook2.kiro.hook',
				'not-a-hook.txt'
			];

			// Mock directory existence
			mockExistsSync.mockImplementation((path) => {
				if (path === '/test/assets/kiro-hooks') return true;
				if (path === '/test/project/.kiro/hooks') return false;
				return true;
			});

			// Mock reading hook files
			mockReaddirSync.mockReturnValue(hookFiles);

			// Call the lifecycle hook
			kiroProfile.onPostConvertRulesProfile(projectRoot, assetsDir);

			// Verify hooks directory was created
			expect(mockMkdirSync).toHaveBeenCalledWith('/test/project/.kiro/hooks', {
				recursive: true
			});

			// Verify only .kiro.hook files were copied
			expect(mockCopyFileSync).toHaveBeenCalledTimes(2);
			expect(mockCopyFileSync).toHaveBeenCalledWith(
				'/test/assets/kiro-hooks/tm-test-hook1.kiro.hook',
				'/test/project/.kiro/hooks/tm-test-hook1.kiro.hook'
			);
			expect(mockCopyFileSync).toHaveBeenCalledWith(
				'/test/assets/kiro-hooks/tm-test-hook2.kiro.hook',
				'/test/project/.kiro/hooks/tm-test-hook2.kiro.hook'
			);
		});

		it('should handle case when hooks directory already exists', () => {
			const projectRoot = '/test/project';
			const assetsDir = '/test/assets';
			const hookFiles = ['tm-test-hook.kiro.hook'];

			// Mock all directories exist
			mockExistsSync.mockReturnValue(true);
			mockReaddirSync.mockReturnValue(hookFiles);

			// Call the lifecycle hook
			kiroProfile.onPostConvertRulesProfile(projectRoot, assetsDir);

			// Verify hooks directory was NOT created (already exists)
			expect(mockMkdirSync).not.toHaveBeenCalled();

			// Verify hook was copied
			expect(mockCopyFileSync).toHaveBeenCalledWith(
				'/test/assets/kiro-hooks/tm-test-hook.kiro.hook',
				'/test/project/.kiro/hooks/tm-test-hook.kiro.hook'
			);
		});

		it('should handle case when kiro-hooks source directory does not exist', () => {
			const projectRoot = '/test/project';
			const assetsDir = '/test/assets';

			// Mock source directory doesn't exist
			mockExistsSync.mockImplementation((path) => {
				if (path === '/test/assets/kiro-hooks') return false;
				return true;
			});

			// Call the lifecycle hook
			kiroProfile.onPostConvertRulesProfile(projectRoot, assetsDir);

			// Verify no files were copied
			expect(mockReaddirSync).not.toHaveBeenCalled();
			expect(mockCopyFileSync).not.toHaveBeenCalled();
		});

		it('should handle case when no hook files exist in source directory', () => {
			const projectRoot = '/test/project';
			const assetsDir = '/test/assets';

			// Mock directory exists but has no hook files
			mockExistsSync.mockReturnValue(true);
			mockReaddirSync.mockReturnValue(['readme.txt', 'config.json']);

			// Call the lifecycle hook
			kiroProfile.onPostConvertRulesProfile(projectRoot, assetsDir);

			// Verify no files were copied
			expect(mockCopyFileSync).not.toHaveBeenCalled();
		});
	});
});
