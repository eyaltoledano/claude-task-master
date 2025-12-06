import { jest } from '@jest/globals';

// Mock AI SDK functions at the top level
const generateText = jest.fn();
const streamText = jest.fn();
const generateObject = jest.fn();

jest.unstable_mockModule('ai', () => ({
	generateObject,
	generateText,
	streamText,
	streamObject: jest.fn(),
	zodSchema: jest.fn(),
	JSONParseError: class JSONParseError extends Error {},
	NoObjectGeneratedError: class NoObjectGeneratedError extends Error {}
}));

// Mock successful provider creation for all tests
const mockProvider = jest.fn((modelId) => ({
	id: modelId,
	doGenerate: jest.fn(),
	doStream: jest.fn()
}));
mockProvider.languageModel = jest.fn((id, settings) => ({ id, settings }));
mockProvider.chat = mockProvider.languageModel;

const mockValidateCredentials = jest.fn(() =>
	Promise.resolve({ rest: true, cli: false, preferredMode: 'rest' })
);

jest.unstable_mockModule('@tm/ai-sdk-provider-snowflake', () => ({
	createSnowflake: jest.fn(() => mockProvider),
	validateCredentials: mockValidateCredentials,
	normalizeModelId: jest.fn((id) =>
		id ? id.replace(/^cortex\//, '').toLowerCase() : ''
	)
}));

// Mock utils
jest.unstable_mockModule('../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	resolveEnvVariable: jest.fn((key) => process.env[key]),
	findProjectRoot: jest.fn(() => process.cwd()),
	isEmpty: jest.fn(() => false)
}));

// Mock config manager
jest.unstable_mockModule('../../scripts/modules/config-manager.js', () => ({
	getSupportedModelsForProvider: jest.fn(() => [
		{ id: 'cortex/claude-haiku-4-5', name: 'Claude Haiku 4.5' },
		{ id: 'cortex/claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
		{ id: 'cortex/llama3.1-8b', name: 'Llama 3.1 8B' },
		{ id: 'cortex/mistral-large2', name: 'Mistral Large 2' }
	]),
	getDebugFlag: jest.fn(() => false),
	getLogLevel: jest.fn(() => 'info'),
	isProxyEnabled: jest.fn(() => false),
	getAnonymousTelemetryEnabled: jest.fn(() => true)
}));

// Import the provider after mocking
const { SnowflakeProvider } = await import(
	'../../src/ai-providers/snowflake.js'
);

describe('Snowflake Integration (Optional)', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should create a working provider instance', () => {
		const provider = new SnowflakeProvider();
		expect(provider.name).toBe('Snowflake');
		expect(provider.getSupportedModels()).toEqual([
			'cortex/claude-haiku-4-5',
			'cortex/claude-sonnet-4-5',
			'cortex/llama3.1-8b',
			'cortex/mistral-large2'
		]);
	});

	it('should support model validation', () => {
		const provider = new SnowflakeProvider();
		expect(provider.isModelSupported('cortex/claude-haiku-4-5')).toBe(true);
		expect(provider.isModelSupported('cortex/claude-sonnet-4-5')).toBe(true);
		expect(provider.isModelSupported('cortex/llama3.1-8b')).toBe(true);
		expect(provider.isModelSupported('cortex/unknown-model')).toBe(false);
	});

	it('should create a client successfully', () => {
		const provider = new SnowflakeProvider();
		const client = provider.getClient();

		expect(client).toBeDefined();
		expect(typeof client).toBe('function');
		expect(client.languageModel).toBeDefined();
		expect(client.chat).toBeDefined();
		expect(client.chat).toBe(client.languageModel);
	});

	it('should pass execution mode settings to client', async () => {
		const provider = new SnowflakeProvider();
		const client = provider.getClient({ executionMode: 'rest' });

		expect(client).toBeDefined();
		expect(typeof client).toBe('function');
		const { createSnowflake } = await import('@tm/ai-sdk-provider-snowflake');
		expect(createSnowflake).toHaveBeenCalledWith(
			expect.objectContaining({ executionMode: 'rest' })
		);
	});

	it('should handle AI SDK generateText integration', async () => {
		const provider = new SnowflakeProvider();
		const client = provider.getClient();

		// Mock successful generation
		generateText.mockResolvedValueOnce({
			text: 'Hello from Snowflake Cortex!',
			usage: { totalTokens: 10 }
		});

		const result = await generateText({
			model: client('cortex/claude-haiku-4-5'),
			messages: [{ role: 'user', content: 'Hello' }]
		});

		expect(result.text).toBe('Hello from Snowflake Cortex!');
		expect(generateText).toHaveBeenCalledWith({
			model: expect.any(Object),
			messages: [{ role: 'user', content: 'Hello' }]
		});
	});

	it('should handle AI SDK streamText integration', async () => {
		const provider = new SnowflakeProvider();
		const client = provider.getClient();

		// Mock successful streaming
		const mockStream = {
			textStream: (async function* () {
				yield 'Streamed response from Cortex';
			})()
		};
		streamText.mockResolvedValueOnce(mockStream);

		const streamResult = await streamText({
			model: client('cortex/claude-haiku-4-5'),
			messages: [{ role: 'user', content: 'Stream test' }]
		});

		expect(streamResult.textStream).toBeDefined();
		expect(streamText).toHaveBeenCalledWith({
			model: expect.any(Object),
			messages: [{ role: 'user', content: 'Stream test' }]
		});
	});

	it('should handle AI SDK generateObject integration', async () => {
		const provider = new SnowflakeProvider();
		const client = provider.getClient();

		// Mock successful structured output
		generateObject.mockResolvedValueOnce({
			object: { name: 'Test', count: 42 },
			usage: { totalTokens: 15 }
		});

		const result = await generateObject({
			model: client('cortex/claude-haiku-4-5'),
			messages: [{ role: 'user', content: 'Generate a test object' }],
			schema: { type: 'object', properties: { name: {}, count: {} } }
		});

		expect(result.object).toEqual({ name: 'Test', count: 42 });
		expect(generateObject).toHaveBeenCalledWith({
			model: expect.any(Object),
			messages: [{ role: 'user', content: 'Generate a test object' }],
			schema: expect.any(Object)
		});
	});

	it('should not require API key (supports multiple auth methods)', () => {
		const provider = new SnowflakeProvider();
		expect(provider.isRequiredApiKey()).toBe(false);
	});

	it('should validate auth with validateCredentials', async () => {
		const provider = new SnowflakeProvider();

		// Should not throw - validateCredentials is mocked to succeed
		await expect(provider.validateAuth({})).resolves.not.toThrow();
		expect(mockValidateCredentials).toHaveBeenCalled();
	});

	it('should support temperature setting', () => {
		const provider = new SnowflakeProvider();
		expect(provider.supportsTemperature).toBe(true);
	});

	it('should support structured outputs', () => {
		const provider = new SnowflakeProvider();
		expect(provider.supportsStructuredOutputs).toBe(true);
	});
});

describe('Snowflake Provider Execution Modes', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should default to auto execution mode', async () => {
		const provider = new SnowflakeProvider();
		provider.getClient({});

		const { createSnowflake } = await import('@tm/ai-sdk-provider-snowflake');
		expect(createSnowflake).toHaveBeenCalledWith(
			expect.objectContaining({ executionMode: 'auto' })
		);
	});

	it('should respect REST execution mode', async () => {
		const provider = new SnowflakeProvider({ executionMode: 'rest' });
		provider.getClient({});

		const { createSnowflake } = await import('@tm/ai-sdk-provider-snowflake');
		expect(createSnowflake).toHaveBeenCalledWith(
			expect.objectContaining({ executionMode: 'rest' })
		);
	});

	it('should respect CLI execution mode', async () => {
		const provider = new SnowflakeProvider({ executionMode: 'cli' });
		provider.getClient({});

		const { createSnowflake } = await import('@tm/ai-sdk-provider-snowflake');
		expect(createSnowflake).toHaveBeenCalledWith(
			expect.objectContaining({ executionMode: 'cli' })
		);
	});

	it('should allow runtime override of execution mode', async () => {
		const provider = new SnowflakeProvider({ executionMode: 'rest' });
		provider.getClient({ executionMode: 'cli' });

		const { createSnowflake } = await import('@tm/ai-sdk-provider-snowflake');
		expect(createSnowflake).toHaveBeenCalledWith(
			expect.objectContaining({ executionMode: 'cli' })
		);
	});
});
