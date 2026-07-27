import { jest } from '@jest/globals';

const mockCreateOpenAICompatible = jest.fn(() => jest.fn());

jest.unstable_mockModule('@ai-sdk/openai-compatible', () => ({
	__esModule: true,
	createOpenAICompatible: mockCreateOpenAICompatible
}));

jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	__esModule: true,
	log: jest.fn(),
	resolveEnvVariable: jest.fn((key) => process.env[key]),
	findProjectRoot: jest.fn(() => process.cwd()),
	isEmpty: jest.fn(() => false)
}));

jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	__esModule: true,
	isProxyEnabled: jest.fn(() => false),
	getAnonymousTelemetryEnabled: jest.fn(() => true),
	setSuppressConfigWarnings: jest.fn(),
	isConfigWarningSuppressed: jest.fn(() => false)
}));

const { AtlasCloudProvider } = await import(
	'../../../src/ai-providers/atlascloud.js'
);

describe('Atlas Cloud Provider', () => {
	let provider;

	beforeEach(() => {
		jest.clearAllMocks();
		provider = new AtlasCloudProvider();
	});

	it('should have correct base configuration', () => {
		expect(provider.name).toBe('Atlas Cloud');
		expect(provider.apiKeyEnvVar).toBe('ATLASCLOUD_API_KEY');
		expect(provider.requiresApiKey).toBe(true);
		expect(provider.defaultBaseURL).toBe('https://api.atlascloud.ai/v1');
		expect(provider.supportsStructuredOutputs).toBe(true);
	});

	it('should require ATLASCLOUD_API_KEY', () => {
		expect(provider.isRequiredApiKey()).toBe(true);
		expect(provider.getRequiredApiKeyName()).toBe('ATLASCLOUD_API_KEY');
	});

	it('should validate when API key is provided', () => {
		expect(() => provider.validateAuth({ apiKey: 'test-key' })).not.toThrow();
	});

	it('should pass the Atlas Cloud base URL to the OpenAI-compatible client', () => {
		provider.getClient({
			apiKey: 'test-key',
			modelId: 'qwen/qwen3.5-flash'
		});

		expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'atlas-cloud',
				apiKey: 'test-key',
				baseURL: 'https://api.atlascloud.ai/v1'
			})
		);
	});
});
