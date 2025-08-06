/**
 * MCP Client Wrapper
 * Handles MCP tool calls with retry logic
 */

import type { ExtensionLogger } from '../logger';
import type { MCPClientManager } from '../mcpClient';

export class MCPClient {
	constructor(
		private mcpClient: MCPClientManager,
		private logger: ExtensionLogger,
		private config: { timeout: number; retryAttempts: number }
	) {}

	/**
	 * Call MCP tool with retry logic
	 */
	async callTool(
		toolName: string,
		args: Record<string, unknown>
	): Promise<any> {
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
			try {
				const rawResponse = await this.mcpClient.callTool(toolName, args);
				this.logger.debug(
					`Raw MCP response for ${toolName}:`,
					JSON.stringify(rawResponse, null, 2)
				);

				// Parse MCP response format
				if (
					rawResponse &&
					rawResponse.content &&
					Array.isArray(rawResponse.content) &&
					rawResponse.content[0]
				) {
					const contentItem = rawResponse.content[0];
					if (contentItem.type === 'text' && contentItem.text) {
						try {
							const parsedData = JSON.parse(contentItem.text);
							this.logger.debug(`Parsed MCP data for ${toolName}:`, parsedData);
							return parsedData;
						} catch (parseError) {
							this.logger.error(
								`Failed to parse MCP response text for ${toolName}:`,
								parseError
							);
							this.logger.error(`Raw text was:`, contentItem.text);
							return rawResponse; // Fall back to original response
						}
					}
				}

				// If not in expected format, return as-is
				this.logger.warn(
					`Unexpected MCP response format for ${toolName}, returning raw response`
				);
				return rawResponse;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('Unknown error');
				this.logger.warn(
					`Attempt ${attempt}/${this.config.retryAttempts} failed for ${toolName}:`,
					lastError.message
				);

				if (attempt < this.config.retryAttempts) {
					// Exponential backoff
					const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw (
			lastError ||
			new Error(
				`Failed to call ${toolName} after ${this.config.retryAttempts} attempts`
			)
		);
	}

	/**
	 * Get connection status
	 */
	getStatus(): { isRunning: boolean; error?: string } {
		return this.mcpClient.getStatus();
	}

	/**
	 * Test connection
	 */
	async testConnection(): Promise<boolean> {
		return this.mcpClient.testConnection();
	}
}
