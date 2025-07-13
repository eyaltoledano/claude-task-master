/**
 * research.js
 * Core research functionality for AI-powered queries with project context
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import { highlight } from 'cli-highlight';
import { ContextGatherer } from '../utils/contextGatherer.js';
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';
import { generateTextService } from '../ai-services-unified.js';
import { getPromptManager } from '../prompt-manager.js';
import {
	log as consoleLog,
	findProjectRoot,
	readJSON,
	flattenTasksWithSubtasks
} from '../utils.js';
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
 * @param {string} [options.saveTo] - Task ID to save/append results to (for MCP direct calls)
 * @param {boolean} [options.saveToFile] - Whether to save results to file (MCP mode or CLI direct)
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
		projectRoot: providedProjectRoot,
		// options.saveTo is intentionally NOT destructured here, access via options.saveTo directly.
		// This is crucial for distinguishing between a missing saveTo and an explicit undefined/null.
		saveToFile = false // saveToFile is destructured as it's used for various conditions.
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
			const tasksPathForDiscovery = path.join(
				// tasksPathForDiscovery instead of tasksPath
				projectRoot,
				'.taskmaster',
				'tasks',
				'tasks.json'
			);
			// Use tasksPathForDiscovery
			const tasksData = await readJSON(tasksPathForDiscovery, projectRoot);

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

		// Gather context (tasks, files, project tree)
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

		// Load prompts using PromptManager
		const promptManager = getPromptManager();

		const promptParams = {
			query: query,
			gatheredContext: gatheredContext || '',
			detailLevel: detailLevel,
			projectInfo: {
				root: projectRoot,
				taskCount: finalTaskIds.length,
				fileCount: filePaths.length
			}
		};

		// Select variant based on detail level
		const variantKey = detailLevel; // 'low', 'medium', or 'high'
		const { systemPrompt, userPrompt } = await promptManager.loadPrompt(
			'research',
			promptParams,
			variantKey
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
				outputType,
				// Pass original options that might be needed by the agent or for saving logic
				originalSaveTo: options.saveTo,
				originalSaveToFile: options.saveToFile, // This was 'saveToFile' in your initial code, keeping it
				originalDetailLevel: options.detailLevel
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

		logFn.info(`performResearch: generateTextService call completed.`);
		logFn.debug(`performResearch: aiResult raw: ${JSON.stringify(aiResult)}`);
		if (aiResult && aiResult.mainResult) {
			logFn.info(
				`performResearch: aiResult.mainResult type: ${typeof aiResult.mainResult}`
			);
			if (
				typeof aiResult.mainResult === 'object' &&
				aiResult.mainResult !== null
			) {
				logFn.info(
					`performResearch: aiResult.mainResult.type property: ${aiResult.mainResult.type}`
				);
			} else if (typeof aiResult.mainResult === 'string') {
				logFn.info(
					`performResearch: aiResult.mainResult (string start): ${aiResult.mainResult.substring(0, 200)}...`
				);
			}
		} else {
			logFn.warn(
				`performResearch: aiResult or aiResult.mainResult is null/undefined.`
			);
		}

		// === BEGIN AGENT_LLM DELEGATION SIGNAL CHECK ===
		// Check if generateTextService (via _unifiedServiceRunner) returned a delegation signal
		if (
			aiResult &&
			aiResult.mainResult &&
			aiResult.mainResult.type === 'agent_llm_delegation'
		) {
			logFn.debug(
				`AgentLLM delegation signal received from AI service for research. Propagating initial signal.`
			);
			// aiResult.mainResult is the { type: 'agent_llm_delegation', interactionId, details } object
			// Construct the full signal expected by researchDirect and then the MCP tool,
			// matching the structure observed for update_task.
			const pendingInteractionObject = {
				type: 'agent_llm', // Standardized type for server processing
				interactionId: aiResult.mainResult.interactionId,
				delegatedCallDetails: {
					originalCommand: commandName, // Use the destructured commandName from the context parameter
					role: 'research', // The role that was delegated
					serviceType: 'generateText', // Agent is expected to generate text
					requestParameters: {
						...aiResult.mainResult.details, // Contains modelId, messages, originalSaveTo etc.
						tagInfo: aiResult.tagInfo // Pass along the tagInfo
					}
				}
			};
			logFn.debug(
				`Transformed pendingInteraction for research: ${JSON.stringify(pendingInteractionObject)}`
			);
			return {
				needsAgentDelegation: true,
				pendingInteraction: pendingInteractionObject,
				// Provide structure consistent with normal returns, but with null/default data
				query,
				result: null, // No direct result if delegating
				contextSize: gatheredContext.length,
				contextTokens: tokenBreakdown.total,
				tokenBreakdown,
				systemPromptTokens,
				userPromptTokens,
				totalInputTokens,
				detailLevel,
				telemetryData: null, // No direct AI call was finalized here
				tagInfo: aiResult.tagInfo // tagInfo can still be relevant
			};
		}
		// === END AGENT_LLM DELEGATION SIGNAL CHECK ===

		const researchResult = aiResult.mainResult; // This should be the agent's text on resumption or direct LLM text
		const telemetryData = aiResult.telemetryData; // Should be null if agent_llm, populated otherwise
		const tagInfo = aiResult.tagInfo; // Should always be populated

		logFn.info(
			`performResearch: researchResult (from agent or direct LLM): ${typeof researchResult === 'string' ? researchResult.substring(0, 100) + '...' : JSON.stringify(researchResult)}`
		);
		logFn.debug(
			`performResearch: telemetryData: ${JSON.stringify(telemetryData)}`
		);
		logFn.debug(`performResearch: tagInfo: ${JSON.stringify(tagInfo)}`);
		logFn.debug(`performResearch: options.saveTo parameter: ${options.saveTo}`); // Access directly from options
		logFn.debug(
			`performResearch: researchResult is null? ${researchResult == null}`
		);

		// Format and display results (only for CLI direct calls, not for MCP or when just saving)
		// Initialize interactive save tracking
		let interactiveSaveInfo = { interactiveSaveOccurred: false };

		if (outputFormat === 'text') {
			// Typically CLI mode
			if (researchResult != null) {
				// Only display if there's a result
				displayResearchResults(
					researchResult,
					query,
					detailLevel,
					tokenBreakdown
				);
			} else {
				logFn.warn(
					'performResearch: researchResult is null, skipping displayResearchResults.'
				);
			}

			// Display AI usage telemetry for CLI users
			if (telemetryData) {
				// Only if telemetryData exists (i.e., not agent_llm)
				displayAiUsageSummary(telemetryData, 'cli');
			}

			// Offer follow-up question option (only for initial CLI queries, not MCP)
			if (allowFollowUp && !isMCP && researchResult != null) {
				interactiveSaveInfo = await handleFollowUpQuestions(
					options, // Pass the original options object
					context,
					outputFormat,
					projectRoot,
					logFn,
					query,
					researchResult
				);
			}
		}

		let finalSavedFilePath = null; // Declare here to be accessible for return
		// This save logic is for direct calls in MCP mode where options.saveToFile or options.saveTo are provided directly,
		// or for CLI mode if interactive save doesn't happen and these were somehow passed (legacy).
		// It only runs if telemetryData is present (i.e., not a resumed delegated call where server handles saving).
		if (aiResult.telemetryData != null) {
			// This indicates a direct call, not a resumed delegated one
			// Handle saving to file if options.saveToFile is true
			if (options.saveToFile && researchResult != null) {
				logFn.info(
					`performResearch (direct): Entering saveToFile block. options.saveToFile: ${options.saveToFile}, researchResult is not null.`
				);
				const conversationHistoryForFileSave = [
					{
						// Use a distinct name
						question: query,
						answer: researchResult,
						type: 'initial',
						timestamp: new Date().toISOString()
					}
				];
				try {
					finalSavedFilePath = await handleSaveToFile(
						conversationHistoryForFileSave,
						projectRoot,
						context,
						logFn
					);
					logFn.info(
						`performResearch (direct): Saved to file: ${finalSavedFilePath}`
					);
				} catch (fileSaveError) {
					logFn.error(
						`performResearch (direct): Error during saveToFile: ${fileSaveError.message}`
					);
				}
			} else {
				logFn.info(
					`performResearch (direct): Skipping saveToFile. options.saveToFile: ${options.saveToFile}, researchResult is null? ${researchResult == null}`
				);
			}

			// Handle saving to task/subtask if options.saveTo is provided
			if (options.saveTo && researchResult != null) {
				logFn.info(
					`performResearch (direct): Entering saveTo block for task ID '${options.saveTo}'. researchResult is not null.`
				);
				try {
					const isSubtaskForSave = String(options.saveTo).includes('.');
					let researchContentToAppend = `## Research Query: ${query.trim()}\n\n`;
					if (detailLevel)
						researchContentToAppend += `**Detail Level:** ${detailLevel}\n`;
					if (gatheredContext?.length)
						researchContentToAppend += `**Context Size:** ${gatheredContext.length} characters\n`;
					researchContentToAppend += `**Timestamp:** ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`;
					researchContentToAppend += `### Results\n\n${researchResult}`;

					logFn.debug(
						`performResearch: researchContentToAppend for saveTo: ${researchContentToAppend.substring(0, 200)}...`
					);
					const tasksPathForSave = path.join(
						projectRoot,
						'.taskmaster',
						'tasks',
						'tasks.json'
					);
					logFn.debug(
						`performResearch: tasksPathForSave for saveTo: ${tasksPathForSave}`
					);

					const internalUpdateContextForSave = {
						session: context.session,
						mcpLog: logFn,
						commandName: `research-saveTo-${isSubtaskForSave ? 'subtask' : 'task'}`,
						outputType: context.outputType,
						projectRoot: projectRoot,
						tag: context.tag
					};
					logFn.debug(
						`performResearch: internalUpdateContextForSave for saveTo: ${JSON.stringify(internalUpdateContextForSave)}`
					);

					if (isSubtaskForSave) {
						logFn.info(
							`performResearch: Attempting to save to subtask ${options.saveTo}.`
						);
						const { updateSubtaskById } = await import(
							'./update-subtask-by-id.js'
						);
						await updateSubtaskById(
							tasksPathForSave,
							options.saveTo,
							researchContentToAppend,
							false,
							internalUpdateContextForSave,
							'json'
						);
					} else {
						logFn.info(
							`performResearch: Attempting to save to task ${options.saveTo}.`
						);
						const updateTaskById = (await import('./update-task-by-id.js'))
							.default;
						const taskIdNumToSave = parseInt(options.saveTo, 10);
						await updateTaskById(
							tasksPathForSave,
							taskIdNumToSave,
							researchContentToAppend,
							false,
							internalUpdateContextForSave,
							'json',
							true
						);
					}
					logFn.info(
						`performResearch: Research successfully saved to task/subtask ${options.saveTo}.`
					);
				} catch (saveError) {
					logFn.error(
						`performResearch: Error saving research to task/subtask ${options.saveTo}: ${saveError.message}`
					);
					logFn.error(`performResearch: Save error stack: ${saveError.stack}`);
				}
			} else {
				logFn.info(
					`performResearch (direct): Skipping saveTo. options.saveTo: ${options.saveTo}, researchResult is null? ${researchResult == null}`
				);
			}
		}

		// This log was here before the save logic conditional, should remain outside
		logFn.success('performResearch: Main logic completed successfully.');
		// Final return structure
		return {
			query,
			result: researchResult,
			contextSize: gatheredContext.length,
			contextTokens: tokenBreakdown?.total,
			tokenBreakdown,
			systemPromptTokens,
			userPromptTokens,
			totalInputTokens,
			detailLevel,
			telemetryData,
			tagInfo,
			interactiveSaveOccurred:
				interactiveSaveInfo?.interactiveSaveOccurred || false
			// finalSavedFilePath is not part of the standard return for research, handled by MCP if needed
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
 * Handle follow-up questions and save functionality in interactive mode
 * @param {Object} originalOptions - Original research options
 * @param {Object} context - Execution context
 * @param {string} outputFormat - Output format
 * @param {string} projectRoot - Project root directory
 * @param {Object} logFn - Logger function
 * @param {string} initialQuery - Initial query for context
 * @param {string} initialResult - Initial AI result for context
 */
async function handleFollowUpQuestions(
	originalOptions, // This should be the full options object from performResearch
	context,
	outputFormat,
	projectRoot,
	logFn,
	initialQuery,
	initialResult
) {
	let interactiveSaveOccurred = false;

	try {
		// Import required modules for saving, renaming to avoid conflict in this scope
		const { readJSON: cliReadJSON } = await import('../utils.js');
		const updateTaskByIdCLI = (await import('./update-task-by-id.js')).default;
		const { updateSubtaskById: updateSubtaskByIdCLI } = await import(
			'./update-subtask-by-id.js'
		);

		// Initialize conversation history with the initial Q&A
		const conversationHistory = [
			{
				question: initialQuery,
				answer: initialResult,
				type: 'initial',
				timestamp: new Date().toISOString()
			}
		];

		while (true) {
			// Get user choice
			const { action } = await inquirer.prompt([
				{
					type: 'list',
					name: 'action',
					message: 'What would you like to do next?',
					choices: [
						{ name: 'Ask a follow-up question', value: 'followup' },
						{ name: 'Save to file', value: 'savefile' },
						{ name: 'Save to task/subtask', value: 'save' },
						{ name: 'Quit', value: 'quit' }
					],
					pageSize: 4
				}
			]);

			if (action === 'quit') {
				break;
			}

			if (action === 'savefile') {
				// Handle save to file functionality
				await handleSaveToFile(
					conversationHistory,
					projectRoot,
					context, // Pass the original context
					logFn // Pass the original logFn
				);
				continue;
			}

			if (action === 'save') {
				// Handle save functionality, passing CLI-specific functions
				const saveResult = await handleSaveToTask(
					conversationHistory,
					projectRoot,
					context, // Pass the original context
					logFn, // Pass the original logFn
					cliReadJSON,
					updateTaskByIdCLI,
					updateSubtaskByIdCLI
				);
				if (saveResult) {
					interactiveSaveOccurred = true;
				}
				continue;
			}

			if (action === 'followup') {
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
				const conversationContext =
					buildConversationContext(conversationHistory);

				// Create enhanced options for follow-up with full conversation context
				// Ensure originalOptions.customContext is handled correctly
				const followUpOptions = {
					...originalOptions, // Spread all original options
					taskIds: [],
					customContext:
						conversationContext +
						(originalOptions.customContext // Check originalOptions directly
							? `\n\n--- Original Context ---\n${originalOptions.customContext}`
							: '')
				};

				// Perform follow-up research
				const followUpResult = await performResearch(
					followUpQuery.trim(),
					followUpOptions, // Pass the full followUpOptions
					context,
					outputFormat,
					false // allowFollowUp = false for nested calls
				);

				// Add this exchange to the conversation history
				conversationHistory.push({
					question: followUpQuery.trim(),
					answer: followUpResult.result,
					type: 'followup',
					timestamp: new Date().toISOString()
				});
			}
		}
	} catch (error) {
		// If there's an error with inquirer (e.g., non-interactive terminal),
		// silently continue without follow-up functionality
		logFn.debug(`Follow-up questions not available: ${error.message}`);
	}

	return { interactiveSaveOccurred };
}

/**
 * Handle saving conversation to a task or subtask (CLI interactive part)
 * This function is specifically for CLI interactive saving.
 * @param {Array} conversationHistory - Array of conversation exchanges
 * @param {string} projectRoot - Project root directory
 * @param {Object} context - Execution context (original from performResearch)
 * @param {Object} logFn - Logger function (original from performResearch)
 * @param {Function} cliReadJSON - readJSON function specifically for CLI.
 * @param {Function} updateTaskByIdCLI - updateTaskById function for CLI.
 * @param {Function} updateSubtaskByIdCLI - updateSubtaskById function for CLI.
 * @returns {Promise<boolean>} True if save was successful, false otherwise.
 */
async function handleSaveToTask(
	conversationHistory,
	projectRoot,
	context, // Original context from performResearch
	logFn, // Original logFn from performResearch
	cliReadJSON,
	updateTaskByIdCLI,
	updateSubtaskByIdCLI
) {
	try {
		// Get task ID from user
		const { taskId } = await inquirer.prompt([
			{
				type: 'input',
				name: 'taskId',
				message: 'Enter task ID (e.g., "15" for task or "15.2" for subtask):',
				validate: (input) => {
					if (!input || input.trim().length === 0) {
						return 'Please enter a task ID.';
					}
					const trimmedInput = input.trim();
					if (!/^\d+(\.\d+)?$/.test(trimmedInput)) {
						return 'Invalid format. Use "15" for task or "15.2" for subtask.';
					}
					return true;
				}
			}
		]);

		const trimmedTaskId = taskId.trim();
		const conversationThread = formatConversationForSaving(conversationHistory);
		const isSubtask = trimmedTaskId.includes('.');
		const tasksPathForSave = path.join(
			projectRoot,
			'.taskmaster',
			'tasks',
			'tasks.json'
		);

		if (!fs.existsSync(tasksPathForSave)) {
			console.log(
				chalk.red('❌ Tasks file not found. Please run task-master init first.')
			);
			return false;
		}

		const { getCurrentTag: cliGetCurrentTag } = await import('../utils.js');
		const tagToUse = context.tag || cliGetCurrentTag(projectRoot) || 'master';
		const data = cliReadJSON(tasksPathForSave, projectRoot, tagToUse);

		if (!data || !data.tasks) {
			console.log(chalk.red('❌ No valid tasks found.'));
			return false;
		}

		let taskExistsCheck = false;
		if (isSubtask) {
			const [parentId, subId] = trimmedTaskId
				.split('.')
				.map((id) => parseInt(id, 10));
			const parent = data.tasks.find((t) => t.id === parentId);
			if (
				parent &&
				parent.subtasks &&
				parent.subtasks.find((st) => st.id === subId)
			) {
				taskExistsCheck = true;
			} else {
				console.log(chalk.red(`❌ Subtask ${trimmedTaskId} not found.`));
			}
		} else {
			if (data.tasks.find((t) => t.id === parseInt(trimmedTaskId, 10))) {
				taskExistsCheck = true;
			} else {
				console.log(chalk.red(`❌ Task ${trimmedTaskId} not found.`));
			}
		}

		if (!taskExistsCheck) {
			return false;
		}

		console.log(
			chalk.blue(
				`💾 Saving research conversation to ${isSubtask ? 'subtask' : 'task'}...`
			)
		);

		const updateContext = {
			...context,
			tag: tagToUse,
			mcpLog: logFn,
			projectRoot: projectRoot
		};

		if (isSubtask) {
			await updateSubtaskByIdCLI(
				tasksPathForSave,
				trimmedTaskId,
				conversationThread,
				false,
				updateContext,
				'text'
			);
		} else {
			await updateTaskByIdCLI(
				tasksPathForSave,
				parseInt(trimmedTaskId, 10),
				conversationThread,
				false,
				updateContext,
				'text',
				true
			);
		}
		console.log(
			chalk.green(
				`✅ Research conversation saved to ${isSubtask ? 'subtask' : 'task'} ${trimmedTaskId}`
			)
		);
		return true;
	} catch (error) {
		console.log(chalk.red(`❌ Error saving conversation: ${error.message}`));
		logFn.error(`Error saving conversation: ${error.message}`);
		return false;
	}
}

/**
 * Handle saving conversation to a file in .taskmaster/docs/research/ (CLI interactive part or direct call)
 * @param {Array} conversationHistory - Array of conversation exchanges
 * @param {string} projectRoot - Project root directory
 * @param {Object} context - Execution context (original from performResearch)
 * @param {Object} logFn - Logger function (original from performResearch)
 * @returns {Promise<string|null>} Path to saved file, or null/throws if error.
 */
async function handleSaveToFile(
	conversationHistory,
	projectRoot,
	context,
	logFn
) {
	try {
		const researchDir = path.join(
			projectRoot,
			'.taskmaster',
			'docs',
			'research'
		);
		if (!fs.existsSync(researchDir)) {
			fs.mkdirSync(researchDir, { recursive: true });
		}

		const firstQuery = conversationHistory[0]?.question || 'research-query';
		const timestamp = new Date().toISOString().split('T')[0];

		const querySlug = firstQuery
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.substring(0, 50)
			.replace(/^-+|-+$/g, '');

		const filename = `${timestamp}_${querySlug}.md`;
		const filePath = path.join(researchDir, filename);

		const fileContent = formatConversationForFile(
			conversationHistory,
			firstQuery
		);

		fs.writeFileSync(filePath, fileContent, 'utf8');

		const relativePath = path.relative(projectRoot, filePath);

		// Only log to console if it's a CLI output type (interactive or direct CLI call)
		if (context.outputType === 'cli') {
			console.log(
				chalk.green(`✅ Research saved to: ${chalk.cyan(relativePath)}`)
			);
		}
		// Always log to the main logger
		logFn.success(`Research conversation saved to ${relativePath}`);

		return filePath;
	} catch (error) {
		if (context.outputType === 'cli') {
			console.log(chalk.red(`❌ Error saving research file: ${error.message}`));
		}
		logFn.error(`Error saving research file: ${error.message}`);
		throw error;
	}
}

/**
 * Format conversation history for saving to a file
 * @param {Array} conversationHistory - Array of conversation exchanges
 * @param {string} initialQuery - The initial query for metadata
 * @returns {string} Formatted file content
 */
function formatConversationForFile(conversationHistory, initialQuery) {
	const timestamp = new Date().toISOString();
	const date = new Date().toLocaleDateString();
	const time = new Date().toLocaleTimeString();

	let content = `---
title: Research Session
query: "${initialQuery}"
date: ${date}
time: ${time}
timestamp: ${timestamp}
exchanges: ${conversationHistory.length}
---

# Research Session

`;

	conversationHistory.forEach((exchange, index) => {
		if (exchange.type === 'initial') {
			content += `## Initial Query\n\n**Question:** ${exchange.question}\n\n**Response:**\n\n${exchange.answer}\n\n`;
		} else {
			content += `## Follow-up ${index}\n\n**Question:** ${exchange.question}\n\n**Response:**\n\n${exchange.answer}\n\n`;
		}

		if (index < conversationHistory.length - 1) {
			content += '---\n\n';
		}
	});

	content += `\n---\n\n*Generated by Task Master Research Command*  \n*Timestamp: ${timestamp}*\n`;

	return content;
}

/**
 * Format conversation history for saving to a task/subtask
 * @param {Array} conversationHistory - Array of conversation exchanges
 * @returns {string} Formatted conversation thread
 */
function formatConversationForSaving(conversationHistory) {
	// const timestamp = new Date().toISOString(); // Not currently used in output string
	let formatted = `## Research Session - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`;

	conversationHistory.forEach((exchange, index) => {
		if (exchange.type === 'initial') {
			formatted += `**Initial Query:** ${exchange.question}\n\n`;
			formatted += `**Response:** ${exchange.answer}\n\n`;
		} else {
			formatted += `**Follow-up ${index}:** ${exchange.question}\n\n`;
			formatted += `**Response:** ${exchange.answer}\n\n`;
		}

		if (index < conversationHistory.length - 1) {
			formatted += '---\n\n';
		}
	});

	return formatted;
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
