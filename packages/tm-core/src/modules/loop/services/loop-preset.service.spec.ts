/**
 * @fileoverview Unit tests for LoopPresetService and preset loader functions
 * Tests both the inlined preset service and the backward-compatible API
 */

import fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoopPresetService, PRESET_NAMES } from './loop-preset.service.js';
import {
	isValidPreset,
	isFilePath,
	loadPreset,
	loadCustomPrompt,
	resolvePrompt,
	PresetError,
	PresetErrorCode,
	PRESET_NAMES as EXPORTED_PRESET_NAMES
} from '../presets/index.js';

// Mock node:fs/promises for custom prompt tests only
vi.mock('node:fs/promises', () => ({
	default: {
		readFile: vi.fn()
	}
}));

describe('LoopPresetService', () => {
	let service: LoopPresetService;

	beforeEach(() => {
		service = new LoopPresetService();
	});

	describe('isPreset', () => {
		it('returns true for all valid preset names', () => {
			expect(service.isPreset('default')).toBe(true);
			expect(service.isPreset('test-coverage')).toBe(true);
			expect(service.isPreset('linting')).toBe(true);
			expect(service.isPreset('duplication')).toBe(true);
			expect(service.isPreset('entropy')).toBe(true);
		});

		it('returns false for invalid preset names', () => {
			expect(service.isPreset('invalid')).toBe(false);
			expect(service.isPreset('custom')).toBe(false);
			expect(service.isPreset('')).toBe(false);
		});

		it('is case sensitive', () => {
			expect(service.isPreset('DEFAULT')).toBe(false);
			expect(service.isPreset('Default')).toBe(false);
			expect(service.isPreset('Test-Coverage')).toBe(false);
		});
	});

	describe('static isValidPreset', () => {
		it('returns true for valid presets', () => {
			expect(LoopPresetService.isValidPreset('default')).toBe(true);
			expect(LoopPresetService.isValidPreset('linting')).toBe(true);
		});

		it('returns false for invalid presets', () => {
			expect(LoopPresetService.isValidPreset('invalid')).toBe(false);
		});
	});

	describe('getPresetContent', () => {
		it('returns non-empty content for all presets', () => {
			for (const preset of PRESET_NAMES) {
				const content = service.getPresetContent(preset);
				expect(content).toBeTruthy();
				expect(content.length).toBeGreaterThan(0);
			}
		});

		it('default preset contains expected markers', () => {
			const content = service.getPresetContent('default');
			expect(content).toContain('<loop-complete>');
			expect(content).toContain('<loop-blocked>');
			expect(content).toContain('task-master next');
			expect(content).toContain('ONE task per session');
		});

		it('test-coverage preset contains completion marker', () => {
			const content = service.getPresetContent('test-coverage');
			expect(content).toContain('<loop-complete>');
			expect(content).toContain('COVERAGE_TARGET');
		});

		it('linting preset contains completion marker', () => {
			const content = service.getPresetContent('linting');
			expect(content).toContain('<loop-complete>');
			expect(content).toContain('ZERO_ERRORS');
		});

		it('duplication preset contains completion marker', () => {
			const content = service.getPresetContent('duplication');
			expect(content).toContain('<loop-complete>');
			expect(content).toContain('LOW_DUPLICATION');
		});

		it('entropy preset contains completion marker', () => {
			const content = service.getPresetContent('entropy');
			expect(content).toContain('<loop-complete>');
			expect(content).toContain('LOW_ENTROPY');
		});

		it('throws error for invalid preset', () => {
			expect(() => {
				// @ts-expect-error Testing invalid input
				service.getPresetContent('invalid');
			}).toThrow();
		});
	});

	describe('getPresetNames', () => {
		it('returns all 5 preset names', () => {
			const names = service.getPresetNames();
			expect(names).toHaveLength(5);
			expect(names).toContain('default');
			expect(names).toContain('test-coverage');
			expect(names).toContain('linting');
			expect(names).toContain('duplication');
			expect(names).toContain('entropy');
		});

		it('returns readonly array', () => {
			const names = service.getPresetNames();
			expect(names).toBe(PRESET_NAMES);
		});
	});

	describe('loadPreset', () => {
		it('returns content synchronously', () => {
			const content = service.loadPreset('default');
			expect(content).toBeTruthy();
			expect(typeof content).toBe('string');
		});

		it('returns same content as getPresetContent', () => {
			for (const preset of PRESET_NAMES) {
				expect(service.loadPreset(preset)).toBe(service.getPresetContent(preset));
			}
		});
	});

	describe('PRESET_NAMES export', () => {
		it('matches exported preset names from index', () => {
			expect(PRESET_NAMES).toEqual(EXPORTED_PRESET_NAMES);
		});
	});
});

describe('Preset Loader Functions (Backward Compatible API)', () => {
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
		});
	});

	describe('loadPreset (inlined content)', () => {
		it('returns content for valid presets without filesystem access', async () => {
			// No mocking needed - presets are inlined
			const content = await loadPreset('default');
			expect(content).toBeTruthy();
			expect(content).toContain('<loop-complete>');
			// fs.readFile should NOT be called for built-in presets
			expect(fs.readFile).not.toHaveBeenCalled();
		});

		it('returns content for all valid presets', async () => {
			for (const preset of EXPORTED_PRESET_NAMES) {
				const content = await loadPreset(preset);
				expect(content).toBeTruthy();
				expect(content.length).toBeGreaterThan(0);
			}
		});

		it('each preset contains expected structure', async () => {
			const defaultContent = await loadPreset('default');
			expect(defaultContent).toContain('# Task Master Loop');
			expect(defaultContent).toContain('## Process');
			expect(defaultContent).toContain('## Important');
		});
	});

	describe('loadCustomPrompt (mocked filesystem)', () => {
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
	});

	describe('resolvePrompt', () => {
		it('uses inlined content for valid preset names', async () => {
			const content = await resolvePrompt('default');

			expect(content).toContain('<loop-complete>');
			// Should NOT call fs.readFile for built-in presets
			expect(fs.readFile).not.toHaveBeenCalled();
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

		it('propagates PresetError from loadCustomPrompt', async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error('Not found'));

			await expect(resolvePrompt('/custom/path.md')).rejects.toThrow(
				PresetError
			);
			await expect(resolvePrompt('/custom/path.md')).rejects.toMatchObject({
				code: PresetErrorCode.CUSTOM_PROMPT_NOT_FOUND
			});
		});

		it('resolves all valid presets without filesystem', async () => {
			for (const preset of EXPORTED_PRESET_NAMES) {
				const content = await resolvePrompt(preset);
				expect(content).toBeTruthy();
			}
			// No filesystem calls should be made for built-in presets
			expect(fs.readFile).not.toHaveBeenCalled();
		});
	});
});

describe('Preset Content Validation', () => {
	const service = new LoopPresetService();

	it('all presets contain required markers for loop completion detection', () => {
		for (const preset of PRESET_NAMES) {
			const content = service.getPresetContent(preset);
			// Every preset must have a completion marker
			expect(content).toContain('<loop-complete>');
		}
	});

	it('default preset has both complete and blocked markers', () => {
		const content = service.getPresetContent('default');
		expect(content).toContain('<loop-complete>');
		expect(content).toContain('<loop-blocked>');
	});

	it('all presets reference progress file', () => {
		for (const preset of PRESET_NAMES) {
			const content = service.getPresetContent(preset);
			expect(content).toContain('loop-progress');
		}
	});

	it('all presets emphasize single task constraint', () => {
		for (const preset of PRESET_NAMES) {
			const content = service.getPresetContent(preset);
			expect(content.toLowerCase()).toContain('one');
		}
	});
});
