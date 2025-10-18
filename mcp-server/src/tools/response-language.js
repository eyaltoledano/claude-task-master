// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { responseLanguageDirect } from '../core/direct-functions/response-language.js';

export function registerResponseLanguageTool(server) {
	server.addTool({
		name: 'response-language',
		description: 'Get or set the response language for the project',
		parameters: z.object({
			projectRoot: z
				.string()
				.describe(
					'The root directory for the project. ALWAYS SET THIS TO THE PROJECT ROOT DIRECTORY. IF NOT SET, THE TOOL WILL NOT WORK.'
				),
			language: z
				.string()
				.describe(
					'The new response language to set. like "中文" "English" or "español".'
				)
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(
					`Executing response-language tool with args: ${JSON.stringify(args)}`
				);

				const result = await responseLanguageDirect(
					{
						...args,
						projectRoot: args.projectRoot
					},
					log,
					{ session }
				);
				return handleApiResult(result, log, 'Error setting response language');
			} catch (error) {
				log.error(`Error in response-language tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
