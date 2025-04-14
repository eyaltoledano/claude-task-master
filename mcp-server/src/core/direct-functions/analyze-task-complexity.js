/**
 * analyze-task-complexity.js
 * Direct function implementation for analyzing task complexity using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG
} from '../../../../scripts/modules/utils.js';
import fs from 'fs';
import path from 'path';
import { findTasksJsonPath } from '../utils/path-utils.js';
import {
	getAnthropicClientForMCP,
	getModelConfig
} from '../utils/ai-client-utils.js'; // Keep AI utils import path

/**
 * Analyze task complexity and generate recommendations
 * @param {Object} args - Function arguments
 * @param {string} args.projectRoot - Absolute path to the project root directory.
 * @param {string} args.outputPath - Explicit absolute path to save the report.
 * @param {string} [args.model] - LLM model to use for analysis
 * @param {string|number} [args.threshold] - Minimum complexity score to recommend expansion (1-10)
 * @param {boolean} [args.research] - Use Perplexity AI for research-backed complexity analysis
 * @param {Object} log - Logger object
 * @param {Object} [context={}] - Context object containing session data
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function analyzeTaskComplexityDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id: taskIdString, research, file } = args; // Added file

	try {
		log.info(`Analyzing task complexity with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('analyzeTaskComplexityDirect called without projectRoot.');
		}
		if (!taskIdString) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Task ID(s) (id) is required' } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to analyze complexity for task(s) ${taskIdString}${research ? ' with research' : ''}.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's analyzeTaskComplexity method
			// Likely requires: search, get_issue
			const requiredTools = ['search', 'get_issue']; // Adjust as needed
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

		const taskIds = taskIdString.split(',').map(id => id.trim());

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

			let anthropicClient = null;
			try {
				anthropicClient = getAnthropicClientForMCP(session, log);
			} catch (error) {
				throw { code: 'AI_CLIENT_ERROR', message: `Cannot initialize Anthropic client: ${error.message}` };
			}
			const modelConfig = getModelConfig(session);

			const providerOptions = {
				research,
				file,
				mcpLog: logWrapper,
				session,
				anthropicClient,
				modelConfig
			};

			// Call the provider's analyzeTaskComplexity method
			const analyzeResult = await provider.analyzeTaskComplexity(taskIds, providerOptions);

			if (analyzeResult && analyzeResult.success) {
				log.info(`Provider successfully analyzed complexity for task(s) ${taskIds.join(', ')}.`);
				return {
					success: true,
					data: analyzeResult.data || { message: `Successfully analyzed complexity for ${taskIds.join(', ')}.` },
					fromCache: false
				};
			} else {
				const errorMsg = analyzeResult?.error?.message || 'Provider failed to analyze task complexity.';
				const errorCode = analyzeResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error analyzing complexity for ${taskIds.join(', ')}: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: analyzeResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			log.error(`Error calling provider analyzeTaskComplexity: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_ANALYZE_COMPLEXITY_ERROR',
					message: error.message || `Failed to analyze complexity for task(s) ${taskIds.join(', ')}`
				},
				fromCache: false
			};
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in analyzeTaskComplexityDirect: ${error.message}`);
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
