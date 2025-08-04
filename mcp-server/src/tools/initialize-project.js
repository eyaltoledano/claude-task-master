import { z } from 'zod';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { initializeProjectDirect } from '../core/task-master-core.js';
import { RULE_PROFILES } from '../../../src/constants/profiles.js';
import { getRulesProfile } from '../../../src/utils/rule-transformer.js';

/**
 * Attempt to get profile selection from user via available MCP capabilities
 * @param {Object} context - FastMCP context object
 * @param {Object} log - Logger object
 * @returns {Promise<string[]>} Array of selected profile keys
 */
async function attemptProfileSelection(context, log) {
	try {
		// Check what's actually available in the context
		if (context.elicit && typeof context.elicit === 'function') {
			log.info('Found context.elicit method, attempting profile selection...');

			// Build available profiles list for display
			const availableProfiles = RULE_PROFILES.map((profileKey) => {
				const profile = getRulesProfile(profileKey);
				return `${profileKey} (${profile?.displayName || profileKey})`;
			}).join(', ');

			const prompt = `Task Master can configure rules for multiple AI coding environments. Please select which rule profiles you'd like to include in your project setup.

Available profiles: ${availableProfiles}

Please respond with profile keys separated by commas or spaces (e.g., "cursor,windsurf,roo" or "cursor windsurf roo"). You can select multiple profiles or just one.`;

			try {
				const response = await context.elicit(prompt, {
					temperature: 0.1,
					maxTokens: 200
				});

				// Parse the response to extract profile names
				const selectedProfiles = response
					.toLowerCase()
					.split(/[,\s]+/)
					.map((p) => p.trim())
					.filter((p) => RULE_PROFILES.includes(p));

				if (selectedProfiles.length > 0) {
					log.info(
						`Profile selection successful: ${selectedProfiles.join(', ')}`
					);
					return selectedProfiles;
				} else {
					log.info(
						'Could not parse valid profiles from response, falling back to cursor'
					);
					return ['cursor'];
				}
			} catch (elicitError) {
				// FastMCP docs: ctx.elicit() will raise an error if client doesn't support elicitation
				log.info(`Elicitation not supported by client: ${elicitError.message}`);
				return null;
			}
		} else {
			log.info('MCP client does not support elicitation, defaulting to cursor');
			return null;
		}
	} catch (error) {
		log.info(
			`Profile selection failed: ${error.message}, defaulting to cursor`
		);
		return null;
	}
}

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
				.default(true)
				.describe('Add shell aliases (tm, taskmaster) to shell config file.'),
			initGit: z
				.boolean()
				.optional()
				.default(true)
				.describe('Initialize Git repository in project root.'),
			storeTasksInGit: z
				.boolean()
				.optional()
				.default(true)
				.describe('Store tasks in Git (tasks.json and tasks/ directory).'),
			rules: z
				.array(z.enum(RULE_PROFILES))
				.optional()
				.describe(
					`List of rule profiles to include at initialization. If omitted, user will be prompted to select profiles via elicitation (if supported by the MCP client), otherwise defaults to cursor profile only. Available options: ${RULE_PROFILES.join(', ')}`
				),
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
				),
			skipElicitation: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					'Skip elicitation and use cursor default, even if elicitation is supported.'
				)
		}),
		execute: withNormalizedProjectRoot(async (args, context) => {
			const { log, session } = context;

			try {
				log.info(
					`Executing initialize_project tool with args: ${JSON.stringify(args)}`
				);

				// Handle profile selection with simplified elicitation attempt
				let finalArgs = { ...args };

				if (!Array.isArray(args.rules) || args.rules.length === 0) {
					if (!args.skipElicitation) {
						log.info('No rules specified, attempting profile selection...');

						const selectedProfiles = await attemptProfileSelection(
							context,
							log
						);

						if (selectedProfiles && selectedProfiles.length > 0) {
							finalArgs.rules = selectedProfiles;
							log.info(
								`Profile selection successful: ${selectedProfiles.join(', ')}`
							);
						} else {
							finalArgs.rules = ['cursor'];
							log.info('Profile selection not available, defaulting to cursor');
						}
					} else {
						finalArgs.rules = ['cursor'];
						log.info('Elicitation skipped, defaulting to cursor');
					}
				}

				const result = await initializeProjectDirect(finalArgs, log, {
					session
				});

				return handleApiResult(
					result,
					log,
					'Initialization failed',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				const errorMessage = `Project initialization tool failed: ${error.message || 'Unknown error'}`;
				log.error(errorMessage, error);
				return createErrorResponse(errorMessage, { details: error.stack });
			}
		})
	});
}
