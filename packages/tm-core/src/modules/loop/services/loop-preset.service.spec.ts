/**
 * @fileoverview Unit tests for preset loader with mocked filesystem
 * Tests error scenarios and edge cases using vi.mock for fs
 */

import fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	isValidPreset,
	isFilePath,
	loadPreset,
	loadCustomPrompt,
	resolvePrompt,
	PresetError,
	PresetErrorCode,
	PRESET_NAMES
} from '../presets/index.js';

// Mock node:fs/promises for isolated tests
vi.mock('node:fs/promises', () => ({
	default: {
		readFile: vi.fn()
	}
}));

describe('Preset Loader with Mocked FS', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('isValidPreset', () => {
		it('returns true for all valid preset names', () => {
			expect(isValidPreset('default')).toBe(true);
			expect(isValidPreset('test-coverage')).toBe(true);
			expect(isValidPreset('linting')).toBe(true);
			expect(isValidPreset('duplication')).toBe(true);
			expect(isValidPreset('entropy')).toBe(true);
		});

		it('returns false for invalid preset names', () => {
			expect(isValidPreset('invalid')).toBe(false);
			expect(isValidPreset('custom')).toBe(false);
			expect(isValidPreset('')).toBe(false);
		});

		it('is case sensitive - DEFAULT is not valid', () => {
			expect(isValidPreset('DEFAULT')).toBe(false);
			expect(isValidPreset('Default')).toBe(false);
			expect(isValidPreset('Test-Coverage')).toBe(false);
		});

		it('returns false for preset name with .md extension', () => {
			expect(isValidPreset('default.md')).toBe(false);
		});

		it('handles non-string inputs gracefully via type guard', () => {
			// TypeScript would normally catch these, but testing runtime behavior
			expect(isValidPreset('' as string)).toBe(false);
		});
	});

	describe('isFilePath', () => {
		describe('Unix paths', () => {
			it('returns true for absolute Unix paths', () => {
				expect(isFilePath('/path/to/file.md')).toBe(true);
				expect(isFilePath('/absolute/path')).toBe(true);
			});

			it('returns true for relative Unix paths with ./', () => {
				expect(isFilePath('./relative/path.txt')).toBe(true);
				expect(isFilePath('./prompt')).toBe(true);
			});

			it('returns true for parent directory paths with ../', () => {
				expect(isFilePath('../parent/file.md')).toBe(true);
				expect(isFilePath('../../grandparent')).toBe(true);
			});
		});

		describe('Windows paths', () => {
			it('returns true for Windows absolute paths', () => {
				expect(isFilePath('C:\\path\\file.md')).toBe(true);
				expect(isFilePath('D:\\folder\\subfolder')).toBe(true);
			});

			it('returns true for Windows relative paths', () => {
				expect(isFilePath('.\\relative\\path.txt')).toBe(true);
				expect(isFilePath('..\\parent')).toBe(true);
			});
		});

		describe('file extensions', () => {
			it('returns true for .md extension without path', () => {
				expect(isFilePath('prompt.md')).toBe(true);
			});

			it('returns true for .txt extension without path', () => {
				expect(isFilePath('prompt.txt')).toBe(true);
			});

			it('returns true for .markdown extension without path', () => {
				expect(isFilePath('prompt.markdown')).toBe(true);
			});

			it('is case insensitive for extensions', () => {
				expect(isFilePath('PROMPT.MD')).toBe(true);
				expect(isFilePath('prompt.TXT')).toBe(true);
				expect(isFilePath('file.Markdown')).toBe(true);
			});
		});

		describe('paths with spaces', () => {
			it('returns true for Unix paths with spaces', () => {
				expect(isFilePath('/path/with spaces/file.md')).toBe(true);
				expect(isFilePath('./my prompts/custom.txt')).toBe(true);
			});

			it('returns true for Windows paths with spaces', () => {
				expect(isFilePath('C:\\path\\with spaces\\file.md')).toBe(true);
			});
		});

		describe('edge cases', () => {
			it('returns false for simple name without path or extension', () => {
				expect(isFilePath('simple-name')).toBe(false);
				expect(isFilePath('prompt')).toBe(false);
			});

			it('returns true for path without extension', () => {
				expect(isFilePath('folder/prompt')).toBe(true);
			});

			it('returns false for empty string', () => {
				expect(isFilePath('')).toBe(false);
			});

			it('returns false for unsupported extensions', () => {
				expect(isFilePath('file.js')).toBe(false);
				expect(isFilePath('file.json')).toBe(false);
				expect(isFilePath('file.ts')).toBe(false);
			});
		});
	});

	describe('loadPreset (mocked)', () => {
		it('returns content when file read succeeds', async () => {
			const mockContent = '# Test Preset\n\nContent here';
			vi.mocked(fs.readFile).mockResolvedValue(mockContent);

			const content = await loadPreset('default');

			expect(content).toBe(mockContent);
			expect(fs.readFile).toHaveBeenCalledWith(
				expect.stringContaining('default.md'),
				'utf-8'
			);
		});

		it('throws PresetError with PRESET_NOT_FOUND when file does not exist', async () => {
			const error = new Error('ENOENT: no such file or directory');
			vi.mocked(fs.readFile).mockRejectedValue(error);

			await expect(loadPreset('default')).rejects.toThrow(PresetError);
			await expect(loadPreset('default')).rejects.toMatchObject({
				code: PresetErrorCode.PRESET_NOT_FOUND
			});
		});

		it('error message lists available presets', async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

			try {
				await loadPreset('default');
			} catch (error) {
				expect(error).toBeInstanceOf(PresetError);
				const presetError = error as PresetError;
				expect(presetError.message).toContain('Available presets:');
				for (const preset of PRESET_NAMES) {
					expect(presetError.message).toContain(preset);
				}
			}
		});

		it('throws PresetError with EMPTY_PROMPT_CONTENT for empty file', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('');

			await expect(loadPreset('default')).rejects.toThrow(PresetError);
			await expect(loadPreset('default')).rejects.toMatchObject({
				code: PresetErrorCode.EMPTY_PROMPT_CONTENT
			});
		});

		it('throws PresetError with EMPTY_PROMPT_CONTENT for whitespace-only file', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('   \n\t  \n  ');

			await expect(loadPreset('default')).rejects.toThrow(PresetError);
			await expect(loadPreset('default')).rejects.toMatchObject({
				code: PresetErrorCode.EMPTY_PROMPT_CONTENT
			});
		});

		it('constructs correct file path for each preset', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('content');

			for (const preset of PRESET_NAMES) {
				await loadPreset(preset);
				expect(fs.readFile).toHaveBeenCalledWith(
					expect.stringContaining(`${preset}.md`),
					'utf-8'
				);
			}
		});
	});

	describe('loadCustomPrompt (mocked)', () => {
		it('returns content when file read succeeds', async () => {
			const mockContent = '# Custom Prompt\n\nMy custom instructions';
			vi.mocked(fs.readFile).mockResolvedValue(mockContent);

			const content = await loadCustomPrompt('/my/custom/prompt.md');

			expect(content).toBe(mockContent);
			expect(fs.readFile).toHaveBeenCalledWith('/my/custom/prompt.md', 'utf-8');
		});

		it('throws PresetError with CUSTOM_PROMPT_NOT_FOUND when file does not exist', async () => {
			vi.mocked(fs.readFile).mockRejectedValue(
				new Error('ENOENT: no such file')
			);

			await expect(
				loadCustomPrompt('/non/existent/file.md')
			).rejects.toThrow(PresetError);
			await expect(
				loadCustomPrompt('/non/existent/file.md')
			).rejects.toMatchObject({
				code: PresetErrorCode.CUSTOM_PROMPT_NOT_FOUND
			});
		});

		it('error message includes the file path', async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error('Not found'));
			const filePath = '/path/to/missing/file.md';

			try {
				await loadCustomPrompt(filePath);
			} catch (error) {
				expect(error).toBeInstanceOf(PresetError);
				expect((error as PresetError).message).toContain(filePath);
			}
		});

		it('throws PresetError with EMPTY_PROMPT_CONTENT for empty file', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('');

			await expect(
				loadCustomPrompt('/my/empty/file.md')
			).rejects.toThrow(PresetError);
			await expect(
				loadCustomPrompt('/my/empty/file.md')
			).rejects.toMatchObject({
				code: PresetErrorCode.EMPTY_PROMPT_CONTENT
			});
		});

		it('throws PresetError with EMPTY_PROMPT_CONTENT for whitespace-only file', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('   \n  \t  ');

			await expect(
				loadCustomPrompt('/my/whitespace/file.md')
			).rejects.toMatchObject({
				code: PresetErrorCode.EMPTY_PROMPT_CONTENT
			});
		});

		it('preserves file path exactly as passed', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('content');

			const weirdPath = '/path/with spaces/and-dashes/file.md';
			await loadCustomPrompt(weirdPath);

			expect(fs.readFile).toHaveBeenCalledWith(weirdPath, 'utf-8');
		});
	});

	describe('resolvePrompt (mocked)', () => {
		it('calls loadPreset for valid preset names', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('preset content');

			const content = await resolvePrompt('default');

			expect(content).toBe('preset content');
			expect(fs.readFile).toHaveBeenCalledWith(
				expect.stringContaining('default.md'),
				'utf-8'
			);
		});

		it('calls loadCustomPrompt for file paths', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('custom content');

			const content = await resolvePrompt('/path/to/custom.md');

			expect(content).toBe('custom content');
			expect(fs.readFile).toHaveBeenCalledWith('/path/to/custom.md', 'utf-8');
		});

		it('treats non-preset strings as file paths', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('content');

			await resolvePrompt('my-custom-prompt');

			// Since 'my-custom-prompt' is not a valid preset, it's treated as a path
			expect(fs.readFile).toHaveBeenCalledWith('my-custom-prompt', 'utf-8');
		});

		it('propagates PresetError from loadPreset', async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error('Not found'));

			await expect(resolvePrompt('default')).rejects.toThrow(PresetError);
			await expect(resolvePrompt('default')).rejects.toMatchObject({
				code: PresetErrorCode.PRESET_NOT_FOUND
			});
		});

		it('propagates PresetError from loadCustomPrompt', async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error('Not found'));

			await expect(resolvePrompt('/custom/path.md')).rejects.toThrow(
				PresetError
			);
			await expect(resolvePrompt('/custom/path.md')).rejects.toMatchObject({
				code: PresetErrorCode.CUSTOM_PROMPT_NOT_FOUND
			});
		});

		it('resolves all valid presets', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('content');

			for (const preset of PRESET_NAMES) {
				const content = await resolvePrompt(preset);
				expect(content).toBe('content');
			}
		});
	});

	describe('Integration-style tests (mocked)', () => {
		it('verifies correct file path construction for presets', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('# Preset');

			await loadPreset('test-coverage');

			// Should call with path ending in test-coverage.md
			const callArgs = vi.mocked(fs.readFile).mock.calls[0];
			expect(callArgs[0]).toMatch(/test-coverage\.md$/);
			expect(callArgs[1]).toBe('utf-8');
		});

		it('verifies custom paths are passed through unchanged', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('content');

			const customPath = './relative/path/to/my-prompt.md';
			await loadCustomPrompt(customPath);

			expect(fs.readFile).toHaveBeenCalledWith(customPath, 'utf-8');
		});

		it('distinguishes between preset and custom resolution correctly', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('content');

			// Preset - should look in presets directory
			await resolvePrompt('linting');
			const presetCall = vi.mocked(fs.readFile).mock.calls[0];
			expect(presetCall[0]).toMatch(/linting\.md$/);

			vi.clearAllMocks();

			// Custom - should use exact path
			await resolvePrompt('./my-custom-linting.md');
			const customCall = vi.mocked(fs.readFile).mock.calls[0];
			expect(customCall[0]).toBe('./my-custom-linting.md');
		});
	});
});
