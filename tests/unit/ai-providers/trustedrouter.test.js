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
	isProxyEnabled: jest.fn(() => false),
	getAnonymousTelemetryEnabled: jest.fn(() => true),
	setSuppressConfigWarnings: jest.fn(),
	isConfigWarningSuppressed: jest.fn(() => false)
}));

// Import after mocking
const { TrustedRouterProvider } = await import(
	'../../../src/ai-providers/trustedrouter.js'
);

describe('TrustedRouter Provider', () => {
	let provider;

	beforeEach(() => {
		jest.clearAllMocks();
		provider = new TrustedRouterProvider();
	});

	describe('Configuration', () => {
		it('should have correct base configuration', () => {
			expect(provider.name).toBe('TrustedRouter');
			expect(provider.apiKeyEnvVar).toBe('TRUSTEDROUTER_API_KEY');
			expect(provider.requiresApiKey).toBe(true);
			expect(provider.defaultBaseURL).toBe('https://api.trustedrouter.com/v1');
			expect(provider.supportsStructuredOutputs).toBe(true);
		});
	});

	describe('API Key Handling', () => {
		it('should require API key', () => {
			expect(provider.isRequiredApiKey()).toBe(true);
			expect(provider.getRequiredApiKeyName()).toBe('TRUSTEDROUTER_API_KEY');
		});

		it('should validate when API key is missing', () => {
			expect(() => provider.validateAuth({})).toThrow(
				'TrustedRouter API key is required'
			);
		});
	});

	describe('Client creation', () => {
		it('should pass the base URL through to the client', () => {
			provider.getClient({ apiKey: 'sk-tr-test' });
			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: 'https://api.trustedrouter.com/v1'
				})
			);
		});
	});
});
