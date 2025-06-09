import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import { z } from 'zod';
import { JSONParser } from '@streamparser/json';

import {
	log,
	writeJSON,
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	readJSON,
	findTaskById
} from '../utils.js';

import { generateObjectService } from '../ai-services-unified.js';
import { getDebugFlag } from '../config-manager.js';
import generateTaskFiles from './generate-task-files.js';
import { displayAiUsageSummary } from '../ui.js';

// Define the Zod schema for a SINGLE task object
const prdSingleTaskSchema = z.object({
	id: z.number().int().positive(),
	title: z.string().min(1),
	description: z.string().min(1),
	details: z.string().optional().default(''),
	testStrategy: z.string().optional().default(''),
	priority: z.enum(['high', 'medium', 'low']).default('medium'),
	dependencies: z.array(z.number().int().positive()).optional().default([]),
	status: z.string().optional().default('pending')
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
 * Build system prompt for PRD parsing
 * @param {boolean} research - Whether to use research mode
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} nextId - Starting ID for tasks
 * @returns {string} System prompt
 */
function buildSystemPrompt(research, numTasks, nextId) {
	const researchPromptAddition = research
		? `\nBefore breaking down the PRD into tasks, you will:
1. Research and analyze the latest technologies, libraries, frameworks, and best practices that would be appropriate for this project
2. Identify any potential technical challenges, security concerns, or scalability issues not explicitly mentioned in the PRD without discarding any explicit requirements or going overboard with complexity -- always aim to provide the most direct path to implementation, avoiding over-engineering or roundabout approaches
3. Consider current industry standards and evolving trends relevant to this project (this step aims to solve LLM hallucinations and out of date information due to training data cutoff dates)
4. Evaluate alternative implementation approaches and recommend the most efficient path
5. Include specific library versions, helpful APIs, and concrete implementation guidance based on your research
6. Always aim to provide the most direct path to implementation, avoiding over-engineering or roundabout approaches

Your task breakdown should incorporate this research, resulting in more detailed implementation guidance, more accurate dependency mapping, and more precise technology recommendations than would be possible from the PRD text alone, while maintaining all explicit requirements and best practices and all details and nuances of the PRD.`
		: '';

	return `You are an AI assistant specialized in analyzing Product Requirements Documents (PRDs) and generating a structured, logically ordered, dependency-aware and sequenced list of development tasks in JSON format.${researchPromptAddition}

Analyze the provided PRD content and generate approximately ${numTasks} top-level development tasks. If the complexity or the level of detail of the PRD is high, generate more tasks relative to the complexity of the PRD
Each task should represent a logical unit of work needed to implement the requirements and focus on the most direct and effective way to implement the requirements without unnecessary complexity or overengineering. Include pseudo-code, implementation details, and test strategy for each task. Find the most up to date information to implement each task.
Assign sequential IDs starting from ${nextId}. Infer title, description, details, and test strategy for each task based *only* on the PRD content.
Set status to 'pending', dependencies to an empty array [], and priority to 'medium' initially for all tasks.
Respond ONLY with a valid JSON object containing a single key "tasks", where the value is an array of task objects adhering to the provided Zod schema. Do not include any explanation or markdown formatting.

Each task should follow this JSON structure:
{
	"id": number,
	"title": string,
	"description": string,
	"status": "pending",
	"dependencies": number[] (IDs of tasks this depends on),
	"priority": "high" | "medium" | "low",
	"details": string (implementation details),
	"testStrategy": string (validation approach)
}

Guidelines:
1. Unless complexity warrants otherwise, create exactly ${numTasks} tasks, numbered sequentially starting from ${nextId}
2. Each task should be atomic and focused on a single responsibility following the most up to date best practices and standards
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs, potentially including existing tasks with IDs less than ${nextId} if applicable)
7. Assign priority (high/medium/low) based on criticality and dependency order
8. Include detailed implementation guidance in the "details" field${research ? ', with specific libraries and version recommendations based on your research' : ''}
9. If the PRD contains specific requirements for libraries, database schemas, frameworks, tech stacks, or any other implementation details, STRICTLY ADHERE to these requirements in your task breakdown and do not discard them under any circumstance
10. Focus on filling in any gaps left by the PRD or areas that aren't fully specified, while preserving all explicit requirements
11. Always aim to provide the most direct path to implementation, avoiding over-engineering or roundabout approaches${research ? '\n12. For each task, include specific, actionable guidance based on current industry standards and best practices discovered through research' : ''}`;
}

/**
 * Create logging functions for PRD parsing
 * @param {Object} mcpLog - MCP logger object (optional)
 * @returns {Object} Object with logFn and report functions
 */
function createLoggingFunctions(mcpLog) {
	const isMCP = !!mcpLog;
	// Only use json format for MCP mode, let tests run in their intended mode
	const outputFormat = isMCP ? 'json' : 'text';

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
 * Build user prompt for PRD parsing
 * @param {string} prdContent - Content of the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} nextId - Starting ID for tasks
 * @param {string} prdPath - Path to the PRD file
 * @param {boolean} research - Whether to use research mode
 * @returns {string} User prompt
 */
function buildUserPrompt(prdContent, numTasks, nextId, prdPath, research) {
	return `Here's the Product Requirements Document (PRD) to break down into approximately ${numTasks} tasks, starting IDs from ${nextId}:${research ? '\n\nRemember to thoroughly research current best practices and technologies before task breakdown to provide specific, actionable implementation details.' : ''}\n\n${prdContent}\n\n

		Return your response in this format:
{
    "tasks": [
        {
            "id": 1,
            "title": "Setup Project Repository",
            "description": "...",
            ...
        },
        ...
    ],
    "metadata": {
        "projectName": "PRD Implementation",
        "totalTasks": ${numTasks},
        "sourceFile": "${prdPath}",
        "generatedAt": "YYYY-MM-DD"
    }
}`;
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
 * @param {string} [outputFormat='text'] - Output format ('text' or 'json').
 */
async function parsePRD(prdPath, tasksPath, numTasks, options = {}) {
	const { reportProgress, mcpLog } = options;

	// Auto-detect streaming based on whether reportProgress is provided by FastMCP
	const useStreaming = typeof reportProgress === 'function';

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
				logFn.warn(
					`Streaming failed (${streamingError.message}), falling back to non-streaming mode...`
				);

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
		research = false
	} = options;
	const { logFn, report, outputFormat, isMCP } = createLoggingFunctions(mcpLog);

	report(
		`Parsing PRD file: ${prdPath}, Force: ${force}, Append: ${append}, Research: ${research}`
	);

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
				const existingData = readJSON(tasksPath); // Use readJSON utility
				if (existingData && Array.isArray(existingData.tasks)) {
					existingTasks = existingData.tasks;
					if (existingTasks.length > 0) {
						nextId = Math.max(...existingTasks.map((t) => t.id || 0)) + 1;
						report(
							`Found ${existingTasks.length} existing tasks. Next ID will be ${nextId}.`,
							'info'
						);
					}
				} else {
					report(
						`Could not read existing tasks from ${tasksPath} or format is invalid. Proceeding without appending.`,
						'warn'
					);
					existingTasks = []; // Reset if read fails
				}
			} else if (!force) {
				// Not appending and not forcing overwrite
				const overwriteError = new Error(
					`Output file ${tasksPath} already exists. Use --force to overwrite or --append.`
				);
				report(overwriteError.message, 'error');
				if (outputFormat === 'text') {
					console.error(chalk.red(overwriteError.message));
					process.exit(1);
				} else {
					throw overwriteError;
				}
			} else {
				// Force overwrite is true
				report(
					`Force flag enabled. Overwriting existing file: ${tasksPath}`,
					'info'
				);
			}
		}

		report(`Reading PRD content from ${prdPath}`, 'info');
		const prdContent = fs.readFileSync(prdPath, 'utf8');
		if (!prdContent) {
			throw new Error(`Input file ${prdPath} is empty or could not be read.`);
		}

		// Build prompts using helper functions
		const systemPrompt = buildSystemPrompt(research, numTasks, nextId);
		const userPrompt = buildUserPrompt(
			prdContent,
			numTasks,
			nextId,
			prdPath,
			research
		);

		// Estimate input tokens
		const estimatedInputTokens = estimateTokens(systemPrompt + userPrompt);

		// Report initial progress with input token count
		await reportProgress({
			progress: 0,
			total: numTasks,
			message: `Starting PRD analysis (Input: ${estimatedInputTokens} tokens)${research ? ' with research' : ''}...`
		});

		// Call streaming AI service
		report(
			`Calling streaming AI service to generate tasks from PRD${research ? ' with research-backed analysis' : ''}...`,
			'info'
		);

		// Dynamic import to avoid Jest module resolution issues
		const { streamTextService } = await import('../ai-services-unified.js');
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

		// Parse streaming JSON and track task progress
		const parsedTasks = [];
		let accumulatedText = '';
		let estimatedOutputTokens = 0;

		// Priority indicator mapping
		const priorityMap = {
			high: '🔴',
			medium: '🟠',
			low: '🟢'
		};

		const parser = new JSONParser({ paths: ['$.tasks.*'] });

		parser.onValue = (value, key, parent, stack) => {
			// Extract the actual task object from the parser's nested structure
			const task = value.value || value;

			// Only report progress if we have a task with a title (complete task)
			if (
				task &&
				task.title &&
				typeof task.title === 'string' &&
				task.title.trim()
			) {
				parsedTasks.push(task);
				const currentProgress = parsedTasks.length;
				const priority = task.priority || 'medium';
				const priorityIndicator = priorityMap[priority];

				// Re-estimate output tokens based on accumulated text so far
				estimatedOutputTokens = estimateTokens(accumulatedText);

				reportProgress({
					progress: currentProgress,
					total: numTasks,
					message: `${priorityIndicator} Task ${currentProgress}/${numTasks} - ${task.title} | ~Output: ${estimatedOutputTokens} tokens`
				}).catch((error) => {
					// Log progress errors but don't break the flow
					report(`Progress reporting failed: ${error.message}`, 'warn');
				});
			}
		};

		parser.onError = (error) => {
			report(`JSON parsing error: ${error.message}`, 'warn');
			// Don't throw here - we'll handle this in the fallback logic
		};

		// Process the stream - handle different possible stream structures
		try {
			// Try textStream property first (most common)
			if (
				textStream.textStream &&
				typeof textStream.textStream[Symbol.asyncIterator] === 'function'
			) {
				for await (const chunk of textStream.textStream) {
					accumulatedText += chunk;
					parser.write(chunk);
				}
			}
			// Try fullStream property as fallback
			else if (
				textStream.fullStream &&
				typeof textStream.fullStream[Symbol.asyncIterator] === 'function'
			) {
				for await (const chunk of textStream.fullStream) {
					if (chunk.type === 'text-delta' && chunk.textDelta) {
						accumulatedText += chunk.textDelta;
						parser.write(chunk.textDelta);
					}
				}
			}
			// Try iterating the stream object directly
			else if (typeof textStream[Symbol.asyncIterator] === 'function') {
				for await (const chunk of textStream) {
					accumulatedText += chunk;
					parser.write(chunk);
				}
			} else {
				throw new Error(
					'Stream object is not iterable - no textStream, fullStream, or direct async iterator found'
				);
			}
		} catch (streamError) {
			report(`Stream processing error: ${streamError.message}`, 'error');
			throw new Error(
				`Failed to process AI text stream: ${streamError.message}`
			);
		}

		parser.end();

		// Wait a moment for final parsing
		await new Promise((resolve) => setTimeout(resolve, 100));

		// If streaming parser didn't get all tasks, try fallback parsing
		if (parsedTasks.length < numTasks && accumulatedText) {
			try {
				report(
					`Attempting fallback JSON parsing (got ${parsedTasks.length}/${numTasks} tasks from stream)`,
					'info'
				);
				const fullResponse = JSON.parse(accumulatedText);
				if (fullResponse.tasks && Array.isArray(fullResponse.tasks)) {
					// Only add tasks we haven't already parsed AND report progress for each
					const newTasks = fullResponse.tasks.slice(parsedTasks.length);
					for (const task of newTasks) {
						if (
							task &&
							task.title &&
							typeof task.title === 'string' &&
							task.title.trim()
						) {
							parsedTasks.push(task);
							const currentProgress = parsedTasks.length;
							const priority = task.priority || 'medium';
							const priorityIndicator = priorityMap[priority];

							// Re-estimate output tokens for fallback tasks
							estimatedOutputTokens = estimateTokens(accumulatedText);

							// Report progress for fallback-discovered tasks
							await reportProgress({
								progress: currentProgress,
								total: numTasks,
								message: `${priorityIndicator} Task ${currentProgress}/${numTasks} - ${task.title} | ~Output: ${estimatedOutputTokens} tokens`
							}).catch((error) => {
								report(`Progress reporting failed: ${error.message}`, 'warn');
							});
						}
					}

					if (newTasks.length > 0) {
						report(
							`Fallback parsing recovered ${newTasks.length} additional tasks`,
							'info'
						);
					}
				}
			} catch (parseError) {
				// If we have some tasks from streaming, continue with those
				if (parsedTasks.length > 0) {
					report(
						`Fallback JSON parsing failed, but continuing with ${parsedTasks.length} tasks from streaming`,
						'warn'
					);
				} else {
					throw new Error(
						`Failed to parse AI response as JSON: ${parseError.message}`
					);
				}
			}
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
				priority: task.priority || 'medium',
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
		const outputData = { tasks: finalTasks };

		// Create the directory if it doesn't exist
		const tasksDir = path.dirname(tasksPath);
		if (!fs.existsSync(tasksDir)) {
			fs.mkdirSync(tasksDir, { recursive: true });
		}

		// Write the final tasks to the file
		writeJSON(tasksPath, outputData);
		report(
			`Successfully ${append ? 'appended' : 'generated'} ${processedNewTasks.length} tasks in ${tasksPath}${research ? ' with research-backed analysis' : ''}`,
			'success'
		);

		// Generate markdown task files after writing tasks.json
		await generateTaskFiles(tasksPath, path.dirname(tasksPath), { mcpLog });

		// Final progress report - completion
		// Use actual telemetry if available, otherwise fall back to estimates
		const hasValidTelemetry =
			aiServiceResponse.telemetryData &&
			(aiServiceResponse.telemetryData.inputTokens > 0 ||
				aiServiceResponse.telemetryData.outputTokens > 0);

		let completionMessage;
		if (hasValidTelemetry) {
			// Use actual telemetry data
			completionMessage = `✅ Task Generation Completed | Tokens (I/O): ${aiServiceResponse.telemetryData.inputTokens}/${aiServiceResponse.telemetryData.outputTokens}`;
		} else {
			// Use estimates and indicate they're estimates
			completionMessage = `✅ Task Generation Completed | ~Tokens (I/O): ${estimatedInputTokens}/${estimatedOutputTokens}`;
		}

		await reportProgress({
			progress: numTasks,
			total: numTasks,
			message: completionMessage
		});

		// Return telemetry data
		return {
			success: true,
			tasksPath,
			telemetryData: aiServiceResponse?.telemetryData
		};
	} catch (error) {
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
		research = false
	} = options;
	const { logFn, report, outputFormat, isMCP } = createLoggingFunctions(mcpLog);

	report(
		`Parsing PRD file: ${prdPath}, Force: ${force}, Append: ${append}, Research: ${research}`
	);

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
				if (existingData && Array.isArray(existingData.tasks)) {
					existingTasks = existingData.tasks;
					if (existingTasks.length > 0) {
						nextId = Math.max(...existingTasks.map((t) => t.id || 0)) + 1;
						report(
							`Found ${existingTasks.length} existing tasks. Next ID will be ${nextId}.`,
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
				const overwriteError = new Error(
					`Output file ${tasksPath} already exists. Use --force to overwrite or --append.`
				);
				report(overwriteError.message, 'error');
				if (outputFormat === 'text') {
					console.error(chalk.red(overwriteError.message));
					process.exit(1);
				} else {
					throw overwriteError;
				}
			} else {
				report(
					`Force flag enabled. Overwriting existing file: ${tasksPath}`,
					'info'
				);
			}
		}

		report(`Reading PRD content from ${prdPath}`, 'info');
		const prdContent = fs.readFileSync(prdPath, 'utf8');
		if (!prdContent) {
			throw new Error(`Input file ${prdPath} is empty or could not be read.`);
		}

		// Build prompts using helper functions
		const systemPrompt = buildSystemPrompt(research, numTasks, nextId);
		const userPrompt = buildUserPrompt(
			prdContent,
			numTasks,
			nextId,
			prdPath,
			research
		);

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
				priority: task.priority || 'medium',
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
		const outputData = { tasks: finalTasks };

		// Write the final tasks to the file
		writeJSON(tasksPath, outputData);
		report(
			`Successfully ${append ? 'appended' : 'generated'} ${processedNewTasks.length} tasks in ${tasksPath}${research ? ' with research-backed analysis' : ''}`,
			'success'
		);

		// Generate markdown task files after writing tasks.json
		await generateTaskFiles(tasksPath, path.dirname(tasksPath), { mcpLog });

		// Handle CLI output (e.g., success message)
		if (outputFormat === 'text') {
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

			if (aiServiceResponse && aiServiceResponse.telemetryData) {
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
		report(`Error parsing PRD: ${error.message}`, 'error');

		// Only show error UI for text output (CLI)
		if (outputFormat === 'text') {
			console.error(chalk.red(`Error: ${error.message}`));

			if (getDebugFlag(projectRoot)) {
				// Use projectRoot for debug flag check
				console.error(error);
			}

			process.exit(1);
		} else {
			throw error; // Re-throw for JSON output
		}
	}
}

export default parsePRD;
