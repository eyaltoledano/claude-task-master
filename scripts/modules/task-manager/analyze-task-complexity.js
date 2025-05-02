import chalk from 'chalk';
import boxen from 'boxen';
import readline from 'readline';

import { log, readJSON, writeJSON, isSilentMode } from '../utils.js';

import { startLoadingIndicator, stopLoadingIndicator } from '../ui.js';

import { generateTextService } from '../ai-services-unified.js';

import { getDebugFlag, getProjectName } from '../config-manager.js';

/**
 * Generates the prompt for complexity analysis.
 * (Moved from ai-services.js and simplified)
 * @param {Object} tasksData - The tasks data object.
 * @returns {string} The generated prompt.
 */
function generateInternalComplexityAnalysisPrompt(tasksData) {
	const tasksString = JSON.stringify(tasksData.tasks, null, 2);
	return `Analyze the following tasks to determine their complexity (1-10 scale) and recommend the number of subtasks for expansion. Provide a brief reasoning and an initial expansion prompt for each.

Tasks:
${tasksString}

Respond ONLY with a valid JSON array matching the schema:
[
  {
    "taskId": <number>,
    "taskTitle": "<string>",
    "complexityScore": <number 1-10>,
    "recommendedSubtasks": <number>,
    "expansionPrompt": "<string>",
    "reasoning": "<string>"
  },
  ...
]

Do not include any explanatory text, markdown formatting, or code block markers before or after the JSON array.`;
}

/**
 * Analyzes task complexity and generates expansion recommendations
 * @param {Object} options Command options
 * @param {string} options.file - Path to tasks file
 * @param {string} options.output - Path to report output file
 * @param {string|number} [options.threshold] - Complexity threshold
 * @param {boolean} [options.research] - Use research role
 * @param {string} [options.projectRoot] - Project root path (for MCP/env fallback).
 * @param {Object} [options._filteredTasksData] - Pre-filtered task data (internal use)
 * @param {number} [options._originalTaskCount] - Original task count (internal use)
 * @param {Object} context - Context object, potentially containing session and mcpLog
 * @param {Object} [context.session] - Session object from MCP server (optional)
 * @param {Object} [context.mcpLog] - MCP logger object (optional)
 * @param {function} [context.reportProgress] - Deprecated: Function to report progress (ignored)
 */
async function analyzeTaskComplexity(options, context = {}) {
	const { session, mcpLog } = context;
	const tasksPath = options.file || 'tasks/tasks.json';
	const outputPath = options.output || 'scripts/task-complexity-report.json';
	const thresholdScore = parseFloat(options.threshold || '5');
	const useResearch = options.research || false;
	const projectRoot = options.projectRoot;

	const outputFormat = mcpLog ? 'json' : 'text';

	const reportLog = (message, level = 'info') => {
		if (mcpLog) {
			mcpLog[level](message);
		} else if (!isSilentMode() && outputFormat === 'text') {
			log(level, message);
		}
	};

	if (outputFormat === 'text') {
		console.log(
			chalk.blue(
				`Analyzing task complexity and generating expansion recommendations...`
			)
		);
	}

	try {
		reportLog(`Reading tasks from ${tasksPath}...`, 'info');
		let tasksData;
		let originalTaskCount = 0;

		if (options._filteredTasksData) {
			tasksData = options._filteredTasksData;
			originalTaskCount = options._originalTaskCount || tasksData.tasks.length;
			if (!options._originalTaskCount) {
				try {
					const originalData = readJSON(tasksPath);
					if (originalData && originalData.tasks) {
						originalTaskCount = originalData.tasks.length;
					}
				} catch (e) {
					log('warn', `Could not read original tasks file: ${e.message}`);
				}
			}
		} else {
			tasksData = readJSON(tasksPath);
			if (
				!tasksData ||
				!tasksData.tasks ||
				!Array.isArray(tasksData.tasks) ||
				tasksData.tasks.length === 0
			) {
				throw new Error('No tasks found in the tasks file');
			}
			originalTaskCount = tasksData.tasks.length;
			const activeStatuses = ['pending', 'blocked', 'in-progress'];
			const filteredTasks = tasksData.tasks.filter((task) =>
				activeStatuses.includes(task.status?.toLowerCase() || 'pending')
			);
			tasksData = {
				...tasksData,
				tasks: filteredTasks,
				_originalTaskCount: originalTaskCount
			};
		}

		const skippedCount = originalTaskCount - tasksData.tasks.length;
		reportLog(
			`Found ${originalTaskCount} total tasks in the task file.`,
			'info'
		);
		if (skippedCount > 0) {
			const skipMessage = `Skipping ${skippedCount} tasks marked as done/cancelled/deferred. Analyzing ${tasksData.tasks.length} active tasks.`;
			reportLog(skipMessage, 'info');
			if (outputFormat === 'text') {
				console.log(chalk.yellow(skipMessage));
			}
		}

		if (tasksData.tasks.length === 0) {
			const emptyReport = {
				meta: {
					generatedAt: new Date().toISOString(),
					tasksAnalyzed: 0,
					thresholdScore: thresholdScore,
					projectName: getProjectName(session),
					usedResearch: useResearch
				},
				complexityAnalysis: []
			};
			reportLog(`Writing empty complexity report to ${outputPath}...`, 'info');
			writeJSON(outputPath, emptyReport);
			reportLog(
				`Task complexity analysis complete. Report written to ${outputPath}`,
				'success'
			);
			if (outputFormat === 'text') {
				console.log(
					chalk.green(
						`Task complexity analysis complete. Report written to ${outputPath}`
					)
				);
				const highComplexity = 0;
				const mediumComplexity = 0;
				const lowComplexity = 0;
				const totalAnalyzed = 0;

				console.log('\nComplexity Analysis Summary:');
				console.log('----------------------------');
				console.log(`Tasks in input file: ${originalTaskCount}`);
				console.log(`Tasks successfully analyzed: ${totalAnalyzed}`);
				console.log(`High complexity tasks: ${highComplexity}`);
				console.log(`Medium complexity tasks: ${mediumComplexity}`);
				console.log(`Low complexity tasks: ${lowComplexity}`);
				console.log(
					`Sum verification: ${highComplexity + mediumComplexity + lowComplexity} (should equal ${totalAnalyzed})`
				);
				console.log(`Research-backed analysis: ${useResearch ? 'Yes' : 'No'}`);
				console.log(
					`\nSee ${outputPath} for the full report and expansion commands.`
				);

				console.log(
					boxen(
						chalk.white.bold('Suggested Next Steps:') +
							'\n\n' +
							`${chalk.cyan('1.')} Run ${chalk.yellow('task-master complexity-report')} to review detailed findings\n` +
							`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down complex tasks\n` +
							`${chalk.cyan('3.')} Run ${chalk.yellow('task-master expand --all')} to expand all pending tasks based on complexity`,
						{
							padding: 1,
							borderColor: 'cyan',
							borderStyle: 'round',
							margin: { top: 1 }
						}
					)
				);
			}
			return emptyReport;
		}

		const prompt = generateInternalComplexityAnalysisPrompt(tasksData);
		// System prompt remains simple for text generation
		const systemPrompt =
			'You are an expert software architect and project manager analyzing task complexity. Respond only with the requested valid JSON array.';

		let loadingIndicator = null;
		if (outputFormat === 'text') {
			loadingIndicator = startLoadingIndicator('Calling AI service...');
		}

		let fullResponse = ''; // To store the raw text response

		try {
			const role = useResearch ? 'research' : 'main';
			reportLog(`Using AI service with role: ${role}`, 'info');

			fullResponse = await generateTextService({
				prompt,
				systemPrompt,
				role,
				session,
				projectRoot
			});

			reportLog(
				'Successfully received text response via AI service',
				'success'
			);

			// --- Stop Loading Indicator (Unchanged) ---
			if (loadingIndicator) {
				stopLoadingIndicator(loadingIndicator);
				loadingIndicator = null;
			}
			if (outputFormat === 'text') {
				readline.clearLine(process.stdout, 0);
				readline.cursorTo(process.stdout, 0);
				console.log(
					chalk.green('AI service call complete. Parsing response...')
				);
			}
			// --- End Stop Loading Indicator ---

			// --- Re-introduce Manual JSON Parsing & Cleanup ---
			reportLog(`Parsing complexity analysis from text response...`, 'info');
			let complexityAnalysis;
			try {
				let cleanedResponse = fullResponse;
				// Basic trim first
				cleanedResponse = cleanedResponse.trim();

				// Remove potential markdown code block fences
				const codeBlockMatch = cleanedResponse.match(
					/```(?:json)?\s*([\s\S]*?)\s*```/
				);
				if (codeBlockMatch) {
					cleanedResponse = codeBlockMatch[1].trim(); // Trim content inside block
					reportLog('Extracted JSON from code block', 'info');
				} else {
					// If no code block, ensure it starts with '[' and ends with ']'
					// This is less robust but a common fallback
					const firstBracket = cleanedResponse.indexOf('[');
					const lastBracket = cleanedResponse.lastIndexOf(']');
					if (firstBracket !== -1 && lastBracket > firstBracket) {
						cleanedResponse = cleanedResponse.substring(
							firstBracket,
							lastBracket + 1
						);
						reportLog('Extracted content between first [ and last ]', 'info');
					} else {
						reportLog(
							'Warning: Response does not appear to be a JSON array.',
							'warn'
						);
						// Keep going, maybe JSON.parse can handle it or will fail informatively
					}
				}

				if (outputFormat === 'text' && getDebugFlag(session)) {
					console.log(chalk.gray('Attempting to parse cleaned JSON...'));
					console.log(chalk.gray('Cleaned response (first 100 chars):'));
					console.log(chalk.gray(cleanedResponse.substring(0, 100)));
					console.log(chalk.gray('Last 100 chars:'));
					console.log(
						chalk.gray(cleanedResponse.substring(cleanedResponse.length - 100))
					);
				}

				try {
					complexityAnalysis = JSON.parse(cleanedResponse);
				} catch (jsonError) {
					reportLog(
						'Initial JSON parsing failed. Raw response might be malformed.',
						'error'
					);
					reportLog(`Original JSON Error: ${jsonError.message}`, 'error');
					if (outputFormat === 'text' && getDebugFlag(session)) {
						console.log(chalk.red('--- Start Raw Malformed Response ---'));
						console.log(chalk.gray(fullResponse));
						console.log(chalk.red('--- End Raw Malformed Response ---'));
					}
					// Re-throw the specific JSON parsing error
					throw new Error(
						`Failed to parse JSON response: ${jsonError.message}`
					);
				}

				// Ensure it's an array after parsing
				if (!Array.isArray(complexityAnalysis)) {
					throw new Error('Parsed response is not a valid JSON array.');
				}
			} catch (error) {
				// Catch errors specifically from the parsing/cleanup block
				if (loadingIndicator) stopLoadingIndicator(loadingIndicator); // Ensure indicator stops
				reportLog(
					`Error parsing complexity analysis JSON: ${error.message}`,
					'error'
				);
				if (outputFormat === 'text') {
					console.error(
						chalk.red(
							`Error parsing complexity analysis JSON: ${error.message}`
						)
					);
				}
				throw error; // Re-throw parsing error
			}
			// --- End Manual JSON Parsing & Cleanup ---

			// --- Post-processing (Missing Task Check) - (Unchanged) ---
			const taskIds = tasksData.tasks.map((t) => t.id);
			const analysisTaskIds = complexityAnalysis.map((a) => a.taskId);
			const missingTaskIds = taskIds.filter(
				(id) => !analysisTaskIds.includes(id)
			);

			if (missingTaskIds.length > 0) {
				reportLog(
					`Missing analysis for ${missingTaskIds.length} tasks: ${missingTaskIds.join(', ')}`,
					'warn'
				);
				if (outputFormat === 'text') {
					console.log(
						chalk.yellow(
							`Missing analysis for ${missingTaskIds.length} tasks: ${missingTaskIds.join(', ')}`
						)
					);
				}
				for (const missingId of missingTaskIds) {
					const missingTask = tasksData.tasks.find((t) => t.id === missingId);
					if (missingTask) {
						reportLog(`Adding default analysis for task ${missingId}`, 'info');
						complexityAnalysis.push({
							taskId: missingId,
							taskTitle: missingTask.title,
							complexityScore: 5,
							recommendedSubtasks: 3,
							expansionPrompt: `Break down this task with a focus on ${missingTask.title.toLowerCase()}.`,
							reasoning:
								'Automatically added due to missing analysis in AI response.'
						});
					}
				}
			}
			// --- End Post-processing ---

			// --- Report Creation & Writing (Unchanged) ---
			const finalReport = {
				meta: {
					generatedAt: new Date().toISOString(),
					tasksAnalyzed: tasksData.tasks.length,
					thresholdScore: thresholdScore,
					projectName: getProjectName(session),
					usedResearch: useResearch
				},
				complexityAnalysis: complexityAnalysis
			};
			reportLog(`Writing complexity report to ${outputPath}...`, 'info');
			writeJSON(outputPath, finalReport);

			reportLog(
				`Task complexity analysis complete. Report written to ${outputPath}`,
				'success'
			);
			// --- End Report Creation & Writing ---

			// --- Display CLI Summary (Unchanged) ---
			if (outputFormat === 'text') {
				console.log(
					chalk.green(
						`Task complexity analysis complete. Report written to ${outputPath}`
					)
				);
				const highComplexity = complexityAnalysis.filter(
					(t) => t.complexityScore >= 8
				).length;
				const mediumComplexity = complexityAnalysis.filter(
					(t) => t.complexityScore >= 5 && t.complexityScore < 8
				).length;
				const lowComplexity = complexityAnalysis.filter(
					(t) => t.complexityScore < 5
				).length;
				const totalAnalyzed = complexityAnalysis.length;

				console.log('\nComplexity Analysis Summary:');
				console.log('----------------------------');
				console.log(
					`Active tasks sent for analysis: ${tasksData.tasks.length}`
				);
				console.log(`Tasks successfully analyzed: ${totalAnalyzed}`);
				console.log(`High complexity tasks: ${highComplexity}`);
				console.log(`Medium complexity tasks: ${mediumComplexity}`);
				console.log(`Low complexity tasks: ${lowComplexity}`);
				console.log(
					`Sum verification: ${highComplexity + mediumComplexity + lowComplexity} (should equal ${totalAnalyzed})`
				);
				console.log(`Research-backed analysis: ${useResearch ? 'Yes' : 'No'}`);
				console.log(
					`\nSee ${outputPath} for the full report and expansion commands.`
				);

				console.log(
					boxen(
						chalk.white.bold('Suggested Next Steps:') +
							'\n\n' +
							`${chalk.cyan('1.')} Run ${chalk.yellow('task-master complexity-report')} to review detailed findings\n` +
							`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down complex tasks\n` +
							`${chalk.cyan('3.')} Run ${chalk.yellow('task-master expand --all')} to expand all pending tasks based on complexity`,
						{
							padding: 1,
							borderColor: 'cyan',
							borderStyle: 'round',
							margin: { top: 1 }
						}
					)
				);

				if (getDebugFlag(session)) {
					console.debug(
						chalk.gray(
							`Final analysis object: ${JSON.stringify(finalReport, null, 2)}`
						)
					);
				}
			}
			// --- End Display CLI Summary ---

			return finalReport;
		} catch (error) {
			// Catches errors from generateTextService call
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
			reportLog(`Error during AI service call: ${error.message}`, 'error');
			if (outputFormat === 'text') {
				console.error(
					chalk.red(`Error during AI service call: ${error.message}`)
				);
				if (error.message.includes('API key')) {
					console.log(
						chalk.yellow(
							'\nPlease ensure your API keys are correctly configured in .env or ~/.taskmaster/.env'
						)
					);
					console.log(
						chalk.yellow("Run 'task-master models --setup' if needed.")
					);
				}
			}
			throw error; // Re-throw AI service error
		}
	} catch (error) {
		// Catches general errors (file read, etc.)
		reportLog(`Error analyzing task complexity: ${error.message}`, 'error');
		if (outputFormat === 'text') {
			console.error(
				chalk.red(`Error analyzing task complexity: ${error.message}`)
			);
			if (getDebugFlag(session)) {
				console.error(error);
			}
			process.exit(1);
		} else {
			throw error;
		}
	}
}

export default analyzeTaskComplexity;
