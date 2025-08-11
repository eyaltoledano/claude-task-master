/**
 * Streaming handler for PRD parsing
 */

import { createParsePrdTracker } from '../../../../src/progress/parse-prd-tracker.js';
import { displayParsePrdStart } from '../../../../src/ui/parse-prd.js';
import { getPriorityIndicators } from '../../../../src/ui/indicators.js';
import {
	parseStream,
	StreamingError,
	STREAMING_ERROR_CODES
} from '../../../../src/utils/stream-parser.js';
import { TimeoutManager } from '../../../../src/utils/timeout-manager.js';
import { streamTextService } from '../../ai-services-unified.js';
import {
	getMainModelId,
	getParametersForRole,
	getResearchModelId,
	getDefaultPriority
} from '../../config-manager.js';
import { LoggingConfig } from './parse-prd-config.js';
import { estimateTokens, reportTaskProgress } from './parse-prd-helpers.js';

/**
 * Extract a readable stream from various stream result formats
 * @param {any} streamResult - The stream result object from AI service
 * @returns {AsyncIterable|ReadableStream} The extracted stream
 * @throws {StreamingError} If no valid stream can be extracted
 */
function extractStreamFromResult(streamResult) {
	// Check for null or undefined
	if (!streamResult) {
		throw new StreamingError(
			'Stream result is null or undefined',
			STREAMING_ERROR_CODES.NOT_ASYNC_ITERABLE
		);
	}

	// Priority 1: Check for DefaultStreamTextResult pattern (baseStream property)
	if (streamResult.baseStream) {
		return validateAndReturnStream(streamResult.baseStream, 'baseStream');
	}

	// Priority 2: Check if already an async iterable
	if (typeof streamResult[Symbol.asyncIterator] === 'function') {
		return streamResult;
	}

	// Priority 3: Check if it's a ReadableStream
	if (streamResult.getReader && typeof streamResult.getReader === 'function') {
		return streamResult;
	}

	// No valid stream found
	throw new StreamingError(
		'Stream object is not async iterable or readable',
		STREAMING_ERROR_CODES.NOT_ASYNC_ITERABLE
	);
}

/**
 * Validate that the extracted stream is usable
 * @param {any} stream - The stream to validate
 * @param {string} source - Source description for error messages
 * @returns {AsyncIterable|ReadableStream} The validated stream
 * @throws {StreamingError} If stream is not valid
 */
function validateAndReturnStream(stream, source) {
	if (!stream) {
		throw new StreamingError(
			`No valid stream found in ${source}`,
			STREAMING_ERROR_CODES.NOT_ASYNC_ITERABLE
		);
	}

	const isAsyncIterable = typeof stream[Symbol.asyncIterator] === 'function';
	const isReadableStream = stream.getReader && typeof stream.getReader === 'function';

	if (!isAsyncIterable && !isReadableStream) {
		throw new StreamingError(
			`Stream from ${source} is neither async iterable nor readable`,
			STREAMING_ERROR_CODES.NOT_ASYNC_ITERABLE
		);
	}

	return stream;
}

/**
 * Handle streaming AI service call and parsing
 * @param {Object} config - Configuration object
 * @param {Object} prompts - System and user prompts
 * @param {number} numTasks - Number of tasks to generate
 * @returns {Promise<Object>} Parsed tasks and telemetry
 */
export async function handleStreamingService(config, prompts, numTasks) {
	const logger = new LoggingConfig(config.mcpLog, config.reportProgress);
	const { systemPrompt, userPrompt } = prompts;
	const estimatedInputTokens = estimateTokens(systemPrompt + userPrompt);
	const defaultPriority = getDefaultPriority(config.projectRoot) || 'medium';

	// Report initial progress
	if (config.reportProgress) {
		await config.reportProgress({
			progress: 0,
			total: numTasks,
			message: `Starting PRD analysis (Input: ${estimatedInputTokens} tokens)${config.research ? ' with research' : ''}...`
		});
	}

	// Use TimeoutManager for cleaner timeout handling
	let aiServiceResponse;
	try {
		aiServiceResponse = await TimeoutManager.withTimeout(
			streamTextService({
				role: config.research ? 'research' : 'main',
				session: config.session,
				projectRoot: config.projectRoot,
				systemPrompt,
				prompt: userPrompt,
				commandName: 'parse-prd',
				outputType: config.isMCP ? 'mcp' : 'cli'
			}),
			config.streamingTimeout,
			'Streaming operation'
		);
	} catch (error) {
		throw error;
	}

	// Extract the actual stream from the result object
	const textStream = extractStreamFromResult(aiServiceResponse.mainResult);

	// Setup progress tracking
	const priorityMap = getPriorityIndicators(config.isMCP);
	let progressTracker = null;

	if (config.outputFormat === 'text' && !config.isMCP) {
		progressTracker = createParsePrdTracker({
			numUnits: numTasks,
			unitName: 'task',
			append: config.append
		});

		const modelId = config.research ? getResearchModelId() : getMainModelId();
		const parameters = getParametersForRole(
			config.research ? 'research' : 'main'
		);

		displayParsePrdStart({
			prdFilePath: config.prdPath,
			outputPath: config.tasksPath,
			numTasks,
			append: config.append,
			research: config.research,
			force: config.force,
			existingTasks: [],
			nextId: 1,
			model: modelId || 'Default',
			temperature: parameters?.temperature || 0.7
		});

		progressTracker.start();
	}

	// Parse stream with progress callback
	const onProgress = async (task, metadata) => {
		await reportTaskProgress({
			task,
			currentCount: metadata.currentCount,
			totalTasks: numTasks,
			estimatedTokens: metadata.estimatedTokens,
			progressTracker,
			reportProgress: config.reportProgress,
			priorityMap,
			defaultPriority,
			estimatedInputTokens
		});
	};

	// Use TimeoutManager for stream parsing timeout
	let parseResult;
	try {
		parseResult = await TimeoutManager.withTimeout(
			parseStream(textStream, {
				jsonPaths: ['$.tasks.*'],
				onProgress,
				onError: (error) => {
					logger.report(`JSON parsing error: ${error.message}`, 'debug');
				},
				estimateTokens,
				expectedTotal: numTasks,
				fallbackItemExtractor: (fullResponse) => fullResponse.tasks || []
			}),
			config.streamingTimeout,
			'Stream parsing'
		);
	} catch (error) {
		throw error;
	}

	if (parseResult.items.length === 0) {
		throw new Error('No tasks were generated from the PRD');
	}

	// Cleanup progress tracker and get summary
	let summary = null;
	if (progressTracker) {
		summary = progressTracker.getSummary();
		progressTracker.cleanup();
	}

	return {
		parsedTasks: parseResult.items,
		aiServiceResponse,
		estimatedInputTokens,
		estimatedOutputTokens: parseResult.estimatedTokens,
		usedFallback: parseResult.usedFallback,
		progressTracker,
		summary
	};
}
