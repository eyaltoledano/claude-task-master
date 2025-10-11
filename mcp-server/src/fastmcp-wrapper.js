import { FastMCP as OriginalFastMCP } from 'fastmcp';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Custom FastMCP wrapper that ensures JSON Schema compatibility with MCP clients
 * by forcing the use of JSON Schema Draft 7 for all Zod schema conversions
 */
export class FastMCP extends OriginalFastMCP {
  constructor(options) {
    super(options);
    
    // Override the internal method that handles tool schema conversion
    const originalSetupToolHandlers = this._setupToolHandlers || function() {};
    this._setupToolHandlers = (tools) => {
      // Modify each tool to ensure proper JSON Schema conversion
      const modifiedTools = tools.map(tool => {
        if (tool.parameters && typeof tool.parameters === 'object' && '_def' in tool.parameters) {
          // Create a wrapper for the tool with modified schema generation
          return {
            ...tool,
            _originalParameters: tool.parameters,
            get inputSchema() {
              // Generate schema with explicit Draft 7 target
              return zodToJsonSchema(this._originalParameters, { target: 'jsonSchema7' });
            }
          };
        }
        return tool;
      });
      
      return originalSetupToolHandlers.call(this, modifiedTools);
    };
  }
}