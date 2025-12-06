/**
 * Model Capabilities Integration Tests
 *
 * Tests for model capability detection and matrix including:
 * - Claude model capabilities
 * - OpenAI model capabilities
 * - Llama model capabilities
 * - Mistral model capabilities
 * - Structured output support
 * - Temperature support
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect } from '@jest/globals';
import { config } from 'dotenv';
import { resolve } from 'path';
import { getAvailableModels, ModelHelpers } from '../../../src/index.js';
import { describeWithCredentials } from '../../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

describeWithCredentials('Model Capabilities Integration Tests', () => {
	const allModels = getAvailableModels();

	describe('Available Models', () => {
		it.concurrent('should list available models', async () => {
			expect(Array.isArray(allModels)).toBe(true);
			expect(allModels.length).toBeGreaterThan(0);
			expect(allModels.filter((m) => m.includes('claude')).length).toBeGreaterThan(
				0
			);
		});
	});

	describe('Claude Models - Structured Output Support', () => {
		const claudeModels = allModels.filter((m) => m.includes('claude'));

		it.each(claudeModels)(
			'%s should support structured outputs',
			(modelId) => {
				const normalized = ModelHelpers.normalizeModelId(modelId);
				expect(ModelHelpers.supportsStructuredOutputs(normalized)).toBe(true);
			}
		);

		it.each(claudeModels)('%s should support temperature', (modelId) => {
			const normalized = ModelHelpers.normalizeModelId(modelId);
			expect(ModelHelpers.supportsTemperature(normalized, false)).toBe(true);
			expect(ModelHelpers.supportsTemperature(normalized, true)).toBe(true);
		});

		it('should NOT need warning for Claude models (supported)', () => {
			const supported =
				ModelHelpers.supportsStructuredOutputs('claude-haiku-4-5');
			expect(supported).toBe(true);
		});
	});

	describe('OpenAI Models - Structured Output Support', () => {
		const openaiModels = allModels.filter((m) => m.includes('openai'));

		it.each(openaiModels.length > 0 ? openaiModels : ['openai-gpt-5'])(
			'%s should support structured outputs',
			(modelId) => {
				const normalized = ModelHelpers.normalizeModelId(modelId);
				expect(ModelHelpers.supportsStructuredOutputs(normalized)).toBe(true);
			}
		);

		it.each(openaiModels.length > 0 ? openaiModels : ['openai-gpt-5'])(
			'%s should NOT support temperature with structured output',
			(modelId) => {
				const normalized = ModelHelpers.normalizeModelId(modelId);
				expect(ModelHelpers.supportsTemperature(normalized, true)).toBe(
					false
				);
			}
		);

		it('should NOT need warning for OpenAI models (supported)', () => {
			const supported = ModelHelpers.supportsStructuredOutputs('openai-gpt-5');
			expect(supported).toBe(true);
		});
	});

	describe('Llama Models - No Structured Output Support', () => {
		const llamaModels = allModels.filter((m) => m.includes('llama'));

		it.each(llamaModels.length > 0 ? llamaModels : ['llama3.1-8b'])(
			'%s should NOT support structured outputs',
			(modelId) => {
				const normalized = ModelHelpers.normalizeModelId(modelId);
				expect(ModelHelpers.supportsStructuredOutputs(normalized)).toBe(
					false
				);
			}
		);

		it('should generate warning for Llama models', () => {
			const warning =
				ModelHelpers.getUnsupportedStructuredOutputsWarning('llama3.1-8b');
			expect(warning).toContain('llama3.1-8b');
			expect(warning).toContain('does not support');
		});
	});

	describe('Mistral Models - No Structured Output Support', () => {
		const mistralModels = allModels.filter((m) => m.includes('mistral'));

		it.each(mistralModels.length > 0 ? mistralModels : ['mistral-large2'])(
			'%s should NOT support structured outputs',
			(modelId) => {
				const normalized = ModelHelpers.normalizeModelId(modelId);
				expect(ModelHelpers.supportsStructuredOutputs(normalized)).toBe(
					false
				);
			}
		);

		it('should generate warning for Mistral models', () => {
			const warning =
				ModelHelpers.getUnsupportedStructuredOutputsWarning('mistral-large2');
			expect(warning).toContain('mistral-large2');
		});
	});

	describe('Unsupported Model Warnings', () => {
		it('should suggest OpenAI or Claude in warning message', () => {
			const warning =
				ModelHelpers.getUnsupportedStructuredOutputsWarning('deepseek-v3');
			expect(warning).toContain('OpenAI or Claude');
		});

		it.concurrent(
			'getUnsupportedStructuredOutputsWarning returns warning for unsupported',
			async () => {
				const warning =
					ModelHelpers.getUnsupportedStructuredOutputsWarning('llama3.1-8b');
				expect(warning).toContain('does not support');
				expect(warning).toContain('llama3.1-8b');
			}
		);

		it.concurrent(
			'getUnsupportedStructuredOutputsWarning suggests alternatives',
			async () => {
				const warning =
					ModelHelpers.getUnsupportedStructuredOutputsWarning('mistral-large2');
				expect(warning).toContain('OpenAI or Claude');
			}
		);
	});
});

