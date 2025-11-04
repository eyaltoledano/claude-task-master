import path from 'path';
import fs from 'fs';
import { AgentLLMToolSaver } from './agentllm-base-tool-saver.js';
import { writeJSON, readJSON } from '../../../../scripts/modules/utils.js';
import { COMPLEXITY_REPORT_FILE } from '../../../../src/constants/paths.js';
import { getProjectName } from '../../../../scripts/modules/config-manager.js';

class ComplexityReportSaver extends AgentLLMToolSaver {
	constructor() {
		super('agentllmComplexityReportSave');
	}

	async save(
		agentOutput,
		projectRoot,
		logWrapper,
		originalToolArgs,
		delegatedRequestParams,
		tag = 'master'
	) {
		logWrapper.info(
			`${this.toolName}: Starting save operation for tag '${tag}'.`
		);

		const reportFileName =
			tag === 'master'
				? COMPLEXITY_REPORT_FILE
				: `.taskmaster/reports/task-complexity-report-${tag}.json`;
		const outputPath = path.resolve(projectRoot, reportFileName);
		const outputDir = path.dirname(outputPath);

		try {
			let agentComplexityAnalysis;
			if (typeof agentOutput === 'string') {
				logWrapper.info(
					'agentllmComplexityReportSave: Agent output is a string, attempting to parse as JSON array.'
				);
				try {
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
					const errorMessage = `Failed to parse agent output string: ${parseError.message}`;
					logWrapper.error(
						`agentllmComplexityReportSave: Error parsing JSON from agent output string: ${errorMessage}`
					);
					return { success: false, error: errorMessage };
				}
			} else if (Array.isArray(agentOutput)) {
				logWrapper.info(
					'agentllmComplexityReportSave: Agent output is already an array.'
				);
				agentComplexityAnalysis = agentOutput;
			} else if (agentOutput && Array.isArray(agentOutput.complexityAnalysis)) {
				logWrapper.info(
					"agentllmComplexityReportSave: Agent output is an object with a 'complexityAnalysis' array."
				);
				agentComplexityAnalysis = agentOutput.complexityAnalysis;
			} else {
				const errorMsg =
					"Invalid agentOutput format. Expected a JSON string of analysis items, an array, or an object with 'complexityAnalysis' array.";
				logWrapper.error(
					`agentllmComplexityReportSave: ${errorMsg} Received: ${JSON.stringify(agentOutput)}`
				);
				return { success: false, error: errorMsg };
			}

			if (!Array.isArray(agentComplexityAnalysis)) {
				const errorMsg = `Processed agent output is not an array: ${JSON.stringify(agentComplexityAnalysis)}`;
				logWrapper.error(`agentllmComplexityReportSave: ${errorMsg}`);
				return { success: false, error: errorMsg };
			}

			let existingReport = null;
			let finalComplexityAnalysis = agentComplexityAnalysis;
			const analyzeSpecificTasks =
				originalToolArgs?.ids ||
				originalToolArgs?.from !== undefined ||
				originalToolArgs?.to !== undefined;

			try {
				await fs.promises.access(outputPath);
				existingReport = await readJSON(outputPath, projectRoot, tag);
				if (
					existingReport &&
					Array.isArray(existingReport.complexityAnalysis) &&
					analyzeSpecificTasks
				) {
					logWrapper.info(
						'agentllmComplexityReportSave: Merging agent analysis with existing report due to specific task analysis.'
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
					logWrapper.info(
						"agentllmComplexityReportSave: Overwriting with agent's analysis (not merging or no valid existing report)."
					);
					finalComplexityAnalysis = agentComplexityAnalysis;
				}
			} catch {
				// File doesn't exist, continue without existing report
			}

			const tasksJsonPath = path.resolve(
				projectRoot,
				'.taskmaster/tasks/tasks.json'
			);
			const tasksData = readJSON(tasksJsonPath, projectRoot, tag);
			const projectName =
				tasksData?.metadata?.projectName || getProjectName(projectRoot);

			const reportMeta = {
				generatedAt: new Date().toISOString(),
				tasksAnalyzed: agentComplexityAnalysis.length,
				analysisCount: finalComplexityAnalysis.length,
				thresholdScore: originalToolArgs?.threshold || 5,
				projectName,
				usedResearch: originalToolArgs?.research || false
			};

			const reportToSave = {
				meta: reportMeta,
				complexityAnalysis: finalComplexityAnalysis.sort(
					(a, b) => a.taskId - b.taskId
				)
			};

			try {
				await fs.promises.access(outputDir);
			} catch (error) {
				logWrapper.info(
					`agentllmComplexityReportSave: Creating output directory: ${outputDir}`
				);
				await fs.promises.mkdir(outputDir, { recursive: true });
			}

			await writeJSON(outputPath, reportToSave, projectRoot, tag);
			logWrapper.info(
				`agentllmComplexityReportSave: Complexity report successfully written to ${outputPath} for tag '${tag}'`
			);

			return { success: true, outputPath };
		} catch (error) {
			logWrapper.error(`${this.toolName}: Error: ${error.message}`);
			logWrapper.error(`${this.toolName}: Stack: ${error.stack}`);
			return { success: false, error: error.message };
		}
	}
}

export const agentllmComplexityReportSave = async (...args) =>
	new ComplexityReportSaver().save(...args);
