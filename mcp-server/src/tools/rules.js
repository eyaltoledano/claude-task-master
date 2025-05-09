/**
 * tools/rules.js
 * Tool to add or remove brand rules from a project (MCP server)
 */

import { z } from 'zod';
import {
  createErrorResponse,
  handleApiResult,
  withNormalizedProjectRoot
} from './utils.js';
import { rulesDirect } from '../core/direct-functions/rules.js';

/**
 * Register the rules tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerRulesTool(server) {
  server.addTool({
    name: 'rules',
    description: 'Add or remove brand rules and MCP config from the project (mirrors CLI rules add/remove).',
    parameters: z.object({
      action: z.enum(['add', 'remove']).describe('Whether to add or remove brand rules.'),
      rules: z.array(z.string()).min(1).describe('List of brand rules to add or remove (e.g., ["roo", "windsurf"]).'),
      projectRoot: z.string().describe('The root directory of the project. Must be an absolute path.'),
      yes: z.boolean().optional().default(true).describe('Run non-interactively (default: true).')
    }),
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
      try {
        log.info(`[rules tool] Executing action: ${args.action} for rules: ${args.rules.join(', ')} in ${args.projectRoot}`);
        const result = await rulesDirect(args, log, { session });
        return handleApiResult(result, log);
      } catch (error) {
        log.error(`[rules tool] Error: ${error.message}`);
        return createErrorResponse(error.message, { details: error.stack });
      }
    })
  });
}
