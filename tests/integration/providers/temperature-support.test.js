/**
 * Integration Tests for Provider Temperature Support
 *
 * This test suite verifies that all providers correctly declare their
 * temperature support capabilities. CLI providers should have
 * supportsTemperature = false, while standard API providers should
 * have supportsTemperature = true.
 *
 * These tests are separated from unit tests to avoid coupling
 * base provider tests with concrete provider implementations.
 */

describe('Provider Temperature Support', () => {
	describe('CLI Providers', () => {
		it('should verify CLI providers have supportsTemperature = false', async () => {
			const { ClaudeCodeProvider } = await import(
				'../../../src/ai-providers/claude-code.js'
			);
			const { CodexCliProvider } = await import(
				'../../../src/ai-providers/codex-cli.js'
			);
			const { GeminiCliProvider } = await import(
				'../../../src/ai-providers/gemini-cli.js'
			);
			const { GrokCliProvider } = await import(
				'../../../src/ai-providers/grok-cli.js'
			);

			expect(new ClaudeCodeProvider().supportsTemperature).toBe(false);
			expect(new CodexCliProvider().supportsTemperature).toBe(false);
			expect(new GeminiCliProvider().supportsTemperature).toBe(false);
			expect(new GrokCliProvider().supportsTemperature).toBe(false);
		});
	});

	describe('Standard API Providers', () => {
		it('should verify standard providers have supportsTemperature = true', async () => {
			const { AnthropicAIProvider } = await import(
				'../../../src/ai-providers/anthropic.js'
			);
			const { OpenAIProvider } = await import(
				'../../../src/ai-providers/openai.js'
			);
			const { GoogleAIProvider } = await import(
				'../../../src/ai-providers/google.js'
			);
			const { PerplexityAIProvider } = await import(
				'../../../src/ai-providers/perplexity.js'
			);
			const { XAIProvider } = await import('../../../src/ai-providers/xai.js');
			const { GroqProvider } = await import(
				'../../../src/ai-providers/groq.js'
			);
			const { OpenRouterAIProvider } = await import(
				'../../../src/ai-providers/openrouter.js'
			);

			expect(new AnthropicAIProvider().supportsTemperature).toBe(true);
			expect(new OpenAIProvider().supportsTemperature).toBe(true);
			expect(new GoogleAIProvider().supportsTemperature).toBe(true);
			expect(new PerplexityAIProvider().supportsTemperature).toBe(true);
			expect(new XAIProvider().supportsTemperature).toBe(true);
			expect(new GroqProvider().supportsTemperature).toBe(true);
			expect(new OpenRouterAIProvider().supportsTemperature).toBe(true);
		});
	});

	describe('Special Case Providers', () => {
		it('should verify Ollama provider has supportsTemperature = true', async () => {
			const { OllamaAIProvider } = await import(
				'../../../src/ai-providers/ollama.js'
			);

			expect(new OllamaAIProvider().supportsTemperature).toBe(true);
		});

		it('should verify cloud providers have supportsTemperature = true', async () => {
			const { BedrockAIProvider } = await import(
				'../../../src/ai-providers/bedrock.js'
			);
			const { AzureProvider } = await import(
				'../../../src/ai-providers/azure.js'
			);
			const { VertexAIProvider } = await import(
				'../../../src/ai-providers/google-vertex.js'
			);

			expect(new BedrockAIProvider().supportsTemperature).toBe(true);
			expect(new AzureProvider().supportsTemperature).toBe(true);
			expect(new VertexAIProvider().supportsTemperature).toBe(true);
		});
	});
});
