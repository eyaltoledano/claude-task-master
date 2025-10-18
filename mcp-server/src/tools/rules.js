/**
 * tools/rules.js
 * Tool to add or remove rules from a project (MCP server)
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { rulesDirect } from '../core/direct-functions/rules.js';
import { RULE_PROFILES } from '../../../src/constants/profiles.js';

/**
 * Register the rules tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerRulesTool(server) {
	server.addTool({
		name: 'rules',
		description: 'Add or remove rule profiles from the project.',
		parameters: z.object({
			action: z
				.enum(['add', 'remove'])
				.describe('Whether to add or remove rule profiles.'),
			profiles: z
				.array(z.enum(RULE_PROFILES))
				.min(1)
				.describe(
					`List of rule profiles to add or remove (e.g., [\"cursor\", \"roo\"]). Available options: ${RULE_PROFILES.join(', ')}`
				),
			projectRoot: z
				.string()
				.describe(
					'The root directory of the project. Must be an absolute path.'
				),
			force: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					'DANGEROUS: Force removal even if it would leave no rule profiles. Only use if you are absolutely certain.'
				)
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(
					`[rules tool] Executing action: ${args.action} for profiles: ${args.profiles.join(', ')} in ${args.projectRoot}`
				);
				const result = await rulesDirect(args, log, { session });
				return handleApiResult(result, log);
			} catch (error) {
				log.error(`[rules tool] Error: ${error.message}`);
				return createErrorResponse(error.message, { details: error.stack });
			}
		})
	});
}
