/**
 * @fileoverview Abstract base provider with Template Method pattern for AI providers
 * Provides common functionality, error handling, and retry logic
 */

import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import type {
	AIOptions,
	AIResponse,
	IAIProvider,
	ProviderUsageStats,
	ProviderInfo,
	AIModel
} from '../interfaces/ai-provider.interface.js';

// Constants for retry logic
const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 32000;
const BACKOFF_MULTIPLIER = 2;
const JITTER_FACTOR = 0.1;

// Constants for validation
const MIN_PROMPT_LENGTH = 1;
const MAX_PROMPT_LENGTH = 100000;
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const MIN_MAX_TOKENS = 1;
const MAX_MAX_TOKENS = 131072;

/**
 * Configuration for BaseProvider
 */
export interface BaseProviderConfig {
	apiKey: string;
	model?: string;
}

/**
 * Internal completion result structure
 */
export interface CompletionResult {
	content: string;
	inputTokens?: number;
	outputTokens?: number;
	finishReason?: string;
	model?: string;
}

/**
 * Validation result for input validation
 */
interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Prepared request after preprocessing
 */
interface PreparedRequest {
	prompt: string;
	options: AIOptions;
	metadata: Record<string, any>;
}

/**
 * Abstract base provider implementing Template Method pattern
 * Provides common error handling, retry logic, and validation
 */
export abstract class BaseProvider implements IAIProvider {
	protected readonly apiKey: string;
	protected model: string;

	constructor(config: BaseProviderConfig) {
		if (!config.apiKey) {
			throw new TaskMasterError(
				'API key is required',
				ERROR_CODES.AUTHENTICATION_ERROR
			);
		}
		this.apiKey = config.apiKey;
		this.model = config.model || this.getDefaultModel();
	}

	/**
	 * Template method for generating completions
	 * Handles validation, retries, and error handling
	 */
	async generateCompletion(
		prompt: string,
		options?: AIOptions
	): Promise<AIResponse> {
		// Validate input
		const validation = this.validateInput(prompt, options);
		if (!validation.valid) {
			throw new TaskMasterError(
				validation.error || 'Invalid input',
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		// Prepare request
		const prepared = this.prepareRequest(prompt, options);

		// Execute with retry logic
		let lastError: Error | undefined;
		const maxRetries = this.getMaxRetries();

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const startTime = Date.now();
				const result = await this.generateCompletionInternal(
					prepared.prompt,
					prepared.options
				);

				const duration = Date.now() - startTime;
				return this.handleResponse(result, duration, prepared);
			} catch (error) {
				lastError = error as Error;

				if (!this.shouldRetry(error, attempt)) {
					break;
				}

				const delay = this.calculateBackoffDelay(attempt);
				await this.sleep(delay);
			}
		}

		// All retries failed
		this.handleError(lastError || new Error('Unknown error'));
	}

	/**
	 * Validate input prompt and options
	 */
	protected validateInput(
		prompt: string,
		options?: AIOptions
	): ValidationResult {
		// Validate prompt
		if (!prompt || typeof prompt !== 'string') {
			return { valid: false, error: 'Prompt must be a non-empty string' };
		}

		const trimmedPrompt = prompt.trim();
		if (trimmedPrompt.length < MIN_PROMPT_LENGTH) {
			return { valid: false, error: 'Prompt cannot be empty' };
		}

		if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
			return {
				valid: false,
				error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`
			};
		}

		// Validate options if provided
		if (options) {
			const optionValidation = this.validateOptions(options);
			if (!optionValidation.valid) {
				return optionValidation;
			}
		}

		return { valid: true };
	}

	/**
	 * Validate completion options
	 */
	protected validateOptions(options: AIOptions): ValidationResult {
		if (options.temperature !== undefined) {
			if (
				options.temperature < MIN_TEMPERATURE ||
				options.temperature > MAX_TEMPERATURE
			) {
				return {
					valid: false,
					error: `Temperature must be between ${MIN_TEMPERATURE} and ${MAX_TEMPERATURE}`
				};
			}
		}

		if (options.maxTokens !== undefined) {
			if (
				options.maxTokens < MIN_MAX_TOKENS ||
				options.maxTokens > MAX_MAX_TOKENS
			) {
				return {
					valid: false,
					error: `Max tokens must be between ${MIN_MAX_TOKENS} and ${MAX_MAX_TOKENS}`
				};
			}
		}

		if (options.topP !== undefined) {
			if (options.topP < 0 || options.topP > 1) {
				return { valid: false, error: 'Top-p must be between 0 and 1' };
			}
		}

		return { valid: true };
	}

	/**
	 * Prepare request for processing
	 */
	protected prepareRequest(
		prompt: string,
		options?: AIOptions
	): PreparedRequest {
		const defaultOptions = this.getDefaultOptions();
		const mergedOptions = { ...defaultOptions, ...options };

		return {
			prompt: prompt.trim(),
			options: mergedOptions,
			metadata: {
				provider: this.getName(),
				model: this.model,
				timestamp: new Date().toISOString()
			}
		};
	}

	/**
	 * Process and format the response
	 */
	protected handleResponse(
		result: CompletionResult,
		duration: number,
		request: PreparedRequest
	): AIResponse {
		const inputTokens =
			result.inputTokens || this.calculateTokens(request.prompt);
		const outputTokens =
			result.outputTokens || this.calculateTokens(result.content);

		return {
			content: result.content,
			inputTokens,
			outputTokens,
			totalTokens: inputTokens + outputTokens,
			model: result.model || this.model,
			provider: this.getName(),
			timestamp: request.metadata.timestamp,
			duration,
			finishReason: result.finishReason
		};
	}

	/**
	 * Handle errors with proper wrapping
	 */
	protected handleError(error: unknown): never {
		if (error instanceof TaskMasterError) {
			throw error;
		}

		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorCode = this.getErrorCode(error);

		throw new TaskMasterError(
			`${this.getName()} provider error: ${errorMessage}`,
			errorCode,
			{
				operation: 'generateCompletion',
				resource: this.getName(),
				details:
					error instanceof Error
						? {
								name: error.name,
								stack: error.stack,
								model: this.model
							}
						: { error: String(error), model: this.model }
			},
			error instanceof Error ? error : undefined
		);
	}

	/**
	 * Determine if request should be retried
	 */
	protected shouldRetry(error: unknown, attempt: number): boolean {
		if (attempt >= this.getMaxRetries()) {
			return false;
		}

		return this.isRetryableError(error);
	}

	/**
	 * Check if error is retryable
	 */
	protected isRetryableError(error: unknown): boolean {
		if (this.isRateLimitError(error)) return true;
		if (this.isTimeoutError(error)) return true;
		if (this.isNetworkError(error)) return true;

		return false;
	}

	/**
	 * Check if error is a rate limit error
	 */
	protected isRateLimitError(error: unknown): boolean {
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes('rate limit') ||
				message.includes('too many requests') ||
				message.includes('429')
			);
		}
		return false;
	}

	/**
	 * Check if error is a timeout error
	 */
	protected isTimeoutError(error: unknown): boolean {
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes('timeout') ||
				message.includes('timed out') ||
				message.includes('econnreset')
			);
		}
		return false;
	}

	/**
	 * Check if error is a network error
	 */
	protected isNetworkError(error: unknown): boolean {
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes('network') ||
				message.includes('enotfound') ||
				message.includes('econnrefused')
			);
		}
		return false;
	}

	/**
	 * Calculate exponential backoff delay with jitter
	 */
	protected calculateBackoffDelay(attempt: number): number {
		const exponentialDelay =
			BASE_RETRY_DELAY_MS * BACKOFF_MULTIPLIER ** (attempt - 1);
		const clampedDelay = Math.min(exponentialDelay, MAX_RETRY_DELAY_MS);

		// Add jitter to prevent thundering herd
		const jitter = clampedDelay * JITTER_FACTOR * (Math.random() - 0.5) * 2;

		return Math.round(clampedDelay + jitter);
	}

	/**
	 * Get error code from error
	 */
	protected getErrorCode(error: unknown): string {
		if (this.isRateLimitError(error)) return ERROR_CODES.API_ERROR;
		if (this.isTimeoutError(error)) return ERROR_CODES.NETWORK_ERROR;
		if (this.isNetworkError(error)) return ERROR_CODES.NETWORK_ERROR;

		if (error instanceof Error && error.message.includes('401')) {
			return ERROR_CODES.AUTHENTICATION_ERROR;
		}

		return ERROR_CODES.PROVIDER_ERROR;
	}

	/**
	 * Sleep utility for delays
	 */
	protected sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get default options for completions
	 */
	protected getDefaultOptions(): AIOptions {
		return {
			temperature: 0.7,
			maxTokens: 2000,
			topP: 1.0
		};
	}

	/**
	 * Get maximum retry attempts
	 */
	protected getMaxRetries(): number {
		return DEFAULT_MAX_RETRIES;
	}

	// Public interface methods
	getModel(): string {
		return this.model;
	}

	setModel(model: string): void {
		this.model = model;
	}

	// Abstract methods that must be implemented by concrete providers
	protected abstract generateCompletionInternal(
		prompt: string,
		options?: AIOptions
	): Promise<CompletionResult>;

	abstract calculateTokens(text: string, model?: string): number;
	abstract getName(): string;
	abstract getDefaultModel(): string;

	// IAIProvider methods that must be implemented
	abstract generateStreamingCompletion(
		prompt: string,
		options?: AIOptions
	): AsyncIterator<Partial<AIResponse>>;
	abstract isAvailable(): Promise<boolean>;
	abstract getProviderInfo(): ProviderInfo;
	abstract getAvailableModels(): AIModel[];
	abstract validateCredentials(): Promise<boolean>;
	abstract getUsageStats(): Promise<ProviderUsageStats | null>;
	abstract initialize(): Promise<void>;
	abstract close(): Promise<void>;
}
