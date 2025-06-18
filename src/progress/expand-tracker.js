import chalk from 'chalk';
import { newMultiBar } from './cli-progress-factory.js';

/**
 * Tracks progress for task expansion operations with individual task bars
 * Supports both single task expansion and expand-all operations
 */
export class ExpandTracker {
	constructor(options = {}) {
		this.expandType = options.expandType || 'single'; // 'single' or 'all'
		this.numTasks = options.numTasks || 1;
		this.taskId = options.taskId; // For single task expansion
		this.startTime = null;
		this.completedExpansions = 0;
		this.tokensIn = 0;
		this.tokensOut = 0;
		this.subtasksCreated = 0;
		this.tasksSkipped = 0;
		this.tasksWithErrors = 0;

		// UI components
		this.multibar = null;
		this.timeTokensBar = null;
		this.progressBar = null;
		this._timerInterval = null;

		// Track expansion results for summary
		this.expansionResults = [];
		this.errors = [];

		// State flags
		this.isStarted = false;
		this.isFinished = false;
		this.headerShown = false;

		// Time tracking for stable estimates
		this.lastExpansionTime = null;
		this.bestAvgTimePerExpansion = null;
		this.lastEstimateTime = null;
		this.lastEstimateSeconds = 0;
	}

	start() {
		if (this.isStarted || this.isFinished) return;

		this.isStarted = true;
		this.startTime = Date.now();

		this.multibar = newMultiBar();

		// Time/tokens/progress status bar
		this.timeTokensBar = this.multibar.create(
			1,
			0,
			{},
			{
				format: `{clock} {elapsed} | Subtasks: {subtasks} | Tokens (I/O): {in}/{out} | Est: {remaining}`,
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false
			}
		);

		// Main progress bar
		const progressFormat = this.expandType === 'single'
			? 'Expansion {expansions} |{bar}| {percentage}%'
			: 'Expansions {expansions} |{bar}| {percentage}%';

		this.progressBar = this.multibar.create(
			this.numTasks,
			0,
			{},
			{
				format: progressFormat,
				barCompleteChar: '\u2588',
				barIncompleteChar: '\u2591'
			}
		);

		this._updateTimeTokensBar();
		this.progressBar.update(0, { expansions: `0/${this.numTasks}` });

		// Update timer every second
		this._timerInterval = setInterval(() => this._updateTimeTokensBar(), 1000);
	}

	updateTokens(tokensIn, tokensOut) {
		this.tokensIn = tokensIn || 0;
		this.tokensOut = tokensOut || 0;
		this._updateTimeTokensBar();
	}

	addExpansionLine(taskId, title, subtasksGenerated = 0, status = 'success', telemetryData = null) {
		if (!this.multibar || this.isFinished) return;

		// Show header on first task for expand-all
		if (!this.headerShown && this.expandType === 'all') {
			this.headerShown = true;

			// Top border
			const topBorderBar = this.multibar.create(
				1,
				1,
				{},
				{
					format: '------+-----+-----+-----+-------+----------------------------------',
					barsize: 1
				}
			);
			topBorderBar.update(1);

			// Header
			const headerBar = this.multibar.create(
				1,
				1,
				{},
				{
					format: ' TASK | SUB |  IN | OUT |  COST | TITLE',
					barsize: 1
				}
			);
			headerBar.update(1);

			// Bottom border
			const bottomBorderBar = this.multibar.create(
				1,
				1,
				{},
				{
					format: '------+-----+-----+-----+-------+----------------------------------',
					barsize: 1
				}
			);
			bottomBorderBar.update(1);
		}

		// Update counters based on status
		this.completedExpansions++;
		if (status === 'success') {
			this.subtasksCreated += subtasksGenerated;
		} else if (status === 'skipped') {
			this.tasksSkipped++;
		} else if (status === 'error') {
			this.tasksWithErrors++;
		}

		// Add telemetry data if provided
		if (telemetryData) {
			this.tokensIn += telemetryData.inputTokens || 0;
			this.tokensOut += telemetryData.outputTokens || 0;
		}

		// Track timing for better estimates
		const now = Date.now();
		if (this.completedExpansions > 0) {
			const elapsed = (now - this.startTime) / 1000;
			const currentAvgTimePerExpansion = elapsed / this.completedExpansions;

			// Use the best (most recent) average we've seen to avoid degrading estimates
			if (
				this.bestAvgTimePerExpansion === null ||
				currentAvgTimePerExpansion < this.bestAvgTimePerExpansion
			) {
				this.bestAvgTimePerExpansion = currentAvgTimePerExpansion;
			}
		}
		this.lastExpansionTime = now;

		// Reset estimate timing for fresh calculation
		this.lastEstimateTime = null;
		this.lastEstimateSeconds = 0;

		// Update progress bar
		this.progressBar.update(this.completedExpansions, {
			expansions: `${this.completedExpansions}/${this.numTasks}`
		});

		// Create individual task display for expand-all
		if (this.expandType === 'all') {
			const displayTitle =
				title && title.length > 34
					? `${title.substring(0, 31)}...`
					: title || `Task ${taskId}`;

			const statusIndicator = this._getStatusIndicator(status);
			const subtasksDisplay = subtasksGenerated.toString();

			// Format telemetry data for display
			const tokensIn = telemetryData?.inputTokens || 0;
			const tokensOut = telemetryData?.outputTokens || 0;
			const cost = telemetryData?.totalCost || 0;

			// Store for final summary
			this.expansionResults.push({
				id: taskId.toString(),
				subtasks: subtasksDisplay,
				title: displayTitle,
				status: status,
				tokensIn: tokensIn,
				tokensOut: tokensOut,
				cost: cost
			});

			// Create individual task bar with monospace-style formatting
			const taskIdCentered = taskId.toString().padStart(3, ' ').padEnd(4, ' ');
			const subtasksPadded = `${subtasksDisplay} `.padStart(3, ' ');
			const tokensInPadded = tokensIn.toString().padStart(3, ' ');
			const tokensOutPadded = tokensOut.toString().padStart(3, ' ');
			const costFormatted = cost > 0 ? `$${cost.toFixed(3)}` : '$0.000';
			const costPadded = costFormatted.padStart(5, ' ');

			const taskBar = this.multibar.create(
				1,
				1,
				{},
				{
					format: ` ${taskIdCentered} | ${subtasksPadded} | ${tokensInPadded} | ${tokensOutPadded} | ${costPadded} | {status} {title}`,
					barsize: 1
				}
			);

			taskBar.update(1, { 
				title: displayTitle,
				status: statusIndicator
			});
		} else {
			// For single task expansion, just store the result
			this.expansionResults.push({
				id: taskId.toString(),
				subtasks: subtasksGenerated.toString(),
				title: title,
				status: status,
				tokensIn: telemetryData?.inputTokens || 0,
				tokensOut: telemetryData?.outputTokens || 0,
				cost: telemetryData?.totalCost || 0
			});
		}

		this._updateTimeTokensBar();
	}

	addError(taskId, errorMessage) {
		this.errors.push(`Task ${taskId}: ${errorMessage}`);
		this.addExpansionLine(taskId, `Error expanding task`, 0, 'error');
	}

	_getStatusIndicator(status) {
		switch (status) {
			case 'success':
				return chalk.green('✓');
			case 'skipped':
				return chalk.yellow('○');
			case 'error':
				return chalk.red('✗');
			default:
				return chalk.gray('?');
		}
	}

	_updateTimeTokensBar() {
		if (!this.timeTokensBar || this.isFinished) return;

		const elapsed = this._formatElapsedTime();
		const remaining = this._estimateRemainingTime();

		this.timeTokensBar.update(1, {
			clock: '⏱️',
			elapsed,
			subtasks: this.subtasksCreated,
			in: this.tokensIn,
			out: this.tokensOut,
			remaining
		});
	}

	_formatElapsedTime() {
		if (!this.startTime) return '0m 00s';
		const seconds = Math.floor((Date.now() - this.startTime) / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
	}

	_estimateRemainingTime() {
		if (this.completedExpansions === 0 || !this.bestAvgTimePerExpansion) {
			return '~calculating...';
		}

		const remainingTasks = this.numTasks - this.completedExpansions;
		if (remainingTasks <= 0) return '~0s';

		const estimatedSeconds = Math.ceil(
			remainingTasks * this.bestAvgTimePerExpansion
		);

		// Stabilize the estimate to avoid rapid changes, but allow countdown
		const now = Date.now();
		if (
			this.lastEstimateTime &&
			now - this.lastEstimateTime < 3000 && // Less than 3 seconds since last estimate
			Math.abs(estimatedSeconds - this.lastEstimateSeconds) < 10 // Less than 10 second difference
		) {
			// Use the previous estimate but subtract elapsed time for countdown effect
			const elapsedSinceEstimate = Math.floor(
				(now - this.lastEstimateTime) / 1000
			);
			const countdownSeconds = Math.max(
				0,
				this.lastEstimateSeconds - elapsedSinceEstimate
			);
			return `~${this._formatDuration(countdownSeconds)}`;
		}

		this.lastEstimateTime = now;
		this.lastEstimateSeconds = estimatedSeconds;

		return `~${this._formatDuration(estimatedSeconds)}`;
	}

	_formatDuration(seconds) {
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		if (minutes < 60) {
			return remainingSeconds > 0
				? `${minutes}m ${remainingSeconds}s`
				: `${minutes}m`;
		}
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return `${hours}h ${remainingMinutes}m`;
	}

	getElapsedTime() {
		if (!this.startTime) return 0;
		return Date.now() - this.startTime;
	}

	async stop() {
		if (this.isFinished) return;

		this.isFinished = true;

		if (this._timerInterval) {
			clearInterval(this._timerInterval);
			this._timerInterval = null;
		}

		if (this.multibar) {
			this.multibar.stop();
		}
	}

	// Alias for compatibility with existing code
	async finish() {
		return this.stop();
	}

	// Methods needed by expand-task.js
	updateTaskProgress(taskId, stage, message) {
		// For single task expansion, update the progress display
		if (this.expandType === 'single') {
			// Update the time/tokens bar with current stage
			if (this.timeTokensBar) {
				this.timeTokensBar.update(1, {
					clock: '⏱️',
					elapsed: this._formatElapsedTime(),
					subtasks: this.subtasksCreated,
					in: this.tokensIn,
					out: this.tokensOut,
					remaining: stage === 'completed' ? 'Done!' : `${stage}...`
				});
			}
		}
		// For expand-all, this will be handled by addExpansionLine
	}

	incrementErrors() {
		this.tasksWithErrors++;
	}

	incrementCompleted() {
		// This is handled by addExpansionLine for expand-all
		// For single task, just track completion
		if (this.expandType === 'single') {
			this.completedExpansions = 1;
		}
	}

	addTelemetryData(telemetryData) {
		if (telemetryData) {
			this.tokensIn += telemetryData.inputTokens || 0;
			this.tokensOut += telemetryData.outputTokens || 0;
			this._updateTimeTokensBar();
		}
	}

	// Methods needed by expand-all-tasks.js
	updateOverallProgress(stage, message) {
		// Update the time/tokens bar with overall progress
		if (this.timeTokensBar) {
			this.timeTokensBar.update(1, {
				clock: '⏱️',
				elapsed: this._formatElapsedTime(),
				subtasks: this.subtasksCreated,
				in: this.tokensIn,
				out: this.tokensOut,
				remaining: stage === 'completed' ? 'Done!' : this._estimateRemainingTime()
			});
		}
	}

	setTotalTasks(totalTasks) {
		this.numTasks = totalTasks;
		// Update the progress bar total
		if (this.progressBar) {
			this.progressBar.setTotal(totalTasks);
			this.progressBar.update(this.completedExpansions, {
				expansions: `${this.completedExpansions}/${this.numTasks}`
			});
		}
	}

	getSummary() {
		const successfulExpansions = this.completedExpansions - this.tasksSkipped - this.tasksWithErrors;
		
		return {
			expandType: this.expandType,
			taskId: this.taskId, // For single task expansion
			totalTasksProcessed: this.completedExpansions,
			totalSubtasksCreated: this.subtasksCreated,
			tasksSkipped: this.tasksSkipped,
			tasksWithErrors: this.tasksWithErrors,
			successfulExpansions: successfulExpansions,
			elapsedTime: this.getElapsedTime(),
			errors: this.errors
		};
	}
}

export function createExpandTracker(options = {}) {
	return new ExpandTracker(options);
} 