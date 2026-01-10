/**
 * @fileoverview Integration tests for preset accessibility
 *
 * Tests that preset content is accessible without filesystem dependencies,
 * validating that the inlined preset approach works correctly for both
 * development and bundled distribution contexts.
 *
 * These tests verify:
 * - All 5 presets can be loaded without filesystem access
 * - Preset content contains required markers for loop completion detection
 * - Preset content structure is valid and usable by the loop system
 *
 * @integration
 */

import { describe, expect, it } from 'vitest';
import {
	PRESETS,
	PRESET_NAMES,
	getPreset,
	isPreset,
	type LoopPreset
} from '../../../src/modules/loop/index.js';

describe('Preset Accessibility Integration', () => {
	describe('Preset Accessibility', () => {
		it('should load all 5 presets without filesystem access', () => {
			// This test verifies that presets are inlined and don't require fs
			expect(PRESET_NAMES).toHaveLength(5);

			for (const presetName of PRESET_NAMES) {
				const content = getPreset(presetName);
				expect(content).toBeTruthy();
				expect(typeof content).toBe('string');
				expect(content.length).toBeGreaterThan(100);
			}
		});

		it('should have all expected preset names available', () => {
			const expectedPresets: LoopPreset[] = [
				'default',
				'test-coverage',
				'linting',
				'duplication',
				'entropy'
			];

			for (const preset of expectedPresets) {
				expect(isPreset(preset)).toBe(true);
			}
		});

		it('should have PRESETS record with all presets', () => {
			expect(Object.keys(PRESETS)).toHaveLength(5);
			expect(PRESETS['default']).toBeTruthy();
			expect(PRESETS['test-coverage']).toBeTruthy();
			expect(PRESETS['linting']).toBeTruthy();
			expect(PRESETS['duplication']).toBeTruthy();
			expect(PRESETS['entropy']).toBeTruthy();
		});

		it('should have getPreset return same content as PRESETS record', () => {
			for (const presetName of PRESET_NAMES) {
				expect(getPreset(presetName)).toBe(PRESETS[presetName]);
			}
		});
	});

	describe('Preset Content Structure', () => {
		it('all presets should contain loop-complete marker', () => {
			for (const presetName of PRESET_NAMES) {
				const content = getPreset(presetName);
				expect(content).toContain('<loop-complete>');
			}
		});

		it('default preset should contain both complete and blocked markers', () => {
			const content = getPreset('default');
			expect(content).toContain('<loop-complete>');
			expect(content).toContain('<loop-blocked>');
		});

		it('all presets should reference progress file', () => {
			for (const presetName of PRESET_NAMES) {
				const content = getPreset(presetName);
				// Default uses "progress file", others use "loop-progress"
				expect(content).toMatch(/loop-progress|progress file/i);
			}
		});

		it('all presets should emphasize single-task constraint', () => {
			for (const presetName of PRESET_NAMES) {
				const content = getPreset(presetName);
				// All presets should mention completing ONE task/test/fix per session
				expect(content).toMatch(/\bONE\b/i);
			}
		});

		it('each preset should have unique completion reason', () => {
			const completionReasons = new Set<string>();

			for (const presetName of PRESET_NAMES) {
				const content = getPreset(presetName);
				// Extract the completion reason from <loop-complete>REASON</loop-complete>
				const match = content.match(/<loop-complete>([^<]+)<\/loop-complete>/);
				expect(match).toBeTruthy();
				if (match) {
					completionReasons.add(match[1]);
				}
			}

			// All presets should have unique completion reasons
			expect(completionReasons.size).toBe(PRESET_NAMES.length);
		});
	});

	describe('Completion Marker Detection', () => {
		// Simple regex-based completion marker detection (inlined from deleted LoopCompletionService)
		const parseOutput = (output: string) => {
			const completeMatch = output.match(
				/<loop-complete>([^<]*)<\/loop-complete>/i
			);
			const blockedMatch = output.match(
				/<loop-blocked>([^<]*)<\/loop-blocked>/i
			);

			return {
				isComplete: !!completeMatch,
				isBlocked: !!blockedMatch,
				marker: completeMatch
					? { type: 'complete' as const, reason: completeMatch[1] }
					: blockedMatch
						? { type: 'blocked' as const, reason: blockedMatch[1] }
						: null
			};
		};

		it('should detect completion markers from preset content', () => {
			// Simulate agent output containing the completion marker from default preset
			const agentOutput = `
I have completed all the tasks in the backlog. There are no more pending tasks to work on.

<loop-complete>ALL_TASKS_DONE</loop-complete>
`;

			const result = parseOutput(agentOutput);
			expect(result.isComplete).toBe(true);
			expect(result.marker?.type).toBe('complete');
			expect(result.marker?.reason).toBe('ALL_TASKS_DONE');
		});

		it('should detect blocked marker from default preset', () => {
			const agentOutput = `
I cannot proceed because the API key is not configured.

<loop-blocked>MISSING_API_KEY</loop-blocked>
`;

			const result = parseOutput(agentOutput);
			expect(result.isBlocked).toBe(true);
			expect(result.marker?.type).toBe('blocked');
			expect(result.marker?.reason).toBe('MISSING_API_KEY');
		});

		it('should detect test-coverage preset completion marker', () => {
			const agentOutput = `
Coverage has reached 95% which exceeds our target of 80%.

<loop-complete>COVERAGE_TARGET</loop-complete>
`;

			const result = parseOutput(agentOutput);
			expect(result.isComplete).toBe(true);
			expect(result.marker?.reason).toBe('COVERAGE_TARGET');
		});

		it('should detect linting preset completion marker', () => {
			const agentOutput = `
All lint errors and type errors have been fixed.

<loop-complete>ZERO_ERRORS</loop-complete>
`;

			const result = parseOutput(agentOutput);
			expect(result.isComplete).toBe(true);
			expect(result.marker?.reason).toBe('ZERO_ERRORS');
		});

		it('should detect duplication preset completion marker', () => {
			const agentOutput = `
Code duplication is now at 2.5%, below the 3% threshold.

<loop-complete>LOW_DUPLICATION</loop-complete>
`;

			const result = parseOutput(agentOutput);
			expect(result.isComplete).toBe(true);
			expect(result.marker?.reason).toBe('LOW_DUPLICATION');
		});

		it('should detect entropy preset completion marker', () => {
			const agentOutput = `
No significant code smells remain in the codebase.

<loop-complete>LOW_ENTROPY</loop-complete>
`;

			const result = parseOutput(agentOutput);
			expect(result.isComplete).toBe(true);
			expect(result.marker?.reason).toBe('LOW_ENTROPY');
		});
	});

	describe('isPreset Consistency', () => {
		it('should return true for valid presets', () => {
			const validPresets = [
				'default',
				'test-coverage',
				'linting',
				'duplication',
				'entropy'
			];

			for (const name of validPresets) {
				expect(isPreset(name)).toBe(true);
			}
		});

		it('should return false for invalid presets', () => {
			const invalidPresets = [
				'invalid',
				'custom',
				'',
				'DEFAULT',
				'Test-Coverage'
			];

			for (const name of invalidPresets) {
				expect(isPreset(name)).toBe(false);
			}
		});
	});
});
