/**
 * tools/rules.js
 * Tool to add or remove rules from a project (MCP server)
 */

import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from '@tm/mcp';
import { z } from 'zod';
import { RULE_PROFILES } from '../../../src/constants/profiles.js';
import { rulesDirect } from '../core/direct-functions/rules.js';

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
				return handleApiResult({
					result,
					log,
					projectRoot: args.projectRoot
				});
			} catch (error) {
				log.error(`[rules tool] Error: ${error.message}`);
				return createErrorResponse(error.message, { details: error.stack });
			}
		})
	});
}
