import { jest } from '@jest/globals';

// Mock the OpenAI-compatible creation
const mockCreateOpenAICompatible = jest.fn(() => jest.fn());

jest.unstable_mockModule('@ai-sdk/openai-compatible', () => ({
	createOpenAICompatible: mockCreateOpenAICompatible
}));

// Mock utils
jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	resolveEnvVariable: jest.fn((key) => process.env[key]),
	findProjectRoot: jest.fn(() => process.cwd()),
	isEmpty: jest.fn(() => false)
}));

jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	isProxyEnabled: jest.fn(() => false)
}));

// Import after mocking
const { ZAIProvider } = await import('../../../src/ai-providers/zai.js');
const { ZAICodingProvider } = await import(
	'../../../src/ai-providers/zai-coding.js'
);

describe('ZAI Provider', () => {
	let provider;

	beforeEach(() => {
		jest.clearAllMocks();
		provider = new ZAIProvider();
	});

	describe('Configuration', () => {
		it('should have correct base configuration', () => {
			expect(provider.name).toBe('Z.ai');
			expect(provider.apiKeyEnvVar).toBe('ZAI_API_KEY');
			expect(provider.requiresApiKey).toBe(true);
			expect(provider.defaultBaseURL).toBe('https://api.z.ai/api/paas/v4/');
			expect(provider.supportsStructuredOutputs).toBe(true);
		});
	});

	describe('Token Parameter Handling', () => {
		it('should not include max_tokens in requests', () => {
			// ZAI API rejects max_tokens parameter (error code 1210)
			const result = provider.prepareTokenParam('glm-4.6', 2000);

			// Should return empty object instead of { maxOutputTokens: 2000 }
			expect(result).toEqual({});
		});

		it('should return empty object even with undefined maxTokens', () => {
			const result = provider.prepareTokenParam('glm-4.6', undefined);
			expect(result).toEqual({});
		});

		it('should return empty object even with very large maxTokens', () => {
			// ZAI may have lower limits than other providers
			const result = provider.prepareTokenParam('glm-4.6', 204800);
			expect(result).toEqual({});
		});
	});

	describe('API Key Handling', () => {
		it('should require API key', () => {
			expect(provider.isRequiredApiKey()).toBe(true);
			expect(provider.getRequiredApiKeyName()).toBe('ZAI_API_KEY');
		});

		it('should validate when API key is missing', () => {
			expect(() => provider.validateAuth({})).toThrow(
				'Z.ai API key is required'
			);
		});

		it('should pass validation when API key is provided', () => {
			expect(() => provider.validateAuth({ apiKey: 'test-key' })).not.toThrow();
		});
	});
});

describe('ZAI Coding Provider', () => {
	let provider;

	beforeEach(() => {
		jest.clearAllMocks();
		provider = new ZAICodingProvider();
	});

	describe('Configuration', () => {
		it('should have correct base configuration', () => {
			expect(provider.name).toBe('Z.ai (Coding Plan)');
			expect(provider.apiKeyEnvVar).toBe('ZAI_API_KEY');
			expect(provider.requiresApiKey).toBe(true);
			expect(provider.defaultBaseURL).toBe(
				'https://api.z.ai/api/coding/paas/v4/'
			);
			expect(provider.supportsStructuredOutputs).toBe(true);
		});
	});

	describe('Token Parameter Handling', () => {
		it('should not include max_tokens in requests', () => {
			// ZAI Coding API also rejects max_tokens parameter
			const result = provider.prepareTokenParam('glm-4.6', 2000);

			// Should return empty object instead of { maxOutputTokens: 2000 }
			expect(result).toEqual({});
		});

		it('should return empty object even with undefined maxTokens', () => {
			const result = provider.prepareTokenParam('glm-4.6', undefined);
			expect(result).toEqual({});
		});
	});
});
