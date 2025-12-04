/**
 * MCP Bridge - Optional MCP Server Integration
 * 
 * Provides a bridge to connect to MCP (Model Context Protocol) servers
 * for extended tool capabilities beyond the built-in tools.
 * 
 * This is optional and requires the @ai-sdk/mcp package.
 */

import type { CortexToolSpec } from './types.js';

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
	/** Server name for identification */
	name: string;
	/** Transport type */
	transport: 'stdio' | 'http';
	/** For stdio: command to run */
	command?: string;
	/** For stdio: command arguments */
	args?: string[];
	/** For http: server URL */
	url?: string;
	/** Environment variables for stdio transport */
	env?: Record<string, string>;
}

/**
 * MCP tool information
 */
export interface McpTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

/**
 * MCP client interface (matches @ai-sdk/mcp structure)
 */
export interface McpClient {
	tools: Record<string, unknown>;
	close: () => Promise<void>;
}

/**
 * Check if MCP support is available
 */
export async function isMcpAvailable(): Promise<boolean> {
	try {
		// Dynamic import to check if the package exists
		// @ts-expect-error - @ai-sdk/mcp is an optional dependency
		await import('@ai-sdk/mcp');
		return true;
	} catch {
		return false;
	}
}

/**
 * Create MCP tools from a server configuration
 * 
 * @param config - MCP server configuration
 * @returns Object containing AI SDK compatible tools
 */
export async function createMcpTools(config: McpServerConfig): Promise<Record<string, unknown>> {
	try {
		// Dynamic import - this package is optional
		// @ts-expect-error - @ai-sdk/mcp is an optional dependency
		const mcpModule = await import('@ai-sdk/mcp');
		const createMcpClient = mcpModule.experimental_createMCPClient;
		
		if (!createMcpClient) {
			console.warn('MCP client creator not found in @ai-sdk/mcp');
			return {};
		}
		
		let client: McpClient;
		
		if (config.transport === 'stdio' && config.command) {
			client = await createMcpClient({
				transport: {
					type: 'stdio',
					command: config.command,
					args: config.args || [],
					env: config.env
				}
			}) as McpClient;
		} else if (config.transport === 'http' && config.url) {
			client = await createMcpClient({
				transport: {
					type: 'sse',
					url: config.url
				}
			}) as McpClient;
		} else {
			throw new Error(`Invalid MCP transport configuration for ${config.name}`);
		}
		
		return client.tools;
	} catch (error) {
		console.warn(`Failed to create MCP client for ${config.name}:`, error);
		return {};
	}
}

/**
 * Convert MCP tools to Cortex REST API format
 */
export function convertMcpToolsToCortexFormat(mcpTools: Record<string, McpTool>): CortexToolSpec[] {
	return Object.entries(mcpTools).map(([name, tool]) => ({
		tool_spec: {
			type: 'generic' as const,
			name,
			description: tool.description || `MCP tool: ${name}`,
			input_schema: tool.inputSchema || { type: 'object', properties: {} }
		}
	}));
}

/**
 * Create Snowflake MCP client if configured
 */
export async function createSnowflakeMcpTools(
	accountIdentifier: string,
	accessToken: string
): Promise<Record<string, unknown>> {
	const mcpAvailable = await isMcpAvailable();
	if (!mcpAvailable) {
		return {};
	}
	
	const mcpUrl = `https://${accountIdentifier}.snowflakecomputing.com/api/v2/cortex/mcp`;
	
	try {
		// @ts-expect-error - @ai-sdk/mcp is an optional dependency
		const mcpModule = await import('@ai-sdk/mcp');
		const createMcpClient = mcpModule.experimental_createMCPClient;
		
		if (!createMcpClient) {
			return {};
		}
		
		const client = await createMcpClient({
			transport: {
				type: 'sse',
				url: mcpUrl,
				headers: {
					'Authorization': `Bearer ${accessToken}`
				}
			}
		}) as McpClient;
		
		return client.tools;
	} catch (error) {
		console.warn('Snowflake MCP server not available:', error);
		return {};
	}
}

export default {
	isMcpAvailable,
	createMcpTools,
	convertMcpToolsToCortexFormat,
	createSnowflakeMcpTools
};
