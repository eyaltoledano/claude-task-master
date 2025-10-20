/**
 * @fileoverview AI Provider interface definitions for the tm-core package
 * This file defines the contract for all AI provider implementations
 */

/**
 * Options for AI completion requests
 */
export interface AIOptions {
	/** Temperature for response randomness (0.0 to 1.0) */
	temperature?: number;
	/** Maximum number of tokens to generate */
	maxTokens?: number;
	/** Whether to use streaming responses */
	stream?: boolean;
	/** Top-p sampling parameter (0.0 to 1.0) */
	topP?: number;
	/** Frequency penalty to reduce repetition (-2.0 to 2.0) */
	frequencyPenalty?: number;
	/** Presence penalty to encourage new topics (-2.0 to 2.0) */
	presencePenalty?: number;
	/** Stop sequences to halt generation */
	stop?: string | string[];
	/** Custom system prompt override */
	systemPrompt?: string;
	/** Request timeout in milliseconds */
	timeout?: number;
	/** Number of retry attempts on failure */
	retries?: number;
}

/**
 * Response from AI completion request
 */
export interface AIResponse {
	/** Generated text content */
	content: string;
	/** Token count for the request */
	inputTokens: number;
	/** Token count for the response */
	outputTokens: number;
	/** Total tokens used */
	totalTokens: number;
	/** Cost in USD (if available) */
	cost?: number;
	/** Model used for generation */
	model: string;
	/** Provider name */
	provider: string;
	/** Response timestamp */
	timestamp: string;
	/** Request duration in milliseconds */
	duration: number;
	/** Whether the response was cached */
	cached?: boolean;
	/** Finish reason (completed, length, stop, etc.) */
	finishReason?: string;
}

/**
 * AI model information
 */
export interface AIModel {
	/** Model identifier */
	id: string;
	/** Human-readable model name */
	name: string;
	/** Model description */
	description?: string;
	/** Maximum context length in tokens */
	contextLength: number;
	/** Input cost per 1K tokens in USD */
	inputCostPer1K?: number;
	/** Output cost per 1K tokens in USD */
	outputCostPer1K?: number;
	/** Whether the model supports function calling */
	supportsFunctions?: boolean;
	/** Whether the model supports vision/image inputs */
	supportsVision?: boolean;
	/** Whether the model supports streaming */
	supportsStreaming?: boolean;
}

/**
 * Provider capabilities and metadata
 */
export interface ProviderInfo {
	/** Provider name */
	name: string;
	/** Provider display name */
	displayName: string;
	/** Provider description */
	description?: string;
	/** Base API URL */
	baseUrl?: string;
	/** Available models */
	models: AIModel[];
	/** Default model ID */
	defaultModel: string;
	/** Whether the provider requires an API key */
	requiresApiKey: boolean;
	/** Supported features */
	features: {
		streaming?: boolean;
		functions?: boolean;
		vision?: boolean;
		embeddings?: boolean;
	};
}

/**
 * Interface for AI provider implementations
 * All AI providers must implement this interface
 */
export interface IAIProvider {
	/**
	 * Generate a text completion from a prompt
	 * @param prompt - Input prompt text
	 * @param options - Optional generation parameters
	 * @returns Promise that resolves to AI response
	 */
	generateCompletion(prompt: string, options?: AIOptions): Promise<AIResponse>;

	/**
	 * Generate a streaming completion (if supported)
	 * @param prompt - Input prompt text
	 * @param options - Optional generation parameters
	 * @returns AsyncIterator of response chunks
	 */
	generateStreamingCompletion(
		prompt: string,
		options?: AIOptions
	): AsyncIterator<Partial<AIResponse>>;

	/**
	 * Calculate token count for given text
	 * @param text - Text to count tokens for
	 * @param model - Optional model to use for counting
	 * @returns Number of tokens
	 */
	calculateTokens(text: string, model?: string): number;

	/**
	 * Get the provider name
	 * @returns Provider name string
	 */
	getName(): string;

	/**
	 * Get current model being used
	 * @returns Current model ID
	 */
	getModel(): string;

	/**
	 * Set the model to use for requests
	 * @param model - Model ID to use
	 */
	setModel(model: string): void;

	/**
	 * Get the default model for this provider
	 * @returns Default model ID
	 */
	getDefaultModel(): string;

	/**
	 * Check if the provider is available and configured
	 * @returns Promise that resolves to availability status
	 */
	isAvailable(): Promise<boolean>;

	/**
	 * Get provider information and capabilities
	 * @returns Provider information object
	 */
	getProviderInfo(): ProviderInfo;

	/**
	 * Get available models for this provider
	 * @returns Array of available models
	 */
	getAvailableModels(): AIModel[];

	/**
	 * Validate API key or credentials
	 * @returns Promise that resolves to validation status
	 */
	validateCredentials(): Promise<boolean>;

	/**
	 * Get usage statistics if available
	 * @returns Promise that resolves to usage stats or null
	 */
	getUsageStats(): Promise<ProviderUsageStats | null>;

	/**
	 * Initialize the provider (set up connections, validate config, etc.)
	 * @returns Promise that resolves when initialization is complete
	 */
	initialize(): Promise<void>;

	/**
	 * Clean up and close provider connections
	 * @returns Promise that resolves when cleanup is complete
	 */
	close(): Promise<void>;
}

/**
 * Usage statistics for a provider
 */
export interface ProviderUsageStats {
	/** Total requests made */
	totalRequests: number;
	/** Total tokens consumed */
	totalTokens: number;
	/** Total cost in USD */
	totalCost: number;
	/** Requests today */
	requestsToday: number;
	/** Tokens used today */
	tokensToday: number;
	/** Cost today */
	costToday: number;
	/** Average response time in milliseconds */
	averageResponseTime: number;
	/** Success rate (0.0 to 1.0) */
	successRate: number;
	/** Last request timestamp */
	lastRequestAt?: string;
	/** Rate limit information if available */
	rateLimits?: {
		requestsPerMinute: number;
		tokensPerMinute: number;
		requestsRemaining: number;
		tokensRemaining: number;
		resetTime: string;
	};
}

/**
 * Configuration for AI provider instances
 */
export interface AIProviderConfig {
	/** API key for the provider */
	apiKey: string;
	/** Base URL override */
	baseUrl?: string;
	/** Default model to use */
	model?: string;
	/** Default generation options */
	defaultOptions?: AIOptions;
	/** Request timeout in milliseconds */
	timeout?: number;
	/** Maximum retry attempts */
	maxRetries?: number;
	/** Custom headers to include in requests */
	headers?: Record<string, string>;
	/** Enable request/response logging */
	enableLogging?: boolean;
	/** Enable usage tracking */
	enableUsageTracking?: boolean;
}

/**
 * Abstract base class for AI provider implementations
 * Provides common functionality and enforces the interface
 */
export abstract class BaseAIProvider implements IAIProvider {
	protected config: AIProviderConfig;
	protected currentModel: string;
	protected usageStats: ProviderUsageStats | null = null;

	constructor(config: AIProviderConfig) {
		this.config = config;
		this.currentModel = config.model || this.getDefaultModel();

		if (config.enableUsageTracking) {
			this.initializeUsageTracking();
		}
	}

	// Abstract methods that must be implemented by concrete classes
	abstract generateCompletion(
		prompt: string,
		options?: AIOptions
	): Promise<AIResponse>;
	abstract generateStreamingCompletion(
		prompt: string,
		options?: AIOptions
	): AsyncIterator<Partial<AIResponse>>;
	abstract calculateTokens(text: string, model?: string): number;
	abstract getName(): string;
	abstract getDefaultModel(): string;
	abstract isAvailable(): Promise<boolean>;
	abstract getProviderInfo(): ProviderInfo;
	abstract validateCredentials(): Promise<boolean>;
	abstract initialize(): Promise<void>;
	abstract close(): Promise<void>;

	// Implemented methods with common functionality
	getModel(): string {
		return this.currentModel;
	}

	setModel(model: string): void {
		const availableModels = this.getAvailableModels();
		const modelExists = availableModels.some((m) => m.id === model);

		if (!modelExists) {
			throw new Error(
				`Model "${model}" is not available for provider "${this.getName()}"`
			);
		}

		this.currentModel = model;
	}

	getAvailableModels(): AIModel[] {
		return this.getProviderInfo().models;
	}

	async getUsageStats(): Promise<ProviderUsageStats | null> {
		return this.usageStats;
	}

	/**
	 * Initialize usage tracking
	 */
	protected initializeUsageTracking(): void {
		this.usageStats = {
			totalRequests: 0,
			totalTokens: 0,
			totalCost: 0,
			requestsToday: 0,
			tokensToday: 0,
			costToday: 0,
			averageResponseTime: 0,
			successRate: 1.0
		};
	}

	/**
	 * Update usage statistics after a request
	 * @param response - AI response to record
	 * @param duration - Request duration in milliseconds
	 * @param success - Whether the request was successful
	 */
	protected updateUsageStats(
		response: AIResponse,
		duration: number,
		success: boolean
	): void {
		if (!this.usageStats) return;

		this.usageStats.totalRequests++;
		this.usageStats.totalTokens += response.totalTokens;

		if (response.cost) {
			this.usageStats.totalCost += response.cost;
		}

		// Update daily stats (simplified - would need proper date tracking)
		this.usageStats.requestsToday++;
		this.usageStats.tokensToday += response.totalTokens;

		if (response.cost) {
			this.usageStats.costToday += response.cost;
		}

		// Update average response time
		const totalTime =
			this.usageStats.averageResponseTime * (this.usageStats.totalRequests - 1);
		this.usageStats.averageResponseTime =
			(totalTime + duration) / this.usageStats.totalRequests;

		// Update success rate
		const successCount = Math.floor(
			this.usageStats.successRate * (this.usageStats.totalRequests - 1)
		);
		const newSuccessCount = successCount + (success ? 1 : 0);
		this.usageStats.successRate =
			newSuccessCount / this.usageStats.totalRequests;

		this.usageStats.lastRequestAt = new Date().toISOString();
	}

	/**
	 * Merge user options with default options
	 * @param userOptions - User-provided options
	 * @returns Merged options object
	 */
	protected mergeOptions(userOptions?: AIOptions): AIOptions {
		return {
			temperature: 0.7,
			maxTokens: 2000,
			stream: false,
			topP: 1.0,
			frequencyPenalty: 0.0,
			presencePenalty: 0.0,
			timeout: 30000,
			retries: 3,
			...this.config.defaultOptions,
			...userOptions
		};
	}

	/**
	 * Validate prompt input
	 * @param prompt - Prompt to validate
	 * @throws Error if prompt is invalid
	 */
	protected validatePrompt(prompt: string): void {
		if (!prompt || typeof prompt !== 'string') {
			throw new Error('Prompt must be a non-empty string');
		}

		if (prompt.trim().length === 0) {
			throw new Error('Prompt cannot be empty or only whitespace');
		}
	}
}
