/**
 * MCP Remote Provider - Provider implementation for MCP server
 * 
 * This provider uses the MCP server's session to make AI requests,
 * allowing the Task Master MCP server to be used as an AI provider.
 */

import { BaseAIProvider } from '../../../src/ai-providers/base-provider.js';
import { zodToJsonSchema } from "zod-to-json-schema";
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

    isRequiredApiKey() {
		return false;
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
        if (!this.session) {
            throw new Error('MCP provider requires session context');
        }
        
        // Validate that session has required MCP sampling capabilities
        if (!this.session.clientCapabilities || !this.session.clientCapabilities.sampling) {
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


    async requestSampling(messages, systemPrompt, temperature, maxTokens) {
        const mcpMessages = messages.map(msg => ({
            role: msg.role,
            content: {
                type: 'text',
                text: msg.content
            }
        }));

        // Use MCP sampling to request completion from client
        const response = await this.session.requestSampling({
            messages: mcpMessages,
            systemPrompt: systemPrompt,
            temperature: temperature,
            maxTokens: maxTokens || 1000,
            includeContext: 'thisServer' // Include context from this MCP server
        }, {
            timeout: 2400000 // 2 minutes timeout (in milliseconds)
        });
        return response;
    }
    
    /**
     * Generate text using the MCP server session
     * @param {object} params - Generation parameters
     * @returns {Promise<string>} The generated text
     */
    async generateText(params) {
        try {
			this.validateParams(params);
            const modelId = params.modelId || this.options.defaultModel;
            logger.debug(`Generating text with MCP Remote Provider using model: ${modelId}`);
			const { messages, systemPrompt, temperature, maxTokens } = params;

			// Convert our message format to MCP sampling format
			const response = await this.requestSampling(messages, systemPrompt, temperature, maxTokens);

			// Format response to match expected structure
			return {
				text: response.content.text,
				finishReason: response.stopReason || 'completed',
				usage: {
					inputTokens: 0, // MCP doesn't provide token counts
					outputTokens: 0,
					totalTokens: 0
				},
				rawResponse: response
			};

		} catch (error) {
            this.handleError('text generation', error);
		}
    }

    /**
     * Stream text using the MCP server session
     * @param {object} params - Generation parameters
     * @returns {AsyncIterable<object>} Stream of generated text chunks
     */
    async *streamText(params) {
        this.handleError('streaming text', new Error('MCP Remote Provider does not support streaming text, use generateText instead'));
    }
    
    /**
     * Generate JSON object using the MCP server session
     * @param {object} params - Generation parameters
     * @returns {Promise<object>} The generated object
     */
    async generateObject(params) {
        try {
			this.validateParams(params);

			if (!params.schema) {
				throw new Error('Schema is required for object generation');
			}
			if (!params.objectName) {
				throw new Error('Object name is required for object generation');
			}

			logger.debug(
				`Generating ${this.name} object ('${params.objectName}') with model: ${params.modelId}`
			);

            const modelId = params.modelId || this.options.defaultModel;

            const systemPrompt = params.messages[0]?.content || '';
            const schema = zodToJsonSchema(params.schema, params.objectName);
            
            const updatedMessages = [
                {
                    role: 'system',
                    content: `${systemPrompt}\n\nIMPORTANT: Your response MUST be valid JSON that matches this
                                structure: ${JSON.stringify(schema)}\n\nRespond ONLY with the JSON object, no explanation, no markdown,
                                just the raw JSON.`
                },
                ...params.messages.slice(1)
            ];

            const response = await this.requestSampling(
                updatedMessages,
                systemPrompt,
                params.temperature || 0.7,
                params.maxTokens || 1000
            );
            
            const object = JSON.parse(response.content.text);
            logger.debug(
				`${this.name} generateText completed successfully for model: ${params.modelId}`
			);

			return {
				object,
				usage: {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0
				},
				rawResponse: response
			};
            
        } catch (error) {
			this.handleError('object generation', error);
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
            hasSession: !!this.session
        })}`);
        
        // Validate messages
        if (!params.messages || !Array.isArray(params.messages) || params.messages.length === 0) {
            throw new Error('Messages array is required and must not be empty');
        }
    }

    /**
	 * Get client instance (not applicable for MCP)
	 *
	 * This method is required by the BaseAIProvider interface but is not
	 * applicable for the MCP provider since it uses MCP sampling
	 * execution rather than an API client.
	 *
	 * @returns {null} Always returns null as no client instance is needed
	 * @override
	 *
	 * @description
	 * The MCP provider executes commands directly via MCP sampling
	 * rather than maintaining a persistent client connection. This method
	 * exists only for interface compatibility with other AI providers.
	 */
	getClient() {
		return null;
	}
}

export default MCPRemoteProvider;
