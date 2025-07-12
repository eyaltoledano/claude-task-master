import path from 'path';
import fs from 'fs';
import { writeJSON, readJSON } from '../../../../scripts/modules/utils.js'; // Path relative to new file
import { COMPLEXITY_REPORT_FILE } from '../../../../src/constants/paths.js'; // Path relative to new file
import { getProjectName } from '../../../../scripts/modules/config-manager.js'; // For metadata

/**
 * Saves complexity report data (typically from an agent) to task-complexity-report.json.
 *
 * @param {any} agentOutput - The data received from the agent (finalLLMOutput).
 *                            Expected to be an array of complexity analysis items,
 *                            or a string that can be parsed into such an array.
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {Object} logWrapper - Logger object (e.g., from MCP context).
 * @param {Object} originalToolArgs - Original arguments passed to the 'analyze_project_complexity' tool,
 *                                    containing threshold, research flag, specific IDs/ranges.
 * @returns {Promise<Object>} Result object with { success: true, outputPath } or { success: false, error: string }.
 */
async function saveComplexityReportFromAgent(
	agentOutput,
	projectRoot,
	logWrapper,
	originalToolArgs
) {
	logWrapper.info(
		`saveComplexityReportFromAgent: Saving complexity report from agent.`
	);

	const outputPath = path.resolve(projectRoot, COMPLEXITY_REPORT_FILE);
	const outputDir = path.dirname(outputPath);

	try {
		let agentComplexityAnalysis;
		if (typeof agentOutput === 'string') {
			logWrapper.info(
				'saveComplexityReportFromAgent: Agent output is a string, attempting to parse as JSON array.'
			);
			try {
				// The agent is prompted to return a JSON array directly for complexity analysis.
				let cleanedResponse = agentOutput.trim();
				const codeBlockMatch = cleanedResponse.match(
					/```(?:json)?\s*([\s\S]*?)\s*```/
				);
				if (codeBlockMatch && codeBlockMatch[1]) {
					cleanedResponse = codeBlockMatch[1].trim();
				} else {
					const firstBracket = cleanedResponse.indexOf('[');
					const lastBracket = cleanedResponse.lastIndexOf(']');
					if (firstBracket !== -1 && lastBracket > firstBracket) {
						cleanedResponse = cleanedResponse.substring(
							firstBracket,
							lastBracket + 1
						);
					}
				}
				agentComplexityAnalysis = JSON.parse(cleanedResponse);
			} catch (parseError) {
				logWrapper.error(
					`saveComplexityReportFromAgent: Error parsing JSON from agent output string: ${parseError.message}`
				);
				return {
					success: false,
					error: `Failed to parse agent output string: ${parseError.message}`
				};
			}
		} else if (Array.isArray(agentOutput)) {
			logWrapper.info(
				'saveComplexityReportFromAgent: Agent output is already an array.'
			);
			agentComplexityAnalysis = agentOutput;
		} else if (agentOutput && Array.isArray(agentOutput.complexityAnalysis)) {
			// If agent returns the full report structure
			logWrapper.info(
				"saveComplexityReportFromAgent: Agent output is an object with a 'complexityAnalysis' array."
			);
			agentComplexityAnalysis = agentOutput.complexityAnalysis;
			// Potentially use agentOutput.meta if provided and trustworthy
		} else {
			const errorMsg =
				"Invalid agentOutput format. Expected a JSON string of analysis items, an array, or an object with 'complexityAnalysis' array.";
			logWrapper.error(
				`saveComplexityReportFromAgent: ${errorMsg} Received: ${JSON.stringify(agentOutput)}`
			);
			return { success: false, error: errorMsg };
		}

		if (!Array.isArray(agentComplexityAnalysis)) {
			const errorMsg = `Processed agent output is not an array: ${JSON.stringify(agentComplexityAnalysis)}`;
			logWrapper.error(`saveComplexityReportFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		// Read existing report to merge if specific IDs/ranges were used for this agent analysis
		let existingReport = null;
		let finalComplexityAnalysis = agentComplexityAnalysis;
		const analyzeSpecificTasks =
			originalToolArgs?.ids ||
			originalToolArgs?.from !== undefined ||
			originalToolArgs?.to !== undefined;

		if (fs.existsSync(outputPath)) {
			existingReport = readJSON(outputPath);
			if (
				existingReport &&
				Array.isArray(existingReport.complexityAnalysis) &&
				analyzeSpecificTasks
			) {
				logWrapper.info(
					'saveComplexityReportFromAgent: Merging agent analysis with existing report due to specific task analysis.'
				);
				const agentAnalyzedTaskIds = new Set(
					agentComplexityAnalysis.map((item) => item.taskId)
				);
				const existingEntriesNotReplaced =
					existingReport.complexityAnalysis.filter(
						(item) => !agentAnalyzedTaskIds.has(item.taskId)
					);
				finalComplexityAnalysis = [
					...existingEntriesNotReplaced,
					...agentComplexityAnalysis
				];
			} else {
				// If not analyzing specific tasks, or no valid existing report, agent's full analysis becomes the report.
				// Or if existing report is invalid, overwrite.
				logWrapper.info(
					"saveComplexityReportFromAgent: Overwriting with agent's analysis (not merging or no valid existing report)."
				);
				finalComplexityAnalysis = agentComplexityAnalysis;
			}
		}

		// Construct the report meta block
		// TODO: Determine how to get originalTaskCount if needed for meta, might require passing more original args.
		// For now, tasksAnalyzed will be the count from the agent, totalTasks might be unknown here.
		const reportMeta = {
			generatedAt: new Date().toISOString(),
			tasksAnalyzed: agentComplexityAnalysis.length, // Number of tasks agent analyzed in this run
			analysisCount: finalComplexityAnalysis.length, // Total in the report after merge/overwrite
			thresholdScore: originalToolArgs?.threshold || 5, // Default if not in args
			projectName: getProjectName(null), // Pass session or projectRoot if available to getProjectName
			usedResearch: originalToolArgs?.research || false
		};

		const reportToSave = {
			meta: reportMeta,
			complexityAnalysis: finalComplexityAnalysis.sort(
				(a, b) => a.taskId - b.taskId
			) // Sort by taskId
		};

		if (!fs.existsSync(outputDir)) {
			logWrapper.info(
				`saveComplexityReportFromAgent: Creating output directory: ${outputDir}`
			);
			fs.mkdirSync(outputDir, { recursive: true });
		}

		writeJSON(outputPath, reportToSave);
		logWrapper.info(
			`saveComplexityReportFromAgent: Complexity report successfully written to ${outputPath}`
		);

		return { success: true, outputPath };
	} catch (error) {
		logWrapper.error(
			`saveComplexityReportFromAgent: Error saving complexity report: ${error.message}`
		);
		logWrapper.error(
			`saveComplexityReportFromAgent: Error stack: ${error.stack}`
		);
		return { success: false, error: error.message };
	}
}

export { saveComplexityReportFromAgent };
