/**
 * research.js
 * Direct function implementation for AI-powered research queries
 */

import { performResearch } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for performing AI-powered research with project context.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.query - Research query/prompt (required)
 * @param {string} [args.taskIds] - Comma-separated list of task/subtask IDs for context
 * @param {string} [args.filePaths] - Comma-separated list of file paths for context
 * @param {string} [args.customContext] - Additional custom context text
 * @param {boolean} [args.includeProjectTree=false] - Include project file tree in context
 * @param {string} [args.detailLevel='medium'] - Detail level: 'low', 'medium', 'high'
 * @param {string} [args.projectRoot] - Project root path
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context (session)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function researchDirect(args, log, context = {}) {
	// Destructure expected args
	const {
		query,
		taskIds,
		filePaths,
		customContext,
		includeProjectTree = false,
		detailLevel = 'medium',
		projectRoot
	} = args;
	const { session } = context; // Destructure session from context

	// Enable silent mode to prevent console logs from interfering with JSON response
	enableSilentMode();

	// Create logger wrapper using the utility
	const mcpLog = createLogWrapper(log);

	try {
		// Check required parameters
		if (!query || typeof query !== 'string' || query.trim().length === 0) {
			log.error('Missing or invalid required parameter: query');
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'MISSING_PARAMETER',
					message:
						'The query parameter is required and must be a non-empty string'
				}
			};
		}

		// Parse comma-separated task IDs if provided
		const parsedTaskIds = taskIds
			? taskIds
					.split(',')
					.map((id) => id.trim())
					.filter((id) => id.length > 0)
			: [];

		// Parse comma-separated file paths if provided
		const parsedFilePaths = filePaths
			? filePaths
					.split(',')
					.map((path) => path.trim())
					.filter((path) => path.length > 0)
			: [];

		// Validate detail level
		const validDetailLevels = ['low', 'medium', 'high'];
		if (!validDetailLevels.includes(detailLevel)) {
			log.error(`Invalid detail level: ${detailLevel}`);
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'INVALID_PARAMETER',
					message: `Detail level must be one of: ${validDetailLevels.join(', ')}`
				}
			};
		}

		log.info(
			`Performing research query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}", ` +
				`taskIds: [${parsedTaskIds.join(', ')}], ` +
				`filePaths: [${parsedFilePaths.join(', ')}], ` +
				`detailLevel: ${detailLevel}, ` +
				`includeProjectTree: ${includeProjectTree}, ` +
				`projectRoot: ${projectRoot}`
		);

		// Prepare options for the research function
		const researchOptions = {
			taskIds: parsedTaskIds,
			filePaths: parsedFilePaths,
			customContext: customContext || '',
			includeProjectTree,
			detailLevel,
			projectRoot
		};

		// Prepare context for the research function
		const researchContext = {
			session,
			mcpLog,
			commandName: 'research',
			outputType: 'mcp'
		};

		// Call the performResearch function
		const result = await performResearch(
			query.trim(),
			researchOptions,
			researchContext,
			'json', // outputFormat - use 'json' to suppress CLI UI
			false // allowFollowUp - disable for MCP calls
		);

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				query: result.query,
				result: result.result,
				contextSize: result.contextSize,
				contextTokens: result.contextTokens,
				tokenBreakdown: result.tokenBreakdown,
				systemPromptTokens: result.systemPromptTokens,
				userPromptTokens: result.userPromptTokens,
				totalInputTokens: result.totalInputTokens,
				detailLevel: result.detailLevel,
				telemetryData: result.telemetryData
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in researchDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: error.code || 'RESEARCH_ERROR',
				message: error.message
			}
		};
	}
}
