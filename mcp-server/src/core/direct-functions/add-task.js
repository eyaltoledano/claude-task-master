/**
 * add-task.js
 * Direct function implementation for adding a new task using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG
} from '../../../../scripts/modules/utils.js';
import {
	getAnthropicClientForMCP,
	getModelConfig
} from '../utils/ai-client-utils.js';
import {
	_buildAddTaskPrompt,
	parseTaskJsonResponse,
	_handleAnthropicStream
} from '../../../../scripts/modules/ai-services.js';

/**
 * Direct function wrapper for adding a new task via configured provider.
 *
 * @param {Object} args - Command arguments
 * @param {string} [args.prompt] - Description of the task to add (required if not using manual fields)
 * @param {string} [args.title] - Task title (for manual task creation)
 * @param {string} [args.description] - Task description (for manual task creation)
 * @param {string} [args.details] - Implementation details (for manual task creation)
 * @param {string} [args.testStrategy] - Test strategy (for manual task creation)
 * @param {string} [args.dependencies] - Comma-separated list of task IDs/Keys this task depends on
 * @param {string} [args.priority='medium'] - Task priority (high, medium, low)
 * @param {string} [args.projectRoot] - Project root directory
 * @param {boolean} [args.research=false] - Whether to use research capabilities for task creation (handled by provider)
 * @param {string} [args.file] - Optional path to tasks file (for local provider).
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function addTaskDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, prompt, dependencies, priority, research, file } = args;

	try {
		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('addTaskDirect called without projectRoot.');
		}
		const isManualCreation = args.title && args.description;
		if (!prompt && !isManualCreation) {
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'Either prompt or (title and description) must be provided.'
				}
			};
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's addTask method
			// Likely requires: create_issue, search, get_issue
			const requiredTools = ['create_issue', 'search', 'get_issue']; // Adjust as needed
			for (const toolName of requiredTools) {
				const fullToolName = `${toolPrefix}_${toolName}`;
				if (typeof global[fullToolName] === 'function') {
					jiraMcpTools[toolName] = global[fullToolName];
				} else {
					log.warn(`Jira MCP tool function not found in global scope: ${fullToolName}`);
				}
			}
			log.debug('Prepared Jira MCP Tools for factory:', Object.keys(jiraMcpTools));
		}
		// --- End Jira MCP Tools Preparation ---

		const logWrapper = {
			info: (message, ...rest) => log.info(message, ...rest),
			warn: (message, ...rest) => log.warn(message, ...rest),
			error: (message, ...rest) => log.error(message, ...rest),
			debug: (message, ...rest) => log.debug && log.debug(message, ...rest),
			success: (message, ...rest) => log.info(message, ...rest)
		};

		const taskDependenciesArray = dependencies
			? String(dependencies).split(',').map(id => id.trim())
				: [];
		const taskPriorityValue = priority || 'medium';

		enableSilentMode();
		try {
			let taskDataPayload;

		if (isManualCreation) {
				taskDataPayload = {
					title: args.title,
					description: args.description,
					details: args.details || '',
					testStrategy: args.testStrategy || '',
					dependencies: taskDependenciesArray,
					priority: taskPriorityValue
				};
				log.info(`Adding new task manually: "${args.title}" via ${providerType} provider`);
		} else {
				// --- AI-Driven Task Creation Path ---
				log.info(`Adding new task via AI with prompt: "${prompt}"`);

				let localAnthropic;
				try {
					localAnthropic = getAnthropicClientForMCP(session, log);
				} catch (error) {
					throw { code: 'AI_CLIENT_ERROR', message: `Cannot initialize AI client: ${error.message}` };
				}

				const modelConfig = getModelConfig(session);
				const tasksContext = [];
				const { systemPrompt, userPrompt } = _buildAddTaskPrompt(prompt, tasksContext);

				let responseText;
				try {
					responseText = await _handleAnthropicStream(
						localAnthropic,
						{
							model: modelConfig.model,
							max_tokens: modelConfig.maxTokens,
							temperature: modelConfig.temperature,
							messages: [{ role: 'user', content: userPrompt }],
							system: systemPrompt
						},
							{ mcpLog: logWrapper }
					);
				} catch (error) {
						throw { code: 'AI_PROCESSING_ERROR', message: `Failed to generate task with AI: ${error.message}` };
				}

				try {
					taskDataPayload = parseTaskJsonResponse(responseText);
					taskDataPayload.dependencies = taskDependenciesArray;
					taskDataPayload.priority = taskPriorityValue;
				} catch (error) {
						throw { code: 'RESPONSE_PARSING_ERROR', message: `Failed to parse AI response: ${error.message}` };
				}
				log.info(`Generated task data via AI, proceeding to add via ${providerType} provider.`);
				// --- End AI Path ---
			}

			// Pass jiraMcpTools in options to the factory
			const provider = await getTaskProvider({ jiraMcpTools });
			const providerOptions = {
				file,
				research,
				mcpLog: logWrapper,
				session
			};

			const addResult = await provider.addTask(taskDataPayload, providerOptions);

			disableSilentMode();

			if (addResult && addResult.success && addResult.data?.task) {
				const newTask = addResult.data.task;
				log.info(`Provider successfully added new task ${newTask.id || '(unknown ID)'} via ${providerType}`);
				return {
					success: true,
					data: {
						taskId: newTask.id,
						task: newTask,
						message: `Successfully added new task ${newTask.id || '(unknown ID)'}`
					},
					fromCache: false
				};
			} else {
				const errorMsg = addResult?.error?.message || 'Provider failed to add task.';
				const errorCode = addResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error adding task: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: addResult?.error || { code: errorCode, message: errorMsg }
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error during add task process: ${error.code || 'Unknown code'} - ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'ADD_TASK_DIRECT_ERROR',
					message: error.message || 'Failed to add task'
				}
			};
		} finally {
			if (isSilentMode()) {
				disableSilentMode();
			}
		}
	} catch (error) {
		log.error(`Outer error in addTaskDirect: ${error.message}`);
		if (isSilentMode()) {
			disableSilentMode();
		}
		return {
			success: false,
			error: { code: 'DIRECT_FUNCTION_SETUP_ERROR', message: error.message },
			fromCache: false
		};
	}
}

