/**
 * Direct function wrapper for analyzeTaskComplexity using FastMCP sampling.
 */

// Removed: import { analyzeTaskComplexity } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode,
	readJSON,
	writeJSON // Needed to write the report
} from '../../../../scripts/modules/utils.js';
// Import necessary AI prompt/parsing helpers
import {
	generateComplexityAnalysisPrompt, // Assuming exists
	parseComplexityAnalysis // Assuming exists
} from '../../../../scripts/modules/ai-services.js';
import fs from 'fs';
import path from 'path';

/**
 * Analyze task complexity using FastMCP sampling and generate recommendations
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.outputPath - Explicit absolute path to save the report.
 * @param {string} [args.model] - LLM model hint (client decides actual model).
 * @param {string|number} [args.threshold] - Minimum complexity score to recommend expansion (1-10).
 * @param {boolean} [args.research] - Research hint (handled by client LLM).
 * @param {Object} log - Logger object
 * @param {Object} [context={}] - Context object containing session data for sampling.
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function analyzeTaskComplexityDirect(args, log, context = {}) {
	const { session } = context; // Session is needed for sampling
	const { tasksJsonPath, outputPath, model, threshold, research } = args;

	// --- Input Validation ---
	if (!tasksJsonPath) {
		log.error('analyzeTaskComplexityDirect called without tasksJsonPath');
		return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'tasksJsonPath is required' }, fromCache: false };
	}
	if (!outputPath) {
		log.error('analyzeTaskComplexityDirect called without outputPath');
		return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'outputPath is required' }, fromCache: false };
	}
	if (!session || typeof session.llm?.complete !== 'function') {
		const errorMessage = 'FastMCP sampling function (session.llm.complete) is not available.';
		log.error(errorMessage);
		return { success: false, error: { code: 'SAMPLING_UNAVAILABLE', message: errorMessage }, fromCache: false };
	}

	const tasksPath = tasksJsonPath;
	const resolvedOutputPath = outputPath;
	const useResearch = research === true; // Client LLM handles research
	const thresholdScore = threshold ? parseInt(String(threshold), 10) : 8; // Default threshold

	log.info(`Analyzing task complexity via MCP sampling. Output: ${resolvedOutputPath}, Research hint: ${useResearch}`);

	try {
		// --- Read Task Data ---
		const data = readJSON(tasksPath);
		if (!data || !Array.isArray(data.tasks)) {
			return { success: false, error: { code: 'INVALID_TASKS_FILE', message: `Invalid tasks data in ${tasksPath}` }, fromCache: false };
		}

		// Filter tasks for analysis (e.g., pending tasks)
		// Logic to filter tasks should ideally be shared/imported if complex,
		// but for simplicity, let's assume we analyze all non-done tasks here.
		const tasksToAnalyze = data.tasks.filter(
			(task) => task.status !== 'done' && task.status !== 'completed'
		);

		if (tasksToAnalyze.length === 0) {
			log.info('No tasks found for complexity analysis.');
			// Still create an empty report file
			const emptyReport = { meta: { generatedAt: new Date().toISOString(), tasksAnalyzed: 0 }, complexityAnalysis: [] };
			writeJSON(resolvedOutputPath, emptyReport);
			return { success: true, data: { message: 'No tasks to analyze.', reportPath: resolvedOutputPath, reportSummary: { taskCount: 0 } }, fromCache: false };
		}
		log.info(`Found ${tasksToAnalyze.length} tasks for complexity analysis.`);

		// --- Start of Refactored Logic ---

		// 1. Construct Prompt
		// Assumes generateComplexityAnalysisPrompt exists
		const analysisPrompt = generateComplexityAnalysisPrompt(tasksToAnalyze, thresholdScore, useResearch);
		if (!analysisPrompt) {
			throw new Error('Failed to generate the prompt for complexity analysis.');
		}
		log.info('Generated complexity analysis prompt for sampling.');

		// 2. Call FastMCP Sampling
		let completionText;
		try {
			log.info('Initiating FastMCP LLM sampling via client...');
			// Note: Complexity analysis might benefit from a system prompt, adjust if needed
			const completion = await session.llm.complete(analysisPrompt);
			log.info('Received completion from client LLM.');
			completionText = completion?.content;
			if (!completionText) {
				throw new Error('Received empty completion from client LLM via sampling.');
			}
		} catch (error) {
			log.error(`LLM sampling failed: ${error.message}`);
			throw new Error(`Failed to get completion via sampling: ${error.message}`);
		}

		// 3. Parse Completion
		let analysisResults;
		try {
			// Assumes parseComplexityAnalysis exists and returns the array of analysis objects
			analysisResults = parseComplexityAnalysis(completionText);
			if (!Array.isArray(analysisResults)) {
				throw new Error('Parsing did not return a valid array of complexity analysis results.');
			}
			log.info(`Parsed ${analysisResults.length} complexity analysis results from completion.`);
		} catch (error) {
			log.error(`Failed to parse LLM completion: ${error.message}`);
			throw new Error(`Failed to parse LLM completion: ${error.message}`);
		}

		// 4. Construct and Save Report
		const report = {
			meta: {
				generatedAt: new Date().toISOString(),
				tasksAnalyzed: tasksToAnalyze.length,
				thresholdScore,
				projectName: data.meta?.projectName || 'Unknown Project', // Get from tasks.json meta if possible
				usedResearch // Include research hint used for prompt generation
			},
			complexityAnalysis: analysisResults
		};

		// Ensure output directory exists
		const outputDir = path.dirname(resolvedOutputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}
		writeJSON(resolvedOutputPath, report);
		log.info(`Complexity analysis report saved to: ${resolvedOutputPath}`);

		// --- End of Refactored Logic ---

		// 5. Calculate Summary and Return Result
		const highComplexityTasks = analysisResults.filter(
			(t) => t.complexityScore >= 8
		).length;
		const mediumComplexityTasks = analysisResults.filter(
			(t) => t.complexityScore >= 5 && t.complexityScore < 8
		).length;
		const lowComplexityTasks = analysisResults.filter(
			(t) => t.complexityScore < 5
		).length;

		return {
			success: true,
			data: {
				message: `Task complexity analysis complete via sampling. Report saved to ${resolvedOutputPath}`,
				reportPath: resolvedOutputPath,
				reportSummary: {
					taskCount: analysisResults.length,
					highComplexityTasks,
					mediumComplexityTasks,
					lowComplexityTasks
				}
			},
			fromCache: false // Analysis should generally not be cached this way
		};

	} catch (error) {
		log.error(`Error during MCP analyzeTaskComplexityDirect: ${error.message}`);
		log.error(error.stack);
		return {
			success: false,
			error: {
				code: 'ANALYZE_SAMPLING_ERROR',
				message: error.message || 'Unknown error during complexity analysis via sampling'
			},
			fromCache: false
		};
	}
}
