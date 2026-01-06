/**
 * Configuration options for the Context7 MCP client
 */
export interface Context7Config {
	/**
	 * The Context7 API key. If not provided, will attempt to read from
	 * CONTEXT7_API_KEY environment variable.
	 */
	apiKey?: string;
}

/**
 * Options for creating Context7 tools
 */
export interface Context7ToolsOptions {
	/**
	 * Configuration for the Context7 client
	 */
	config?: Context7Config;

	/**
	 * Callback when the client is ready
	 */
	onReady?: () => void;

	/**
	 * Callback when an error occurs
	 */
	onError?: (error: Error) => void;
}

/**
 * Result from creating Context7 tools
 */
export interface Context7ToolsResult {
	/**
	 * The tools object that can be passed to AI SDK's generateText/streamText
	 */
	tools: Record<string, unknown>;

	/**
	 * Close the MCP client connection. Should be called when done using the tools.
	 */
	close: () => Promise<void>;
}
