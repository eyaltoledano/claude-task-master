/**
 * Unit tests for model utilities
 * Target: 90%+ coverage for src/utils/models.ts
 */

import {
	KNOWN_MODELS,
	normalizeModelId,
	prefixModelId,
	getModelInfo,
	supportsStructuredOutputs,
	supportsTemperature,
	isValidModelId,
	getAvailableModels,
	getUnsupportedStructuredOutputsWarning,
	prepareTokenParam,
	ModelHelpers
} from '../../../src/utils/models.js';

describe('Model Utilities', () => {
	describe('KNOWN_MODELS', () => {
		it.concurrent(
			'should contain Claude models with structured output support',
			async () => {
				expect(KNOWN_MODELS['claude-haiku-4-5'].supportsStructuredOutput).toBe(
					true
				);
				expect(KNOWN_MODELS['claude-sonnet-4-5'].supportsStructuredOutput).toBe(
					true
				);
				expect(KNOWN_MODELS['claude-4-sonnet'].supportsStructuredOutput).toBe(
					true
				);
			}
		);

		it.concurrent(
			'should contain OpenAI models with structured output support',
			async () => {
				expect(KNOWN_MODELS['openai-gpt-5'].supportsStructuredOutput).toBe(
					true
				);
				expect(KNOWN_MODELS['openai-gpt-4.1'].supportsStructuredOutput).toBe(
					true
				);
			}
		);

		it.concurrent(
			'should contain Llama models without structured output support',
			async () => {
				expect(KNOWN_MODELS['llama3.1-8b'].supportsStructuredOutput).toBe(
					false
				);
				expect(KNOWN_MODELS['llama3.1-70b'].supportsStructuredOutput).toBe(
					false
				);
			}
		);

		it.concurrent(
			'should contain Mistral models without structured output support',
			async () => {
				expect(KNOWN_MODELS['mistral-7b'].supportsStructuredOutput).toBe(false);
				expect(KNOWN_MODELS['mistral-large2'].supportsStructuredOutput).toBe(
					false
				);
			}
		);
	});

	describe('normalizeModelId', () => {
		it.concurrent.each([
			['null input', null, null],
			['undefined input', undefined, undefined],
			['empty string', '', ''],
			['non-string input', 123, 123],
			[
				'cortex/ prefix removed',
				'cortex/claude-sonnet-4-5',
				'claude-sonnet-4-5'
			],
			['lowercase conversion', 'CLAUDE-HAIKU-4-5', 'claude-haiku-4-5'],
			[
				'combined prefix and case',
				'cortex/CLAUDE-SONNET-4-5',
				'claude-sonnet-4-5'
			],
			['no modification needed', 'llama3.1-8b', 'llama3.1-8b']
		])('%s: input=%s', async (_, input, expected) => {
			expect(normalizeModelId(input as any)).toBe(expected);
		});
	});

	describe('prefixModelId', () => {
		it.concurrent('should add cortex/ prefix if not present', async () => {
			expect(prefixModelId('claude-haiku-4-5')).toBe('cortex/claude-haiku-4-5');
		});

		it.concurrent('should not duplicate cortex/ prefix', async () => {
			expect(prefixModelId('cortex/claude-haiku-4-5')).toBe(
				'cortex/claude-haiku-4-5'
			);
		});

		it.concurrent(
			'should handle model IDs with special characters',
			async () => {
				expect(prefixModelId('llama3.1-8b')).toBe('cortex/llama3.1-8b');
			}
		);
	});

	describe('getModelInfo', () => {
		it.concurrent('should return info for known model', async () => {
			const info = getModelInfo('claude-haiku-4-5');
			expect(info.maxTokens).toBe(64000);
			expect(info.supportsStructuredOutput).toBe(true);
			expect(info.supportsStructuredOutputs).toBe(true); // Alias
		});

		it.concurrent('should handle cortex/ prefix', async () => {
			const info = getModelInfo('cortex/claude-sonnet-4-5');
			expect(info.maxTokens).toBe(64000);
			expect(info.supportsStructuredOutput).toBe(true);
		});

		it.concurrent('should return defaults for unknown model', async () => {
			const info = getModelInfo('unknown-model');
			expect(info.maxTokens).toBe(8192);
			expect(info.supportsStructuredOutput).toBe(false);
		});

		it.concurrent('should handle case-insensitive lookup', async () => {
			const info = getModelInfo('CLAUDE-HAIKU-4-5');
			expect(info.supportsStructuredOutput).toBe(true);
		});
	});

	describe('supportsStructuredOutputs', () => {
		it.concurrent.each([
			['null', null, false],
			['undefined', undefined, false],
			['empty string', '', false],
			['non-string', 123, false]
		])('should return false for %s', async (_, input, expected) => {
			expect(supportsStructuredOutputs(input as any)).toBe(expected);
		});

		it.concurrent.each([
			['claude-haiku-4-5', true],
			['claude-sonnet-4-5', true],
			['claude-4-sonnet', true],
			['cortex/claude-haiku-4-5', true],
			['openai-gpt-5', true],
			['openai-gpt-4.1', true],
			['gpt-4o', true],
			['cortex/openai-gpt-5', true]
		])('should return true for %s', async (modelId, expected) => {
			expect(supportsStructuredOutputs(modelId)).toBe(expected);
		});

		it.concurrent.each([
			['llama3.1-8b', false],
			['llama3.1-70b', false],
			['mistral-7b', false],
			['mistral-large2', false],
			['deepseek-r1', false]
		])('should return false for %s', async (modelId, expected) => {
			expect(supportsStructuredOutputs(modelId)).toBe(expected);
		});

		it.concurrent(
			'should use fallback for unknown Claude-like models',
			async () => {
				// Unknown model but contains 'claude'
				expect(supportsStructuredOutputs('claude-unknown-version')).toBe(true);
			}
		);

		it.concurrent(
			'should use fallback for unknown OpenAI-like models',
			async () => {
				// Unknown model but contains 'openai'
				expect(supportsStructuredOutputs('openai-unknown-version')).toBe(true);
			}
		);

		it.concurrent(
			'should use fallback for unknown GPT-like models',
			async () => {
				// Unknown model but contains 'gpt-'
				expect(supportsStructuredOutputs('gpt-unknown')).toBe(true);
			}
		);
	});

	describe('supportsTemperature', () => {
		it.concurrent.each([
			['null, no structured', null, false, true],
			['undefined, no structured', undefined, false, true],
			['empty string, no structured', '', false, true]
		])(
			'should return true for %s',
			async (_, modelId, isStructured, expected) => {
				expect(supportsTemperature(modelId as any, isStructured)).toBe(
					expected
				);
			}
		);

		it.concurrent.each([
			['claude, no structured', 'claude-haiku-4-5', false, true],
			['claude, with structured', 'claude-haiku-4-5', true, true],
			['llama, no structured', 'llama3.1-8b', false, true],
			['llama, with structured', 'llama3.1-8b', true, true],
			['mistral, no structured', 'mistral-large2', false, true]
		])(
			'should return true for %s',
			async (_, modelId, isStructured, expected) => {
				expect(supportsTemperature(modelId, isStructured)).toBe(expected);
			}
		);

		it.concurrent.each([
			['openai-gpt-5, with structured', 'openai-gpt-5', true, false],
			['openai-gpt-4.1, with structured', 'openai-gpt-4.1', true, false],
			['gpt-4o, with structured', 'gpt-4o', true, false]
		])(
			'should return false for %s',
			async (_, modelId, isStructured, expected) => {
				expect(supportsTemperature(modelId, isStructured)).toBe(expected);
			}
		);

		it.concurrent(
			'should allow temperature for OpenAI without structured output',
			async () => {
				expect(supportsTemperature('openai-gpt-5', false)).toBe(true);
			}
		);
	});

	describe('isValidModelId', () => {
		it.concurrent.each([
			['null', null, false],
			['undefined', undefined, false],
			['empty string', '', false],
			['non-string', 123, false],
			['valid model', 'claude-haiku-4-5', true],
			['with prefix', 'cortex/claude-haiku-4-5', true],
			['lowercase needed', 'CLAUDE-HAIKU', true],
			['single char', 'a', true]
		])('%s should return %s', async (_, input, expected) => {
			expect(isValidModelId(input as any)).toBe(expected);
		});
	});

	describe('getAvailableModels', () => {
		it.concurrent('should return array of model IDs', async () => {
			const models = getAvailableModels();
			expect(Array.isArray(models)).toBe(true);
			expect(models.length).toBeGreaterThan(0);
		});

		it.concurrent('should prefix all models with cortex/', async () => {
			const models = getAvailableModels();
			models.forEach((model) => {
				expect(model.startsWith('cortex/')).toBe(true);
			});
		});

		it.concurrent('should include Claude models', async () => {
			const models = getAvailableModels();
			const claudeModels = models.filter((m) => m.includes('claude'));
			expect(claudeModels.length).toBeGreaterThan(0);
		});

		it.concurrent('should include Llama models', async () => {
			const models = getAvailableModels();
			const llamaModels = models.filter((m) => m.includes('llama'));
			expect(llamaModels.length).toBeGreaterThan(0);
		});

		it.concurrent('should include OpenAI models', async () => {
			const models = getAvailableModels();
			const openaiModels = models.filter(
				(m) => m.includes('openai') || m.includes('gpt-')
			);
			expect(openaiModels.length).toBeGreaterThan(0);
		});
	});

	describe('getUnsupportedStructuredOutputsWarning', () => {
		it.concurrent('should include model ID in warning', async () => {
			const warning = getUnsupportedStructuredOutputsWarning('llama3.1-8b');
			expect(warning).toContain('llama3.1-8b');
		});

		it.concurrent('should mention structured outputs', async () => {
			const warning = getUnsupportedStructuredOutputsWarning('mistral-7b');
			expect(warning).toContain('does not support structured outputs');
		});

		it.concurrent('should suggest alternatives', async () => {
			const warning = getUnsupportedStructuredOutputsWarning('deepseek-r1');
			expect(warning).toContain('OpenAI or Claude');
		});

		it.concurrent('should mention fallback', async () => {
			const warning = getUnsupportedStructuredOutputsWarning('llama3.1-70b');
			expect(warning).toContain('JSON mode fallback');
		});
	});

	describe('prepareTokenParam', () => {
		it.concurrent(
			'should use model max tokens when not specified',
			async () => {
				const result = prepareTokenParam('claude-sonnet-4-5');
				expect(result.maxTokens).toBe(8192); // Minimum enforced
			}
		);

		it.concurrent('should enforce minimum of 8192 tokens', async () => {
			const result = prepareTokenParam('claude-haiku-4-5', 1000);
			expect(result.maxTokens).toBe(8192);
		});

		it.concurrent('should cap at model maximum', async () => {
			const result = prepareTokenParam('claude-haiku-4-5', 100000);
			expect(result.maxTokens).toBe(64000);
		});

		it.concurrent('should preserve valid token values', async () => {
			const result = prepareTokenParam('claude-haiku-4-5', 10000);
			expect(result.maxTokens).toBe(10000);
		});

		it.concurrent('should handle string token values', async () => {
			const result = prepareTokenParam('claude-haiku-4-5', '12000' as any);
			expect(result.maxTokens).toBe(12000);
		});

		it.concurrent('should handle decimal token values', async () => {
			const result = prepareTokenParam('claude-haiku-4-5', 12000.5);
			expect(result.maxTokens).toBe(12000); // Math.floor
		});

		it.concurrent('should handle NaN token values', async () => {
			const result = prepareTokenParam('claude-haiku-4-5', NaN);
			expect(result.maxTokens).toBe(8192); // Minimum
		});

		it.concurrent('should handle null/undefined token values', async () => {
			expect(prepareTokenParam('claude-haiku-4-5', null as any).maxTokens).toBe(
				8192
			);
			expect(prepareTokenParam('claude-haiku-4-5', undefined).maxTokens).toBe(
				8192
			);
		});

		it.concurrent('should handle unknown model with default max', async () => {
			const result = prepareTokenParam('unknown-model', 20000);
			expect(result.maxTokens).toBe(8192); // Default max is 8192
		});
	});

	describe('ModelHelpers class', () => {
		it.concurrent('should expose supportsStructuredOutputs', async () => {
			expect(ModelHelpers.supportsStructuredOutputs).toBe(
				supportsStructuredOutputs
			);
			expect(ModelHelpers.supportsStructuredOutputs('claude-haiku-4-5')).toBe(
				true
			);
		});

		it.concurrent('should expose supportsTemperature', async () => {
			expect(ModelHelpers.supportsTemperature).toBe(supportsTemperature);
			expect(ModelHelpers.supportsTemperature('openai-gpt-5', true)).toBe(
				false
			);
		});

		it.concurrent('should expose normalizeModelId', async () => {
			expect(ModelHelpers.normalizeModelId).toBe(normalizeModelId);
			expect(ModelHelpers.normalizeModelId('cortex/CLAUDE')).toBe('claude');
		});

		it.concurrent(
			'should expose getUnsupportedStructuredOutputsWarning',
			async () => {
				expect(ModelHelpers.getUnsupportedStructuredOutputsWarning).toBe(
					getUnsupportedStructuredOutputsWarning
				);
				const warning =
					ModelHelpers.getUnsupportedStructuredOutputsWarning('llama3.1-8b');
				expect(warning).toContain('llama3.1-8b');
			}
		);
	});
});
