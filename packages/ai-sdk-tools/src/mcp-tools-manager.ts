import {
	createContext7Tools,
	isContext7Available,
	type Context7Config
} from './context7/index.js';

/**
 * Configuration for MCP tools manager
 */
export interface MCPToolsManagerConfig {
	/**
	 * Enable Context7 tools for documentation lookup
	 */
	context7?: Context7Config | boolean;
}

/**
 * Result from getting MCP tools
 */
export interface MCPToolsResult {
	/**
	 * Combined tools from all enabled MCP servers
	 */
	tools: Record<string, unknown>;

	/**
	 * Close all MCP client connections. Should be called when done.
	 */
	close: () => Promise<void>;

	/**
	 * List of enabled MCP tool sources
	 */
	enabledSources: string[];
}

/**
 * Creates and manages MCP tools from multiple sources.
 *
 * This utility automatically detects available MCP tools based on
 * environment variables and configuration.
 *
 * @example
 * ```typescript
 * import { createMCPTools } from '@tm/ai-tools';
 * import { generateText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 *
 * // Auto-detect available tools from environment
 * const { tools, close, enabledSources } = await createMCPTools();
 *
 * console.log('Enabled MCP tools:', enabledSources);
 *
 * try {
 *   const result = await generateText({
 *     model: openai('gpt-4o'),
 *     tools,
 *     prompt: 'How do I use React Query?',
 *   });
 *   console.log(result.text);
 * } finally {
 *   await close();
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With explicit configuration
 * const { tools, close } = await createMCPTools({
 *   context7: { apiKey: 'my-api-key' },
 * });
 * ```
 */
export async function createMCPTools(
	config?: MCPToolsManagerConfig
): Promise<MCPToolsResult> {
	const tools: Record<string, unknown> = {};
	const closeFunctions: (() => Promise<void>)[] = [];
	const enabledSources: string[] = [];

	// Context7 tools
	const context7Config =
		config?.context7 === true
			? {}
			: config?.context7 === false
				? undefined
				: config?.context7;

	// Only create Context7 tools if explicitly enabled or auto-detect available
	const shouldEnableContext7 =
		config?.context7 !== false &&
		(config?.context7 !== undefined || isContext7Available(context7Config));

	if (shouldEnableContext7 && isContext7Available(context7Config)) {
		try {
			const context7 = await createContext7Tools({ config: context7Config });
			Object.assign(tools, context7.tools);
			closeFunctions.push(context7.close);
			enabledSources.push('context7');
		} catch (error) {
			// Log but don't fail if Context7 connection fails
			console.warn('Failed to connect to Context7 MCP server:', error);
		}
	}

	return {
		tools,
		enabledSources,
		close: async () => {
			await Promise.all(closeFunctions.map((fn) => fn()));
		}
	};
}

/**
 * Check which MCP tools are available based on environment
 */
export function getAvailableMCPTools(): string[] {
	const available: string[] = [];

	if (isContext7Available()) {
		available.push('context7');
	}

	return available;
}
