/**
 * Model Utilities Unit Tests
 *
 * Tests for ModelHelpers utility functions including:
 * - Model ID normalization
 * - Structured output support detection
 * - Temperature support detection
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect } from '@jest/globals';
import { config } from 'dotenv';
import { resolve } from 'path';
import { ModelHelpers } from '../../../src/index.js';
import { describeWithCredentials } from '../../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

describeWithCredentials('Model Utilities Unit Tests', () => {
	describe('Model ID Normalization', () => {
		// Use it.concurrent.each for parallel execution of all normalizeModelId tests
		const normalizeModelIdCases: Array<[string, string | null | undefined, string]> = [
			['null input', null, ''],
			['undefined input', undefined, ''],
			['empty string', '', ''],
			['cortex/ prefix', 'cortex/claude-sonnet-4-5', 'claude-sonnet-4-5'],
			['no prefix', 'llama3-70b', 'llama3-70b'],
			['uppercase', 'CLAUDE-HAIKU-4-5', 'claude-haiku-4-5'],
			['mixed case with prefix', 'cortex/CLAUDE-SONNET-4-5', 'claude-sonnet-4-5']
		];

		it.concurrent.each(normalizeModelIdCases)('normalizeModelId: %s', async (_label, input, expected) => {
			expect(ModelHelpers.normalizeModelId(input as any)).toBe(expected);
		});

		it.concurrent('should normalize model IDs correctly', async () => {
			expect(ModelHelpers.normalizeModelId('cortex/claude-sonnet-4-5')).toBe(
				'claude-sonnet-4-5'
			);
			expect(ModelHelpers.normalizeModelId('cortex/CLAUDE-HAIKU-4-5')).toBe(
				'claude-haiku-4-5'
			);
			expect(ModelHelpers.normalizeModelId('CLAUDE-4-SONNET')).toBe(
				'claude-4-sonnet'
			);
		});
	});

	describe('Structured Output Support Detection', () => {
		// Use it.concurrent.each for parallel execution of supportsStructuredOutputs tests
		const supportsStructuredOutputsCases: Array<[string, string | null | undefined, boolean]> = [
			['null', null, false],
			['undefined', undefined, false],
			['empty string', '', false],
			['claude-haiku-4-5', 'claude-haiku-4-5', true],
			['claude-sonnet-4-5', 'claude-sonnet-4-5', true],
			['openai-gpt-5', 'openai-gpt-5', true],
			['llama3.1-8b', 'llama3.1-8b', false],
			['llama3.1-70b', 'llama3.1-70b', false],
			['mistral-large2', 'mistral-large2', false]
		];

		it.concurrent.each(supportsStructuredOutputsCases)(
			'supportsStructuredOutputs: %s -> %s',
			async (_label, input, expected) => {
				expect(ModelHelpers.supportsStructuredOutputs(input as any)).toBe(
					expected
				);
			}
		);

		it.concurrent('should detect structured output support', async () => {
			expect(
				ModelHelpers.supportsStructuredOutputs('cortex/claude-haiku-4-5')
			).toBe(true);
			expect(ModelHelpers.supportsStructuredOutputs('claude-sonnet-4-5')).toBe(
				true
			);
			expect(ModelHelpers.supportsStructuredOutputs('openai-gpt-5')).toBe(true);
			expect(ModelHelpers.supportsStructuredOutputs('llama3.1-8b')).toBe(false);
			expect(ModelHelpers.supportsStructuredOutputs('mistral-large2')).toBe(
				false
			);
		});
	});

	describe('Temperature Support Detection', () => {
		// Use it.concurrent.each for parallel execution of supportsTemperature tests
		const supportsTemperatureCases: Array<[string, string, boolean, boolean]> = [
			['empty string, no structured', '', false, true],
			['claude, no structured', 'claude-haiku-4-5', false, true],
			['claude, with structured', 'claude-haiku-4-5', true, true],
			['openai, no structured', 'openai-gpt-5', false, true],
			['openai, with structured', 'openai-gpt-5', true, false],
			['llama, no structured', 'llama3.1-8b', false, true],
			['llama, with structured', 'llama3.1-8b', true, true]
		];

		it.concurrent.each(supportsTemperatureCases)(
			'supportsTemperature: %s -> %s',
			async (_label, model, structured, expected) => {
				expect(ModelHelpers.supportsTemperature(model, structured)).toBe(
					expected
				);
			}
		);

		it.concurrent('should detect temperature support', async () => {
			expect(ModelHelpers.supportsTemperature('claude-haiku-4-5', false)).toBe(
				true
			);
			expect(ModelHelpers.supportsTemperature('claude-haiku-4-5', true)).toBe(
				true
			);
			expect(ModelHelpers.supportsTemperature('openai-gpt-5', false)).toBe(
				true
			);
			expect(ModelHelpers.supportsTemperature('openai-gpt-5', true)).toBe(
				false
			);
		});
	});

	// Note: Token parameter handling is tested in tests/unit/schema/transformer.test.ts
	// via normalizeTokenParams function which is the actual implementation
});

