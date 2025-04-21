import { z } from 'zod';
import {
	createContentResponse,
	createErrorResponse,
	handleApiResult
} from './utils.js';
import { initializeProjectDirect } from '../core/task-master-core.js';

export function registerInitializeProjectTool(server) {
	server.addTool({
		name: 'initialize_project',
		description:
			'Initializes a new Task Master project structure by calling the core initialization logic. Creates necessary folders and configuration files for Task Master in the current directory.',
		parameters: z.object({
			skipInstall: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					'Skip installing dependencies automatically. Never do this unless you are sure the project is already installed.'
				),
			addAliases: z
				.boolean()
				.optional()
				.default(false)
				.describe('Add shell aliases (tm, taskmaster) to shell config file.'),
			yes: z
				.boolean()
				.optional()
				.default(true)
				.describe(
					'Skip prompts and use default values. Always set to true for MCP tools.'
				),
			projectRoot: z
				.string()
				.describe(
					'The root directory for the project. ALWAYS SET THIS TO THE PROJECT ROOT DIRECTORY. IF NOT SET, THE TOOL WILL NOT WORK.'
				)
		}),
		execute: async (args, context) => {
			const { log } = context;
			const session = context.session;

			log.info(
				'>>> Full Context Received by Tool:',
				JSON.stringify(context, null, 2)
			);
			log.info(`Context received in tool function: ${context}`);
			log.info(
				`Session received in tool function: ${session ? session : 'undefined'}`
			);

			try {
				log.info(
					`Executing initialize_project tool with args: ${JSON.stringify(args)}`
				);

				const result = await initializeProjectDirect(args, log, { session });

				return handleApiResult(result, log, 'Initialization failed');
			} catch (error) {
				const errorMessage = `Project initialization tool failed: ${error.message || 'Unknown error'}`;
				log.error(errorMessage, error);
				return createErrorResponse(errorMessage, { details: error.stack });
			}
		}
	});
}
