/**
 * @fileoverview Tests for preset exports and preset content structure
 */

import { describe, it, expect } from 'vitest';
import {
	PRESETS,
	PRESET_NAMES,
	getPreset,
	isPreset,
	DEFAULT_PRESET,
	TEST_COVERAGE_PRESET,
	LINTING_PRESET,
	DUPLICATION_PRESET,
	ENTROPY_PRESET
} from './index.js';

describe('Preset Exports', () => {
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
	});

	describe('PRESETS record', () => {
		it('has entries for all preset names', () => {
			for (const name of PRESET_NAMES) {
				expect(PRESETS[name]).toBeDefined();
				expect(typeof PRESETS[name]).toBe('string');
			}
		});

		it('has non-empty content for each preset', () => {
			for (const name of PRESET_NAMES) {
				expect(PRESETS[name].length).toBeGreaterThan(0);
			}
		});
	});

	describe('getPreset', () => {
		it('returns content for default preset', () => {
			const content = getPreset('default');
			expect(content).toBeTruthy();
			expect(typeof content).toBe('string');
			expect(content.length).toBeGreaterThan(0);
		});

		it('returns content for test-coverage preset', () => {
			const content = getPreset('test-coverage');
			expect(content).toBeTruthy();
			expect(content.length).toBeGreaterThan(0);
		});

		it('returns content for linting preset', () => {
			const content = getPreset('linting');
			expect(content).toBeTruthy();
			expect(content.length).toBeGreaterThan(0);
		});

		it('returns content for duplication preset', () => {
			const content = getPreset('duplication');
			expect(content).toBeTruthy();
			expect(content.length).toBeGreaterThan(0);
		});

		it('returns content for entropy preset', () => {
			const content = getPreset('entropy');
			expect(content).toBeTruthy();
			expect(content.length).toBeGreaterThan(0);
		});

		it('returns same content as PRESETS record', () => {
			for (const name of PRESET_NAMES) {
				expect(getPreset(name)).toBe(PRESETS[name]);
			}
		});
	});

	describe('isPreset', () => {
		it('returns true for valid preset names', () => {
			expect(isPreset('default')).toBe(true);
			expect(isPreset('test-coverage')).toBe(true);
			expect(isPreset('linting')).toBe(true);
			expect(isPreset('duplication')).toBe(true);
			expect(isPreset('entropy')).toBe(true);
		});

		it('returns false for invalid preset names', () => {
			expect(isPreset('invalid')).toBe(false);
			expect(isPreset('custom')).toBe(false);
			expect(isPreset('')).toBe(false);
		});

		it('returns false for file paths', () => {
			expect(isPreset('/path/to/preset.md')).toBe(false);
			expect(isPreset('./custom-preset.md')).toBe(false);
			expect(isPreset('presets/default.md')).toBe(false);
		});

		it('returns false for preset names with different casing', () => {
			expect(isPreset('Default')).toBe(false);
			expect(isPreset('DEFAULT')).toBe(false);
			expect(isPreset('Test-Coverage')).toBe(false);
		});
	});

	describe('Individual preset constants', () => {
		it('exports DEFAULT_PRESET', () => {
			expect(DEFAULT_PRESET).toBeDefined();
			expect(typeof DEFAULT_PRESET).toBe('string');
			expect(DEFAULT_PRESET.length).toBeGreaterThan(0);
		});

		it('exports TEST_COVERAGE_PRESET', () => {
			expect(TEST_COVERAGE_PRESET).toBeDefined();
			expect(typeof TEST_COVERAGE_PRESET).toBe('string');
			expect(TEST_COVERAGE_PRESET.length).toBeGreaterThan(0);
		});

		it('exports LINTING_PRESET', () => {
			expect(LINTING_PRESET).toBeDefined();
			expect(typeof LINTING_PRESET).toBe('string');
			expect(LINTING_PRESET.length).toBeGreaterThan(0);
		});

		it('exports DUPLICATION_PRESET', () => {
			expect(DUPLICATION_PRESET).toBeDefined();
			expect(typeof DUPLICATION_PRESET).toBe('string');
			expect(DUPLICATION_PRESET.length).toBeGreaterThan(0);
		});

		it('exports ENTROPY_PRESET', () => {
			expect(ENTROPY_PRESET).toBeDefined();
			expect(typeof ENTROPY_PRESET).toBe('string');
			expect(ENTROPY_PRESET.length).toBeGreaterThan(0);
		});

		it('individual constants match PRESETS record', () => {
			expect(DEFAULT_PRESET).toBe(PRESETS['default']);
			expect(TEST_COVERAGE_PRESET).toBe(PRESETS['test-coverage']);
			expect(LINTING_PRESET).toBe(PRESETS['linting']);
			expect(DUPLICATION_PRESET).toBe(PRESETS['duplication']);
			expect(ENTROPY_PRESET).toBe(PRESETS['entropy']);
		});
	});
});

describe('Preset Snapshots', () => {
	it('default preset matches snapshot', () => {
		expect(DEFAULT_PRESET).toMatchSnapshot();
	});

	it('test-coverage preset matches snapshot', () => {
		expect(TEST_COVERAGE_PRESET).toMatchSnapshot();
	});

	it('linting preset matches snapshot', () => {
		expect(LINTING_PRESET).toMatchSnapshot();
	});

	it('duplication preset matches snapshot', () => {
		expect(DUPLICATION_PRESET).toMatchSnapshot();
	});

	it('entropy preset matches snapshot', () => {
		expect(ENTROPY_PRESET).toMatchSnapshot();
	});
});

describe('Preset Structure Validation', () => {
	describe('all presets contain required elements', () => {
		it.each(PRESET_NAMES)('%s contains <loop-complete> marker', (preset) => {
			const content = getPreset(preset);
			expect(content).toMatch(/<loop-complete>/);
		});

		it.each(PRESET_NAMES.filter((p) => p !== 'default'))(
			'%s contains @ file reference pattern',
			(preset) => {
				const content = getPreset(preset);
				// Check for @ file reference pattern (e.g., @.taskmaster/ or @./)
				// Note: default preset uses context header injection instead
				expect(content).toMatch(/@\.taskmaster\/|@\.\//);
			}
		);

		it.each(PRESET_NAMES)('%s contains numbered process steps', (preset) => {
			const content = getPreset(preset);
			// Check for numbered steps (e.g., "1. ", "2. ")
			expect(content).toMatch(/^\d+\./m);
		});

		it.each(PRESET_NAMES)(
			'%s contains Important or Completion section',
			(preset) => {
				const content = getPreset(preset);
				// Check for Important section (markdown or plain text) or Completion section
				expect(content).toMatch(/## Important|## Completion|^IMPORTANT:/im);
			}
		);
	});

	describe('default preset specific requirements', () => {
		it('contains <loop-blocked> marker', () => {
			expect(DEFAULT_PRESET).toMatch(/<loop-blocked>/);
		});

		it('contains both loop markers', () => {
			expect(DEFAULT_PRESET).toMatch(/<loop-complete>.*<\/loop-complete>/);
			expect(DEFAULT_PRESET).toMatch(/<loop-blocked>.*<\/loop-blocked>/);
		});
	});
});

describe('Preset Content Consistency', () => {
	it.each(PRESET_NAMES)(
		'%s mentions single-task-per-iteration constraint',
		(preset) => {
			const content = getPreset(preset);
			// Check for variations of the single-task constraint
			const hasConstraint =
				content.toLowerCase().includes('one task') ||
				content.toLowerCase().includes('one test') ||
				content.toLowerCase().includes('one fix') ||
				content.toLowerCase().includes('one refactor') ||
				content.toLowerCase().includes('one cleanup') ||
				content.toLowerCase().includes('only one');
			expect(hasConstraint).toBe(true);
		}
	);

	it.each(PRESET_NAMES)('%s has progress file reference', (preset) => {
		const content = getPreset(preset);
		// All presets should reference the progress file
		expect(content).toMatch(/loop-progress|progress/i);
	});

	it('specialized presets have markdown headers', () => {
		// Default preset uses plain text sections (SETUP:, TASK:, PROCESS:, IMPORTANT:)
		// Other presets use markdown headers
		for (const preset of PRESET_NAMES.filter((p) => p !== 'default')) {
			const content = getPreset(preset);
			// Check for at least one markdown header
			expect(content).toMatch(/^#+ /m);
		}
	});

	it('all presets have process section', () => {
		for (const preset of PRESET_NAMES) {
			const content = getPreset(preset);
			// Check for Process header (markdown ## or plain text PROCESS:)
			expect(content).toMatch(/## Process|^PROCESS:/m);
		}
	});

	it('specialized presets have files available section', () => {
		// Default preset doesn't have files available section - context is injected at runtime
		for (const preset of PRESET_NAMES.filter((p) => p !== 'default')) {
			const content = getPreset(preset);
			// Check for Files Available header
			expect(content).toMatch(/## Files Available/);
		}
	});
});
