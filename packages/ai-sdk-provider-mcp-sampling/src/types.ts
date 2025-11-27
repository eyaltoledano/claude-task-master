/**
 * Type definitions for MCP Sampling provider
 */

export interface MCPSamplingLanguageModelOptions {
	/** MCP model identifier */
	id: string;
	/** Provider-specific settings */
	settings?: MCPSamplingSettings;
}

export interface MCPSamplingSettings {
	/** Temperature setting (0-1) */
	temperature?: number;
	/** Maximum tokens to generate */
	maxTokens?: number;
	/** API timeout in milliseconds */
	timeout?: number;
}

export type MCPSamplingModelId = string;

export interface MCPSession {
	clientCapabilities?: {
		sampling?: boolean;
	};
	requestSampling(
		request: {
			messages: Array<{
				role: 'user' | 'assistant' | 'system';
				content: string;
			}>;
			systemPrompt?: string;
			temperature?: number;
			maxTokens?: number;
			includeContext?: 'none' | 'thisServer' | 'allServers';
		},
		options?: {
			timeout?: number;
		}
	): Promise<{
		content: {
			type: 'text';
			text: string;
		}[];
		usage?: {
			inputTokens?: number;
			outputTokens?: number;
		};
		stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
	}>;
}

export interface MCPSamplingResponse {
	text: string;
	finishReason?: string;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
	};
	warnings?: string[];
}