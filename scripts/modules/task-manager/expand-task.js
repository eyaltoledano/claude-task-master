import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

import {
	log,
	readJSON,
	writeJSON,
	isSilentMode,
	getTagAwareFilePath
} from '../utils.js';

import {
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';

import {
	generateTextService,
	streamTextService
} from '../ai-services-unified.js';
import { parseStream } from '../../../src/utils/stream-parser.js';
import { createExpandTracker } from '../../../src/progress/expand-tracker.js';
import {
	displayExpandStart,
	displayExpandSummary
} from '../../../src/ui/expand.js';

import { getDefaultSubtasks, getDebugFlag } from '../config-manager.js';
import { getPromptManager } from '../prompt-manager.js';
import generateTaskFiles from './generate-task-files.js';
import { COMPLEXITY_REPORT_FILE } from '../../../src/constants/paths.js';
import { ContextGatherer } from '../utils/contextGatherer.js';
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';
import { flattenTasksWithSubtasks, findProjectRoot } from '../utils.js';
import { parseSubtasksFromText } from './subtask-parser.js';

/**
 * Expand a task into subtasks using the unified AI service (generateTextService).
 * Appends new subtasks by default. Replaces existing subtasks if force=true.
 * Integrates complexity report to determine subtask count and prompt if available,
 * unless numSubtasks is explicitly provided.
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} taskId - Task ID to expand
 * @param {number | null | undefined} [numSubtasks] - Optional: Explicit target number of subtasks. If null/undefined, check complexity report or config default.
 * @param {boolean} [useResearch=false] - Whether to use the research AI role.
 * @param {string} [additionalContext=''] - Optional additional context.
 * @param {Object} context - Context object containing session and mcpLog.
 * @param {Object} [context.session] - Session object from MCP.
 * @param {Object} [context.mcpLog] - MCP logger object.
 * @param {boolean} [context.isChildOperation=false] - If true, indicates this is called from expandAllTasks to control UI display.
 * @param {string} [context.projectRoot] - Project root path
 * @param {string} [context.tag] - Tag for the task
 * @param {boolean} [force=false] - If true, replace existing subtasks; otherwise, append.
 * @returns {Promise<Object>} The updated parent task object with new subtasks.
 * @throws {Error} If task not found, AI service fails, or parsing fails.
 */
async function expandTask(
	tasksPath,
	taskId,
	numSubtasks,
	useResearch = false,
	additionalContext = '',
	context = {},
	force = false
) {
	const {
		session,
		mcpLog,
		projectRoot: contextProjectRoot,
		tag,
		complexityReportPath,
		parentTracker,
		isChildOperation = false
	} = context;
	const outputFormat = mcpLog ? 'json' : 'text';
	const isChildExpansion = isChildOperation;

	// Determine projectRoot: Use from context if available, otherwise derive from tasksPath
	const projectRoot = contextProjectRoot || findProjectRoot(tasksPath);

	// Use mcpLog if available, otherwise use the default console log wrapper
	const logger = mcpLog || {
		info: (msg) => !isSilentMode() && log('info', msg),
		warn: (msg) => !isSilentMode() && log('warn', msg),
		error: (msg) => !isSilentMode() && log('error', msg),
		debug: (msg) =>
			!isSilentMode() && getDebugFlag(session) && log('debug', msg) // Use getDebugFlag
	};

	if (mcpLog) {
		logger.info(`expandTask called with context: session=${!!session}`);
	}

	try {
		// --- Task Loading/Filtering (Unchanged) ---
		logger.debug(`Reading tasks from ${tasksPath}`);
		const data = readJSON(tasksPath, projectRoot, tag);
		if (!data || !data.tasks)
			throw new Error(`Invalid tasks data in ${tasksPath}`);
		const taskIndex = data.tasks.findIndex(
			(t) => t.id === parseInt(taskId, 10)
		);
		if (taskIndex === -1) throw new Error(`Task ${taskId} not found`);
		const task = data.tasks[taskIndex];
		logger.debug(
			`Expanding task ${taskId}: ${task.title}${useResearch ? ' with research' : ''}`
		);
		// --- End Task Loading/Filtering ---

		// --- Handle Force Flag: Clear existing subtasks if force=true ---
		if (force && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
			logger.debug(
				`Force flag set. Clearing existing ${task.subtasks.length} subtasks for task ${taskId}.`
			);
			task.subtasks = []; // Clear existing subtasks
		}
		// --- End Force Flag Handling ---

		// --- Context Gathering ---
		let gatheredContext = '';
		try {
			const contextGatherer = new ContextGatherer(projectRoot, tag);
			const allTasksFlat = flattenTasksWithSubtasks(data.tasks);
			const fuzzySearch = new FuzzyTaskSearch(allTasksFlat, 'expand-task');
			const searchQuery = `${task.title} ${task.description}`;
			const searchResults = fuzzySearch.findRelevantTasks(searchQuery, {
				maxResults: 5,
				includeSelf: true
			});
			const relevantTaskIds = fuzzySearch.getTaskIds(searchResults);

			const finalTaskIds = [
				...new Set([taskId.toString(), ...relevantTaskIds])
			];

			if (finalTaskIds.length > 0) {
				const contextResult = await contextGatherer.gather({
					tasks: finalTaskIds,
					format: 'research'
				});
				gatheredContext = contextResult.context || '';
			}
		} catch (contextError) {
			logger.warn(`Could not gather context: ${contextError.message}`);
		}
		// --- End Context Gathering ---

		// --- Complexity Report Integration ---
		let finalSubtaskCount;
		let complexityReasoningContext = '';
		let taskAnalysis = null;

		logger.debug(
			`Looking for complexity report at: ${complexityReportPath}${tag !== 'master' ? ` (tag-specific for '${tag}')` : ''}`
		);

		try {
			if (fs.existsSync(complexityReportPath)) {
				const complexityReport = readJSON(complexityReportPath);
				taskAnalysis = complexityReport?.complexityAnalysis?.find(
					(a) => a.taskId === task.id
				);
				if (taskAnalysis) {
					logger.debug(
						`Found complexity analysis for task ${task.id}: Score ${taskAnalysis.complexityScore}`
					);
					if (taskAnalysis.reasoning) {
						complexityReasoningContext = `\nComplexity Analysis Reasoning: ${taskAnalysis.reasoning}`;
					}
				} else {
					logger.info(
						`No complexity analysis found for task ${task.id} in report.`
					);
				}
			} else {
				logger.info(
					`Complexity report not found at ${complexityReportPath}. Skipping complexity check.`
				);
			}
		} catch (reportError) {
			logger.warn(
				`Could not read or parse complexity report: ${reportError.message}. Proceeding without it.`
			);
		}

		// Determine final subtask count
		const explicitNumSubtasks = parseInt(numSubtasks, 10);
		if (!Number.isNaN(explicitNumSubtasks) && explicitNumSubtasks >= 0) {
			finalSubtaskCount = explicitNumSubtasks;
			logger.debug(
				`Using explicitly provided subtask count: ${finalSubtaskCount}`
			);
		} else if (taskAnalysis?.recommendedSubtasks) {
			finalSubtaskCount = parseInt(taskAnalysis.recommendedSubtasks, 10);
			logger.debug(
				`Using subtask count from complexity report: ${finalSubtaskCount}`
			);
		} else {
			finalSubtaskCount = getDefaultSubtasks(session);
			logger.debug(`Using default number of subtasks: ${finalSubtaskCount}`);
		}
		if (Number.isNaN(finalSubtaskCount) || finalSubtaskCount < 0) {
			logger.warn(
				`Invalid subtask count determined (${finalSubtaskCount}), defaulting to 3.`
			);
			finalSubtaskCount = 3;
		}

		// Determine prompt content AND system prompt
		const nextSubtaskId = (task.subtasks?.length || 0) + 1;

		// Load prompts using PromptManager
		const promptManager = getPromptManager();

		// Combine all context sources into a single additionalContext parameter
		let combinedAdditionalContext = '';
		if (additionalContext || complexityReasoningContext) {
			combinedAdditionalContext =
				`\n\n${additionalContext}${complexityReasoningContext}`.trim();
		}
		if (gatheredContext) {
			combinedAdditionalContext =
				`${combinedAdditionalContext}\n\n# Project Context\n\n${gatheredContext}`.trim();
		}

		// Ensure expansionPrompt is a string (handle both string and object formats)
		let expansionPromptText = undefined;
		if (taskAnalysis?.expansionPrompt) {
			if (typeof taskAnalysis.expansionPrompt === 'string') {
				expansionPromptText = taskAnalysis.expansionPrompt;
			} else if (
				typeof taskAnalysis.expansionPrompt === 'object' &&
				taskAnalysis.expansionPrompt.text
			) {
				expansionPromptText = taskAnalysis.expansionPrompt.text;
			}
		}

		// Ensure gatheredContext is a string (handle both string and object formats)
		let gatheredContextText = gatheredContext;
		if (typeof gatheredContext === 'object' && gatheredContext !== null) {
			if (gatheredContext.data) {
				gatheredContextText = gatheredContext.data;
			} else if (gatheredContext.text) {
				gatheredContextText = gatheredContext.text;
			} else {
				gatheredContextText = JSON.stringify(gatheredContext);
			}
		}

		const promptParams = {
			task: task,
			subtaskCount: finalSubtaskCount,
			nextSubtaskId: nextSubtaskId,
			additionalContext: additionalContext,
			complexityReasoningContext: complexityReasoningContext,
			gatheredContext: gatheredContextText || '',
			useResearch: useResearch,
			expansionPrompt: expansionPromptText || undefined
		};

		let variantKey = 'default';
		if (expansionPromptText) {
			variantKey = 'complexity-report';
			logger.info(
				`Using expansion prompt from complexity report and simplified system prompt for task ${task.id}.`
			);
		} else if (useResearch) {
			variantKey = 'research';
			logger.info(`Using research variant for task ${task.id}.`);
		} else {
			logger.info(`Using standard prompt generation for task ${task.id}.`);
		}

		const { systemPrompt, userPrompt: promptContent } =
			await promptManager.loadPrompt('expand-task', promptParams, variantKey);
		// --- End Complexity Report / Prompt Logic ---

		// --- AI Subtask Generation ---
		let generatedSubtasks = [];
		let loadingIndicator = null;
		let aiServiceResponse = null;

		// Determine if we should use streaming (same pattern as parse-prd)
		const isMCP = !!mcpLog;
		const reportProgress = context.reportProgress;
		const shouldUseStreaming =
			typeof reportProgress === 'function' || outputFormat === 'text';

		// Initialize progress tracker for CLI mode only (not MCP, and not child expansion)
		let progressTracker = null;
		if (outputFormat === 'text' && !isMCP && !isChildExpansion) {
			progressTracker = createExpandTracker({
				expandType: 'single',
				numTasks: finalSubtaskCount, // Track number of subtasks being generated
				taskId: task.id,
				taskTitle: task.title,
				taskPriority: task.priority
			});

			// Display header
			displayExpandStart({
				taskId: task.id,
				tasksFilePath: tasksPath,
				numSubtasks: finalSubtaskCount,
				explicitSubtasks: Boolean(numSubtasks),
				complexityScore: taskAnalysis?.complexityScore,
				hasComplexityAnalysis: Boolean(taskAnalysis),
				force: force,
				research: useResearch,
				expandType: 'single'
			});

			progressTracker.start();
		}

		// Estimate input tokens
		// Our prompts contain a mix of prose and JSON schemas/examples
		// Empirically, we see ~3-4 chars per token for this type of content
		const totalPromptLength = systemPrompt.length + promptContent.length;
		const estimatedInputTokens = Math.ceil(totalPromptLength / 3.5);

		// Debug logging to check our estimates
		logger.debug(
			`Prompt lengths - System: ${systemPrompt.length}, User: ${promptContent.length}, Total: ${totalPromptLength}`
		);
		logger.debug(`Estimated input tokens: ${estimatedInputTokens}`);

		// Report initial progress for MCP
		if (reportProgress) {
			await reportProgress({
				type: 'subtask_generation_start',
				progress: 0,
				current: 0,
				total: finalSubtaskCount,
				taskId: task.id,
				taskTitle: task.title,
				inputTokens: estimatedInputTokens,
				message: `Starting subtask generation for Task ${task.id}${useResearch ? ' with research' : ''}... (Input: ${estimatedInputTokens} tokens)`
			});
		}

		try {
			const role = useResearch ? 'research' : 'main';

			if (shouldUseStreaming) {
				// Use streaming approach
				logger.debug(`Using streaming AI service for subtask generation...`);

				aiServiceResponse = await streamTextService({
					prompt: promptContent,
					systemPrompt: systemPrompt,
					role,
					session,
					projectRoot,
					commandName: 'expand-task',
					outputType: isMCP ? 'mcp' : 'cli'
				});

				const textStream = aiServiceResponse.mainResult;
				if (!textStream) {
					throw new Error('No text stream received from AI service');
				}

				// Create progress callback for parseStream
				const onProgress = async (subtask, metadata) => {
					const { currentCount, estimatedTokens } = metadata;

					// CLI progress tracker
					if (progressTracker) {
						// For single task expansion, update the progress bar directly
						progressTracker.progressBar.update(currentCount, {
							tasks: `${currentCount}/${finalSubtaskCount}`
						});

						// Track subtask generation for time estimation
						progressTracker.updateSubtaskGeneration(currentCount);

						// Update tokens with estimates during streaming (will be replaced with actuals later)
						if (estimatedTokens) {
							// estimatedTokens from parseStream is ONLY the output tokens (from accumulated response)
							// Use our pre-calculated input estimate
							const inputEstimate = estimatedInputTokens; // From our calculation above
							const outputEstimate = estimatedTokens; // This is already just output tokens

							// Show estimates with a ~ prefix to indicate they're not final
							progressTracker.updateTokens(inputEstimate, outputEstimate);
						}

						// Add the subtask to the table display
						const subtaskId = nextSubtaskId + currentCount - 1;
						progressTracker.addSubtaskLine(
							subtaskId,
							subtask.title || `Subtask ${currentCount}`
						);
					}

					// Update parent tracker if this is a child expansion
					if (parentTracker && isChildExpansion) {
						// Don't update token counts during streaming - wait for final telemetry
						// The estimated tokens during streaming are not accurate

						// Update subtask progress in parent
						parentTracker.updateCurrentTaskSubtaskProgress(currentCount);

						// Increment the global subtask count for real-time updates
						parentTracker.incrementSubtaskCount();
					}

					// Call the onSubtaskProgress callback if provided (for MCP in expand-all)
					if (
						context.onSubtaskProgress &&
						typeof context.onSubtaskProgress === 'function'
					) {
						await context.onSubtaskProgress(currentCount);
					}

					// MCP progress reporting (following the pattern from parse-prd and analyze-complexity)
					if (reportProgress) {
						try {
							// Estimate output tokens for this subtask
							const outputTokens = estimatedTokens
								? Math.floor(estimatedTokens / finalSubtaskCount)
								: 0;

							await reportProgress({
								type: 'subtask_generation',
								current: currentCount,
								total: finalSubtaskCount,
								taskId: task.id,
								taskTitle: task.title,
								subtaskId: nextSubtaskId + currentCount - 1,
								subtaskTitle: subtask.title || `Subtask ${currentCount}`,
								inputTokens:
									metadata.estimatedInputTokens || estimatedInputTokens,
								outputTokens: outputTokens,
								message: `Generated subtask ${currentCount}/${finalSubtaskCount}: ${subtask.title || 'Processing...'}`
							});
						} catch (error) {
							logger.warn(`Progress reporting failed: ${error.message}`);
						}
					}
				};

				// Fallback extractor for subtasks
				const fallbackItemExtractor = (fullResponse) => {
					return fullResponse.subtasks || [];
				};

				const parseResult = await parseStream(textStream, {
					jsonPaths: ['$.subtasks.*'],
					onProgress: onProgress,
					onError: (error) => {
						logger.debug(`JSON parsing error: ${error.message}`);
					},
					estimateTokens: (text) => Math.ceil(text.length / 3.5), // Match our input estimation ratio
					expectedTotal: finalSubtaskCount,
					fallbackItemExtractor
				});

				const { items: parsedSubtasks, usedFallback } = parseResult;

				if (usedFallback) {
					logger.info(`Fallback parsing recovered additional subtasks`);
				}

				// Validate and correct subtasks
				generatedSubtasks = parsedSubtasks.map((subtask, index) => {
					const correctedId = nextSubtaskId + index;
					return {
						...subtask,
						id: correctedId,
						status: 'pending',
						dependencies: Array.isArray(subtask.dependencies)
							? subtask.dependencies.filter(
									(depId) => depId >= nextSubtaskId && depId < correctedId
								)
							: []
					};
				});

				logger.debug(
					`Successfully generated ${generatedSubtasks.length} subtasks via streaming`
				);
			} else {
				// Use non-streaming approach (fallback)
				if (outputFormat === 'text') {
					loadingIndicator = startLoadingIndicator(
						`Generating ${finalSubtaskCount || 'appropriate number of'} subtasks...\n`
					);
				}

				aiServiceResponse = await generateTextService({
					prompt: promptContent,
					systemPrompt: systemPrompt,
					role,
					session,
					projectRoot,
					commandName: 'expand-task',
					outputType: outputFormat
				});
				const responseText = aiServiceResponse.mainResult;

				// Parse Subtasks
				generatedSubtasks = parseSubtasksFromText(
					responseText,
					nextSubtaskId,
					finalSubtaskCount,
					task.id,
					logger
				);
				logger.debug(
					`Successfully parsed ${generatedSubtasks.length} subtasks from AI response.`
				);
			}
		} catch (streamingError) {
			// Check if this is a streaming-specific error and fallback
			const errorMessage = streamingError.message || '';
			logger.debug(`Streaming error caught: ${errorMessage}`);
			logger.debug(`Error stack: ${streamingError.stack}`);

			const streamingErrorPatterns = [
				'not async iterable',
				'Failed to process AI text stream',
				'Stream object is not iterable',
				'Failed to parse AI response as JSON',
				'No text stream received'
			];
			const isStreamingError =
				shouldUseStreaming &&
				streamingErrorPatterns.some((pattern) =>
					errorMessage.includes(pattern)
				);

			if (isStreamingError) {
				logger.warn(`Streaming failed, falling back to non-streaming mode...`);

				// Stop progress tracker if it was started
				if (progressTracker) {
					await progressTracker.stop();
					progressTracker = null;
				}

				// Show fallback message for CLI
				if (outputFormat === 'text' && !isMCP) {
					console.log(
						chalk.yellow(
							`Streaming failed, falling back to non-streaming mode...`
						)
					);
				}

				// Fallback to non-streaming
				if (outputFormat === 'text') {
					loadingIndicator = startLoadingIndicator(
						`Generating ${finalSubtaskCount || 'appropriate number of'} subtasks...\n`
					);
				}

				try {
					const role = useResearch ? 'research' : 'main';
					aiServiceResponse = await generateTextService({
						prompt: promptContent,
						systemPrompt: systemPrompt,
						role,
						session,
						projectRoot,
						commandName: 'expand-task',
						outputType: outputFormat
					});
					const responseText = aiServiceResponse.mainResult;

					generatedSubtasks = parseSubtasksFromText(
						responseText,
						nextSubtaskId,
						finalSubtaskCount,
						task.id,
						logger
					);
					logger.debug(
						`Successfully parsed ${generatedSubtasks.length} subtasks via fallback`
					);
				} catch (fallbackError) {
					if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
					throw fallbackError;
				}
			} else {
				// Not a streaming error, re-throw
				if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
				throw streamingError;
			}
		} finally {
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
		}

		// Update tracker with telemetry data if available
		if (progressTracker && aiServiceResponse?.telemetryData) {
			progressTracker.addTelemetryData(aiServiceResponse.telemetryData);
		}

		// Update parent tracker with telemetry data if this is a child expansion
		if (parentTracker && isChildExpansion && aiServiceResponse?.telemetryData) {
			parentTracker.addTelemetryData(aiServiceResponse.telemetryData);
		}

		// Stop progress tracker for CLI mode
		if (progressTracker) {
			// For single task expansion, manually update the final count
			progressTracker.subtasksCreated = generatedSubtasks.length;
			progressTracker.completedExpansions = 1;

			await progressTracker.stop();

			// Display summary
			const summary = progressTracker.getSummary();
			displayExpandSummary({
				taskId: task.id,
				totalSubtasksCreated: generatedSubtasks.length,
				tasksFilePath: tasksPath,
				elapsedTime: summary.elapsedTime,
				force: force,
				research: useResearch,
				explicitSubtasks: Boolean(numSubtasks),
				complexityScore: taskAnalysis?.complexityScore,
				hasComplexityAnalysis: Boolean(taskAnalysis),
				expandType: 'single'
			});
		}

		// Final progress report for MCP
		if (reportProgress) {
			// Use actual telemetry if available, otherwise fall back to estimates
			const hasValidTelemetry =
				aiServiceResponse?.telemetryData &&
				(aiServiceResponse.telemetryData.inputTokens > 0 ||
					aiServiceResponse.telemetryData.outputTokens > 0);

			let completionMessage;
			if (hasValidTelemetry) {
				// Use actual telemetry data with cost
				const cost = aiServiceResponse.telemetryData.totalCost || 0;
				const currency = aiServiceResponse.telemetryData.currency || 'USD';
				completionMessage = `✅ Subtask generation completed for Task ${task.id} | Tokens (I/O): ${aiServiceResponse.telemetryData.inputTokens}/${aiServiceResponse.telemetryData.outputTokens} | Cost: ${currency === 'USD' ? '$' : currency}${cost.toFixed(4)}`;
			} else {
				// Use estimates and indicate they're estimates
				const estimatedOutputTokens = generatedSubtasks.length * 150; // Rough estimate per subtask
				completionMessage = `✅ Subtask generation completed for Task ${task.id} | ~Tokens (I/O): ${estimatedInputTokens}/${estimatedOutputTokens} | Cost: ~$0.00`;
			}

			await reportProgress({
				type: 'subtask_generation_complete',
				progress: finalSubtaskCount,
				current: finalSubtaskCount,
				total: finalSubtaskCount,
				taskId: task.id,
				taskTitle: task.title,
				subtasksGenerated: generatedSubtasks.length,
				inputTokens: hasValidTelemetry
					? aiServiceResponse.telemetryData.inputTokens
					: estimatedInputTokens,
				outputTokens: hasValidTelemetry
					? aiServiceResponse.telemetryData.outputTokens
					: generatedSubtasks.length * 150,
				totalCost: hasValidTelemetry
					? aiServiceResponse.telemetryData.totalCost
					: 0,
				currency: hasValidTelemetry
					? aiServiceResponse.telemetryData.currency
					: 'USD',
				message: completionMessage
			});
		}

		// --- Task Update & File Writing ---
		// Ensure task.subtasks is an array before appending
		if (!Array.isArray(task.subtasks)) {
			task.subtasks = [];
		}
		// Append the newly generated and validated subtasks
		task.subtasks.push(...generatedSubtasks);
		// --- End Change: Append instead of replace ---

		data.tasks[taskIndex] = task; // Assign the modified task back
		writeJSON(tasksPath, data, projectRoot, tag);
		// await generateTaskFiles(tasksPath, path.dirname(tasksPath));

		// Display AI Usage Summary for CLI (skip if child expansion - parent will handle it)
		if (
			outputFormat === 'text' &&
			aiServiceResponse &&
			aiServiceResponse.telemetryData &&
			!isChildExpansion
		) {
			displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
		}

		// Return the updated task object AND telemetry data
		return {
			task,
			telemetryData: aiServiceResponse?.telemetryData,
			tagInfo: aiServiceResponse?.tagInfo
		};
	} catch (error) {
		// Catches errors from file reading, parsing, AI call etc.
		logger.error(`Error expanding task ${taskId}: ${error.message}`, 'error');
		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.error(error); // Log full stack in debug CLI mode
		}
		throw error; // Re-throw for the caller
	}
}

export default expandTask;
