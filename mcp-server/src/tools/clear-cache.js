/**
 * clear-cache.js
 * 
 * MCP tool for clearing Task Master cache
 */

import { clearCacheDirect } from '../core/direct-functions/clear-cache.js';
import { executeMCPToolAction } from './utils.js';

/**
 * Clears the Task Master cache
 * 
 * @param {Object} context - The MCP context
 * @param {Object} params - The parameters for the command
 * @param {string} [params.pattern] - Optional pattern to match against cache keys for selective clearing
 * @returns {Promise<Object>} - Result of the operation
 */
export async function clearCache(context, params) {
  const { log } = context;
  
  log.info(`Clearing Task Master cache with params: ${JSON.stringify(params)}`);
  
  // Process the args
  const args = {
    pattern: params.pattern || undefined
  };
  
  return executeMCPToolAction({
    actionFn: clearCacheDirect,
    args,
    log,
    actionName: 'clear-cache'
  });
}

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