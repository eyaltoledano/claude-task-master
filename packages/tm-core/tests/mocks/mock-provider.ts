/**
 * @fileoverview Mock provider for testing BaseProvider functionality
 */

import type {
	AIModel,
	AIOptions,
	AIResponse,
	ProviderInfo,
	ProviderUsageStats
} from '../../src/interfaces/ai-provider.interface';
import {
	BaseProvider,
	type BaseProviderConfig,
	type CompletionResult
} from '../../src/providers/ai/base-provider';

/**
 * Configuration for MockProvider behavior
 */
export interface MockProviderOptions extends BaseProviderConfig {
	shouldFail?: boolean;
	failAfterAttempts?: number;
	simulateRateLimit?: boolean;
	simulateTimeout?: boolean;
	responseDelay?: number;
	tokenMultiplier?: number;
}

/**
 * Mock provider for testing BaseProvider functionality
 */
export class MockProvider extends BaseProvider {
	private attemptCount = 0;
	private readonly options: MockProviderOptions;

	constructor(options: MockProviderOptions) {
		super(options);
		this.options = options;
	}

	/**
	 * Simulate completion generation with configurable behavior
	 */
	protected async generateCompletionInternal(
		prompt: string,
		_options?: AIOptions
	): Promise<CompletionResult> {
		this.attemptCount++;

		// Simulate delay if configured
		if (this.options.responseDelay) {
			await this.sleep(this.options.responseDelay);
		}

		// Simulate failures based on configuration
		if (this.options.shouldFail) {
			throw new Error('Mock provider error');
		}

		if (
			this.options.failAfterAttempts &&
			this.attemptCount <= this.options.failAfterAttempts
		) {
			if (this.options.simulateRateLimit) {
				throw new Error('Rate limit exceeded - too many requests (429)');
			}
			if (this.options.simulateTimeout) {
				throw new Error('Request timeout - ECONNRESET');
			}
			throw new Error('Temporary failure');
		}

		// Return successful mock response
		return {
			content: `Mock response to: ${prompt}`,
			inputTokens: this.calculateTokens(prompt),
			outputTokens: this.calculateTokens(`Mock response to: ${prompt}`),
			finishReason: 'complete',
			model: this.model
		};
	}

	/**
	 * Simple token calculation for testing
	 */
	calculateTokens(text: string, _model?: string): number {
		const multiplier = this.options.tokenMultiplier || 1;
		// Rough approximation: 1 token per 4 characters
		return Math.ceil((text.length / 4) * multiplier);
	}

	getName(): string {
		return 'mock';
	}

	getDefaultModel(): string {
		return 'mock-model-v1';
	}

	/**
	 * Get the number of attempts made
	 */
	getAttemptCount(): number {
		return this.attemptCount;
	}

	/**
	 * Reset attempt counter
	 */
	resetAttempts(): void {
		this.attemptCount = 0;
	}

	// Implement remaining abstract methods
	async generateStreamingCompletion(
		prompt: string,
		_options?: AIOptions
	): AsyncIterator<Partial<AIResponse>> {
		// Simple mock implementation
		const response: Partial<AIResponse> = {
			content: `Mock streaming response to: ${prompt}`,
			provider: this.getName(),
			model: this.model
		};

		return {
			async next() {
				return { value: response, done: true };
			}
		};
	}

	async isAvailable(): Promise<boolean> {
		return !this.options.shouldFail;
	}

	getProviderInfo(): ProviderInfo {
		return {
			name: 'mock',
			displayName: 'Mock Provider',
			description: 'Mock provider for testing',
			models: this.getAvailableModels(),
			defaultModel: this.getDefaultModel(),
			requiresApiKey: true,
			features: {
				streaming: true,
				functions: false,
				vision: false,
				embeddings: false
			}
		};
	}

	getAvailableModels(): AIModel[] {
		return [
			{
				id: 'mock-model-v1',
				name: 'Mock Model v1',
				description: 'First mock model',
				contextLength: 4096,
				inputCostPer1K: 0.001,
				outputCostPer1K: 0.002,
				supportsStreaming: true
			},
			{
				id: 'mock-model-v2',
				name: 'Mock Model v2',
				description: 'Second mock model',
				contextLength: 8192,
				inputCostPer1K: 0.002,
				outputCostPer1K: 0.004,
				supportsStreaming: true
			}
		];
	}

	async validateCredentials(): Promise<boolean> {
		return this.apiKey === 'valid-key';
	}

	async getUsageStats(): Promise<ProviderUsageStats | null> {
		return {
			totalRequests: this.attemptCount,
			totalTokens: 1000,
			totalCost: 0.01,
			requestsToday: this.attemptCount,
			tokensToday: 1000,
			costToday: 0.01,
			averageResponseTime: 100,
			successRate: 0.9,
			lastRequestAt: new Date().toISOString()
		};
	}

	async initialize(): Promise<void> {
		// No-op for mock
	}

	async close(): Promise<void> {
		// No-op for mock
	}

	// Override retry configuration for testing
	protected getMaxRetries(): number {
		return this.options.failAfterAttempts
			? this.options.failAfterAttempts + 1
			: 3;
	}
}
