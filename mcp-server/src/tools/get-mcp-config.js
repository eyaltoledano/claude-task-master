/**
 * tools/get-mcp-config.js
 * Tool to retrieve non-sensitive configuration values from the MCP server environment.
 */

import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import {
	handleApiResult,
	createErrorResponse,
	createContentResponse,
} from './utils.js';

// Define the specific configuration keys that are safe to expose
const ALLOWED_CONFIG_KEYS = [
    'TASK_PROVIDER',             // Added
    'JIRA_MCP_TOOL_PREFIX',      // Added
    'JIRA_URL',                  // Added
    'JIRA_USER',                 // Added
    'JIRA_PROJECT_KEY',          // Existing
    'DEFAULT_ASSIGNEE',          // Existing
    'JIRA_SUBTASK_TYPE_NAME',    // Renamed/Added
    'JIRA_EPIC_LINK_FIELD_ID',   // Added
    'JIRA_EPIC_NAME_FIELD_ID',   // Added
    'ATTACHMENT_DIR',            // Added
    'MODEL',                     // Existing
    'PERPLEXITY_MODEL',        // Existing
    'MAX_TOKENS',                // Existing
    'TEMPERATURE',               // Existing
    'DEFAULT_SUBTASKS',          // Existing
    'DEFAULT_PRIORITY',          // Existing
    'PROJECT_NAME',              // Existing
    'DEBUG',                     // Existing
    'LOG_LEVEL',                 // Existing
    // Explicitly EXCLUDE sensitive keys like API keys, paths etc.
];

/**
 * Register the get_mcp_config tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerGetMcpConfigTool(server) {
	server.addTool({
		name: 'get_mcp_config',
		description:
			'Retrieves relevant, non-sensitive configuration values from the MCP server environment.',
		parameters: z.object({}).describe('No parameters needed.'), // No input parameters
		execute: async (args, { log, session }) => {
			try {
				log.info('Executing get_mcp_config tool');

				const config = {};

                // Extract allowed environment variables
                for (const key of ALLOWED_CONFIG_KEYS) {
                    if (process.env[key] !== undefined) {
                        config[key] = process.env[key];
                    }
                }

				return createContentResponse(config);

			} catch (error) {
                // Reverting the defensive check, original log call below
                log.error(`Error in get_mcp_config tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
