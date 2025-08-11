/**
 * @fileoverview Integration test for models.dev integration
 * 
 * Tests the complete flow from models.dev API to merged model list
 */

import { jest } from '@jest/globals';
import { modelsDevService } from '../../src/services/models-dev-service.js';
import { modelMerger } from '../../src/services/model-merger.js';
import { getAllAvailableModels } from '../../scripts/modules/config-manager.js';

// Skip tests if no internet connection or API is down
const isOnline = process.env.NODE_ENV !== 'test' || process.env.TEST_MODELS_DEV === 'true';

describe('Models.dev Integration', () => {
	// Only run these tests if explicitly enabled or not in CI
	const runTest = isOnline ? test : test.skip;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	runTest('should fetch models from models.dev API', async () => {
		const models = await modelsDevService.fetchModels();
		
		expect(models).toBeDefined();
		expect(typeof models).toBe('object');
		expect(Object.keys(models).length).toBeGreaterThan(0);
		
		// Check that we have expected providers
		const providers = Object.keys(models);
		expect(providers).toEqual(expect.arrayContaining(['openai', 'anthropic']));
	}, 30000);

	runTest('should get provider models in correct format', async () => {
		const openaiModels = await modelsDevService.getProviderModels('openai');
		
		expect(Array.isArray(openaiModels)).toBe(true);
		expect(openaiModels.length).toBeGreaterThan(0);
		
		const firstModel = openaiModels[0];
		expect(firstModel).toMatchObject({
			id: expect.any(String),
			name: expect.any(String),
			provider: 'openai',
			source: 'models.dev',
			allowed_roles: expect.any(Array)
		});
	}, 30000);

	runTest('should merge static and dynamic models', async () => {
		const staticModels = [
			{
				id: 'test-static',
				name: 'Test Static Model',
				provider: 'test',
				swe_score: null,
				cost_per_1m_tokens: null,
				allowed_roles: ['fallback'],
				source: 'static'
			}
		];

		const dynamicModels = await modelsDevService.searchModels({ providers: ['openai'] });
		
		const merged = modelMerger.mergeStaticAndDynamic(staticModels, dynamicModels);
		
		expect(merged.length).toBeGreaterThan(staticModels.length);
		
		// Should contain static model
		const staticModel = merged.find(m => m.id === 'test-static');
		expect(staticModel).toBeDefined();
		expect(staticModel.source).toBe('static');
		
		// Should contain dynamic models
		const dynamicModel = merged.find(m => m.source === 'models.dev');
		expect(dynamicModel).toBeDefined();
	}, 30000);

	runTest('should handle dynamic model loading', async () => {
		const enhanced = await getAllAvailableModels();
		
		expect(Array.isArray(enhanced)).toBe(true);
		expect(enhanced.length).toBeGreaterThan(0);
		
		// Should have models from both sources
		const sources = [...new Set(enhanced.map(m => m.source))];
		expect(sources).toEqual(expect.arrayContaining(['static']));
		// May also contain 'models.dev' if API is available
	}, 30000);

	test('should fallback gracefully when API fails', async () => {
		// Mock API failure
		const originalFetch = global.fetch;
		global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

		try {
			const enhanced = await getAllAvailableModels();
			
			// Should still return models (may be cached or static)
			expect(Array.isArray(enhanced)).toBe(true);
			expect(enhanced.length).toBeGreaterThan(0);
			
			// All models should have a source property
			expect(enhanced.every(m => m.source)).toBe(true);
		} finally {
			global.fetch = originalFetch;
		}
	});

	test('should deduplicate models correctly', () => {
		const models = [
			{
				id: 'gpt-4',
				provider: 'openai',
				source: 'static',
				name: 'GPT-4 Static'
			},
			{
				id: 'gpt-4',
				provider: 'openai',
				source: 'models.dev',
				name: 'GPT-4 Dynamic',
				reasoning: true
			},
			{
				id: 'unique-model',
				provider: 'test',
				source: 'static'
			}
		];

		const deduplicated = modelMerger.deduplicateModels(models);

		expect(deduplicated).toHaveLength(2);

		// Should prefer models.dev version
		const gpt4 = deduplicated.find(m => m.id === 'gpt-4');
		expect(gpt4.source).toBe('models.dev');
		expect(gpt4.name).toBe('GPT-4 Dynamic');
		expect(gpt4.reasoning).toBe(true);

		// Should keep unique models
		const unique = deduplicated.find(m => m.id === 'unique-model');
		expect(unique).toBeDefined();
	});

	test('should normalize model formats correctly', () => {
		const staticModel = {
			id: 'test-model',
			provider: 'test',
			swe_score: 0.8,
			cost_per_1m_tokens: { input: 1.0, output: 2.0 },
			allowed_roles: ['main']
		};

		const dynamicModel = {
			id: 'test-model',
			provider: 'test',
			cost_per_1m_tokens: { input: 1.5, output: 2.5 },
			reasoning: true,
			tool_call: true,
			context_length: 8000
		};

		const normalizedStatic = modelMerger.normalizeModelFormat(staticModel, 'static');
		const normalizedDynamic = modelMerger.normalizeModelFormat(dynamicModel, 'models.dev');

		expect(normalizedStatic).toMatchObject({
			id: 'test-model',
			source: 'static',
			reasoning: false,
			tool_call: false
		});

		expect(normalizedDynamic).toMatchObject({
			id: 'test-model',
			source: 'models.dev',
			reasoning: true,
			tool_call: true,
			context_length: 8000
		});
	});
});