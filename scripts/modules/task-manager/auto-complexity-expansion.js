import chalk from 'chalk';
import { readJSON } from '../utils.js';
import analyzeTaskComplexity from './analyze-task-complexity.js';
import expandAllTasks from './expand-all-tasks.js';
import { displayAiUsageSummary } from '../ui.js';
import { resolveComplexityReportOutputPath } from '../../../src/utils/path-utils.js';

/**
 * Runs automatic complexity analysis and expansion for high-complexity tasks
 * This is equivalent to running: task-master analyze-complexity && task-master expand --all
 * @param {Object} options - Configuration options
 * @param {string} options.tasksPath - Path to the tasks.json file
 * @param {number} options.threshold - Complexity threshold for auto-expansion (default: 7)
 * @param {boolean} options.research - Whether to use research mode for analysis
 * @param {string} options.projectRoot - Project root path
 * @param {string} options.tag - Tag context for operations
 * @returns {Promise<Object>} Result object with expansion summary
 */
export async function runAutoComplexityExpansion(options) {
	const {
		tasksPath,
		threshold = 7,
		research = false,
		projectRoot,
		tag
	} = options;
	const thr = Number.isFinite(Number(threshold))
		? Math.min(10, Math.max(1, Number(threshold)))
		: 7;

	console.log(chalk.blue(`📊 Analyzing task complexity (threshold: ${thr})...`));

	try {
		// Step 1: Run complexity analysis
		const complexityResult = await analyzeTaskComplexity(
			{
				file: tasksPath,
				threshold: thr,
				research: research,
				projectRoot: projectRoot,
				tag: tag
			},
			{
				// Context for CLI mode
				session: null,
				mcpLog: null
			}
		);

		// The analyzeTaskComplexity function returns { report, telemetryData, tagInfo }
		// not { success, error } - let's check if we got a valid report
		if (!complexityResult || !complexityResult.report) {
			throw new Error(`Complexity analysis failed: No report generated`);
		}

		// Construct the complexity report path
		const complexityReportPath = resolveComplexityReportOutputPath(
			null, // no explicit path
			{ projectRoot, tag },
			null // no logger
		);

		console.log(chalk.green('✅ Complexity analysis completed'));

		// Step 2: Use expandAllTasks to intelligently expand high-complexity tasks
		// This will automatically use the complexity report to determine which tasks to expand
		console.log(chalk.blue('🔧 Expanding high-complexity tasks...'));
		
		const expandResult = await expandAllTasks(
			tasksPath,
			null, // numSubtasks - let it use complexity report recommendations
			research, // useResearch
			'', // additionalContext
			false, // force - don't force, let it use intelligence
			{
				session: null,
				mcpLog: null,
				projectRoot: projectRoot,
				tag: tag,
				complexityReportPath: complexityReportPath
			},
			'text' // outputFormat for CLI
		);

		// Step 3: Display summary
		console.log(chalk.blue('\n📋 Auto-Expansion Summary:'));
		console.log(chalk.green(`  ✅ Successfully expanded: ${expandResult.expandedCount} tasks`));
		console.log(chalk.yellow(`  ⏭️  Skipped: ${expandResult.skippedCount} tasks (already expanded or low complexity)`));
		
		if (expandResult.failedCount > 0) {
			console.log(chalk.red(`  ❌ Failed expansions: ${expandResult.failedCount} tasks`));
		}

		// Display telemetry if available
		if (complexityResult.telemetryData) {
			displayAiUsageSummary(complexityResult.telemetryData, 'cli');
		}

		// Also display expansion telemetry if available
		if (expandResult.telemetryData) {
			displayAiUsageSummary(expandResult.telemetryData, 'cli');
		}

		return {
			success: true,
			expandedTasks: expandResult.expandedCount,
			skippedTasks: expandResult.skippedCount,
			failedTasks: expandResult.failedCount,
			totalTasksAnalyzed: expandResult.tasksToExpand,
			complexityReportPath: complexityReportPath,
			complexityTelemetryData: complexityResult.telemetryData,
			expansionTelemetryData: expandResult.telemetryData
		};

	} catch (error) {
		console.error(chalk.red(`❌ Auto-complexity expansion failed: ${error.message}`));
		throw error;
	}
}

/**
 * Validates that the auto-expansion can proceed
 * @param {string} tasksPath - Path to tasks file
 * @param {string} projectRoot - Project root path
 * @returns {Promise<boolean>} Whether auto-expansion can proceed
 */
export async function validateAutoExpansion(tasksPath, projectRoot, tag = 'master') {
	try {
		const tasksData = readJSON(tasksPath, projectRoot, tag);
		
		if (!tasksData || !tasksData.tasks || tasksData.tasks.length === 0) {
			throw new Error('No tasks found to analyze');
		}

		// Check if there are any pending tasks to analyze
		const pendingTasks = tasksData.tasks.filter(task => 
			task.status === 'pending' || task.status === 'in-progress'
		);

		if (pendingTasks.length === 0) {
			throw new Error('No pending tasks found to analyze');
		}

		return true;
	} catch (error) {
		throw new Error(`Validation failed: ${error.message}`);
	}
}
