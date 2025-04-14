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
			"Initializes a new Task Master project structure by calling the core initialization logic. Derives target directory from client session. If project details (name, description, author) are not provided, prompts the user or skips if 'yes' flag is true. DO NOT run without parameters.",
		parameters: z.object({
			projectName: z
				.string()
				.optional()
				.describe(
					'The name for the new project. If not provided, prompt the user for it.'
				),
			projectDescription: z
				.string()
				.optional()
				.describe(
					'A brief description for the project. If not provided, prompt the user for it.'
				),
			projectVersion: z
				.string()
				.optional()
				.describe(
					"The initial version for the project (e.g., '0.1.0'). User input not needed unless user requests to override."
				),
			authorName: z
				.string()
				.optional()
				.describe(
					"The author's name. User input not needed unless user requests to override."
				),
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
				.describe(
					'Add shell aliases (tm, taskmaster) to shell config file. User input not needed.'
				),
			yes: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					"Skip prompts and use default values or provided arguments. Use true if you wish to skip details like the project name, etc. If the project information required for the initialization is not available or provided by the user, prompt if the user wishes to provide them (name, description, author) or skip them. If the user wishes to skip, set the 'yes' flag to true and do not set any other parameters."
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
