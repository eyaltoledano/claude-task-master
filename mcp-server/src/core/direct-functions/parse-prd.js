/**
 * parse-prd.js
 * Direct function implementation for parsing a PRD using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG
} from '../../../../scripts/modules/utils.js';
import {
	getAnthropicClientForMCP,
	getModelConfig
} from '../utils/ai-client-utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Direct function wrapper for parsePRD via configured provider.
 *
 * @param {Object} args - Command arguments (input, output, numTasks, force, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function parsePRDDirect(args, log, context = {}) {
	const { session } = context;
	// input: Path to the PRD file.
	// output: Path where the tasks.json should be saved.
	const { projectRoot, input: prdInputPath, output: tasksOutputPath, numTasks, force, file } = args;

	try {
		log.info(`Parsing PRD with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('parsePRDDirect called without projectRoot.');
		}
		if (!prdInputPath) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'PRD input path (input) is required' } };
		}
		if (!fs.existsSync(prdInputPath)) {
			return { success: false, error: { code: 'FILE_NOT_FOUND', message: `PRD input file not found: ${prdInputPath}` } };
		}
		// Output path defaults within the provider if not specified
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to parse PRD: ${prdInputPath}.`);

		// --- Prepare Jira MCP Tools if needed ---
		// parsePRD is primarily an AI/local task generation function.
		// A Jira provider might use tools to check for existing epics or structure,
		// but typically wouldn't need tools for the core parsing.
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			const requiredTools = ['search', 'get_issue']; // Example: Might search for matching epics
			for (const toolName of requiredTools) {
				const fullToolName = `${toolPrefix}_${toolName}`;
				if (typeof global[fullToolName] === 'function') {
					jiraMcpTools[toolName] = global[fullToolName];
				} else {
					log.warn(`Jira MCP tool function not found in global scope: ${fullToolName}`);
				}
			}
			log.debug('Prepared Jira MCP Tools for factory:', Object.keys(jiraMcpTools));
		}
		// --- End Jira MCP Tools Preparation ---

		const logWrapper = {
			info: (message, ...rest) => log.info(message, ...rest),
			warn: (message, ...rest) => log.warn(message, ...rest),
			error: (message, ...rest) => log.error(message, ...rest),
			debug: (message, ...rest) => log.debug && log.debug(message, ...rest),
			success: (message, ...rest) => log.info(message, ...rest)
		};

		try {
			// Pass jiraMcpTools in options to the factory
			const provider = await getTaskProvider({ jiraMcpTools });

			// AI client setup needed for the provider
			let anthropicClient = null;
			try {
				anthropicClient = getAnthropicClientForMCP(session, log);
			} catch (error) {
				throw { code: 'AI_CLIENT_ERROR', message: `Cannot initialize Anthropic client: ${error.message}` };
			}
			const modelConfig = getModelConfig(session);

			const providerOptions = {
				output: tasksOutputPath, // Pass output path
				numTasks,
				force,
				file, // Pass tasks file path if provider needs it (e.g., for overwrite check)
				mcpLog: logWrapper,
				session,
				anthropicClient,
				modelConfig
			};

			// Call the provider's parsePRD method
			// Assuming signature: parsePRD(inputPath, options)
			const parseResult = await provider.parsePRD(prdInputPath, providerOptions);

			// Check provider result
			if (parseResult && parseResult.success) {
				const generatedFilePath = parseResult.data?.tasksFilePath || tasksOutputPath || 'tasks/tasks.json';
				log.info(`Provider successfully parsed PRD and generated tasks at ${generatedFilePath}.`);
				return {
					success: true,
					data: parseResult.data || { message: `Successfully parsed PRD. Tasks saved to ${generatedFilePath}.` },
					fromCache: false // File system operation
				};
			} else {
				const errorMsg = parseResult?.error?.message || 'Provider failed to parse PRD.';
				const errorCode = parseResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error parsing PRD: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: parseResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			// No silent mode needed here usually, but check just in case
			if (isSilentMode()) {
				disableSilentMode();
			}
			log.error(`Error during parsePRDDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_PARSE_PRD_ERROR',
					message: error.message || 'Failed to parse PRD'
				},
				fromCache: false
			};
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in parsePRDDirect: ${error.message}`);
		if (isSilentMode()) {
			disableSilentMode();
		}
		return {
			success: false,
			error: { code: 'DIRECT_FUNCTION_SETUP_ERROR', message: error.message },
			fromCache: false
		};
	}
}
