import chalk from 'chalk';
import {
	StreamingError,
	STREAMING_ERROR_CODES
} from '../../../../src/utils/stream-parser.js';
import { TimeoutManager } from '../../../../src/utils/timeout-manager.js';
import { getDebugFlag, getDefaultPriority } from '../../config-manager.js';

// Import configuration classes
import { PrdParseConfig, LoggingConfig } from './parse-prd-config.js';

// Import helper functions
import {
	readPrdContent,
	loadExistingTasks,
	validateFileOperations,
	processTasks,
	saveTasksToFile,
	buildPrompts,
	displayCliSummary,
	displayNonStreamingCliOutput
} from './parse-prd-helpers.js';

// Import handlers
import { handleStreamingService } from './parse-prd-streaming.js';
import { handleNonStreamingService } from './parse-prd-non-streaming.js';

// ============================================================================
// MAIN PARSING FUNCTIONS (Simplified after refactoring)
// ============================================================================

/**
 * Shared parsing logic for both streaming and non-streaming
 * @param {PrdParseConfig} config - Configuration object
 * @param {Function} serviceHandler - Handler function for AI service
 * @param {boolean} isStreaming - Whether this is streaming mode
 * @returns {Promise<Object>} Result object with success status and telemetry
 */
async function parsePRDCore(config, serviceHandler, isStreaming) {
	const logger = new LoggingConfig(config.mcpLog, config.reportProgress);

	logger.report(
		`Parsing PRD file: ${config.prdPath}, Force: ${config.force}, Append: ${config.append}, Research: ${config.research}`,
		'debug'
	);

	try {
		// Load existing tasks
		const { existingTasks, nextId } = loadExistingTasks(
			config.tasksPath,
			config.targetTag
		);

		// Validate operations
		validateFileOperations({
			existingTasks,
			targetTag: config.targetTag,
			append: config.append,
			force: config.force,
			isMCP: config.isMCP,
			logger
		});

		// Read PRD content and build prompts
		const prdContent = readPrdContent(config.prdPath);
		const prompts = await buildPrompts(config, prdContent, nextId);

		// Call the appropriate service handler
		const serviceResult = await serviceHandler(
			config,
			prompts,
			config.numTasks
		);

		// Process tasks
		const defaultPriority = getDefaultPriority(config.projectRoot) || 'medium';
		const processedNewTasks = processTasks(
			serviceResult.parsedTasks,
			nextId,
			existingTasks,
			defaultPriority
		);

		// Combine with existing if appending
		const finalTasks = config.append
			? [...existingTasks, ...processedNewTasks]
			: processedNewTasks;

		// Save to file
		saveTasksToFile(config.tasksPath, finalTasks, config.targetTag, logger);

		// Handle completion reporting
		await handleCompletionReporting(
			config,
			serviceResult,
			processedNewTasks,
			finalTasks,
			nextId,
			isStreaming
		);

		return {
			success: true,
			tasksPath: config.tasksPath,
			telemetryData: serviceResult.aiServiceResponse?.telemetryData,
			tagInfo: serviceResult.aiServiceResponse?.tagInfo
		};
	} catch (error) {
		logger.report(`Error parsing PRD: ${error.message}`, 'error');

		if (!config.isMCP) {
			console.error(chalk.red(`Error: ${error.message}`));
			if (getDebugFlag(config.projectRoot)) {
				console.error(error);
			}
		}
		throw error;
	}
}

/**
 * Handle completion reporting for both CLI and MCP
 * @param {PrdParseConfig} config - Configuration object
 * @param {Object} serviceResult - Result from service handler
 * @param {Array} processedNewTasks - New tasks that were processed
 * @param {Array} finalTasks - All tasks after processing
 * @param {number} nextId - Next available task ID
 * @param {boolean} isStreaming - Whether this was streaming mode
 */
async function handleCompletionReporting(
	config,
	serviceResult,
	processedNewTasks,
	finalTasks,
	nextId,
	isStreaming
) {
	const { aiServiceResponse, estimatedInputTokens, estimatedOutputTokens } =
		serviceResult;

	// MCP progress reporting
	if (config.reportProgress) {
		const hasValidTelemetry =
			aiServiceResponse?.telemetryData &&
			(aiServiceResponse.telemetryData.inputTokens > 0 ||
				aiServiceResponse.telemetryData.outputTokens > 0);

		let completionMessage;
		if (hasValidTelemetry) {
			const cost = aiServiceResponse.telemetryData.totalCost || 0;
			const currency = aiServiceResponse.telemetryData.currency || 'USD';
			completionMessage = `✅ Task Generation Completed | Tokens (I/O): ${aiServiceResponse.telemetryData.inputTokens}/${aiServiceResponse.telemetryData.outputTokens} | Cost: ${currency === 'USD' ? '$' : currency}${cost.toFixed(4)}`;
		} else {
			const outputTokens = isStreaming ? estimatedOutputTokens : 'unknown';
			completionMessage = `✅ Task Generation Completed | ~Tokens (I/O): ${estimatedInputTokens}/${outputTokens} | Cost: ~$0.00`;
		}

		await config.reportProgress({
			progress: config.numTasks,
			total: config.numTasks,
			message: completionMessage
		});
	}

	// CLI output
	if (config.outputFormat === 'text' && !config.isMCP) {
		if (isStreaming && serviceResult.summary) {
			await displayCliSummary({
				processedTasks: processedNewTasks,
				nextId,
				summary: serviceResult.summary,
				prdPath: config.prdPath,
				tasksPath: config.tasksPath,
				usedFallback: serviceResult.usedFallback,
				aiServiceResponse
			});
		} else if (!isStreaming) {
			displayNonStreamingCliOutput({
				processedTasks: processedNewTasks,
				research: config.research,
				finalTasks,
				tasksPath: config.tasksPath,
				aiServiceResponse
			});
		}
	}
}

/**
 * Parse PRD with streaming progress reporting
 */
async function parsePRDWithStreaming(
	prdPath,
	tasksPath,
	numTasks,
	options = {}
) {
	const config = new PrdParseConfig(prdPath, tasksPath, numTasks, options);
	return parsePRDCore(config, handleStreamingService, true);
}

/**
 * Parse PRD without streaming (fallback)
 */
async function parsePRDWithoutStreaming(
	prdPath,
	tasksPath,
	numTasks,
	options = {}
) {
	const config = new PrdParseConfig(prdPath, tasksPath, numTasks, options);
	return parsePRDCore(config, handleNonStreamingService, false);
}

/**
 * Main entry point - decides between streaming and non-streaming
 */
async function parsePRD(prdPath, tasksPath, numTasks, options = {}) {
	const config = new PrdParseConfig(prdPath, tasksPath, numTasks, options);

	if (config.useStreaming) {
		try {
			return await parsePRDWithStreaming(prdPath, tasksPath, numTasks, options);
		} catch (streamingError) {
			// Check if this is a streaming-specific error (including timeout)
			const isStreamingError =
				streamingError instanceof StreamingError ||
				streamingError.code === STREAMING_ERROR_CODES.NOT_ASYNC_ITERABLE ||
				streamingError.code ===
					STREAMING_ERROR_CODES.STREAM_PROCESSING_FAILED ||
				streamingError.code === STREAMING_ERROR_CODES.STREAM_NOT_ITERABLE ||
				TimeoutManager.isTimeoutError(streamingError);

			if (isStreamingError) {
				const logger = new LoggingConfig(config.mcpLog, config.reportProgress);

				// Show fallback message
				if (config.outputFormat === 'text' && !config.isMCP) {
					console.log(
						chalk.yellow(
							`⚠️  Streaming operation ${streamingError.message.includes('timed out') ? 'timed out' : 'failed'}. Falling back to non-streaming mode...`
						)
					);
				} else {
					logger.report(
						`Streaming failed (${streamingError.message}), falling back to non-streaming mode...`,
						'warn'
					);
				}

				// Fallback to non-streaming
				return await parsePRDWithoutStreaming(
					prdPath,
					tasksPath,
					numTasks,
					options
				);
			} else {
				throw streamingError;
			}
		}
	} else {
		return await parsePRDWithoutStreaming(
			prdPath,
			tasksPath,
			numTasks,
			options
		);
	}
}

export default parsePRD;
