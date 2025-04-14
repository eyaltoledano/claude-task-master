import JiraTaskManager from './jira-task-manager.js';
import { CONFIG, log } from './utils.js';

// Import LOCAL task functions (non-AI, non-dependency)
import {
	generateTaskFiles as localGenerateTaskFiles,
	setTaskStatus as localSetTaskStatus,
	listTasks as localGetTasks,
	findTaskById as localGetTask,
	addTask as localAddTask,
	removeTask as localRemoveTask,
	addSubtask as localAddSubtask,
	removeSubtask as localRemoveSubtask,
	clearSubtasks as localClearSubtasks,
	generateComplexityReport as localGenerateComplexityReport
} from './local-task-manager.js';

// Import DEPENDENCY management functions
import {
	addDependency,
	removeDependency,
	validateDependenciesCommand,
	fixDependenciesCommand
} from './dependency-manager.js';

// Import CORE functions (potentially AI-related or complex logic)
import {
	analyzeTaskComplexity,
	expandTask,
	findNextTask as getNextTask,
	updateSubtaskById,
	updateTaskById
} from './task-manager.js';

/**
 * Creates and returns the appropriate task provider instance based on configuration.
 *
 * @param {Object} [options={}] - Optional configuration for the factory.
 * @param {Object} [options.jiraMcpTools] - Required if providerType is 'jira'. An object containing the Jira MCP tool functions (e.g., { search, get_issue, ... }).
 * @returns {Promise<object>} The instantiated task provider object (conforming to ITaskManager).
 * @throws {Error} If the configuration is invalid or the provider cannot be initialized.
 */
async function getTaskProvider(options = {}) {
	const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
	log('info', `Initializing task provider: ${providerType}`);

	if (providerType === 'jira') {
		if (!CONFIG.JIRA_PROJECT_KEY) {
			log('error', 'JIRA_PROJECT_KEY environment variable is required when TASK_PROVIDER is set to "jira".');
			throw new Error('Jira provider configuration is incomplete (missing JIRA_PROJECT_KEY).');
		}

		const jiraMcpTools = options.jiraMcpTools;
		if (!jiraMcpTools) {
			 log('error', 'Jira provider selected, but MCP tools were not provided to getTaskProvider factory.');
			 throw new Error('Failed to get required Jira MCP tool implementations for the factory.');
		}

		try {
			const jiraConfig = {
				projectKey: CONFIG.JIRA_PROJECT_KEY,
				subtaskTypeName: CONFIG.JIRA_SUBTASK_TYPE_NAME || 'Sub-task',
			};
			log('debug', 'Creating JiraTaskManager instance with config:', jiraConfig);
			return new JiraTaskManager(jiraConfig, jiraMcpTools);
		} catch (error) {
			log('error', `Failed to initialize JiraTaskManager: ${error.message}`);
			throw error;
		}
	} else if (providerType === 'local') {
		log('debug', 'Creating Local Provider Object from exported functions.');
		// Construct the local provider object using functions from correct modules
		return {
			// Core Task Operations (from local-task-manager.js)
			getTasks: localGetTasks,
			getTask: localGetTask,
			addTask: localAddTask,
			updateTask: updateTaskById,
			removeTask: localRemoveTask,
			setTaskStatus: localSetTaskStatus,
			// Subtask Operations (from local-task-manager.js)
			addSubtask: localAddSubtask,
			removeSubtask: localRemoveSubtask,
			clearSubtasks: localClearSubtasks,
			updateSubtask: updateSubtaskById,
			// Dependency Operations (from dependency-manager.js)
			addDependency: addDependency,
			removeDependency: removeDependency,
			validateDependencies: validateDependenciesCommand,
			fixDependencies: fixDependenciesCommand,
			// Other Operations needing core logic (from task-manager.js)
			getNextTask: getNextTask,
			expandTask: expandTask,
			analyzeTaskComplexity: analyzeTaskComplexity,
			// Local-specific file operations
			generateComplexityReport: localGenerateComplexityReport,
			generateTaskFiles: localGenerateTaskFiles
		};
	} else {
		log('error', `Unsupported TASK_PROVIDER: ${providerType}. Please use 'local' or 'jira'.`);
		throw new Error(`Invalid TASK_PROVIDER specified: ${providerType}`);
	}
}

export { getTaskProvider }; 