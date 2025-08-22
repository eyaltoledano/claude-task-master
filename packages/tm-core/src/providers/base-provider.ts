/**
 * @fileoverview Base provider implementation for AI providers in tm-core
 * Provides common functionality and properties for all AI provider implementations
 */

import {
	IAIProvider,
	AIOptions,
	AIResponse,
	AIModel,
	ProviderInfo,
	ProviderUsageStats
} from '../interfaces/ai-provider.interface.js';

/**
 * Configuration interface for BaseProvider
 */
export interface BaseProviderConfig {
	/** API key for the provider */
	apiKey: string;
	/** Optional model ID to use */
	model?: string;
}

/**
 * Abstract base class providing common functionality for all AI providers
 * Implements the IAIProvider interface with shared properties and basic methods
 */
export abstract class BaseProvider implements IAIProvider {
	/** API key for authentication */
	protected apiKey: string;
	/** Current model being used */
	protected model: string;
	/** Maximum number of retry attempts */
	protected maxRetries: number = 3;
	/** Delay between retries in milliseconds */
	protected retryDelay: number = 1000;

	/**
	 * Constructor for BaseProvider
	 * @param config - Configuration object with apiKey and optional model
	 */
	constructor(config: BaseProviderConfig) {
		this.apiKey = config.apiKey;
		this.model = config.model || this.getDefaultModel();
	}

	/**
	 * Get the currently configured model
	 * @returns Current model ID
	 */
	getModel(): string {
		return this.model;
	}

	// Abstract methods that concrete providers must implement
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
	abstract setModel(model: string): void;
	abstract getDefaultModel(): string;
	abstract isAvailable(): Promise<boolean>;
	abstract getProviderInfo(): ProviderInfo;
	abstract getAvailableModels(): AIModel[];
	abstract validateCredentials(): Promise<boolean>;
	abstract getUsageStats(): Promise<ProviderUsageStats | null>;
	abstract initialize(): Promise<void>;
	abstract close(): Promise<void>;
}
