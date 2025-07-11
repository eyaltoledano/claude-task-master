import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';
import ora from 'ora';
import { z } from 'zod';
import {
	DEFAULT_TASK_PRIORITY,
	TASK_PRIORITY_OPTIONS
} from '../../../src/constants/task-priorities.js';
import { getPriorityIndicators } from '../../../src/ui/indicators.js';

import {
	disableSilentMode,
	enableSilentMode,
	ensureTagMetadata,
	findTaskById,
	getCurrentTag,
	isSilentMode,
	log,
	readJSON,
	writeJSON
} from '../utils.js';

import { createParsePrdTracker } from '../../../src/progress/parse-prd-tracker.js';
import {
	displayParsePrdStart,
	displayParsePrdSummary
} from '../../../src/ui/parse-prd.js';
import { parseStream } from '../../../src/utils/stream-parser.js';
import {
	generateObjectService,
	streamTextService
} from '../ai-services-unified.js';
import { getDebugFlag } from '../config-manager.js';
import { getPromptManager } from '../prompt-manager.js';
import generateTaskFiles from './generate-task-files.js';
import { displayAiUsageSummary } from '../ui.js';
import {
	getMainModelId,
	getParametersForRole,
	getResearchModelId
} from '../config-manager.js';

// Define the Zod schema for a SINGLE task object
const prdSingleTaskSchema = z.object({
	id: z.number().int().positive(),
	title: z.string().min(1),
	description: z.string().min(1),
	details: z.string().nullable(),
	testStrategy: z.string().nullable(),
	priority: z.enum(TASK_PRIORITY_OPTIONS).nullable(),
	dependencies: z.array(z.number().int().positive()).nullable(),
	status: z.string().nullable()
});

// Define the Zod schema for the ENTIRE expected AI response object
const prdResponseSchema = z.object({
	tasks: z.array(prdSingleTaskSchema),
	metadata: z.object({
		projectName: z.string(),
		totalTasks: z.number(),
		sourceFile: z.string(),
		generatedAt: z.string()
	})
});

/**
 * Estimate token count from text
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
	// Common approximation: ~4 characters per token for English
	return Math.ceil(text.length / 4);
}

/**
 * Create logging functions for PRD parsing
 * @param {Object} mcpLog - MCP logger object (optional)
 * @param {Function} reportProgress - Progress reporting function (optional)
 * @returns {Object} Object with logFn and report functions
 */
function createLoggingFunctions(mcpLog, reportProgress) {
	const isMCP = !!mcpLog;
	// MCP without reportProgress → 'json' (structured response)
	// MCP with reportProgress → 'text' (streaming with progress UI)
	// CLI → 'text' (streaming with progress UI, may fall back but keeps text UI)
	const outputFormat = isMCP && !reportProgress ? 'json' : 'text';

	const logFn = mcpLog || {
		info: (...args) => log('info', ...args),
		warn: (...args) => log('warn', ...args),
		error: (...args) => log('error', ...args),
		debug: (...args) => log('debug', ...args),
		success: (...args) => log('success', ...args)
	};

	const report = (message, level = 'info') => {
		if (logFn && typeof logFn[level] === 'function') {
			logFn[level](message);
		} else if (!isSilentMode() && outputFormat === 'text') {
			log(level, message);
		}
	};

	return { logFn, report, outputFormat, isMCP };
}

/**
 * Parse a PRD file and generate tasks with optional streaming progress
 * @param {string} prdPath - Path to the PRD file
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} numTasks - Number of tasks to generate
 * @param {Object} options - Additional options
 * @param {boolean} [options.force=false] - Whether to overwrite existing tasks.json.
 * @param {boolean} [options.append=false] - Append to existing tasks file.
 * @param {boolean} [options.research=false] - Use research model for enhanced PRD analysis.
 * @param {Function} [options.reportProgress] - Function to report progress (optional).
 * @param {Object} [options.mcpLog] - MCP logger object (optional).
 * @param {Object} [options.session] - Session object from MCP server (optional).
 * @param {string} [options.projectRoot] - Project root path (for MCP/env fallback).
 * @param {string} [options.tag] - Target tag for task generation.
 * @param {string} [outputFormat='text'] - Output format ('text' or 'json').
 */
async function parsePRD(prdPath, tasksPath, numTasks, options = {}) {
	const { reportProgress, mcpLog } = options;
	const { outputFormat } = createLoggingFunctions(mcpLog, reportProgress);

	// Use streaming if reportProgress is provided (MCP) OR if outputFormat is 'text' (CLI)
	const useStreaming =
		typeof reportProgress === 'function' || outputFormat === 'text';

	if (useStreaming) {
		try {
			return await parsePRDWithStreaming(prdPath, tasksPath, numTasks, options);
		} catch (streamingError) {
			// Check if this is a streaming-specific error
			const errorMessage = streamingError.message?.toLowerCase() || '';
			const isStreamingError =
				errorMessage.includes('not async iterable') ||
				errorMessage.includes('failed to process ai text stream') ||
				errorMessage.includes('stream object is not iterable');

			if (isStreamingError) {
				// Log fallback warning
				const logFn = mcpLog || { warn: (...args) => log('warn', ...args) };
				const { outputFormat, isMCP } = createLoggingFunctions(
					mcpLog,
					reportProgress
				);

				// Show fallback message for CLI users
				if (outputFormat === 'text' && !isMCP) {
					console.log(
						chalk.yellow(
							`Streaming failed, falling back to non-streaming mode...`
						)
					);
				} else {
					logFn.warn(
						`Streaming failed (${streamingError.message}), falling back to non-streaming mode...`
					);
				}

				// Fallback to non-streaming mode
				return await parsePRDWithoutStreaming(
					prdPath,
					tasksPath,
					numTasks,
					options
				);
			} else {
				// Re-throw non-streaming errors
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

/**
 * Parse PRD with streaming progress reporting
 */
async function parsePRDWithStreaming(
	prdPath,
	tasksPath,
	numTasks,
	options = {}
) {
	const {
		reportProgress,
		mcpLog,
		session,
		projectRoot,
		force = false,
		append = false,
		research = false,
		tag
	} = options;

	// Use your existing createLoggingFunctions helper (preserves streaming progress logic)
	const { logFn, report, outputFormat, isMCP } = createLoggingFunctions(
		mcpLog,
		reportProgress
	);

	// Add tag support from incoming changes
	const targetTag = tag || getCurrentTag(projectRoot) || 'master';

	report(
		`Parsing PRD file: ${prdPath}, Force: ${force}, Append: ${append}, Research: ${research}`,
		'debug'
	);

	// Initialize progress tracker for CLI mode only (not MCP)
	let progressTracker = null;
	if (outputFormat === 'text' && !isMCP) {
		progressTracker = createParsePrdTracker({
			numTasks,
			append
		});

		// Get actual AI configuration for display
		const aiRole = research ? 'research' : 'main';
		const modelId = research ? getResearchModelId() : getMainModelId();
		const parameters = getParametersForRole(aiRole);

		displayParsePrdStart({
			prdFilePath: prdPath,
			outputPath: tasksPath,
			numTasks,
			append,
			research,
			force,
			existingTasks: [], // Will be populated below
			nextId: 1, // Will be updated below
			model: modelId || 'Default',
			temperature: parameters?.temperature || 0.7
		});

		progressTracker.start();
	}

	let existingTasks = [];
	let nextId = 1;
	let aiServiceResponse = null;

	try {
		// Check if there are existing tasks in the target tag
		let hasExistingTasksInTag = false;
		if (fs.existsSync(tasksPath)) {
			try {
				// Read the entire file to check if the tag exists
				const existingFileContent = fs.readFileSync(tasksPath, 'utf8');
				const allData = JSON.parse(existingFileContent);

				// Check if the target tag exists and has tasks
				if (
					allData[targetTag] &&
					Array.isArray(allData[targetTag].tasks) &&
					allData[targetTag].tasks.length > 0
				) {
					hasExistingTasksInTag = true;
					existingTasks = allData[targetTag].tasks;
					nextId = Math.max(...existingTasks.map((t) => t.id || 0)) + 1;
				}
			} catch (error) {
				// If we can't read the file or parse it, assume no existing tasks in this tag
				hasExistingTasksInTag = false;
			}
		}

		// Handle file existence and overwrite/append logic based on target tag
		if (hasExistingTasksInTag) {
			if (append) {
				report(
					`Append mode enabled. Found ${existingTasks.length} existing tasks in tag '${targetTag}'. Next ID will be ${nextId}.`,
					'info'
				);
			} else if (!force) {
				// Not appending and not forcing overwrite, and there are existing tasks in the target tag
				const overwriteError = new Error(
					`Tag '${targetTag}' already contains ${existingTasks.length} tasks. Use --force to overwrite or --append to add to existing tasks.`
				);
				report(overwriteError.message, 'error');
				if (isMCP) {
					// MCP context should always throw, never exit
					throw overwriteError;
				} else {
					// CLI context should show error and exit
					console.error(chalk.red(overwriteError.message));
				}
				throw overwriteError;
			} else {
				// Force overwrite is true
				report(
					`Force flag enabled. Overwriting existing tasks in tag '${targetTag}'.`,
					'debug'
				);
			}
		} else {
			// No existing tasks in target tag, proceed without confirmation
			report(
				`Tag '${targetTag}' is empty or doesn't exist. Creating/updating tag with new tasks.`,
				'info'
			);
		}

		report(`Reading PRD content from ${prdPath}`, 'debug');
		const prdContent = fs.readFileSync(prdPath, 'utf8');
		if (!prdContent) {
			throw new Error(`Input file ${prdPath} is empty or could not be read.`);
		}

		// Load prompts using PromptManager
		const promptManager = getPromptManager();

		// Get defaultTaskPriority from config
		const { getDefaultPriority } = await import('../config-manager.js');
		const defaultTaskPriority = getDefaultPriority(projectRoot) || 'medium';

		const { systemPrompt, userPrompt } = await promptManager.loadPrompt(
			'parse-prd',
			{
				research,
				numTasks,
				nextId,
				prdContent,
				prdPath,
				defaultTaskPriority
			}
		);

		// Estimate input tokens
		const estimatedInputTokens = estimateTokens(systemPrompt + userPrompt);

		// Report initial progress with input token count
		if (reportProgress) {
			await reportProgress({
				progress: 0,
				total: numTasks,
				message: `Starting PRD analysis (Input: ${estimatedInputTokens} tokens)${research ? ' with research' : ''}...`
			});
		}

		// Call streaming AI service
		report(
			`Calling streaming AI service to generate tasks from PRD${research ? ' with research-backed analysis' : ''}...`,
			'debug'
		);

		aiServiceResponse = await streamTextService({
			role: research ? 'research' : 'main',
			session: session,
			projectRoot: projectRoot,
			systemPrompt: systemPrompt,
			prompt: userPrompt,
			commandName: 'parse-prd',
			outputType: isMCP ? 'mcp' : 'cli'
		});

		const textStream = aiServiceResponse.mainResult;
		if (!textStream) {
			throw new Error('No text stream received from AI service');
		}

		// Get priority indicators based on context (MCP vs CLI)
		const priorityMap = getPriorityIndicators(isMCP);

		// Create a simple progress callback that handles both CLI and MCP progress
		const onProgress = async (task, metadata) => {
			const { currentCount, estimatedTokens } = metadata;
			const priority = task.priority || DEFAULT_TASK_PRIORITY;

			// Get priority indicator for this task
			const priorityIndicator = priorityMap[priority] || priorityMap.medium;

			// CLI progress tracker (if available)
			if (progressTracker) {
				progressTracker.addTaskLine(currentCount, task.title, priority);

				// Update tokens display if available
				if (estimatedTokens) {
					progressTracker.updateTokens(estimatedInputTokens, estimatedTokens);
				}
			}

			// MCP progress reporting (if available) - use the priorityIndicator from parser
			if (reportProgress) {
				try {
					// Estimate output tokens for this task
					const outputTokens = estimatedTokens
						? Math.floor(estimatedTokens / numTasks)
						: 0;

					await reportProgress({
						progress: currentCount,
						total: numTasks,
						message: `${priorityIndicator} Task ${currentCount}/${numTasks} - ${task.title} | ~Output: ${outputTokens} tokens`
					});
				} catch (error) {
					report(`Progress reporting failed: ${error.message}`, 'warn');
				}
			}
		};

		// Fallback extractor for tasks from complete JSON
		const fallbackItemExtractor = (fullResponse) => {
			return fullResponse.tasks || [];
		};

		const parseResult = await parseStream(textStream, {
			jsonPaths: ['$.tasks.*'],
			onProgress: onProgress,
			onError: (error) => {
				report(`JSON parsing error: ${error.message}`, 'debug');
			},
			estimateTokens,
			expectedTotal: numTasks,
			fallbackItemExtractor
		});

		const {
			items: parsedTasks,
			accumulatedText,
			estimatedTokens: estimatedOutputTokens,
			usedFallback
		} = parseResult;

		if (usedFallback) {
			report(
				`Fallback parsing recovered ${parsedTasks.length - numTasks} additional tasks`,
				'info'
			);
		}

		if (parsedTasks.length === 0) {
			throw new Error('No tasks were generated from the PRD');
		}

		// Process tasks (same logic as non-streaming)
		let currentId = nextId;
		const taskMap = new Map();
		const processedNewTasks = parsedTasks.map((task) => {
			const newId = currentId++;
			taskMap.set(task.id, newId);
			return {
				...task,
				id: newId,
				status: 'pending',
				priority: task.priority || DEFAULT_TASK_PRIORITY,
				dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
				subtasks: []
			};
		});

		// Remap dependencies
		processedNewTasks.forEach((task) => {
			task.dependencies = task.dependencies
				.map((depId) => taskMap.get(depId))
				.filter(
					(newDepId) =>
						newDepId != null &&
						newDepId < task.id &&
						(findTaskById(existingTasks, newDepId) ||
							processedNewTasks.some((t) => t.id === newDepId))
				);
		});

		const finalTasks = append
			? [...existingTasks, ...processedNewTasks]
			: processedNewTasks;

		// Create the directory if it doesn't exist
		const tasksDir = path.dirname(tasksPath);
		if (!fs.existsSync(tasksDir)) {
			fs.mkdirSync(tasksDir, { recursive: true });
		}

		// Read the existing file to preserve other tags (same as non-streaming version)
		let outputData = {};
		if (fs.existsSync(tasksPath)) {
			try {
				const existingFileContent = fs.readFileSync(tasksPath, 'utf8');
				outputData = JSON.parse(existingFileContent);
			} catch (error) {
				// If we can't read the existing file, start with empty object
				outputData = {};
			}
		}

		// Update only the target tag, preserving other tags
		outputData[targetTag] = {
			tasks: finalTasks,
			metadata: {
				created:
					outputData[targetTag]?.metadata?.created || new Date().toISOString(),
				updated: new Date().toISOString(),
				description: `Tasks for ${targetTag} context`
			}
		};

		// Ensure the target tag has proper metadata
		ensureTagMetadata(outputData[targetTag], {
			description: `Tasks for ${targetTag} context`
		});

		// Write the complete data structure back to the file
		fs.writeFileSync(tasksPath, JSON.stringify(outputData, null, 2));
		report(
			`Successfully ${append ? 'appended' : 'generated'} ${processedNewTasks.length} tasks in ${tasksPath}${research ? ' with research-backed analysis' : ''}`,
			'debug'
		);

		// Generate markdown task files after writing tasks.json
		//await generateTaskFiles(tasksPath, path.dirname(tasksPath), { mcpLog });

		// Final progress report - completion
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
			completionMessage = `✅ Task Generation Completed | Tokens (I/O): ${aiServiceResponse.telemetryData.inputTokens}/${aiServiceResponse.telemetryData.outputTokens} | Cost: ${currency === 'USD' ? '$' : currency}${cost.toFixed(4)}`;
		} else {
			// Use estimates and indicate they're estimates
			completionMessage = `✅ Task Generation Completed | ~Tokens (I/O): ${estimatedInputTokens}/${estimatedOutputTokens} | Cost: ~$0.00`;
		}

		if (reportProgress) {
			await reportProgress({
				progress: numTasks,
				total: numTasks,
				message: completionMessage
			});
		}

		// Complete and stop progress tracker for CLI mode
		if (progressTracker) {
			// Get summary before stopping
			const summary = progressTracker.getSummary();

			progressTracker.stop();

			// Display summary
			const taskFilesGenerated = (() => {
				if (
					!Array.isArray(processedNewTasks) ||
					processedNewTasks.length === 0
				) {
					return `task_${String(nextId).padStart(3, '0')}.txt`;
				}
				const firstNewTaskId = processedNewTasks[0].id;
				const lastNewTaskId =
					processedNewTasks[processedNewTasks.length - 1].id;
				if (processedNewTasks.length === 1) {
					return `task_${String(firstNewTaskId).padStart(3, '0')}.txt`;
				}
				return `task_${String(firstNewTaskId).padStart(3, '0')}.txt -> task_${String(lastNewTaskId).padStart(3, '0')}.txt`;
			})();

			displayParsePrdSummary({
				totalTasks: processedNewTasks.length,
				taskPriorities: summary.taskPriorities,
				prdFilePath: prdPath,
				outputPath: tasksPath,
				elapsedTime: summary.elapsedTime,
				usedFallback,
				taskFilesGenerated,
				actionVerb: summary.actionVerb
			});

			// Display telemetry data (may be estimates for streaming calls)
			if (aiServiceResponse && aiServiceResponse.telemetryData) {
				// For streaming, wait briefly to allow usage data to be captured
				if (
					aiServiceResponse.mainResult &&
					aiServiceResponse.mainResult.usage
				) {
					try {
						// Give the usage promise a short time to resolve
						await Promise.race([
							aiServiceResponse.mainResult.usage,
							new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second timeout
						]);
					} catch (e) {
						// Ignore timeout or usage errors, just display what we have
					}
				}
				displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
			}
		}

		// Return telemetry data
		return {
			success: true,
			tasksPath,
			telemetryData: aiServiceResponse?.telemetryData
		};
	} catch (error) {
		// Stop progress tracker on error
		if (progressTracker) {
			progressTracker.stop();
		}
		report(`Error parsing PRD: ${error.message}`, 'error');
		throw error;
	}
}

/**
 * Parse PRD without streaming (fallback for CLI and non-progress clients)
 */
async function parsePRDWithoutStreaming(
	prdPath,
	tasksPath,
	numTasks,
	options = {}
) {
	const {
		mcpLog,
		session,
		projectRoot,
		force = false,
		append = false,
		research = false,
		reportProgress,
		tag
	} = options;
	const { logFn, report, outputFormat, isMCP } = createLoggingFunctions(
		mcpLog,
		reportProgress
	);

	// Add tag support for non-streaming version too
	const targetTag = tag || getCurrentTag(projectRoot) || 'master';

	report(
		`Parsing PRD file: ${prdPath}, Force: ${force}, Append: ${append}, Research: ${research}`,
		'debug'
	);

	// Initialize ora spinner for CLI non-streaming mode
	let spinner = null;
	if (outputFormat === 'text' && !isMCP) {
		spinner = ora('Parsing PRD and generating tasks...\n').start();
	}

	let existingTasks = [];
	let nextId = 1;
	let aiServiceResponse = null;

	try {
		// Handle file existence and overwrite/append logic
		if (fs.existsSync(tasksPath)) {
			if (append) {
				report(
					`Append mode enabled. Reading existing tasks from ${tasksPath}`,
					'info'
				);
				const existingData = readJSON(tasksPath);
				if (
					existingData &&
					existingData[targetTag] &&
					Array.isArray(existingData[targetTag].tasks)
				) {
					existingTasks = existingData[targetTag].tasks;
					if (existingTasks.length > 0) {
						nextId = Math.max(...existingTasks.map((t) => t.id || 0)) + 1;
						report(
							`Found ${existingTasks.length} existing tasks in tag '${targetTag}'. Next ID will be ${nextId}.`,
							'info'
						);
					}
				} else if (existingData && Array.isArray(existingData.tasks)) {
					// Handle legacy format (non-tagged)
					existingTasks = existingData.tasks;
					if (existingTasks.length > 0) {
						nextId = Math.max(...existingTasks.map((t) => t.id || 0)) + 1;
						report(
							`Found ${existingTasks.length} existing tasks (legacy format). Next ID will be ${nextId}.`,
							'info'
						);
					}
				} else {
					report(
						`Could not read existing tasks from ${tasksPath} or format is invalid. Proceeding without appending.`,
						'warn'
					);
					existingTasks = [];
				}
			} else if (!force) {
				// Check if target tag has existing tasks before throwing error
				let allData = {};
				try {
					const existingFileContent = fs.readFileSync(tasksPath, 'utf8');
					allData = JSON.parse(existingFileContent);
				} catch (error) {
					// If we can't read the file, proceed without error
					allData = {};
				}

				const hasExistingTasks =
					allData[targetTag] &&
					Array.isArray(allData[targetTag].tasks) &&
					allData[targetTag].tasks.length > 0;

				if (hasExistingTasks) {
					const overwriteError = new Error(
						`Tag '${targetTag}' already contains ${allData[targetTag].tasks.length} tasks. Use --force to overwrite or --append.`
					);
					report(overwriteError.message, 'error');
					if (isMCP) {
						// MCP context should always throw, never exit
						throw overwriteError;
					} else {
						// CLI context should show error and exit
						console.error(chalk.red(overwriteError.message));
						process.exit(1);
					}
				}
			} else {
				report(
					`Force flag enabled. Overwriting existing file: ${tasksPath}`,
					'debug'
				);
			}
		}

		report(`Reading PRD content from ${prdPath}`, 'debug');
		const prdContent = fs.readFileSync(prdPath, 'utf8');
		if (!prdContent) {
			throw new Error(`Input file ${prdPath} is empty or could not be read.`);
		}

		// Load prompts using PromptManager
		const promptManager = getPromptManager();

		// Get defaultTaskPriority from config
		const { getDefaultPriority } = await import('../config-manager.js');
		const defaultTaskPriority = getDefaultPriority(projectRoot) || 'medium';

		const { systemPrompt, userPrompt } = await promptManager.loadPrompt(
			'parse-prd',
			{
				research,
				numTasks,
				nextId,
				prdContent,
				prdPath,
				defaultTaskPriority
			}
		);

		// Estimate input tokens
		const estimatedInputTokens = estimateTokens(systemPrompt + userPrompt);

		// Call the unified AI service
		report(
			`Calling AI service to generate tasks from PRD${research ? ' with research-backed analysis' : ''}...`,
			'info'
		);

		// Call generateObjectService with the CORRECT schema and additional telemetry params
		aiServiceResponse = await generateObjectService({
			role: research ? 'research' : 'main', // Use research role if flag is set
			session: session,
			projectRoot: projectRoot,
			schema: prdResponseSchema,
			objectName: 'tasks_data',
			systemPrompt: systemPrompt,
			prompt: userPrompt,
			commandName: 'parse-prd',
			outputType: isMCP ? 'mcp' : 'cli'
		});

		// Create the directory if it doesn't exist
		const tasksDir = path.dirname(tasksPath);
		if (!fs.existsSync(tasksDir)) {
			fs.mkdirSync(tasksDir, { recursive: true });
		}
		logFn.success(
			`Successfully parsed PRD via AI service${research ? ' with research-backed analysis' : ''}.`
		);

		// Validate and Process Tasks
		// const generatedData = aiServiceResponse?.mainResult?.object;

		// Robustly get the actual AI-generated object
		let generatedData = null;
		if (aiServiceResponse?.mainResult) {
			if (
				typeof aiServiceResponse.mainResult === 'object' &&
				aiServiceResponse.mainResult !== null &&
				'tasks' in aiServiceResponse.mainResult
			) {
				// If mainResult itself is the object with a 'tasks' property
				generatedData = aiServiceResponse.mainResult;
			} else if (
				typeof aiServiceResponse.mainResult.object === 'object' &&
				aiServiceResponse.mainResult.object !== null &&
				'tasks' in aiServiceResponse.mainResult.object
			) {
				// If mainResult.object is the object with a 'tasks' property
				generatedData = aiServiceResponse.mainResult.object;
			}
		}

		if (!generatedData || !Array.isArray(generatedData.tasks)) {
			logFn.error(
				`Internal Error: generateObjectService returned unexpected data structure: ${JSON.stringify(generatedData)}`
			);
			throw new Error(
				'AI service returned unexpected data structure after validation.'
			);
		}

		let currentId = nextId;
		const taskMap = new Map();
		const processedNewTasks = generatedData.tasks.map((task) => {
			const newId = currentId++;
			taskMap.set(task.id, newId);
			return {
				...task,
				id: newId,
				status: 'pending',
				priority: task.priority || DEFAULT_TASK_PRIORITY,
				dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
				subtasks: []
			};
		});

		// Remap dependencies for the NEWLY processed tasks
		processedNewTasks.forEach((task) => {
			task.dependencies = task.dependencies
				.map((depId) => taskMap.get(depId)) // Map old AI ID to new sequential ID
				.filter(
					(newDepId) =>
						newDepId != null && // Must exist
						newDepId < task.id && // Must be a lower ID (could be existing or newly generated)
						(findTaskById(existingTasks, newDepId) || // Check if it exists in old tasks OR
							processedNewTasks.some((t) => t.id === newDepId)) // check if it exists in new tasks
				);
		});

		const finalTasks = append
			? [...existingTasks, ...processedNewTasks]
			: processedNewTasks;

		// Read the existing file to preserve other tags
		let outputData = {};
		if (fs.existsSync(tasksPath)) {
			try {
				const existingFileContent = fs.readFileSync(tasksPath, 'utf8');
				outputData = JSON.parse(existingFileContent);
			} catch (error) {
				// If we can't read the existing file, start with empty object
				outputData = {};
			}
		}

		// Update only the target tag, preserving other tags
		outputData[targetTag] = {
			tasks: finalTasks,
			metadata: {
				created:
					outputData[targetTag]?.metadata?.created || new Date().toISOString(),
				updated: new Date().toISOString(),
				description: `Tasks for ${targetTag} context`
			}
		};

		// Ensure the target tag has proper metadata
		ensureTagMetadata(outputData[targetTag], {
			description: `Tasks for ${targetTag} context`
		});

		// Write the complete data structure back to the file
		fs.writeFileSync(tasksPath, JSON.stringify(outputData, null, 2));
		report(
			`Successfully ${append ? 'appended' : 'generated'} ${processedNewTasks.length} tasks in ${tasksPath}${research ? ' with research-backed analysis' : ''}`,
			'debug'
		);

		// Generate markdown task files after writing tasks.json
		//await generateTaskFiles(tasksPath, path.dirname(tasksPath), { mcpLog });

		// Handle CLI output for non-streaming mode
		if (outputFormat === 'text') {
			// Stop spinner with success message
			if (spinner) {
				spinner.succeed('Tasks generated successfully!');
			}

			console.log(
				boxen(
					chalk.green(
						`Successfully generated ${processedNewTasks.length} new tasks${research ? ' with research-backed analysis' : ''}. Total tasks in ${tasksPath}: ${finalTasks.length}`
					),
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);

			console.log(
				boxen(
					chalk.white.bold('Next Steps:') +
						'\n\n' +
						`${chalk.cyan('1.')} Run ${chalk.yellow('task-master list')} to view all tasks\n` +
						`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down a task into subtasks`,
					{
						padding: 1,
						borderColor: 'cyan',
						borderStyle: 'round',
						margin: { top: 1 }
					}
				)
			);

			// Display telemetry data
			if (aiServiceResponse && aiServiceResponse.telemetryData) {
				displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
			}
		}

		// Handle MCP progress reporting
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
				completionMessage = `✅ Task Generation Completed | Tokens (I/O): ${aiServiceResponse.telemetryData.inputTokens}/${aiServiceResponse.telemetryData.outputTokens} | Cost: ${currency === 'USD' ? '$' : currency}${cost.toFixed(4)}`;
			} else {
				// Use estimates and indicate they're estimates
				completionMessage = `✅ Task Generation Completed | ~Tokens (I/O): ${estimatedInputTokens}/unknown | Cost: ~$0.00`;
			}

			await reportProgress({
				progress: numTasks,
				total: numTasks,
				message: completionMessage
			});
		}

		// Return telemetry data
		return {
			success: true,
			tasksPath,
			telemetryData: aiServiceResponse?.telemetryData,
			tagInfo: aiServiceResponse?.tagInfo
		};
	} catch (error) {
		report(`Error parsing PRD: ${error.message}`, 'error');

		// Stop spinner with failure message for CLI
		if (spinner) {
			spinner.fail(`Error parsing PRD: ${error.message}`);
		}

		// Only show error UI for CLI context
		if (isMCP) {
			// MCP context should always throw, never exit
			throw error;
		} else {
			// CLI context should show error and exit
			if (!spinner) {
				// Only show error if spinner didn't already show it
				console.error(chalk.red(`Error: ${error.message}`));
			}

			if (getDebugFlag(projectRoot)) {
				// Use projectRoot for debug flag check
				console.error(error);
			}
		}

		throw error; // Always re-throw for proper error handling
	}
}

export default parsePRD;
