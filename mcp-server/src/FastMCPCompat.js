/**
 * @fileoverview JSON Schema Draft-07 compatibility patch
 * 
 * This patches the zod-to-json-schema module to default to JSON Schema Draft-7
 * instead of Draft 2020-12 for better MCP client compatibility.
 * 
 * The patch works by overriding the zodToJsonSchema function's default behavior.
 */

import * as zodToJsonSchemaModule from 'zod-to-json-schema';

// Store original function
const originalZodToJsonSchema = zodToJsonSchemaModule.zodToJsonSchema;

/**
 * Patched zodToJsonSchema function that defaults to Draft-07
 */
function patchedZodToJsonSchema(schema, options = {}) {
	// Force JSON Schema Draft-07 for MCP compatibility
	const draft7Options = {
		...options,
		target: 'jsonSchema7',
		$refStrategy: options.$refStrategy || 'relative'
	};
	
	return originalZodToJsonSchema(schema, draft7Options);
}

// Apply the patch by overriding the module's export
zodToJsonSchemaModule.zodToJsonSchema = patchedZodToJsonSchema;

// Export the patched FastMCP (just re-export regular FastMCP since we've patched at module level)
export { FastMCP } from 'fastmcp';