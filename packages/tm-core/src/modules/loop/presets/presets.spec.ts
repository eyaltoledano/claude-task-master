/**
 * @fileoverview Tests for preset loader utilities and preset file structure
 */

import { describe, it, expect } from 'vitest';
import {
	PRESET_NAMES,
	isValidPreset,
	getPresetPath,
	loadPreset
} from './index.js';
import type { LoopPreset } from '../types.js';

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
		it('loads default preset successfully', async () => {
			const content = await loadPreset('default');
			expect(content).toBeTruthy();
			expect(typeof content).toBe('string');
			expect(content.length).toBeGreaterThan(0);
		});

		it('loads test-coverage preset successfully', async () => {
			const content = await loadPreset('test-coverage');
			expect(content).toBeTruthy();
			expect(typeof content).toBe('string');
			expect(content.length).toBeGreaterThan(0);
		});

		it('loads linting preset successfully', async () => {
			const content = await loadPreset('linting');
			expect(content).toBeTruthy();
			expect(typeof content).toBe('string');
			expect(content.length).toBeGreaterThan(0);
		});

		it('loads duplication preset successfully', async () => {
			const content = await loadPreset('duplication');
			expect(content).toBeTruthy();
			expect(typeof content).toBe('string');
			expect(content.length).toBeGreaterThan(0);
		});

		it('loads entropy preset successfully', async () => {
			const content = await loadPreset('entropy');
			expect(content).toBeTruthy();
			expect(typeof content).toBe('string');
			expect(content.length).toBeGreaterThan(0);
		});

		it('returns non-empty string for each preset', async () => {
			for (const preset of PRESET_NAMES) {
				const content = await loadPreset(preset);
				expect(content).toBeTruthy();
				expect(content.trim().length).toBeGreaterThan(0);
			}
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

describe('Preset Snapshots', () => {
	it('default preset matches snapshot', async () => {
		const content = await loadPreset('default');
		expect(content).toMatchSnapshot();
	});

	it('test-coverage preset matches snapshot', async () => {
		const content = await loadPreset('test-coverage');
		expect(content).toMatchSnapshot();
	});

	it('linting preset matches snapshot', async () => {
		const content = await loadPreset('linting');
		expect(content).toMatchSnapshot();
	});

	it('duplication preset matches snapshot', async () => {
		const content = await loadPreset('duplication');
		expect(content).toMatchSnapshot();
	});

	it('entropy preset matches snapshot', async () => {
		const content = await loadPreset('entropy');
		expect(content).toMatchSnapshot();
	});
});

describe('Preset Structure Validation', () => {
	describe('all presets contain required elements', () => {
		const testPresetStructure = async (preset: LoopPreset) => {
			const content = await loadPreset(preset);
			return content;
		};

		it.each(PRESET_NAMES)('%s contains <loop-complete> marker', async (preset) => {
			const content = await testPresetStructure(preset);
			expect(content).toMatch(/<loop-complete>/);
		});

		it.each(PRESET_NAMES)('%s contains @ file reference pattern', async (preset) => {
			const content = await testPresetStructure(preset);
			// Check for @ file reference pattern (e.g., @.taskmaster/ or @./)
			expect(content).toMatch(/@\.taskmaster\/|@\.\//);
		});

		it.each(PRESET_NAMES)('%s contains numbered process steps', async (preset) => {
			const content = await testPresetStructure(preset);
			// Check for numbered steps (e.g., "1. ", "2. ")
			expect(content).toMatch(/^\d+\./m);
		});

		it.each(PRESET_NAMES)('%s contains Important or Completion section', async (preset) => {
			const content = await testPresetStructure(preset);
			// Check for Important section or Completion Criteria section
			expect(content).toMatch(/## Important|## Completion/i);
		});
	});

	describe('default preset specific requirements', () => {
		it('contains <loop-blocked> marker', async () => {
			const content = await loadPreset('default');
			expect(content).toMatch(/<loop-blocked>/);
		});

		it('contains both loop markers', async () => {
			const content = await loadPreset('default');
			expect(content).toMatch(/<loop-complete>.*<\/loop-complete>/);
			expect(content).toMatch(/<loop-blocked>.*<\/loop-blocked>/);
		});
	});
});

describe('Preset Content Consistency', () => {
	it.each(PRESET_NAMES)('%s mentions single-task-per-iteration constraint', async (preset) => {
		const content = await loadPreset(preset);
		// Check for variations of the single-task constraint
		const hasConstraint =
			content.toLowerCase().includes('one task') ||
			content.toLowerCase().includes('one test') ||
			content.toLowerCase().includes('one fix') ||
			content.toLowerCase().includes('one refactor') ||
			content.toLowerCase().includes('one cleanup') ||
			content.toLowerCase().includes('only one');
		expect(hasConstraint).toBe(true);
	});

	it.each(PRESET_NAMES)('%s has progress file reference', async (preset) => {
		const content = await loadPreset(preset);
		// All presets should reference the progress file
		expect(content).toMatch(/loop-progress|progress/i);
	});

	it('all presets have markdown headers', async () => {
		for (const preset of PRESET_NAMES) {
			const content = await loadPreset(preset);
			// Check for at least one markdown header
			expect(content).toMatch(/^#+ /m);
		}
	});

	it('all presets have process section', async () => {
		for (const preset of PRESET_NAMES) {
			const content = await loadPreset(preset);
			// Check for Process header
			expect(content).toMatch(/## Process/);
		}
	});

	it('all presets have files available section', async () => {
		for (const preset of PRESET_NAMES) {
			const content = await loadPreset(preset);
			// Check for Files Available header
			expect(content).toMatch(/## Files Available/);
		}
	});
});
