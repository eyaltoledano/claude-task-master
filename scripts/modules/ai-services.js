/**
 * ai-services.js
 * AI service interactions for the Task Master CLI
 */

// NOTE/TODO: Include the beta header output-128k-2025-02-19 in your API request to increase the maximum output token length to 128k tokens for Claude 3.7 Sonnet.

import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { CONFIG, log, sanitizePrompt, isSilentMode } from './utils.js';
import { startLoadingIndicator, stopLoadingIndicator } from './ui.js';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// Configure Anthropic client
const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
	// Add beta header for 128k token output
	defaultHeaders: {
		'anthropic-beta': 'output-128k-2025-02-19'
	}
});

// Lazy-loaded Perplexity client
let perplexity = null;

/**
 * Get or initialize the Perplexity client
 * @returns {OpenAI} Perplexity client
 */
function getPerplexityClient() {
	if (!perplexity) {
		if (!process.env.PERPLEXITY_API_KEY) {
			throw new Error(
				'PERPLEXITY_API_KEY environment variable is missing. Set it to use research-backed features.'
			);
		}
		perplexity = new OpenAI({
			apiKey: process.env.PERPLEXITY_API_KEY,
			baseURL: 'https://api.perplexity.ai'
		});
	}
	return perplexity;
}

/**
 * Get the best available AI model for a given operation
 * @param {Object} options - Options for model selection
 * @param {boolean} options.claudeOverloaded - Whether Claude is currently overloaded
 * @param {boolean} options.requiresResearch - Whether the operation requires research capabilities
 * @returns {Object} Selected model info with type and client
 */
function getAvailableAIModel(options = {}) {
	const { claudeOverloaded = false, requiresResearch = false } = options;

	// First choice: Perplexity if research is required and it's available
	if (requiresResearch && process.env.PERPLEXITY_API_KEY) {
		try {
			const client = getPerplexityClient();
			return { type: 'perplexity', client };
		} catch (error) {
			log('warn', `Perplexity not available: ${error.message}`);
			// Fall through to Claude
		}
	}

	// Second choice: Claude if not overloaded
	if (!claudeOverloaded && process.env.ANTHROPIC_API_KEY) {
		return { type: 'claude', client: anthropic };
	}

	// Third choice: Perplexity as Claude fallback (even if research not required)
	if (process.env.PERPLEXITY_API_KEY) {
		try {
			const client = getPerplexityClient();
			log('info', 'Claude is overloaded, falling back to Perplexity');
			return { type: 'perplexity', client };
		} catch (error) {
			log('warn', `Perplexity fallback not available: ${error.message}`);
			// Fall through to Claude anyway with warning
		}
	}

	// Last resort: Use Claude even if overloaded (might fail)
	if (process.env.ANTHROPIC_API_KEY) {
		if (claudeOverloaded) {
			log(
				'warn',
				'Claude is overloaded but no alternatives are available. Proceeding with Claude anyway.'
			);
		}
		return { type: 'claude', client: anthropic };
	}

	// No models available
	throw new Error(
		'No AI models available. Please set ANTHROPIC_API_KEY and/or PERPLEXITY_API_KEY.'
	);
}

/**
 * Handle Claude API errors with user-friendly messages
 * @param {Error} error - The error from Claude API
 * @returns {string} User-friendly error message
 */
function handleClaudeError(error) {
	// Check if it's a structured error response
	if (error.type === 'error' && error.error) {
		switch (error.error.type) {
			case 'overloaded_error':
				// Check if we can use Perplexity as a fallback
				if (process.env.PERPLEXITY_API_KEY) {
					return 'Claude is currently overloaded. Trying to fall back to Perplexity AI.';
				}
				return 'Claude is currently experiencing high demand and is overloaded. Please wait a few minutes and try again.';
			case 'rate_limit_error':
				return 'You have exceeded the rate limit. Please wait a few minutes before making more requests.';
			case 'invalid_request_error':
				return 'There was an issue with the request format. If this persists, please report it as a bug.';
			default:
				return `Claude API error: ${error.error.message}`;
		}
	}

	// Check for network/timeout errors
	if (error.message?.toLowerCase().includes('timeout')) {
		return 'The request to Claude timed out. Please try again.';
	}
	if (error.message?.toLowerCase().includes('network')) {
		return 'There was a network error connecting to Claude. Please check your internet connection and try again.';
	}

	// Default error message
	return `Error communicating with Claude: ${error.message}`;
}

/**
 * Call Claude to generate tasks from a PRD
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} retryCount - Retry count
 * @param {Object} options - Options object containing:
 *   - reportProgress: Function to report progress to MCP server (optional)
 *   - mcpLog: MCP logger object (optional)
 *   - session: Session object from MCP server (optional)
 * @param {Object} aiClient - AI client instance (optional - will use default if not provided)
 * @param {Object} modelConfig - Model configuration (optional)
 * @returns {Object} Claude's response
 */
async function callClaude(
	prdContent,
	prdPath,
	numTasks,
	retryCount = 0,
	{ reportProgress, mcpLog, session } = {},
	aiClient = null,
	modelConfig = null
) {
	try {
		log('info', 'Calling Claude...');

		// Build the system prompt
		const systemPrompt = `You are an AI assistant tasked with breaking down a Product Requirements Document (PRD) into a set of sequential development tasks. Your goal is to create exactly <num_tasks>${numTasks}</num_tasks> well-structured, actionable development tasks based on the PRD provided.

First, carefully read and analyze the attached PRD

Before creating the task list, work through the following steps inside <prd_breakdown> tags in your thinking block:

1. List the key components of the PRD
2. Identify the main features and functionalities described
3. Note any specific technical requirements or constraints mentioned
4. Outline a high-level sequence of tasks that would be needed to implement the PRD

Consider dependencies, maintainability, and the fact that you don't have access to any existing codebase. Balance between providing detailed task descriptions and maintaining a high-level perspective.

After your breakdown, create a JSON object containing an array of tasks and a metadata object. Each task should follow this structure:

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

Guidelines for creating tasks:
1. Number tasks from 1 to <num_tasks>${numTasks}</num_tasks>.
2. Make each task atomic and focused on a single responsibility.
3. Order tasks logically, considering dependencies and implementation sequence.
4. Start with setup and core functionality, then move to advanced features.
5. Provide a clear validation/testing approach for each task.
6. Set appropriate dependency IDs (tasks can only depend on lower-numbered tasks).
7. Assign priority based on criticality and dependency order.
8. Include detailed implementation guidance in the "details" field.
9. Strictly adhere to any specific requirements for libraries, database schemas, frameworks, tech stacks, or other implementation details mentioned in the PRD.
10. Fill in gaps left by the PRD while preserving all explicit requirements.
11. Provide the most direct path to implementation, avoiding over-engineering.

The final output should be valid JSON with this structure:

{
  "tasks": [
    {
      "id": 1,
      "title": "Example Task Title",
      "description": "Brief description of the task",
      "status": "pending",
      "dependencies": [0],
      "priority": "high",
      "details": "Detailed implementation guidance",
      "testStrategy": "Approach for validating this task"
    },
    // ... more tasks ...
  ],
  "metadata": {
    "projectName": "PRD Implementation",
    "totalTasks": <num_tasks>${numTasks}</num_tasks>,
    "sourceFile": "<prd_path>${prdPath}</prd_path>",
    "generatedAt": "YYYY-MM-DD"
  }
}

Remember to provide comprehensive task details that are LLM-friendly, consider dependencies and maintainability carefully, and keep in mind that you don't have the existing codebase as context. Aim for a balance between detailed guidance and high-level planning.

Your response should be valid JSON only, with no additional explanation or comments. Do not duplicate or rehash any of the work you did in the prd_breakdown section in your final output.`;

		// Use streaming request to handle large responses and show progress
		return await handleStreamingRequest(
			prdContent,
			prdPath,
			numTasks,
			modelConfig?.maxTokens || CONFIG.maxTokens,
			systemPrompt,
			{ reportProgress, mcpLog, session },
			aiClient || anthropic,
			modelConfig
		);
	} catch (error) {
		// Get user-friendly error message
		const userMessage = handleClaudeError(error);
		log('error', userMessage);

		// Retry logic for certain errors
		if (
			retryCount < 2 &&
			(error.error?.type === 'overloaded_error' ||
				error.error?.type === 'rate_limit_error' ||
				error.message?.toLowerCase().includes('timeout') ||
				error.message?.toLowerCase().includes('network'))
		) {
			const waitTime = (retryCount + 1) * 5000; // 5s, then 10s
			log(
				'info',
				`Waiting ${waitTime / 1000} seconds before retry ${retryCount + 1}/2...`
			);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
			return await callClaude(
				prdContent,
				prdPath,
				numTasks,
				retryCount + 1,
				{ reportProgress, mcpLog, session },
				aiClient,
				modelConfig
			);
		} else {
			console.error(chalk.red(userMessage));
			if (CONFIG.debug) {
				log('debug', 'Full error:', error);
			}
			throw new Error(userMessage);
		}
	}
}

/**
 * Handle streaming request to Claude
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} maxTokens - Maximum tokens
 * @param {string} systemPrompt - System prompt
 * @param {Object} options - Options object containing:
 *   - reportProgress: Function to report progress to MCP server (optional)
 *   - mcpLog: MCP logger object (optional)
 *   - session: Session object from MCP server (optional)
 * @param {Object} aiClient - AI client instance (optional - will use default if not provided)
 * @param {Object} modelConfig - Model configuration (optional)
 * @returns {Object} Claude's response
 */
async function handleStreamingRequest(
	prdContent,
	prdPath,
	numTasks,
	maxTokens,
	systemPrompt,
	{ reportProgress, mcpLog, session } = {},
	aiClient = null,
	modelConfig = null
) {
	// Determine output format based on mcpLog presence
	const outputFormat = mcpLog ? 'json' : 'text';

	// Create custom reporter that checks for MCP log and silent mode
	const report = (message, level = 'info') => {
		if (mcpLog) {
			mcpLog[level](message);
		} else if (!isSilentMode() && outputFormat === 'text') {
			// Only log to console if not in silent mode and outputFormat is 'text'
			log(level, message);
		}
	};

	// Only show loading indicators for text output (CLI)
	let loadingIndicator = null;
	if (outputFormat === 'text' && !isSilentMode()) {
		loadingIndicator = startLoadingIndicator('Generating tasks from PRD...');
	}

	if (reportProgress) {
		await reportProgress({ progress: 0 });
	}
	let responseText = '';
	let streamingInterval = null;

	try {
		// Use streaming for handling large responses
		const stream = await (aiClient || anthropic).messages.create({
			model:
				modelConfig?.model || session?.env?.ANTHROPIC_MODEL || CONFIG.model,
			max_tokens:
				modelConfig?.maxTokens || session?.env?.MAX_TOKENS || maxTokens,
			temperature:
				modelConfig?.temperature ||
				session?.env?.TEMPERATURE ||
				CONFIG.temperature,
			system: systemPrompt,
			messages: [
				{
					role: 'user',
					content: `Here's the Product Requirements Document (PRD) to break down into ${numTasks} tasks:\n\n${prdContent}`
				}
			],
			stream: true
		});

		// Update loading indicator to show streaming progress - only for text output
		if (outputFormat === 'text' && !isSilentMode()) {
			let dotCount = 0;
			const readline = await import('readline');
			streamingInterval = setInterval(() => {
				readline.cursorTo(process.stdout, 0);
				process.stdout.write(
					`Receiving streaming response from Claude${'.'.repeat(dotCount)}`
				);
				dotCount = (dotCount + 1) % 4;
			}, 500);
		}

		// Process the stream
		for await (const chunk of stream) {
			if (chunk.type === 'content_block_delta' && chunk.delta.text) {
				responseText += chunk.delta.text;
			}
			if (reportProgress) {
				await reportProgress({
					progress: (responseText.length / maxTokens) * 100
				});
			}
			if (mcpLog) {
				mcpLog.info(`Progress: ${(responseText.length / maxTokens) * 100}%`);
			}
		}

		if (streamingInterval) clearInterval(streamingInterval);

		// Only call stopLoadingIndicator if we started one
		if (loadingIndicator && outputFormat === 'text' && !isSilentMode()) {
			stopLoadingIndicator(loadingIndicator);
		}

		report(
			`Completed streaming response from ${aiClient ? 'provided' : 'default'} AI client!`,
			'info'
		);

		// Pass options to processClaudeResponse
		return processClaudeResponse(
			responseText,
			numTasks,
			0,
			prdContent,
			prdPath,
			{ reportProgress, mcpLog, session }
		);
	} catch (error) {
		if (streamingInterval) clearInterval(streamingInterval);

		// Only call stopLoadingIndicator if we started one
		if (loadingIndicator && outputFormat === 'text' && !isSilentMode()) {
			stopLoadingIndicator(loadingIndicator);
		}

		// Get user-friendly error message
		const userMessage = handleClaudeError(error);
		report(`Error: ${userMessage}`, 'error');

		// Only show console error for text output (CLI)
		if (outputFormat === 'text' && !isSilentMode()) {
			console.error(chalk.red(userMessage));
		}

		if (CONFIG.debug && outputFormat === 'text' && !isSilentMode()) {
			log('debug', 'Full error:', error);
		}

		throw new Error(userMessage);
	}
}

/**
 * Process Claude's response
 * @param {string} textContent - Text content from Claude
 * @param {number} numTasks - Number of tasks
 * @param {number} retryCount - Retry count
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @param {Object} options - Options object containing mcpLog etc.
 * @returns {Object} Processed response
 */
function processClaudeResponse(
	textContent,
	numTasks,
	retryCount,
	prdContent,
	prdPath,
	options = {}
) {
	const { mcpLog } = options;

	// Determine output format based on mcpLog presence
	const outputFormat = mcpLog ? 'json' : 'text';

	// Create custom reporter that checks for MCP log and silent mode
	const report = (message, level = 'info') => {
		if (mcpLog) {
			mcpLog[level](message);
		} else if (!isSilentMode() && outputFormat === 'text') {
			// Only log to console if not in silent mode and outputFormat is 'text'
			log(level, message);
		}
	};

	try {
		// Attempt to parse the JSON response
		let jsonStart = textContent.indexOf('{');
		let jsonEnd = textContent.lastIndexOf('}');

		if (jsonStart === -1 || jsonEnd === -1) {
			throw new Error("Could not find valid JSON in Claude's response");
		}

		let jsonContent = textContent.substring(jsonStart, jsonEnd + 1);
		let parsedData = JSON.parse(jsonContent);

		// Validate the structure of the generated tasks
		if (!parsedData.tasks || !Array.isArray(parsedData.tasks)) {
			throw new Error("Claude's response does not contain a valid tasks array");
		}

		// Ensure we have the correct number of tasks
		if (parsedData.tasks.length !== numTasks) {
			report(
				`Expected ${numTasks} tasks, but received ${parsedData.tasks.length}`,
				'warn'
			);
		}

		// Add metadata if missing
		if (!parsedData.metadata) {
			parsedData.metadata = {
				projectName: 'PRD Implementation',
				totalTasks: parsedData.tasks.length,
				sourceFile: prdPath,
				generatedAt: new Date().toISOString().split('T')[0]
			};
		}

		return parsedData;
	} catch (error) {
		report(`Error processing Claude's response: ${error.message}`, 'error');

		// Retry logic
		if (retryCount < 2) {
			report(`Retrying to parse response (${retryCount + 1}/2)...`, 'info');

			// Try again with Claude for a cleaner response
			if (retryCount === 1) {
				report('Calling Claude again for a cleaner response...', 'info');
				return callClaude(
					prdContent,
					prdPath,
					numTasks,
					retryCount + 1,
					options
				);
			}

			return processClaudeResponse(
				textContent,
				numTasks,
				retryCount + 1,
				prdContent,
				prdPath,
				options
			);
		} else {
			throw error;
		}
	}
}

/**
 * Generate subtasks for a task
 * @param {Object} task - Task to generate subtasks for
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {number} nextSubtaskId - Next subtask ID
 * @param {string} additionalContext - Additional context
 * @param {Object} options - Options object containing:
 *   - reportProgress: Function to report progress to MCP server (optional)
 *   - mcpLog: MCP logger object (optional)
 *   - session: Session object from MCP server (optional)
 * @returns {Array} Generated subtasks
 */
async function generateSubtasks(
	task,
	numSubtasks,
	nextSubtaskId,
	additionalContext = '',
	{ reportProgress, mcpLog, session } = {}
) {
	try {
		log(
			'info',
			`Generating ${numSubtasks} subtasks for task ${task.id}: ${task.title}`
		);

		const loadingIndicator = startLoadingIndicator(
			`Generating subtasks for task ${task.id}...`
		);
		let streamingInterval = null;
		let responseText = '';

		const systemPrompt = `You are an AI assistant helping with task breakdown for software development. 
You need to break down a high-level task into ${numSubtasks} specific subtasks that can be implemented one by one.

Subtasks should:
1. Be specific and actionable implementation steps
2. Follow a logical sequence
3. Each handle a distinct part of the parent task
4. Include clear guidance on implementation approach
5. Have appropriate dependency chains between subtasks
6. Collectively cover all aspects of the parent task

For each subtask, provide:
- A clear, specific title
- Detailed implementation steps
- Dependencies on previous subtasks
- Testing approach

Each subtask should be implementable in a focused coding session.`;

		const contextPrompt = additionalContext
			? `\n\nAdditional context to consider: ${additionalContext}`
			: '';

		const userPrompt = `Please break down this task into ${numSubtasks} specific, actionable subtasks:

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Current details: ${task.details || 'None provided'}
${contextPrompt}

Return exactly ${numSubtasks} subtasks with the following JSON structure:
[
  {
    "id": ${nextSubtaskId},
    "title": "First subtask title",
    "description": "Detailed description",
    "dependencies": [], 
    "details": "Implementation details"
  },
  ...more subtasks...
]

Note on dependencies: Subtasks can depend on other subtasks with lower IDs. Use an empty array if there are no dependencies.`;

		try {
			// Update loading indicator to show streaming progress
			let dotCount = 0;
			const readline = await import('readline');
			streamingInterval = setInterval(() => {
				readline.cursorTo(process.stdout, 0);
				process.stdout.write(
					`Generating subtasks for task ${task.id}${'.'.repeat(dotCount)}`
				);
				dotCount = (dotCount + 1) % 4;
			}, 500);

			// TODO: MOVE THIS TO THE STREAM REQUEST FUNCTION (DRY)

			// Use streaming API call
			const stream = await anthropic.messages.create({
				model: session?.env?.ANTHROPIC_MODEL || CONFIG.model,
				max_tokens: session?.env?.MAX_TOKENS || CONFIG.maxTokens,
				temperature: session?.env?.TEMPERATURE || CONFIG.temperature,
				system: systemPrompt,
				messages: [
					{
						role: 'user',
						content: userPrompt
					}
				],
				stream: true
			});

			// Process the stream
			for await (const chunk of stream) {
				if (chunk.type === 'content_block_delta' && chunk.delta.text) {
					responseText += chunk.delta.text;
				}
				if (reportProgress) {
					await reportProgress({
						progress: (responseText.length / CONFIG.maxTokens) * 100
					});
				}
				if (mcpLog) {
					mcpLog.info(
						`Progress: ${(responseText.length / CONFIG.maxTokens) * 100}%`
					);
				}
			}

			if (streamingInterval) clearInterval(streamingInterval);
			stopLoadingIndicator(loadingIndicator);

			log('info', `Completed generating subtasks for task ${task.id}`);

			return parseSubtasksFromText(
				responseText,
				nextSubtaskId,
				numSubtasks,
				task.id
			);
		} catch (error) {
			if (streamingInterval) clearInterval(streamingInterval);
			stopLoadingIndicator(loadingIndicator);
			throw error;
		}
	} catch (error) {
		log('error', `Error generating subtasks: ${error.message}`);
		throw error;
	}
}

/**
 * Generate subtasks with research from Perplexity
 * @param {Object} task - Task to generate subtasks for
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {number} nextSubtaskId - Next subtask ID
 * @param {string} additionalContext - Additional context
 * @param {Object} options - Options object containing:
 *   - reportProgress: Function to report progress to MCP server (optional)
 *   - mcpLog: MCP logger object (optional)
 *   - silentMode: Boolean to determine whether to suppress console output (optional)
 *   - session: Session object from MCP server (optional)
 * @returns {Array} Generated subtasks
 */
async function generateSubtasksWithPerplexity(
	task,
	numSubtasks = 3,
	nextSubtaskId = 1,
	additionalContext = '',
	{ reportProgress, mcpLog, silentMode, session } = {}
) {
	// Check both global silentMode and the passed parameter
	const isSilent =
		silentMode || (typeof silentMode === 'undefined' && isSilentMode());

	// Use mcpLog if provided, otherwise use regular log if not silent
	const logFn = mcpLog
		? (level, ...args) => mcpLog[level](...args)
		: (level, ...args) => !isSilent && log(level, ...args);

	try {
		// First, perform research to get context
		logFn('info', `Researching context for task ${task.id}: ${task.title}`);
		const perplexityClient = getPerplexityClient();

		const PERPLEXITY_MODEL =
			process.env.PERPLEXITY_MODEL ||
			session?.env?.PERPLEXITY_MODEL ||
			'sonar-pro';

		// Only create loading indicators if not in silent mode
		let researchLoadingIndicator = null;
		if (!isSilent) {
			researchLoadingIndicator = startLoadingIndicator(
				'Researching best practices with Perplexity AI...'
			);
		}

		// Formulate research query based on task
		const researchQuery = `I need to implement "${task.title}" which involves: "${task.description}". 
What are current best practices, libraries, design patterns, and implementation approaches? 
Include concrete code examples and technical considerations where relevant.`;

		// Query Perplexity for research
		const researchResponse = await perplexityClient.chat.completions.create({
			model: PERPLEXITY_MODEL,
			messages: [
				{
					role: 'user',
					content: researchQuery
				}
			],
			temperature: 0.1 // Lower temperature for more factual responses
		});

		const researchResult = researchResponse.choices[0].message.content;

		// Only stop loading indicator if it was created
		if (researchLoadingIndicator) {
			stopLoadingIndicator(researchLoadingIndicator);
		}

		logFn(
			'info',
			'Research completed, now generating subtasks with additional context'
		);

		// Use the research result as additional context for Claude to generate subtasks
		const combinedContext = `
RESEARCH FINDINGS:
${researchResult}

ADDITIONAL CONTEXT PROVIDED BY USER:
${additionalContext || 'No additional context provided.'}
`;

		// Now generate subtasks with Claude
		let loadingIndicator = null;
		if (!isSilent) {
			loadingIndicator = startLoadingIndicator(
				`Generating research-backed subtasks for task ${task.id}...`
			);
		}

		let streamingInterval = null;
		let responseText = '';

		const systemPrompt = `You are an AI assistant helping with task breakdown for software development.
You need to break down a high-level task into ${numSubtasks} specific subtasks that can be implemented one by one.

You have been provided with research on current best practices and implementation approaches.
Use this research to inform and enhance your subtask breakdown.

Subtasks should:
1. Be specific and actionable implementation steps
2. Follow a logical sequence
3. Each handle a distinct part of the parent task
4. Include clear guidance on implementation approach
5. Have appropriate dependency chains between subtasks
6. Collectively cover all aspects of the parent task

For each subtask, provide:
- A clear, specific title
- Detailed implementation steps that incorporate best practices from the research
- Dependencies on previous subtasks
- Testing approach

Each subtask should be implementable in a focused coding session.`;

		const userPrompt = `Please break down this task into ${numSubtasks} specific, well-researched, actionable subtasks:

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Current details: ${task.details || 'None provided'}

${combinedContext}

Return exactly ${numSubtasks} subtasks with the following JSON structure:
[
  {
    "id": ${nextSubtaskId},
    "title": "First subtask title",
    "description": "Detailed description incorporating research",
    "dependencies": [], 
    "details": "Implementation details with best practices"
  },
  ...more subtasks...
]

Note on dependencies: Subtasks can depend on other subtasks with lower IDs. Use an empty array if there are no dependencies.`;

		try {
			// Update loading indicator to show streaming progress
			// Only create if not in silent mode
			if (!isSilent) {
				let dotCount = 0;
				const readline = await import('readline');
				streamingInterval = setInterval(() => {
					readline.cursorTo(process.stdout, 0);
					process.stdout.write(
						`Generating research-backed subtasks for task ${task.id}${'.'.repeat(dotCount)}`
					);
					dotCount = (dotCount + 1) % 4;
				}, 500);
			}

			// Use streaming API call via our helper function
			responseText = await _handleAnthropicStream(
				anthropic,
				{
					model: session?.env?.ANTHROPIC_MODEL || CONFIG.model,
					max_tokens: session?.env?.MAX_TOKENS || CONFIG.maxTokens,
					temperature: session?.env?.TEMPERATURE || CONFIG.temperature,
					system: systemPrompt,
					messages: [{ role: 'user', content: userPrompt }]
				},
				{ reportProgress, mcpLog, silentMode },
				!isSilent // Only use CLI mode if not in silent mode
			);

			// Clean up
			if (streamingInterval) {
				clearInterval(streamingInterval);
				streamingInterval = null;
			}

			if (loadingIndicator) {
				stopLoadingIndicator(loadingIndicator);
				loadingIndicator = null;
			}

			logFn(
				'info',
				`Completed generating research-backed subtasks for task ${task.id}`
			);

			return parseSubtasksFromText(
				responseText,
				nextSubtaskId,
				numSubtasks,
				task.id
			);
		} catch (error) {
			// Clean up on error
			if (streamingInterval) {
				clearInterval(streamingInterval);
			}

			if (loadingIndicator) {
				stopLoadingIndicator(loadingIndicator);
			}

			throw error;
		}
	} catch (error) {
		logFn(
			'error',
			`Error generating research-backed subtasks: ${error.message}`
		);
		throw error;
	}
}

/**
 * Parse subtasks from Claude's response text
 * @param {string} text - Response text
 * @param {number} startId - Starting subtask ID
 * @param {number} expectedCount - Expected number of subtasks
 * @param {number} parentTaskId - Parent task ID
 * @returns {Array} Parsed subtasks
 * @throws {Error} If parsing fails or JSON is invalid
 */
function parseSubtasksFromText(text, startId, expectedCount, parentTaskId) {
	// Set default values for optional parameters
	startId = startId || 1;
	expectedCount = expectedCount || 2; // Default to 2 subtasks if not specified

	// Handle empty text case
	if (!text || text.trim() === '') {
		throw new Error('Empty text provided, cannot parse subtasks');
	}

	// Locate JSON array in the text
	const jsonStartIndex = text.indexOf('[');
	const jsonEndIndex = text.lastIndexOf(']');

	// If no valid JSON array found, throw error
	if (
		jsonStartIndex === -1 ||
		jsonEndIndex === -1 ||
		jsonEndIndex < jsonStartIndex
	) {
		throw new Error('Could not locate valid JSON array in the response');
	}

	// Extract and parse the JSON
	const jsonText = text.substring(jsonStartIndex, jsonEndIndex + 1);
	let subtasks;

	try {
		subtasks = JSON.parse(jsonText);
	} catch (parseError) {
		throw new Error(`Failed to parse JSON: ${parseError.message}`);
	}

	// Validate array
	if (!Array.isArray(subtasks)) {
		throw new Error('Parsed content is not an array');
	}

	// Log warning if count doesn't match expected
	if (expectedCount && subtasks.length !== expectedCount) {
		log(
			'warn',
			`Expected ${expectedCount} subtasks, but parsed ${subtasks.length}`
		);
	}

	// Normalize subtask IDs if they don't match
	subtasks = subtasks.map((subtask, index) => {
		// Assign the correct ID if it doesn't match
		if (!subtask.id || subtask.id !== startId + index) {
			log(
				'warn',
				`Correcting subtask ID from ${subtask.id || 'undefined'} to ${startId + index}`
			);
			subtask.id = startId + index;
		}

		// Convert dependencies to numbers if they are strings
		if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
			subtask.dependencies = subtask.dependencies.map((dep) => {
				return typeof dep === 'string' ? parseInt(dep, 10) : dep;
			});
		} else {
			subtask.dependencies = [];
		}

		// Ensure status is 'pending'
		subtask.status = 'pending';

		// Add parentTaskId if provided
		if (parentTaskId) {
			subtask.parentTaskId = parentTaskId;
		}

		return subtask;
	});

	return subtasks;
}

/**
 * Generate a prompt for complexity analysis
 * @param {Object} tasksData - Tasks data object containing tasks array
 * @returns {string} Generated prompt
 */
function generateComplexityAnalysisPrompt(tasksData) {
	return `Analyze the complexity of the following tasks and provide recommendations for subtask breakdown:

${tasksData.tasks
	.map(
		(task) => `
Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Details: ${task.details}
Dependencies: ${JSON.stringify(task.dependencies || [])}
Priority: ${task.priority || 'medium'}
`
	)
	.join('\n---\n')}

Analyze each task and return a JSON array with the following structure for each task:
[
  {
    "taskId": number,
    "taskTitle": string,
    "complexityScore": number (1-10),
    "recommendedSubtasks": number (${Math.max(3, CONFIG.defaultSubtasks - 1)}-${Math.min(8, CONFIG.defaultSubtasks + 2)}),
    "expansionPrompt": string (a specific prompt for generating good subtasks),
    "reasoning": string (brief explanation of your assessment)
  },
  ...
]

IMPORTANT: Make sure to include an analysis for EVERY task listed above, with the correct taskId matching each task's ID.
`;
}

/**
 * Handles streaming API calls to Anthropic (Claude)
 * This is a common helper function to standardize interaction with Anthropic's streaming API.
 *
 * @param {Anthropic} client - Initialized Anthropic client
 * @param {Object} params - Parameters for the API call
 * @param {string} params.model - Claude model to use (e.g., 'claude-3-opus-20240229')
 * @param {number} params.max_tokens - Maximum tokens for the response
 * @param {number} params.temperature - Temperature for model responses (0.0-1.0)
 * @param {string} [params.system] - Optional system prompt
 * @param {Array<Object>} params.messages - Array of messages to send
 * @param {Object} handlers - Progress and logging handlers
 * @param {Function} [handlers.reportProgress] - Optional progress reporting callback for MCP
 * @param {Object} [handlers.mcpLog] - Optional MCP logger object
 * @param {boolean} [handlers.silentMode] - Whether to suppress console output
 * @param {boolean} [cliMode=false] - Whether to show CLI-specific output like spinners
 * @returns {Promise<string>} The accumulated response text
 */
async function _handleAnthropicStream(
	client,
	params,
	{ reportProgress, mcpLog, silentMode } = {},
	cliMode = false
) {
	// Only set up loading indicator in CLI mode and not in silent mode
	let loadingIndicator = null;
	let streamingInterval = null;
	let responseText = '';

	// Check both the passed parameter and global silent mode using isSilentMode()
	const isSilent =
		silentMode || (typeof silentMode === 'undefined' && isSilentMode());

	// Only show CLI indicators if in cliMode AND not in silent mode
	const showCLIOutput = cliMode && !isSilent;

	if (showCLIOutput) {
		loadingIndicator = startLoadingIndicator(
			'Processing request with Claude AI...'
		);
	}

	try {
		// Validate required parameters
		if (!client) {
			throw new Error('Anthropic client is required');
		}

		if (
			!params.messages ||
			!Array.isArray(params.messages) ||
			params.messages.length === 0
		) {
			throw new Error('At least one message is required');
		}

		// Ensure the stream parameter is set
		const streamParams = {
			...params,
			stream: true
		};

		// Call Anthropic with streaming enabled
		const stream = await client.messages.create(streamParams);

		// Set up streaming progress indicator for CLI (only if not in silent mode)
		let dotCount = 0;
		if (showCLIOutput) {
			const readline = await import('readline');
			streamingInterval = setInterval(() => {
				readline.cursorTo(process.stdout, 0);
				process.stdout.write(
					`Receiving streaming response from Claude${'.'.repeat(dotCount)}`
				);
				dotCount = (dotCount + 1) % 4;
			}, 500);
		}

		// Process the stream
		let streamIterator = stream[Symbol.asyncIterator]();
		let streamDone = false;

		while (!streamDone) {
			try {
				const { done, value: chunk } = await streamIterator.next();

				// Check if we've reached the end of the stream
				if (done) {
					streamDone = true;
					continue;
				}

				// Process the chunk
				if (chunk && chunk.type === 'content_block_delta' && chunk.delta.text) {
					responseText += chunk.delta.text;
				}

				// Report progress - use only mcpLog in MCP context and avoid direct reportProgress calls
				const maxTokens = params.max_tokens || CONFIG.maxTokens;
				const progressPercent = Math.min(
					100,
					(responseText.length / maxTokens) * 100
				);

				// Only use reportProgress in CLI mode, not from MCP context, and not in silent mode
				if (reportProgress && !mcpLog && !isSilent) {
					await reportProgress({
						progress: progressPercent,
						total: maxTokens
					});
				}

				// Log progress if logger is provided (MCP mode)
				if (mcpLog) {
					mcpLog.info(
						`Progress: ${progressPercent}% (${responseText.length} chars generated)`
					);
				}
			} catch (iterError) {
				// Handle iteration errors
				if (mcpLog) {
					mcpLog.error(`Stream iteration error: ${iterError.message}`);
				} else if (!isSilent) {
					log('error', `Stream iteration error: ${iterError.message}`);
				}

				// If it's a "stream finished" error, just break the loop
				if (
					iterError.message?.includes('finished') ||
					iterError.message?.includes('closed')
				) {
					streamDone = true;
				} else {
					// For other errors, rethrow
					throw iterError;
				}
			}
		}

		// Cleanup - ensure intervals are cleared
		if (streamingInterval) {
			clearInterval(streamingInterval);
			streamingInterval = null;
		}

		if (loadingIndicator) {
			stopLoadingIndicator(loadingIndicator);
			loadingIndicator = null;
		}

		// Log completion
		if (mcpLog) {
			mcpLog.info('Completed streaming response from Claude API!');
		} else if (!isSilent) {
			log('info', 'Completed streaming response from Claude API!');
		}

		return responseText;
	} catch (error) {
		// Cleanup on error
		if (streamingInterval) {
			clearInterval(streamingInterval);
			streamingInterval = null;
		}

		if (loadingIndicator) {
			stopLoadingIndicator(loadingIndicator);
			loadingIndicator = null;
		}

		// Log the error
		if (mcpLog) {
			mcpLog.error(`Error in Anthropic streaming: ${error.message}`);
		} else if (!isSilent) {
			log('error', `Error in Anthropic streaming: ${error.message}`);
		}

		// Re-throw with context
		throw new Error(`Anthropic streaming error: ${error.message}`);
	}
}

/**
 * Parse a JSON task from Claude's response text
 * @param {string} responseText - The full response text from Claude
 * @returns {Object} Parsed task object
 * @throws {Error} If parsing fails or required fields are missing
 */
function parseTaskJsonResponse(responseText) {
	try {
		// Check if the response is wrapped in a code block
		const jsonMatch = responseText.match(/```(?:json)?([^`]+)```/);
		const jsonContent = jsonMatch ? jsonMatch[1].trim() : responseText;

		// Find the JSON object bounds
		const jsonStartIndex = jsonContent.indexOf('{');
		const jsonEndIndex = jsonContent.lastIndexOf('}');

		if (
			jsonStartIndex === -1 ||
			jsonEndIndex === -1 ||
			jsonEndIndex < jsonStartIndex
		) {
			throw new Error('Could not locate valid JSON object in the response');
		}

		// Extract and parse the JSON
		const jsonText = jsonContent.substring(jsonStartIndex, jsonEndIndex + 1);
		const taskData = JSON.parse(jsonText);

		// Validate required fields
		if (!taskData.title || !taskData.description) {
			throw new Error(
				'Missing required fields in the generated task (title or description)'
			);
		}

		return taskData;
	} catch (error) {
		if (error.name === 'SyntaxError') {
			throw new Error(
				`Failed to parse JSON: ${error.message} (Response content may be malformed)`
			);
		}
		throw error;
	}
}

/**
 * Builds system and user prompts for task creation
 * @param {string} prompt - User's description of the task to create
 * @param {string} contextTasks - Context string with information about related tasks
 * @param {Object} options - Additional options
 * @param {number} [options.newTaskId] - ID for the new task
 * @returns {Object} Object containing systemPrompt and userPrompt
 */
function _buildAddTaskPrompt(prompt, contextTasks, { newTaskId } = {}) {
	// Create the system prompt for Claude
	const systemPrompt =
		"You are a helpful assistant that creates well-structured tasks for a software development project. Generate a single new task based on the user's description.";

	const taskStructure = `
  {
    "title": "Task title goes here",
    "description": "A concise one or two sentence description of what the task involves",
    "details": "In-depth details including specifics on implementation, considerations, and anything important for the developer to know. This should be detailed enough to guide implementation.",
    "testStrategy": "A detailed approach for verifying the task has been correctly implemented. Include specific test cases or validation methods."
  }`;

	const taskIdInfo = newTaskId ? `(Task #${newTaskId})` : '';
	const userPrompt = `Create a comprehensive new task ${taskIdInfo} for a software development project based on this description: "${prompt}"
  
  ${contextTasks}
  
  Return your answer as a single JSON object with the following structure:
  ${taskStructure}
  
  Don't include the task ID, status, dependencies, or priority as those will be added automatically.
  Make sure the details and test strategy are thorough and specific.
  
  IMPORTANT: Return ONLY the JSON object, nothing else.`;

	return { systemPrompt, userPrompt };
}

/**
 * Get an Anthropic client instance
 * @param {Object} [session] - Optional session object from MCP
 * @returns {Anthropic} Anthropic client instance
 */
function getAnthropicClient(session) {
	// If we already have a global client and no session, use the global
	if (!session && anthropic) {
		return anthropic;
	}

	// Initialize a new client with API key from session or environment
	const apiKey =
		session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

	if (!apiKey) {
		throw new Error(
			'ANTHROPIC_API_KEY environment variable is missing. Set it to use AI features.'
		);
	}

	return new Anthropic({
		apiKey: apiKey,
		// Add beta header for 128k token output
		defaultHeaders: {
			'anthropic-beta': 'output-128k-2025-02-19'
		}
	});
}

/**
 * Generate a detailed task description using Perplexity AI for research
 * @param {string} prompt - Task description prompt
 * @param {Object} options - Options for generation
 * @param {function} options.reportProgress - Function to report progress
 * @param {Object} options.mcpLog - MCP logger object
 * @param {Object} options.session - Session object from MCP server
 * @returns {Object} - The generated task description
 */
async function generateTaskDescriptionWithPerplexity(
	prompt,
	{ reportProgress, mcpLog, session } = {}
) {
	try {
		// First, perform research to get context
		log('info', `Researching context for task prompt: "${prompt}"`);
		const perplexityClient = getPerplexityClient();

		const PERPLEXITY_MODEL =
			process.env.PERPLEXITY_MODEL ||
			session?.env?.PERPLEXITY_MODEL ||
			'sonar-pro';
		const researchLoadingIndicator = startLoadingIndicator(
			'Researching best practices with Perplexity AI...'
		);

		// Formulate research query based on task prompt
		const researchQuery = `I need to implement: "${prompt}". 
What are current best practices, libraries, design patterns, and implementation approaches? 
Include concrete code examples and technical considerations where relevant.`;

		// Query Perplexity for research
		const researchResponse = await perplexityClient.chat.completions.create({
			model: PERPLEXITY_MODEL,
			messages: [
				{
					role: 'user',
					content: researchQuery
				}
			],
			temperature: 0.1 // Lower temperature for more factual responses
		});

		const researchResult = researchResponse.choices[0].message.content;

		stopLoadingIndicator(researchLoadingIndicator);
		log('info', 'Research completed, now generating detailed task description');

		// Now generate task description with Claude
		const loadingIndicator = startLoadingIndicator(
			`Generating research-backed task description...`
		);
		let streamingInterval = null;
		let responseText = '';

		const systemPrompt = `You are an AI assistant helping with task definition for software development.
You need to create a detailed task definition based on a brief prompt.

You have been provided with research on current best practices and implementation approaches.
Use this research to inform and enhance your task description.

Your task description should include:
1. A clear, specific title
2. A concise description of what the task involves
3. Detailed implementation guidelines incorporating best practices from the research
4. A testing strategy for verifying correct implementation`;

		const userPrompt = `Please create a detailed task description based on this prompt:

"${prompt}"

RESEARCH FINDINGS:
${researchResult}

Return a JSON object with the following structure:
{
  "title": "Clear task title",
  "description": "Concise description of what the task involves",
  "details": "In-depth implementation details including specifics on approaches, libraries, and considerations",
  "testStrategy": "A detailed approach for verifying the task has been correctly implemented"
}`;

		try {
			// Update loading indicator to show streaming progress
			let dotCount = 0;
			const readline = await import('readline');
			streamingInterval = setInterval(() => {
				readline.cursorTo(process.stdout, 0);
				process.stdout.write(
					`Generating research-backed task description${'.'.repeat(dotCount)}`
				);
				dotCount = (dotCount + 1) % 4;
			}, 500);

			// Use streaming API call
			const stream = await anthropic.messages.create({
				model: session?.env?.ANTHROPIC_MODEL || CONFIG.model,
				max_tokens: session?.env?.MAX_TOKENS || CONFIG.maxTokens,
				temperature: session?.env?.TEMPERATURE || CONFIG.temperature,
				system: systemPrompt,
				messages: [
					{
						role: 'user',
						content: userPrompt
					}
				],
				stream: true
			});

			// Process the stream
			for await (const chunk of stream) {
				if (chunk.type === 'content_block_delta' && chunk.delta.text) {
					responseText += chunk.delta.text;
				}
				if (reportProgress) {
					await reportProgress({
						progress: (responseText.length / CONFIG.maxTokens) * 100
					});
				}
				if (mcpLog) {
					mcpLog.info(
						`Progress: ${(responseText.length / CONFIG.maxTokens) * 100}%`
					);
				}
			}

			if (streamingInterval) clearInterval(streamingInterval);
			stopLoadingIndicator(loadingIndicator);

			log('info', `Completed generating research-backed task description`);

			return parseTaskJsonResponse(responseText);
		} catch (error) {
			if (streamingInterval) clearInterval(streamingInterval);
			stopLoadingIndicator(loadingIndicator);
			throw error;
		}
	} catch (error) {
		log(
			'error',
			`Error generating research-backed task description: ${error.message}`
		);
		throw error;
	}
}

/**
 * Get a configured Anthropic client for MCP
 * @param {Object} session - Session object from MCP
 * @param {Object} log - Logger object
 * @returns {Anthropic} - Configured Anthropic client
 */
function getConfiguredAnthropicClient(session = null, customEnv = null) {
	// If we have a session with ANTHROPIC_API_KEY in env, use that
	const apiKey =
		session?.env?.ANTHROPIC_API_KEY ||
		process.env.ANTHROPIC_API_KEY ||
		customEnv?.ANTHROPIC_API_KEY;

	if (!apiKey) {
		throw new Error(
			'ANTHROPIC_API_KEY environment variable is missing. Set it to use AI features.'
		);
	}

	return new Anthropic({
		apiKey: apiKey,
		// Add beta header for 128k token output
		defaultHeaders: {
			'anthropic-beta': 'output-128k-2025-02-19'
		}
	});
}

/**
 * Send a chat request to Claude with context management
 * @param {Object} client - Anthropic client
 * @param {Object} params - Chat parameters
 * @param {Object} options - Options containing reportProgress, mcpLog, silentMode, and session
 * @returns {string} - Response text
 */
async function sendChatWithContext(
	client,
	params,
	{ reportProgress, mcpLog, silentMode, session } = {}
) {
	// Use the streaming helper to get the response
	return await _handleAnthropicStream(
		client,
		params,
		{ reportProgress, mcpLog, silentMode },
		false
	);
}

/**
 * Parse tasks data from Claude's completion
 * @param {string} completionText - Text from Claude completion
 * @returns {Array} - Array of parsed tasks
 */
function parseTasksFromCompletion(completionText) {
	try {
		// Find JSON in the response
		const jsonMatch = completionText.match(/```(?:json)?([^`]+)```/);
		let jsonContent = jsonMatch ? jsonMatch[1].trim() : completionText;

		// Find opening/closing brackets if not in code block
		if (!jsonMatch) {
			const startIdx = jsonContent.indexOf('[');
			const endIdx = jsonContent.lastIndexOf(']');
			if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
				jsonContent = jsonContent.substring(startIdx, endIdx + 1);
			}
		}

		// Parse the JSON
		const tasks = JSON.parse(jsonContent);

		// Validate it's an array
		if (!Array.isArray(tasks)) {
			throw new Error('Parsed content is not a valid task array');
		}

		return tasks;
	} catch (error) {
		throw new Error(`Failed to parse tasks from completion: ${error.message}`);
	}
}

// Export AI service functions
export {
	getAnthropicClient,
	getPerplexityClient,
	callClaude,
	handleStreamingRequest,
	processClaudeResponse,
	generateSubtasks,
	generateSubtasksWithPerplexity,
	generateTaskDescriptionWithPerplexity,
	parseSubtasksFromText,
	generateComplexityAnalysisPrompt,
	handleClaudeError,
	getAvailableAIModel,
	parseTaskJsonResponse,
	_buildAddTaskPrompt,
	_handleAnthropicStream,
	getConfiguredAnthropicClient,
	sendChatWithContext,
	parseTasksFromCompletion
};
