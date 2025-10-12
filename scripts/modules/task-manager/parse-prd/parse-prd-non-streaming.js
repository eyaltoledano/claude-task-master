/**
 * Non-streaming handler for PRD parsing
 */

import ora from 'ora';
import { generateObjectService } from '../../ai-services-unified.js';
import { LoggingConfig, prdResponseSchema } from './parse-prd-config.js';
import { estimateTokens } from './parse-prd-helpers.js';

/**
 * Handle non-streaming AI service call
 * @param {Object} config - Configuration object
 * @param {Object} prompts - System and user prompts
 * @returns {Promise<Object>} Generated tasks and telemetry
 */
export async function handleNonStreamingService(config, prompts) {
	const logger = new LoggingConfig(config.mcpLog, config.reportProgress);
	const { systemPrompt, userPrompt } = prompts;
	const estimatedInputTokens = estimateTokens(systemPrompt + userPrompt);

	// Initialize spinner for CLI
	let spinner = null;
	if (config.outputFormat === 'text' && !config.isMCP) {
		spinner = ora('Parsing PRD and generating tasks...\n').start();
	}

	try {
		// Call AI service
		logger.report(
			`Calling AI service to generate tasks from PRD${config.research ? ' with research-backed analysis' : ''}...`,
			'info'
		);

		const aiServiceResponse = await generateObjectService({
			role: config.research ? 'research' : 'main',
			session: config.session,
			projectRoot: config.projectRoot,
			schema: prdResponseSchema,
			objectName: 'tasks_data',
			systemPrompt,
			prompt: userPrompt,
			commandName: 'parse-prd',
			outputType: config.isMCP ? 'mcp' : 'cli'
		});

		// === BEGIN AGENT_LLM_DELEGATION HANDLING ===
		if (
			aiServiceResponse &&
			aiServiceResponse.mainResult &&
			aiServiceResponse.mainResult.type === 'agent_llm_delegation'
		) {
			// Use the local logger instance and config values to build the delegation payload
			logger.report('parsePRD: Detected agent_llm_delegation signal.', 'debug');
			try {
				const pendingInteraction = {
					type: 'agent_llm',
					interactionId: aiServiceResponse.mainResult.interactionId,
					delegatedCallDetails: {
						originalCommand: 'parse_prd',
						role: config.research ? 'research' : 'main',
						serviceType: 'generateObject',
						// Ensure details are serializable
						requestParameters: JSON.parse(
							JSON.stringify(aiServiceResponse.mainResult.details || {})
						)
					}
				};

				// Stop the CLI spinner before returning to avoid leaving it running
				spinner?.stop();
				return {
					success: true,
					needsAgentDelegation: true,
					pendingInteraction,
					message: 'Awaiting LLM processing via agent-llm for PRD parsing.',
					telemetryData: null // No direct LLM call was completed by this function
				};
			} catch (err) {
				// Do not let raw Error objects bubble up into MCP's resource.text; return a structured error
				logger.report(
					`parsePRD: Failed to construct pendingInteraction - ${err.message}`,
					'error'
				);
				// Stop spinner on error before returning
				spinner?.stop();
				return {
					success: false,
					isError: true,
					errorMessage: `Failed to prepare agent delegation payload: ${err.message}`
				};
			}
		}
		// === END AGENT_LLM_DELEGATION HANDLING ===

		// Extract generated data
		let generatedData = null;
		if (aiServiceResponse?.mainResult) {
			if (
				typeof aiServiceResponse.mainResult === 'object' &&
				aiServiceResponse.mainResult !== null &&
				'tasks' in aiServiceResponse.mainResult
			) {
				generatedData = aiServiceResponse.mainResult;
			} else if (
				typeof aiServiceResponse.mainResult.object === 'object' &&
				aiServiceResponse.mainResult.object !== null &&
				'tasks' in aiServiceResponse.mainResult.object
			) {
				generatedData = aiServiceResponse.mainResult.object;
			}
		}

		if (!generatedData || !Array.isArray(generatedData.tasks)) {
			throw new Error(
				'AI service returned unexpected data structure after validation.'
			);
		}

		if (spinner) {
			spinner.succeed('Tasks generated successfully!');
		}

		return {
			parsedTasks: generatedData.tasks,
			aiServiceResponse,
			estimatedInputTokens
		};
	} catch (error) {
		if (spinner) {
			spinner.fail(`Error parsing PRD: ${error.message}`);
		}
		throw error;
	}
}
