/**
 * @tm/ai-tools - AI SDK tools for Task Master
 *
 * This package provides AI SDK integrations for various MCP servers and tools.
 *
 * @example
 * ```typescript
 * // Import Context7 tools directly
 * import { createContext7Tools } from '@tm/ai-tools/context7';
 *
 * // Or use the MCP tools manager for auto-detection
 * import { createMCPTools } from '@tm/ai-tools';
 * ```
 */

// MCP Tools Manager - auto-detects and combines available MCP tools
export {
	createMCPTools,
	getAvailableMCPTools,
	type MCPToolsManagerConfig,
	type MCPToolsResult
} from './mcp-tools-manager.js';

// Re-export context7 module for convenience
export * from './context7/index.js';
