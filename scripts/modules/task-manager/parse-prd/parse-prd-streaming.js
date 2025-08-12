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
import { streamObjectService } from '../../ai-services-unified.js';
import {
	getMainModelId,
	getParametersForRole,
	getResearchModelId,
	getDefaultPriority
} from '../../config-manager.js';
import { LoggingConfig, prdResponseSchema } from './parse-prd-config.js';
import { estimateTokens, reportTaskProgress } from './parse-prd-helpers.js';

/**
 * Extract a readable stream from various stream result formats
 * @param {any} streamResult - The stream result object from AI service
 * @returns {AsyncIterable|ReadableStream} The extracted stream
 * @throws {StreamingError} If no valid stream can be extracted
 */
function extractStreamFromResult(streamResult) {
	if (!streamResult) {
		throw new StreamingError(
			'Stream result is null or undefined',
			STREAMING_ERROR_CODES.NOT_ASYNC_ITERABLE
		);
	}

	// Try extraction strategies in priority order
	const stream = tryExtractStream(streamResult);
	
	if (!stream) {
		throw new StreamingError(
			'Stream object is not async iterable or readable',
			STREAMING_ERROR_CODES.NOT_ASYNC_ITERABLE
		);
	}
	
	return stream;
}

/**
 * Try to extract stream using various strategies
 */
function tryExtractStream(streamResult) {
	const streamExtractors = [
		{ key: 'partialObjectStream', extractor: (obj) => obj.partialObjectStream },
		{ key: 'textStream', extractor: (obj) => extractCallable(obj.textStream) },
		{ key: 'stream', extractor: (obj) => extractCallable(obj.stream) },
		{ key: 'baseStream', extractor: (obj) => obj.baseStream }
	];

	for (const { key, extractor } of streamExtractors) {
		const stream = extractor(streamResult);
		if (stream && isStreamable(stream)) {
			return stream;
		}
	}

	// Check if already streamable
	return isStreamable(streamResult) ? streamResult : null;
}

/**
 * Extract a property that might be a function or direct value
 */
function extractCallable(property) {
	if (!property) return null;
	return typeof property === 'function' ? property() : property;
}

/**
 * Check if object is streamable (async iterable or readable stream)
 */
function isStreamable(obj) {
	return obj && (
		typeof obj[Symbol.asyncIterator] === 'function' ||
		(obj.getReader && typeof obj.getReader === 'function')
	);
}

/**
 * Handle streaming AI service call and parsing
 * @param {Object} config - Configuration object
 * @param {Object} prompts - System and user prompts
 * @param {number} numTasks - Number of tasks to generate
 * @returns {Promise<Object>} Parsed tasks and telemetry
 */
export async function handleStreamingService(config, prompts, numTasks) {
	const context = createStreamingContext(config, prompts, numTasks);
	
	await initializeProgress(config, numTasks, context.estimatedInputTokens);
	
	const aiServiceResponse = await callAIServiceWithTimeout(
		config,
		prompts,
		config.streamingTimeout
	);
	
	const { progressTracker, priorityMap } = await setupProgressTracking(
		config,
		numTasks
	);
	
	const streamingResult = await processStreamResponse(
		aiServiceResponse.mainResult,
		config,
		numTasks,
		progressTracker,
		priorityMap,
		context.defaultPriority,
		context.estimatedInputTokens,
		context.logger
	);
	
	validateStreamingResult(streamingResult);
	
	return prepareFinalResult(
		streamingResult,
		aiServiceResponse,
		context.estimatedInputTokens,
		progressTracker
	);
}

/**
 * Create streaming context with common values
 */
function createStreamingContext(config, prompts, numTasks) {
	const { systemPrompt, userPrompt } = prompts;
	return {
		logger: new LoggingConfig(config.mcpLog, config.reportProgress),
		estimatedInputTokens: estimateTokens(systemPrompt + userPrompt),
		defaultPriority: getDefaultPriority(config.projectRoot) || 'medium'
	};
}

/**
 * Validate streaming result has tasks
 */
function validateStreamingResult(streamingResult) {
	if (streamingResult.parsedTasks.length === 0) {
		throw new Error('No tasks were generated from the PRD');
	}
}

/**
 * Initialize progress reporting
 */
async function initializeProgress(config, numTasks, estimatedInputTokens) {
	if (config.reportProgress) {
		await config.reportProgress({
			progress: 0,
			total: numTasks,
			message: `Starting PRD analysis (Input: ${estimatedInputTokens} tokens)${config.research ? ' with research' : ''}...`
		});
	}
}

/**
 * Call AI service with timeout
 */
async function callAIServiceWithTimeout(config, prompts, timeout) {
	const { systemPrompt, userPrompt } = prompts;

	return await TimeoutManager.withTimeout(
		streamObjectService({
			role: config.research ? 'research' : 'main',
			session: config.session,
			projectRoot: config.projectRoot,
			schema: prdResponseSchema,
			systemPrompt,
			prompt: userPrompt,
			commandName: 'parse-prd',
			outputType: config.isMCP ? 'mcp' : 'cli'
		}),
		timeout,
		'Streaming operation'
	);
}

/**
 * Setup progress tracking for CLI output
 */
async function setupProgressTracking(config, numTasks) {
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

	return { progressTracker, priorityMap };
}

/**
 * Process stream response based on stream type
 */
async function processStreamResponse(
	streamResult,
	config,
	numTasks,
	progressTracker,
	priorityMap,
	defaultPriority,
	estimatedInputTokens,
	logger
) {
	const context = {
		config,
		numTasks,
		progressTracker,
		priorityMap,
		defaultPriority,
		estimatedInputTokens
	};

	try {
		const streamingState = {
			lastPartialObject: null,
			taskCount: 0,
			estimatedOutputTokens: 0
		};

		await processPartialStream(streamResult.partialObjectStream, streamingState, context);
		return finalizeStreamingResults(streamingState, context);
	} catch (error) {
		logger.report(`StreamObject processing failed: ${error.message}`, 'debug');
		return await processTextStream(streamResult, context, logger);
	}
}

/**
 * Process the partial object stream
 */
async function processPartialStream(partialStream, state, context) {
	for await (const partialObject of partialStream) {
		state.lastPartialObject = partialObject;

		if (partialObject) {
			state.estimatedOutputTokens = estimateTokens(JSON.stringify(partialObject));
		}

		await processStreamingTasks(partialObject, state, context);
	}
}

/**
 * Process tasks from a streaming partial object
 */
async function processStreamingTasks(partialObject, state, context) {
	if (!partialObject?.tasks || !Array.isArray(partialObject.tasks)) {
		return;
	}

	const newTaskCount = partialObject.tasks.length;

	if (newTaskCount > state.taskCount) {
		await processNewTasks(
			partialObject.tasks,
			state.taskCount,
			newTaskCount,
			state.estimatedOutputTokens,
			context
		);
		state.taskCount = newTaskCount;
	} else if (context.progressTracker && state.estimatedOutputTokens > 0) {
		context.progressTracker.updateTokens(
			context.estimatedInputTokens,
			state.estimatedOutputTokens,
			true
		);
	}
}

/**
 * Process newly appeared tasks in the stream
 */
async function processNewTasks(tasks, startIndex, endIndex, estimatedOutputTokens, context) {
	for (let i = startIndex; i < endIndex; i++) {
		const task = tasks[i] || {};

		if (task.title) {
			await reportTaskProgress({
				task,
				currentCount: i + 1,
				totalTasks: context.numTasks,
				estimatedTokens: estimatedOutputTokens,
				progressTracker: context.progressTracker,
				reportProgress: context.config.reportProgress,
				priorityMap: context.priorityMap,
				defaultPriority: context.defaultPriority,
				estimatedInputTokens: context.estimatedInputTokens
			});
		} else {
			await reportPlaceholderTask(i + 1, estimatedOutputTokens, context);
		}
	}
}

/**
 * Report a placeholder task while it's being generated
 */
async function reportPlaceholderTask(taskNumber, estimatedOutputTokens, context) {
	const { progressTracker, config, numTasks, defaultPriority, estimatedInputTokens } = context;
	
	if (progressTracker) {
		progressTracker.addTaskLine(
			taskNumber,
			`Generating task ${taskNumber}...`,
			defaultPriority
		);
		progressTracker.updateTokens(estimatedInputTokens, estimatedOutputTokens, true);
	}

	if (config.reportProgress && !progressTracker) {
		await config.reportProgress({
			progress: taskNumber,
			total: numTasks,
			message: `Generating task ${taskNumber}/${numTasks}...`
		});
	}
}

/**
 * Finalize streaming results and update progress display
 */
async function finalizeStreamingResults(state, context) {
	const { lastPartialObject, estimatedOutputTokens, taskCount } = state;

	if (!lastPartialObject?.tasks || !Array.isArray(lastPartialObject.tasks)) {
		throw new Error('No tasks generated from streamObject');
	}

	if (context.progressTracker) {
		await updateFinalProgress(lastPartialObject.tasks, taskCount, estimatedOutputTokens, context);
	}

	return {
		parsedTasks: lastPartialObject.tasks,
		estimatedOutputTokens,
		usedFallback: false
	};
}

/**
 * Update progress tracker with final task content
 */
async function updateFinalProgress(tasks, taskCount, estimatedOutputTokens, context) {
	const { progressTracker, defaultPriority, estimatedInputTokens } = context;
	
	if (taskCount > 0) {
		updateTaskLines(tasks, progressTracker, defaultPriority);
	} else {
		await reportAllTasks(tasks, estimatedOutputTokens, context);
	}

	progressTracker.updateTokens(estimatedInputTokens, estimatedOutputTokens, false);
	progressTracker.stop();
}

/**
 * Update task lines in progress tracker with final content
 */
function updateTaskLines(tasks, progressTracker, defaultPriority) {
	for (let i = 0; i < tasks.length; i++) {
		const task = tasks[i];
		if (task?.title) {
			progressTracker.addTaskLine(
				i + 1,
				task.title,
				task.priority || defaultPriority
			);
		}
	}
}

/**
 * Report all tasks that were not streamed incrementally
 */
async function reportAllTasks(tasks, estimatedOutputTokens, context) {
	for (let i = 0; i < tasks.length; i++) {
		const task = tasks[i];
		if (task?.title) {
			await reportTaskProgress({
				task,
				currentCount: i + 1,
				totalTasks: context.numTasks,
				estimatedTokens: estimatedOutputTokens,
				progressTracker: context.progressTracker,
				reportProgress: context.config.reportProgress,
				priorityMap: context.priorityMap,
				defaultPriority: context.defaultPriority,
				estimatedInputTokens: context.estimatedInputTokens
			});
		}
	}
}

/**
 * Process text stream with fallback parsing
 */
async function processTextStream(streamResult, context, logger) {
	const textStream = extractStreamFromResult(streamResult);

	const parseResult = await TimeoutManager.withTimeout(
		parseStream(textStream, {
			jsonPaths: ['$.tasks.*'],
			onProgress: async (task, metadata) => {
				await reportTaskProgress({
					task,
					currentCount: metadata.currentCount,
					totalTasks: context.numTasks,
					estimatedTokens: metadata.estimatedTokens,
					progressTracker: context.progressTracker,
					reportProgress: context.config.reportProgress,
					priorityMap: context.priorityMap,
					defaultPriority: context.defaultPriority,
					estimatedInputTokens: context.estimatedInputTokens
				});
			},
			onError: (error) => {
				logger.report(`JSON parsing error: ${error.message}`, 'debug');
			},
			estimateTokens,
			expectedTotal: context.numTasks,
			fallbackItemExtractor: (fullResponse) => fullResponse.tasks || []
		}),
		context.config.streamingTimeout,
		'Stream parsing'
	);

	return {
		parsedTasks: parseResult.items,
		estimatedOutputTokens: parseResult.estimatedTokens,
		usedFallback: parseResult.usedFallback
	};
}

/**
 * Prepare final result with cleanup
 */
function prepareFinalResult(
	streamingResult,
	aiServiceResponse,
	estimatedInputTokens,
	progressTracker
) {
	let summary = null;
	if (progressTracker) {
		summary = progressTracker.getSummary();
		progressTracker.cleanup();
	}

	return {
		parsedTasks: streamingResult.parsedTasks,
		aiServiceResponse,
		estimatedInputTokens,
		estimatedOutputTokens: streamingResult.estimatedOutputTokens,
		usedFallback: streamingResult.usedFallback,
		progressTracker,
		summary
	};
}
