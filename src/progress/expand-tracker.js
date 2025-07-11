import chalk from 'chalk';
import { newMultiBar } from './cli-progress-factory.js';
import { BaseProgressTracker } from './base-progress-tracker.js';
import { createProgressHeader, createProgressRow, createBorder } from './tracker-ui.js';
import { getPriorityIndicator } from '../ui/indicators.js';

/**
 * Tracks progress for task expansion operations with individual task bars
 * Supports both single task expansion and expand-all operations
 */
class ExpandTracker extends BaseProgressTracker {
	constructor(options = {}) {
		// Initialize base with custom unit name and count
		super({
			numUnits: options.numTasks || 1,
			unitName: options.expandType === 'single' ? 'subtask' : 'task',
			...options
		});
		
		// ExpandTracker-specific properties
		this.expandType = options.expandType || 'single';
		this.numTasks = options.numTasks || 1; // Keep original property name for compatibility
		this.taskId = options.taskId;
		this.taskTitle = options.taskTitle;
		this.taskPriority = options.taskPriority || 'medium';
		this.subtasksCreated = 0;
		this.tasksSkipped = 0;
		this.tasksWithErrors = 0;
		
		// Additional UI components beyond base
		this.currentTaskBar = null;
		this.subtaskProgressBar = null;
		
		// Current task tracking
		this.currentTaskId = null;
		this.currentTaskTitle = null;
		this.currentTaskSubtaskCount = 0;
		this.currentTaskSubtaskProgress = 0;
		
		// Results tracking
		this.expansionResults = [];
		this.errors = [];
		this.headerShown = false;
		
		// For single task expansion, track subtask generation
		this.generatedSubtasks = 0;
		this.lastSubtaskGenerationTime = null;
		this.avgTimePerSubtask = null;
		
		// Timing - keep original properties for complex estimation logic
		this.completedExpansions = 0; // Keep alongside base completedUnits for compatibility
		this.lastExpansionTime = null;
		this.bestAvgTimePerExpansion = null;
		this.lastEstimateTime = null;
		this.lastEstimateSeconds = 0;
	}

	// Override base methods to customize for ExpandTracker
	_getTimeTokensBarFormat() {
		return `{clock} {elapsed} | Subtasks: {subtasks} | {tokensLabel}: {in}/{out} | {remaining}`;
	}

	_getProgressBarFormat() {
		return this.expandType === 'single'
			? 'Subtask {tasks} |{bar}| {percentage}%'
			: 'Task {tasks} |{bar}| {percentage}%';
	}

	_getCustomTimeTokensPayload() {
		const subtaskCount = this.expandType === 'single' ? this.generatedSubtasks : this.subtasksCreated;
		const tokensLabel = this.isEstimate ? '~ Tokens (I/O)' : 'Tokens (I/O)';
		return { subtasks: subtaskCount, tokensLabel };
	}

	// Override progress calculation for fractional progress support
	_getProgressFraction() {
		if (this.expandType === 'single') {
			return this.generatedSubtasks / this.numTasks;
		} else {
			let fraction = this.completedExpansions;
			if (this.currentTaskSubtaskCount > 0) {
				fraction += this.currentTaskSubtaskProgress / this.currentTaskSubtaskCount;
			}
			return fraction / this.numTasks;
		}
	}

	// Override estimation to use original complex logic
	_estimateRemainingTime() {
		// For single task expansion, use subtask generation data
		if (this.expandType === 'single') {
			if (this.generatedSubtasks === 0 || !this.avgTimePerSubtask) {
				return 'Est: ~calculating...';
			}

			const remainingSubtasks = this.numTasks - this.generatedSubtasks;
			if (remainingSubtasks <= 0) return 'Complete!';

			const now = Date.now();
			const estimatedSeconds = Math.ceil(remainingSubtasks * this.avgTimePerSubtask);

			// Use stabilization logic
			if (this.lastEstimateTime && this.lastEstimateSeconds >= 0) {
				const elapsedSinceEstimate = Math.floor((now - this.lastEstimateTime) / 1000);
				const countdownSeconds = Math.max(0, this.lastEstimateSeconds - elapsedSinceEstimate);

				if (countdownSeconds === 0) return 'Complete!';

				const timeSinceLastEstimate = now - this.lastEstimateTime;
				const significantlyLower = estimatedSeconds < this.lastEstimateSeconds * 0.8;

				if (timeSinceLastEstimate < 5000 && !significantlyLower && countdownSeconds > 0) {
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

		// For expand-all, use original complex fractional logic
		let fractionalProgress = this.completedExpansions;
		if (this.currentTaskSubtaskCount > 0) {
			fractionalProgress += this.currentTaskSubtaskProgress / this.currentTaskSubtaskCount;
		}

		if (fractionalProgress < 0.05) {
			return 'Est: ~calculating...';
		}

		if (!this.bestAvgTimePerExpansion && fractionalProgress > 0 && this.startTime) {
			const elapsed = (Date.now() - this.startTime) / 1000;
			const avgTimePerTask = elapsed / fractionalProgress;
			const remainingProgress = this.numTasks - fractionalProgress;
			const estimatedSeconds = Math.ceil(remainingProgress * avgTimePerTask);
			return `Est: ~${this._formatDuration(estimatedSeconds)} (initial)`;
		}

		if (!this.bestAvgTimePerExpansion) {
			return 'Est: ~calculating...';
		}

		const remainingProgress = this.numTasks - fractionalProgress;
		if (remainingProgress <= 0) return 'Complete!';

		const now = Date.now();
		const estimatedSeconds = Math.ceil(remainingProgress * this.bestAvgTimePerExpansion);

		// Stabilization logic
		if (this.lastEstimateTime && this.lastEstimateSeconds >= 0) {
			const elapsedSinceEstimate = Math.floor((now - this.lastEstimateTime) / 1000);
			const countdownSeconds = Math.max(0, this.lastEstimateSeconds - elapsedSinceEstimate);

			if (countdownSeconds === 0) return 'Complete!';

			const timeSinceLastEstimate = now - this.lastEstimateTime;
			const significantlyLower = estimatedSeconds < this.lastEstimateSeconds * 0.8;

			if (timeSinceLastEstimate < 5000 && !significantlyLower && countdownSeconds > 0) {
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

	// Override setupCustomUI to add ExpandTracker-specific bars
	_setupCustomUI() {
		// Task info bar for single task expansion
		if (this.expandType === 'single' && this.taskId && this.taskTitle) {
			const priorityDots = getPriorityIndicator(this.taskPriority, false);
			const displayTitle = this.taskTitle.length > 60 ? `${this.taskTitle.substring(0, 57)}...` : this.taskTitle;

			const taskInfoBar = this.multibar.create(1, 1, {}, {
				format: `Expanding Task ${this.taskId}: ${priorityDots} ${displayTitle}`,
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false
			});
			taskInfoBar.update(1);
		}

		// Current task info bar and subtask progress bar for expand-all
		if (this.expandType === 'all') {
			this.currentTaskBar = this.multibar.create(1, 0, {}, {
				format: '{taskInfo}',
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false
			});
			this._updateCurrentTaskBar();

			this.subtaskProgressBar = this.multibar.create(1, 0, {}, {
				format: 'Subtask {subtasks} |{bar}| {percentage}%',
				barCompleteChar: '\u2588',
				barIncompleteChar: '\u2591'
			});
		}
	}

	// Keep all original methods that have complex logic
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
				const fractionalProgress = this.completedExpansions + subtaskNumber / this.currentTaskSubtaskCount;

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

	addExpansionLine(taskId, title, subtasksGenerated = 0, status = 'success', telemetryData = null, complexityScore = null) {
		if (!this.multibar || this.isFinished) return;

		// Show header on first task for expand-all using UI utility
		if (!this.headerShown && this.expandType === 'all') {
			this.headerShown = true;
			createProgressHeader(
				this.multibar,
				' TASK | SUB | SCORE |  IN | OUT |  COST  | TITLE',
				'------+-----+-------+-----+-----+--------+----------------------------------------------------------------'
			);
		}

		// Update counters based on status
		this.completedExpansions++;
		this.completedUnits = this.completedExpansions; // Keep base in sync
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

		// Track timing for better estimates (original complex logic)
		const now = Date.now();
		if (this.completedExpansions > 0) {
			const elapsed = (now - this.startTime) / 1000;
			const effectiveCompletions = this.completedExpansions;
			const currentAvgTimePerExpansion = elapsed / effectiveCompletions;

			// Use exponential moving average
			if (this.bestAvgTimePerExpansion === null) {
				this.bestAvgTimePerExpansion = currentAvgTimePerExpansion;
			} else {
				this.bestAvgTimePerExpansion = 0.7 * currentAvgTimePerExpansion + 0.3 * this.bestAvgTimePerExpansion;
			}
		}
		this.lastExpansionTime = now;

		// Update progress bar
		const displayTaskNumber = this.completedExpansions;
		this.progressBar.update(this.completedExpansions, {
			tasks: `${displayTaskNumber}/${this.numTasks}`
		});

		// Create individual task display for expand-all
		if (this.expandType === 'all') {
			const displayTitle = title && title.length > 60 ? `${title.substring(0, 57)}...` : title || `Task ${taskId}`;
			const statusIndicator = this._getStatusIndicator(status);
			const subtasksDisplay = subtasksGenerated.toString();
			const scoreDisplay = complexityScore !== null && complexityScore !== undefined ? complexityScore.toString() : 'N/A';
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
			const scorePadded = centerText(scoreDisplay, 5);
			const tokensInPadded = tokensIn.toString().padStart(3, ' ');
			const tokensOutPadded = tokensOut.toString().padStart(3, ' ');
			const costFormatted = cost > 0 ? `$${cost.toFixed(3)}` : '$0.000';
			const costPadded = costFormatted.padStart(6, ' ');

			createProgressRow(
				this.multibar,
				` ${taskIdCentered} | ${subtasksPadded} | ${scorePadded} | ${tokensInPadded} | ${tokensOutPadded} | ${costPadded} | {title}`,
				{ title: displayTitle }
			);

			createBorder(this.multibar, '------+-----+-------+-----+-----+--------+----------------------------------------------------------------');
		} else {
			// For single task expansion, just store the result
			this.expansionResults.push({
				id: taskId.toString(),
				subtasks: subtasksGenerated.toString(),
				complexityScore: complexityScore !== null && complexityScore !== undefined ? complexityScore.toString() : 'N/A',
				title: title,
				status: status,
				tokensIn: telemetryData?.inputTokens || 0,
				tokensOut: telemetryData?.outputTokens || 0,
				cost: telemetryData?.totalCost || 0
			});
		}

		this._updateTimeTokensBar();
	}

	// Add subtask line using UI utility
	addSubtaskLine(subtaskId, title) {
		if (!this.multibar || this.isFinished || this.expandType !== 'single') return;

		// Show header on first subtask using UI utility
		if (!this.headerShown) {
			this.headerShown = true;
			createProgressHeader(
				this.multibar,
				'  #  | SUBTASK',
				'-----+------------------------------------------------------------------'
			);
		}

		// Format subtask display
		const displayTitle = title && title.length > 66 ? `${title.substring(0, 63)}...` : title || `Subtask ${subtaskId}`;
		const subtaskNumber = `${this.generatedSubtasks}/${this.numTasks}`;
		const subtaskNumberPadded = subtaskNumber.padStart(3, ' ');

		createProgressRow(
			this.multibar,
			` ${subtaskNumberPadded} | {title}`,
			{ title: displayTitle }
		);

		createBorder(this.multibar, '-----+------------------------------------------------------------------');
	}

	// Keep all other original methods unchanged
	addError(taskId, errorMessage) {
		this.errors.push(`Task ${taskId}: ${errorMessage}`);
		this.addExpansionLine(taskId, `Error expanding task`, 0, 'error');
	}

	_getStatusIndicator(status) {
		switch (status) {
			case 'success': return chalk.green('✓');
			case 'skipped': return chalk.yellow('○');
			case 'error': return chalk.red('✗');
			default: return chalk.gray('?');
		}
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

	_updatePartialTimingEstimate() {
		// Update timing estimates based on partial progress during task expansion
		if (this.expandType !== 'all' || !this.startTime) return;

		const now = Date.now();
		const elapsed = (now - this.startTime) / 1000;

		// Calculate fractional progress including current task
		let fractionalProgress = this.completedExpansions;
		if (this.currentTaskSubtaskCount > 0) {
			fractionalProgress += this.currentTaskSubtaskProgress / this.currentTaskSubtaskCount;
		}

		// Only update if we have meaningful progress
		if (fractionalProgress > 0.1) {
			const avgTimePerTask = elapsed / fractionalProgress;

			// Update the best average with exponential moving average
			if (this.bestAvgTimePerExpansion === null) {
				this.bestAvgTimePerExpansion = avgTimePerTask;
			} else {
				this.bestAvgTimePerExpansion = 0.8 * avgTimePerTask + 0.2 * this.bestAvgTimePerExpansion;
			}
		}

		this._updateTimeTokensBar();
	}

	// Keep all other methods exactly as they were
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

	async finish() {
		return this.stop();
	}

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
				this.avgTimePerSubtask = 0.7 * currentAvg + 0.3 * this.avgTimePerSubtask;
			}
		}

		this.lastSubtaskGenerationTime = now;
		this._updateTimeTokensBar();
	}

	updateTaskProgress(taskId, stage, message) {
		if (this.expandType === 'single') {
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
	}

	incrementErrors() {
		this.tasksWithErrors++;
	}

	incrementCompleted() {
		if (this.expandType === 'single') {
			this.completedExpansions = 1;
			this.completedUnits = 1;
		}
	}

	addTelemetryData(telemetryData) {
		if (telemetryData) {
			if (this.expandType === 'single' && this.isEstimate) {
				this.tokensIn = telemetryData.inputTokens || 0;
				this.tokensOut = telemetryData.outputTokens || 0;
				this.isEstimate = false;
			} else {
				this.tokensIn += telemetryData.inputTokens || 0;
				this.tokensOut += telemetryData.outputTokens || 0;
			}
			this._updateTimeTokensBar();
		}
	}

	incrementSubtaskCount() {
		this.subtasksCreated++;
		this._updateTimeTokensBar();
	}

	updateOverallProgress(stage, message) {
		if (this.timeTokensBar) {
			const tokensLabel = this.isEstimate ? '~ Tokens (I/O)' : 'Tokens (I/O)';
			this.timeTokensBar.update(1, {
				clock: '⏱️',
				elapsed: this._formatElapsedTime(),
				subtasks: this.subtasksCreated,
				in: this.tokensIn,
				out: this.tokensOut,
				remaining: stage === 'completed' ? 'Done!' : this._estimateRemainingTime(),
				tokensLabel
			});
		}
	}

	setTotalTasks(totalTasks) {
		this.numTasks = totalTasks;
		this.numUnits = totalTasks; // Keep base in sync
		if (this.progressBar) {
			this.progressBar.setTotal(totalTasks);
			const displayTaskNumber = Math.min(this.completedExpansions, this.numTasks);
			this.progressBar.update(this.completedExpansions, {
				tasks: `${displayTaskNumber}/${this.numTasks}`
			});
		}
	}

	getSummary() {
		const successfulExpansions = this.completedExpansions - this.tasksSkipped - this.tasksWithErrors;
		return {
			expandType: this.expandType,
			taskId: this.taskId,
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
