/**
 * research.js
 * Core research functionality for AI-powered queries with project context
 */

import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import { highlight } from 'cli-highlight';
import { ContextGatherer } from '../utils/contextGatherer.js';
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';
import { generateTextService } from '../ai-services-unified.js';
import { log as consoleLog, findProjectRoot, readJSON } from '../utils.js';
import {
	displayAiUsageSummary,
	startLoadingIndicator,
	stopLoadingIndicator
} from '../ui.js';

/**
 * Perform AI-powered research with project context
 * @param {string} query - Research query/prompt
 * @param {Object} options - Research options
 * @param {Array<string>} [options.taskIds] - Task/subtask IDs for context
 * @param {Array<string>} [options.filePaths] - File paths for context
 * @param {string} [options.customContext] - Additional custom context
 * @param {boolean} [options.includeProjectTree] - Include project file tree
 * @param {string} [options.detailLevel] - Detail level: 'low', 'medium', 'high'
 * @param {string} [options.projectRoot] - Project root directory
 * @param {Object} [context] - Execution context
 * @param {Object} [context.session] - MCP session object
 * @param {Object} [context.mcpLog] - MCP logger object
 * @param {string} [context.commandName] - Command name for telemetry
 * @param {string} [context.outputType] - Output type ('cli' or 'mcp')
 * @param {string} [outputFormat] - Output format ('text' or 'json')
 * @param {boolean} [allowFollowUp] - Whether to allow follow-up questions (default: true)
 * @returns {Promise<Object>} Research results with telemetry data
 */
async function performResearch(
	query,
	options = {},
	context = {},
	outputFormat = 'text',
	allowFollowUp = true
) {
	const {
		taskIds = [],
		filePaths = [],
		customContext = '',
		includeProjectTree = false,
		detailLevel = 'medium',
		projectRoot: providedProjectRoot
	} = options;

	const {
		session,
		mcpLog,
		commandName = 'research',
		outputType = 'cli'
	} = context;
	const isMCP = !!mcpLog;

	// Determine project root
	const projectRoot = providedProjectRoot || findProjectRoot();
	if (!projectRoot) {
		throw new Error('Could not determine project root directory');
	}

	// Create consistent logger
	const logFn = isMCP
		? mcpLog
		: {
				info: (...args) => consoleLog('info', ...args),
				warn: (...args) => consoleLog('warn', ...args),
				error: (...args) => consoleLog('error', ...args),
				debug: (...args) => consoleLog('debug', ...args),
				success: (...args) => consoleLog('success', ...args)
			};

	// Show UI banner for CLI mode
	if (outputFormat === 'text') {
		console.log(
			boxen(chalk.cyan.bold(`🔍 AI Research Query`), {
				padding: 1,
				borderColor: 'cyan',
				borderStyle: 'round',
				margin: { top: 1, bottom: 1 }
			})
		);
	}

	try {
		// Initialize context gatherer
		const contextGatherer = new ContextGatherer(projectRoot);

		// Auto-discover relevant tasks using fuzzy search to supplement provided tasks
		let finalTaskIds = [...taskIds]; // Start with explicitly provided tasks
		let autoDiscoveredIds = [];

		try {
			const tasksPath = path.join(projectRoot, 'tasks', 'tasks.json');
			const tasksData = await readJSON(tasksPath);

			if (tasksData && tasksData.tasks && tasksData.tasks.length > 0) {
				// Flatten tasks to include subtasks for fuzzy search
				const flattenedTasks = flattenTasksWithSubtasks(tasksData.tasks);
				const fuzzySearch = new FuzzyTaskSearch(flattenedTasks, 'research');
				const searchResults = fuzzySearch.findRelevantTasks(query, {
					maxResults: 8,
					includeRecent: true,
					includeCategoryMatches: true
				});

				autoDiscoveredIds = fuzzySearch.getTaskIds(searchResults);

				// Remove any auto-discovered tasks that were already explicitly provided
				const uniqueAutoDiscovered = autoDiscoveredIds.filter(
					(id) => !finalTaskIds.includes(id)
				);

				// Add unique auto-discovered tasks to the final list
				finalTaskIds = [...finalTaskIds, ...uniqueAutoDiscovered];

				if (outputFormat === 'text' && finalTaskIds.length > 0) {
					// Sort task IDs numerically for better display
					const sortedTaskIds = finalTaskIds
						.map((id) => parseInt(id))
						.sort((a, b) => a - b)
						.map((id) => id.toString());

					// Show different messages based on whether tasks were explicitly provided
					if (taskIds.length > 0) {
						const sortedProvidedIds = taskIds
							.map((id) => parseInt(id))
							.sort((a, b) => a - b)
							.map((id) => id.toString());

						console.log(
							chalk.gray('Provided tasks: ') +
								chalk.cyan(sortedProvidedIds.join(', '))
						);

						if (uniqueAutoDiscovered.length > 0) {
							const sortedAutoIds = uniqueAutoDiscovered
								.map((id) => parseInt(id))
								.sort((a, b) => a - b)
								.map((id) => id.toString());

							console.log(
								chalk.gray('+ Auto-discovered related tasks: ') +
									chalk.cyan(sortedAutoIds.join(', '))
							);
						}
					} else {
						console.log(
							chalk.gray('Auto-discovered relevant tasks: ') +
								chalk.cyan(sortedTaskIds.join(', '))
						);
					}
				}
			}
		} catch (error) {
			// Silently continue without auto-discovered tasks if there's an error
			logFn.debug(`Could not auto-discover tasks: ${error.message}`);
		}

		const contextResult = await contextGatherer.gather({
			tasks: finalTaskIds,
			files: filePaths,
			customContext,
			includeProjectTree,
			format: 'research', // Use research format for AI consumption
			includeTokenCounts: true
		});

		const gatheredContext = contextResult.context;
		const tokenBreakdown = contextResult.tokenBreakdown;

		// Build system prompt based on detail level
		const systemPrompt = buildResearchSystemPrompt(detailLevel, projectRoot);

		// Build user prompt with context
		const userPrompt = buildResearchUserPrompt(
			query,
			gatheredContext,
			detailLevel
		);

		// Count tokens for system and user prompts
		const systemPromptTokens = contextGatherer.countTokens(systemPrompt);
		const userPromptTokens = contextGatherer.countTokens(userPrompt);
		const totalInputTokens = systemPromptTokens + userPromptTokens;

		if (outputFormat === 'text') {
			// Display detailed token breakdown in a clean box
			displayDetailedTokenBreakdown(
				tokenBreakdown,
				systemPromptTokens,
				userPromptTokens
			);
		}

		// Only log detailed info in debug mode or MCP
		if (outputFormat !== 'text') {
			logFn.info(
				`Calling AI service with research role, context size: ${tokenBreakdown.total} tokens (${gatheredContext.length} characters)`
			);
		}

		// Start loading indicator for CLI mode
		let loadingIndicator = null;
		if (outputFormat === 'text') {
			loadingIndicator = startLoadingIndicator('Researching with AI...\n');
		}

		let aiResult;
		try {
			// Call AI service with research role
			aiResult = await generateTextService({
				role: 'research', // Always use research role for research command
				session,
				projectRoot,
				systemPrompt,
				prompt: userPrompt,
				commandName,
				outputType
			});
		} catch (error) {
			if (loadingIndicator) {
				stopLoadingIndicator(loadingIndicator);
			}
			throw error;
		} finally {
			if (loadingIndicator) {
				stopLoadingIndicator(loadingIndicator);
			}
		}

		const researchResult = aiResult.mainResult;
		const telemetryData = aiResult.telemetryData;

		// Format and display results
		if (outputFormat === 'text') {
			displayResearchResults(
				researchResult,
				query,
				detailLevel,
				tokenBreakdown
			);

			// Display AI usage telemetry for CLI users
			if (telemetryData) {
				displayAiUsageSummary(telemetryData, 'cli');
			}

			// Offer follow-up question option (only for initial CLI queries, not MCP)
			if (allowFollowUp && !isMCP) {
				await handleFollowUpQuestions(
					options,
					context,
					outputFormat,
					projectRoot,
					logFn,
					query,
					researchResult
				);
			}
		}

		logFn.success('Research query completed successfully');

		return {
			query,
			result: researchResult,
			contextSize: gatheredContext.length,
			contextTokens: tokenBreakdown.total,
			tokenBreakdown,
			systemPromptTokens,
			userPromptTokens,
			totalInputTokens,
			detailLevel,
			telemetryData
		};
	} catch (error) {
		logFn.error(`Research query failed: ${error.message}`);

		if (outputFormat === 'text') {
			console.error(chalk.red(`\n❌ Research failed: ${error.message}`));
		}

		throw error;
	}
}

/**
 * Build system prompt for research based on detail level
 * @param {string} detailLevel - Detail level: 'low', 'medium', 'high'
 * @param {string} projectRoot - Project root for context
 * @returns {string} System prompt
 */
function buildResearchSystemPrompt(detailLevel, projectRoot) {
	const basePrompt = `You are an expert AI research assistant helping with a software development project. You have access to project context including tasks, files, and project structure.

Your role is to provide comprehensive, accurate, and actionable research responses based on the user's query and the provided project context.`;

	const detailInstructions = {
		low: `
**Response Style: Concise & Direct**
- Provide brief, focused answers (2-4 paragraphs maximum)
- Focus on the most essential information
- Use bullet points for key takeaways
- Avoid lengthy explanations unless critical
- Skip pleasantries, introductions, and conclusions
- No phrases like "Based on your project context" or "I'll provide guidance"
- No summary outros or alignment statements
- Get straight to the actionable information
- Use simple, direct language - users want info, not explanation`,

		medium: `
**Response Style: Balanced & Comprehensive**
- Provide thorough but well-structured responses (4-8 paragraphs)
- Include relevant examples and explanations
- Balance depth with readability
- Use headings and bullet points for organization`,

		high: `
**Response Style: Detailed & Exhaustive**
- Provide comprehensive, in-depth analysis (8+ paragraphs)
- Include multiple perspectives and approaches
- Provide detailed examples, code snippets, and step-by-step guidance
- Cover edge cases and potential pitfalls
- Use clear structure with headings, subheadings, and lists`
	};

	return `${basePrompt}

${detailInstructions[detailLevel]}

**Guidelines:**
- Always consider the project context when formulating responses
- Reference specific tasks, files, or project elements when relevant
- Provide actionable insights that can be applied to the project
- If the query relates to existing project tasks, suggest how the research applies to those tasks
- Use markdown formatting for better readability
- Be precise and avoid speculation unless clearly marked as such

**For LOW detail level specifically:**
- Start immediately with the core information
- No introductory phrases or context acknowledgments
- No concluding summaries or project alignment statements
- Focus purely on facts, steps, and actionable items`;
}

/**
 * Build user prompt with query and context
 * @param {string} query - User's research query
 * @param {string} gatheredContext - Gathered project context
 * @param {string} detailLevel - Detail level for response guidance
 * @returns {string} Complete user prompt
 */
function buildResearchUserPrompt(query, gatheredContext, detailLevel) {
	let prompt = `# Research Query

${query}`;

	if (gatheredContext && gatheredContext.trim()) {
		prompt += `

# Project Context

${gatheredContext}`;
	}

	prompt += `

# Instructions

Please research and provide a ${detailLevel}-detail response to the query above. Consider the project context provided and make your response as relevant and actionable as possible for this specific project.`;

	return prompt;
}

/**
 * Display detailed token breakdown for context and prompts
 * @param {Object} tokenBreakdown - Token breakdown from context gatherer
 * @param {number} systemPromptTokens - System prompt token count
 * @param {number} userPromptTokens - User prompt token count
 */
function displayDetailedTokenBreakdown(
	tokenBreakdown,
	systemPromptTokens,
	userPromptTokens
) {
	const parts = [];

	// Custom context
	if (tokenBreakdown.customContext) {
		parts.push(
			chalk.cyan('Custom: ') +
				chalk.yellow(tokenBreakdown.customContext.tokens.toLocaleString())
		);
	}

	// Tasks breakdown
	if (tokenBreakdown.tasks && tokenBreakdown.tasks.length > 0) {
		const totalTaskTokens = tokenBreakdown.tasks.reduce(
			(sum, task) => sum + task.tokens,
			0
		);
		const taskDetails = tokenBreakdown.tasks
			.map((task) => {
				const titleDisplay =
					task.title.length > 30
						? task.title.substring(0, 30) + '...'
						: task.title;
				return `  ${chalk.gray(task.id)} ${chalk.white(titleDisplay)} ${chalk.yellow(task.tokens.toLocaleString())} tokens`;
			})
			.join('\n');

		parts.push(
			chalk.cyan('Tasks: ') +
				chalk.yellow(totalTaskTokens.toLocaleString()) +
				chalk.gray(` (${tokenBreakdown.tasks.length} items)`) +
				'\n' +
				taskDetails
		);
	}

	// Files breakdown
	if (tokenBreakdown.files && tokenBreakdown.files.length > 0) {
		const totalFileTokens = tokenBreakdown.files.reduce(
			(sum, file) => sum + file.tokens,
			0
		);
		const fileDetails = tokenBreakdown.files
			.map((file) => {
				const pathDisplay =
					file.path.length > 40
						? '...' + file.path.substring(file.path.length - 37)
						: file.path;
				return `  ${chalk.gray(pathDisplay)} ${chalk.yellow(file.tokens.toLocaleString())} tokens ${chalk.gray(`(${file.sizeKB}KB)`)}`;
			})
			.join('\n');

		parts.push(
			chalk.cyan('Files: ') +
				chalk.yellow(totalFileTokens.toLocaleString()) +
				chalk.gray(` (${tokenBreakdown.files.length} files)`) +
				'\n' +
				fileDetails
		);
	}

	// Project tree
	if (tokenBreakdown.projectTree) {
		parts.push(
			chalk.cyan('Project Tree: ') +
				chalk.yellow(tokenBreakdown.projectTree.tokens.toLocaleString()) +
				chalk.gray(
					` (${tokenBreakdown.projectTree.fileCount} files, ${tokenBreakdown.projectTree.dirCount} dirs)`
				)
		);
	}

	// Prompts breakdown
	const totalPromptTokens = systemPromptTokens + userPromptTokens;
	const promptDetails = [
		`  ${chalk.gray('System:')} ${chalk.yellow(systemPromptTokens.toLocaleString())} tokens`,
		`  ${chalk.gray('User:')} ${chalk.yellow(userPromptTokens.toLocaleString())} tokens`
	].join('\n');

	parts.push(
		chalk.cyan('Prompts: ') +
			chalk.yellow(totalPromptTokens.toLocaleString()) +
			chalk.gray(' (generated)') +
			'\n' +
			promptDetails
	);

	// Display the breakdown in a clean box
	if (parts.length > 0) {
		const content = parts.join('\n\n');
		const tokenBox = boxen(content, {
			title: chalk.blue.bold('Context Analysis'),
			titleAlignment: 'left',
			padding: { top: 1, bottom: 1, left: 2, right: 2 },
			margin: { top: 0, bottom: 1 },
			borderStyle: 'single',
			borderColor: 'blue'
		});
		console.log(tokenBox);
	}
}

/**
 * Process research result text to highlight code blocks
 * @param {string} text - Raw research result text
 * @returns {string} Processed text with highlighted code blocks
 */
function processCodeBlocks(text) {
	// Regex to match code blocks with optional language specification
	const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

	return text.replace(codeBlockRegex, (match, language, code) => {
		try {
			// Default to javascript if no language specified
			const lang = language || 'javascript';

			// Highlight the code using cli-highlight
			const highlightedCode = highlight(code.trim(), {
				language: lang,
				ignoreIllegals: true // Don't fail on unrecognized syntax
			});

			// Add a subtle border around code blocks
			const codeBox = boxen(highlightedCode, {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				margin: { top: 0, bottom: 0 },
				borderStyle: 'single',
				borderColor: 'dim'
			});

			return '\n' + codeBox + '\n';
		} catch (error) {
			// If highlighting fails, return the original code block with basic formatting
			return (
				'\n' +
				chalk.gray('```' + (language || '')) +
				'\n' +
				chalk.white(code.trim()) +
				'\n' +
				chalk.gray('```') +
				'\n'
			);
		}
	});
}

/**
 * Display research results in formatted output
 * @param {string} result - AI research result
 * @param {string} query - Original query
 * @param {string} detailLevel - Detail level used
 * @param {Object} tokenBreakdown - Detailed token usage
 */
function displayResearchResults(result, query, detailLevel, tokenBreakdown) {
	// Header with query info
	const header = boxen(
		chalk.green.bold('Research Results') +
			'\n\n' +
			chalk.gray('Query: ') +
			chalk.white(query) +
			'\n' +
			chalk.gray('Detail Level: ') +
			chalk.cyan(detailLevel),
		{
			padding: { top: 1, bottom: 1, left: 2, right: 2 },
			margin: { top: 1, bottom: 0 },
			borderStyle: 'round',
			borderColor: 'green'
		}
	);
	console.log(header);

	// Process the result to highlight code blocks
	const processedResult = processCodeBlocks(result);

	// Main research content in a clean box
	const contentBox = boxen(processedResult, {
		padding: { top: 1, bottom: 1, left: 2, right: 2 },
		margin: { top: 0, bottom: 1 },
		borderStyle: 'single',
		borderColor: 'gray'
	});
	console.log(contentBox);

	// Success footer
	console.log(chalk.green('✅ Research completed'));
}

/**
 * Flatten tasks array to include subtasks as individual searchable items
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Flattened array including both tasks and subtasks
 */
function flattenTasksWithSubtasks(tasks) {
	const flattened = [];

	for (const task of tasks) {
		// Add the main task
		flattened.push({
			...task,
			searchableId: task.id.toString(), // For consistent ID handling
			isSubtask: false
		});

		// Add subtasks if they exist
		if (task.subtasks && task.subtasks.length > 0) {
			for (const subtask of task.subtasks) {
				flattened.push({
					...subtask,
					searchableId: `${task.id}.${subtask.id}`, // Format: "15.2"
					isSubtask: true,
					parentId: task.id,
					parentTitle: task.title,
					// Enhance subtask context with parent information
					title: `${subtask.title} (subtask of: ${task.title})`,
					description: `${subtask.description} [Parent: ${task.description}]`
				});
			}
		}
	}

	return flattened;
}

/**
 * Handle follow-up questions in interactive mode
 * @param {Object} originalOptions - Original research options
 * @param {Object} context - Execution context
 * @param {string} outputFormat - Output format
 * @param {string} projectRoot - Project root directory
 * @param {Object} logFn - Logger function
 * @param {string} initialQuery - Initial query for context
 * @param {string} initialResult - Initial AI result for context
 */
async function handleFollowUpQuestions(
	originalOptions,
	context,
	outputFormat,
	projectRoot,
	logFn,
	initialQuery,
	initialResult
) {
	try {
		// Initialize conversation history with the initial Q&A
		const conversationHistory = [
			{
				question: initialQuery,
				answer: initialResult,
				type: 'initial'
			}
		];

		while (true) {
			// Ask if user wants to ask a follow-up question
			const { wantFollowUp } = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'wantFollowUp',
					message: 'Would you like to ask a follow-up question?',
					default: false // Default to 'n' as requested
				}
			]);

			if (!wantFollowUp) {
				break;
			}

			// Get the follow-up question
			const { followUpQuery } = await inquirer.prompt([
				{
					type: 'input',
					name: 'followUpQuery',
					message: 'Enter your follow-up question:',
					validate: (input) => {
						if (!input || input.trim().length === 0) {
							return 'Please enter a valid question.';
						}
						return true;
					}
				}
			]);

			if (!followUpQuery || followUpQuery.trim().length === 0) {
				continue;
			}

			console.log('\n' + chalk.gray('─'.repeat(60)) + '\n');

			// Build cumulative conversation context from all previous exchanges
			const conversationContext = buildConversationContext(conversationHistory);

			// Create enhanced options for follow-up with full conversation context
			// Remove explicit task IDs to allow fresh fuzzy search based on new question
			const followUpOptions = {
				...originalOptions,
				taskIds: [], // Clear task IDs to allow fresh fuzzy search
				customContext:
					conversationContext +
					(originalOptions.customContext
						? `\n\n--- Original Context ---\n${originalOptions.customContext}`
						: '')
			};

			// Perform follow-up research with fresh fuzzy search and conversation context
			// Disable follow-up prompts for nested calls to prevent infinite recursion
			const followUpResult = await performResearch(
				followUpQuery.trim(),
				followUpOptions,
				context,
				outputFormat,
				false // allowFollowUp = false for nested calls
			);

			// Add this exchange to the conversation history
			conversationHistory.push({
				question: followUpQuery.trim(),
				answer: followUpResult.result,
				type: 'followup'
			});
		}
	} catch (error) {
		// If there's an error with inquirer (e.g., non-interactive terminal),
		// silently continue without follow-up functionality
		logFn.debug(`Follow-up questions not available: ${error.message}`);
	}
}

/**
 * Build conversation context string from conversation history
 * @param {Array} conversationHistory - Array of conversation exchanges
 * @returns {string} Formatted conversation context
 */
function buildConversationContext(conversationHistory) {
	if (conversationHistory.length === 0) {
		return '';
	}

	const contextParts = ['--- Conversation History ---'];

	conversationHistory.forEach((exchange, index) => {
		const questionLabel =
			exchange.type === 'initial' ? 'Initial Question' : `Follow-up ${index}`;
		const answerLabel =
			exchange.type === 'initial' ? 'Initial Answer' : `Answer ${index}`;

		contextParts.push(`\n${questionLabel}: ${exchange.question}`);
		contextParts.push(`${answerLabel}: ${exchange.answer}`);
	});

	return contextParts.join('\n');
}

export { performResearch };
