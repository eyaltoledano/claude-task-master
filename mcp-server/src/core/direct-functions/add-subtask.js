/**
 * Direct function wrapper for addSubtask using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js'; // Use the factory
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG
} from '../../../../scripts/modules/utils.js';

/**
 * Add a subtask to an existing task via configured provider.
 * @param {Object} args - Function arguments
 * @param {string} args.projectRoot - Project root directory.
 * @param {string} args.parent - Parent task ID/Key (Required).
 * @param {string} args.id - Task ID to convert to subtask (Required if not converting).
 * @param {string} [args.title] - Title for new subtask (Required if not converting).
 * @param {string} [args.description] - Description for new subtask.
 * @param {string} [args.details] - Implementation details for new subtask.
 * @param {string} [args.status] - Status for new subtask (default: 'pending').
 * @param {string} [args.dependencies] - Comma-separated list of dependency IDs.
 * @param {boolean} [args.skipGenerate] - Skip regenerating task files (Local provider only).
 * @param {string} [args.file] - Optional path to tasks file (for local provider).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<{success: boolean, data?: Object, error?: { code: string, message: string }}>}
 */
export async function addSubtaskDirect(args, log, context = {}) {
	const { session } = context;
	const {
		projectRoot,
		parent: parentId, // Renamed for clarity
		id: taskIdToConvert, // Renamed for clarity
		title,
		description,
		details,
		status,
		dependencies: dependenciesStr,
		skipGenerate,
        file // Added file argument
	} = args;

	try {
		log.info(`Adding subtask with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
            log.warn('addSubtaskDirect called without projectRoot.');
		}
		if (!parentId) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Parent Task ID (parent) is required' } };
		}
		// Either taskIdToConvert or title must be provided
		if (!taskIdToConvert && !title) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Either Task ID to convert (id) or Subtask Title (title) is required' } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to add subtask to parent ${parentId}.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's addSubtask method
			// Likely requires: create_issue, get_issue, update_issue, search
			const requiredTools = ['create_issue', 'get_issue', 'update_issue', 'search']; // Adjust as needed
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

		// Prepare shared data
		const dependenciesArray = dependenciesStr
            ? String(dependenciesStr).split(',').map(id => id.trim())
            : [];

		// Create logger wrapper
        const logWrapper = {
            info: (message, ...rest) => log.info(message, ...rest),
            warn: (message, ...rest) => log.warn(message, ...rest),
            error: (message, ...rest) => log.error(message, ...rest),
            debug: (message, ...rest) => log.debug && log.debug(message, ...rest),
            success: (message, ...rest) => log.info(message, ...rest)
        };

		enableSilentMode(); // Consider removing
		try {
            const provider = await getTaskProvider({ jiraMcpTools });
            const providerOptions = {
                file,
                skipGenerate, // Pass skipGenerate flag
                mcpLog: logWrapper,
                session
            };

			let newSubtaskData = null;
            // taskIdToConvert is primarily for the local provider's internal logic
            // The provider method should handle this distinction.
			const taskIdToConvert = taskIdToConvert;

			if (!taskIdToConvert) {
				// Prepare data for creating a NEW subtask
				newSubtaskData = {
					title: title,
					description: description || '',
					details: details || '',
					status: status || 'pending',
					dependencies: dependenciesArray
				};
				log.info(`Requesting provider to create new subtask under ${parentId}`);
			} else {
                // Let the provider handle conversion if supported (likely local only)
				log.info(`Requesting provider to convert task ${taskIdToConvert} to a subtask of ${parentId}`);
			}

			// Call the provider's addSubtask method
            // Assuming signature: addSubtask(parentId, taskIdToConvert, newSubtaskData, options)
			const addResult = await provider.addSubtask(
				parentId,
				taskIdToConvert, // Pass ID to convert (provider implementation ignores if not local)
				newSubtaskData, // Pass new subtask data (provider ignores if converting)
				providerOptions
			);

			disableSilentMode();

            // Check provider result
            if (addResult && addResult.success && addResult.data?.subtask) {
                const resultSubtask = addResult.data.subtask;
                const message = taskIdToConvert
                    ? `Provider handled conversion of task ${taskIdToConvert} to subtask ${resultSubtask.id || '(new ID)'} under parent ${parentId}`
                    : `Provider successfully created new subtask ${resultSubtask.id} under parent ${parentId}`;
                log.info(message);
                return {
                    success: true,
                    data: {
                        message: message,
                        subtask: resultSubtask // Return the created/modified subtask object
                    },
                    fromCache: false // State modification
                };
            } else {
                 const errorMsg = addResult?.error?.message || 'Provider failed to add subtask.';
                 const errorCode = addResult?.error?.code || 'PROVIDER_ERROR';
                 log.error(`Provider error adding subtask: ${errorMsg} (Code: ${errorCode})`);
                 return {
                    success: false,
                    error: addResult?.error || { code: errorCode, message: errorMsg },
                    fromCache: false
                 };
            }
		} catch (error) {
			disableSilentMode();
			log.error(`Error calling provider addSubtask: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_ADD_SUBTASK_ERROR',
					message: error.message || 'Failed to add subtask'
				},
				fromCache: false // Not applicable
			};
		} finally {
			if (isSilentMode()) {
                disableSilentMode();
            }
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in addSubtaskDirect: ${error.message}`);
		if (isSilentMode()) {
			disableSilentMode();
		}
		return {
			success: false,
			error: { code: 'DIRECT_FUNCTION_SETUP_ERROR', message: error.message },
			fromCache: false // Not applicable
		};
	}
}
