/**
 * models.js
 * MCP tool for managing AI model configurations
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { modelsDirect } from '../core/task-master-core.js';

/**
 * Register the models tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerModelsTool(server) {
	server.addTool({
		name: 'models',
		description:
			'Get information about available AI models or set model configurations. Run without arguments to get the current model configuration and API key status for the selected model providers.',
		parameters: z.object({
			setMain: z
				.string()
				.optional()
				.describe(
					'Set the primary model for task generation/updates. Model provider API key is required in the MCP config ENV.'
				),
			setResearch: z
				.string()
				.optional()
				.describe(
					'Set the model for research-backed operations. Model provider API key is required in the MCP config ENV.'
				),
			setFallback: z
				.string()
				.optional()
				.describe(
					'Set the model to use if the primary fails. Model provider API key is required in the MCP config ENV.'
				),
			listAvailableModels: z
				.boolean()
				.optional()
				.describe(
					'List all available models not currently in use. Input/output costs values are in dollars (3 is $3.00).'
				),
			projectRoot: z
				.string()
				.optional()
				.describe('The directory of the project. Must be an absolute path.'),
			openrouter: z
				.boolean()
				.optional()
				.describe('Indicates the set model ID is a custom OpenRouter model.'),
			ollama: z
				.boolean()
				.optional()
				.describe('Indicates the set model ID is a custom Ollama model.')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Starting models tool with args: ${JSON.stringify(args)}`);

				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
				const result = await modelsDirect(
					{ ...args, projectRoot: args.projectRoot },
					log,
					{ session }
				);

				return handleApiResult(result, log);
			} catch (error) {
				log.error(`Error in models tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
