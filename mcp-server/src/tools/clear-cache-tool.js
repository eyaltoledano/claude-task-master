/**
 * clear-cache-tool.js
 * 
 * Tool registration for the Clear Cache tool
 */

import { clearCache } from './clear-cache.js';

/**
 * Register the clear-cache tool
 * @param {Object} server - MCP server instance 
 */
export function registerClearCacheTool(server) {
  // Support both legacy and new API
  if (server.registerTool) {
    // Legacy API
    server.registerTool({
      name: 'mcp_Task_Master_clear_cache',
      description: 'Clear the Task Master cache to fix issues with stale data',
      run: clearCache,
      parameters: {
        type: 'object',
        properties: {
          projectRoot: {
            type: 'string',
            description: 'The directory of the project. Must be an absolute path.'
          },
          pattern: {
            type: 'string',
            description: 'Optional pattern to selectively clear cache entries (e.g., "nextTask:" to clear only next task cache)'
          }
        },
        required: ['projectRoot']
      }
    });
  } else if (server.tool) {
    // New FastMCP API
    server.tool('mcp_Task_Master_clear_cache')
      .description('Clear the Task Master cache to fix issues with stale data')
      .schema({
        type: 'object',
        properties: {
          projectRoot: {
            type: 'string',
            description: 'The directory of the project. Must be an absolute path.'
          },
          pattern: {
            type: 'string',
            description: 'Optional pattern to selectively clear cache entries (e.g., "nextTask:" to clear only next task cache)'
          }
        },
        required: ['projectRoot']
      })
      .handler(clearCache);
  } else {
    console.error('Unknown server API - cannot register clear-cache tool');
  }
} 