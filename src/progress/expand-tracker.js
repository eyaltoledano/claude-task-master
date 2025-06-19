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
		this.currentTaskBar = null;
		this._timerInterval = null;

		// Current task tracking
		this.currentTaskId = null;
		this.currentTaskTitle = null;

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
		const progressFormat =
			this.expandType === 'single'
				? 'Task {tasks} |{bar}| {percentage}%'
				: 'Task {tasks} |{bar}| {percentage}%';

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

		// Current task info bar
		this.currentTaskBar = this.multibar.create(
			1,
			0,
			{},
			{
				format: '{taskInfo}',
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false
			}
		);

		this._updateTimeTokensBar();
		this.progressBar.update(0, { tasks: `0/${this.numTasks}` });
		this._updateCurrentTaskBar();

		// Update timer every second
		this._timerInterval = setInterval(() => this._updateTimeTokensBar(), 1000);
	}

	updateTokens(tokensIn, tokensOut) {
		this.tokensIn = tokensIn || 0;
		this.tokensOut = tokensOut || 0;
		this._updateTimeTokensBar();
	}

	setCurrentTask(taskId, taskTitle) {
		this.currentTaskId = taskId;
		this.currentTaskTitle = taskTitle;
		this._updateCurrentTaskBar();

		// Update progress bar to show current task being processed (1-based indexing)
		// This shows which task we're currently working on
		const currentTaskNumber = this.completedExpansions + 1;
		if (currentTaskNumber <= this.numTasks) {
			this.progressBar.update(this.completedExpansions, {
				tasks: `${currentTaskNumber}/${this.numTasks}`
			});
		}
	}

	addExpansionLine(
		taskId,
		title,
		subtasksGenerated = 0,
		status = 'success',
		telemetryData = null,
		complexityScore = null
	) {
		if (!this.multibar || this.isFinished) return;

		// Show header on first task for expand-all
		if (!this.headerShown && this.expandType === 'all') {
			this.headerShown = true;

			// Top border - updated width for SCORE column
			const topBorderBar = this.multibar.create(
				1,
				1,
				{},
				{
					format:
						'------+-----+-------+-----+-----+-------+----------------------------------',
					barsize: 1
				}
			);
			topBorderBar.update(1);

			// Header - updated to include SCORE column
			const headerBar = this.multibar.create(
				1,
				1,
				{},
				{
					format: ' TASK | SUB | SCORE |  IN | OUT |  COST | TITLE',
					barsize: 1
				}
			);
			headerBar.update(1);

			// Bottom border - updated width for SCORE column
			const bottomBorderBar = this.multibar.create(
				1,
				1,
				{},
				{
					format:
						'------+-----+-------+-----+-----+-------+----------------------------------',
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

			// Use a more realistic average - don't just keep the fastest time
			// Use exponential moving average to balance recent performance with historical data
			if (this.bestAvgTimePerExpansion === null) {
				this.bestAvgTimePerExpansion = currentAvgTimePerExpansion;
			} else {
				// Weight: 70% current average, 30% historical average
				// This prevents both overly optimistic and overly pessimistic estimates
				this.bestAvgTimePerExpansion =
					0.7 * currentAvgTimePerExpansion + 0.3 * this.bestAvgTimePerExpansion;
			}
		}
		this.lastExpansionTime = now;

		// Don't reset estimate timing here - let the countdown logic work
		// The estimate will be recalculated naturally when the stabilization window expires

		// Update progress bar - show current task number correctly
		// Show the task that was just completed (1-based indexing)
		const displayTaskNumber = this.completedExpansions;
		this.progressBar.update(this.completedExpansions, {
			tasks: `${displayTaskNumber}/${this.numTasks}`
		});

		// Create individual task display for expand-all
		if (this.expandType === 'all') {
			const displayTitle =
				title && title.length > 34
					? `${title.substring(0, 31)}...`
					: title || `Task ${taskId}`;

			const statusIndicator = this._getStatusIndicator(status);
			const subtasksDisplay = subtasksGenerated.toString();

			// Format complexity score for display
			const scoreDisplay =
				complexityScore !== null && complexityScore !== undefined
					? complexityScore.toString()
					: 'N/A';

			// Format telemetry data for display
			const tokensIn = telemetryData?.inputTokens || 0;
			const tokensOut = telemetryData?.outputTokens || 0;
			const cost = telemetryData?.totalCost || 0;

			// Store for final summary
			this.expansionResults.push({
				id: taskId.toString(),
				subtasks: subtasksDisplay,
				complexityScore: scoreDisplay,
				title: displayTitle,
				status: status,
				tokensIn: tokensIn,
				tokensOut: tokensOut,
				cost: cost
			});

			// Create individual task bar with monospace-style formatting
			const taskIdCentered = taskId.toString().padStart(3, ' ').padEnd(4, ' ');
			const subtasksPadded = `${subtasksDisplay} `.padStart(3, ' ');
			const scorePadded = scoreDisplay.padStart(5, ' ');
			const tokensInPadded = tokensIn.toString().padStart(3, ' ');
			const tokensOutPadded = tokensOut.toString().padStart(3, ' ');
			const costFormatted = cost > 0 ? `$${cost.toFixed(3)}` : '$0.000';
			const costPadded = costFormatted.padStart(5, ' ');

			const taskBar = this.multibar.create(
				1,
				1,
				{},
				{
					format: ` ${taskIdCentered} | ${subtasksPadded} | ${scorePadded} | ${tokensInPadded} | ${tokensOutPadded} | ${costPadded} | {status} {title}`,
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
				complexityScore:
					complexityScore !== null && complexityScore !== undefined
						? complexityScore.toString()
						: 'N/A',
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

	_updateCurrentTaskBar() {
		if (!this.currentTaskBar || this.isFinished) return;

		let taskInfo = '';
		if (this.currentTaskId && this.currentTaskTitle) {
			taskInfo = `Expanding task ${this.currentTaskId}: ${this.currentTaskTitle}`;
		} else if (this.currentTaskId) {
			taskInfo = `Expanding task ${this.currentTaskId}`;
		} else {
			taskInfo = 'Preparing to expand tasks...';
		}

		this.currentTaskBar.update(1, { taskInfo });
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

		const now = Date.now();
		const estimatedSeconds = Math.ceil(
			remainingTasks * this.bestAvgTimePerExpansion
		);

		// Stabilize the estimate to avoid rapid changes and prevent increases
		if (this.lastEstimateTime && this.lastEstimateSeconds >= 0) {
			const elapsedSinceEstimate = Math.floor(
				(now - this.lastEstimateTime) / 1000
			);

			// Always count down from the previous estimate
			const countdownSeconds = Math.max(
				0,
				this.lastEstimateSeconds - elapsedSinceEstimate
			);

			// STICKY ZERO: Once we reach 0, stay at 0 until task actually completes
			if (countdownSeconds === 0) {
				return '~0s';
			}

			// Only update to a new estimate if:
			// 1. Enough time has passed (5+ seconds), AND
			// 2. The new estimate is significantly lower, OR
			// 3. We haven't reached zero yet
			const timeSinceLastEstimate = now - this.lastEstimateTime;
			const significantlyLower =
				estimatedSeconds < this.lastEstimateSeconds * 0.8;

			if (
				timeSinceLastEstimate < 5000 &&
				!significantlyLower &&
				countdownSeconds > 0
			) {
				// Continue counting down from previous estimate
				return `~${this._formatDuration(countdownSeconds)}`;
			}

			// Update estimate, but ensure it's never higher than the countdown would be
			// and never goes back up from 0
			const newEstimate = Math.min(estimatedSeconds, countdownSeconds);
			this.lastEstimateTime = now;
			this.lastEstimateSeconds = newEstimate;
			return `~${this._formatDuration(newEstimate)}`;
		}

		// First time estimate or no previous estimate
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
				remaining:
					stage === 'completed' ? 'Done!' : this._estimateRemainingTime()
			});
		}
	}

	setTotalTasks(totalTasks) {
		this.numTasks = totalTasks;
		// Update the progress bar total
		if (this.progressBar) {
			this.progressBar.setTotal(totalTasks);
			const displayTaskNumber = Math.min(
				this.completedExpansions,
				this.numTasks
			);
			this.progressBar.update(this.completedExpansions, {
				tasks: `${displayTaskNumber}/${this.numTasks}`
			});
		}
	}

	getSummary() {
		const successfulExpansions =
			this.completedExpansions - this.tasksSkipped - this.tasksWithErrors;

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
