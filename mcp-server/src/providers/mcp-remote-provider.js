/**
 * MCP Remote Provider - Provider implementation for MCP server
 * 
 * This provider uses the MCP server's session to make AI requests,
 * allowing the Task Master MCP server to be used as an AI provider.
 */

import { BaseAIProvider } from '../../../src/ai-providers/base-provider.js';
import logger from '../logger.js';

/**
 * MCP Remote Provider class - Uses MCP server session for AI operations
 */
export class MCPRemoteProvider extends BaseAIProvider {
    static name = "mcp";
    /**
     * Create a new MCP Remote Provider
     * @param {object} server - The FastMCP server instance
     * @param {object} options - Provider options
     */
    constructor(server, options = {}) {
        super();
        
        this.name = 'mcp';
        this.server = server;
        this.options = options;
        
        // Get the first session from the server if available
        this.session = server?.sessions?.[0] || null;
        
        logger.debug('MCP Remote Provider created');
    }

    /**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the MCP API key
	 */
	getRequiredApiKeyName() {
		return 'MCP_API_KEY';
	}
    
    /**
     * Validate that the provider has necessary auth/session
     * @param {object} params - Parameters to validate
     */
    validateAuth(params) {
        // For MCP remote, we need either:
        // 1. A valid server session from construction
        // 2. A session provided in params
        // 3. A session provided in context object
        const session = this.session || params.session || (params.context?.session);
        
        if (!session) {
            throw new Error('MCP provider requires session context');
        }
        
        // Validate that session has required MCP sampling capabilities
        if (!session.clientCapabilities || !session.clientCapabilities.sampling) {
            throw new Error('MCP session must have client sampling capabilities');
        }
    }
    
    /**
     * Update the provider's session
     * @param {object} session - The new session
     */
    setSession(session) {
        if (!session) {
            logger.warn('Attempted to set null session on MCP Remote Provider');
            return;
        }
        
        this.session = session;
        logger.debug('Updated MCP Remote Provider session');
    }
    
    /**
     * Generate text using the MCP server session
     * @param {object} params - Generation parameters
     * @returns {Promise<string>} The generated text
     */
    async generateText(params) {
        this.validateParams(params);
        
        // Get session from either instance, params, or context
        const session = this.session || params.session || (params.context?.session);
        const modelId = params.modelId || this.options.defaultModel;
        
        logger.debug(`Generating text with MCP Remote Provider using model: ${modelId}`);
        
        try {
			this.validateParams(params);

			const { messages, systemPrompt, temperature, maxTokens } = params;

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
            logger.error(`MCP Remote Provider generateText error: ${error.message}`);
			throw new Error(`MCP sampling failed: ${error.message}`);
		}
    }
    
    /**
     * Stream text using the MCP server session
     * @param {object} params - Generation parameters
     * @returns {AsyncIterable<object>} Stream of generated text chunks
     */
    async *streamText(params) {
        this.validateParams(params);
        
        const session = this.session || params.session || (params.context?.session);
        const modelId = params.modelId || this.options.defaultModel;
        
        logger.debug(`Streaming text with MCP Remote Provider using model: ${modelId}`);
        
        try {
            // Use the session's requestSamplingStream method to stream text
            const stream = await session.requestSamplingStream({
                model: modelId,
                messages: params.messages,
                temperature: params.temperature || 0.7,
                maxTokens: params.maxTokens || 1000,
                stopSequences: params.stopSequences,
                topP: params.topP,
                topK: params.topK
            });
            
            for await (const chunk of stream) {
                yield {
                    text: chunk.text,
                    done: chunk.done
                };
            }
        } catch (error) {
            logger.error(`MCP Remote Provider streamText error: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Generate JSON object using the MCP server session
     * @param {object} params - Generation parameters
     * @returns {Promise<object>} The generated object
     */
    async generateObject(params) {
        this.validateParams(params);
        
        const session = this.session || params.session || (params.context?.session);
        const modelId = params.modelId || this.options.defaultModel;
        
        logger.debug(`Generating object with MCP Remote Provider using model: ${modelId}`);
        
        try {
            // Use the session's requestJsonSampling method if available, otherwise parse from text
            if (session.requestJsonSampling) {
                return await session.requestJsonSampling({
                    model: modelId,
                    messages: params.messages,
                    temperature: params.temperature || 0.7,
                    maxTokens: params.maxTokens || 1000,
                    stopSequences: params.stopSequences,
                    topP: params.topP,
                    topK: params.topK,
                    schema: params.jsonSchema
                });
            }
            
            // Fallback to parsing JSON from text if requestJsonSampling isn't available
            const systemPrompt = params.messages[0]?.content || '';
            const updatedMessages = [
                {
                    role: 'system',
                    content: `${systemPrompt}\nYou must respond with valid JSON only. No explanation, no markup.`
                },
                ...params.messages.slice(1)
            ];
            
            const result = await session.requestSampling({
                model: modelId,
                messages: updatedMessages,
                temperature: params.temperature || 0.7,
                maxTokens: params.maxTokens || 1000,
                stopSequences: params.stopSequences,
                topP: params.topP,
                topK: params.topK
            });
            
            try {
                return JSON.parse(result.text);
            } catch (parseError) {
                logger.error(`Failed to parse JSON from MCP response: ${parseError.message}`);
                throw new Error(`Invalid JSON response: ${parseError.message}`);
            }
        } catch (error) {
            logger.error(`MCP Remote Provider generateObject error: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Validate provider-specific parameters
     * @param {object} params - Parameters to validate
     */
    validateParams(params) {
        // Use MCP-specific auth validation
        this.validateAuth(params);
        
        // Validate model ID 
        if (!params.modelId && !this.options.defaultModel) {
            throw new Error('Model ID is required for MCP Remote Provider');
        }
        
        // Debug log params to check what's coming in
        logger.debug(`Validating MCP params: ${JSON.stringify({
            hasMessages: !!params.messages,
            isArray: params.messages ? Array.isArray(params.messages) : false,
            length: params.messages ? params.messages.length : 0,
            hasSession: !!this.session || !!params.session || !!(params.context?.session)
        })}`);
        
        // Validate messages
        if (!params.messages || !Array.isArray(params.messages) || params.messages.length === 0) {
            throw new Error('Messages array is required and must not be empty');
        }
    }
}

export default MCPRemoteProvider;
