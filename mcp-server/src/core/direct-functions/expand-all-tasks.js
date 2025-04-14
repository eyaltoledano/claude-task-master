/**
 * Direct function wrapper for expandAllTasks using the provider.
 */

// Removed direct import of expandAllTasks, utils, AI client utils
import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import { log as mcpLogUtil } from '../../../../scripts/modules/utils.js';

/**
 * Expand all pending tasks with subtasks using the configured provider.
 * @param {Object} args - Function arguments
 * @param {string} [args.file] - Optional path to the tasks file (for local provider).
 * @param {number|string} [args.num] - Number of subtasks to generate per task.
 * @param {boolean} [args.research] - Enable Perplexity AI for research-backed subtask generation.
 * @param {string} [args.prompt] - Additional context to guide subtask generation.
 * @param {boolean} [args.force] - Force regeneration of subtasks for tasks that already have them.
 * @param {Object} log - Logger object provided by MCP framework
 * @param {Object} context - Context object containing session
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function expandAllTasksDirect(args, log, context = {}) {
	const { session } = context;
	// Destructure expected args, using 'file' instead of 'tasksJsonPath'
	const { file, num, research, prompt, force } = args;

	// Process parameters
	const numSubtasks = num !== undefined ? parseInt(String(num), 10) : undefined;
    if (num !== undefined && isNaN(numSubtasks)) {
        log.error(`Invalid value provided for num: ${num}. Must be a number.`);
        return {
            success: false,
            error: {
                code: 'INPUT_VALIDATION_ERROR',
                message: `Invalid value provided for num: ${num}. Must be a number.`
            }
        };
    }
	const useResearch = research === true;
	const additionalContext = prompt || '';
	const forceFlag = force === true;

	try {
		log.info(`[expandAllTasksDirect] Requesting provider to expand all tasks. Options: ${JSON.stringify({ numSubtasks, useResearch, additionalContext, forceFlag, file })}`);

		const provider = await getTaskProvider();
		const providerOptions = {
			file,
			mcpLog: log,
			session,
			force: forceFlag
		};

		// Call the provider's expandAllTasks method
		// Assumes provider method signature: expandAllTasks(numSubtasks, useResearch, additionalContext, options)
		const result = await provider.expandAllTasks(
			numSubtasks,
			useResearch,
			additionalContext,
			providerOptions
		);

		// Handle the result from the provider
		if (result && result.success) {
			log.info(
				`Provider successfully expanded tasks: ${result.data?.message || 'Operation completed.'}`
			);
			return {
				success: true,
				data: result.data || { message: 'All eligible tasks expanded successfully.' },
				fromCache: false // Operation modifies state
			};
		} else {
		    const errorMsg = result?.error?.message || 'Provider failed to expand all tasks.';
			log.error(`Provider error expanding all tasks: ${errorMsg}`);
			return {
				success: false,
				error: result?.error || { code: 'PROVIDER_ERROR', message: errorMsg },
				fromCache: false
			};
		}

	} catch (error) {
		// Catch errors during provider retrieval or execution
		log.error(`Error in expandAllTasksDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'MCP_DIRECT_FUNCTION_ERROR',
				message: error.message || 'An unexpected error occurred while expanding all tasks.'
			},
			fromCache: false
		};
	}
}
