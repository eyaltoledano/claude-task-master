/**
 * task-manager.js
 * Task management functions for the Task Master CLI
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import readline from 'readline';
import { Anthropic } from '@anthropic-ai/sdk';
import ora from 'ora';
import inquirer from 'inquirer';
import { EventEmitter } from 'events'; // Add EventEmitter import

import {
	CONFIG,
	log,
	readJSON,
	writeJSON,
	sanitizePrompt,
	findTaskById,
	readComplexityReport,
	findTaskInComplexityReport,
	truncate,
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from './utils.js';

import {
	displayBanner,
	getStatusWithColor,
	formatDependenciesWithStatus,
	getComplexityWithColor,
	startLoadingIndicator,
	stopLoadingIndicator,
	createProgressBar,
	displayAnalysisProgress,
	formatComplexitySummary,
	displayPRDParsingStart,
	displayPRDParsingProgress,
	displayPRDParsingSummary
} from './ui.js';

import {
	callClaude,
	generateSubtasks,
	generateSubtasksWithPerplexity,
	generateComplexityAnalysisPrompt,
	getAvailableAIModel,
	handleClaudeError,
	_handleAnthropicStream,
	getConfiguredAnthropicClient,
	sendChatWithContext,
	parseTasksFromCompletion,
	generateTaskDescriptionWithPerplexity,
	parseSubtasksFromText,
	handleStreamingRequest
} from './ai-services.js';

import {
	validateTaskDependencies,
	validateAndFixDependencies
} from './dependency-manager.js';

/**
 * Creates a progress emitter for streaming events
 * @returns {Object} An object with methods to emit and listen to events
 */
function createProgressEmitter() {
	const emitter = new EventEmitter();

	return {
		emitter,
		// Event emission methods
		emitToken: (data) => emitter.emit('token', data),
		emitTask: (data) => emitter.emit('task', data),
		emitProgress: (data) => emitter.emit('progress', data),
		emitComplete: (data) => emitter.emit('complete', data),
		emitThinking: (data) => emitter.emit('thinking', data),

		// Event listener methods
		onToken: (callback) => emitter.on('token', callback),
		onTask: (callback) => emitter.on('task', callback),
		onProgress: (callback) => emitter.on('progress', callback),
		onComplete: (callback) => emitter.on('complete', callback),
		onThinking: (callback) => emitter.on('thinking', callback),

		// Cleanup method
		removeAllListeners: () => emitter.removeAllListeners()
	};
}

// Initialize Anthropic client
const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY
});

// Import perplexity if available
let perplexity;

try {
	if (process.env.PERPLEXITY_API_KEY) {
		// Using the existing approach from ai-services.js
		const OpenAI = (await import('openai')).default;

		perplexity = new OpenAI({
			apiKey: process.env.PERPLEXITY_API_KEY,
			baseURL: 'https://api.perplexity.ai'
		});

		log(
			'info',
			`Initialized Perplexity client with OpenAI compatibility layer`
		);
	}
} catch (error) {
	log('warn', `Failed to initialize Perplexity client: ${error.message}`);
	log('warn', 'Research-backed features will not be available');
}

// Module-level sigintHandler declaration to be used across functions
let sigintHandler = null;

/**
 * Parse a PRD file and generate tasks
 * @param {string} prdPath - Path to the PRD file
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} numTasks - Number of tasks to generate
 * @param {Object} options - Additional options
 * @param {Object} options.reportProgress - Function to report progress to MCP server (optional)
 * @param {Object} options.mcpLog - MCP logger object (optional)
 * @param {Object} options.session - Session object from MCP server (optional)
 * @param {Object} aiClient - AI client to use (optional)
 * @param {Object} modelConfig - Model configuration (optional)
 */
async function parsePRD(prdPath, tasksPath, numTasks, options = {}) {
	// Define progressInterval at the top level of the function so the handler can access it
	let progressInterval = null;

	// Create progress emitter for streaming events
	const progress = createProgressEmitter();

	// Add a debug listener at the process level to see if SIGINT is being received
	const debugSignalListener = () => {
		log('debug', 'SIGINT received by debug listener');
	};
	process.on('SIGINT', debugSignalListener);

	// Set up SIGINT (Control-C) handler to cancel the operation gracefully
	let sigintHandler;
	const registerSigintHandler = () => {
		// Only register if not already registered
		if (!sigintHandler) {
			sigintHandler = () => {
				log('debug', 'SIGINT handler executing for parsePRD');

				// Try to clear any intervals before exiting
				if (progressInterval) {
					clearInterval(progressInterval);
					progressInterval = null;
					log('debug', 'Cleared progress interval');
				}

				// Clear any terminal state
				process.stdout.write('\r\x1B[K'); // Clear current line

				// Show cancellation message
				console.log(chalk.yellow('\n\nPRD parsing cancelled by user.'));

				// Make sure we remove our event listeners before exiting
				progress.removeAllListeners();
				log('debug', 'Removed all progress event listeners');

				// Clean up SIGINT handler
				cleanupSigintHandler();

				// Show cursor (in case it was hidden)
				process.stdout.write('\u001B[?25h');

				// Force exit after giving time for cleanup
				setTimeout(() => {
					process.exit(0);
				}, 100);
			};

			// Register the handler
			process.on('SIGINT', sigintHandler);
			log('debug', 'Registered SIGINT handler for parsePRD');
		}
	};

	// Clean up function to remove the handler when done
	const cleanupSigintHandler = () => {
		if (sigintHandler) {
			process.removeListener('SIGINT', sigintHandler);
			sigintHandler = null;
			log('debug', 'Removed SIGINT handler');
		}

		// Also remove the debug listener
		process.removeListener('SIGINT', debugSignalListener);
		log('debug', 'Removed debug SIGINT listener');
	};

	// Cleanup resources function to ensure consistent state even after errors
	const cleanupResources = () => {
		// Clean up SIGINT handler
		cleanupSigintHandler();

		// Clean up progressInterval
		if (progressInterval) {
			clearInterval(progressInterval);
			progressInterval = null;
		}

		// Clean up event listeners
		progress.removeAllListeners();

		// Restore cursor
		process.stdout.write('\u001B[?25h');
	};

	try {
		// Input validation
		if (!prdPath || typeof prdPath !== 'string') {
			throw new Error(
				'Invalid PRD file path. Please provide a valid path to a PRD document.'
			);
		}

		if (!fs.existsSync(prdPath)) {
			throw new Error(
				`PRD file not found at path: ${prdPath}. Please check the file path and try again.`
			);
		}

		if (!numTasks || !Number.isInteger(numTasks) || numTasks <= 0) {
			numTasks = CONFIG.defaultNumTasks || 10;
			log(
				'warn',
				`Invalid number of tasks specified. Using default value: ${numTasks}`
			);
		}

		// Validate API key
		if (!process.env.ANTHROPIC_API_KEY) {
			throw new Error(
				'ANTHROPIC_API_KEY environment variable is missing. Required for PRD parsing.'
			);
		}

		log('debug', `Parsing PRD file: ${prdPath}`);

		// Register SIGINT handler to allow cancellation with Control-C
		registerSigintHandler();

		// Track start time
		const startTime = Date.now();

		// Display parsing start announcement
		displayPRDParsingStart(
			prdPath,
			tasksPath,
			numTasks,
			CONFIG.model,
			CONFIG.temperature
		);

		// Read the PRD content
		const prdContent = fs.readFileSync(prdPath, 'utf8');

		// Validate PRD content
		if (!prdContent || prdContent.trim().length === 0) {
			throw new Error(
				'The PRD file is empty. Please provide a file with content.'
			);
		}

		if (prdContent.length < 100) {
			// Arbitrary minimum length to be a useful PRD
			log(
				'warn',
				'The PRD content is very short. This may not provide enough context for generating meaningful tasks.'
			);
		}

		// Estimate total tokens (roughly 1 token per 4 chars + margin for system prompt)
		const estimatedTotalTokens = Math.ceil(prdContent.length / 4) + 1000;

		// Initialize progress tracking
		let percentComplete = 0;
		let elapsedSeconds = 0;
		let contextTokens = 0;
		let promptTokens = 0;
		let completionTokens = 0;
		let tasksGenerated = 0; // Initialize to 0
		let microProgress = 0; // Track micro-progress between task detections
		let lastMicroUpdateTime = Date.now(); // Track time of last micro update

		// Initialize static variables for displayPRDParsingProgress
		displayPRDParsingProgress.thinkingState = null;
		displayPRDParsingProgress.latestTaskInfo = null;

		// Set up progress event handlers
		progress.onProgress((data) => {
			// Update our tracking variables
			percentComplete = data.percentComplete || percentComplete;
			contextTokens = data.tokenCount || contextTokens;
			promptTokens = data.promptTokens || promptTokens;
			completionTokens = data.completionTokens || completionTokens;
			tasksGenerated = data.tasksGenerated || tasksGenerated;

			// Additional handling for near-completion state
			if (data.nearCompletion) {
				log('debug', 'Approaching completion state');
			}
		});

		progress.onTask((taskInfo) => {
			// Always update tasksGenerated based on taskCount from the event
			if (taskInfo.taskCount !== undefined) {
				const prevTasksGenerated = tasksGenerated;
				tasksGenerated = taskInfo.taskCount;
				log(
					'debug',
					`onTask: Updated tasksGenerated from ${prevTasksGenerated} to ${tasksGenerated}`
				);

				// Ensure seenTaskIds.size also stays in sync with taskCount
				if (seenTaskIds.size !== taskInfo.taskCount) {
					log(
						'debug',
						`SYNC: Detected discrepancy - seenTaskIds.size=${seenTaskIds.size} but taskCount=${taskInfo.taskCount}`
					);
					// We don't know which IDs to add/remove, so we can't directly update seenTaskIds here
					// But we log the discrepancy for debugging purposes
				}
			}

			log(
				'debug',
				`Detected task ${taskInfo.taskId}: ${taskInfo.title} (taskCount=${taskInfo.taskCount})`
			);

			// Store latest task info for use in the progress interval
			if (!displayPRDParsingProgress.latestTaskInfo) {
				displayPRDParsingProgress.latestTaskInfo = {};
			}

			// Always update the latest task info with complete information
			displayPRDParsingProgress.latestTaskInfo = {
				taskId: taskInfo.taskId,
				title: taskInfo.title,
				priority: taskInfo.priority,
				description: taskInfo.description,
				taskCount: taskInfo.taskCount,
				_prioritySource: taskInfo._prioritySource || 'event' // Add source info
			};

			log(
				'debug',
				`onTask: Updated latestTaskInfo with taskId=${taskInfo.taskId}, title="${taskInfo.title?.substring(0, 20)}...", priority="${taskInfo.priority}", source="${taskInfo._prioritySource || 'event'}"`
			);
		});

		progress.onThinking((data) => {
			// Update our display with thinking state information
			if (data.message) {
				log('debug', `Thinking state: ${data.message}`);

				// Store thinking state for use in the progress interval
				if (!displayPRDParsingProgress.thinkingState) {
					displayPRDParsingProgress.thinkingState = {};
				}

				displayPRDParsingProgress.thinkingState = {
					message: data.message,
					state: data.state || 'processing'
				};
			}
		});

		// Setup progress update interval - this maintains compatibility with current UI
		progressInterval = setInterval(() => {
			elapsedSeconds = (Date.now() - startTime) / 1000;

			// Track our current thinking state
			const currentThinkingState =
				displayPRDParsingProgress.thinkingState || {};

			// Get latest task info if available
			const latestTaskInfo = displayPRDParsingProgress.latestTaskInfo;

			log(
				'debug',
				`Progress interval: seenTaskIds.size=${seenTaskIds.size}, tasksGenerated=${tasksGenerated}, numTasks=${numTasks}`
			);
			if (latestTaskInfo) {
				log(
					'debug',
					`Progress interval: latestTaskInfo.taskId=${latestTaskInfo.taskId}, latestTaskInfo.taskCount=${latestTaskInfo.taskCount}`
				);
			}

			// Calculate continuous micro-progress
			const now = Date.now();
			const timeSinceLastUpdate = now - lastMicroUpdateTime;

			// Update progress every interval (100ms)
			if (timeSinceLastUpdate >= 100) {
				// Direct calculation based on actual tasks detected
				// No micro-progress estimation
				if (seenTaskIds.size === 0) {
					percentComplete = 0;
				} else {
					// Calculate progress as a percentage of tasks completed (0-95%)
					percentComplete = (seenTaskIds.size / numTasks) * 95;
				}

				log(
					'debug',
					`SYNC: Direct progress calculation: ${percentComplete}% based on ${seenTaskIds.size}/${numTasks} tasks`
				);

				lastMicroUpdateTime = now;

				// Cap total progress at 99% until completion
				const totalProgress = Math.min(99, percentComplete);

				// Emit progress update based on actual task count
				progress.emitProgress({
					percentComplete: totalProgress,
					tokenCount: contextTokens,
					estimatedTotalTokens,
					tasksGenerated: seenTaskIds.size, // Always use seenTaskIds.size
					totalTasks: numTasks,
					elapsed: elapsedSeconds,
					microProgress: false // Not using micro-progress anymore
				});
			}

			log(
				'debug',
				`Calling displayPRDParsingProgress with tasksGenerated=${tasksGenerated}, totalTasks=${numTasks}`
			);
			if (latestTaskInfo) {
				log('debug', `Passing taskInfo with taskId=${latestTaskInfo.taskId}`);
			}

			displayPRDParsingProgress({
				percentComplete: Math.min(99, percentComplete),
				elapsed: elapsedSeconds,
				contextTokens,
				estimatedTotalTokens,
				promptTokens,
				completionTokens,
				tasksGenerated: seenTaskIds.size, // Always use seenTaskIds.size
				totalTasks: numTasks,
				completed: false,
				message: currentThinkingState.message, // Pass current thinking message
				state: currentThinkingState.state, // Pass current state
				taskInfo: latestTaskInfo, // Pass latest task info
				microProgress: false // No longer using micro-progress
			});

			// Reset latest task info after it's displayed
			displayPRDParsingProgress.latestTaskInfo = null;
		}, 100); // Update every 100ms

		// Build the system prompt
		const systemPrompt = `You are an AI assistant helping to break down a Product Requirements Document (PRD) into a set of sequential development tasks. 
Your goal is to create ${numTasks} well-structured, actionable development tasks based on the PRD provided.

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
1. Create exactly ${numTasks} tasks, numbered from 1 to ${numTasks}
2. Each task should be atomic and focused on a single responsibility
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs)
7. Assign priority (high/medium/low) based on criticality and dependency order
8. Include detailed implementation guidance in the "details" field

Expected output format:
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
    "projectName": "${CONFIG.projectName || 'PRD Implementation'}",
    "totalTasks": ${numTasks},
    "sourceFile": "${prdPath}",
    "generatedAt": "${new Date().toISOString().split('T')[0]}"
  }
}

Important: Your response must be valid JSON only, with no additional explanation or comments.`;

		// Calculate prompt token estimate for progress tracking
		const estimatedPromptTokens =
			Math.ceil(prdContent.length / 4) +
			Math.ceil(systemPrompt.length / 4) +
			100; // Account for role tokens and message formatting

		// Set the initial promptTokens to our estimate - will be updated with actual values when available
		promptTokens = estimatedPromptTokens;
		log(
			'debug',
			`Setting initial promptTokens to estimated value: ${promptTokens}`
		);

		// Setup streaming response tracking
		let buffer = '';
		let lastTaskTime = Date.now();
		const seenTaskIds = new Set();

		// Function to detect tasks in the streaming response
		const detectTasks = (content) => {
			// Enhanced debugging - log a sample of the raw content
			if (process.env.TRACE === 'true') {
				// Only show this in TRACE mode as it's very verbose
				const contentSample = content.substring(
					content.length - Math.min(1000, content.length)
				);
				log(
					'debug',
					`[PRIORITY-TRACE] Recent content sample for detection (last 1000 chars): ${JSON.stringify(contentSample)}`
				);
			}

			// Look for task patterns in the buffer using improved regex patterns
			// Match both JSON format and potential partially formed JSON
			const titleRegex = /"title"\s*:\s*"([^"]+)"/g;
			const idRegex = /"id"\s*:\s*(\d+)/g;

			// Enhanced priority regex patterns - make these more aggressive
			// Original pattern was too strict for streaming content
			const priorityRegexPatterns = [
				/"priority"\s*:\s*"(high|medium|low)"/gi,
				/"priority"\s*:\s*(high|medium|low)\b/gi,
				/priority['"]?\s*:\s*['"]?(high|medium|low)['"]?/gi,
				/priority\s*:\s*(high|medium|low)\b/gi,
				/"priority"\s*:\s*["']?(high|medium|low)["']?/gi,
				/priority\s*[:=]\s*["']?(high|medium|low)["']?/gi
			];

			const descriptionRegex = /"description"\s*:\s*"([^"]+)"/g;

			let match;
			const newTasks = [];

			// Process ID and title matches to find tasks
			const foundIds = new Set();
			const matchedTasks = new Map();

			// First pass: find all task IDs
			while ((match = idRegex.exec(content)) !== null) {
				const taskId = parseInt(match[1], 10);
				foundIds.add(taskId);

				log(
					'debug',
					`Found task ID ${taskId} in content at position ${match.index}`
				);

				// Only process IDs we haven't seen before
				if (!seenTaskIds.has(taskId)) {
					log(
						'debug',
						`New task ID ${taskId} detected (current seenTaskIds size: ${seenTaskIds.size})`
					);

					// Store the position where we found this ID
					matchedTasks.set(taskId, {
						pos: match.index,
						id: taskId
					});
				}
			}

			log(
				'debug',
				`Total unique IDs found: ${foundIds.size}, New tasks to process: ${matchedTasks.size}`
			);

			// Second pass: find titles and priorities for these tasks
			for (const [taskId, taskInfo] of matchedTasks.entries()) {
				const taskStartPos = taskInfo.pos;
				// Search for title after the ID position
				const titleSearch = content.substring(taskStartPos);
				const titleMatch = titleRegex.exec(titleSearch);

				if (titleMatch) {
					// Found title - add to task info
					taskInfo.title = titleMatch[1];
					log(
						'debug',
						`Found title for task ${taskId}: "${titleMatch[1].substring(0, 30)}..."`
					);

					// Search for priority after the ID
					const priorityMatch = titleSearch.match(
						/"priority"\s*:\s*"(high|medium|low)"/i
					);

					// Enhanced priority logging and detection
					let prioritySource = 'default';
					let detectedPriority = null;

					// IMPORTANT: Extract context for priority detection debugging
					if (process.env.TRACE === 'true') {
						const contextWindow = 500; // Increased context window for better debugging
						const startPos = Math.max(0, taskStartPos - 50);
						const endPos = Math.min(
							content.length,
							taskStartPos + contextWindow
						);
						const taskContext = content.substring(startPos, endPos);
						log(
							'debug',
							`[PRIORITY-TRACE] Task ${taskId} context (${startPos}-${endPos}): ${JSON.stringify(taskContext)}`
						);
					}

					if (priorityMatch) {
						detectedPriority = priorityMatch[1].toLowerCase();
						prioritySource = 'standard_match';
						log(
							'debug',
							`[PRIORITY] Found standard priority for task ${taskId}: "${detectedPriority}"`
						);
					} else {
						// Try searching in the whole task JSON object
						// Extract what looks like the task's JSON object
						const taskObjectStart = Math.max(0, taskStartPos - 100);
						const taskObjectEnd = Math.min(content.length, taskStartPos + 500);
						const taskObjectContext = content.substring(
							taskObjectStart,
							taskObjectEnd
						);

						// Try multiple alternative patterns
						const altPatterns = [
							{
								pattern: /"priority"\s*:\s*['"]?(high|medium|low)['"]?/i,
								name: 'quoted_flexible'
							},
							{
								pattern: /priority['"]?\s*:\s*['"]?(high|medium|low)['"]?/i,
								name: 'unquoted_key'
							},
							{
								pattern: /"priority"\s*:\s*(high|medium|low)\b/i,
								name: 'unquoted_value'
							},
							{
								pattern: /priority\s*:\s*(high|medium|low)\b/i,
								name: 'simple_format'
							},
							{
								pattern: /priority\s*[:=]\s*(?:"|')?(\w+)(?:"|')?/i,
								name: 'any_word_value'
							}
						];

						// Try each pattern in the task object context
						for (const { pattern, name } of altPatterns) {
							const altMatch = taskObjectContext.match(pattern);
							if (altMatch) {
								detectedPriority = altMatch[1].toLowerCase();
								prioritySource = `alt_pattern_${name}`;

								// Validate if it's a standard priority, otherwise default to 'medium'
								if (!['high', 'medium', 'low'].includes(detectedPriority)) {
									log(
										'debug',
										`[PRIORITY] Found non-standard priority "${detectedPriority}" for task ${taskId}, defaulting to medium`
									);
									detectedPriority = 'medium';
									prioritySource = `normalized_${name}`;
								} else {
									log(
										'debug',
										`[PRIORITY] Found alternative priority "${detectedPriority}" for task ${taskId} using pattern ${name}`
									);
								}
								break;
							}
						}

						// REPLACED WITH:
						if (!detectedPriority) {
							// Don't use any inference - wait for the actual priority to be available in the stream
							log(
								'debug',
								`[PRIORITY] No priority detected for task ${taskId} yet. Will wait for priority to appear in stream.`
							);
							// Skip this task for now - we'll detect it in a future iteration when its priority is available
							continue;
						}
					}

					// Set the priority with detailed logging
					taskInfo.priority = detectedPriority;
					taskInfo._prioritySource = prioritySource; // Store source for debugging
					log(
						'debug',
						`[PRIORITY] Set priority for task ${taskId} to "${taskInfo.priority}" (source: ${prioritySource})`
					);

					// Look for description if available
					const descriptionMatch = titleSearch.match(
						/"description"\s*:\s*"([^"]+)"/
					);
					if (descriptionMatch) {
						taskInfo.description = descriptionMatch[1];
						log('debug', `Found description for task ${taskId}`);
					}

					// Calculate estimated total task count if not set already
					if (numTasks === CONFIG.defaultNumTasks && taskId > 1) {
						// Once we see at least two tasks, we can start to make a better guess
						// Look for patterns like "id": X where X is higher than what we've seen
						const idMatches = content.match(/"id"\s*:\s*(\d+)/g) || [];
						const allIds = idMatches.map((match) =>
							parseInt(match.match(/\d+/)[0], 10)
						);
						if (allIds.length > 0) {
							const maxId = Math.max(...allIds);
							if (maxId > numTasks) {
								const prevNumTasks = numTasks;
								numTasks = maxId;
								log(
									'debug',
									`Estimated total tasks increased from ${prevNumTasks} to ${numTasks} based on highest ID found`
								);
							}
						}
					}

					// IMPORTANT CHANGE: Only process and emit the task if we have both title AND priority
					if (taskInfo.title && taskInfo.priority) {
						const prevSize = seenTaskIds.size;
						// Mark this task as seen
						seenTaskIds.add(taskId);

						if (seenTaskIds.size > prevSize) {
							log(
								'debug',
								`Added task ID ${taskId} to seenTaskIds. Size changed from ${prevSize} to ${seenTaskIds.size}`
							);

							// We have a new complete task, add it to our tasks
							newTasks.push(taskInfo);

							// Update last task time for timing tracking
							lastTaskTime = Date.now();

							// ALWAYS set tasksGenerated to match seenTaskIds.size for consistency
							tasksGenerated = seenTaskIds.size;
							log(
								'debug',
								`SYNC: Set tasksGenerated=${tasksGenerated} to match seenTaskIds.size=${seenTaskIds.size}`
							);

							// Emit a task event for this new task with accurate priority
							progress.emitTask({
								taskId: taskId,
								title: taskInfo.title,
								priority: taskInfo.priority,
								description: taskInfo.description || '',
								taskCount: seenTaskIds.size, // ALWAYS include accurate taskCount
								_prioritySource: taskInfo._prioritySource || 'unknown' // Add source for debugging
							});

							log(
								'debug',
								`Emitted task event for ID=${taskId}, title="${taskInfo.title?.substring(0, 20)}...", priority="${taskInfo.priority}" (source: ${taskInfo._prioritySource || 'unknown'}), count=${seenTaskIds.size}`
							);
						} else {
							log(
								'debug',
								`Task ID ${taskId} was already in seenTaskIds, size remains ${seenTaskIds.size}`
							);
						}
					} else {
						// We don't have all required information yet - log what's missing
						const missingInfo = [];
						if (!taskInfo.title) missingInfo.push('title');
						if (!taskInfo.priority) missingInfo.push('priority');
						log(
							'debug',
							`Task ${taskId} is incomplete, missing: ${missingInfo.join(', ')}. Waiting for complete information.`
						);
					}
				} else {
					log(
						'debug',
						`No title found for task ${taskId} yet, may be incomplete`
					);
				}
			}

			// Improve token counting for more accurate progress tracking
			// Count tokens based on streaming response content
			// Note: This is an approximation, as the exact token count isn't available from the API
			// We use a combination of character count and some heuristics
			const tokenCount = calculateTokens(content);

			// Calculate a more accurate percentage that includes:
			// 1. Actual processed token count
			// 2. Task completion ratio
			// 3. Position in the response stream
			// The goal is to prevent jumps between phases

			// Start with token-based percentage
			let tokenBasedPercent = Math.min(
				99,
				Math.floor((tokenCount / estimatedTotalTokens) * 100)
			);

			// Use task detection to enhance percentage calculation
			// If we've found tasks, we should be making progress
			const taskBasedPercent =
				seenTaskIds.size > 0
					? Math.max(
							5,
							Math.min(90, Math.floor((seenTaskIds.size / numTasks) * 100))
						)
					: 0;

			// If we see "metadata" in the response, we're nearing completion
			const nearingCompletion =
				content.includes('"metadata":') && seenTaskIds.size >= numTasks * 0.8;

			// If we're at the end brackets of the JSON, we're almost done
			const finalizing = content.endsWith('}}') && seenTaskIds.size > 0;

			// Bias percentage based on these signals
			let adjustedPercent = tokenBasedPercent;

			// If we're detecting tasks, ensure progress stays in a reasonable range
			if (seenTaskIds.size > 0) {
				// Ensure percentage is at least proportional to tasks generated
				adjustedPercent = Math.max(adjustedPercent, taskBasedPercent);
			}

			// Handle completion phases
			if (nearingCompletion) {
				// When nearing completion, percentage should be at least 85%
				adjustedPercent = Math.max(adjustedPercent, 85);
			}

			if (finalizing) {
				// When finalizing, percentage should be at least 95%
				adjustedPercent = Math.max(adjustedPercent, 95);
			}

			// Clamp final percentage between 0-99 (100% only when truly complete)
			const percentComplete = Math.min(99, Math.max(0, adjustedPercent));

			// Emit progress event with calculated values
			progress.emitProgress({
				percentComplete,
				tokenCount,
				estimatedTotalTokens,
				tasksGenerated: seenTaskIds.size,
				totalTasks: numTasks,
				nearCompletion: nearingCompletion || finalizing
			});

			// Analyze buffer for hints of upcoming tasks during quiet periods
			if (Date.now() - lastTaskTime > 3000) {
				// Look for specific patterns that indicate different phases of processing
				let processingState = 'processing';
				let message = 'Analyzing PRD content...';

				if (content.match(/dependencies/i) && !seenTaskIds.size) {
					message = 'Creating task structure...';
				} else if (
					content.match(/{"id":\s*\d+\s*,\s*$/) ||
					content.match(/{"id":\s*\d+\s*}$/)
				) {
					message = 'Starting new task...';
				} else if (content.match(/"priority":\s*"(high|medium|low)"$/i)) {
					message = 'Setting task priorities...';
				} else if (content.match(/"details":\s*"/i)) {
					message = 'Writing implementation details...';
				} else if (content.match(/"testStrategy":\s*"/i)) {
					message = 'Defining test strategies...';
				} else if (seenTaskIds.size > 0 && content.match(/"metadata":/i)) {
					message = 'Finalizing task metadata...';
					processingState = 'finishing';
				}

				// Send thinking state for UI updates during quiet periods
				progress.emitThinking({
					message,
					state: processingState
				});
			}

			return newTasks;
		};

		// Helper function to calculate tokens from text content
		// This provides a more accurate estimation than simple character count
		function calculateTokens(text) {
			if (!text) return 0;

			// Claude's tokenization is roughly 4 characters per token on average
			// But we want to be more precise by counting:
			// - Words (roughly 1.3 tokens per word)
			// - Numbers (roughly 1 token per 2-4 digits)
			// - Special characters (roughly 1 token each)

			// Count words (split by whitespace)
			const words = text.split(/\s+/).filter((w) => w.length > 0);
			const wordTokens = words.length * 1.3;

			// Count digits (numbers take fewer tokens than their character count suggests)
			const digits = (text.match(/\d/g) || []).length;
			const digitTokens = digits * 0.25; // Approximately 4 digits per token

			// Count special characters and punctuation (often 1 token each)
			const specialChars = (text.match(/[^\w\s]/g) || []).length;

			// Sum these components and add a bias for JSON structure
			// JSON structure (braces, quotes, etc.) tends to tokenize efficiently
			const jsonBias = Math.min(500, text.length * 0.05); // Cap the bias

			// Calculate total adjusted token count
			const calculatedTokens = Math.ceil(
				wordTokens + digitTokens + specialChars - jsonBias
			);

			// Safety bounds - ensure at least 1 token per 5 characters, and no more than 1 per 2 characters
			const minTokens = Math.ceil(text.length / 5);
			const maxTokens = Math.ceil(text.length / 2);

			return Math.min(maxTokens, Math.max(minTokens, calculatedTokens));
		}

		// Custom streaming progress callback function
		const streamingTracker = (content, chunkInfo = {}) => {
			// Add state variables for micro-progress
			if (typeof streamingTracker.microProgress === 'undefined') {
				streamingTracker.microProgress = 0;
				streamingTracker.lastMicroUpdateTime = Date.now();
				streamingTracker.microUpdateInterval = 200; // milliseconds between updates
				streamingTracker.maxMicroProgressPerPhase = {
					analyzing: 2.5,
					generating_tasks: 1.0,
					finalizing: 0.8
				};
			}

			// Process the accumulating buffer to detect tasks and other patterns
			detectTasks(content);

			// Update token counting from provided chunk info if available
			if (chunkInfo.totalTokens) {
				// Use exact token count from API if available
				contextTokens = chunkInfo.totalTokens;
			} else {
				// Use our improved token calculation function if available
				contextTokens = calculateTokens
					? calculateTokens(content)
					: Math.floor(content.length / 4);
			}

			// Track prompt and completion tokens separately from each chunk
			if (chunkInfo.promptTokens) {
				promptTokens = chunkInfo.promptTokens;
				log('debug', `Updated promptTokens to ${promptTokens}`);
			}

			if (chunkInfo.completionTokens) {
				completionTokens = chunkInfo.completionTokens;
				log('debug', `Updated completionTokens to ${completionTokens}`);
			} else if (chunkInfo.delta && chunkInfo.delta.text) {
				// If we have new text but no completion token count, estimate based on the delta
				const deltaTokenEstimate = Math.ceil(chunkInfo.delta.text.length / 4);
				completionTokens += deltaTokenEstimate;
				log(
					'debug',
					`Estimated ${deltaTokenEstimate} tokens from delta, completionTokens now ${completionTokens}`
				);
			}

			// Update context tokens to be the sum of prompt and completion tokens
			contextTokens = promptTokens + completionTokens;

			// Update estimated total tokens based on more accurate prompt token count if available
			if (chunkInfo.promptTokens && estimatedTotalTokens) {
				const currentEstimate = estimatedTotalTokens;
				// Keep the completion token estimate but use exact prompt tokens
				const completionEstimate =
					currentEstimate - Math.ceil(prdContent.length / 4);
				estimatedTotalTokens = chunkInfo.promptTokens + completionEstimate;
			}

			// Calculate progress percentage with multiple signals
			let calculatedPercent;

			// Track phases for better progress estimation - refine phase detection
			let currentPhase = 'analyzing';

			// Determine the phase based on task detection and display state
			// We track both the content phase (based on task detection) and display phase (for UI messaging)
			let contentPhase;

			// Content phase detection (what's in the response so far)
			if (seenTaskIds.size >= numTasks || content.includes('"metadata":')) {
				contentPhase = 'finalizing';
			} else if (seenTaskIds.size > 0) {
				contentPhase = 'generating_tasks';
			} else {
				contentPhase = 'analyzing';
			}

			// For display purposes, we want to always show "Defining task X" for each task including the last one
			// Only show "Finalizing" after we've actually shown all tasks to the user
			const lastDisplayedTaskId = displayPRDParsingProgress.lastTaskId || 0;

			if (contentPhase === 'finalizing' && lastDisplayedTaskId >= numTasks) {
				// Only show finalizing after we've displayed all tasks
				currentPhase = 'finalizing';
			} else if (seenTaskIds.size > 0) {
				// Always show generating_tasks if we have detected any tasks
				currentPhase = 'generating_tasks';
			} else {
				// Show analyzing during initial phase
				currentPhase = 'analyzing';
			}

			// Use phase-based progress calculation with improved distribution
			switch (currentPhase) {
				case 'analyzing':
					// Combined analysis phase: 0-25%
					// Smoother ramp-up based on token count for the entire analysis phase
					const analysisProgress = Math.min(1, contextTokens / 1500);
					calculatedPercent = Math.floor(analysisProgress * 25);
					calculatedPercent = Math.max(1, Math.min(24, calculatedPercent)); // Keep between 1% and 24%
					log(
						'debug',
						`Progress [analyzing]: analysisProgress=${analysisProgress.toFixed(2)}, calculatedPercent=${calculatedPercent}%`
					);
					break;

				case 'generating_tasks': {
					// Main task generation phase: 25-90%
					// Distribute more evenly among tasks with weighted progression

					// Reserve 65% of the progress bar for tasks (from 25% to 90%)
					const TASK_PROGRESS_RANGE = 65;

					// Improved approach to calculate task-based progress:
					// 1. Base progress on complete tasks (seenTaskIds.size)
					// 2. Add partial progress for the task currently being generated
					// 3. Weight earlier tasks slightly higher than later tasks

					// Calculate base percentage from complete tasks
					let baseTaskProgress = 0;
					let weightDebugInfo = '';

					if (seenTaskIds.size === 0) {
						// No tasks detected yet
						baseTaskProgress = 0;
						weightDebugInfo = 'no tasks yet';
					} else if (numTasks === 1) {
						// Special case: only one task
						baseTaskProgress = seenTaskIds.size * TASK_PROGRESS_RANGE;
						weightDebugInfo = 'single task case';
					} else {
						// Use a weighted distribution that gives slightly more progress to early tasks
						// and slightly less to later tasks to avoid large initial jumps
						const taskWeights = [];
						let totalWeight = 0;

						// Create a sliding scale of weights with first task getting ~50% less weight
						for (let i = 0; i < numTasks; i++) {
							// Calculate weight: 0.5 for first task, gradually increasing to 1.0 for last task
							const weight = 0.5 + (0.5 * i) / (numTasks - 1);
							taskWeights.push(weight);
							totalWeight += weight;
						}

						// Calculate progress based on completed tasks and their weights
						let weightedProgress = 0;
						for (let i = 0; i < seenTaskIds.size; i++) {
							weightedProgress += taskWeights[i];
						}

						// Scale to our progress range
						baseTaskProgress =
							(weightedProgress / totalWeight) * TASK_PROGRESS_RANGE;
						weightDebugInfo = `weights=[${taskWeights.map((w) => w.toFixed(2)).join(', ')}], weighted=${weightedProgress.toFixed(2)}/${totalWeight.toFixed(2)}`;
					}

					// Add the base percentage to the starting point for this phase (25%)
					calculatedPercent = 25 + Math.floor(baseTaskProgress);

					// Add small micro-progress for partial progress on the current task
					let microProgressAddition = 0;
					if (seenTaskIds.size < numTasks) {
						// Estimate progress on current task based on content
						const estimatedCurrentTaskProgress = content.includes(
							`"id": ${seenTaskIds.size + 1}`
						)
							? 0.3
							: 0;

						// Calculate the weight for the current in-progress task
						const currentTaskWeight =
							numTasks > 1
								? 0.5 + (0.5 * seenTaskIds.size) / (numTasks - 1)
								: 1;

						// Calculate the value of a single task in our progress range
						const singleTaskValue = TASK_PROGRESS_RANGE / numTasks;

						// Add partial progress for the current task being generated
						microProgressAddition = Math.floor(
							estimatedCurrentTaskProgress * singleTaskValue * currentTaskWeight
						);
						calculatedPercent += microProgressAddition;
					}

					log(
						'debug',
						`Progress [generating_tasks]: tasks=${seenTaskIds.size}/${numTasks}, baseProgress=${baseTaskProgress.toFixed(2)}%, microAdd=${microProgressAddition}%, calculatedPercent=${calculatedPercent}%, ${weightDebugInfo}`
					);

					break;
				}

				case 'finalizing':
					// Finalizing and metadata: 90-99%
					let finalizingBase, finalizingRange;
					if (content.includes('"generatedAt"')) {
						finalizingBase = 95;
						finalizingRange = Math.min(
							4,
							Math.floor((contextTokens / estimatedTotalTokens) * 5)
						);
						calculatedPercent = finalizingBase + finalizingRange;
					} else {
						finalizingBase = 90;
						finalizingRange = Math.min(
							5,
							Math.floor((contextTokens / estimatedTotalTokens) * 10)
						);
						calculatedPercent = finalizingBase + finalizingRange;
					}
					log(
						'debug',
						`Progress [finalizing]: base=${finalizingBase}%, range=${finalizingRange}%, calculatedPercent=${calculatedPercent}%`
					);
					break;

				default:
					// Fallback: linear progress based on tokens
					calculatedPercent = Math.min(
						99,
						Math.floor((contextTokens / estimatedTotalTokens) * 100)
					);
					log(
						'debug',
						`Progress [default]: tokens=${contextTokens}/${estimatedTotalTokens}, calculatedPercent=${calculatedPercent}%`
					);
			}

			// Ensure progress doesn't jump backwards
			const originalPercent = calculatedPercent;
			if (calculatedPercent < percentComplete) {
				calculatedPercent = percentComplete;
				log(
					'debug',
					`Progress smoothing: prevented backwards jump ${originalPercent}% → ${calculatedPercent}%`
				);
			}

			// Limit maximum progress jump to prevent large jumps
			const maxJump = 3; // Reduced from 5% to 3% for smoother progression
			if (calculatedPercent > percentComplete + maxJump) {
				const beforeSmoothing = calculatedPercent;
				calculatedPercent = percentComplete + maxJump;
				log(
					'debug',
					`Progress smoothing: limited jump ${beforeSmoothing}% → ${calculatedPercent}% (max jump: ${maxJump}%)`
				);
			}

			// When real progress is made, reset microProgress and update percentComplete
			if (calculatedPercent > percentComplete) {
				const prevPercent = percentComplete;
				percentComplete = Math.min(99, calculatedPercent);
				streamingTracker.microProgress = 0; // Reset micro-progress when real progress is made
				streamingTracker.lastMicroUpdateTime = Date.now(); // Reset timer
				log('debug', `Progress update: ${prevPercent}% → ${percentComplete}%`);
			}

			// Calculate micro-progress for smoother updates between "real" progress points
			const now = Date.now();
			const elapsedSinceLastMicroUpdate =
				now - streamingTracker.lastMicroUpdateTime;

			// Only update micro-progress on a timer to avoid too many UI updates
			if (elapsedSinceLastMicroUpdate >= streamingTracker.microUpdateInterval) {
				// Calculate the micro-progress increment based on phase, elapsed time and tokens
				const elapsedSeconds = elapsedSinceLastMicroUpdate / 1000;

				// Base time factor - small increment based on elapsed time
				const timeFactor = Math.min(0.2, elapsedSeconds * 0.05);

				// Token factor - additional increment if we received new tokens
				let tokenFactor = 0;
				if (chunkInfo.delta && chunkInfo.delta.text) {
					const tokenDelta = Math.ceil(chunkInfo.delta.text.length / 4);
					tokenFactor = Math.min(0.3, tokenDelta * 0.002);
				}

				// Combine factors and apply a phase-specific cap
				const maxMicroForPhase =
					streamingTracker.maxMicroProgressPerPhase[currentPhase] || 0.5;
				const combinedIncrement = Math.min(timeFactor + tokenFactor, 0.5);
				streamingTracker.microProgress = Math.min(
					streamingTracker.microProgress + combinedIncrement,
					maxMicroForPhase
				);

				streamingTracker.lastMicroUpdateTime = now;

				log(
					'debug',
					`Micro-progress update: phase=${currentPhase}, time=${timeFactor.toFixed(2)}, token=${tokenFactor.toFixed(2)}, total=${streamingTracker.microProgress.toFixed(2)}`
				);
			}

			// Calculate display percentage by adding micro-progress to percentComplete
			// Note: This only affects the display, not the internal progress tracking
			const displayPercent = Math.min(
				98,
				percentComplete + streamingTracker.microProgress
			);

			// Calculate the expected next task number - what we're defining now
			const nextTaskNumber = seenTaskIds.size + 1;

			// Generate appropriate status message based on simplified phases
			let thinkingMessage;

			switch (currentPhase) {
				case 'analyzing':
					thinkingMessage = 'Analyzing PRD...';
					break;
				case 'generating_tasks':
					// Sync the task message with UI display - use the last displayed task ID from UI
					// to ensure we're always showing the next task after what the user has seen
					const lastDisplayedTaskId = displayPRDParsingProgress.lastTaskId || 0;

					// Make sure we never show more tasks than we actually have
					const currentTaskNumber = Math.min(lastDisplayedTaskId + 1, numTasks);

					// Show task definition message
					thinkingMessage = `Defining task ${currentTaskNumber}...`;
					log(
						'debug',
						`Setting thinking message with currentTaskNumber=${currentTaskNumber}, lastDisplayedTaskId=${lastDisplayedTaskId}, seenTaskIds.size=${seenTaskIds.size}`
					);
					break;
				case 'finalizing':
					thinkingMessage = 'Finalizing...';
					log(
						'debug',
						`Showing finalizing message after processing ${seenTaskIds.size}/${numTasks} tasks`
					);
					break;
				default:
					thinkingMessage = 'Processing...';
			}

			// Emit thinking state update
			log(
				'debug',
				`Emitting thinking state: ${thinkingMessage} (${currentPhase})`
			);
			progress.emitThinking({
				message: thinkingMessage,
				// Show 'finishing' state for the finalizing phase
				state: currentPhase === 'finalizing' ? 'finishing' : 'processing'
			});

			// Emit progress update
			log(
				'debug',
				`Emitting progress update: ${seenTaskIds.size}/${numTasks} tasks, phase=${currentPhase}, nextTaskNumber=${nextTaskNumber}`
			);
			progress.emitProgress({
				percentComplete: displayPercent, // Use the display percentage with micro-progress
				tokenCount: contextTokens,
				estimatedTotalTokens,
				promptTokens: chunkInfo.promptTokens || 0,
				completionTokens: chunkInfo.completionTokens || 0,
				tasksGenerated: seenTaskIds.size,
				totalTasks: numTasks,
				elapsed: (Date.now() - startTime) / 1000,
				nearCompletion: currentPhase === 'finalizing',
				microProgress: true // Flag to indicate this is a micro-update
			});
		};

		let responseData;
		try {
			// Call Claude to parse the PRD and generate tasks
			const stream = await anthropic.messages.stream({
				model: CONFIG.model,
				max_tokens: CONFIG.maxTokens,
				temperature: CONFIG.temperature,
				system: systemPrompt,
				messages: [
					{
						role: 'user',
						content: prdContent
					}
				]
			});

			// Process the streaming response
			for await (const chunk of stream) {
				if (chunk.type === 'content_block_delta' && chunk.delta.text) {
					buffer += chunk.delta.text;

					// Look for token usage information in the chunk
					let chunkMetadata = {
						isSlowChunk: false,
						timeSinceLastChunk: 0,
						delta: { text: chunk.delta.text }
					};

					// Check if the chunk contains any token usage information
					if (chunk.usage) {
						// Extract token usage if available
						if (chunk.usage.input_tokens) {
							chunkMetadata.promptTokens = chunk.usage.input_tokens;
							log(
								'debug',
								`Found input_tokens in chunk.usage: ${chunk.usage.input_tokens}`
							);
						}
						if (chunk.usage.output_tokens) {
							chunkMetadata.completionTokens = chunk.usage.output_tokens;
							log(
								'debug',
								`Found output_tokens in chunk.usage: ${chunk.usage.output_tokens}`
							);
							chunkMetadata.totalTokens =
								(chunkMetadata.promptTokens || 0) + chunk.usage.output_tokens;
						}
					}

					// Check if the chunk contains any metadata about the streaming state
					if (
						chunk.type === 'message_delta' &&
						chunk.delta &&
						chunk.delta.usage
					) {
						// Extract token usage if available at the message level
						if (chunk.delta.usage.input_tokens) {
							chunkMetadata.promptTokens = chunk.delta.usage.input_tokens;
							log(
								'debug',
								`Found input_tokens in message_delta: ${chunk.delta.usage.input_tokens}`
							);
						}
						if (chunk.delta.usage.output_tokens) {
							chunkMetadata.completionTokens = chunk.delta.usage.output_tokens;
							log(
								'debug',
								`Found output_tokens in message_delta: ${chunk.delta.usage.output_tokens}`
							);
							chunkMetadata.totalTokens =
								(chunkMetadata.promptTokens || 0) +
								chunk.delta.usage.output_tokens;
						}
					}

					// Estimate the current phase based on output analysis
					if (buffer.includes('"tasks":') && !buffer.includes('"id":')) {
						chunkMetadata.phase = 'starting';
					} else if (
						buffer.includes('"id":') &&
						!buffer.match(/"title":\s*"[^"]+"/)
					) {
						// We have id but no complete title yet - creating tasks phase
						chunkMetadata.phase = 'creating_tasks';
					} else if (
						buffer.includes('"id":') &&
						!buffer.includes('"metadata":')
					) {
						// Combined phase for all task generation until metadata
						chunkMetadata.phase = 'generating_tasks';
					} else if (buffer.includes('"metadata":')) {
						chunkMetadata.phase = 'finalizing';
					} else {
						chunkMetadata.phase = 'analyzing';
					}

					// Update tracking with better metadata
					streamingTracker(buffer, chunkMetadata);
				} else if (chunk.type === 'message_stop') {
					// This event comes at the end of the streaming response
					log('debug', `Received message_stop event: ${JSON.stringify(chunk)}`);

					// Check if we have final token usage statistics
					if (chunk.message && chunk.message.usage) {
						const finalMetadata = {
							phase: 'finalizing',
							isComplete: true
						};

						// Extract token usage from the message usage
						if (chunk.message.usage.input_tokens) {
							finalMetadata.promptTokens = chunk.message.usage.input_tokens;
							promptTokens = chunk.message.usage.input_tokens;
							log(
								'debug',
								`Final input_tokens from message_stop: ${promptTokens}`
							);
						}

						if (chunk.message.usage.output_tokens) {
							finalMetadata.completionTokens =
								chunk.message.usage.output_tokens;
							completionTokens = chunk.message.usage.output_tokens;
							log(
								'debug',
								`Final output_tokens from message_stop: ${completionTokens}`
							);
						}

						// Update context tokens based on final usage
						contextTokens = promptTokens + completionTokens;
						finalMetadata.totalTokens = contextTokens;

						// Send a final progress update with the accurate token counts
						streamingTracker(buffer, finalMetadata);
					}
				}
			}

			// Process the final response
			try {
				// Use a regular expression to find the JSON object in the response
				const jsonMatch = buffer.match(/\{[\s\S]*\}/);
				if (!jsonMatch) {
					throw new Error(
						'Could not find valid JSON in the response from Claude. The response format was unexpected.'
					);
				}

				const jsonText = jsonMatch[0];
				responseData = JSON.parse(jsonText);

				if (
					!responseData ||
					!responseData.tasks ||
					!Array.isArray(responseData.tasks)
				) {
					throw new Error(
						'The parsed JSON does not contain a valid tasks array. Claude may have returned an unexpected response format.'
					);
				}
			} catch (parseError) {
				// Log the error and attempt to recover by looking for task objects
				log('error', `Error parsing JSON response: ${parseError.message}`);
				log(
					'debug',
					`Attempting to recover by parsing individual tasks from the response...`
				);

				// Attempt to recover the tasks from the response using regex
				const taskObjects = [];
				const taskRegex = /\{\s*"id"\s*:\s*(\d+)[\s\S]*?(?="id"|$)/g;
				let match;

				while ((match = taskRegex.exec(buffer)) !== null) {
					try {
						// Extract and clean up the task object
						let taskText = match[0];
						// Ensure it ends with a closing brace
						if (!taskText.trim().endsWith('}')) {
							taskText += '}';
						}

						// Try to parse the task JSON
						const task = JSON.parse(taskText);
						if (task && task.id && task.title) {
							taskObjects.push(task);
						}
					} catch (taskParseError) {
						log(
							'debug',
							`Failed to parse individual task: ${taskParseError.message}`
						);
						// Continue to the next match
					}
				}

				if (taskObjects.length > 0) {
					log(
						'info',
						`Successfully recovered ${taskObjects.length} tasks from the response`
					);
					responseData = {
						tasks: taskObjects,
						metadata: {
							projectName: CONFIG.projectName || 'PRD Implementation',
							totalTasks: taskObjects.length,
							sourceFile: prdPath,
							generatedAt: new Date().toISOString().split('T')[0],
							recoveryMode: true
						}
					};
				} else {
					throw new Error(
						'Failed to recover any valid tasks from the Claude response. The generation may have failed completely.'
					);
				}
			}

			// Update final UI state to show task detection is complete
			percentComplete = 100;
			microProgress = 0; // Reset microProgress on completion

			displayPRDParsingProgress({
				percentComplete,
				elapsed: (Date.now() - startTime) / 1000,
				contextTokens,
				estimatedTotalTokens,
				promptTokens,
				completionTokens,
				tasksGenerated: responseData.tasks.length,
				totalTasks: responseData.tasks.length,
				completed: true
			});
		} catch (apiError) {
			// Handle Anthropic API errors specifically
			if (apiError.status) {
				// This is likely an API error with HTTP status
				let errorMessage = `Anthropic API error (${apiError.status}): ${apiError.message}`;

				// Provide more specific guidance based on error code
				if (apiError.status === 401) {
					errorMessage +=
						'\nPossible causes: Invalid API key, expired token, or authentication issue.';
				} else if (apiError.status === 400) {
					errorMessage +=
						'\nPossible causes: Malformed request, invalid model name, or input too long.';
				} else if (apiError.status === 429) {
					errorMessage +=
						'\nPossible causes: Rate limit exceeded or quota reached. Try again later.';
				} else if (apiError.status >= 500) {
					errorMessage +=
						"\nThis appears to be a server error on Anthropic's side. Try again later.";
				}

				throw new Error(errorMessage);
			} else {
				// Handle network errors, timeouts, etc.
				throw new Error(
					`Error calling Anthropic API: ${apiError.message}. This might be due to a network issue or service interruption.`
				);
			}
		}

		// Validate the tasks data
		if (
			!responseData.tasks ||
			!Array.isArray(responseData.tasks) ||
			responseData.tasks.length === 0
		) {
			throw new Error(
				'No tasks were generated. The AI response may not have contained valid task data.'
			);
		}

		const tasksData = responseData;

		// Create tasks directory if it doesn't exist
		const tasksDir = path.dirname(tasksPath);
		if (!fs.existsSync(tasksDir)) {
			fs.mkdirSync(tasksDir, { recursive: true });
		}

		// If append option is set and the tasks file exists, merge with existing tasks
		if (options && options.append && fs.existsSync(tasksPath)) {
			const existingData = readJSON(tasksPath);
			if (
				existingData &&
				existingData.tasks &&
				Array.isArray(existingData.tasks)
			) {
				log(
					'info',
					`Appending ${tasksData.tasks.length} new tasks to existing ${existingData.tasks.length} tasks`
				);

				// Find max ID in existing tasks to determine starting ID for new tasks
				const maxExistingId = existingData.tasks.reduce(
					(max, task) => Math.max(max, task.id || 0),
					0
				);

				// Update IDs of new tasks to continue from the max existing ID
				tasksData.tasks.forEach((task, index) => {
					task.id = maxExistingId + index + 1;
				});

				// Merge tasks arrays
				existingData.tasks = existingData.tasks.concat(tasksData.tasks);

				// Write merged tasks back to file
				writeJSON(tasksPath, existingData);
			} else {
				// File exists but doesn't contain valid tasks - overwrite with new tasks
				log(
					'warn',
					'Existing tasks file does not contain valid tasks. Overwriting with new tasks.'
				);
				writeJSON(tasksPath, tasksData);
			}
		} else {
			// Write the tasks to the file (overwrite or create new)
			writeJSON(tasksPath, tasksData);
		}

		// Generate task files and get task files info
		const taskFilesGenerated = generateTaskFiles(tasksPath, tasksDir);

		// Calculate task category breakdown
		const taskCategories = {
			high: 0,
			medium: 0,
			low: 0
		};

		tasksData.tasks.forEach((task) => {
			const priority = (task.priority || 'medium').toLowerCase();
			if (taskCategories[priority] !== undefined) {
				taskCategories[priority]++;
			}
		});

		// Display summary with statistics
		displayPRDParsingSummary({
			totalTasks: tasksData.tasks.length,
			prdFilePath: prdPath,
			outputPath: tasksPath,
			elapsedTime: elapsedSeconds,
			taskCategories,
			recoveryMode: responseData.metadata?.recoveryMode || false,
			taskFilesGenerated: taskFilesGenerated
		});

		// Clean up all resources
		cleanupResources();

		return tasksPath;
	} catch (error) {
		log('error', `Error parsing PRD: ${error.message}`);

		// Clean up all resources
		cleanupResources();

		// Log error for debugging
		console.error(chalk.red(`Error: ${error.message}`));

		if (CONFIG.debug) {
			console.error(error);
		}

		// Show a user-friendly error message in a box
		console.log(
			boxen(
				chalk.red.bold('PRD Parsing Failed') +
					'\n\n' +
					chalk.white(`${error.message}`) +
					'\n\n' +
					chalk.white('Suggestions:') +
					'\n' +
					chalk.white('• Check your internet connection') +
					'\n' +
					chalk.white(
						'• Verify your API key is valid and has sufficient quota'
					) +
					'\n' +
					chalk.white(
						'• Try with a smaller PRD or reduce the number of tasks'
					) +
					'\n' +
					chalk.white('• Run with DEBUG=true for more details'),
				{
					padding: 1,
					borderColor: 'red',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);

		// Throw the error instead of exiting to allow caller to handle it
		throw error;
	}
}

/**
 * Update tasks based on new context
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} fromId - Task ID to start updating from
 * @param {string} prompt - Prompt with new context
 * @param {boolean} useResearch - Whether to use Perplexity AI for research
 */
async function updateTasks(tasksPath, fromId, prompt, useResearch = false) {
	try {
		log('info', `Updating tasks from ID ${fromId} with prompt: "${prompt}"`);

		// Validate research flag
		if (useResearch && (!perplexity || !process.env.PERPLEXITY_API_KEY)) {
			log('warn', 'Perplexity AI is not available. Falling back to Claude AI.');
			console.log(
				chalk.yellow(
					'Perplexity AI is not available (API key may be missing). Falling back to Claude AI.'
				)
			);
			useResearch = false;
		}

		// Read the tasks file
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Find tasks to update (ID >= fromId and not 'done')
		const tasksToUpdate = data.tasks.filter(
			(task) => task.id >= fromId && task.status !== 'done'
		);
		if (tasksToUpdate.length === 0) {
			log(
				'info',
				`No tasks to update (all tasks with ID >= ${fromId} are already marked as done)`
			);
			console.log(
				chalk.yellow(
					`No tasks to update (all tasks with ID >= ${fromId} are already marked as done)`
				)
			);
			return;
		}

		// Show the tasks that will be updated
		const table = new Table({
			head: [
				chalk.cyan.bold('ID'),
				chalk.cyan.bold('Title'),
				chalk.cyan.bold('Status')
			],
			colWidths: [5, 60, 10]
		});

		tasksToUpdate.forEach((task) => {
			table.push([
				task.id,
				truncate(task.title, 57),
				getStatusWithColor(task.status)
			]);
		});

		console.log(
			boxen(chalk.white.bold(`Updating ${tasksToUpdate.length} tasks`), {
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round',
				margin: { top: 1, bottom: 0 }
			})
		);

		console.log(table.toString());

		// Display a message about how completed subtasks are handled
		console.log(
			boxen(
				chalk.cyan.bold('How Completed Subtasks Are Handled:') +
					'\n\n' +
					chalk.white(
						'• Subtasks marked as "done" or "completed" will be preserved\n'
					) +
					chalk.white(
						'• New subtasks will build upon what has already been completed\n'
					) +
					chalk.white(
						'• If completed work needs revision, a new subtask will be created instead of modifying done items\n'
					) +
					chalk.white(
						'• This approach maintains a clear record of completed work and new requirements'
					),
				{
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round',
					margin: { top: 1, bottom: 1 }
				}
			)
		);

		// Build the system prompt
		const systemPrompt = `You are an AI assistant helping to update software development tasks based on new context.
You will be given a set of tasks and a prompt describing changes or new implementation details.
Your job is to update the tasks to reflect these changes, while preserving their basic structure.

Guidelines:
1. Maintain the same IDs, statuses, and dependencies unless specifically mentioned in the prompt
2. Update titles, descriptions, details, and test strategies to reflect the new information
3. Do not change anything unnecessarily - just adapt what needs to change based on the prompt
4. You should return ALL the tasks in order, not just the modified ones
5. Return a complete valid JSON object with the updated tasks array
6. VERY IMPORTANT: Preserve all subtasks marked as "done" or "completed" - do not modify their content
7. For tasks with completed subtasks, build upon what has already been done rather than rewriting everything
8. If an existing completed subtask needs to be changed/undone based on the new context, DO NOT modify it directly
9. Instead, add a new subtask that clearly indicates what needs to be changed or replaced
10. Use the existence of completed subtasks as an opportunity to make new subtasks more specific and targeted

The changes described in the prompt should be applied to ALL tasks in the list.`;

		const taskData = JSON.stringify(tasksToUpdate, null, 2);

		let updatedTasks;
		const loadingIndicator = startLoadingIndicator(
			useResearch
				? 'Updating tasks with Perplexity AI research...'
				: 'Updating tasks with Claude AI...'
		);

		try {
			if (useResearch) {
				log('info', 'Using Perplexity AI for research-backed task updates');

				// Call Perplexity AI using format consistent with ai-services.js
				const perplexityModel = process.env.PERPLEXITY_MODEL || 'sonar-pro';
				const result = await perplexity.chat.completions.create({
					model: perplexityModel,
					messages: [
						{
							role: 'system',
							content: `${systemPrompt}\n\nAdditionally, please research the latest best practices, implementation details, and considerations when updating these tasks. Use your online search capabilities to gather relevant information. Remember to strictly follow the guidelines about preserving completed subtasks and building upon what has already been done rather than modifying or replacing it.`
						},
						{
							role: 'user',
							content: `Here are the tasks to update:
${taskData}

Please update these tasks based on the following new context:
${prompt}

IMPORTANT: In the tasks JSON above, any subtasks with "status": "done" or "status": "completed" should be preserved exactly as is. Build your changes around these completed items.

Return only the updated tasks as a valid JSON array.`
						}
					],
					temperature: parseFloat(
						process.env.TEMPERATURE || CONFIG.temperature
					),
					max_tokens: parseInt(process.env.MAX_TOKENS || CONFIG.maxTokens)
				});

				const responseText = result.choices[0].message.content;

				// Extract JSON from response
				const jsonStart = responseText.indexOf('[');
				const jsonEnd = responseText.lastIndexOf(']');

				if (jsonStart === -1 || jsonEnd === -1) {
					throw new Error(
						"Could not find valid JSON array in Perplexity's response"
					);
				}

				const jsonText = responseText.substring(jsonStart, jsonEnd + 1);
				updatedTasks = JSON.parse(jsonText);
			} else {
				// Call Claude to update the tasks with streaming enabled
				let responseText = '';
				let streamingInterval = null;

				try {
					// Update loading indicator to show streaming progress
					let dotCount = 0;
					const readline = await import('readline');
					streamingInterval = setInterval(() => {
						readline.cursorTo(process.stdout, 0);
						process.stdout.write(
							`Receiving streaming response from Claude${'.'.repeat(dotCount)}`
						);
						dotCount = (dotCount + 1) % 4;
					}, 500);

					// Use streaming API call
					const stream = await anthropic.messages.create({
						model: CONFIG.model,
						max_tokens: CONFIG.maxTokens,
						temperature: CONFIG.temperature,
						system: systemPrompt,
						messages: [
							{
								role: 'user',
								content: `Here are the tasks to update:
${taskData}

Please update these tasks based on the following new context:
${prompt}

IMPORTANT: In the tasks JSON above, any subtasks with "status": "done" or "status": "completed" should be preserved exactly as is. Build your changes around these completed items.

Return only the updated tasks as a valid JSON array.`
							}
						],
						stream: true
					});

					// Process the stream
					let responseText = ''; // Define responseText variable
					try {
						let chunkCount = 0;
						let isProcessing = true;
						// Add a local check that gets set to false if SIGINT is received
						const originalSigintHandler = sigintHandler;

						// Enhance the SIGINT handler to set isProcessing to false
						sigintHandler = () => {
							isProcessing = false;

							// Call original handler to do the rest of cleanup and exit
							if (originalSigintHandler) originalSigintHandler();
						};

						for await (const chunk of stream) {
							// Check if we should stop processing (SIGINT received)
							if (!isProcessing) {
								break;
							}

							if (chunk.type === 'content_block_delta' && chunk.delta.text) {
								responseText += chunk.delta.text;
								chunkCount++;
							}
						}

						// Restore original handler if we didn't get interrupted
						if (isProcessing) {
							sigintHandler = originalSigintHandler;
						}
					} catch (streamError) {
						// Clean up the interval even if there's an error
						if (streamingInterval) {
							clearInterval(streamingInterval);
							streamingInterval = null;
						}

						throw streamError;
					}

					if (streamingInterval) clearInterval(streamingInterval);
					log('info', 'Completed streaming response from Claude API!');

					// Extract JSON from response
					const jsonStart = responseText.indexOf('[');
					const jsonEnd = responseText.lastIndexOf(']');

					if (jsonStart === -1 || jsonEnd === -1) {
						throw new Error(
							"Could not find valid JSON array in Claude's response"
						);
					}

					const jsonText = responseText.substring(jsonStart, jsonEnd + 1);
					updatedTasks = JSON.parse(jsonText);
				} catch (error) {
					if (streamingInterval) clearInterval(streamingInterval);
					throw error;
				}
			}

			// Replace the tasks in the original data
			updatedTasks.forEach((updatedTask) => {
				const index = data.tasks.findIndex((t) => t.id === updatedTask.id);
				if (index !== -1) {
					data.tasks[index] = updatedTask;
				}
			});

			// Write the updated tasks to the file
			writeJSON(tasksPath, data);

			log('success', `Successfully updated ${updatedTasks.length} tasks`);

			// Generate individual task files
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));

			console.log(
				boxen(
					chalk.green(`Successfully updated ${updatedTasks.length} tasks`),
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);
		} finally {
			stopLoadingIndicator(loadingIndicator);
		}
	} catch (error) {
		log('error', `Error updating tasks: ${error.message}`);
		console.error(chalk.red(`Error: ${error.message}`));

		if (CONFIG.debug) {
			console.error(error);
		}

		process.exit(1);
	}
}

/**
 * Update a single task by ID
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} taskId - Task ID to update
 * @param {string} prompt - Prompt with new context
 * @param {boolean} useResearch - Whether to use Perplexity AI for research
 * @returns {Object} - Updated task data or null if task wasn't updated
 */
async function updateTaskById(tasksPath, taskId, prompt, useResearch = false) {
	try {
		log('info', `Updating single task ${taskId} with prompt: "${prompt}"`);

		// Validate task ID is a positive integer
		if (!Number.isInteger(taskId) || taskId <= 0) {
			throw new Error(
				`Invalid task ID: ${taskId}. Task ID must be a positive integer.`
			);
		}

		// Validate prompt
		if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
			throw new Error(
				'Prompt cannot be empty. Please provide context for the task update.'
			);
		}

		// Validate research flag
		if (useResearch && (!perplexity || !process.env.PERPLEXITY_API_KEY)) {
			log('warn', 'Perplexity AI is not available. Falling back to Claude AI.');
			console.log(
				chalk.yellow(
					'Perplexity AI is not available (API key may be missing). Falling back to Claude AI.'
				)
			);
			useResearch = false;
		}

		// Validate tasks file exists
		if (!fs.existsSync(tasksPath)) {
			throw new Error(`Tasks file not found at path: ${tasksPath}`);
		}

		// Read the tasks file
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(
				`No valid tasks found in ${tasksPath}. The file may be corrupted or have an invalid format.`
			);
		}

		// Find the specific task to update
		const taskToUpdate = data.tasks.find((task) => task.id === taskId);
		if (!taskToUpdate) {
			throw new Error(
				`Task with ID ${taskId} not found. Please verify the task ID and try again.`
			);
		}

		// Check if task is already completed
		if (taskToUpdate.status === 'done' || taskToUpdate.status === 'completed') {
			log(
				'warn',
				`Task ${taskId} is already marked as done and cannot be updated`
			);
			console.log(
				boxen(
					chalk.yellow(
						`Task ${taskId} is already marked as ${taskToUpdate.status} and cannot be updated.`
					) +
						'\n\n' +
						chalk.white(
							'Completed tasks are locked to maintain consistency. To modify a completed task, you must first:'
						) +
						'\n' +
						chalk.white('1. Change its status to "pending" or "in-progress"') +
						'\n' +
						chalk.white('2. Then run the update-task command'),
					{ padding: 1, borderColor: 'yellow', borderStyle: 'round' }
				)
			);
			return null;
		}

		// Show the task that will be updated
		const table = new Table({
			head: [
				chalk.cyan.bold('ID'),
				chalk.cyan.bold('Title'),
				chalk.cyan.bold('Status')
			],
			colWidths: [5, 60, 10]
		});

		table.push([
			taskToUpdate.id,
			truncate(taskToUpdate.title, 57),
			getStatusWithColor(taskToUpdate.status)
		]);

		console.log(
			boxen(chalk.white.bold(`Updating Task #${taskId}`), {
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round',
				margin: { top: 1, bottom: 0 }
			})
		);

		console.log(table.toString());

		// Display a message about how completed subtasks are handled
		console.log(
			boxen(
				chalk.cyan.bold('How Completed Subtasks Are Handled:') +
					'\n\n' +
					chalk.white(
						'• Subtasks marked as "done" or "completed" will be preserved\n'
					) +
					chalk.white(
						'• New subtasks will build upon what has already been completed\n'
					) +
					chalk.white(
						'• If completed work needs revision, a new subtask will be created instead of modifying done items\n'
					) +
					chalk.white(
						'• This approach maintains a clear record of completed work and new requirements'
					),
				{
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round',
					margin: { top: 1, bottom: 1 }
				}
			)
		);

		// Build the system prompt
		const systemPrompt = `You are an AI assistant helping to update a software development task based on new context.
You will be given a task and a prompt describing changes or new implementation details.
Your job is to update the task to reflect these changes, while preserving its basic structure.

Guidelines:
1. VERY IMPORTANT: NEVER change the title of the task - keep it exactly as is
2. Maintain the same ID, status, and dependencies unless specifically mentioned in the prompt
3. Update the description, details, and test strategy to reflect the new information
4. Do not change anything unnecessarily - just adapt what needs to change based on the prompt
5. Return a complete valid JSON object representing the updated task
6. VERY IMPORTANT: Preserve all subtasks marked as "done" or "completed" - do not modify their content
7. For tasks with completed subtasks, build upon what has already been done rather than rewriting everything
8. If an existing completed subtask needs to be changed/undone based on the new context, DO NOT modify it directly
9. Instead, add a new subtask that clearly indicates what needs to be changed or replaced
10. Use the existence of completed subtasks as an opportunity to make new subtasks more specific and targeted
11. Ensure any new subtasks have unique IDs that don't conflict with existing ones

The changes described in the prompt should be thoughtfully applied to make the task more accurate and actionable.`;

		const taskData = JSON.stringify(taskToUpdate, null, 2);

		let updatedTask;
		const loadingIndicator = startLoadingIndicator(
			useResearch
				? 'Updating task with Perplexity AI research...'
				: 'Updating task with Claude AI...'
		);

		try {
			if (useResearch) {
				log('info', 'Using Perplexity AI for research-backed task update');

				// Verify Perplexity API key exists
				if (!process.env.PERPLEXITY_API_KEY) {
					throw new Error(
						'PERPLEXITY_API_KEY environment variable is missing but --research flag was used.'
					);
				}

				try {
					// Call Perplexity AI
					const perplexityModel = process.env.PERPLEXITY_MODEL || 'sonar-pro';
					const result = await perplexity.chat.completions.create({
						model: perplexityModel,
						messages: [
							{
								role: 'system',
								content: `${systemPrompt}\n\nAdditionally, please research the latest best practices, implementation details, and considerations when updating this task. Use your online search capabilities to gather relevant information. Remember to strictly follow the guidelines about preserving completed subtasks and building upon what has already been done rather than modifying or replacing it.`
							},
							{
								role: 'user',
								content: `Here is the task to update:
${taskData}

Please update this task based on the following new context:
${prompt}

IMPORTANT: In the task JSON above, any subtasks with "status": "done" or "status": "completed" should be preserved exactly as is. Build your changes around these completed items.

Return only the updated task as a valid JSON object.`
							}
						],
						temperature: parseFloat(
							process.env.TEMPERATURE || CONFIG.temperature
						),
						max_tokens: parseInt(process.env.MAX_TOKENS || CONFIG.maxTokens)
					});

					const responseText = result.choices[0].message.content;

					// Extract JSON from response
					const jsonStart = responseText.indexOf('{');
					const jsonEnd = responseText.lastIndexOf('}');

					if (jsonStart === -1 || jsonEnd === -1) {
						throw new Error(
							"Could not find valid JSON object in Perplexity's response. The response may be malformed."
						);
					}

					const jsonText = responseText.substring(jsonStart, jsonEnd + 1);

					try {
						updatedTask = JSON.parse(jsonText);
					} catch (parseError) {
						throw new Error(
							`Failed to parse Perplexity response as JSON: ${parseError.message}\nResponse fragment: ${jsonText.substring(0, 100)}...`
						);
					}
				} catch (perplexityError) {
					throw new Error(`Perplexity API error: ${perplexityError.message}`);
				}
			} else {
				// Call Claude to update the task with streaming enabled
				let responseText = '';
				let streamingInterval = null;

				try {
					// Verify Anthropic API key exists
					if (!process.env.ANTHROPIC_API_KEY) {
						throw new Error(
							'ANTHROPIC_API_KEY environment variable is missing. Required for task updates.'
						);
					}

					// Update loading indicator to show streaming progress
					let dotCount = 0;
					const readline = await import('readline');
					streamingInterval = setInterval(() => {
						readline.cursorTo(process.stdout, 0);
						process.stdout.write(
							`Receiving streaming response from Claude${'.'.repeat(dotCount)}`
						);
						dotCount = (dotCount + 1) % 4;
					}, 500);

					// Use streaming API call
					const stream = await anthropic.messages.create({
						model: CONFIG.model,
						max_tokens: CONFIG.maxTokens,
						temperature: CONFIG.temperature,
						system: systemPrompt,
						messages: [
							{
								role: 'user',
								content: `Here is the task to update:
${taskData}

Please update this task based on the following new context:
${prompt}

IMPORTANT: In the task JSON above, any subtasks with "status": "done" or "status": "completed" should be preserved exactly as is. Build your changes around these completed items.

Return only the updated task as a valid JSON object.`
							}
						],
						stream: true
					});

					// Process the stream
					let streamProcessingComplete = false;
					try {
						for await (const chunk of stream) {
							if (isCancelled) {
								log('info', 'Claude streaming cancelled by user');
								streamProcessingComplete = true;
								break;
							}

							if (chunk.type === 'content_block_delta' && chunk.delta.text) {
								fullResponse += chunk.delta.text;
							}
						}
						streamProcessingComplete = true;
					} catch (streamError) {
						// Handle stream-specific errors
						log('error', `Stream processing error: ${streamError.message}`);
						throw streamError;
					} finally {
						// Clean up interval regardless of how we exit the stream processing
						if (streamingInterval) {
							clearInterval(streamingInterval);
							streamingInterval = null;
						}

						// Handle cancellation after stream processing
						if (isCancelled) {
							throw new Error('Operation cancelled by user');
						}

						// Only show completion if stream processing completed normally
						if (streamProcessingComplete) {
							progressData.percentComplete = 100;
							progressData.elapsed = (Date.now() - startTime) / 1000;
							progressData.tasksAnalyzed = progressData.totalTasks;
							progressData.completed = true;
							progressData.contextTokens = Math.max(
								progressData.contextTokens,
								estimatedContextTokens
							);
							displayAnalysisProgress(progressData);

							// Clear the line completely to remove any artifacts (after showing completion)
							process.stdout.write('\r\x1B[K'); // Clear current line
							process.stdout.write('\r'); // Move cursor to beginning of line
						}
					}

					if (streamingInterval) clearInterval(streamingInterval);
					log('info', 'Completed streaming response from Claude API!');

					// Extract JSON from response
					const jsonStart = responseText.indexOf('{');
					const jsonEnd = responseText.lastIndexOf('}');

					if (jsonStart === -1 || jsonEnd === -1) {
						throw new Error(
							"Could not find valid JSON object in Claude's response. The response may be malformed."
						);
					}

					const jsonText = responseText.substring(jsonStart, jsonEnd + 1);

					try {
						updatedTask = JSON.parse(jsonText);
					} catch (parseError) {
						throw new Error(
							`Failed to parse Claude response as JSON: ${parseError.message}\nResponse fragment: ${jsonText.substring(0, 100)}...`
						);
					}
				} catch (claudeError) {
					if (streamingInterval) clearInterval(streamingInterval);
					throw new Error(`Claude API error: ${claudeError.message}`);
				}
			}

			// Validation of the updated task
			if (!updatedTask || typeof updatedTask !== 'object') {
				throw new Error(
					'Received invalid task object from AI. The response did not contain a valid task.'
				);
			}

			// Ensure critical fields exist
			if (!updatedTask.title || !updatedTask.description) {
				throw new Error(
					'Updated task is missing required fields (title or description).'
				);
			}

			// Ensure ID is preserved
			if (updatedTask.id !== taskId) {
				log(
					'warn',
					`Task ID was modified in the AI response. Restoring original ID ${taskId}.`
				);
				updatedTask.id = taskId;
			}

			// Ensure status is preserved unless explicitly changed in prompt
			if (
				updatedTask.status !== taskToUpdate.status &&
				!prompt.toLowerCase().includes('status')
			) {
				log(
					'warn',
					`Task status was modified without explicit instruction. Restoring original status '${taskToUpdate.status}'.`
				);
				updatedTask.status = taskToUpdate.status;
			}

			// Ensure completed subtasks are preserved
			if (taskToUpdate.subtasks && taskToUpdate.subtasks.length > 0) {
				if (!updatedTask.subtasks) {
					log(
						'warn',
						'Subtasks were removed in the AI response. Restoring original subtasks.'
					);
					updatedTask.subtasks = taskToUpdate.subtasks;
				} else {
					// Check for each completed subtask
					const completedSubtasks = taskToUpdate.subtasks.filter(
						(st) => st.status === 'done' || st.status === 'completed'
					);

					for (const completedSubtask of completedSubtasks) {
						const updatedSubtask = updatedTask.subtasks.find(
							(st) => st.id === completedSubtask.id
						);

						// If completed subtask is missing or modified, restore it
						if (!updatedSubtask) {
							log(
								'warn',
								`Completed subtask ${completedSubtask.id} was removed. Restoring it.`
							);
							updatedTask.subtasks.push(completedSubtask);
						} else if (
							updatedSubtask.title !== completedSubtask.title ||
							updatedSubtask.description !== completedSubtask.description ||
							updatedSubtask.details !== completedSubtask.details ||
							updatedSubtask.status !== completedSubtask.status
						) {
							log(
								'warn',
								`Completed subtask ${completedSubtask.id} was modified. Restoring original.`
							);
							// Find and replace the modified subtask
							const index = updatedTask.subtasks.findIndex(
								(st) => st.id === completedSubtask.id
							);
							if (index !== -1) {
								updatedTask.subtasks[index] = completedSubtask;
							}
						}
					}

					// Ensure no duplicate subtask IDs
					const subtaskIds = new Set();
					const uniqueSubtasks = [];

					for (const subtask of updatedTask.subtasks) {
						if (!subtaskIds.has(subtask.id)) {
							subtaskIds.add(subtask.id);
							uniqueSubtasks.push(subtask);
						} else {
							log(
								'warn',
								`Duplicate subtask ID ${subtask.id} found. Removing duplicate.`
							);
						}
					}

					updatedTask.subtasks = uniqueSubtasks;
				}
			}

			// Update the task in the original data
			const index = data.tasks.findIndex((t) => t.id === taskId);
			if (index !== -1) {
				data.tasks[index] = updatedTask;
			} else {
				throw new Error(`Task with ID ${taskId} not found in tasks array.`);
			}

			// Write the updated tasks to the file
			writeJSON(tasksPath, data);

			log('success', `Successfully updated task ${taskId}`);

			// Generate individual task files
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));

			console.log(
				boxen(
					chalk.green(`Successfully updated task #${taskId}`) +
						'\n\n' +
						chalk.white.bold('Updated Title:') +
						' ' +
						updatedTask.title,
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);

			// Return the updated task for testing purposes
			return updatedTask;
		} finally {
			stopLoadingIndicator(loadingIndicator);
		}
	} catch (error) {
		log('error', `Error updating task: ${error.message}`);
		console.error(chalk.red(`Error: ${error.message}`));

		// Provide more helpful error messages for common issues
		if (error.message.includes('ANTHROPIC_API_KEY')) {
			console.log(
				chalk.yellow('\nTo fix this issue, set your Anthropic API key:')
			);
			console.log('  export ANTHROPIC_API_KEY=your_api_key_here');
		} else if (error.message.includes('PERPLEXITY_API_KEY')) {
			console.log(chalk.yellow('\nTo fix this issue:'));
			console.log(
				'  1. Set your Perplexity API key: export PERPLEXITY_API_KEY=your_api_key_here'
			);
			console.log(
				'  2. Or run without the research flag: task-master update-task --id=<id> --prompt="..."'
			);
		} else if (
			error.message.includes('Task with ID') &&
			error.message.includes('not found')
		) {
			console.log(chalk.yellow('\nTo fix this issue:'));
			console.log('  1. Run task-master list to see all available task IDs');
			console.log('  2. Use a valid task ID with the --id parameter');
		}

		if (CONFIG.debug) {
			console.error(error);
		}

		return null;
	}
}

/**
 * Generate individual task files from tasks.json
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} outputDir - Output directory for task files
 */
function generateTaskFiles(tasksPath, outputDir) {
	try {
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Create the output directory if it doesn't exist
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Validate and fix dependencies before generating files
		validateAndFixDependencies(data, tasksPath);

		// Get task IDs to determine range
		const taskIds = data.tasks.map((task) => task.id);
		const minId = Math.min(...taskIds);
		const maxId = Math.max(...taskIds);
		const firstId = minId.toString().padStart(3, '0');
		const lastId = maxId.toString().padStart(3, '0');

		data.tasks.forEach((task) => {
			const taskPath = path.join(
				outputDir,
				`task_${task.id.toString().padStart(3, '0')}.txt`
			);

			// Format the content
			let content = `# Task ID: ${task.id}\n`;
			content += `# Title: ${task.title}\n`;
			content += `# Status: ${task.status || 'pending'}\n`;

			// Format dependencies with their status
			if (task.dependencies && task.dependencies.length > 0) {
				content += `# Dependencies: ${formatDependenciesWithStatus(task.dependencies, data.tasks, false)}\n`;
			} else {
				content += '# Dependencies: None\n';
			}

			content += `# Priority: ${task.priority || 'medium'}\n`;
			content += `# Description: ${task.description || ''}\n`;

			// Add more detailed sections
			content += '# Details:\n';
			content += (task.details || '')
				.split('\n')
				.map((line) => line)
				.join('\n');
			content += '\n\n';

			content += '# Test Strategy:\n';
			content += (task.testStrategy || '')
				.split('\n')
				.map((line) => line)
				.join('\n');
			content += '\n';

			// Add subtasks if they exist
			if (task.subtasks && task.subtasks.length > 0) {
				content += '\n# Subtasks:\n';

				task.subtasks.forEach((subtask) => {
					content += `## ${subtask.id}. ${subtask.title} [${subtask.status || 'pending'}]\n`;

					if (subtask.dependencies && subtask.dependencies.length > 0) {
						// Format subtask dependencies
						let subtaskDeps = subtask.dependencies
							.map((depId) => {
								if (typeof depId === 'number') {
									// Handle numeric dependencies to other subtasks
									const foundSubtask = task.subtasks.find(
										(st) => st.id === depId
									);
									if (foundSubtask) {
										// Just return the plain ID format without any color formatting
										return `${task.id}.${depId}`;
									}
								}
								return depId.toString();
							})
							.join(', ');

						content += `### Dependencies: ${subtaskDeps}\n`;
					} else {
						content += '### Dependencies: None\n';
					}

					content += `### Description: ${subtask.description || ''}\n`;
					content += '### Details:\n';
					content += (subtask.details || '')
						.split('\n')
						.map((line) => line)
						.join('\n');
					content += '\n\n';
				});
			}

			// Write the file
			fs.writeFileSync(taskPath, content);
			// No longer log each individual file
		});

		// Return task files generation info (just the file range)
		return `task_${firstId}.txt → task_${lastId}.txt`;
	} catch (error) {
		log('error', `Error generating task files: ${error.message}`);
		console.error(chalk.red(`Error generating task files: ${error.message}`));

		if (CONFIG.debug) {
			console.error(error);
		}

		process.exit(1);
	}
}

/**
 * Set the status of a task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIdInput - Task ID(s) to update
 * @param {string} newStatus - New status
 */
async function setTaskStatus(tasksPath, taskIdInput, newStatus) {
	try {
		displayBanner();

		console.log(
			boxen(chalk.white.bold(`Updating Task Status to: ${newStatus}`), {
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round'
			})
		);

		log('info', `Reading tasks from ${tasksPath}...`);
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Handle multiple task IDs (comma-separated)
		const taskIds = taskIdInput.split(',').map((id) => id.trim());
		const updatedTasks = [];

		// Update each task
		for (const id of taskIds) {
			await updateSingleTaskStatus(tasksPath, id, newStatus, data);
			updatedTasks.push(id);
		}

		// Write the updated tasks to the file
		writeJSON(tasksPath, data);

		// Validate dependencies after status update
		log('info', 'Validating dependencies after status update...');
		validateTaskDependencies(data.tasks);

		// Generate individual task files
		log('info', 'Regenerating task files...');
		await generateTaskFiles(tasksPath, path.dirname(tasksPath));

		// Display success message
		for (const id of updatedTasks) {
			const task = findTaskById(data.tasks, id);
			const taskName = task ? task.title : id;

			console.log(
				boxen(
					chalk.white.bold(`Successfully updated task ${id} status:`) +
						'\n' +
						`From: ${chalk.yellow(task ? task.status : 'unknown')}\n` +
						`To:   ${chalk.green(newStatus)}`,
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);
		}
	} catch (error) {
		log('error', `Error setting task status: ${error.message}`);
		console.error(chalk.red(`Error: ${error.message}`));

		if (CONFIG.debug) {
			console.error(error);
		}

		process.exit(1);
	}
}

/**
 * Update the status of a single task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIdInput - Task ID to update
 * @param {string} newStatus - New status
 * @param {Object} data - Tasks data
 */
async function updateSingleTaskStatus(tasksPath, taskIdInput, newStatus, data) {
	// Check if it's a subtask (e.g., "1.2")
	if (taskIdInput.includes('.')) {
		const [parentId, subtaskId] = taskIdInput
			.split('.')
			.map((id) => parseInt(id, 10));

		// Find the parent task
		const parentTask = data.tasks.find((t) => t.id === parentId);
		if (!parentTask) {
			throw new Error(`Parent task ${parentId} not found`);
		}

		// Find the subtask
		if (!parentTask.subtasks) {
			throw new Error(`Parent task ${parentId} has no subtasks`);
		}

		const subtask = parentTask.subtasks.find((st) => st.id === subtaskId);
		if (!subtask) {
			throw new Error(
				`Subtask ${subtaskId} not found in parent task ${parentId}`
			);
		}

		// Update the subtask status
		const oldStatus = subtask.status || 'pending';
		subtask.status = newStatus;

		log(
			'info',
			`Updated subtask ${parentId}.${subtaskId} status from '${oldStatus}' to '${newStatus}'`
		);

		// Check if all subtasks are done (if setting to 'done')
		if (
			newStatus.toLowerCase() === 'done' ||
			newStatus.toLowerCase() === 'completed'
		) {
			const allSubtasksDone = parentTask.subtasks.every(
				(st) => st.status === 'done' || st.status === 'completed'
			);

			// Suggest updating parent task if all subtasks are done
			if (
				allSubtasksDone &&
				parentTask.status !== 'done' &&
				parentTask.status !== 'completed'
			) {
				console.log(
					chalk.yellow(
						`All subtasks of parent task ${parentId} are now marked as done.`
					)
				);
				console.log(
					chalk.yellow(
						`Consider updating the parent task status with: task-master set-status --id=${parentId} --status=done`
					)
				);
			}
		}
	} else {
		// Handle regular task
		const taskId = parseInt(taskIdInput, 10);
		const task = data.tasks.find((t) => t.id === taskId);

		if (!task) {
			throw new Error(`Task ${taskId} not found`);
		}

		// Update the task status
		const oldStatus = task.status || 'pending';
		task.status = newStatus;

		log(
			'info',
			`Updated task ${taskId} status from '${oldStatus}' to '${newStatus}'`
		);

		// If marking as done, also mark all subtasks as done
		if (
			(newStatus.toLowerCase() === 'done' ||
				newStatus.toLowerCase() === 'completed') &&
			task.subtasks &&
			task.subtasks.length > 0
		) {
			const pendingSubtasks = task.subtasks.filter(
				(st) => st.status !== 'done' && st.status !== 'completed'
			);

			if (pendingSubtasks.length > 0) {
				log(
					'info',
					`Also marking ${pendingSubtasks.length} subtasks as '${newStatus}'`
				);

				pendingSubtasks.forEach((subtask) => {
					subtask.status = newStatus;
				});
			}
		}
	}
}

/**
 * List all tasks
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} statusFilter - Filter by status
 * @param {boolean} withSubtasks - Whether to show subtasks
 * @param {string} outputFormat - Output format (text or json)
 * @returns {Object} - Task list result for json format
 */
function listTasks(
	tasksPath,
	statusFilter,
	withSubtasks = false,
	outputFormat = 'text'
) {
	try {
		// Only display banner for text output
		if (outputFormat === 'text') {
			displayBanner();
		}

		const data = readJSON(tasksPath); // Reads the whole tasks.json
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Filter tasks by status if specified
		const filteredTasks =
			statusFilter && statusFilter.toLowerCase() !== 'all' // <-- Added check for 'all'
				? data.tasks.filter(
						(task) =>
							task.status &&
							task.status.toLowerCase() === statusFilter.toLowerCase()
					)
				: data.tasks; // Default to all tasks if no filter or filter is 'all'

		// Calculate completion statistics
		const totalTasks = data.tasks.length;
		const completedTasks = data.tasks.filter(
			(task) => task.status === 'done' || task.status === 'completed'
		).length;
		const completionPercentage =
			totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

		// Count statuses
		const doneCount = completedTasks;
		const inProgressCount = data.tasks.filter(
			(task) => task.status === 'in-progress'
		).length;
		const pendingCount = data.tasks.filter(
			(task) => task.status === 'pending'
		).length;
		const blockedCount = data.tasks.filter(
			(task) => task.status === 'blocked'
		).length;
		const deferredCount = data.tasks.filter(
			(task) => task.status === 'deferred'
		).length;

		// Count subtasks
		let totalSubtasks = 0;
		let completedSubtasks = 0;

		data.tasks.forEach((task) => {
			if (task.subtasks && task.subtasks.length > 0) {
				totalSubtasks += task.subtasks.length;
				completedSubtasks += task.subtasks.filter(
					(st) => st.status === 'done' || st.status === 'completed'
				).length;
			}
		});

		const subtaskCompletionPercentage =
			totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

		// For JSON output, return structured data
		if (outputFormat === 'json') {
			// *** Modification: Remove 'details' field for JSON output ***
			const tasksWithoutDetails = filteredTasks.map((task) => {
				// <-- USES filteredTasks!
				// Omit 'details' from the parent task
				const { details, ...taskRest } = task;

				// If subtasks exist, omit 'details' from them too
				if (taskRest.subtasks && Array.isArray(taskRest.subtasks)) {
					taskRest.subtasks = taskRest.subtasks.map((subtask) => {
						const { details: subtaskDetails, ...subtaskRest } = subtask;
						return subtaskRest;
					});
				}
				return taskRest;
			});
			// *** End of Modification ***

			return {
				tasks: tasksWithoutDetails, // <--- THIS IS THE ARRAY BEING RETURNED
				filter: statusFilter || 'all', // Return the actual filter used
				stats: {
					total: totalTasks,
					completed: doneCount,
					inProgress: inProgressCount,
					pending: pendingCount,
					blocked: blockedCount,
					deferred: deferredCount,
					completionPercentage,
					subtasks: {
						total: totalSubtasks,
						completed: completedSubtasks,
						completionPercentage: subtaskCompletionPercentage
					}
				}
			};
		}

		// ... existing code for text output ...

		// Create progress bars
		const taskProgressBar = createProgressBar(completionPercentage, 30);
		const subtaskProgressBar = createProgressBar(
			subtaskCompletionPercentage,
			30
		);

		// Calculate dependency statistics
		const completedTaskIds = new Set(
			data.tasks
				.filter((t) => t.status === 'done' || t.status === 'completed')
				.map((t) => t.id)
		);

		const tasksWithNoDeps = data.tasks.filter(
			(t) =>
				t.status !== 'done' &&
				t.status !== 'completed' &&
				(!t.dependencies || t.dependencies.length === 0)
		).length;

		const tasksWithAllDepsSatisfied = data.tasks.filter(
			(t) =>
				t.status !== 'done' &&
				t.status !== 'completed' &&
				t.dependencies &&
				t.dependencies.length > 0 &&
				t.dependencies.every((depId) => completedTaskIds.has(depId))
		).length;

		const tasksWithUnsatisfiedDeps = data.tasks.filter(
			(t) =>
				t.status !== 'done' &&
				t.status !== 'completed' &&
				t.dependencies &&
				t.dependencies.length > 0 &&
				!t.dependencies.every((depId) => completedTaskIds.has(depId))
		).length;

		// Calculate total tasks ready to work on (no deps + satisfied deps)
		const tasksReadyToWork = tasksWithNoDeps + tasksWithAllDepsSatisfied;

		// Calculate most depended-on tasks
		const dependencyCount = {};
		data.tasks.forEach((task) => {
			if (task.dependencies && task.dependencies.length > 0) {
				task.dependencies.forEach((depId) => {
					dependencyCount[depId] = (dependencyCount[depId] || 0) + 1;
				});
			}
		});

		// Find the most depended-on task
		let mostDependedOnTaskId = null;
		let maxDependents = 0;

		for (const [taskId, count] of Object.entries(dependencyCount)) {
			if (count > maxDependents) {
				maxDependents = count;
				mostDependedOnTaskId = parseInt(taskId);
			}
		}

		// Get the most depended-on task
		const mostDependedOnTask =
			mostDependedOnTaskId !== null
				? data.tasks.find((t) => t.id === mostDependedOnTaskId)
				: null;

		// Calculate average dependencies per task
		const totalDependencies = data.tasks.reduce(
			(sum, task) => sum + (task.dependencies ? task.dependencies.length : 0),
			0
		);
		const avgDependenciesPerTask = totalDependencies / data.tasks.length;

		// Find next task to work on
		const nextTask = findNextTask(data.tasks);
		const nextTaskInfo = nextTask
			? `ID: ${chalk.cyan(nextTask.id)} - ${chalk.white.bold(truncate(nextTask.title, 40))}\n` +
				`Priority: ${chalk.white(nextTask.priority || 'medium')}  Dependencies: ${formatDependenciesWithStatus(nextTask.dependencies, data.tasks, true)}`
			: chalk.yellow(
					'No eligible tasks found. All tasks are either completed or have unsatisfied dependencies.'
				);

		// Get terminal width - more reliable method
		let terminalWidth;
		try {
			// Try to get the actual terminal columns
			terminalWidth = process.stdout.columns;
		} catch (e) {
			// Fallback if columns cannot be determined
			log('debug', 'Could not determine terminal width, using default');
		}
		// Ensure we have a reasonable default if detection fails
		terminalWidth = terminalWidth || 80;

		// Ensure terminal width is at least a minimum value to prevent layout issues
		terminalWidth = Math.max(terminalWidth, 80);

		// Create dashboard content
		const projectDashboardContent =
			chalk.white.bold('Project Dashboard') +
			'\n' +
			`Tasks Progress: ${chalk.greenBright(taskProgressBar)} ${completionPercentage.toFixed(0)}%\n` +
			`Done: ${chalk.green(doneCount)}  In Progress: ${chalk.blue(inProgressCount)}  Pending: ${chalk.yellow(pendingCount)}  Blocked: ${chalk.red(blockedCount)}  Deferred: ${chalk.gray(deferredCount)}\n\n` +
			`Subtasks Progress: ${chalk.cyan(subtaskProgressBar)} ${subtaskCompletionPercentage.toFixed(0)}%\n` +
			`Completed: ${chalk.green(completedSubtasks)}/${totalSubtasks}  Remaining: ${chalk.yellow(totalSubtasks - completedSubtasks)}\n\n` +
			chalk.cyan.bold('Priority Breakdown:') +
			'\n' +
			`${chalk.red('•')} ${chalk.white('High priority:')} ${data.tasks.filter((t) => t.priority === 'high').length}\n` +
			`${chalk.yellow('•')} ${chalk.white('Medium priority:')} ${data.tasks.filter((t) => t.priority === 'medium').length}\n` +
			`${chalk.green('•')} ${chalk.white('Low priority:')} ${data.tasks.filter((t) => t.priority === 'low').length}`;

		const dependencyDashboardContent =
			chalk.white.bold('Dependency Status & Next Task') +
			'\n' +
			chalk.cyan.bold('Dependency Metrics:') +
			'\n' +
			`${chalk.green('•')} ${chalk.white('Tasks with no dependencies:')} ${tasksWithNoDeps}\n` +
			`${chalk.green('•')} ${chalk.white('Tasks ready to work on:')} ${tasksReadyToWork}\n` +
			`${chalk.yellow('•')} ${chalk.white('Tasks blocked by dependencies:')} ${tasksWithUnsatisfiedDeps}\n` +
			`${chalk.magenta('•')} ${chalk.white('Most depended-on task:')} ${mostDependedOnTask ? chalk.cyan(`#${mostDependedOnTaskId} (${maxDependents} dependents)`) : chalk.gray('None')}\n` +
			`${chalk.blue('•')} ${chalk.white('Avg dependencies per task:')} ${avgDependenciesPerTask.toFixed(1)}\n\n` +
			chalk.cyan.bold('Next Task to Work On:') +
			'\n' +
			`ID: ${chalk.cyan(nextTask ? nextTask.id : 'N/A')} - ${nextTask ? chalk.white.bold(truncate(nextTask.title, 40)) : chalk.yellow('No task available')}\n` +
			`Priority: ${nextTask ? chalk.white(nextTask.priority || 'medium') : ''}  Dependencies: ${nextTask ? formatDependenciesWithStatus(nextTask.dependencies, data.tasks, true) : ''}`;

		// Calculate width for side-by-side display
		// Box borders, padding take approximately 4 chars on each side
		const minDashboardWidth = 50; // Minimum width for dashboard
		const minDependencyWidth = 50; // Minimum width for dependency dashboard
		const totalMinWidth = minDashboardWidth + minDependencyWidth + 4; // Extra 4 chars for spacing

		// If terminal is wide enough, show boxes side by side with responsive widths
		if (terminalWidth >= totalMinWidth) {
			// Calculate widths proportionally for each box - use exact 50% width each
			const availableWidth = terminalWidth;
			const halfWidth = Math.floor(availableWidth / 2);

			// Account for border characters (2 chars on each side)
			const boxContentWidth = halfWidth - 4;

			// Create boxen options with precise widths
			const dashboardBox = boxen(projectDashboardContent, {
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round',
				width: boxContentWidth,
				dimBorder: false
			});

			const dependencyBox = boxen(dependencyDashboardContent, {
				padding: 1,
				borderColor: 'magenta',
				borderStyle: 'round',
				width: boxContentWidth,
				dimBorder: false
			});

			// Create a better side-by-side layout with exact spacing
			const dashboardLines = dashboardBox.split('\n');
			const dependencyLines = dependencyBox.split('\n');

			// Make sure both boxes have the same height
			const maxHeight = Math.max(dashboardLines.length, dependencyLines.length);

			// For each line of output, pad the dashboard line to exactly halfWidth chars
			// This ensures the dependency box starts at exactly the right position
			const combinedLines = [];
			for (let i = 0; i < maxHeight; i++) {
				// Get the dashboard line (or empty string if we've run out of lines)
				const dashLine = i < dashboardLines.length ? dashboardLines[i] : '';
				// Get the dependency line (or empty string if we've run out of lines)
				const depLine = i < dependencyLines.length ? dependencyLines[i] : '';

				// Remove any trailing spaces from dashLine before padding to exact width
				const trimmedDashLine = dashLine.trimEnd();
				// Pad the dashboard line to exactly halfWidth chars with no extra spaces
				const paddedDashLine = trimmedDashLine.padEnd(halfWidth, ' ');

				// Join the lines with no space in between
				combinedLines.push(paddedDashLine + depLine);
			}

			// Join all lines and output
			console.log(combinedLines.join('\n'));
		} else {
			// Terminal too narrow, show boxes stacked vertically
			const dashboardBox = boxen(projectDashboardContent, {
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round',
				margin: { top: 0, bottom: 1 }
			});

			const dependencyBox = boxen(dependencyDashboardContent, {
				padding: 1,
				borderColor: 'magenta',
				borderStyle: 'round',
				margin: { top: 0, bottom: 1 }
			});

			// Display stacked vertically
			console.log(dashboardBox);
			console.log(dependencyBox);
		}

		if (filteredTasks.length === 0) {
			console.log(
				boxen(
					statusFilter
						? chalk.yellow(`No tasks with status '${statusFilter}' found`)
						: chalk.yellow('No tasks found'),
					{ padding: 1, borderColor: 'yellow', borderStyle: 'round' }
				)
			);
			return;
		}

		// COMPLETELY REVISED TABLE APPROACH
		// Define percentage-based column widths and calculate actual widths
		// Adjust percentages based on content type and user requirements

		// Adjust ID width if showing subtasks (subtask IDs are longer: e.g., "1.2")
		const idWidthPct = withSubtasks ? 10 : 7;

		// Calculate max status length to accommodate "in-progress"
		const statusWidthPct = 15;

		// Increase priority column width as requested
		const priorityWidthPct = 12;

		// Make dependencies column smaller as requested (-20%)
		const depsWidthPct = 20;

		// Calculate title/description width as remaining space (+20% from dependencies reduction)
		const titleWidthPct =
			100 - idWidthPct - statusWidthPct - priorityWidthPct - depsWidthPct;

		// Allow 10 characters for borders and padding
		const availableWidth = terminalWidth - 10;

		// Calculate actual column widths based on percentages
		const idWidth = Math.floor(availableWidth * (idWidthPct / 100));
		const statusWidth = Math.floor(availableWidth * (statusWidthPct / 100));
		const priorityWidth = Math.floor(availableWidth * (priorityWidthPct / 100));
		const depsWidth = Math.floor(availableWidth * (depsWidthPct / 100));
		const titleWidth = Math.floor(availableWidth * (titleWidthPct / 100));

		// Create a table with correct borders and spacing
		const table = new Table({
			head: [
				chalk.cyan.bold('ID'),
				chalk.cyan.bold('Title'),
				chalk.cyan.bold('Status'),
				chalk.cyan.bold('Priority'),
				chalk.cyan.bold('Dependencies')
			],
			colWidths: [idWidth, titleWidth, statusWidth, priorityWidth, depsWidth],
			style: {
				head: [], // No special styling for header
				border: [], // No special styling for border
				compact: false // Use default spacing
			},
			wordWrap: true,
			wrapOnWordBoundary: true
		});

		// Process tasks for the table
		filteredTasks.forEach((task) => {
			// Format dependencies with status indicators (colored)
			let depText = 'None';
			if (task.dependencies && task.dependencies.length > 0) {
				// Use the proper formatDependenciesWithStatus function for colored status
				depText = formatDependenciesWithStatus(
					task.dependencies,
					data.tasks,
					true
				);
			} else {
				depText = chalk.gray('None');
			}

			// Clean up any ANSI codes or confusing characters
			const cleanTitle = task.title.replace(/\n/g, ' ');

			// Get priority color
			const priorityColor =
				{
					high: chalk.red,
					medium: chalk.yellow,
					low: chalk.gray
				}[task.priority || 'medium'] || chalk.white;

			// Format status
			const status = getStatusWithColor(task.status, true);

			// Add the row without truncating dependencies
			table.push([
				task.id.toString(),
				truncate(cleanTitle, titleWidth - 3),
				status,
				priorityColor(truncate(task.priority || 'medium', priorityWidth - 2)),
				depText // No truncation for dependencies
			]);

			// Add subtasks if requested
			if (withSubtasks && task.subtasks && task.subtasks.length > 0) {
				task.subtasks.forEach((subtask) => {
					// Format subtask dependencies with status indicators
					let subtaskDepText = 'None';
					if (subtask.dependencies && subtask.dependencies.length > 0) {
						// Handle both subtask-to-subtask and subtask-to-task dependencies
						const formattedDeps = subtask.dependencies
							.map((depId) => {
								// Check if it's a dependency on another subtask
								if (typeof depId === 'number' && depId < 100) {
									const foundSubtask = task.subtasks.find(
										(st) => st.id === depId
									);
									if (foundSubtask) {
										const isDone =
											foundSubtask.status === 'done' ||
											foundSubtask.status === 'completed';
										const isInProgress = foundSubtask.status === 'in-progress';

										// Use consistent color formatting instead of emojis
										if (isDone) {
											return chalk.green.bold(`${task.id}.${depId}`);
										} else if (isInProgress) {
											return chalk.hex('#FFA500').bold(`${task.id}.${depId}`);
										} else {
											return chalk.red.bold(`${task.id}.${depId}`);
										}
									}
								}
								// Default to regular task dependency
								const depTask = data.tasks.find((t) => t.id === depId);
								if (depTask) {
									const isDone =
										depTask.status === 'done' || depTask.status === 'completed';
									const isInProgress = depTask.status === 'in-progress';
									// Use the same color scheme as in formatDependenciesWithStatus
									if (isDone) {
										return chalk.green.bold(`${depId}`);
									} else if (isInProgress) {
										return chalk.hex('#FFA500').bold(`${depId}`);
									} else {
										return chalk.red.bold(`${depId}`);
									}
								}
								return chalk.cyan(depId.toString());
							})
							.join(', ');

						subtaskDepText = formattedDeps || chalk.gray('None');
					}

					// Add the subtask row without truncating dependencies
					table.push([
						`${task.id}.${subtask.id}`,
						chalk.dim(`└─ ${truncate(subtask.title, titleWidth - 5)}`),
						getStatusWithColor(subtask.status, true),
						chalk.dim('-'),
						subtaskDepText // No truncation for dependencies
					]);
				});
			}
		});

		// Ensure we output the table even if it had to wrap
		try {
			console.log(table.toString());
		} catch (err) {
			log('error', `Error rendering table: ${err.message}`);

			// Fall back to simpler output
			console.log(
				chalk.yellow(
					'\nFalling back to simple task list due to terminal width constraints:'
				)
			);
			filteredTasks.forEach((task) => {
				console.log(
					`${chalk.cyan(task.id)}: ${chalk.white(task.title)} - ${getStatusWithColor(task.status)}`
				);
			});
		}

		// Show filter info if applied
		if (statusFilter) {
			console.log(chalk.yellow(`\nFiltered by status: ${statusFilter}`));
			console.log(
				chalk.yellow(`Showing ${filteredTasks.length} of ${totalTasks} tasks`)
			);
		}

		// Define priority colors
		const priorityColors = {
			high: chalk.red.bold,
			medium: chalk.yellow,
			low: chalk.gray
		};

		// Show next task box in a prominent color
		if (nextTask) {
			// Prepare subtasks section if they exist
			let subtasksSection = '';
			if (nextTask.subtasks && nextTask.subtasks.length > 0) {
				subtasksSection = `\n\n${chalk.white.bold('Subtasks:')}\n`;
				subtasksSection += nextTask.subtasks
					.map((subtask) => {
						// Using a more simplified format for subtask status display
						const status = subtask.status || 'pending';
						const statusColors = {
							done: chalk.green,
							completed: chalk.green,
							pending: chalk.yellow,
							'in-progress': chalk.blue,
							deferred: chalk.gray,
							blocked: chalk.red
						};
						const statusColor =
							statusColors[status.toLowerCase()] || chalk.white;
						return `${chalk.cyan(`${nextTask.id}.${subtask.id}`)} [${statusColor(status)}] ${subtask.title}`;
					})
					.join('\n');
			}

			console.log(
				boxen(
					chalk
						.hex('#FF8800')
						.bold(
							`🔥 Next Task to Work On: #${nextTask.id} - ${nextTask.title}`
						) +
						'\n\n' +
						`${chalk.white('Priority:')} ${priorityColors[nextTask.priority || 'medium'](nextTask.priority || 'medium')}   ${chalk.white('Status:')} ${getStatusWithColor(nextTask.status, true)}\n` +
						`${chalk.white('Dependencies:')} ${nextTask.dependencies && nextTask.dependencies.length > 0 ? formatDependenciesWithStatus(nextTask.dependencies, data.tasks, true) : chalk.gray('None')}\n\n` +
						`${chalk.white('Description:')} ${nextTask.description}` +
						subtasksSection +
						'\n\n' +
						`${chalk.cyan('Start working:')} ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=in-progress`)}\n` +
						`${chalk.cyan('View details:')} ${chalk.yellow(`task-master show ${nextTask.id}`)}`,
					{
						padding: { left: 2, right: 2, top: 1, bottom: 1 },
						borderColor: '#FF8800',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 },
						title: '⚡ RECOMMENDED NEXT TASK ⚡',
						titleAlignment: 'center',
						width: terminalWidth - 4, // Use full terminal width minus a small margin
						fullscreen: false // Keep it expandable but not literally fullscreen
					}
				)
			);
		} else {
			console.log(
				boxen(
					chalk.hex('#FF8800').bold('No eligible next task found') +
						'\n\n' +
						'All pending tasks have dependencies that are not yet completed, or all tasks are done.',
					{
						padding: 1,
						borderColor: '#FF8800',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 },
						title: '⚡ NEXT TASK ⚡',
						titleAlignment: 'center',
						width: terminalWidth - 4 // Use full terminal width minus a small margin
					}
				)
			);
		}

		// Show next steps
		console.log(
			boxen(
				chalk.white.bold('Suggested Next Steps:') +
					'\n\n' +
					`${chalk.cyan('1.')} Run ${chalk.yellow('task-master next')} to see what to work on next\n` +
					`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down a task into subtasks\n` +
					`${chalk.cyan('3.')} Run ${chalk.yellow('task-master set-status --id=<id> --status=done')} to mark a task as complete`,
				{
					padding: 1,
					borderColor: 'gray',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);
	} catch (error) {
		log('error', `Error listing tasks: ${error.message}`);

		if (outputFormat === 'json') {
			// Return structured error for JSON output
			throw {
				code: 'TASK_LIST_ERROR',
				message: error.message,
				details: error.stack
			};
		}

		console.error(chalk.red(`Error: ${error.message}`));
		process.exit(1);
	}
}

/**
 * Safely apply chalk coloring, stripping ANSI codes when calculating string length
 * @param {string} text - Original text
 * @param {Function} colorFn - Chalk color function
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Colored text that won't break table layout
 */
function safeColor(text, colorFn, maxLength = 0) {
	if (!text) return '';

	// If maxLength is provided, truncate the text first
	const baseText = maxLength > 0 ? truncate(text, maxLength) : text;

	// Apply color function if provided, otherwise return as is
	return colorFn ? colorFn(baseText) : baseText;
}

/**
 * Expand a task with subtasks
 * @param {number} taskId - Task ID to expand
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {boolean} useResearch - Whether to use research (Perplexity)
 * @param {string} additionalContext - Additional context
 */
async function expandTask(
	taskId,
	numSubtasks = CONFIG.defaultSubtasks,
	useResearch = false,
	additionalContext = ''
) {
	try {
		displayBanner();

		// Load tasks
		const tasksPath = path.join(process.cwd(), 'tasks', 'tasks.json');
		log('info', `Loading tasks from ${tasksPath}...`);

		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Find the task
		const task = data.tasks.find((t) => t.id === taskId);
		if (!task) {
			throw new Error(`Task ${taskId} not found`);
		}

		// Check if the task is already completed
		if (task.status === 'done' || task.status === 'completed') {
			log(
				'warn',
				`Task ${taskId} is already marked as "${task.status}". Skipping expansion.`
			);
			console.log(
				chalk.yellow(
					`Task ${taskId} is already marked as "${task.status}". Skipping expansion.`
				)
			);
			return;
		}

		// Check for complexity report
		log('info', 'Checking for complexity analysis...');
		const complexityReport = readComplexityReport();
		let taskAnalysis = null;

		if (complexityReport) {
			taskAnalysis = findTaskInComplexityReport(complexityReport, taskId);

			if (taskAnalysis) {
				log(
					'info',
					`Found complexity analysis for task ${taskId}: Score ${taskAnalysis.complexityScore}/10`
				);

				// Use recommended number of subtasks if available and not overridden
				if (
					taskAnalysis.recommendedSubtasks &&
					numSubtasks === CONFIG.defaultSubtasks
				) {
					numSubtasks = taskAnalysis.recommendedSubtasks;
					log('info', `Using recommended number of subtasks: ${numSubtasks}`);
				}

				// Use expansion prompt from analysis as additional context if available
				if (taskAnalysis.expansionPrompt && !additionalContext) {
					additionalContext = taskAnalysis.expansionPrompt;
					log('info', 'Using expansion prompt from complexity analysis');
				}
			} else {
				log('info', `No complexity analysis found for task ${taskId}`);
			}
		}

		console.log(
			boxen(chalk.white.bold(`Expanding Task: #${taskId} - ${task.title}`), {
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round',
				margin: { top: 0, bottom: 1 }
			})
		);

		// Check if the task already has subtasks
		if (task.subtasks && task.subtasks.length > 0) {
			log(
				'warn',
				`Task ${taskId} already has ${task.subtasks.length} subtasks. Appending new subtasks.`
			);
			console.log(
				chalk.yellow(
					`Task ${taskId} already has ${task.subtasks.length} subtasks. New subtasks will be appended.`
				)
			);
		}

		// Initialize subtasks array if it doesn't exist
		if (!task.subtasks) {
			task.subtasks = [];
		}

		// Determine the next subtask ID
		const nextSubtaskId =
			task.subtasks.length > 0
				? Math.max(...task.subtasks.map((st) => st.id)) + 1
				: 1;

		// Generate subtasks
		let subtasks;
		if (useResearch) {
			log('info', 'Using Perplexity AI for research-backed subtask generation');
			subtasks = await generateSubtasksWithPerplexity(
				task,
				numSubtasks,
				nextSubtaskId,
				additionalContext
			);
		} else {
			log('info', 'Generating subtasks with Claude only');
			subtasks = await generateSubtasks(
				task,
				numSubtasks,
				nextSubtaskId,
				additionalContext
			);
		}

		// Add the subtasks to the task
		task.subtasks = [...task.subtasks, ...subtasks];

		// Write the updated tasks to the file
		writeJSON(tasksPath, data);

		// Generate individual task files
		await generateTaskFiles(tasksPath, path.dirname(tasksPath));

		// Display success message
		console.log(
			boxen(
				chalk.green(
					`Successfully added ${subtasks.length} subtasks to task ${taskId}`
				),
				{ padding: 1, borderColor: 'green', borderStyle: 'round' }
			)
		);

		// Show the subtasks table
		const table = new Table({
			head: [
				chalk.cyan.bold('ID'),
				chalk.cyan.bold('Title'),
				chalk.cyan.bold('Dependencies'),
				chalk.cyan.bold('Status')
			],
			colWidths: [8, 50, 15, 15]
		});

		subtasks.forEach((subtask) => {
			const deps =
				subtask.dependencies && subtask.dependencies.length > 0
					? subtask.dependencies.map((d) => `${taskId}.${d}`).join(', ')
					: chalk.gray('None');

			table.push([
				`${taskId}.${subtask.id}`,
				truncate(subtask.title, 47),
				deps,
				getStatusWithColor(subtask.status, true)
			]);
		});

		console.log(table.toString());

		// Show next steps
		console.log(
			boxen(
				chalk.white.bold('Next Steps:') +
					'\n\n' +
					`${chalk.cyan('1.')} Run ${chalk.yellow(`task-master show ${taskId}`)} to see the full task with subtasks\n` +
					`${chalk.cyan('2.')} Start working on subtask: ${chalk.yellow(`task-master set-status --id=${taskId}.1 --status=in-progress`)}\n` +
					`${chalk.cyan('3.')} Mark subtask as done: ${chalk.yellow(`task-master set-status --id=${taskId}.1 --status=done`)}`,
				{
					padding: 1,
					borderColor: 'cyan',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);
	} catch (error) {
		log('error', `Error expanding task: ${error.message}`);
		console.error(chalk.red(`Error: ${error.message}`));

		if (CONFIG.debug) {
			console.error(error);
		}

		process.exit(1);
	}
}

/**
 * Expand all pending tasks with subtasks
 * @param {number} numSubtasks - Number of subtasks per task
 * @param {boolean} useResearch - Whether to use research (Perplexity)
 * @param {string} additionalContext - Additional context
 * @param {boolean} forceFlag - Force regeneration for tasks with subtasks
 */
async function expandAllTasks(
	numSubtasks = CONFIG.defaultSubtasks,
	useResearch = false,
	additionalContext = '',
	forceFlag = false
) {
	try {
		displayBanner();

		// Load tasks
		const tasksPath = path.join(process.cwd(), 'tasks', 'tasks.json');
		log('info', `Loading tasks from ${tasksPath}...`);

		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Get complexity report if it exists
		log('info', 'Checking for complexity analysis...');
		const complexityReport = readComplexityReport();

		// Filter tasks that are not done and don't have subtasks (unless forced)
		const pendingTasks = data.tasks.filter(
			(task) =>
				task.status !== 'done' &&
				task.status !== 'completed' &&
				(forceFlag || !task.subtasks || task.subtasks.length === 0)
		);

		if (pendingTasks.length === 0) {
			log('info', 'No pending tasks found to expand');
			console.log(
				boxen(chalk.yellow('No pending tasks found to expand'), {
					padding: 1,
					borderColor: 'yellow',
					borderStyle: 'round'
				})
			);
			return;
		}

		// Sort tasks by complexity if report exists, otherwise by ID
		let tasksToExpand = [...pendingTasks];

		if (complexityReport && complexityReport.complexityAnalysis) {
			log('info', 'Sorting tasks by complexity...');

			// Create a map of task IDs to complexity scores
			const complexityMap = new Map();
			complexityReport.complexityAnalysis.forEach((analysis) => {
				complexityMap.set(analysis.taskId, analysis.complexityScore);
			});

			// Sort tasks by complexity score (high to low)
			tasksToExpand.sort((a, b) => {
				const scoreA = complexityMap.get(a.id) || 0;
				const scoreB = complexityMap.get(b.id) || 0;
				return scoreB - scoreA;
			});
		} else {
			// Sort by ID if no complexity report
			tasksToExpand.sort((a, b) => a.id - b.id);
		}

		console.log(
			boxen(
				chalk.white.bold(`Expanding ${tasksToExpand.length} Pending Tasks`),
				{
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round',
					margin: { top: 0, bottom: 1 }
				}
			)
		);

		// Show tasks to be expanded
		const table = new Table({
			head: [
				chalk.cyan.bold('ID'),
				chalk.cyan.bold('Title'),
				chalk.cyan.bold('Status'),
				chalk.cyan.bold('Complexity')
			],
			colWidths: [5, 50, 15, 15]
		});

		tasksToExpand.forEach((task) => {
			const taskAnalysis = complexityReport
				? findTaskInComplexityReport(complexityReport, task.id)
				: null;

			const complexity = taskAnalysis
				? getComplexityWithColor(taskAnalysis.complexityScore) + '/10'
				: chalk.gray('Unknown');

			table.push([
				task.id,
				truncate(task.title, 47),
				getStatusWithColor(task.status),
				complexity
			]);
		});

		console.log(table.toString());

		// Confirm expansion
		console.log(
			chalk.yellow(
				`\nThis will expand ${tasksToExpand.length} tasks with ${numSubtasks} subtasks each.`
			)
		);
		console.log(
			chalk.yellow(`Research-backed generation: ${useResearch ? 'Yes' : 'No'}`)
		);
		console.log(
			chalk.yellow(`Force regeneration: ${forceFlag ? 'Yes' : 'No'}`)
		);

		// Expand each task
		let expandedCount = 0;
		for (const task of tasksToExpand) {
			try {
				log('info', `Expanding task ${task.id}: ${task.title}`);

				// Get task-specific parameters from complexity report
				let taskSubtasks = numSubtasks;
				let taskContext = additionalContext;

				if (complexityReport) {
					const taskAnalysis = findTaskInComplexityReport(
						complexityReport,
						task.id
					);
					if (taskAnalysis) {
						// Use recommended subtasks if default wasn't overridden
						if (
							taskAnalysis.recommendedSubtasks &&
							numSubtasks === CONFIG.defaultSubtasks
						) {
							taskSubtasks = taskAnalysis.recommendedSubtasks;
							log(
								'info',
								`Using recommended subtasks for task ${task.id}: ${taskSubtasks}`
							);
						}

						// Add expansion prompt if no user context was provided
						if (taskAnalysis.expansionPrompt && !additionalContext) {
							taskContext = taskAnalysis.expansionPrompt;
							log(
								'info',
								`Using complexity analysis prompt for task ${task.id}`
							);
						}
					}
				}

				// Check if the task already has subtasks
				if (task.subtasks && task.subtasks.length > 0) {
					if (forceFlag) {
						log(
							'info',
							`Task ${task.id} already has ${task.subtasks.length} subtasks. Clearing them due to --force flag.`
						);
						task.subtasks = []; // Clear existing subtasks
					} else {
						log(
							'warn',
							`Task ${task.id} already has subtasks. Skipping (use --force to regenerate).`
						);
						continue;
					}
				}

				// Initialize subtasks array if it doesn't exist
				if (!task.subtasks) {
					task.subtasks = [];
				}

				// Determine the next subtask ID
				const nextSubtaskId =
					task.subtasks.length > 0
						? Math.max(...task.subtasks.map((st) => st.id)) + 1
						: 1;

				// Generate subtasks
				let subtasks;
				if (useResearch) {
					subtasks = await generateSubtasksWithPerplexity(
						task,
						taskSubtasks,
						nextSubtaskId,
						taskContext
					);
				} else {
					subtasks = await generateSubtasks(
						task,
						taskSubtasks,
						nextSubtaskId,
						taskContext
					);
				}

				// Add the subtasks to the task
				task.subtasks = [...task.subtasks, ...subtasks];
				expandedCount++;
			} catch (error) {
				log('error', `Error expanding task ${task.id}: ${error.message}`);
				console.error(
					chalk.red(`Error expanding task ${task.id}: ${error.message}`)
				);
				continue;
			}
		}

		// Write the updated tasks to the file
		writeJSON(tasksPath, data);

		// Generate individual task files
		await generateTaskFiles(tasksPath, path.dirname(tasksPath));

		// Display success message
		console.log(
			boxen(
				chalk.green(
					`Successfully expanded ${expandedCount} of ${tasksToExpand.length} tasks`
				),
				{ padding: 1, borderColor: 'green', borderStyle: 'round' }
			)
		);

		// Show next steps
		console.log(
			boxen(
				chalk.white.bold('Next Steps:') +
					'\n\n' +
					`${chalk.cyan('1.')} Run ${chalk.yellow('task-master list --with-subtasks')} to see all tasks with subtasks\n` +
					`${chalk.cyan('2.')} Run ${chalk.yellow('task-master next')} to see what to work on next`,
				{
					padding: 1,
					borderColor: 'cyan',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);
	} catch (error) {
		log('error', `Error expanding tasks: ${error.message}`);
		console.error(chalk.red(`Error: ${error.message}`));

		if (CONFIG.debug) {
			console.error(error);
		}

		process.exit(1);
	}
}

/**
 * Clear subtasks from specified tasks
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIds - Task IDs to clear subtasks from
 */
function clearSubtasks(tasksPath, taskIds) {
	displayBanner();

	log('info', `Reading tasks from ${tasksPath}...`);
	const data = readJSON(tasksPath);
	if (!data || !data.tasks) {
		log('error', 'No valid tasks found.');
		process.exit(1);
	}

	console.log(
		boxen(chalk.white.bold('Clearing Subtasks'), {
			padding: 1,
			borderColor: 'blue',
			borderStyle: 'round',
			margin: { top: 1, bottom: 1 }
		})
	);

	// Handle multiple task IDs (comma-separated)
	const taskIdArray = taskIds.split(',').map((id) => id.trim());
	let clearedCount = 0;

	// Create a summary table for the cleared subtasks
	const summaryTable = new Table({
		head: [
			chalk.cyan.bold('Task ID'),
			chalk.cyan.bold('Task Title'),
			chalk.cyan.bold('Subtasks Cleared')
		],
		colWidths: [10, 50, 20],
		style: { head: [], border: [] }
	});

	taskIdArray.forEach((taskId) => {
		const id = parseInt(taskId, 10);
		if (isNaN(id)) {
			log('error', `Invalid task ID: ${taskId}`);
			return;
		}

		const task = data.tasks.find((t) => t.id === id);
		if (!task) {
			log('error', `Task ${id} not found`);
			return;
		}

		if (!task.subtasks || task.subtasks.length === 0) {
			log('info', `Task ${id} has no subtasks to clear`);
			summaryTable.push([
				id.toString(),
				truncate(task.title, 47),
				chalk.yellow('No subtasks')
			]);
			return;
		}

		const subtaskCount = task.subtasks.length;
		task.subtasks = [];
		clearedCount++;
		log('info', `Cleared ${subtaskCount} subtasks from task ${id}`);

		summaryTable.push([
			id.toString(),
			truncate(task.title, 47),
			chalk.green(`${subtaskCount} subtasks cleared`)
		]);
	});

	if (clearedCount > 0) {
		writeJSON(tasksPath, data);

		// Show summary table
		console.log(
			boxen(chalk.white.bold('Subtask Clearing Summary:'), {
				padding: { left: 2, right: 2, top: 0, bottom: 0 },
				margin: { top: 1, bottom: 0 },
				borderColor: 'blue',
				borderStyle: 'round'
			})
		);
		console.log(summaryTable.toString());

		// Regenerate task files to reflect changes
		log('info', 'Regenerating task files...');
		generateTaskFiles(tasksPath, path.dirname(tasksPath));

		// Success message
		console.log(
			boxen(
				chalk.green(
					`Successfully cleared subtasks from ${chalk.bold(clearedCount)} task(s)`
				),
				{
					padding: 1,
					borderColor: 'green',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);

		// Next steps suggestion
		console.log(
			boxen(
				chalk.white.bold('Next Steps:') +
					'\n\n' +
					`${chalk.cyan('1.')} Run ${chalk.yellow('task-master expand --id=<id>')} to generate new subtasks\n` +
					`${chalk.cyan('2.')} Run ${chalk.yellow('task-master list --with-subtasks')} to verify changes`,
				{
					padding: 1,
					borderColor: 'cyan',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);
	} else {
		console.log(
			boxen(chalk.yellow('No subtasks were cleared'), {
				padding: 1,
				borderColor: 'yellow',
				borderStyle: 'round',
				margin: { top: 1 }
			})
		);
	}
}

/**
 * Add a new task using AI
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} prompt - Description of the task to add
 * @param {Array} dependencies - Task dependencies
 * @param {string} priority - Task priority
 * @returns {number} The new task ID
 */
async function addTask(
	tasksPath,
	prompt,
	dependencies = [],
	priority = 'medium'
) {
	displayBanner();

	// Read the existing tasks
	const data = readJSON(tasksPath);
	if (!data || !data.tasks) {
		log('error', 'Invalid or missing tasks.json.');
		process.exit(1);
	}

	// Find the highest task ID to determine the next ID
	const highestId = Math.max(...data.tasks.map((t) => t.id));
	const newTaskId = highestId + 1;

	console.log(
		boxen(chalk.white.bold(`Creating New Task #${newTaskId}`), {
			padding: 1,
			borderColor: 'blue',
			borderStyle: 'round',
			margin: { top: 1, bottom: 1 }
		})
	);

	// Validate dependencies before proceeding
	const invalidDeps = dependencies.filter((depId) => {
		return !data.tasks.some((t) => t.id === depId);
	});

	if (invalidDeps.length > 0) {
		log(
			'warn',
			`The following dependencies do not exist: ${invalidDeps.join(', ')}`
		);
		log('info', 'Removing invalid dependencies...');
		dependencies = dependencies.filter((depId) => !invalidDeps.includes(depId));
	}

	// Create the system prompt for Claude
	const systemPrompt =
		"You are a helpful assistant that creates well-structured tasks for a software development project. Generate a single new task based on the user's description.";

	// Create the user prompt with context from existing tasks
	let contextTasks = '';
	if (dependencies.length > 0) {
		// Provide context for the dependent tasks
		const dependentTasks = data.tasks.filter((t) =>
			dependencies.includes(t.id)
		);
		contextTasks = `\nThis task depends on the following tasks:\n${dependentTasks
			.map((t) => `- Task ${t.id}: ${t.title} - ${t.description}`)
			.join('\n')}`;
	} else {
		// Provide a few recent tasks as context
		const recentTasks = [...data.tasks].sort((a, b) => b.id - a.id).slice(0, 3);
		contextTasks = `\nRecent tasks in the project:\n${recentTasks
			.map((t) => `- Task ${t.id}: ${t.title} - ${t.description}`)
			.join('\n')}`;
	}

	const taskStructure = `
  {
    "title": "Task title goes here",
    "description": "A concise one or two sentence description of what the task involves",
    "details": "In-depth details including specifics on implementation, considerations, and anything important for the developer to know. This should be detailed enough to guide implementation.",
    "testStrategy": "A detailed approach for verifying the task has been correctly implemented. Include specific test cases or validation methods."
  }`;

	const userPrompt = `Create a comprehensive new task (Task #${newTaskId}) for a software development project based on this description: "${prompt}"
  
  ${contextTasks}
  
  Return your answer as a single JSON object with the following structure:
  ${taskStructure}
  
  Don't include the task ID, status, dependencies, or priority as those will be added automatically.
  Make sure the details and test strategy are thorough and specific.
  
  IMPORTANT: Return ONLY the JSON object, nothing else.`;

	// Start the loading indicator
	const loadingIndicator = startLoadingIndicator(
		'Generating new task with Claude AI...'
	);

	let fullResponse = '';
	let streamingInterval = null;

	try {
		// Call Claude with streaming enabled
		const stream = await anthropic.messages.create({
			max_tokens: CONFIG.maxTokens,
			model: CONFIG.model,
			temperature: CONFIG.temperature,
			messages: [{ role: 'user', content: userPrompt }],
			system: systemPrompt,
			stream: true
		});

		// Update loading indicator to show streaming progress
		let dotCount = 0;
		streamingInterval = setInterval(() => {
			readline.cursorTo(process.stdout, 0);
			process.stdout.write(
				`Receiving streaming response from Claude${'.'.repeat(dotCount)}`
			);
			dotCount = (dotCount + 1) % 4;
		}, 500);

		// Process the stream
		console.log(chalk.yellow('[DEBUG] Starting to process Claude stream'));
		try {
			let chunkCount = 0;
			let isProcessing = true;
			// Add a local check that gets set to false if SIGINT is received
			const originalSigintHandler = sigintHandler;

			// Enhance the SIGINT handler to set isProcessing to false
			sigintHandler = () => {
				isProcessing = false;

				// Call original handler to do the rest of cleanup and exit
				if (originalSigintHandler) originalSigintHandler();
			};

			for await (const chunk of stream) {
				// Check if we should stop processing (SIGINT received)
				if (!isProcessing) {
					break;
				}

				if (chunk.type === 'content_block_delta' && chunk.delta.text) {
					fullResponse += chunk.delta.text;
					chunkCount++;
				}
			}

			// Restore original handler if we didn't get interrupted
			if (isProcessing) {
				sigintHandler = originalSigintHandler;
			}
		} catch (streamError) {
			// Clean up the interval even if there's an error
			if (streamingInterval) {
				clearInterval(streamingInterval);
				streamingInterval = null;
			}

			throw streamError;
		}

		if (streamingInterval) clearInterval(streamingInterval);
		stopLoadingIndicator(loadingIndicator);

		log('info', 'Completed streaming response from Claude API!');
		log(
			'debug',
			`Streaming response length: ${fullResponse.length} characters`
		);

		// Parse the response - handle potential JSON formatting issues
		let taskData;
		try {
			// Check if the response is wrapped in a code block
			const jsonMatch = fullResponse.match(/```(?:json)?([^`]+)```/);
			const jsonContent = jsonMatch ? jsonMatch[1] : fullResponse;

			// Parse the JSON
			taskData = JSON.parse(jsonContent);

			// Check that we have the required fields
			if (!taskData.title || !taskData.description) {
				throw new Error('Missing required fields in the generated task');
			}
		} catch (error) {
			log(
				'error',
				"Failed to parse Claude's response as valid task JSON:",
				error
			);
			log('debug', 'Response content:', fullResponse);
			process.exit(1);
		}

		// Create the new task object
		const newTask = {
			id: newTaskId,
			title: taskData.title,
			description: taskData.description,
			status: 'pending',
			dependencies: dependencies,
			priority: priority,
			details: taskData.details || '',
			testStrategy:
				taskData.testStrategy ||
				'Manually verify the implementation works as expected.'
		};

		// Add the new task to the tasks array
		data.tasks.push(newTask);

		// Validate dependencies in the entire task set
		log('info', 'Validating dependencies after adding new task...');
		validateAndFixDependencies(data, null);

		// Write the updated tasks back to the file
		writeJSON(tasksPath, data);

		// Show success message
		const successBox = boxen(
			chalk.green(`Successfully added new task #${newTaskId}:\n`) +
				chalk.white.bold(newTask.title) +
				'\n\n' +
				chalk.white(newTask.description),
			{
				padding: 1,
				borderColor: 'green',
				borderStyle: 'round',
				margin: { top: 1 }
			}
		);
		console.log(successBox);

		// Next steps suggestion
		console.log(
			boxen(
				chalk.white.bold('Next Steps:') +
					'\n\n' +
					`${chalk.cyan('1.')} Run ${chalk.yellow('task-master generate')} to update task files\n` +
					`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=' + newTaskId)} to break it down into subtasks\n` +
					`${chalk.cyan('3.')} Run ${chalk.yellow('task-master list --with-subtasks')} to see all tasks`,
				{
					padding: 1,
					borderColor: 'cyan',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);

		return newTaskId;
	} catch (error) {
		if (streamingInterval) clearInterval(streamingInterval);
		stopLoadingIndicator(loadingIndicator);
		log('error', 'Error generating task:', error.message);
		process.exit(1);
	}
}

/**
 * Analyzes task complexity and generates expansion recommendations
 * @param {Object} options Command options
 */
async function analyzeTaskComplexity(options) {
	const tasksPath = options.file || 'tasks/tasks.json';
	const outputPath = options.output || 'scripts/task-complexity-report.json';
	const modelOverride = options.model;

	// Define streamingInterval at the top level of the function so the handler can access it
	let streamingInterval = null;
	// Track cancellation state
	let isCancelled = false;
	// Store original handler to restore later
	const originalSigintHandler = sigintHandler;

	// Add a debug listener at the process level to see if SIGINT is being received
	const debugSignalListener = () => {
		log('debug', 'SIGINT received by debug listener in analyzeTaskComplexity');
	};
	process.on('SIGINT', debugSignalListener);

	// Set up SIGINT (Control-C) handler to cancel the operation gracefully
	const registerSigintHandler = () => {
		// Only register if not already registered
		if (!sigintHandler) {
			sigintHandler = () => {
				log('debug', 'SIGINT handler executing for analyzeTaskComplexity');
				isCancelled = true;

				// Try to clear any intervals before exiting
				if (streamingInterval) {
					clearInterval(streamingInterval);
					streamingInterval = null;
					log('debug', 'Cleared streaming interval');
				}

				// Clear any terminal state
				process.stdout.write('\r\x1B[K'); // Clear current line

				console.log(chalk.yellow('\n\nAnalysis cancelled by user.'));

				// Make sure we remove our event listeners before exiting
				cleanupSigintHandler();

				// Show cursor (in case it was hidden)
				process.stdout.write('\u001B[?25h');

				// Use isCancelled flag to signal stopping and only exit in non-test mode
				if (process.env.NODE_ENV !== 'test') {
					setTimeout(() => {
						process.exit(0);
					}, 100);
				}
			};
			process.on('SIGINT', sigintHandler);
			log('debug', 'Registered SIGINT handler for analyzeTaskComplexity');
		}
	};

	// Clean up function to remove the handler when done
	const cleanupSigintHandler = () => {
		if (sigintHandler) {
			process.removeListener('SIGINT', sigintHandler);
			sigintHandler = originalSigintHandler; // Restore original handler if any
			log('debug', 'Removed SIGINT handler');
		}

		// Also remove the debug listener
		process.removeListener('SIGINT', debugSignalListener);
		log('debug', 'Removed debug SIGINT listener');
	};

	const thresholdScore = parseFloat(options.threshold || '5');
	const useResearch = options.research || false;

	// Initialize error tracking variable
	let apiError = false;
	let loadingIndicator = null;

	try {
		// Read tasks.json
		const tasksData = readJSON(tasksPath);

		if (
			!tasksData ||
			!tasksData.tasks ||
			!Array.isArray(tasksData.tasks) ||
			tasksData.tasks.length === 0
		) {
			throw new Error('No tasks found in the tasks file');
		}

		// Prepare the prompt for the LLM
		const prompt = generateComplexityAnalysisPrompt(tasksData);

		// Start loading indicator
		loadingIndicator = startLoadingIndicator(
			'Calling AI to analyze task complexity...'
		);

		let fullResponse = '';

		try {
			// If research flag is set, use Perplexity first
			if (useResearch) {
				try {
					// Register SIGINT handler to allow cancellation with Control-C
					registerSigintHandler();

					// Start tracking elapsed time and update information display
					const startTime = Date.now();
					const totalTaskCount = tasksData.tasks.length;

					// IMPORTANT: Stop the loading indicator before showing the progress bar
					if (loadingIndicator) {
						stopLoadingIndicator(loadingIndicator);
						loadingIndicator = null;
					}

					// Set up the progress data
					const progressData = {
						model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
						contextTokens: 0,
						elapsed: 0,
						temperature: CONFIG.temperature,
						tasksAnalyzed: 0,
						totalTasks: totalTaskCount,
						percentComplete: 0,
						maxTokens: CONFIG.maxTokens
					};

					// Estimate context tokens (rough approximation - 1 token ~= 4 chars)
					const estimatedContextTokens = Math.ceil(prompt.length / 4);
					progressData.contextTokens = estimatedContextTokens;

					// Display initial progress before API call begins
					displayAnalysisProgress(progressData);

					// Update progress display at regular intervals
					streamingInterval = setInterval(() => {
						// Check if cancelled
						if (isCancelled) {
							clearInterval(streamingInterval);
							streamingInterval = null;
							return;
						}

						// Update elapsed time
						progressData.elapsed = (Date.now() - startTime) / 1000;
						progressData.percentComplete = Math.min(
							90,
							(progressData.elapsed / 30) * 100
						); // Estimate based on typical 30s completion

						// Estimate number of tasks analyzed based on percentage
						progressData.tasksAnalyzed = Math.floor(
							(progressData.percentComplete / 100) * totalTaskCount
						);

						displayAnalysisProgress(progressData);
					}, 100);

					// Exit early if cancelled
					if (isCancelled) {
						throw new Error('Operation cancelled by user');
					}

					// Modify prompt to include more context for Perplexity and explicitly request JSON
					const researchPrompt = `You are conducting a detailed analysis of software development tasks to determine their complexity and how they should be broken down into subtasks.

Please research each task thoroughly, considering best practices, industry standards, and potential implementation challenges before providing your analysis.

CRITICAL: You MUST respond ONLY with a valid JSON array. Do not include ANY explanatory text, markdown formatting, or code block markers.

${prompt}

Your response must be a clean JSON array only, following exactly this format:
[
  {
    "taskId": 1,
    "taskTitle": "Example Task",
    "complexityScore": 7,
    "recommendedSubtasks": 4,
    "expansionPrompt": "Detailed prompt for expansion",
    "reasoning": "Explanation of complexity assessment"
  },
  // more tasks...
]

DO NOT include any text before or after the JSON array. No explanations, no markdown formatting.`;

					// Exit early if cancelled
					if (isCancelled) {
						throw new Error('Operation cancelled by user');
					}

					const result = await perplexity.chat.completions.create({
						model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
						messages: [
							{
								role: 'system',
								content:
									'You are a technical analysis AI that only responds with clean, valid JSON. Never include explanatory text or markdown formatting in your response.'
							},
							{
								role: 'user',
								content: researchPrompt
							}
						],
						temperature: CONFIG.temperature,
						max_tokens: CONFIG.maxTokens
					});

					// Exit early if cancelled
					if (isCancelled) {
						throw new Error('Operation cancelled by user');
					}

					// Extract the response text
					fullResponse = result.choices[0].message.content;
					console.log(
						chalk.green(
							'Successfully generated complexity analysis with Perplexity AI'
						)
					);

					// Clean up the interval
					if (streamingInterval) {
						clearInterval(streamingInterval);
						streamingInterval = null;
					}

					// Show completion
					progressData.percentComplete = 100;
					progressData.tasksAnalyzed = progressData.totalTasks;
					progressData.completed = true;
					displayAnalysisProgress(progressData);

					stopLoadingIndicator(loadingIndicator);

					// Log the first part of the response for debugging
					console.debug(chalk.gray('Response first 200 chars:'));
					console.debug(chalk.gray(fullResponse.substring(0, 200)));
				} catch (perplexityError) {
					// Check if this was a cancellation
					if (perplexityError.message === 'Operation cancelled by user') {
						log('info', 'Perplexity analysis cancelled');
						throw perplexityError; // Re-throw to exit the function
					}

					console.error(
						chalk.yellow('Falling back to Claude for complexity analysis...')
					);
					console.error(
						chalk.gray('Perplexity error:'),
						perplexityError.message
					);

					// Clean up
					if (streamingInterval) {
						clearInterval(streamingInterval);
						streamingInterval = null;
					}

					// Continue to Claude as fallback if not cancelled
					if (!isCancelled) {
						console.log(
							chalk.yellow(
								'\nFalling back to Claude after Perplexity error: ' +
									perplexityError.message
							)
						);
						await useClaudeForComplexityAnalysis();
					} else {
						throw new Error('Operation cancelled by user');
					}
				}
			} else {
				// Use Claude directly if research flag is not set
				await useClaudeForComplexityAnalysis();
			}

			// Helper function to use Claude for complexity analysis
			async function useClaudeForComplexityAnalysis() {
				// Register SIGINT handler to allow cancellation with Control-C
				registerSigintHandler();

				// Call the LLM API with streaming
				// Add try-catch for better error handling specifically for API call
				try {
					const stream = await anthropic.messages.create({
						max_tokens: CONFIG.maxTokens,
						model: modelOverride || CONFIG.model,
						temperature: CONFIG.temperature,
						messages: [{ role: 'user', content: prompt }],
						system:
							'You are an expert software architect and project manager analyzing task complexity. Respond only with valid JSON.',
						stream: true
					});

					// Stop the default loading indicator before showing our custom UI
					stopLoadingIndicator(loadingIndicator);

					// Start tracking elapsed time and update information display
					const startTime = Date.now();
					const totalTaskCount = tasksData.tasks.length;

					// Set up the progress data
					const progressData = {
						model: modelOverride || CONFIG.model,
						contextTokens: 0, // Will estimate based on prompt size
						elapsed: 0,
						temperature: CONFIG.temperature,
						tasksAnalyzed: 0,
						totalTasks: totalTaskCount,
						percentComplete: 0,
						maxTokens: CONFIG.maxTokens
					};

					// Estimate context tokens (rough approximation - 1 token ~= 4 chars)
					const estimatedContextTokens = Math.ceil(prompt.length / 4);
					progressData.contextTokens = estimatedContextTokens;

					// Display initial progress before streaming begins
					displayAnalysisProgress(progressData);

					// Update progress display at regular intervals
					streamingInterval = setInterval(() => {
						// Update elapsed time
						progressData.elapsed = (Date.now() - startTime) / 1000;

						// Estimate completion percentage based on response length
						if (fullResponse.length > 0) {
							// Estimate based on expected response size (approx. 500 chars per task)
							const expectedResponseSize = totalTaskCount * 500;
							const estimatedProgress = Math.min(
								95,
								(fullResponse.length / expectedResponseSize) * 100
							);
							progressData.percentComplete = estimatedProgress;

							// Estimate analyzed tasks based on JSON objects found
							const taskMatches = fullResponse.match(/"taskId"\s*:\s*\d+/g);
							if (taskMatches) {
								progressData.tasksAnalyzed = Math.min(
									totalTaskCount,
									taskMatches.length
								);
							}
						}

						// Display the progress information
						displayAnalysisProgress(progressData);
					}, 100); // Update much more frequently for smoother animation

					// Process the stream
					for await (const chunk of stream) {
						if (chunk.type === 'content_block_delta' && chunk.delta.text) {
							fullResponse += chunk.delta.text;
						}
					}

					// Clean up the interval - stop updating progress
					if (streamingInterval) {
						clearInterval(streamingInterval);
						streamingInterval = null;
					}

					// Show completion message immediately
					progressData.percentComplete = 100;
					progressData.elapsed = (Date.now() - startTime) / 1000;
					progressData.tasksAnalyzed = progressData.totalTasks;
					progressData.completed = true;
					progressData.contextTokens = Math.max(
						progressData.contextTokens,
						estimatedContextTokens
					); // Ensure the final token count is accurate
					displayAnalysisProgress(progressData);

					// Clear the line completely to remove any artifacts (after showing completion)
					process.stdout.write('\r\x1B[K'); // Clear current line
					process.stdout.write('\r'); // Move cursor to beginning of line
				} catch (apiError) {
					// Check if this was a cancellation
					if (apiError.message === 'Operation cancelled by user') {
						log('info', 'Claude analysis cancelled');
						throw apiError; // Re-throw to exit the function
					}

					// Handle specific API errors here
					if (streamingInterval) {
						clearInterval(streamingInterval);
						streamingInterval = null;
					}

					process.stdout.write('\r\x1B[K'); // Clear current line

					console.error(
						chalk.red(`\nAPI Error: ${apiError.message || 'Unknown error'}\n`)
					);
					console.log(
						chalk.yellow('This might be a temporary issue with the Claude API.')
					);
					console.log(
						chalk.yellow(
							'Please try again in a few moments or check your API key.'
						)
					);

					// Rethrow to be caught by outer handler
					throw apiError;
				}
			}

			// If cancelled at this point, exit before parsing
			if (isCancelled) {
				log('info', 'Analysis was cancelled. Not generating report.');
				return;
			}

			// Parse the JSON response
			console.log(chalk.blue(`  Parsing complexity analysis...`));
			let complexityAnalysis;
			try {
				// Clean up the response to ensure it's valid JSON
				let cleanedResponse = fullResponse;

				// First check for JSON code blocks (common in markdown responses)
				const codeBlockMatch = fullResponse.match(
					/```(?:json)?\s*([\s\S]*?)\s*```/
				);
				if (codeBlockMatch) {
					cleanedResponse = codeBlockMatch[1];
					console.debug(chalk.blue('Extracted JSON from code block'));
				} else {
					// Look for a complete JSON array pattern
					// This regex looks for an array of objects starting with [ and ending with ]
					const jsonArrayMatch = fullResponse.match(
						/(\[\s*\{\s*"[^"]*"\s*:[\s\S]*\}\s*\])/
					);
					if (jsonArrayMatch) {
						cleanedResponse = jsonArrayMatch[1];
						console.log(chalk.blue('  Extracted JSON array pattern'));
					} else {
						// Try to find the start of a JSON array and capture to the end
						const jsonStartMatch = fullResponse.match(/(\[\s*\{[\s\S]*)/);
						if (jsonStartMatch) {
							cleanedResponse = jsonStartMatch[1];
							// Try to find a proper closing to the array
							const properEndMatch = cleanedResponse.match(/([\s\S]*\}\s*\])/);
							if (properEndMatch) {
								cleanedResponse = properEndMatch[1];
							}
							console.log(
								chalk.blue('Extracted JSON from start of array to end')
							);
						}
					}
				}

				// Log the cleaned response for debugging
				console.debug(chalk.gray('Attempting to parse cleaned JSON...'));
				console.debug(chalk.gray('Cleaned response (first 100 chars):'));
				console.debug(chalk.gray(cleanedResponse.substring(0, 100)));
				console.debug(chalk.gray('Last 100 chars:'));
				console.debug(
					chalk.gray(cleanedResponse.substring(cleanedResponse.length - 100))
				);

				// More aggressive cleaning - strip any non-JSON content at the beginning or end
				const strictArrayMatch = cleanedResponse.match(
					/(\[\s*\{[\s\S]*\}\s*\])/
				);
				if (strictArrayMatch) {
					cleanedResponse = strictArrayMatch[1];
					console.debug(chalk.blue('Applied strict JSON array extraction'));
				}

				try {
					complexityAnalysis = JSON.parse(cleanedResponse);
				} catch (jsonError) {
					console.log(
						chalk.yellow(
							'Initial JSON parsing failed, attempting to fix common JSON issues...'
						)
					);

					// Try to fix common JSON issues
					// 1. Remove any trailing commas in arrays or objects
					cleanedResponse = cleanedResponse.replace(/,(\s*[\]}])/g, '$1');

					// 2. Ensure property names are double-quoted
					cleanedResponse = cleanedResponse.replace(
						/(\s*)(\w+)(\s*):(\s*)/g,
						'$1"$2"$3:$4'
					);

					// 3. Replace single quotes with double quotes for property values
					cleanedResponse = cleanedResponse.replace(
						/:(\s*)'([^']*)'(\s*[,}])/g,
						':$1"$2"$3'
					);

					// 4. Fix unterminated strings - common with LLM responses
					cleanedResponse = cleanedResponse.replace(
						/:(\s*)"([^"]*)(?=[,}])/g,
						':$1"$2"$3'
					);

					// 5. Fix multi-line strings by escaping newlines
					cleanedResponse = cleanedResponse.replace(
						/:(\s*)"([^"]*)\n([^"]*)"/g,
						':$1"$2\\n$3"'
					);

					// 6. Add more aggressive fixing for unterminated strings by scanning for unclosed quotes
					let fixedResponse = '';
					let inString = false;
					let lastCharWasEscape = false;

					for (let i = 0; i < cleanedResponse.length; i++) {
						const char = cleanedResponse[i];

						// Handle string boundaries and escaping
						if (char === '"' && !lastCharWasEscape) {
							inString = !inString;
						}

						// Check for end of property or object without closing quote
						if (
							inString &&
							(i === cleanedResponse.length - 1 ||
								(char === ',' && cleanedResponse[i + 1] === '"') ||
								(char === '}' && !lastCharWasEscape))
						) {
							// Close the string before the comma or brace
							fixedResponse += '"';
							inString = false;
						}

						fixedResponse += char;
						lastCharWasEscape = char === '\\' && !lastCharWasEscape;
					}

					// Ensure we're not still in a string at the end
					if (inString) {
						fixedResponse += '"';
					}

					// Try the fixed response
					try {
						complexityAnalysis = JSON.parse(fixedResponse);
						console.log(
							chalk.green('Successfully parsed JSON after aggressive fixing')
						);
					} catch (fixedJsonError) {
						console.log(
							chalk.red(
								'Failed to parse JSON even after fixes, attempting more aggressive cleanup...'
							)
						);

						// Try to extract and process each task individually
						try {
							const taskMatches = cleanedResponse.match(
								/\{\s*"taskId"\s*:\s*(\d+)[^}]*\}/g
							);
							if (taskMatches && taskMatches.length > 0) {
								console.log(
									chalk.yellow(
										`Found ${taskMatches.length} task objects, attempting to process individually`
									)
								);

								complexityAnalysis = [];
								for (const taskMatch of taskMatches) {
									try {
										// Try to parse each task object individually
										let fixedTask = taskMatch.replace(/,\s*$/, ''); // Remove trailing commas

										// Attempt to fix unterminated strings in each task
										fixedTask = fixedTask.replace(/"([^"]*?)(?=,|})/g, '"$1"');

										// Add missing quotes around values
										fixedTask = fixedTask.replace(
											/:\s*([^",{\[\s][^,}\]]*?)(?=,|})/g,
											':"$1"'
										);

										// Try to parse the fixed task
										try {
											const taskObj = JSON.parse(`${fixedTask}`);
											if (taskObj && taskObj.taskId) {
												// Ensure all required fields have valid values
												if (!taskObj.complexityScore) {
													taskObj.complexityScore = 5; // Default mid-level complexity
												}
												if (!taskObj.recommendedSubtasks) {
													taskObj.recommendedSubtasks = 3; // Default subtask count
												}
												complexityAnalysis.push(taskObj);
											}
										} catch (individualTaskError) {
											console.log(
												chalk.yellow(
													`Could not parse individual task: ${taskMatch.substring(0, 30)}...`
												)
											);

											// One last attempt - extract just the taskId and create a minimal object
											const idMatch = taskMatch.match(/"taskId"\s*:\s*(\d+)/);
											if (idMatch && idMatch[1]) {
												const taskId = parseInt(idMatch[1], 10);
												const titleMatch = taskMatch.match(
													/"taskTitle"\s*:\s*"([^"]*)"/
												);
												const title = titleMatch
													? titleMatch[1]
													: `Task ${taskId}`;

												// Create a minimal valid task analysis object
												complexityAnalysis.push({
													taskId: taskId,
													taskTitle: title,
													complexityScore: 5,
													recommendedSubtasks: 3,
													expansionPrompt: `Expand task ${taskId} into appropriate subtasks`,
													reasoning:
														'Analysis data was incomplete - using default values'
												});

												console.log(
													chalk.blue(
														`Created minimal analysis object for Task ${taskId}`
													)
												);
											}
										}
									} catch (taskParseError) {
										console.log(
											chalk.yellow(
												`Could not parse individual task: ${taskMatch.substring(0, 30)}...`
											)
										);
									}
								}

								if (complexityAnalysis.length > 0) {
									console.log(
										chalk.green(
											`Successfully parsed ${complexityAnalysis.length} tasks individually`
										)
									);
								} else {
									throw new Error('Could not parse any tasks individually');
								}
							} else {
								throw fixedJsonError;
							}
						} catch (individualError) {
							console.log(chalk.red('All parsing attempts failed'));
							throw jsonError; // throw the original error
						}
					}
				}

				// Ensure complexityAnalysis is an array
				if (!Array.isArray(complexityAnalysis)) {
					console.log(
						chalk.yellow(
							'Response is not an array, checking if it contains an array property...'
						)
					);

					// Handle the case where the response might be an object with an array property
					if (
						complexityAnalysis.tasks ||
						complexityAnalysis.analysis ||
						complexityAnalysis.results
					) {
						complexityAnalysis =
							complexityAnalysis.tasks ||
							complexityAnalysis.analysis ||
							complexityAnalysis.results;
					} else {
						// If no recognizable array property, wrap it as an array if it's an object
						if (
							typeof complexityAnalysis === 'object' &&
							complexityAnalysis !== null
						) {
							console.log(chalk.yellow('Converting object to array...'));
							complexityAnalysis = [complexityAnalysis];
						} else {
							throw new Error(
								'Response does not contain a valid array or object'
							);
						}
					}
				}

				// Final check to ensure we have an array
				if (!Array.isArray(complexityAnalysis)) {
					throw new Error('Failed to extract an array from the response');
				}

				// Check that we have an analysis for each task in the input file
				const taskIds = tasksData.tasks.map((t) => t.id);
				const analysisTaskIds = complexityAnalysis.map((a) => a.taskId);
				const missingTaskIds = taskIds.filter(
					(id) => !analysisTaskIds.includes(id)
				);

				if (missingTaskIds.length > 0) {
					console.log(
						chalk.yellow(
							`Missing analysis for ${missingTaskIds.length} tasks: ${missingTaskIds.join(', ')}`
						)
					);
					console.log(chalk.blue(`Attempting to analyze missing tasks...`));

					// Create a subset of tasksData with just the missing tasks
					const missingTasks = {
						meta: tasksData.meta,
						tasks: tasksData.tasks.filter((t) => missingTaskIds.includes(t.id))
					};

					// Generate a prompt for just the missing tasks
					const missingTasksPrompt =
						generateComplexityAnalysisPrompt(missingTasks);

					// Call the same AI model to analyze the missing tasks
					let missingAnalysisResponse = '';

					try {
						// Start a new loading indicator
						const missingTasksLoadingIndicator = startLoadingIndicator(
							'Analyzing missing tasks...'
						);

						// Use the same AI model as the original analysis
						if (useResearch) {
							// Register SIGINT handler again to make sure it's active for this phase
							registerSigintHandler();

							// Start tracking elapsed time for missing tasks
							const missingTasksStartTime = Date.now();

							// Stop the loading indicator before showing progress
							stopLoadingIndicator(missingTasksLoadingIndicator);

							// Set up progress tracking for missing tasks
							const missingProgressData = {
								model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
								contextTokens: 0,
								elapsed: 0,
								temperature: CONFIG.temperature,
								tasksAnalyzed: 0,
								totalTasks: missingTaskIds.length,
								percentComplete: 0,
								maxTokens: CONFIG.maxTokens
							};

							// Estimate context tokens
							const estimatedMissingContextTokens = Math.ceil(
								missingTasksPrompt.length / 4
							);
							missingProgressData.contextTokens = estimatedMissingContextTokens;

							// Display initial progress
							displayAnalysisProgress(missingProgressData);

							// Update progress display regularly
							const missingTasksInterval = setInterval(() => {
								missingProgressData.elapsed =
									(Date.now() - missingTasksStartTime) / 1000;
								missingProgressData.percentComplete = Math.min(
									90,
									(missingProgressData.elapsed / 20) * 100
								); // Estimate ~20s completion

								// Estimate number of tasks analyzed based on percentage
								missingProgressData.tasksAnalyzed = Math.floor(
									(missingProgressData.percentComplete / 100) *
										missingTaskIds.length
								);

								displayAnalysisProgress(missingProgressData);
							}, 100);

							// Create the same research prompt but for missing tasks
							const missingTasksResearchPrompt = `You are conducting a detailed analysis of software development tasks to determine their complexity and how they should be broken down into subtasks.

Please research each task thoroughly, considering best practices, industry standards, and potential implementation challenges before providing your analysis.

CRITICAL: You MUST respond ONLY with a valid JSON array. Do not include ANY explanatory text, markdown formatting, or code block markers.

${missingTasksPrompt}

Your response must be a clean JSON array only, following exactly this format:
[
  {
    "taskId": 1,
    "taskTitle": "Example Task",
    "complexityScore": 7,
    "recommendedSubtasks": 4,
    "expansionPrompt": "Detailed prompt for expansion",
    "reasoning": "Explanation of complexity assessment"
  },
  // more tasks...
]

DO NOT include any text before or after the JSON array. No explanations, no markdown formatting.`;

							try {
								const result = await perplexity.chat.completions.create({
									model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
									messages: [
										{
											role: 'system',
											content:
												'You are a technical analysis AI that only responds with clean, valid JSON. Never include explanatory text or markdown formatting in your response.'
										},
										{
											role: 'user',
											content: missingTasksResearchPrompt
										}
									],
									temperature: CONFIG.temperature,
									max_tokens: CONFIG.maxTokens
								});

								// Extract the response
								missingAnalysisResponse = result.choices[0].message.content;

								// Stop interval and show completion
								clearInterval(missingTasksInterval);
								missingProgressData.percentComplete = 100;
								missingProgressData.tasksAnalyzed =
									missingProgressData.totalTasks;
								missingProgressData.completed = true;
								displayAnalysisProgress(missingProgressData);
							} catch (error) {
								// Clean up on error
								if (missingTasksInterval) {
									clearInterval(missingTasksInterval);
								}
								throw error;
							} finally {
								// Always clean up SIGINT handler and interval
								cleanupSigintHandler();
								if (missingTasksInterval) {
									clearInterval(missingTasksInterval);
								}
							}
						} else {
							// Use Claude
							const stream = await anthropic.messages.create({
								max_tokens: CONFIG.maxTokens,
								model: modelOverride || CONFIG.model,
								temperature: CONFIG.temperature,
								messages: [{ role: 'user', content: missingTasksPrompt }],
								system:
									'You are an expert software architect and project manager analyzing task complexity. Respond only with valid JSON.',
								stream: true
							});

							// Process the stream
							for await (const chunk of stream) {
								if (chunk.type === 'content_block_delta' && chunk.delta.text) {
									missingAnalysisResponse += chunk.delta.text;
								}
							}
						}

						// Stop the loading indicator
						stopLoadingIndicator(missingTasksLoadingIndicator);

						// Parse the response using the same parsing logic as before
						let missingAnalysis;
						try {
							// Clean up the response to ensure it's valid JSON (using same logic as above)
							let cleanedResponse = missingAnalysisResponse;

							// Use the same JSON extraction logic as before
							// ... (code omitted for brevity, it would be the same as the original parsing)

							// First check for JSON code blocks
							const codeBlockMatch = missingAnalysisResponse.match(
								/```(?:json)?\s*([\s\S]*?)\s*```/
							);
							if (codeBlockMatch) {
								cleanedResponse = codeBlockMatch[1];
								console.debug(
									chalk.blue('Extracted JSON from code block for missing tasks')
								);
							} else {
								// Look for a complete JSON array pattern
								const jsonArrayMatch = missingAnalysisResponse.match(
									/(\[\s*\{\s*"[^"]*"\s*:[\s\S]*\}\s*\])/
								);
								if (jsonArrayMatch) {
									cleanedResponse = jsonArrayMatch[1];
									console.log(
										chalk.blue('Extracted JSON array pattern for missing tasks')
									);
								} else {
									// Try to find the start of a JSON array and capture to the end
									const jsonStartMatch =
										missingAnalysisResponse.match(/(\[\s*\{[\s\S]*)/);
									if (jsonStartMatch) {
										cleanedResponse = jsonStartMatch[1];
										// Try to find a proper closing to the array
										const properEndMatch =
											cleanedResponse.match(/([\s\S]*\}\s*\])/);
										if (properEndMatch) {
											cleanedResponse = properEndMatch[1];
										}
										console.log(
											chalk.blue(
												'Extracted JSON from start of array to end for missing tasks'
											)
										);
									}
								}
							}

							// More aggressive cleaning if needed
							const strictArrayMatch = cleanedResponse.match(
								/(\[\s*\{[\s\S]*\}\s*\])/
							);
							if (strictArrayMatch) {
								cleanedResponse = strictArrayMatch[1];
								console.log(
									chalk.blue(
										'Applied strict JSON array extraction for missing tasks'
									)
								);
							}

							try {
								missingAnalysis = JSON.parse(cleanedResponse);
							} catch (jsonError) {
								// Try to fix common JSON issues (same as before)
								cleanedResponse = cleanedResponse.replace(/,(\s*[\]}])/g, '$1');
								cleanedResponse = cleanedResponse.replace(
									/(\s*)(\w+)(\s*):(\s*)/g,
									'$1"$2"$3:$4'
								);
								cleanedResponse = cleanedResponse.replace(
									/:(\s*)'([^']*)'(\s*[,}])/g,
									':$1"$2"$3'
								);

								try {
									missingAnalysis = JSON.parse(cleanedResponse);
									console.log(
										chalk.green(
											'Successfully parsed JSON for missing tasks after fixing common issues'
										)
									);
								} catch (fixedJsonError) {
									// Try the individual task extraction as a last resort
									console.log(
										chalk.red(
											'Failed to parse JSON for missing tasks, attempting individual extraction...'
										)
									);

									const taskMatches = cleanedResponse.match(
										/\{\s*"taskId"\s*:\s*(\d+)[^}]*\}/g
									);
									if (taskMatches && taskMatches.length > 0) {
										console.log(
											chalk.yellow(
												`Found ${taskMatches.length} task objects, attempting to process individually`
											)
										);

										missingAnalysis = [];
										for (const taskMatch of taskMatches) {
											try {
												const fixedTask = taskMatch.replace(/,\s*$/, '');
												const taskObj = JSON.parse(`${fixedTask}`);
												if (taskObj && taskObj.taskId) {
													missingAnalysis.push(taskObj);
												}
											} catch (taskParseError) {
												console.log(
													chalk.yellow(
														`Could not parse individual task: ${taskMatch.substring(0, 30)}...`
													)
												);
											}
										}

										if (missingAnalysis.length === 0) {
											throw new Error('Could not parse any missing tasks');
										}
									} else {
										throw fixedJsonError;
									}
								}
							}

							// Ensure it's an array
							if (!Array.isArray(missingAnalysis)) {
								if (missingAnalysis && typeof missingAnalysis === 'object') {
									missingAnalysis = [missingAnalysis];
								} else {
									throw new Error(
										'Missing tasks analysis is not an array or object'
									);
								}
							}

							// Add the missing analyses to the main analysis array
							console.log(
								chalk.green(
									`Successfully analyzed ${missingAnalysis.length} missing tasks`
								)
							);
							complexityAnalysis = [...complexityAnalysis, ...missingAnalysis];

							// Re-check for missing tasks
							const updatedAnalysisTaskIds = complexityAnalysis.map(
								(a) => a.taskId
							);
							const stillMissingTaskIds = taskIds.filter(
								(id) => !updatedAnalysisTaskIds.includes(id)
							);

							if (stillMissingTaskIds.length > 0) {
								console.log(
									chalk.yellow(
										`Warning: Still missing analysis for ${stillMissingTaskIds.length} tasks: ${stillMissingTaskIds.join(', ')}`
									)
								);
							} else {
								console.log(
									chalk.green(`All tasks now have complexity analysis!`)
								);
							}
						} catch (error) {
							console.error(
								chalk.red(`Error analyzing missing tasks: ${error.message}`)
							);
							console.log(chalk.yellow(`Continuing with partial analysis...`));
						}
					} catch (error) {
						console.error(
							chalk.red(
								`Error during retry for missing tasks: ${error.message}`
							)
						);
						console.log(chalk.yellow(`Continuing with partial analysis...`));
					}
				}
			} catch (error) {
				console.error(
					chalk.red(`Failed to parse LLM response as JSON: ${error.message}`)
				);
				if (CONFIG.debug) {
					console.debug(chalk.gray(`Raw response: ${fullResponse}`));
				}
				throw new Error('Invalid response format from LLM. Expected JSON.');
			}

			// Create the final report
			const report = {
				meta: {
					generatedAt: new Date().toISOString(),
					tasksAnalyzed: tasksData.tasks.length,
					thresholdScore: thresholdScore,
					projectName: tasksData.meta?.projectName || 'Your Project Name',
					usedResearch: useResearch
				},
				complexityAnalysis: complexityAnalysis
			};

			// Write the report to file
			console.log(
				chalk.blue(`  Writing complexity report to ${outputPath}...`)
			);
			writeJSON(outputPath, report);

			console.log(
				chalk.green(
					`  Task complexity analysis complete. Report written to ${outputPath}`
				)
			);

			// Display a summary of findings
			const highComplexity = complexityAnalysis.filter(
				(t) => t.complexityScore >= 8
			).length;
			const mediumComplexity = complexityAnalysis.filter(
				(t) => t.complexityScore >= 5 && t.complexityScore < 8
			).length;
			const lowComplexity = complexityAnalysis.filter(
				(t) => t.complexityScore < 5
			).length;
			const totalAnalyzed = complexityAnalysis.length;

			// Only show summary if we didn't encounter an API error
			if (!apiError) {
				// Create a summary object for formatting
				const summary = {
					totalTasks: tasksData.tasks.length,
					analyzedTasks: totalAnalyzed,
					highComplexityCount: highComplexity,
					mediumComplexityCount: mediumComplexity,
					lowComplexityCount: lowComplexity,
					researchBacked: useResearch
				};

				// Use the new formatting function from UI module
				console.log(formatComplexitySummary(summary));
			}
		} catch (error) {
			if (streamingInterval) clearInterval(streamingInterval);
			stopLoadingIndicator(loadingIndicator);

			// Mark that we encountered an API error
			apiError = true;

			// Display a user-friendly error message
			console.error(
				chalk.red(`\nAPI Error: ${error.message || 'Unknown error'}\n`)
			);
			console.log(
				chalk.yellow('This might be a temporary issue with the Claude API.')
			);
			console.log(chalk.yellow('Please try again in a few moments.'));
			cleanupSigintHandler();

			// We'll continue with any tasks we might have analyzed before the error
		}
	} catch (error) {
		console.error(
			chalk.red(`Error analyzing task complexity: ${error.message}`)
		);

		// Clean up SIGINT handler
		cleanupSigintHandler();

		process.exit(1);
	} finally {
		// Always clean up resources, regardless of success or failure
		cleanupSigintHandler();

		if (streamingInterval) {
			clearInterval(streamingInterval);
			streamingInterval = null;
		}

		if (loadingIndicator) {
			stopLoadingIndicator(loadingIndicator);
			loadingIndicator = null;
		}

		// Clear any terminal artifacts
		process.stdout.write('\r\x1B[K');
	}
}

/**
 * Find the next pending task based on dependencies
 * @param {Object[]} tasks - The array of tasks
 * @returns {Object|null} The next task to work on or null if no eligible tasks
 */
function findNextTask(tasks) {
	// Get all completed task IDs
	const completedTaskIds = new Set(
		tasks
			.filter((t) => t.status === 'done' || t.status === 'completed')
			.map((t) => t.id)
	);

	// Filter for pending tasks whose dependencies are all satisfied
	const eligibleTasks = tasks.filter(
		(task) =>
			(task.status === 'pending' || task.status === 'in-progress') &&
			task.dependencies && // Make sure dependencies array exists
			task.dependencies.every((depId) => completedTaskIds.has(depId))
	);

	if (eligibleTasks.length === 0) {
		return null;
	}

	// Sort eligible tasks by:
	// 1. Priority (high > medium > low)
	// 2. Dependencies count (fewer dependencies first)
	// 3. ID (lower ID first)
	const priorityValues = { high: 3, medium: 2, low: 1 };

	const nextTask = eligibleTasks.sort((a, b) => {
		// Sort by priority first
		const priorityA = priorityValues[a.priority || 'medium'] || 2;
		const priorityB = priorityValues[b.priority || 'medium'] || 2;

		if (priorityB !== priorityA) {
			return priorityB - priorityA; // Higher priority first
		}

		// If priority is the same, sort by dependency count
		if (
			a.dependencies &&
			b.dependencies &&
			a.dependencies.length !== b.dependencies.length
		) {
			return a.dependencies.length - b.dependencies.length; // Fewer dependencies first
		}

		// If dependency count is the same, sort by ID
		return a.id - b.id; // Lower ID first
	})[0]; // Return the first (highest priority) task

	return nextTask;
}

/**
 * Add a subtask to a parent task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number|string} parentId - ID of the parent task
 * @param {number|string|null} existingTaskId - ID of an existing task to convert to subtask (optional)
 * @param {Object} newSubtaskData - Data for creating a new subtask (used if existingTaskId is null)
 * @param {boolean} generateFiles - Whether to regenerate task files after adding the subtask
 * @returns {Object} The newly created or converted subtask
 */
async function addSubtask(
	tasksPath,
	parentId,
	existingTaskId = null,
	newSubtaskData = null,
	generateFiles = true
) {
	try {
		log('info', `Adding subtask to parent task ${parentId}...`);

		// Read the existing tasks
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`Invalid or missing tasks file at ${tasksPath}`);
		}

		// Convert parent ID to number
		const parentIdNum = parseInt(parentId, 10);

		// Find the parent task
		const parentTask = data.tasks.find((t) => t.id === parentIdNum);
		if (!parentTask) {
			throw new Error(`Parent task with ID ${parentIdNum} not found`);
		}

		// Initialize subtasks array if it doesn't exist
		if (!parentTask.subtasks) {
			parentTask.subtasks = [];
		}

		let newSubtask;

		// Case 1: Convert an existing task to a subtask
		if (existingTaskId !== null) {
			const existingTaskIdNum = parseInt(existingTaskId, 10);

			// Find the existing task
			const existingTaskIndex = data.tasks.findIndex(
				(t) => t.id === existingTaskIdNum
			);
			if (existingTaskIndex === -1) {
				throw new Error(`Task with ID ${existingTaskIdNum} not found`);
			}

			const existingTask = data.tasks[existingTaskIndex];

			// Check if task is already a subtask
			if (existingTask.parentTaskId) {
				throw new Error(
					`Task ${existingTaskIdNum} is already a subtask of task ${existingTask.parentTaskId}`
				);
			}

			// Check for circular dependency
			if (existingTaskIdNum === parentIdNum) {
				throw new Error(`Cannot make a task a subtask of itself`);
			}

			// Check if parent task is a subtask of the task we're converting
			// This would create a circular dependency
			if (isTaskDependentOn(data.tasks, parentTask, existingTaskIdNum)) {
				throw new Error(
					`Cannot create circular dependency: task ${parentIdNum} is already a subtask or dependent of task ${existingTaskIdNum}`
				);
			}

			// Find the highest subtask ID to determine the next ID
			const highestSubtaskId =
				parentTask.subtasks.length > 0
					? Math.max(...parentTask.subtasks.map((st) => st.id))
					: 0;
			const newSubtaskId = highestSubtaskId + 1;

			// Clone the existing task to be converted to a subtask
			newSubtask = {
				...existingTask,
				id: newSubtaskId,
				parentTaskId: parentIdNum
			};

			// Add to parent's subtasks
			parentTask.subtasks.push(newSubtask);

			// Remove the task from the main tasks array
			data.tasks.splice(existingTaskIndex, 1);

			log(
				'info',
				`Converted task ${existingTaskIdNum} to subtask ${parentIdNum}.${newSubtaskId}`
			);
		}
		// Case 2: Create a new subtask
		else if (newSubtaskData) {
			// Find the highest subtask ID to determine the next ID
			const highestSubtaskId =
				parentTask.subtasks.length > 0
					? Math.max(...parentTask.subtasks.map((st) => st.id))
					: 0;
			const newSubtaskId = highestSubtaskId + 1;

			// Create the new subtask object
			newSubtask = {
				id: newSubtaskId,
				title: newSubtaskData.title,
				description: newSubtaskData.description || '',
				details: newSubtaskData.details || '',
				status: newSubtaskData.status || 'pending',
				dependencies: newSubtaskData.dependencies || [],
				parentTaskId: parentIdNum
			};

			// Add to parent's subtasks
			parentTask.subtasks.push(newSubtask);

			log('info', `Created new subtask ${parentIdNum}.${newSubtaskId}`);
		} else {
			throw new Error(
				'Either existingTaskId or newSubtaskData must be provided'
			);
		}

		// Write the updated tasks back to the file
		writeJSON(tasksPath, data);

		// Generate task files if requested
		if (generateFiles) {
			log('info', 'Regenerating task files...');
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));
		}

		return newSubtask;
	} catch (error) {
		log('error', `Error adding subtask: ${error.message}`);
		throw error;
	}
}

/**
 * Check if a task is dependent on another task (directly or indirectly)
 * Used to prevent circular dependencies
 * @param {Array} allTasks - Array of all tasks
 * @param {Object} task - The task to check
 * @param {number} targetTaskId - The task ID to check dependency against
 * @returns {boolean} Whether the task depends on the target task
 */
function isTaskDependentOn(allTasks, task, targetTaskId) {
	// If the task is a subtask, check if its parent is the target
	if (task.parentTaskId === targetTaskId) {
		return true;
	}

	// Check direct dependencies
	if (task.dependencies && task.dependencies.includes(targetTaskId)) {
		return true;
	}

	// Check dependencies of dependencies (recursive)
	if (task.dependencies) {
		for (const depId of task.dependencies) {
			const depTask = allTasks.find((t) => t.id === depId);
			if (depTask && isTaskDependentOn(allTasks, depTask, targetTaskId)) {
				return true;
			}
		}
	}

	// Check subtasks for dependencies
	if (task.subtasks) {
		for (const subtask of task.subtasks) {
			if (isTaskDependentOn(allTasks, subtask, targetTaskId)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Remove a subtask from its parent task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} subtaskId - ID of the subtask to remove in format "parentId.subtaskId"
 * @param {boolean} convertToTask - Whether to convert the subtask to a standalone task
 * @param {boolean} generateFiles - Whether to regenerate task files after removing the subtask
 * @returns {Object|null} The removed subtask if convertToTask is true, otherwise null
 */
async function removeSubtask(
	tasksPath,
	subtaskId,
	convertToTask = false,
	generateFiles = true
) {
	try {
		log('info', `Removing subtask ${subtaskId}...`);

		// Read the existing tasks
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`Invalid or missing tasks file at ${tasksPath}`);
		}

		// Parse the subtask ID (format: "parentId.subtaskId")
		if (!subtaskId.includes('.')) {
			throw new Error(
				`Invalid subtask ID format: ${subtaskId}. Expected format: "parentId.subtaskId"`
			);
		}

		const [parentIdStr, subtaskIdStr] = subtaskId.split('.');
		const parentId = parseInt(parentIdStr, 10);
		const subtaskIdNum = parseInt(subtaskIdStr, 10);

		// Find the parent task
		const parentTask = data.tasks.find((t) => t.id === parentId);
		if (!parentTask) {
			throw new Error(`Parent task with ID ${parentId} not found`);
		}

		// Check if parent has subtasks
		if (!parentTask.subtasks || parentTask.subtasks.length === 0) {
			throw new Error(`Parent task ${parentId} has no subtasks`);
		}

		// Find the subtask to remove
		const subtaskIndex = parentTask.subtasks.findIndex(
			(st) => st.id === subtaskIdNum
		);
		if (subtaskIndex === -1) {
			throw new Error(`Subtask ${subtaskId} not found`);
		}

		// Get a copy of the subtask before removing it
		const removedSubtask = { ...parentTask.subtasks[subtaskIndex] };

		// Remove the subtask from the parent
		parentTask.subtasks.splice(subtaskIndex, 1);

		// If parent has no more subtasks, remove the subtasks array
		if (parentTask.subtasks.length === 0) {
			delete parentTask.subtasks;
		}

		let convertedTask = null;

		// Convert the subtask to a standalone task if requested
		if (convertToTask) {
			log('info', `Converting subtask ${subtaskId} to a standalone task...`);

			// Find the highest task ID to determine the next ID
			const highestId = Math.max(...data.tasks.map((t) => t.id));
			const newTaskId = highestId + 1;

			// Create the new task from the subtask
			convertedTask = {
				id: newTaskId,
				title: removedSubtask.title,
				description: removedSubtask.description || '',
				details: removedSubtask.details || '',
				status: removedSubtask.status || 'pending',
				dependencies: removedSubtask.dependencies || [],
				priority: parentTask.priority || 'medium' // Inherit priority from parent
			};

			// Add the parent task as a dependency if not already present
			if (!convertedTask.dependencies.includes(parentId)) {
				convertedTask.dependencies.push(parentId);
			}

			// Add the converted task to the tasks array
			data.tasks.push(convertedTask);

			log('info', `Created new task ${newTaskId} from subtask ${subtaskId}`);
		} else {
			log('info', `Subtask ${subtaskId} deleted`);
		}

		// Write the updated tasks back to the file
		writeJSON(tasksPath, data);

		// Generate task files if requested
		if (generateFiles) {
			log('info', 'Regenerating task files...');
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));
		}

		return convertedTask;
	} catch (error) {
		log('error', `Error removing subtask: ${error.message}`);
		throw error;
	}
}

/**
 * Update a subtask by appending additional information to its description and details
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} subtaskId - ID of the subtask to update in format "parentId.subtaskId"
 * @param {string} prompt - Prompt for generating additional information
 * @param {boolean} useResearch - Whether to use Perplexity AI for research-backed updates
 * @returns {Object|null} - The updated subtask or null if update failed
 */
async function updateSubtaskById(
	tasksPath,
	subtaskId,
	prompt,
	useResearch = false
) {
	let loadingIndicator = null;
	try {
		log('info', `Updating subtask ${subtaskId} with prompt: "${prompt}"`);

		// Validate subtask ID format
		if (
			!subtaskId ||
			typeof subtaskId !== 'string' ||
			!subtaskId.includes('.')
		) {
			throw new Error(
				`Invalid subtask ID format: ${subtaskId}. Subtask ID must be in format "parentId.subtaskId"`
			);
		}

		// Validate prompt
		if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
			throw new Error(
				'Prompt cannot be empty. Please provide context for the subtask update.'
			);
		}

		// Prepare for fallback handling
		let claudeOverloaded = false;

		// Validate tasks file exists
		if (!fs.existsSync(tasksPath)) {
			throw new Error(`Tasks file not found at path: ${tasksPath}`);
		}

		// Read the tasks file
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(
				`No valid tasks found in ${tasksPath}. The file may be corrupted or have an invalid format.`
			);
		}

		// Parse parent and subtask IDs
		const [parentIdStr, subtaskIdStr] = subtaskId.split('.');
		const parentId = parseInt(parentIdStr, 10);
		const subtaskIdNum = parseInt(subtaskIdStr, 10);

		if (
			isNaN(parentId) ||
			parentId <= 0 ||
			isNaN(subtaskIdNum) ||
			subtaskIdNum <= 0
		) {
			throw new Error(
				`Invalid subtask ID format: ${subtaskId}. Both parent ID and subtask ID must be positive integers.`
			);
		}

		// Find the parent task
		const parentTask = data.tasks.find((task) => task.id === parentId);
		if (!parentTask) {
			throw new Error(
				`Parent task with ID ${parentId} not found. Please verify the task ID and try again.`
			);
		}

		// Find the subtask
		if (!parentTask.subtasks || !Array.isArray(parentTask.subtasks)) {
			throw new Error(`Parent task ${parentId} has no subtasks.`);
		}

		const subtask = parentTask.subtasks.find((st) => st.id === subtaskIdNum);
		if (!subtask) {
			throw new Error(
				`Subtask with ID ${subtaskId} not found. Please verify the subtask ID and try again.`
			);
		}

		// Check if subtask is already completed
		if (subtask.status === 'done' || subtask.status === 'completed') {
			log(
				'warn',
				`Subtask ${subtaskId} is already marked as done and cannot be updated`
			);
			console.log(
				boxen(
					chalk.yellow(
						`Subtask ${subtaskId} is already marked as ${subtask.status} and cannot be updated.`
					) +
						'\n\n' +
						chalk.white(
							'Completed subtasks are locked to maintain consistency. To modify a completed subtask, you must first:'
						) +
						'\n' +
						chalk.white('1. Change its status to "pending" or "in-progress"') +
						'\n' +
						chalk.white('2. Then run the update-subtask command'),
					{ padding: 1, borderColor: 'yellow', borderStyle: 'round' }
				)
			);
			return null;
		}

		// Show the subtask that will be updated
		const table = new Table({
			head: [
				chalk.cyan.bold('ID'),
				chalk.cyan.bold('Title'),
				chalk.cyan.bold('Status')
			],
			colWidths: [10, 55, 10]
		});

		table.push([
			subtaskId,
			truncate(subtask.title, 52),
			getStatusWithColor(subtask.status)
		]);

		console.log(
			boxen(chalk.white.bold(`Updating Subtask #${subtaskId}`), {
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round',
				margin: { top: 1, bottom: 0 }
			})
		);

		console.log(table.toString());

		// Start the loading indicator
		loadingIndicator = startLoadingIndicator(
			'Generating additional information with AI...'
		);

		// Create the system prompt (as before)
		const systemPrompt = `You are an AI assistant helping to update software development subtasks with additional information.
Given a subtask, you will provide additional details, implementation notes, or technical insights based on user request.
Focus only on adding content that enhances the subtask - don't repeat existing information.
Be technical, specific, and implementation-focused rather than general.
Provide concrete examples, code snippets, or implementation details when relevant.`;

		// Replace the old research/Claude code with the new model selection approach
		let additionalInformation = '';
		let modelAttempts = 0;
		const maxModelAttempts = 2; // Try up to 2 models before giving up

		while (modelAttempts < maxModelAttempts && !additionalInformation) {
			modelAttempts++; // Increment attempt counter at the start
			const isLastAttempt = modelAttempts >= maxModelAttempts;
			let modelType = null; // Declare modelType outside the try block

			try {
				// Get the best available model based on our current state
				const result = getAvailableAIModel({
					claudeOverloaded,
					requiresResearch: useResearch
				});
				modelType = result.type;
				const client = result.client;

				log(
					'info',
					`Attempt ${modelAttempts}/${maxModelAttempts}: Generating subtask info using ${modelType}`
				);
				// Update loading indicator text
				stopLoadingIndicator(loadingIndicator); // Stop previous indicator
				loadingIndicator = startLoadingIndicator(
					`Attempt ${modelAttempts}: Using ${modelType.toUpperCase()}...`
				);

				const subtaskData = JSON.stringify(subtask, null, 2);
				const userMessageContent = `Here is the subtask to enhance:\n${subtaskData}\n\nPlease provide additional information addressing this request:\n${prompt}\n\nReturn ONLY the new information to add - do not repeat existing content.`;

				if (modelType === 'perplexity') {
					// Construct Perplexity payload
					const perplexityModel = process.env.PERPLEXITY_MODEL || 'sonar-pro';
					const response = await client.chat.completions.create({
						model: perplexityModel,
						messages: [
							{ role: 'system', content: systemPrompt },
							{ role: 'user', content: userMessageContent }
						],
						temperature: parseFloat(
							process.env.TEMPERATURE || CONFIG.temperature
						),
						max_tokens: parseInt(process.env.MAX_TOKENS || CONFIG.maxTokens)
					});
					additionalInformation = response.choices[0].message.content.trim();
				} else {
					// Claude
					let responseText = '';
					let streamingInterval = null;
					let dotCount = 0;
					const readline = await import('readline');

					try {
						streamingInterval = setInterval(() => {
							readline.cursorTo(process.stdout, 0);
							process.stdout.write(
								`Receiving streaming response from Claude${'.'.repeat(dotCount)}`
							);
							dotCount = (dotCount + 1) % 4;
						}, 500);

						// Construct Claude payload
						const stream = await client.messages.create({
							model: CONFIG.model,
							max_tokens: CONFIG.maxTokens,
							temperature: CONFIG.temperature,
							system: systemPrompt,
							messages: [{ role: 'user', content: userMessageContent }],
							stream: true
						});

						for await (const chunk of stream) {
							if (chunk.type === 'content_block_delta' && chunk.delta.text) {
								responseText += chunk.delta.text;
							}
						}
					} finally {
						if (streamingInterval) clearInterval(streamingInterval);
						// Clear the loading dots line
						readline.cursorTo(process.stdout, 0);
						process.stdout.clearLine(0);
					}

					log(
						'info',
						`Completed streaming response from Claude API! (Attempt ${modelAttempts})`
					);
					additionalInformation = responseText.trim();
				}

				// Success - break the loop
				if (additionalInformation) {
					log(
						'info',
						`Successfully generated information using ${modelType} on attempt ${modelAttempts}.`
					);
					break;
				} else {
					// Handle case where AI gave empty response without erroring
					log(
						'warn',
						`AI (${modelType}) returned empty response on attempt ${modelAttempts}.`
					);
					if (isLastAttempt) {
						throw new Error(
							'AI returned empty response after maximum attempts.'
						);
					}
					// Allow loop to continue to try another model/attempt if possible
				}
			} catch (modelError) {
				const failedModel =
					modelType || modelError.modelType || 'unknown model';
				log(
					'warn',
					`Attempt ${modelAttempts} failed using ${failedModel}: ${modelError.message}`
				);

				// --- More robust overload check ---
				let isOverload = false;
				// Check 1: SDK specific property (common pattern)
				if (modelError.type === 'overloaded_error') {
					isOverload = true;
				}
				// Check 2: Check nested error property (as originally intended)
				else if (modelError.error?.type === 'overloaded_error') {
					isOverload = true;
				}
				// Check 3: Check status code if available (e.g., 429 Too Many Requests or 529 Overloaded)
				else if (modelError.status === 429 || modelError.status === 529) {
					isOverload = true;
				}
				// Check 4: Check the message string itself (less reliable)
				else if (modelError.message?.toLowerCase().includes('overloaded')) {
					isOverload = true;
				}
				// --- End robust check ---

				if (isOverload) {
					// Use the result of the check
					claudeOverloaded = true; // Mark Claude as overloaded for the *next* potential attempt
					if (!isLastAttempt) {
						log(
							'info',
							'Claude overloaded. Will attempt fallback model if available.'
						);
						// Stop the current indicator before continuing
						if (loadingIndicator) {
							stopLoadingIndicator(loadingIndicator);
							loadingIndicator = null; // Reset indicator
						}
						continue; // Go to next iteration of the while loop to try fallback
					} else {
						// It was the last attempt, and it failed due to overload
						log(
							'error',
							`Overload error on final attempt (${modelAttempts}/${maxModelAttempts}). No fallback possible.`
						);
						// Let the error be thrown after the loop finishes, as additionalInformation will be empty.
						// We don't throw immediately here, let the loop exit and the check after the loop handle it.
					} // <<<< ADD THIS CLOSING BRACE
				} else {
					// Error was NOT an overload
					// If it's not an overload, throw it immediately to be caught by the outer catch.
					log(
						'error',
						`Non-overload error on attempt ${modelAttempts}: ${modelError.message}`
					);
					throw modelError; // Re-throw non-overload errors immediately.
				}
			} // End inner catch
		} // End while loop

		// If loop finished without getting information
		if (!additionalInformation) {
			console.log(
				'>>> DEBUG: additionalInformation is falsy! Value:',
				additionalInformation
			); // <<< ADD THIS
			throw new Error(
				'Failed to generate additional information after all attempts.'
			);
		}

		console.log(
			'>>> DEBUG: Got additionalInformation:',
			additionalInformation.substring(0, 50) + '...'
		); // <<< ADD THIS

		// Create timestamp
		const currentDate = new Date();
		const timestamp = currentDate.toISOString();

		// Format the additional information with timestamp
		const formattedInformation = `\n\n<info added on ${timestamp}>\n${additionalInformation}\n</info added on ${timestamp}>`;
		console.log(
			'>>> DEBUG: formattedInformation:',
			formattedInformation.substring(0, 70) + '...'
		); // <<< ADD THIS

		// Append to subtask details and description
		console.log('>>> DEBUG: Subtask details BEFORE append:', subtask.details); // <<< ADD THIS
		if (subtask.details) {
			subtask.details += formattedInformation;
		} else {
			subtask.details = `${formattedInformation}`;
		}
		console.log('>>> DEBUG: Subtask details AFTER append:', subtask.details); // <<< ADD THIS

		if (subtask.description) {
			// Only append to description if it makes sense (for shorter updates)
			if (additionalInformation.length < 200) {
				console.log(
					'>>> DEBUG: Subtask description BEFORE append:',
					subtask.description
				); // <<< ADD THIS
				subtask.description += ` [Updated: ${currentDate.toLocaleDateString()}]`;
				console.log(
					'>>> DEBUG: Subtask description AFTER append:',
					subtask.description
				); // <<< ADD THIS
			}
		}

		// Update the subtask in the parent task (add log before write)
		// ... index finding logic ...
		console.log('>>> DEBUG: About to call writeJSON with updated data...'); // <<< ADD THIS
		// Write the updated tasks to the file
		writeJSON(tasksPath, data);
		console.log('>>> DEBUG: writeJSON call completed.'); // <<< ADD THIS

		log('success', `Successfully updated subtask ${subtaskId}`);

		// Generate individual task files
		await generateTaskFiles(tasksPath, path.dirname(tasksPath)); // <<< Maybe log after this too

		// Stop indicator *before* final console output
		stopLoadingIndicator(loadingIndicator);
		loadingIndicator = null;

		console.log(
			boxen(
				chalk.green(`Successfully updated subtask #${subtaskId}`) +
					'\n\n' +
					chalk.white.bold('Title:') +
					' ' +
					subtask.title +
					'\n\n' +
					chalk.white.bold('Information Added:') +
					'\n' +
					chalk.white(truncate(additionalInformation, 300, true)),
				{ padding: 1, borderColor: 'green', borderStyle: 'round' }
			)
		);

		return subtask;
	} catch (error) {
		// Outer catch block handles final errors after loop/attempts
		stopLoadingIndicator(loadingIndicator); // Ensure indicator is stopped on error
		loadingIndicator = null;
		log('error', `Error updating subtask: ${error.message}`);
		console.error(chalk.red(`Error: ${error.message}`));

		// ... (existing helpful error message logic based on error type) ...
		if (error.message?.includes('ANTHROPIC_API_KEY')) {
			console.log(
				chalk.yellow('\nTo fix this issue, set your Anthropic API key:')
			);
			console.log('  export ANTHROPIC_API_KEY=your_api_key_here');
		} else if (error.message?.includes('PERPLEXITY_API_KEY')) {
			console.log(chalk.yellow('\nTo fix this issue:'));
			console.log(
				'  1. Set your Perplexity API key: export PERPLEXITY_API_KEY=your_api_key_here'
			);
			console.log(
				'  2. Or run without the research flag: task-master update-subtask --id=<id> --prompt=\"...\"'
			);
		} else if (error.message?.includes('overloaded')) {
			// Catch final overload error
			console.log(
				chalk.yellow(
					'\nAI model overloaded, and fallback failed or was unavailable:'
				)
			);
			console.log('  1. Try again in a few minutes.');
			console.log('  2. Ensure PERPLEXITY_API_KEY is set for fallback.');
			console.log('  3. Consider breaking your prompt into smaller updates.');
		} else if (error.message?.includes('not found')) {
			console.log(chalk.yellow('\nTo fix this issue:'));
			console.log(
				'  1. Run task-master list --with-subtasks to see all available subtask IDs'
			);
			console.log(
				'  2. Use a valid subtask ID with the --id parameter in format \"parentId.subtaskId\"'
			);
		} else if (error.message?.includes('empty response from AI')) {
			console.log(
				chalk.yellow(
					'\nThe AI model returned an empty response. This might be due to the prompt or API issues. Try rephrasing or trying again later.'
				)
			);
		}

		if (CONFIG.debug) {
			console.error(error);
		}

		return null;
	} finally {
		// Final cleanup check for the indicator, although it should be stopped by now
		if (loadingIndicator) {
			stopLoadingIndicator(loadingIndicator);
		}
	}
}

// --- Implementation restored from upstream/next ---
/**
 * Remove a task or subtask by ID
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string|number} taskId - The ID of the task or subtask to remove
 */
async function removeTask(tasksPath, taskId) {
	try {
		// Read the tasks file
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Check if the task ID exists
		if (!taskExists(data.tasks, taskId)) {
			throw new Error(`Task with ID ${taskId} not found`);
		}

		// Handle subtask removal (e.g., '5.2')
		if (typeof taskId === 'string' && taskId.includes('.')) {
			const [parentTaskId, subtaskId] = taskId
				.split('.')
				.map((id) => parseInt(id, 10));

			// Find the parent task
			const parentTask = data.tasks.find((t) => t.id === parentTaskId);
			if (!parentTask || !parentTask.subtasks) {
				throw new Error(
					`Parent task with ID ${parentTaskId} or its subtasks not found`
				);
			}

			// Find the subtask to remove
			const subtaskIndex = parentTask.subtasks.findIndex(
				(st) => st.id === subtaskId
			);
			if (subtaskIndex === -1) {
				throw new Error(
					`Subtask with ID ${subtaskId} not found in parent task ${parentTaskId}`
				);
			}

			// Store the subtask info before removal for the result
			const removedSubtask = parentTask.subtasks[subtaskIndex];

			// Remove the subtask
			parentTask.subtasks.splice(subtaskIndex, 1);

			// Remove references to this subtask in other subtasks' dependencies
			if (parentTask.subtasks && parentTask.subtasks.length > 0) {
				parentTask.subtasks.forEach((subtask) => {
					if (
						subtask.dependencies &&
						subtask.dependencies.includes(subtaskId)
					) {
						subtask.dependencies = subtask.dependencies.filter(
							(depId) => depId !== subtaskId
						);
					}
				});
			}

			// Save the updated tasks
			writeJSON(tasksPath, data);

			// Generate updated task files
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));

			return removedSubtask;
		}

		// Handle top-level task removal
		const id = parseInt(taskId, 10);
		const taskIndex = data.tasks.findIndex((t) => t.id === id);
		if (taskIndex === -1) {
			throw new Error(`Task with ID ${id} not found`);
		}

		// Store the task info before removal for the result
		const removedTask = data.tasks[taskIndex];

		// Remove the task
		data.tasks.splice(taskIndex, 1);

		// Remove this task as a dependency from all other tasks
		data.tasks.forEach((task) => {
			if (task.dependencies && task.dependencies.includes(id)) {
				task.dependencies = task.dependencies.filter((depId) => depId !== id);
			}
			// Remove from subtasks' dependencies as well
			if (task.subtasks && task.subtasks.length > 0) {
				task.subtasks.forEach((subtask) => {
					if (subtask.dependencies && subtask.dependencies.includes(id)) {
						subtask.dependencies = subtask.dependencies.filter(
							(depId) => depId !== id
						);
					}
				});
			}
		});

		// Save the updated tasks
		writeJSON(tasksPath, data);

		// Generate updated task files
		await generateTaskFiles(tasksPath, path.dirname(tasksPath));

		return removedTask;
	} catch (error) {
		log('error', `Error removing task: ${error.message}`);
		throw error;
	}
}

// --- Stubs for missing exports from upstream/next ---
function generateSubtaskPrompt() {
	throw new Error('generateSubtaskPrompt is not implemented in this branch.');
}
function getSubtasksFromAI() {
	throw new Error('getSubtasksFromAI is not implemented in this branch.');
}
// Export task manager functions
export {
	parsePRD,
	updateTasks,
	updateTaskById,
	updateSubtaskById,
	generateTaskFiles,
	setTaskStatus,
	updateSingleTaskStatus,
	listTasks,
	expandTask,
	expandAllTasks,
	clearSubtasks,
	addTask,
	addSubtask,
	removeSubtask,
	findNextTask,
	analyzeTaskComplexity,
	removeTask,
	findTaskById,
	generateSubtaskPrompt,
	getSubtasksFromAI
};
