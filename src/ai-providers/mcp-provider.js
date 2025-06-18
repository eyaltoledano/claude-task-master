import { BaseAIProvider } from './base-provider.js';

/**
 * MCP (Model Context Protocol) AI Provider
 * Integrates with MCP servers/clients for AI operations
 */
export class MCPAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'mcp';
	}

	/**
	 * MCP providers use session context instead of API keys
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// For MCP, we need session context instead of API key
		if (!params.session) {
			throw new Error('MCP provider requires session context');
		}

		// Validate that session has required MCP sampling capabilities
		// Note: We check for sampling capability since MCP providers request completions from clients
		if (!params.session.clientCapabilities || !params.session.clientCapabilities.sampling) {
			throw new Error('MCP session must have client sampling capabilities');
		}
	}

	/**
	 * Detects if we're running in an MCP context
	 * @param {object} params - Parameters to check
	 * @returns {boolean} True if MCP context is available
	 */
	static isAvailable(params = {}) {
		return !!(params.session && params.session.clientCapabilities && params.session.clientCapabilities.sampling);
	}

	/**
	 * Validates MCP-specific parameters
	 * @param {object} params - Parameters to validate
	 */
	validateParams(params) {
		// Use MCP-specific auth validation
		this.validateAuth(params);

		// Validate model ID (for MCP, this might be server/tool combination)
		if (!params.modelId) {
			throw new Error('MCP Model ID is required');
		}

		// Validate optional parameters
		this.validateOptionalParams(params);
	}

	/**
	 * Generate text using MCP sampling
	 * @param {object} params - Generation parameters
	 * @returns {Promise<object>} Generated text response
	 */
	async generateText(params) {
		console.log(`MCPAIProvider.generateText called with model: ${params.modelId}`);
		
		try {
			this.validateParams(params);

			const { session, messages, systemPrompt, temperature, maxTokens } = params;

			// Convert our message format to MCP sampling format
			const mcpMessages = messages.map(msg => ({
				role: msg.role,
				content: {
					type: 'text',
					text: msg.content
				}
			}));

			// Use MCP sampling to request completion from client
			const response = await session.requestSampling({
				messages: mcpMessages,
				systemPrompt: systemPrompt,
				temperature: temperature,
				maxTokens: maxTokens || 1000,
				includeContext: 'thisServer' // Include context from this MCP server
			},{
                timeout: 2400000 // 2 minutes timeout (in milliseconds)
            });

			// Format response to match expected structure
			return {
				text: response.content.text,
				finishReason: response.stopReason || 'completed',
				usage: {
					promptTokens: 0, // MCP doesn't provide token counts
					completionTokens: 0,
					totalTokens: 0
				},
				rawResponse: response
			};

		} catch (error) {
			console.error(`MCPAIProvider.generateText error: ${error.message}`);
			throw new Error(`MCP sampling failed: ${error.message}`);
		}
	}

	/**
	 * Generate streaming text using MCP sampling
	 * @param {object} params - Generation parameters
	 * @returns {Promise<object>} Streaming text response
	 */
	async streamText(params) {
		console.log(`MCPAIProvider.streamText called with model: ${params.modelId}`);
		
		// For now, fall back to non-streaming since MCP sampling doesn't support streaming
		// This can be enhanced later if streaming MCP sampling becomes available
		const result = await this.generateText(params);
		
		// Return a mock stream-like response
		return {
			textStream: async function* () {
				yield result.text;
			}(),
			text: result.text,
			finishReason: result.finishReason,
			usage: result.usage,
			rawResponse: result.rawResponse
		};
	}

	/**
	 * Generate structured object using MCP sampling
	 * @param {object} params - Generation parameters
	 * @returns {Promise<object>} Generated object response
	 */
	async generateObject(params) {
		console.log(`MCPAIProvider.generateObject called with model: ${params.modelId}`);
		
		try {
			this.validateParams(params);

			const { schema, messages, systemPrompt, ...otherParams } = params;

			// Create enhanced system prompt for structured output
			const structuredSystemPrompt = systemPrompt 
				? `${systemPrompt}\n\nPlease respond with valid JSON that matches this schema: ${JSON.stringify(schema)}`
				: `Please respond with valid JSON that matches this schema: ${JSON.stringify(schema)}`;

			// Use sampling for text generation with JSON instructions
			const textResult = await this.generateText({
				...otherParams,
				messages: messages,
				systemPrompt: structuredSystemPrompt
			});

			try {
				const parsedObject = JSON.parse(textResult.text);
				return {
					object: parsedObject,
					finishReason: textResult.finishReason,
					usage: textResult.usage,
					rawResponse: textResult.rawResponse
				};
			} catch (parseError) {
				throw new Error(`Failed to parse JSON response: ${parseError.message}. Response: ${textResult.text}`);
			}

		} catch (error) {
			console.error(`MCPAIProvider.generateObject error: ${error.message}`);
			throw new Error(`MCP object generation failed: ${error.message}`);
		}
	}

	/**
	 * Get available models for this provider
	 * @param {object} session - MCP session object
	 * @returns {Array} Available models
	 */
	static getAvailableModels(session) {
		if (!session || !session.clientCapabilities || !session.clientCapabilities.sampling) {
			return [];
		}

		// For MCP sampling, we return generic model options since the actual model
		// is chosen by the client during sampling
		return [
			{
				id: 'mcp-sampling',
				name: 'MCP Sampling',
				description: 'Use MCP client for text generation via sampling',
				provider: 'mcp'
			}
		];
	}
}
