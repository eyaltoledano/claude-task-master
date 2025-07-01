import chalk from 'chalk';
import { newMultiBar } from './cli-progress-factory.js';
import { getPriorityIndicator } from '../ui/indicators.js';

/**
 * Tracks progress for task expansion operations with individual task bars
 * Supports both single task expansion and expand-all operations
 */
export class ExpandTracker {
	constructor(options = {}) {
		this.expandType = options.expandType || 'single'; // 'single' or 'all'
		this.numTasks = options.numTasks || 1;
		this.taskId = options.taskId; // For single task expansion
		this.taskTitle = options.taskTitle; // For single task expansion
		this.taskPriority = options.taskPriority || 'medium'; // For single task expansion
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
		this.subtaskProgressBar = null; // New: Progress bar for current task's subtasks
		this._timerInterval = null;

		// Current task tracking
		this.currentTaskId = null;
		this.currentTaskTitle = null;
		this.currentTaskSubtaskCount = 0;
		this.currentTaskSubtaskProgress = 0;

		// Track expansion results for summary
		this.expansionResults = [];
		this.errors = [];

		// State flags
		this.isStarted = false;
		this.isFinished = false;
		this.headerShown = false;
		this.isEstimate = true; // Start with estimated tokens

		// Time tracking for stable estimates
		this.lastExpansionTime = null;
		this.bestAvgTimePerExpansion = null;
		this.lastEstimateTime = null;
		this.lastEstimateSeconds = 0;

		// For single task expansion, track subtask generation
		this.generatedSubtasks = 0;
		this.lastSubtaskGenerationTime = null;
		this.avgTimePerSubtask = null;
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
				format: `{clock} {elapsed} | Subtasks: {subtasks} | {tokensLabel}: {in}/{out} | {remaining}`,
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false
			}
		);

		// Task info bar for single task expansion
		if (this.expandType === 'single' && this.taskId && this.taskTitle) {
			const priorityDots = getPriorityIndicator(this.taskPriority, false);
			const displayTitle =
				this.taskTitle.length > 60
					? `${this.taskTitle.substring(0, 57)}...`
					: this.taskTitle;

			const taskInfoBar = this.multibar.create(
				1,
				1,
				{},
				{
					format: `Expanding Task ${this.taskId}: ${priorityDots} ${displayTitle}`,
					barsize: 1,
					hideCursor: true,
					clearOnComplete: false
				}
			);
			taskInfoBar.update(1);
		}

		// Main progress bar
		const progressFormat =
			this.expandType === 'single'
				? 'Subtask {tasks} |{bar}| {percentage}%'
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

		// Current task info bar (only for expand-all)
		if (this.expandType === 'all') {
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
			this._updateCurrentTaskBar();

			// Subtask progress bar for current task
			this.subtaskProgressBar = this.multibar.create(
				1,
				0,
				{},
				{
					format: 'Subtask {subtasks} |{bar}| {percentage}%',
					barCompleteChar: '\u2588',
					barIncompleteChar: '\u2591'
				}
			);
		}

		this._updateTimeTokensBar();
		this.progressBar.update(0, { tasks: `0/${this.numTasks}` });

		// Update timer every second
		this._timerInterval = setInterval(() => this._updateTimeTokensBar(), 1000);
	}

	updateTokens(tokensIn, tokensOut, isEstimate = true) {
		this.tokensIn = tokensIn || 0;
		this.tokensOut = tokensOut || 0;
		this.isEstimate = isEstimate;
		this._updateTimeTokensBar();
	}

	updateCurrentTaskSubtaskProgress(subtaskNumber) {
		// Update subtask progress for expand-all mode
		if (this.expandType === 'all' && this.subtaskProgressBar) {
			this.currentTaskSubtaskProgress = subtaskNumber;
			this.subtaskProgressBar.update(subtaskNumber, {
				subtasks: `${subtaskNumber}/${this.currentTaskSubtaskCount}`
			});

			// Update the main progress bar to include partial progress of current task
			if (this.progressBar && this.currentTaskSubtaskCount > 0) {
				// Calculate fractional progress: completed tasks + (current subtask progress / total subtasks for current task)
				const fractionalProgress =
					this.completedExpansions +
					subtaskNumber / this.currentTaskSubtaskCount;

				// Update progress bar with fractional value
				this.progressBar.update(fractionalProgress);

				// Still show task numbers as before (e.g., "Task 1/2")
				const currentTaskNumber = this.completedExpansions + 1;
				this.progressBar.update(fractionalProgress, {
					tasks: `${currentTaskNumber}/${this.numTasks}`
				});
			}

			// Update timing estimates based on partial progress
			this._updatePartialTimingEstimate();
		}
	}

	setCurrentTask(taskId, taskTitle, expectedSubtasks = 0) {
		this.currentTaskId = taskId;
		this.currentTaskTitle = taskTitle;
		this.currentTaskSubtaskCount = expectedSubtasks;
		this.currentTaskSubtaskProgress = 0;
		this._updateCurrentTaskBar();

		// Update progress bar to show current task being processed (1-based indexing)
		// This shows which task we're currently working on
		const currentTaskNumber = this.completedExpansions + 1;
		if (currentTaskNumber <= this.numTasks) {
			this.progressBar.update(this.completedExpansions, {
				tasks: `${currentTaskNumber}/${this.numTasks}`
			});
		}

		// Reset subtask progress bar
		if (this.subtaskProgressBar && expectedSubtasks > 0) {
			this.subtaskProgressBar.setTotal(expectedSubtasks);
			this.subtaskProgressBar.update(0, {
				subtasks: `0/${expectedSubtasks}`
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
						'------+-----+-------+-----+-----+--------+----------------------------------------------------------------',
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
					format: ' TASK | SUB | SCORE |  IN | OUT |  COST  | TITLE',
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
						'------+-----+-------+-----+-----+--------+----------------------------------------------------------------',
					barsize: 1
				}
			);
			bottomBorderBar.update(1);
		}

		// Update counters based on status
		this.completedExpansions++;
		if (status === 'skipped') {
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
			// Include partial progress in the average calculation
			const effectiveCompletions = this.completedExpansions;
			// Don't include partial progress from the task that just completed
			// since it's now a full completion
			const currentAvgTimePerExpansion = elapsed / effectiveCompletions;

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
		// Update to exact completion value (no fractional part when task completes)
		this.progressBar.update(this.completedExpansions, {
			tasks: `${displayTaskNumber}/${this.numTasks}`
		});

		// Create individual task display for expand-all
		if (this.expandType === 'all') {
			const displayTitle =
				title && title.length > 60
					? `${title.substring(0, 57)}...`
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

			// Helper function to center text within a given width
			const centerText = (text, width) => {
				const textLength = text.length;
				if (textLength >= width) return text.substring(0, width);

				const totalPadding = width - textLength;
				const leftPadding = Math.floor(totalPadding / 2);
				const rightPadding = Math.ceil(totalPadding / 2);

				return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
			};

			// Create individual task bar with monospace-style formatting
			const taskIdCentered = taskId.toString().padStart(3, ' ').padEnd(4, ' ');
			const subtasksPadded = `${subtasksDisplay} `.padStart(3, ' ');
			const scorePadded = centerText(scoreDisplay, 5); // Center in 5-char width to match header
			const tokensInPadded = tokensIn.toString().padStart(3, ' ');
			const tokensOutPadded = tokensOut.toString().padStart(3, ' ');
			const costFormatted = cost > 0 ? `$${cost.toFixed(3)}` : '$0.000';
			const costPadded = costFormatted.padStart(6, ' ');

			const taskBar = this.multibar.create(
				1,
				1,
				{},
				{
					format: ` ${taskIdCentered} | ${subtasksPadded} | ${scorePadded} | ${tokensInPadded} | ${tokensOutPadded} | ${costPadded} | {title}`,
					barsize: 1
				}
			);

			taskBar.update(1, {
				title: displayTitle
			});

			// Add border line after each task
			const borderBar = this.multibar.create(
				1,
				1,
				{},
				{
					format:
						'------+-----+-------+-----+-----+--------+----------------------------------------------------------------',
					barsize: 1
				}
			);
			borderBar.update(1);
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

		// For single task expansion, show generated subtasks count
		const subtaskCount =
			this.expandType === 'single'
				? this.generatedSubtasks
				: this.subtasksCreated;

		// Show ~ prefix for estimated tokens
		const tokensLabel = this.isEstimate ? '~ Tokens (I/O)' : 'Tokens (I/O)';

		this.timeTokensBar.update(1, {
			clock: '⏱️',
			elapsed,
			subtasks: subtaskCount,
			in: this.tokensIn,
			out: this.tokensOut,
			remaining,
			tokensLabel
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

		if (this.currentTaskBar) {
			this.currentTaskBar.update(1, { taskInfo });
		}
	}

	_formatElapsedTime() {
		if (!this.startTime) return '0m 00s';
		const seconds = Math.floor((Date.now() - this.startTime) / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
	}

	_estimateRemainingTime() {
		// Time estimation differs between single task and expand-all:
		// - Single task: estimates based on subtasks being generated for ONE task
		// - Expand-all: estimates based on multiple TASKS, each generating multiple subtasks

		// For single task expansion, use subtask generation data
		if (this.expandType === 'single') {
			if (this.generatedSubtasks === 0 || !this.avgTimePerSubtask) {
				return 'Est: ~calculating...';
			}

			const remainingSubtasks = this.numTasks - this.generatedSubtasks;
			if (remainingSubtasks <= 0) return 'Complete!';

			const now = Date.now();
			const estimatedSeconds = Math.ceil(
				remainingSubtasks * this.avgTimePerSubtask
			);

			// Use same stabilization logic pattern
			if (this.lastEstimateTime && this.lastEstimateSeconds >= 0) {
				const elapsedSinceEstimate = Math.floor(
					(now - this.lastEstimateTime) / 1000
				);
				const countdownSeconds = Math.max(
					0,
					this.lastEstimateSeconds - elapsedSinceEstimate
				);

				if (countdownSeconds === 0) {
					return 'Complete!';
				}

				const timeSinceLastEstimate = now - this.lastEstimateTime;
				const significantlyLower =
					estimatedSeconds < this.lastEstimateSeconds * 0.8;

				if (
					timeSinceLastEstimate < 5000 &&
					!significantlyLower &&
					countdownSeconds > 0
				) {
					return `Est: ~${this._formatDuration(countdownSeconds)}`;
				}

				const newEstimate = Math.min(estimatedSeconds, countdownSeconds);
				this.lastEstimateTime = now;
				this.lastEstimateSeconds = newEstimate;
				return `Est: ~${this._formatDuration(newEstimate)}`;
			}

			this.lastEstimateTime = now;
			this.lastEstimateSeconds = estimatedSeconds;
			return `Est: ~${this._formatDuration(estimatedSeconds)}`;
		}

		// For expand-all, calculate fractional progress including current task's subtasks
		let fractionalProgress = this.completedExpansions;
		if (this.currentTaskSubtaskCount > 0) {
			fractionalProgress +=
				this.currentTaskSubtaskProgress / this.currentTaskSubtaskCount;
		}

		// For expand-all, provide estimate as soon as we have meaningful progress
		if (fractionalProgress < 0.05) {
			// Need at least 5% progress for meaningful estimate
			return 'Est: ~calculating...';
		}

		// We don't have a stable average yet but have some progress, so provide initial estimate
		if (
			!this.bestAvgTimePerExpansion &&
			fractionalProgress > 0 &&
			this.startTime
		) {
			const elapsed = (Date.now() - this.startTime) / 1000;
			const avgTimePerTask = elapsed / fractionalProgress;
			const remainingProgress = this.numTasks - fractionalProgress;
			const estimatedSeconds = Math.ceil(remainingProgress * avgTimePerTask);
			return `Est: ~${this._formatDuration(estimatedSeconds)} (initial)`;
		}

		// If we still don't have enough data, fall back to calculating message
		if (!this.bestAvgTimePerExpansion) {
			return 'Est: ~calculating...';
		}

		// Reuse the fractional progress already calculated above
		const remainingProgress = this.numTasks - fractionalProgress;
		if (remainingProgress <= 0) return 'Complete!';

		const now = Date.now();
		// Use fractional remaining progress for more accurate estimation
		const estimatedSeconds = Math.ceil(
			remainingProgress * this.bestAvgTimePerExpansion
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
				return 'Complete!';
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
				return `Est: ~${this._formatDuration(countdownSeconds)}`;
			}

			// Update estimate, but ensure it's never higher than the countdown would be
			// and never goes back up from 0
			const newEstimate = Math.min(estimatedSeconds, countdownSeconds);
			this.lastEstimateTime = now;
			this.lastEstimateSeconds = newEstimate;
			return `Est: ~${this._formatDuration(newEstimate)}`;
		}

		// First time estimate or no previous estimate
		this.lastEstimateTime = now;
		this.lastEstimateSeconds = estimatedSeconds;
		return `Est: ~${this._formatDuration(estimatedSeconds)}`;
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

	_updatePartialTimingEstimate() {
		// Update timing estimates based on partial progress during task expansion
		if (this.expandType !== 'all' || !this.startTime) return;

		const now = Date.now();
		const elapsed = (now - this.startTime) / 1000;

		// Calculate fractional progress including current task
		let fractionalProgress = this.completedExpansions;
		if (this.currentTaskSubtaskCount > 0) {
			fractionalProgress +=
				this.currentTaskSubtaskProgress / this.currentTaskSubtaskCount;
		}

		// Only update if we have meaningful progress
		if (fractionalProgress > 0.1) {
			const avgTimePerTask = elapsed / fractionalProgress;

			// Update the best average with exponential moving average
			// Weight recent performance more heavily for responsiveness
			if (this.bestAvgTimePerExpansion === null) {
				this.bestAvgTimePerExpansion = avgTimePerTask;
			} else {
				// Use 80/20 weighting for more responsive updates during active expansion
				this.bestAvgTimePerExpansion =
					0.8 * avgTimePerTask + 0.2 * this.bestAvgTimePerExpansion;
			}
		}

		// Trigger time bar update
		this._updateTimeTokensBar();
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

	// Track subtask generation for single task expansion
	updateSubtaskGeneration(subtaskNumber) {
		if (this.expandType !== 'single') return;

		this.generatedSubtasks = subtaskNumber;
		const now = Date.now();

		// Calculate average time per subtask
		if (this.generatedSubtasks > 0 && this.startTime) {
			const elapsed = (now - this.startTime) / 1000;
			const currentAvg = elapsed / this.generatedSubtasks;

			if (this.avgTimePerSubtask === null) {
				this.avgTimePerSubtask = currentAvg;
			} else {
				// Exponential moving average
				this.avgTimePerSubtask =
					0.7 * currentAvg + 0.3 * this.avgTimePerSubtask;
			}
		}

		this.lastSubtaskGenerationTime = now;
		this._updateTimeTokensBar();
	}

	// Add a subtask line to the display (for single task expansion)
	addSubtaskLine(subtaskId, title) {
		if (!this.multibar || this.isFinished || this.expandType !== 'single')
			return;

		// Show header on first subtask
		if (!this.headerShown) {
			this.headerShown = true;

			// Top border
			const topBorderBar = this.multibar.create(
				1,
				1,
				{},
				{
					format:
						'-----+------------------------------------------------------------------',
					barsize: 1
				}
			);
			topBorderBar.update(1);

			// Header - right-align # to match data padding
			const headerBar = this.multibar.create(
				1,
				1,
				{},
				{
					format: '  #  | SUBTASK',
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
					format:
						'-----+------------------------------------------------------------------',
					barsize: 1
				}
			);
			bottomBorderBar.update(1);
		}

		// Format subtask display
		const displayTitle =
			title && title.length > 66
				? `${title.substring(0, 63)}...`
				: title || `Subtask ${subtaskId}`;

		// Format as "X/Y" where X is current subtask number and Y is total
		const subtaskNumber = `${this.generatedSubtasks}/${this.numTasks}`;
		const subtaskNumberPadded = subtaskNumber.padStart(3, ' ');

		// Create individual subtask bar
		const subtaskBar = this.multibar.create(
			1,
			1,
			{},
			{
				format: ` ${subtaskNumberPadded} | {title}`,
				barsize: 1
			}
		);

		subtaskBar.update(1, { title: displayTitle });

		// Add border row after each subtask
		const borderBar = this.multibar.create(
			1,
			1,
			{},
			{
				format:
					'-----+------------------------------------------------------------------',
				barsize: 1
			}
		);
		borderBar.update(1);
	}

	// Methods needed by expand-task.js
	updateTaskProgress(taskId, stage, message) {
		// For single task expansion, update the progress display
		if (this.expandType === 'single') {
			// Update the time/tokens bar with current stage
			if (this.timeTokensBar) {
				const tokensLabel = this.isEstimate ? '~ Tokens (I/O)' : 'Tokens (I/O)';
				this.timeTokensBar.update(1, {
					clock: '⏱️',
					elapsed: this._formatElapsedTime(),
					subtasks: this.subtasksCreated,
					in: this.tokensIn,
					out: this.tokensOut,
					remaining: stage === 'completed' ? 'Done!' : `${stage}...`,
					tokensLabel
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
			// For single task expansion, set the values directly (first time)
			// For expand-all, we accumulate
			if (this.expandType === 'single' && this.isEstimate) {
				// Replace estimates with actual values
				this.tokensIn = telemetryData.inputTokens || 0;
				this.tokensOut = telemetryData.outputTokens || 0;
				this.isEstimate = false; // Mark as actual values
			} else {
				this.tokensIn += telemetryData.inputTokens || 0;
				this.tokensOut += telemetryData.outputTokens || 0;
			}
			this._updateTimeTokensBar();
		}
	}

	// Increment subtask count for real-time updates
	incrementSubtaskCount() {
		this.subtasksCreated++;
		this._updateTimeTokensBar();
	}

	// Methods needed by expand-all-tasks.js
	updateOverallProgress(stage, message) {
		// Update the time/tokens bar with overall progress
		if (this.timeTokensBar) {
			const tokensLabel = this.isEstimate ? '~ Tokens (I/O)' : 'Tokens (I/O)';
			this.timeTokensBar.update(1, {
				clock: '⏱️',
				elapsed: this._formatElapsedTime(),
				subtasks: this.subtasksCreated,
				in: this.tokensIn,
				out: this.tokensOut,
				remaining:
					stage === 'completed' ? 'Done!' : this._estimateRemainingTime(),
				tokensLabel
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
