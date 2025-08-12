/**
 * Streaming handler for PRD parsing
 */

import { createParsePrdTracker } from '../../../../src/progress/parse-prd-tracker.js';
import { displayParsePrdStart } from '../../../../src/ui/parse-prd.js';
import { getPriorityIndicators } from '../../../../src/ui/indicators.js';
import { TimeoutManager } from '../../../../src/utils/timeout-manager.js';
import {
	streamObjectService,
	generateObjectService
} from '../../ai-services-unified.js';
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
	return (
		obj &&
		(typeof obj[Symbol.asyncIterator] === 'function' ||
			(obj.getReader && typeof obj.getReader === 'function'))
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
		prompts,
		numTasks,
		progressTracker,
		priorityMap,
		context.defaultPriority,
		context.estimatedInputTokens,
		context.logger
	);

	validateStreamingResult(streamingResult);

	// If we have usage data from streaming, log telemetry now
	if (streamingResult.usage && config.projectRoot) {
		const { logAiUsage } = await import('../../ai-services-unified.js');
		const { getUserId } = await import('../../config-manager.js');
		const userId = getUserId(config.projectRoot);

		if (userId && aiServiceResponse.providerName && aiServiceResponse.modelId) {
			try {
				const telemetryData = await logAiUsage({
					userId,
					commandName: 'parse-prd',
					providerName: aiServiceResponse.providerName,
					modelId: aiServiceResponse.modelId,
					inputTokens: streamingResult.usage.promptTokens || 0,
					outputTokens: streamingResult.usage.completionTokens || 0,
					outputType: config.isMCP ? 'mcp' : 'cli'
				});

				// Add telemetry to the response
				if (telemetryData) {
					aiServiceResponse.telemetryData = telemetryData;
				}
			} catch (telemetryError) {
				context.logger.report(
					`Failed to log telemetry: ${telemetryError.message}`,
					'debug'
				);
			}
		}
	}

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
	prompts,
	numTasks,
	progressTracker,
	priorityMap,
	defaultPriority,
	estimatedInputTokens,
	logger
) {
	const { systemPrompt, userPrompt } = prompts;
	const context = {
		config: {
			...config,
			schema: prdResponseSchema // Add the schema for generateObject fallback
		},
		numTasks,
		progressTracker,
		priorityMap,
		defaultPriority,
		estimatedInputTokens,
		prompt: userPrompt,
		systemPrompt: systemPrompt
	};

	try {
		const streamingState = {
			lastPartialObject: null,
			taskCount: 0,
			estimatedOutputTokens: 0,
			usage: null
		};

		await processPartialStream(
			streamResult.partialObjectStream,
			streamingState,
			context
		);

		// Wait for usage data if available
		if (streamResult.usage) {
			try {
				streamingState.usage = await streamResult.usage;
			} catch (usageError) {
				logger.report(
					`Failed to get usage data: ${usageError.message}`,
					'debug'
				);
			}
		}

		return finalizeStreamingResults(streamingState, context);
	} catch (error) {
		logger.report(
			`StreamObject processing failed: ${error.message}. Falling back to generateObject.`,
			'debug'
		);
		return await processWithGenerateObject(context, logger);
	}
}

/**
 * Process the partial object stream
 */
async function processPartialStream(partialStream, state, context) {
	for await (const partialObject of partialStream) {
		state.lastPartialObject = partialObject;

		if (partialObject) {
			state.estimatedOutputTokens = estimateTokens(
				JSON.stringify(partialObject)
			);
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
async function processNewTasks(
	tasks,
	startIndex,
	endIndex,
	estimatedOutputTokens,
	context
) {
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
async function reportPlaceholderTask(
	taskNumber,
	estimatedOutputTokens,
	context
) {
	const {
		progressTracker,
		config,
		numTasks,
		defaultPriority,
		estimatedInputTokens
	} = context;

	if (progressTracker) {
		progressTracker.addTaskLine(
			taskNumber,
			`Generating task ${taskNumber}...`,
			defaultPriority
		);
		progressTracker.updateTokens(
			estimatedInputTokens,
			estimatedOutputTokens,
			true
		);
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
	const { lastPartialObject, estimatedOutputTokens, taskCount, usage } = state;

	if (!lastPartialObject?.tasks || !Array.isArray(lastPartialObject.tasks)) {
		throw new Error('No tasks generated from streamObject');
	}

	// Use actual token counts if available, otherwise use estimates
	const finalOutputTokens = usage?.completionTokens || estimatedOutputTokens;
	const finalInputTokens = usage?.promptTokens || context.estimatedInputTokens;

	if (context.progressTracker) {
		await updateFinalProgress(
			lastPartialObject.tasks,
			taskCount,
			usage ? finalOutputTokens : estimatedOutputTokens,
			context,
			usage ? finalInputTokens : null
		);
	}

	return {
		parsedTasks: lastPartialObject.tasks,
		estimatedOutputTokens: finalOutputTokens,
		actualInputTokens: finalInputTokens,
		usage,
		usedFallback: false
	};
}

/**
 * Update progress tracker with final task content
 */
async function updateFinalProgress(
	tasks,
	taskCount,
	outputTokens,
	context,
	actualInputTokens = null
) {
	const { progressTracker, defaultPriority, estimatedInputTokens } = context;

	if (taskCount > 0) {
		updateTaskLines(tasks, progressTracker, defaultPriority);
	} else {
		await reportAllTasks(tasks, outputTokens, context);
	}

	progressTracker.updateTokens(
		actualInputTokens || estimatedInputTokens,
		outputTokens,
		false
	);
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
 * Process with generateObject as fallback when streaming fails
 */
async function processWithGenerateObject(context, logger) {
	logger.report('Using generateObject fallback for PRD parsing', 'info');

	// Show placeholder tasks while generating
	if (context.progressTracker) {
		for (let i = 0; i < context.numTasks; i++) {
			context.progressTracker.addTaskLine(
				i + 1,
				`Generating task ${i + 1}...`,
				context.defaultPriority
			);
			context.progressTracker.updateTokens(
				context.estimatedInputTokens,
				0,
				true
			);
		}
	}

	// Use generateObjectService instead of streaming
	const result = await generateObjectService({
		role: context.config.research ? 'research' : 'main',
		commandName: 'parse-prd',
		prompt: context.prompt,
		systemPrompt: context.systemPrompt,
		schema: context.config.schema,
		outputFormat: context.config.outputFormat || 'text',
		projectRoot: context.config.projectRoot,
		session: context.config.session
	});

	// Extract tasks from the result (handle both direct tasks and mainResult.tasks)
	const tasks = result?.mainResult || result;

	// Process the generated tasks
	if (tasks && Array.isArray(tasks.tasks)) {
		// Update progress tracker with final tasks
		if (context.progressTracker) {
			for (let i = 0; i < tasks.tasks.length; i++) {
				const task = tasks.tasks[i];
				if (task && task.title) {
					context.progressTracker.addTaskLine(
						i + 1,
						task.title,
						task.priority || context.defaultPriority
					);
				}
			}

			// Final token update - use actual telemetry if available
			const outputTokens =
				result.telemetryData?.outputTokens ||
				estimateTokens(JSON.stringify(tasks));
			const inputTokens =
				result.telemetryData?.inputTokens || context.estimatedInputTokens;

			context.progressTracker.updateTokens(inputTokens, outputTokens, false);
		}

		return {
			parsedTasks: tasks.tasks,
			estimatedOutputTokens:
				result.telemetryData?.outputTokens ||
				estimateTokens(JSON.stringify(tasks)),
			actualInputTokens: result.telemetryData?.inputTokens,
			telemetryData: result.telemetryData,
			usedFallback: true
		};
	}

	throw new Error('Failed to generate tasks using generateObject fallback');
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

	// If we have actual usage data from streaming, update the AI service response
	if (streamingResult.usage && aiServiceResponse) {
		// Map the Vercel AI SDK usage format to our telemetry format
		const usage = streamingResult.usage;
		if (!aiServiceResponse.usage) {
			aiServiceResponse.usage = {
				promptTokens: usage.promptTokens || 0,
				completionTokens: usage.completionTokens || 0,
				totalTokens: usage.totalTokens || 0
			};
		}

		// The telemetry should have been logged in the unified service runner
		// but if not, the usage is now available for telemetry calculation
	}

	return {
		parsedTasks: streamingResult.parsedTasks,
		aiServiceResponse,
		estimatedInputTokens:
			streamingResult.actualInputTokens || estimatedInputTokens,
		estimatedOutputTokens: streamingResult.estimatedOutputTokens,
		usedFallback: streamingResult.usedFallback,
		progressTracker,
		summary
	};
}
