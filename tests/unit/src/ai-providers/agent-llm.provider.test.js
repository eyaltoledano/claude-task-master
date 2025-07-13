import { AgentLLMProvider } from '../../../../src/ai-providers/agent-llm.js';
// No need to mock uuid here, we want to test that it generates a string ID.

describe('AgentLLMProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new AgentLLMProvider();
	});

	test('constructor sets the provider name correctly', () => {
		expect(provider.name).toBe('AgentLLM');
	});

	test('validateAuth should always return true', () => {
		expect(provider.validateAuth({})).toBe(true);
		expect(provider.validateAuth({ apiKey: 'anything' })).toBe(true);
	});

	test('getClient should return the provider instance itself', () => {
		expect(provider.getClient({})).toBe(provider);
	});

		test('isRequiredApiKey should return false', () => {
		expect(provider.isRequiredApiKey()).toBe(false);
	});

	test('getRequiredApiKeyName should return null', () => {
		expect(provider.getRequiredApiKeyName()).toBeNull();
	});

	describe('generateText', () => {
		test('should return agent_llm_delegation with interactionId and details', async () => {
			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'hello' }],
				maxTokens: 100,
				temperature: 0.7,
				baseURL: 'http://localhost:8080' // Example other param
			};
			const result = await provider.generateText(params);

			expect(result.type).toBe('agent_llm_delegation');
			expect(result.interactionId).toEqual(expect.any(String));
			expect(result.interactionId.length).toBeGreaterThan(0); // UUIDs are not empty

			const expectedDetails = {
				apiKey: null, // As set by the provider
				modelId: params.modelId,
				messages: params.messages,
				maxTokens: params.maxTokens,
				temperature: params.temperature,
				baseURL: params.baseURL
			};
			expect(result.details).toEqual(expectedDetails);
		});
	});

	describe('streamText', () => {
		test('should return agent_llm_delegation with interactionId and details', async () => {
			const params = {
				modelId: 'test-model-stream',
				messages: [{ role: 'user', content: 'hello stream' }]
			};
			const result = await provider.streamText(params);

			expect(result.type).toBe('agent_llm_delegation');
			expect(result.interactionId).toEqual(expect.any(String));
			expect(result.interactionId.length).toBeGreaterThan(0);

			const expectedDetails = {
				apiKey: null,
				modelId: params.modelId,
				messages: params.messages,
				maxTokens: undefined, // Assuming these are not set if not in params
				temperature: undefined,
				baseURL: undefined
			};
			expect(result.details).toEqual(expectedDetails);
		});
	});

	describe('generateObject', () => {
		test('should return agent_llm_delegation with interactionId and details including schema and objectName', async () => {
			const params = {
				modelId: 'test-model-object',
				messages: [{ role: 'user', content: 'generate obj' }],
				schema: { type: 'object', properties: { key: { type: 'string' } } },
				objectName: 'TestObj'
			};
			const result = await provider.generateObject(params);

			expect(result.type).toBe('agent_llm_delegation');
			expect(result.interactionId).toEqual(expect.any(String));
			expect(result.interactionId.length).toBeGreaterThan(0);

			const expectedDetails = {
				apiKey: null,
				modelId: params.modelId,
				messages: params.messages,
				maxTokens: undefined,
				temperature: undefined,
				schema: params.schema,
				objectName: params.objectName,
				baseURL: undefined
			};
			expect(result.details).toEqual(expectedDetails);
			expect(result.details.schema).toBeDefined();
			expect(result.details.objectName).toBeDefined();
		});
	});
});
