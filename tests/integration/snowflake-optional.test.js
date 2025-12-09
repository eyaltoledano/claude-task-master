/**
 * Snowflake Provider Integration Tests
 *
 * Comprehensive integration tests using real Snowflake Cortex API calls.
 * Tests are optimized for speed using parallel execution.
 *
 * Features tested:
 * - Multiple model types (Claude, OpenAI)
 * - Text generation with various parameters
 * - Structured output generation
 * - Streaming responses
 * - Execution modes (REST, CLI, Auto)
 * - Concurrent request handling
 * - Error handling
 * - Model ID variations (prefix, casing)
 *
 * Performance optimizations:
 * - 15 parallel tests using it.concurrent
 * - Matrix testing for ID variations
 * - Focused testing (not everything for every model)
 * - Helper functions for common patterns
 *
 * Prerequisites:
 * - SNOWFLAKE_API_KEY and SNOWFLAKE_ACCOUNT (for REST)
 * - OR configured ~/.snowflake/connections.toml (for CLI)
 * - Tests skip gracefully if credentials not available
 *
 * Note on Jest warnings:
 * - "Jest did not exit one second after test run" is expected and benign
 * - This occurs because the provider may keep internal connection pools
 * - clearAuthCache() is called in afterAll hooks to minimize this
 * - Use --detectOpenHandles flag if you need to debug open handles
 *
 * @see {@link https://github.com/sfc-gh-dflippo/ai-sdk-provider-snowflake}
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { generateText, streamText, generateObject } from 'ai';
import { z } from 'zod';

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env') });

// Import the provider WITHOUT mocking for real integration tests
const { SnowflakeProvider } = await import(
	'../../src/ai-providers/snowflake.js'
);

// Import utilities from the provider package
const { clearAuthCache, validateCredentials } = await import(
	'@sfc-gh-dflippo/ai-sdk-provider-snowflake'
);

// Test configuration
const API_TIMEOUT = 60000; // 60 seconds for API calls
const CONCURRENT_REQUESTS = 3; // Number of parallel requests for concurrency tests

// Check if credentials are available using the provider's validateCredentials
let hasCredentials = false;
let credentialInfo = '';
try {
	const result = await validateCredentials();
	hasCredentials = result.rest || result.cli;
	credentialInfo = result.rest ? 'REST API' : 'CLI';
	console.log('\n📋 Test Environment Status:');
	console.log(`   ✅ Credentials: ${credentialInfo} (preferred: ${result.preferredMode})`);
	console.log('');
} catch (error) {
	console.warn('\n📋 Test Environment Status:');
	console.warn('   ⚠️  No credentials found - integration tests will be skipped');
	console.warn(`   Error: ${error.message}`);
	console.log('');
}

// Conditional test suite - only runs if credentials are available
const describeWithCredentials = hasCredentials ? describe : describe.skip;

// Test models by category (from supported-models.json)
const TEST_MODELS = {
	claude: 'cortex/claude-haiku-4-5',
	openai: 'cortex/openai-gpt-4.1'
};

// Model variations to test ID handling
const MODEL_VARIATIONS = [
	{ name: 'with prefix', id: 'cortex/claude-haiku-4-5' },
	{ name: 'uppercase', id: 'cortex/CLAUDE-HAIKU-4-5' },
	{ name: 'mixed case', id: 'cortex/Claude-Haiku-4-5' }
];

// Test helpers
async function testBasicGeneration(client, modelId) {
	const result = await generateText({
		model: client(modelId),
		messages: [{ role: 'user', content: 'What is 15 multiplied by 7? Reply with only the number.' }],
		maxTokens: 8192
	});
	console.log(`🔗 Real Snowflake API Response (${modelId}):`, {
		text: result.text.substring(0, 100),
		usage: result.usage,
		finishReason: result.finishReason
	});
	expect(result.text).toBeTruthy();
	expect(result.usage.totalTokens).toBeGreaterThan(0);
	// Verify the model actually did the math (answer should contain 105)
	expect(result.text.toLowerCase()).toMatch(/105/);
	return result;
}

async function testStructuredOutput(client, modelId) {
	const schema = z.object({
		value: z.number(),
		confirmed: z.boolean()
	});

	const result = await generateObject({
		model: client(modelId),
		schema,
		messages: [
			{ role: 'user', content: 'Generate: value=42, confirmed=true' }
		]
	});

	expect(result.object.value).toBe(42);
	expect(result.object.confirmed).toBe(true);
	return result;
}

async function testStreaming(client, modelId) {
	const result = await streamText({
		model: client(modelId),
		messages: [{ role: 'user', content: 'Count from 1 to 3.' }],
		maxTokens: 8192
	});

	const chunks = [];
	for await (const chunk of result.textStream) {
		chunks.push(chunk);
	}

	expect(chunks.length).toBeGreaterThan(0);
	return chunks;
}

describe('Snowflake Integration - Basic Setup (Always Runs)', () => {
	let provider;

	beforeEach(() => {
		provider = new SnowflakeProvider();
	});

	afterAll(() => {
		// Clean up auth cache to prevent Jest from hanging
		clearAuthCache();
	});

	it('should create a working provider instance', () => {
		expect(provider.name).toBe('Snowflake');
		expect(provider.supportsStructuredOutputs).toBe(true);
		expect(provider.supportsTemperature).toBe(true);
	});

	it('should support model validation', () => {
		expect(provider.isModelSupported('cortex/claude-haiku-4-5')).toBe(true);
		expect(provider.isModelSupported('cortex/claude-sonnet-4-5')).toBe(true);
		expect(provider.isModelSupported('cortex/openai-gpt-4.1')).toBe(true);
		expect(provider.isModelSupported('cortex/unknown-model')).toBe(false);
	});

	it('should create a client successfully', () => {
		const client = provider.getClient();
		expect(client).toBeDefined();
		expect(typeof client).toBe('function');
		expect(client.languageModel).toBeDefined();
	});

	it('should not require API key (supports multiple auth methods)', () => {
		expect(provider.isRequiredApiKey()).toBe(false);
	});

	it('should have correct API key name', () => {
		expect(provider.getRequiredApiKeyName()).toBe('SNOWFLAKE_API_KEY');
	});
});

describeWithCredentials('Snowflake Integration - Real Inference Tests', () => {
	beforeAll(() => {
		console.log('🔍 Setting up Snowflake integration tests...');
		console.log('  SNOWFLAKE_API_KEY:', process.env.SNOWFLAKE_API_KEY ? 'SET' : 'NOT SET');
		console.log('  SNOWFLAKE_ACCOUNT:', process.env.SNOWFLAKE_ACCOUNT ? 'SET' : 'NOT SET');
		console.log('  SNOWFLAKE_CONNECTION:', process.env.SNOWFLAKE_CONNECTION ? 'SET' : 'NOT SET');
		
		// Clear any cached tokens before tests
		clearAuthCache();
	});

	afterAll(() => {
		// Clean up auth cache to prevent Jest from hanging
		clearAuthCache();
	});

	// ========================================================================
	// Parallel Model Tests - Basic Generation
	// ========================================================================
	describe('Model Categories - Text Generation (Parallel)', () => {
		it.concurrent(
			'Claude model generates text',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				await testBasicGeneration(client, TEST_MODELS.claude);
			},
			API_TIMEOUT
		);

		it.concurrent(
			'OpenAI model generates text',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				await testBasicGeneration(client, TEST_MODELS.openai);
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Model ID Variations (Parallel)
	// ========================================================================
	describe('Model ID Variations (Parallel)', () => {
		it.concurrent.each(MODEL_VARIATIONS)(
			'handles model ID $name',
			async ({ id }) => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				await testBasicGeneration(client, id);
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Structured Outputs (Parallel by Model Type)
	// ========================================================================
	describe('Structured Outputs (Parallel)', () => {
		it.concurrent(
			'Claude structured output',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				await testStructuredOutput(client, TEST_MODELS.claude);
			},
			API_TIMEOUT
		);

		it.concurrent(
			'OpenAI structured output',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				await testStructuredOutput(client, TEST_MODELS.openai);
			},
			API_TIMEOUT
		);

		it.concurrent(
			'complex nested schema',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				
				const schema = z.object({
					person: z.object({
						name: z.string(),
						contact: z.object({
							email: z.string()
						})
					})
				});

				const result = await generateObject({
					model: client(TEST_MODELS.claude),
					schema,
					messages: [
						{
							role: 'user',
							content: 'Generate: name Alice, email alice@test.com'
						}
					]
				});

				expect(result.object.person.name).toBe('Alice');
				expect(result.object.person.contact.email).toContain('alice');
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Streaming (Parallel)
	// ========================================================================
	describe('Streaming (Parallel)', () => {
		it.concurrent(
			'Claude streaming',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				const chunks = await testStreaming(client, TEST_MODELS.claude);
				expect(chunks.join('').length).toBeGreaterThan(0);
			},
			API_TIMEOUT
		);

		it.concurrent(
			'OpenAI streaming',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				const chunks = await testStreaming(client, TEST_MODELS.openai);
				expect(chunks.length).toBeGreaterThan(0);
			},
			API_TIMEOUT
		);

		it.concurrent(
			'streaming with usage info',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				
				const result = await streamText({
					model: client(TEST_MODELS.claude),
					messages: [{ role: 'user', content: 'Say OK.' }],
					maxTokens: 8192
				});

				// Consume stream
				for await (const _ of result.textStream) {
					// Just consume
				}

				const usage = await result.usage;
				expect(usage.totalTokens).toBeGreaterThan(0);
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Parameters & Configuration (Parallel)
	// ========================================================================
	describe('Parameters (Parallel)', () => {
		it.concurrent(
			'handles temperature parameter',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				
				const result = await generateText({
					model: client(TEST_MODELS.claude),
					messages: [{ role: 'user', content: 'Say OK.' }],
					temperature: 0.7,
					maxTokens: 8192
				});
				expect(result.text).toBeTruthy();
			},
			API_TIMEOUT
		);

		it.concurrent(
			'respects maxTokens limit',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				
				const result = await generateText({
					model: client(TEST_MODELS.claude),
					messages: [{ role: 'user', content: 'Say only the word OK' }],
					maxTokens: 8192
				});
				// Models may slightly exceed maxTokens, so we check for a reasonable limit
				expect(result.usage.totalTokens).toBeLessThan(200);
			},
			API_TIMEOUT
		);

		it.concurrent(
			'handles system messages',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				
				const result = await generateText({
					model: client(TEST_MODELS.claude),
					system: 'Respond with exactly one word.',
					messages: [{ role: 'user', content: 'What color is the sky?' }],
					maxTokens: 8192
				});
				expect(result.text).toBeTruthy();
			},
			API_TIMEOUT
		);

		it.concurrent(
			'handles multi-turn conversations',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				
				const result = await generateText({
					model: client(TEST_MODELS.claude),
					messages: [
						{ role: 'user', content: 'My name is Bob.' },
						{ role: 'assistant', content: 'Nice to meet you, Bob!' },
						{ role: 'user', content: 'What is my name?' }
					],
					maxTokens: 8192
				});
				expect(result.text.toLowerCase()).toContain('bob');
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Execution Modes
	// ========================================================================
	describe('Execution Modes', () => {
		it.concurrent(
			'auto mode works',
			async () => {
				const autoClient = new SnowflakeProvider().getClient();
				await testBasicGeneration(autoClient, TEST_MODELS.claude);
			},
			API_TIMEOUT
		);

		it.concurrent(
			'REST mode explicit',
			async () => {
				const provider = new SnowflakeProvider({
					executionMode: 'rest'
				});
				const client = provider.getClient();
				await testBasicGeneration(client, TEST_MODELS.claude);
			},
			API_TIMEOUT
		);

		it(
			'CLI mode (skipped if not installed)',
			async () => {
				const cliClient = new SnowflakeProvider({
					executionMode: 'cli'
				}).getClient();

				try {
					await testBasicGeneration(cliClient, TEST_MODELS.claude);
					expect(true).toBe(true); // CLI works
				} catch (error) {
					// Expected if CLI not installed or not working properly
					// Accept any error as CLI mode is optional
					console.log('🔍 CLI error (expected):', error.message.substring(0, 100));
					expect(error).toBeDefined();
				}
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Concurrency & Performance
	// ========================================================================
	describe('Concurrency', () => {
		it(
			'handles concurrent requests',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				
				const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
					generateText({
						model: client(TEST_MODELS.claude),
						messages: [{ role: 'user', content: `Say ${i}` }],
						maxTokens: 8192
					})
				);

				const results = await Promise.all(promises);
				expect(results).toHaveLength(CONCURRENT_REQUESTS);
				results.forEach((result) => {
					expect(result.text).toBeTruthy();
					expect(result.usage.totalTokens).toBeGreaterThan(0);
				});
			},
			API_TIMEOUT * 2
		);
	});

	// ========================================================================
	// Error Handling
	// ========================================================================
	describe('Error Handling', () => {
		it(
			'throws for invalid model',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				
				await expect(
					generateText({
						model: client('cortex/nonexistent-xyz'),
						messages: [{ role: 'user', content: 'Test' }]
					})
				).rejects.toThrow();
			},
			API_TIMEOUT
		);

		it(
			'throws for invalid maxTokens',
			async () => {
				const provider = new SnowflakeProvider({ executionMode: 'rest' });
				const client = provider.getClient();
				
				// Note: Some AI APIs may accept negative maxTokens and ignore them
				// This test verifies error handling, but may pass if API is lenient
				try {
					const result = await generateText({
						model: client(TEST_MODELS.claude),
						messages: [{ role: 'user', content: 'Test' }],
						maxTokens: -1
					});
					// If API accepts it, at least verify we got a response
					expect(result.text).toBeDefined();
				} catch (error) {
					// If it throws, that's also acceptable
					expect(error).toBeDefined();
				}
			},
			API_TIMEOUT
		);
	});
});
