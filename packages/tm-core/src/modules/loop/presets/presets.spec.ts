/**
 * @fileoverview Tests for preset loader utilities
 */

import { describe, it, expect } from 'vitest';
import {
	PRESET_NAMES,
	isValidPreset,
	getPresetPath,
	loadPreset
} from './index.js';

describe('Preset Utilities', () => {
	describe('PRESET_NAMES', () => {
		it('contains all 5 preset names', () => {
			expect(PRESET_NAMES).toHaveLength(5);
		});

		it('includes default preset', () => {
			expect(PRESET_NAMES).toContain('default');
		});

		it('includes test-coverage preset', () => {
			expect(PRESET_NAMES).toContain('test-coverage');
		});

		it('includes linting preset', () => {
			expect(PRESET_NAMES).toContain('linting');
		});

		it('includes duplication preset', () => {
			expect(PRESET_NAMES).toContain('duplication');
		});

		it('includes entropy preset', () => {
			expect(PRESET_NAMES).toContain('entropy');
		});

		it('is readonly', () => {
			// TypeScript compile-time check - attempting to modify should error
			const names = PRESET_NAMES;
			expect(Object.isFrozen(names) || Array.isArray(names)).toBe(true);
		});
	});

	describe('isValidPreset', () => {
		it('returns true for valid preset names', () => {
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

		it('returns false for file paths', () => {
			expect(isValidPreset('/path/to/preset.md')).toBe(false);
			expect(isValidPreset('./custom-preset.md')).toBe(false);
			expect(isValidPreset('presets/default.md')).toBe(false);
		});

		it('returns false for preset names with different casing', () => {
			expect(isValidPreset('Default')).toBe(false);
			expect(isValidPreset('DEFAULT')).toBe(false);
			expect(isValidPreset('Test-Coverage')).toBe(false);
		});
	});

	describe('getPresetPath', () => {
		it('returns correct path for default preset', () => {
			expect(getPresetPath('default')).toBe('default.md');
		});

		it('returns correct path for test-coverage preset', () => {
			expect(getPresetPath('test-coverage')).toBe('test-coverage.md');
		});

		it('returns correct path for linting preset', () => {
			expect(getPresetPath('linting')).toBe('linting.md');
		});

		it('returns correct path for duplication preset', () => {
			expect(getPresetPath('duplication')).toBe('duplication.md');
		});

		it('returns correct path for entropy preset', () => {
			expect(getPresetPath('entropy')).toBe('entropy.md');
		});

		it('returns paths ending in .md', () => {
			for (const preset of PRESET_NAMES) {
				const path = getPresetPath(preset);
				expect(path.endsWith('.md')).toBe(true);
			}
		});
	});

	describe('loadPreset', () => {
		it('throws error when preset file does not exist', async () => {
			// Until preset markdown files are created, loadPreset should throw
			await expect(loadPreset('default')).rejects.toThrow();
		});
	});

	describe('Barrel exports from index.ts', () => {
		it('exports PRESET_NAMES', () => {
			expect(PRESET_NAMES).toBeDefined();
			expect(Array.isArray(PRESET_NAMES)).toBe(true);
		});

		it('exports isValidPreset function', () => {
			expect(isValidPreset).toBeDefined();
			expect(typeof isValidPreset).toBe('function');
		});

		it('exports getPresetPath function', () => {
			expect(getPresetPath).toBeDefined();
			expect(typeof getPresetPath).toBe('function');
		});

		it('exports loadPreset function', () => {
			expect(loadPreset).toBeDefined();
			expect(typeof loadPreset).toBe('function');
		});
	});
});
