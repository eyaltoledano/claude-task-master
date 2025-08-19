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
