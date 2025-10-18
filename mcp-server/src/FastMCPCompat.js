/**
 * @fileoverview FastMCP Draft-07 Compatibility Patch
 *
 * PROBLEM:
 * - FastMCP uses Zod v3 + zod-to-json-schema → outputs JSON Schema Draft 2020-12
 * - MCP clients (e.g., Augment IDE) only support Draft-07
 * - This causes "MCP server startup error" in incompatible clients
 *
 * SOLUTION:
 * Pre-convert Zod v4 schemas to Draft-07 using native toJSONSchema() before
 * passing to FastMCP, preventing it from doing its own conversion.
 *
 * TEMPORARY PATCH:
 * This will be removed once FastMCP, MCP spec, or Zod addresses the compatibility issue.
 * Tracking: https://github.com/punkpeye/fastmcp/issues/189
 */

import { FastMCP as OriginalFastMCP } from 'fastmcp';
import { toJSONSchema, ZodType } from 'zod';

/**
 * FastMCP wrapper that converts Zod schemas to JSON Schema Draft-07
 */
export class FastMCP extends OriginalFastMCP {
	addTool(tool) {
		// Pre-convert Zod schemas to Draft-07 before passing to FastMCP
		if (tool.parameters instanceof ZodType) {
			try {
				const modifiedTool = {
					...tool,
					parameters: toJSONSchema(tool.parameters, { target: 'draft-7' })
				};
				return super.addTool(modifiedTool);
			} catch (error) {
				console.error(
					`[FastMCPCompat] Failed to convert schema for tool "${tool.name}":`,
					error
				);
			}
		}

		// Pass through as-is for non-Zod schemas or conversion failures
		return super.addTool(tool);
	}
}
