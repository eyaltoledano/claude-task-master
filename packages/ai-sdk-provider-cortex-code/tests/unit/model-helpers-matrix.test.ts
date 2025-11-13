/**
 * Feature matrix tests for ModelHelpers - runs in parallel
 */

import { describe, it, expect } from '@jest/globals';
import { ModelHelpers } from '../../src/utils/model-helpers.js';

describe('ModelHelpers Feature Matrix', () => {
	// Model capability matrix for parallel testing
	const modelCapabilityMatrix = [
		// Model ID, supports structured, supports temp (non-structured), supports temp (structured)
		['claude-sonnet-4-5', true, true, true],
		['claude-3-5-sonnet', true, true, true],
		['claude-haiku-4-5', true, true, true],
		['openai-gpt-5', true, true, false],
		['openai-gpt-4o', true, true, false],
		['gpt-5-mini', true, true, true], // Treated as non-OpenAI (no openai prefix)
		['mistral-large', false, true, true],
		['mistral-large2', false, true, true],
		['mixtral-8x7b', false, true, true],
		['llama3-70b', false, true, true],
		['llama3-8b', false, true, true],
		['cortex/claude-sonnet-4-5', true, true, true],
		['cortex/openai-gpt-5', true, true, false],
		['cortex/mistral-large', false, true, true],
		['cortex/llama3-70b', false, true, true]
	] as const;

	describe.each(modelCapabilityMatrix)(
		'Model: %s',
		(...args) => {
			const [modelId, supportsStructured, supportsTemp, supportsTempStructured] = args;
			it('should detect structured output support correctly', () => {
				expect(ModelHelpers.supportsStructuredOutputs(modelId)).toBe(
					supportsStructured
				);
			});

			it('should detect temperature support (non-structured)', () => {
				expect(ModelHelpers.supportsTemperature(modelId, false)).toBe(
					supportsTemp
				);
			});

			it('should detect temperature support (structured)', () => {
				expect(ModelHelpers.supportsTemperature(modelId, true)).toBe(
					supportsTempStructured
				);
			});
		}
	);

	// Normalization matrix for parallel testing
	const normalizationMatrix = [
		['cortex/claude-sonnet-4-5', 'claude-sonnet-4-5'],
		['CORTEX/CLAUDE-SONNET-4-5', 'cortex/claude-sonnet-4-5'], // Case-sensitive prefix
		['cortex/OpenAI-GPT-5', 'openai-gpt-5'],
		['claude-haiku-4-5', 'claude-haiku-4-5'],
		['MISTRAL-LARGE2', 'mistral-large2'],
		['Llama3-70B', 'llama3-70b'],
		['', ''],
		['cortex/', '']
	] as const;

	describe.each(normalizationMatrix)(
		'Normalize: "%s" → "%s"',
		(...args) => {
			const [input, expected] = args;
			it('should normalize correctly', () => {
				expect(ModelHelpers.normalizeModelId(input)).toBe(expected);
			});
		}
	);

	// Edge cases matrix
	const edgeCasesMatrix = [
		['null', null],
		['undefined', undefined],
		['empty', '']
	] as const;

	describe.each(edgeCasesMatrix)('Edge case: %s', (...args) => {
		const [name, value] = args;
		it('should handle supportsStructuredOutputs', () => {
			expect(ModelHelpers.supportsStructuredOutputs(value as any)).toBe(
				false
			);
		});

		it('should handle supportsTemperature', () => {
			expect(ModelHelpers.supportsTemperature(value as any)).toBe(true);
		});

		it('should handle normalizeModelId', () => {
			if (value === '') {
				expect(ModelHelpers.normalizeModelId(value)).toBe('');
			} else {
				expect(ModelHelpers.normalizeModelId(value as any)).toBe(value);
			}
		});
	});
});

