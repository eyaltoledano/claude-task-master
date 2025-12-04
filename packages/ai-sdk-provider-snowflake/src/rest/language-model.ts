/**
 * Cortex REST API Language Model implementation for Snowflake Cortex
 * 
 * Uses the Cortex REST API endpoint (/api/v2/cortex/inference:complete)
 * which provides access to the latest features and all model types.
 * 
 * This endpoint uses a different request format than the OpenAI-compatible endpoint:
 * - Structured outputs use type: 'json' with schema directly
 * - For OpenAI models: additionalProperties: false is required on all schema nodes
 * 
 * Feature Support:
 * - Prompt Caching:
 *   - OpenAI models: Implicit caching (no modification needed), 1024+ tokens, 128-token increments
 *   - Claude models: Use cache_control: { type: 'ephemeral' } on content arrays, max 4 cache points
 * - Claude Extended Thinking: thinking object with budget_tokens
 * - OpenAI Reasoning: reasoning_effort parameter
 * - Streaming: SSE format with delta updates
 * 
 * See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api
 * See: https://docs.snowflake.com/developer-guide/snowflake-rest-api/reference/cortex-inference
 * See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/complete-structured-outputs
 */

import type {
	LanguageModelV2,
	LanguageModelV2CallOptions,
	LanguageModelV2CallWarning,
	LanguageModelV2Content,
	LanguageModelV2FinishReason,
	LanguageModelV2Prompt,
	LanguageModelV2StreamPart,
	LanguageModelV2ToolCall
} from '@ai-sdk/provider';
import { NoSuchModelError, APICallError } from '@ai-sdk/provider';

import { authenticate } from '../auth/index.js';
import { removeUnsupportedFeatures, convertPromptToMessages } from '../schema/index.js';
import type { CortexMessage } from '../schema/index.js';
import { isFeatureEnabled, getThinkingLevel } from '../config/index.js';
import { 
	normalizeModelId,
	supportsThinking,
	supportsReasoning,
	supportsStreaming,
	supportsPromptCaching,
	getThinkingBudgetTokens
} from '../utils/models.js';
import { convertToolsToSnowflakeFormat, parseToolCalls } from '../utils/tool-helpers.js';
import type { CortexToolSpec } from '../tools/types.js';
import type { SnowflakeProviderSettings, SnowflakeModelId, AuthResult, ThinkingLevel } from '../types.js';

/**
 * Options for creating a Rest Cortex language model
 */
export interface RestLanguageModelOptions {
	/** Model identifier */
	id: SnowflakeModelId;
	/** Model settings */
	settings?: SnowflakeProviderSettings;
}

/**
 * Default maximum tokens for models if not found in configuration
 */
const DEFAULT_MAX_TOKENS = 8192;

/**
 * Cortex REST API Language Model for Snowflake Cortex
 * 
 * This provider uses the Cortex REST API which has the latest features
 * and consistent model availability across all model types.
 */
export class RestLanguageModel implements LanguageModelV2 {
	readonly specificationVersion = 'v2' as const;
	readonly defaultObjectGenerationMode = 'json' as const;
	readonly supportsImageUrls = false;
	readonly supportsStructuredOutputs = true;
	readonly supportedUrls: Record<string, RegExp[]> = {};

	readonly modelId: SnowflakeModelId;
	readonly settings: SnowflakeProviderSettings;

	private authResult?: AuthResult;

	constructor(options: RestLanguageModelOptions) {
		this.modelId = options.id;
		this.settings = options.settings ?? {};

		// Validate model ID format
		if (
			!this.modelId ||
			typeof this.modelId !== 'string' ||
			this.modelId.trim() === ''
		) {
			throw new NoSuchModelError({
				modelId: this.modelId,
				modelType: 'languageModel'
			});
		}
	}

	get provider(): string {
		return 'snowflake';
	}

	/**
	 * Convert AI SDK prompt to Cortex REST messages format
	 * 
	 * Uses the shared convertPromptToMessages function from schema/transformer.ts.
	 * See that function for prompt caching documentation.
	 * 
	 * @param prompt - AI SDK prompt
	 * @param enableCaching - Whether to enable prompt caching for Claude models
	 * @returns Array of messages in Cortex format
	 */
	private convertPromptToMessages(
		prompt: LanguageModelV2Prompt,
		enableCaching = false
	): CortexMessage[] {
		return convertPromptToMessages(
			prompt as Array<{ role: string; content: unknown }>,
			{ enableCaching, modelId: this.modelId }
		);
	}
	
	/**
	 * Check if this model is a Claude model (supports thinking)
	 */
	private isClaudeModel(): boolean {
		const normalized = normalizeModelId(this.modelId);
		return normalized.startsWith('claude');
	}
	
	/**
	 * Check if this model is an OpenAI model (supports reasoning_effort)
	 */
	private isOpenAIModel(): boolean {
		const normalized = normalizeModelId(this.modelId);
		return normalized.startsWith('openai') || normalized.startsWith('gpt-');
	}

	/**
	 * Ensure we have authentication
	 */
	private async ensureAuth(): Promise<AuthResult> {
		// Check if we have cached auth that hasn't expired
		if (this.authResult && (!this.authResult.expiresAt || this.authResult.expiresAt > Date.now())) {
			return this.authResult;
		}

		// Authenticate
		this.authResult = await authenticate(this.settings);
		return this.authResult;
	}
	
	/**
	 * Check if prompt caching should be enabled
	 * Priority: settings override > user config > model capability
	 * 
	 * Prompt caching for Cortex REST API:
	 * - OpenAI models: Implicit caching (no modification needed)
	 * - Claude models: Uses content_list with cache_control: { type: 'ephemeral' }
	 * See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#prompt-caching-example
	 * 
	 * Note: Not all Claude models support prompt caching (e.g., claude-4-opus doesn't)
	 */
	private shouldEnablePromptCaching(): boolean {
		// First check if the model supports prompt caching at all
		if (!supportsPromptCaching(this.modelId)) {
			return false;
		}
		
		// Settings override takes highest priority
		if (this.settings.enablePromptCaching !== undefined) {
			return this.settings.enablePromptCaching;
		}
		
		// Check user config
		return isFeatureEnabled('promptCaching');
	}
	
	/**
	 * Check if thinking/reasoning should be enabled
	 * Priority: settings override > user config > model capability
	 */
	private shouldEnableThinking(): boolean {
		// Settings override takes highest priority
		if (this.settings.enableThinking !== undefined) {
			return this.settings.enableThinking;
		}
		
		// Check user config
		if (!isFeatureEnabled('thinking')) {
			return false;
		}
		
		// Check model capability (either thinking or reasoning)
		return supportsThinking(this.modelId) || supportsReasoning(this.modelId);
	}
	
	/**
	 * Check if structured outputs should be enabled
	 * Priority: settings override > user config > model capability
	 */
	private shouldEnableStructuredOutputs(): boolean {
		// Settings override takes highest priority
		if (this.settings.enableStructuredOutputs !== undefined) {
			return this.settings.enableStructuredOutputs;
		}
		
		// Check user config
		return isFeatureEnabled('structuredOutputs');
	}
	
	/**
	 * Check if streaming should be enabled
	 * Priority: settings override > user config > model capability
	 */
	private shouldEnableStreaming(): boolean {
		// Settings override takes highest priority
		if (this.settings.enableStreaming !== undefined) {
			return this.settings.enableStreaming;
		}
		
		// Check user config
		if (!isFeatureEnabled('streaming')) {
			return false;
		}
		
		// Check model capability
		return supportsStreaming(this.modelId);
	}
	
	/**
	 * Get the effective thinking level
	 * Priority: settings > user config defaults
	 */
	private getEffectiveThinkingLevel(): ThinkingLevel {
		// Settings override takes highest priority
		if (this.settings.thinkingLevel) {
			return this.settings.thinkingLevel;
		}
		
		// Legacy reasoning setting (backward compatibility)
		if (this.settings.reasoning) {
			return this.settings.reasoning;
		}
		
		// Use user config default
		return getThinkingLevel(false);
	}

	/**
	 * Make API request to Snowflake Cortex REST API
	 */
	private async makeApiRequest(
		endpoint: string,
		body: Record<string, unknown>,
		signal?: AbortSignal
	): Promise<Response> {
		const auth = await this.ensureAuth();
		const url = `${auth.baseURL}${endpoint}`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${auth.accessToken}`,
				'Accept': 'application/json'
			},
			body: JSON.stringify(body),
			signal
		});

		return response;
	}

	/**
	 * Main text generation method
	 */
	async doGenerate(
		options: LanguageModelV2CallOptions
	): Promise<{
		content: Array<LanguageModelV2Content>;
		usage: {
			inputTokens: number;
			outputTokens: number;
			totalTokens: number;
		};
		finishReason: LanguageModelV2FinishReason;
		warnings: LanguageModelV2CallWarning[];
	}> {
		const warnings: LanguageModelV2CallWarning[] = [];
		
		// Determine if features are enabled (user config overrides settings)
		const promptCachingEnabled = this.shouldEnablePromptCaching();
		const thinkingEnabled = this.shouldEnableThinking();
		
		// Convert messages to Cortex format with caching enabled if appropriate
		// For Claude models, this will use content_list with cache_control
		// For OpenAI models, caching is implicit (no format change needed)
		const messages = this.convertPromptToMessages(options.prompt, promptCachingEnabled);

		// Normalize model ID - strip cortex/ prefix if present
		const modelId = this.modelId.replace(/^cortex\//, '');

		// Build request body for Cortex REST API
		// See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api
		const body: Record<string, unknown> = {
			model: modelId,
			messages,
			max_tokens: options.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
			temperature: options.temperature ?? 0.7,
			stream: false // Explicitly disable streaming for doGenerate
		};

		// Handle structured output (JSON mode) for Cortex REST API
		// REST API uses: { type: 'json', schema: {...} }
		// See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/complete-structured-outputs
		// Important: For OpenAI models, additionalProperties: false must be set on all schema nodes
		// The removeUnsupportedFeatures function already handles this requirement
		if (this.shouldEnableStructuredOutputs() && options.responseFormat?.type === 'json' && options.responseFormat.schema) {
			const cleanedSchema = removeUnsupportedFeatures(
				options.responseFormat.schema as Record<string, unknown>
			);
			body.response_format = {
				type: 'json',
				schema: cleanedSchema
			};
		}
		
		// Handle tools - convert AI SDK tools to Cortex format
		// See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#prompt-caching-example (tools array)
		// Cortex REST API expects:
		// {
		//   "tools": [{
		//     "tool_spec": {
		//       "type": "generic",
		//       "name": "tool_name",
		//       "description": "What this tool does",
		//       "input_schema": { /* JSON Schema */ }
		//     }
		//   }]
		// }
		let cortexTools: CortexToolSpec[] = [];
		if (options.tools && options.tools.length > 0) {
			// Convert array of tools to Record<string, Tool> format
			const toolsRecord: Record<string, { description?: string; parameters?: Record<string, unknown> }> = {};
			for (const tool of options.tools) {
				if (tool.type === 'function') {
					toolsRecord[tool.name] = {
						description: tool.description,
						parameters: tool.inputSchema as Record<string, unknown>
					};
				}
			}
			cortexTools = convertToolsToSnowflakeFormat(toolsRecord, promptCachingEnabled && this.isClaudeModel());
			body.tools = cortexTools;
			
			if (process.env.DEBUG?.includes('snowflake:rest')) {
				console.log(`[DEBUG snowflake:rest] Tools included: ${cortexTools.map(t => t.tool_spec.name).join(', ')}`);
			}
		}
		
		// Add Claude extended thinking if enabled
		// See: https://platform.claude.com/docs/en/build-with-claude/extended-thinking
		// See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#thinking-and-reasoning-examples
		if (thinkingEnabled && this.isClaudeModel() && supportsThinking(this.modelId)) {
			const level = this.getEffectiveThinkingLevel();
			const budgetTokens = getThinkingBudgetTokens(this.modelId, level);
			body.thinking = {
				type: 'enabled',
				budget_tokens: budgetTokens
			};
			
			if (process.env.DEBUG?.includes('snowflake:rest')) {
				console.log(`[DEBUG snowflake:rest] Claude thinking enabled with budget_tokens: ${budgetTokens}`);
			}
		}
		
		// Add OpenAI reasoning_effort if enabled
		// See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#thinking-and-reasoning-examples
		if (thinkingEnabled && this.isOpenAIModel() && supportsReasoning(this.modelId)) {
			const level = this.getEffectiveThinkingLevel();
			body.reasoning_effort = level;
			
			if (process.env.DEBUG?.includes('snowflake:rest')) {
				console.log(`[DEBUG snowflake:rest] OpenAI reasoning_effort: ${level}`);
			}
		}

		// Log all requests to file for debugging
		const logDir = process.env.SNOWFLAKE_LOG_DIR || '/tmp';
		const logFile = `${logDir}/snowflake-rest-requests.log`;
		const timestamp = new Date().toISOString();
		const auth = await this.ensureAuth();
		const logEntry = {
			timestamp,
			baseURL: auth.baseURL,
			endpoint: '/api/v2/cortex/inference:complete',
			modelId: this.modelId,
			normalizedModelId: modelId,
			requestBody: body
		};
		
		try {
			const fs = await import('fs');
			fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + '\n---\n');
		} catch (e) {
			// Ignore file write errors in non-Node environments
		}

		// Debug logging - enable via DEBUG=snowflake:rest environment variable
		if (process.env.DEBUG?.includes('snowflake:rest')) {
			console.log(`[DEBUG snowflake:rest] Base URL: ${auth.baseURL}`);
			console.log(`[DEBUG snowflake:rest] Request body for ${modelId}:`);
			console.log(JSON.stringify(body, null, 2));
			console.log(`[DEBUG snowflake:rest] Log written to: ${logFile}`);
		}

		// Execute request with retries
		const maxRetries = this.settings.maxRetries ?? 3;
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				// Use Cortex REST API endpoint
				// See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api
				const response = await this.makeApiRequest(
					'/api/v2/cortex/inference:complete',
					body,
					options.abortSignal
				);

				if (!response.ok) {
					const errorBody = await response.text();
					
					// Check if retryable
					const isRetryable = response.status === 429 || response.status >= 500;
					
					if (!isRetryable || attempt === maxRetries) {
						throw new APICallError({
							message: `Snowflake Cortex REST API error (${response.status}): ${errorBody}`,
							url: response.url,
							requestBodyValues: body,
							isRetryable
						});
					}
					
					throw new Error(`API error: ${response.status}`);
				}

			// Debug logging for response
			if (process.env.DEBUG?.includes('snowflake:rest')) {
				console.log(`[DEBUG snowflake:rest] Response received - status: ${response.status}`);
				console.log(`[DEBUG snowflake:rest] Response Content-Type: ${response.headers.get('content-type')}`);
			}
			
			// Handle response - may be JSON or SSE format
			const responseText = await response.text();
			
			// Debug logging for response text
			if (process.env.DEBUG?.includes('snowflake:rest')) {
				console.log(`[DEBUG snowflake:rest] Response text length: ${responseText.length}`);
				console.log(`[DEBUG snowflake:rest] Response text (first 500 chars): ${responseText.substring(0, 500)}`);
				console.log(`[DEBUG snowflake:rest] Response text (last 100 chars): ${responseText.substring(Math.max(0, responseText.length - 100))}`);
			}
			
			// Define response type
			interface RestCortexResponse {
					// Cortex REST API response format
					// See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/complete-structured-outputs
					// See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#thinking-and-reasoning-examples
					created?: number;
					model?: string;
					thinking?: string;  // Claude extended thinking content
					structured_output?: Array<{
						raw_message?: Record<string, unknown>;
						type?: string;
					}>;
					choices?: Array<{
						message?: { content?: string };
						finish_reason?: string;
					}>;
					usage?: {
						prompt_tokens?: number;
						completion_tokens?: number;
						total_tokens?: number;
						// Caching-related usage fields
						cache_creation_input_tokens?: number;
						cache_read_input_tokens?: number;
					};
				}
				
				let result: RestCortexResponse;
				
				// Check if response is SSE format (starts with "data:")
				if (responseText.startsWith('data:')) {
					// Parse SSE response - may have multiple events
					const events = responseText.split('\n').filter(line => line.startsWith('data:'));
					
					// Collect all message content from SSE events
					let collectedContent = '';
					let lastEvent: RestCortexResponse | null = null;
					
					for (const event of events) {
						const data = event.replace(/^data:\s*/, '');
						if (data === '[DONE]') continue;
						
						try {
							const parsed = JSON.parse(data) as RestCortexResponse;
							lastEvent = parsed;
							
							// Extract delta content if present (streaming format)
							const delta = parsed.choices?.[0] as { delta?: { content?: string } } | undefined;
							if (delta?.delta?.content) {
								collectedContent += delta.delta.content;
							} else if (parsed.choices?.[0]?.message?.content) {
								collectedContent += parsed.choices[0].message.content;
							}
						} catch {
							// Skip malformed events
						}
					}
					
					// Build result from collected content
					result = {
						choices: [{
							message: { content: collectedContent },
							finish_reason: lastEvent?.choices?.[0]?.finish_reason || 'stop'
						}],
						usage: lastEvent?.usage
					};
			} else {
				// Parse as regular JSON
				try {
					result = JSON.parse(responseText) as RestCortexResponse;
				} catch (parseError) {
					console.error(`[ERROR snowflake:rest] Failed to parse response as JSON`);
					console.error(`[ERROR snowflake:rest] Response status: ${response.status}`);
					console.error(`[ERROR snowflake:rest] Response Content-Type: ${response.headers.get('content-type')}`);
					console.error(`[ERROR snowflake:rest] Response text (first 1000 chars): ${responseText.substring(0, 1000)}`);
					console.error(`[ERROR snowflake:rest] Parse error:`, parseError);
					throw parseError;
				}
			}

				// Extract content - handle regular, structured output, and tool call responses
				const content: Array<LanguageModelV2Content> = [];
				let hasToolCalls = false;
				let text = '';
				
				// Check for structured_output format (used when response_format is specified)
				if (result.structured_output?.[0]?.raw_message) {
					text = JSON.stringify(result.structured_output[0].raw_message);
				} else {
					// Fall back to regular choices format
					// Type assertion: Cortex API can return content_list for Claude models
					const choice = result.choices?.[0] as {
						message?: { 
							content?: string; 
							content_list?: Array<{ type: string; text?: string }>;
						};
						finish_reason?: string;
					} | undefined;
					
					// Handle content_list format (Claude via Cortex)
					if (choice?.message?.content_list && Array.isArray(choice.message.content_list)) {
						// Extract text from content_list array
						for (const item of choice.message.content_list) {
							if (item.type === 'text' && item.text) {
								text += item.text;
							}
						}
					} else {
						// Handle regular content format
						text = choice?.message?.content || '';
					}
				}
				
				// Handle thinking content from Claude models
				// See: https://platform.claude.com/docs/en/build-with-claude/extended-thinking
				if (result.thinking) {
					// Thinking content comes before the main response
					// We include it as a text block with a marker
					content.push({
						type: 'text' as const,
						text: `<thinking>\n${result.thinking}\n</thinking>\n\n`
					});
				}
				
				// Parse tool calls from response
				// The API returns tool calls in the message content array:
				// { "type": "tool_use", "id": "...", "name": "...", "input": {...} }
				const parsedToolCalls = parseToolCalls(result as unknown as Record<string, unknown>);
				if (parsedToolCalls.length > 0) {
					hasToolCalls = true;
					for (const tc of parsedToolCalls) {
						// AI SDK V2 LanguageModelV2ToolCall (part of LanguageModelV2Content) requires:
						// - type: 'tool-call'
						// - toolCallId: string
						// - toolName: string
						// - input: string (JSON stringified)
						const toolCall: LanguageModelV2ToolCall = {
							type: 'tool-call',
							toolCallId: tc.id,
							toolName: tc.name,
							input: JSON.stringify(tc.input) // Must be stringified JSON
						};
						content.push(toolCall);
					}
					
					if (process.env.DEBUG?.includes('snowflake:rest')) {
						console.log(`[DEBUG snowflake:rest] Tool calls: ${parsedToolCalls.map(t => t.name).join(', ')}`);
					}
				}
				
				// Add main text content (if any)
				if (text) {
					content.push({ type: 'text' as const, text });
				}

				// Determine finish reason
				let finishReason: LanguageModelV2FinishReason = 'stop';
				const choice = result.choices?.[0];
				if (hasToolCalls) {
					// If we have tool calls, finish reason is tool-calls
					finishReason = 'tool-calls';
				} else if (choice?.finish_reason === 'length') {
					finishReason = 'length';
				} else if (choice?.finish_reason === 'content_filter') {
					finishReason = 'content-filter';
				} else if (choice?.finish_reason === 'tool_calls' || choice?.finish_reason === 'tool_use') {
					finishReason = 'tool-calls';
				}
				
				if (process.env.DEBUG?.includes('snowflake:rest')) {
					console.log(`[DEBUG snowflake:rest] Finish reason: ${finishReason}, hasToolCalls: ${hasToolCalls}, text length: ${text.length}`);
					console.log(`[DEBUG snowflake:rest] Content array: ${JSON.stringify(content.map(c => c.type))}`);
					if (hasToolCalls) {
						console.log(`[DEBUG snowflake:rest] Tool calls in content: ${JSON.stringify(content.filter(c => c.type === 'tool-call'))}`);
					}
				}

				// Build usage object
				const usage = {
					inputTokens: result.usage?.prompt_tokens ?? 0,
					outputTokens: result.usage?.completion_tokens ?? 0,
					totalTokens: result.usage?.total_tokens ?? 0
				};

				return {
					content,
					usage,
					finishReason,
					warnings
				};
			} catch (error) {
				lastError = error as Error;

				// Don't retry for non-retryable errors
				if (error instanceof APICallError && !error.isRetryable) {
					throw error;
				}

				// Wait before retrying (exponential backoff)
				if (attempt < maxRetries) {
					await new Promise((resolve) =>
						setTimeout(resolve, Math.pow(2, attempt) * 1000)
					);
				}
			}
		}

		throw lastError!;
	}

	/**
	 * Streaming support for Cortex REST API
	 * 
	 * Uses Server-Sent Events (SSE) format for streaming responses.
	 * See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api
	 */
	async doStream(
		options: LanguageModelV2CallOptions
	): Promise<{
		stream: ReadableStream<LanguageModelV2StreamPart>;
		warnings: LanguageModelV2CallWarning[];
	}> {
		// Check if streaming is supported
		if (!this.shouldEnableStreaming()) {
			throw new APICallError({
				message: `Streaming is disabled for model ${this.modelId}. Enable it in settings or user config.`,
				url: 'snowflake-rest://local',
				requestBodyValues: {},
				isRetryable: false
			});
		}
		
		const warnings: LanguageModelV2CallWarning[] = [];
		
		// Determine if features are enabled
		const promptCachingEnabled = this.shouldEnablePromptCaching();
		const thinkingEnabled = this.shouldEnableThinking();
		
		// Convert messages to Cortex format with caching enabled if appropriate
		const messages = this.convertPromptToMessages(options.prompt, promptCachingEnabled);

		// Normalize model ID - strip cortex/ prefix if present
		const modelId = this.modelId.replace(/^cortex\//, '');

		// Build request body for streaming
		const body: Record<string, unknown> = {
			model: modelId,
			messages,
			max_tokens: options.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
			temperature: options.temperature ?? 0.7,
			stream: true  // Enable streaming
		};

		// Handle structured output
		if (this.shouldEnableStructuredOutputs() && options.responseFormat?.type === 'json' && options.responseFormat.schema) {
			const cleanedSchema = removeUnsupportedFeatures(
				options.responseFormat.schema as Record<string, unknown>
			);
			body.response_format = {
				type: 'json',
				schema: cleanedSchema
			};
		}
		
		// Handle tools for streaming
		if (options.tools && options.tools.length > 0) {
			const toolsRecord: Record<string, { description?: string; parameters?: Record<string, unknown> }> = {};
			for (const tool of options.tools) {
				if (tool.type === 'function') {
					toolsRecord[tool.name] = {
						description: tool.description,
						// LanguageModelV2FunctionTool uses inputSchema (JSONSchema7), not parameters
						parameters: tool.inputSchema as Record<string, unknown>
					};
				}
			}
			const cortexTools = convertToolsToSnowflakeFormat(toolsRecord, promptCachingEnabled && this.isClaudeModel());
			body.tools = cortexTools;
		}
		
		// Add Claude thinking if enabled
		if (thinkingEnabled && this.isClaudeModel() && supportsThinking(this.modelId)) {
			const level = this.getEffectiveThinkingLevel();
			const budgetTokens = getThinkingBudgetTokens(this.modelId, level);
			body.thinking = {
				type: 'enabled',
				budget_tokens: budgetTokens
			};
		}
		
		// Add OpenAI reasoning if enabled
		if (thinkingEnabled && this.isOpenAIModel() && supportsReasoning(this.modelId)) {
			const level = this.getEffectiveThinkingLevel();
			body.reasoning_effort = level;
		}

		// Get authentication
		const auth = await this.ensureAuth();
		const url = `${auth.baseURL}/api/v2/cortex/inference:complete`;

		// Debug logging
		if (process.env.DEBUG?.includes('snowflake:rest')) {
			console.log(`[DEBUG snowflake:rest] Streaming request to: ${url}`);
			console.log(JSON.stringify(body, null, 2));
		}

		// Create unique ID for this streaming session
		let eventIndex = 0;
		const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

		// Create the stream
		const stream = new ReadableStream<LanguageModelV2StreamPart>({
			start: async (controller) => {
				try {
					const response = await fetch(url, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${auth.accessToken}`,
							'Accept': 'text/event-stream'
						},
						body: JSON.stringify(body),
						signal: options.abortSignal
					});

					if (!response.ok) {
						const errorBody = await response.text();
						controller.error(new APICallError({
							message: `Snowflake Cortex REST API streaming error (${response.status}): ${errorBody}`,
							url: response.url,
							requestBodyValues: body,
							isRetryable: response.status === 429 || response.status >= 500
						}));
						return;
					}

					const reader = response.body?.getReader();
					if (!reader) {
						controller.error(new Error('Failed to get reader from response'));
						return;
					}

					const decoder = new TextDecoder();
					let buffer = '';
					let inputTokens = 0;
					let outputTokens = 0;

					while (true) {
						const { done, value } = await reader.read();
						
						if (done) {
							// Send finish event
							controller.enqueue({
								type: 'finish',
								finishReason: 'stop',
								usage: {
									inputTokens,
									outputTokens,
									totalTokens: inputTokens + outputTokens
								}
							} as unknown as LanguageModelV2StreamPart);
							controller.close();
							break;
						}

						buffer += decoder.decode(value, { stream: true });
						
						// Process complete SSE events
						const lines = buffer.split('\n');
						buffer = lines.pop() || ''; // Keep incomplete line in buffer
						
						for (const line of lines) {
							if (!line.startsWith('data:')) continue;
							
							const data = line.slice(5).trim();
							if (data === '[DONE]') {
								continue;
							}
							
							try {
								const parsed = JSON.parse(data);
								
								// Handle thinking delta (Claude)
								if (parsed.thinking_delta) {
									const textDeltaPart = {
										type: 'text-delta' as const,
										id: `${sessionId}-${eventIndex++}`,
										delta: `<thinking_delta>${parsed.thinking_delta}</thinking_delta>`
									};
									controller.enqueue(textDeltaPart as unknown as LanguageModelV2StreamPart);
								}
								
								// Handle content delta
								if (parsed.choices?.[0]?.delta?.content) {
									const textDeltaPart = {
										type: 'text-delta' as const,
										id: `${sessionId}-${eventIndex++}`,
										delta: parsed.choices[0].delta.content
									};
									controller.enqueue(textDeltaPart as unknown as LanguageModelV2StreamPart);
								}
								
								// Handle tool call deltas
								// Tool calls in streaming come as: { "type": "tool_use", "id": "...", "name": "...", "input": {...} }
								if (parsed.choices?.[0]?.delta?.tool_calls) {
									for (const tc of parsed.choices[0].delta.tool_calls) {
										if (tc.id && tc.function?.name) {
											const toolCallPart = {
												type: 'tool-call' as const,
												toolCallId: tc.id,
												toolName: tc.function.name,
												args: tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
											};
											controller.enqueue(toolCallPart as unknown as LanguageModelV2StreamPart);
										}
									}
								}
								
								// Handle Anthropic-style tool_use content blocks
								if (Array.isArray(parsed.choices?.[0]?.delta?.content)) {
									for (const block of parsed.choices[0].delta.content) {
										if (block.type === 'tool_use' && block.id && block.name) {
											const toolCallPart = {
												type: 'tool-call' as const,
												toolCallId: block.id,
												toolName: block.name,
												args: block.input || {}
											};
											controller.enqueue(toolCallPart as unknown as LanguageModelV2StreamPart);
										}
									}
								}
								
								// Update usage if present
								if (parsed.usage) {
									inputTokens = parsed.usage.prompt_tokens ?? inputTokens;
									outputTokens = parsed.usage.completion_tokens ?? outputTokens;
								}
								
								// Check for finish reason
								if (parsed.choices?.[0]?.finish_reason) {
									let finishReason: LanguageModelV2FinishReason = 'stop';
									const fr = parsed.choices[0].finish_reason;
									if (fr === 'length') {
										finishReason = 'length';
									} else if (fr === 'content_filter') {
										finishReason = 'content-filter';
									} else if (fr === 'tool_calls' || fr === 'tool_use') {
										finishReason = 'tool-calls';
									}
									
									controller.enqueue({
										type: 'finish',
										finishReason,
										usage: {
											inputTokens,
											outputTokens,
											totalTokens: inputTokens + outputTokens
										}
									} as unknown as LanguageModelV2StreamPart);
							}
						} catch (parseError) {
							// Skip malformed events
							if (process.env.DEBUG?.includes('snowflake:rest')) {
								console.warn(`[DEBUG snowflake:rest] Failed to parse SSE event: ${data}`);
							}
						}
						}
					}
				} catch (error) {
					controller.error(error);
				}
			}
		});

		return { stream, warnings };
	}
}

