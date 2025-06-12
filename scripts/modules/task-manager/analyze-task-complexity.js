import chalk from 'chalk';
import boxen from 'boxen';
import readline from 'readline';
import fs from 'fs';

import { log, readJSON, writeJSON, isSilentMode } from '../utils.js';

import {
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';

import {
	displayAnalyzeComplexityStart,
	displayAnalyzeComplexitySummary
} from '../../../src/ui/analyze-complexity.js';

import {
	generateTextService,
	streamTextService
} from '../ai-services-unified.js';
import { parseStream } from '../../../src/utils/stream-parser.js';
import { createAnalyzeComplexityTracker } from '../../../src/progress/analyze-complexity-tracker.js';

import { getDebugFlag, getProjectName, getConfig } from '../config-manager.js';
import {
	COMPLEXITY_REPORT_FILE,
	LEGACY_TASKS_FILE
} from '../../../src/constants/paths.js';

/**
 * Generates the prompt for complexity analysis.
 * (Moved from ai-services.js and simplified)
 * @param {Object} tasksData - The tasks data object.
 * @returns {string} The generated prompt.
 */
function generateInternalComplexityAnalysisPrompt(tasksData) {
	const tasksString = JSON.stringify(tasksData.tasks, null, 2);
	return `Analyze the following tasks to determine their complexity (1-10 scale) and recommend the number of subtasks for expansion. Provide a brief reasoning and an initial expansion prompt for each.

Tasks:
${tasksString}

Respond ONLY with a valid JSON array matching the schema:
[
  {
    "taskId": <number>,
    "taskTitle": "<string>",
    "complexityScore": <number 1-10>,
    "recommendedSubtasks": <number>,
    "expansionPrompt": "<string>",
    "reasoning": "<string>"
  },
  ...
]

Do not include any explanatory text, markdown formatting, or code block markers before or after the JSON array.`;
}

/**
 * Analyzes task complexity and generates expansion recommendations
 * @param {Object} options Command options
 * @param {string} options.file - Path to tasks file
 * @param {string} options.output - Path to report output file
 * @param {string|number} [options.threshold] - Complexity threshold
 * @param {boolean} [options.research] - Use research role
 * @param {string} [options.projectRoot] - Project root path (for MCP/env fallback).
 * @param {string} [options.id] - Comma-separated list of task IDs to analyze specifically
 * @param {number} [options.from] - Starting task ID in a range to analyze
 * @param {number} [options.to] - Ending task ID in a range to analyze
 * @param {Object} [options._filteredTasksData] - Pre-filtered task data (internal use)
 * @param {number} [options._originalTaskCount] - Original task count (internal use)
 * @param {Object} context - Context object, potentially containing session and mcpLog
 * @param {Object} [context.session] - Session object from MCP server (optional)
 * @param {Object} [context.mcpLog] - MCP logger object (optional)
 * @param {function} [context.reportProgress] - Function to report progress for MCP streaming
 */
async function analyzeTaskComplexity(options, context = {}) {
	const { session, mcpLog, reportProgress } = context;
	const tasksPath = options.file || LEGACY_TASKS_FILE;
	const outputPath = options.output || COMPLEXITY_REPORT_FILE;
	const thresholdScore = parseFloat(options.threshold || '5');
	const useResearch = options.research || false;
	const projectRoot = options.projectRoot;
	// New parameters for task ID filtering
	const specificIds = options.id
		? options.id
				.split(',')
				.map((id) => parseInt(id.trim(), 10))
				.filter((id) => !Number.isNaN(id))
		: null;
	const fromId = options.from !== undefined ? parseInt(options.from, 10) : null;
	const toId = options.to !== undefined ? parseInt(options.to, 10) : null;

	const outputFormat = mcpLog ? 'json' : 'text';

	const reportLog = (message, level = 'info') => {
		if (mcpLog) {
			mcpLog[level](message);
		} else if (!isSilentMode() && outputFormat === 'text') {
			log(level, message);
		}
	};

	// Display header for CLI mode
	if (outputFormat === 'text') {
		// Get model configuration for display
		const config = getConfig(session);
		// Use research model if research mode is enabled, otherwise main model
		const modelConfig = useResearch
			? config?.models?.research
			: config?.models?.main;
		const model = modelConfig?.modelId || modelConfig || 'Default';
		const temperature =
			modelConfig?.temperature || config?.aiParameters?.temperature || 0.7;

		// Determine analysis scope description
		let analysisScope = 'all pending tasks';
		if (specificIds && specificIds.length > 0) {
			analysisScope = `specific task IDs: ${specificIds.join(', ')}`;
		} else if (fromId !== null || toId !== null) {
			const effectiveFromId = fromId !== null ? fromId : 1;
			const effectiveToId = toId !== null ? toId : 'end';
			analysisScope = `task range: ${effectiveFromId} to ${effectiveToId}`;
		}

		// Store header info for later display after we know the task count
		var headerInfo = {
			tasksFilePath: tasksPath,
			outputPath: outputPath,
			model: model,
			temperature: temperature,
			research: useResearch,
			threshold: thresholdScore,
			analysisScope: analysisScope
		};
	}

	try {
		reportLog(`Reading tasks from ${tasksPath}...`, 'info');
		let tasksData;
		let originalTaskCount = 0;
		let originalData = null;

		if (options._filteredTasksData) {
			tasksData = options._filteredTasksData;
			originalTaskCount = options._originalTaskCount || tasksData.tasks.length;
			if (!options._originalTaskCount) {
				try {
					originalData = readJSON(tasksPath);
					if (originalData && originalData.tasks) {
						originalTaskCount = originalData.tasks.length;
					}
				} catch (e) {
					log('warn', `Could not read original tasks file: ${e.message}`);
				}
			}
		} else {
			originalData = readJSON(tasksPath);
			if (
				!originalData ||
				!originalData.tasks ||
				!Array.isArray(originalData.tasks) ||
				originalData.tasks.length === 0
			) {
				throw new Error('No tasks found in the tasks file');
			}
			originalTaskCount = originalData.tasks.length;

			// Filter tasks based on active status
			const activeStatuses = ['pending', 'blocked', 'in-progress'];
			let filteredTasks = originalData.tasks.filter((task) =>
				activeStatuses.includes(task.status?.toLowerCase() || 'pending')
			);

			// Apply ID filtering if specified
			if (specificIds && specificIds.length > 0) {
				reportLog(
					`Filtering tasks by specific IDs: ${specificIds.join(', ')}`,
					'info'
				);
				filteredTasks = filteredTasks.filter((task) =>
					specificIds.includes(task.id)
				);

				if (outputFormat === 'text') {
					if (filteredTasks.length === 0 && specificIds.length > 0) {
						console.log(
							chalk.yellow(
								`Warning: No active tasks found with IDs: ${specificIds.join(', ')}`
							)
						);
					} else if (filteredTasks.length < specificIds.length) {
						const foundIds = filteredTasks.map((t) => t.id);
						const missingIds = specificIds.filter(
							(id) => !foundIds.includes(id)
						);
						console.log(
							chalk.yellow(
								`Warning: Some requested task IDs were not found or are not active: ${missingIds.join(', ')}`
							)
						);
					}
				}
			}
			// Apply range filtering if specified
			else if (fromId !== null || toId !== null) {
				const effectiveFromId = fromId !== null ? fromId : 1;
				const effectiveToId =
					toId !== null
						? toId
						: Math.max(...originalData.tasks.map((t) => t.id));

				reportLog(
					`Filtering tasks by ID range: ${effectiveFromId} to ${effectiveToId}`,
					'info'
				);
				filteredTasks = filteredTasks.filter(
					(task) => task.id >= effectiveFromId && task.id <= effectiveToId
				);

				if (outputFormat === 'text' && filteredTasks.length === 0) {
					console.log(
						chalk.yellow(
							`Warning: No active tasks found in range: ${effectiveFromId}-${effectiveToId}`
						)
					);
				}
			}

			tasksData = {
				...originalData,
				tasks: filteredTasks,
				_originalTaskCount: originalTaskCount
			};
		}

		const skippedCount = originalTaskCount - tasksData.tasks.length;
		reportLog(
			`Found ${originalTaskCount} total tasks in the task file.`,
			'info'
		);

		// Display header now that we know the task count
		if (outputFormat === 'text' && headerInfo) {
			displayAnalyzeComplexityStart({
				...headerInfo,
				numTasks: tasksData.tasks.length
			});
		}

		// Updated messaging to reflect filtering logic
		if (specificIds || fromId !== null || toId !== null) {
			const filterMsg = specificIds
				? `Analyzing ${tasksData.tasks.length} tasks with specific IDs: ${specificIds.join(', ')}`
				: `Analyzing ${tasksData.tasks.length} tasks in range: ${fromId || 1} to ${toId || 'end'}`;

			reportLog(filterMsg, 'info');
			if (outputFormat === 'text') {
				console.log(chalk.blue(filterMsg));
			}
		} else if (skippedCount > 0) {
			const skipMessage = `Skipping ${skippedCount} tasks marked as done/cancelled/deferred. Analyzing ${tasksData.tasks.length} active tasks.`;
			reportLog(skipMessage, 'info');
			if (outputFormat === 'text') {
				console.log(chalk.yellow(skipMessage));
			}
		}

		// Check for existing report before doing analysis
		let existingReport = null;
		let existingAnalysisMap = new Map(); // For quick lookups by task ID
		try {
			if (fs.existsSync(outputPath)) {
				existingReport = readJSON(outputPath);
				reportLog(`Found existing complexity report at ${outputPath}`, 'debug');

				if (
					existingReport &&
					existingReport.complexityAnalysis &&
					Array.isArray(existingReport.complexityAnalysis)
				) {
					// Create lookup map of existing analysis entries
					existingReport.complexityAnalysis.forEach((item) => {
						existingAnalysisMap.set(item.taskId, item);
					});
					reportLog(
						`Existing report contains ${existingReport.complexityAnalysis.length} task analyses`,
						'debug'
					);
				}
			}
		} catch (readError) {
			reportLog(
				`Warning: Could not read existing report: ${readError.message}`,
				'warn'
			);
			existingReport = null;
			existingAnalysisMap.clear();
		}

		if (tasksData.tasks.length === 0) {
			// If using ID filtering but no matching tasks, return existing report or empty
			if (existingReport && (specificIds || fromId !== null || toId !== null)) {
				reportLog(
					`No matching tasks found for analysis. Keeping existing report.`,
					'info'
				);
				if (outputFormat === 'text') {
					console.log(
						chalk.yellow(
							`No matching tasks found for analysis. Keeping existing report.`
						)
					);
				}
				return {
					report: existingReport,
					telemetryData: null
				};
			}

			// Otherwise create empty report
			const emptyReport = {
				meta: {
					generatedAt: new Date().toISOString(),
					tasksAnalyzed: 0,
					thresholdScore: thresholdScore,
					projectName: getProjectName(session),
					usedResearch: useResearch
				},
				complexityAnalysis: existingReport?.complexityAnalysis || []
			};
			reportLog(`Writing complexity report to ${outputPath}...`, 'debug');
			writeJSON(outputPath, emptyReport);
			reportLog(
				`Task complexity analysis complete. Report written to ${outputPath}`,
				'debug'
			);
			if (outputFormat === 'text') {
				console.log(
					chalk.green(
						`Task complexity analysis complete. Report written to ${outputPath}`
					)
				);
				const highComplexity = 0;
				const mediumComplexity = 0;
				const lowComplexity = 0;
				const totalAnalyzed = 0;

				console.log('\nComplexity Analysis Summary:');
				console.log('----------------------------');
				console.log(`Tasks in input file: ${originalTaskCount}`);
				console.log(`Tasks successfully analyzed: ${totalAnalyzed}`);
				console.log(`High complexity tasks: ${highComplexity}`);
				console.log(`Medium complexity tasks: ${mediumComplexity}`);
				console.log(`Low complexity tasks: ${lowComplexity}`);
				console.log(
					`Sum verification: ${highComplexity + mediumComplexity + lowComplexity} (should equal ${totalAnalyzed})`
				);
				console.log(`Research-backed analysis: ${useResearch ? 'Yes' : 'No'}`);
				console.log(
					`\nSee ${outputPath} for the full report and expansion commands.`
				);

				console.log(
					boxen(
						chalk.white.bold('Suggested Next Steps:') +
							'\n\n' +
							`${chalk.cyan('1.')} Run ${chalk.yellow('task-master complexity-report')} to review detailed findings\n` +
							`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down complex tasks\n` +
							`${chalk.cyan('3.')} Run ${chalk.yellow('task-master expand --all')} to expand all pending tasks based on complexity`,
						{
							padding: 1,
							borderColor: 'cyan',
							borderStyle: 'round',
							margin: { top: 1 }
						}
					)
				);
			}
			return {
				report: emptyReport,
				telemetryData: null
			};
		}

		// Continue with regular analysis path
		const prompt = generateInternalComplexityAnalysisPrompt(tasksData);
		const systemPrompt =
			'You are an expert software architect and project manager analyzing task complexity. Respond only with the requested valid JSON array.';

		// Determine if we should use streaming (CLI with progress tracker or MCP with reportProgress)
		const isMCP = !!mcpLog;
		const shouldUseStreaming =
			(outputFormat === 'text' && !isMCP && options.progressTracker) ||
			(isMCP && reportProgress);

		// Debug: Check what's happening with context detection
		if (outputFormat === 'text') {
			reportLog(
				`[DEBUG] Context check: mcpLog=${!!mcpLog}, isMCP=${isMCP}, outputFormat=${outputFormat}, progressTracker=${!!options.progressTracker}, shouldUseStreaming=${shouldUseStreaming}`,
				'debug'
			);
		}

		// Initialize progress tracker for CLI mode only (not MCP) and only if progressTracker option is enabled
		let progressTracker = null;
		if (outputFormat === 'text' && !isMCP && options.progressTracker) {
			progressTracker = createAnalyzeComplexityTracker({
				numTasks: tasksData.tasks.length
			});
		}

		let loadingIndicator = null;
		let aiServiceResponse = null;
		let complexityAnalysis = null;

		try {
			const role = useResearch ? 'research' : 'main';

			if (shouldUseStreaming) {
				// Use streaming approach
				if (progressTracker) {
					progressTracker.start();
				}

				// Create a simple progress callback that handles both CLI and MCP progress
				const onProgress = async (analysis, metadata) => {
					const { currentCount, estimatedTokens } = metadata;
					const complexityScore = analysis.complexityScore || 5;
					const recommendedSubtasks = analysis.recommendedSubtasks;

					// CLI progress tracker (if available)
					if (progressTracker) {
						progressTracker.addAnalysisLine(
							analysis.taskId,
							analysis.taskTitle,
							complexityScore,
							recommendedSubtasks
						);

						// Update tokens display if available
						if (estimatedTokens) {
							progressTracker.updateTokens(
								estimatedInputTokens,
								estimatedTokens
							);
						}
					}

					// MCP progress reporting (if available)
					if (reportProgress) {
						try {
							// Estimate output tokens for this analysis
							const outputTokens = estimatedTokens
								? Math.floor(estimatedTokens / tasksData.tasks.length)
								: 0;

							await reportProgress({
								type: 'analysis_progress',
								current: currentCount,
								total: tasksData.tasks.length,
								taskId: analysis.taskId,
								taskTitle: analysis.taskTitle,
								complexityScore: complexityScore,
								recommendedSubtasks: recommendedSubtasks,
								inputTokens: metadata.estimatedInputTokens || 0,
								outputTokens: outputTokens,
								message: `Analyzed Task ${analysis.taskId}: ${analysis.taskTitle} (Score: ${complexityScore}, Subtasks: ${recommendedSubtasks})`
							});
						} catch (progressError) {
							// Don't fail the entire operation if progress reporting fails
							reportLog(
								`Progress reporting error: ${progressError.message}`,
								'warn'
							);
						}
					}
				};

				// Estimate input tokens for progress tracking
				const estimatedInputTokens = Math.floor(prompt.length / 4);

				// Set initial input tokens on progress tracker
				if (progressTracker) {
					progressTracker.updateTokens(estimatedInputTokens, 0);
				}

				aiServiceResponse = await streamTextService({
					prompt,
					systemPrompt,
					role,
					session,
					projectRoot,
					commandName: 'analyze-complexity',
					outputType: mcpLog ? 'mcp' : 'cli'
				});

				// Parse the streaming response
				const streamParseResult = await parseStream(
					aiServiceResponse.mainResult,
					{
						jsonPaths: ['$.*'], // Match individual items in the array
						onProgress,
						estimateTokens: (text) => Math.floor(text.length / 4),
						expectedTotal: tasksData.tasks.length,
						// Custom validation for complexity analysis items
						itemValidator: (item) => {
							// Complexity analysis uses 'taskTitle' instead of 'title'
							return (
								item &&
								item.taskTitle &&
								typeof item.taskTitle === 'string' &&
								item.taskTitle.trim() &&
								typeof item.taskId !== 'undefined'
							);
						},
						fallbackItemExtractor: (jsonObj) => {
							// Handle different response formats
							if (Array.isArray(jsonObj)) {
								return jsonObj;
							}
							if (jsonObj.analyses && Array.isArray(jsonObj.analyses)) {
								return jsonObj.analyses;
							}
							if (
								jsonObj.complexityAnalysis &&
								Array.isArray(jsonObj.complexityAnalysis)
							) {
								return jsonObj.complexityAnalysis;
							}
							return [];
						}
					}
				);

				complexityAnalysis = streamParseResult.items;

				if (progressTracker) {
					await progressTracker.stop();
				}

				if (outputFormat === 'text') {
					reportLog(
						'Streaming analysis complete. Processing results...',
						'debug'
					);
				}
			} else {
				// Use traditional non-streaming approach (fallback)
				if (outputFormat === 'text') {
					loadingIndicator = startLoadingIndicator(
						`${useResearch ? 'Researching' : 'Analyzing'} the complexity of your tasks with AI...\n`
					);
				}

				aiServiceResponse = await generateTextService({
					prompt,
					systemPrompt,
					role,
					session,
					projectRoot,
					commandName: 'analyze-complexity',
					outputType: mcpLog ? 'mcp' : 'cli'
				});

				if (loadingIndicator) {
					stopLoadingIndicator(loadingIndicator);
					loadingIndicator = null;
				}
				if (outputFormat === 'text') {
					readline.clearLine(process.stdout, 0);
					readline.cursorTo(process.stdout, 0);
					console.log(
						chalk.green('AI service call complete. Parsing response...')
					);
				}
			}

			// Only parse JSON if we didn't use streaming (streaming already parsed it)
			if (!shouldUseStreaming) {
				reportLog(`Parsing complexity analysis from text response...`, 'info');
				try {
					let cleanedResponse = aiServiceResponse.mainResult;
					cleanedResponse = cleanedResponse.trim();

					const codeBlockMatch = cleanedResponse.match(
						/```(?:json)?\s*([\s\S]*?)\s*```/
					);
					if (codeBlockMatch) {
						cleanedResponse = codeBlockMatch[1].trim();
					} else {
						const firstBracket = cleanedResponse.indexOf('[');
						const lastBracket = cleanedResponse.lastIndexOf(']');
						if (firstBracket !== -1 && lastBracket > firstBracket) {
							cleanedResponse = cleanedResponse.substring(
								firstBracket,
								lastBracket + 1
							);
						} else {
							reportLog(
								'Warning: Response does not appear to be a JSON array.',
								'warn'
							);
						}
					}

					if (outputFormat === 'text' && getDebugFlag(session)) {
						console.log(chalk.gray('Attempting to parse cleaned JSON...'));
						console.log(chalk.gray('Cleaned response (first 100 chars):'));
						console.log(chalk.gray(cleanedResponse.substring(0, 100)));
						console.log(chalk.gray('Last 100 chars:'));
						console.log(
							chalk.gray(
								cleanedResponse.substring(cleanedResponse.length - 100)
							)
						);
					}

					complexityAnalysis = JSON.parse(cleanedResponse);
				} catch (parseError) {
					if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
					reportLog(
						`Error parsing complexity analysis JSON: ${parseError.message}`,
						'error'
					);
					if (outputFormat === 'text') {
						console.error(
							chalk.red(
								`Error parsing complexity analysis JSON: ${parseError.message}`
							)
						);
					}
					throw parseError;
				}
			}

			const taskIds = tasksData.tasks.map((t) => t.id);
			const analysisTaskIds = complexityAnalysis.map((a) => a.taskId);
			const missingTaskIds = taskIds.filter(
				(id) => !analysisTaskIds.includes(id)
			);

			if (missingTaskIds.length > 0) {
				reportLog(
					`Missing analysis for ${missingTaskIds.length} tasks: ${missingTaskIds.join(', ')}`,
					'warn'
				);
				if (outputFormat === 'text') {
					console.log(
						chalk.yellow(
							`Missing analysis for ${missingTaskIds.length} tasks: ${missingTaskIds.join(', ')}`
						)
					);
				}
				for (const missingId of missingTaskIds) {
					const missingTask = tasksData.tasks.find((t) => t.id === missingId);
					if (missingTask) {
						reportLog(`Adding default analysis for task ${missingId}`, 'info');
						complexityAnalysis.push({
							taskId: missingId,
							taskTitle: missingTask.title,
							complexityScore: 5,
							recommendedSubtasks: 3,
							expansionPrompt: `Break down this task with a focus on ${missingTask.title.toLowerCase()}.`,
							reasoning:
								'Automatically added due to missing analysis in AI response.'
						});
					}
				}
			}

			// Merge with existing report
			let finalComplexityAnalysis = [];

			if (existingReport && Array.isArray(existingReport.complexityAnalysis)) {
				// Create a map of task IDs that we just analyzed
				const analyzedTaskIds = new Set(
					complexityAnalysis.map((item) => item.taskId)
				);

				// Keep existing entries that weren't in this analysis run
				const existingEntriesNotAnalyzed =
					existingReport.complexityAnalysis.filter(
						(item) => !analyzedTaskIds.has(item.taskId)
					);

				// Combine with new analysis
				finalComplexityAnalysis = [
					...existingEntriesNotAnalyzed,
					...complexityAnalysis
				];

				reportLog(
					`Merged ${complexityAnalysis.length} new analyses with ${existingEntriesNotAnalyzed.length} existing entries`,
					'debug'
				);
			} else {
				// No existing report or invalid format, just use the new analysis
				finalComplexityAnalysis = complexityAnalysis;
			}

			const report = {
				meta: {
					generatedAt: new Date().toISOString(),
					tasksAnalyzed: tasksData.tasks.length,
					totalTasks: originalTaskCount,
					analysisCount: finalComplexityAnalysis.length,
					thresholdScore: thresholdScore,
					projectName: getProjectName(session),
					usedResearch: useResearch
				},
				complexityAnalysis: finalComplexityAnalysis
			};
			reportLog(`Writing complexity report to ${outputPath}...`, 'debug');
			writeJSON(outputPath, report);

			reportLog(
				`Task complexity analysis complete. Report written to ${outputPath}`,
				'debug'
			);

			if (outputFormat === 'text') {
				// Calculate statistics specifically for this analysis run
				const highComplexity = complexityAnalysis.filter(
					(t) => t.complexityScore >= 7
				).length;
				const mediumComplexity = complexityAnalysis.filter(
					(t) => t.complexityScore >= 4 && t.complexityScore < 7
				).length;
				const lowComplexity = complexityAnalysis.filter(
					(t) => t.complexityScore < 4
				).length;
				const totalAnalyzed = complexityAnalysis.length;

				// Determine analysis scope description for summary
				let analysisScope = 'all pending tasks';
				if (specificIds && specificIds.length > 0) {
					analysisScope = `specific task IDs: ${specificIds.join(', ')}`;
				} else if (fromId !== null || toId !== null) {
					const effectiveFromId = fromId !== null ? fromId : 1;
					const effectiveToId = toId !== null ? toId : 'end';
					analysisScope = `task range: ${effectiveFromId} to ${effectiveToId}`;
				}

				// Get elapsed time from progress tracker if available
				let elapsedTime = 0;
				if (progressTracker) {
					elapsedTime = progressTracker.getElapsedTime();
				}

				// Display the comprehensive summary
				displayAnalyzeComplexitySummary({
					totalAnalyzed: totalAnalyzed,
					highComplexity: highComplexity,
					mediumComplexity: mediumComplexity,
					lowComplexity: lowComplexity,
					tasksFilePath: tasksPath,
					outputPath: outputPath,
					elapsedTime: elapsedTime,
					research: useResearch,
					threshold: thresholdScore,
					analysisScope: analysisScope,
					// Include report update info if there was an existing report
					totalInReport: existingReport
						? finalComplexityAnalysis.length
						: undefined,
					previousAnalyses: existingReport
						? finalComplexityAnalysis.length - totalAnalyzed
						: undefined
				});

				if (getDebugFlag(session)) {
					console.debug(
						chalk.gray(
							`Final analysis object: ${JSON.stringify(report, null, 2)}`
						)
					);
				}

				if (aiServiceResponse.telemetryData) {
					displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
				}
			}

			return {
				report: report,
				telemetryData: aiServiceResponse?.telemetryData
			};
		} catch (aiError) {
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
			if (progressTracker) await progressTracker.stop();
			reportLog(`Error during AI service call: ${aiError.message}`, 'error');
			if (outputFormat === 'text') {
				console.error(
					chalk.red(`Error during AI service call: ${aiError.message}`)
				);
				if (aiError.message.includes('API key')) {
					console.log(
						chalk.yellow(
							'\nPlease ensure your API keys are correctly configured in .env or ~/.taskmaster/.env'
						)
					);
					console.log(
						chalk.yellow("Run 'task-master models --setup' if needed.")
					);
				}
			}
			throw aiError;
		}
	} catch (error) {
		reportLog(`Error analyzing task complexity: ${error.message}`, 'error');
		if (outputFormat === 'text') {
			console.error(
				chalk.red(`Error analyzing task complexity: ${error.message}`)
			);
			if (getDebugFlag(session)) {
				console.error(error);
			}
			process.exit(1);
		} else {
			throw error;
		}
	}
}

export default analyzeTaskComplexity;
