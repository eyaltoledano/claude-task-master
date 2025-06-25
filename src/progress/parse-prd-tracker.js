import chalk from 'chalk';
import { newMultiBar } from './cli-progress-factory.js';
import {
	getCliPriorityIndicators,
	getPriorityIndicator,
	getStatusBarPriorityIndicators,
	getPriorityColors
} from '../ui/indicators.js';

// Get centralized priority indicators
const PRIORITY_INDICATORS = getCliPriorityIndicators();
const PRIORITY_DOTS = getStatusBarPriorityIndicators();
const PRIORITY_COLORS = getPriorityColors();

/**
 * Tracks progress for PRD parsing operations with multibar display
 */
export class ParsePrdTracker {
	constructor(options = {}) {
		this.numTasks = options.numTasks || 10;
		this.append = options.append;
		this.startTime = null;
		this.taskPriorities = { high: 0, medium: 0, low: 0 };
		this.completedTasks = 0;
		this.tokensIn = 0;
		this.tokensOut = 0;

		// UI components
		this.multibar = null;
		this.timeTokensBar = null;
		this.progressBar = null;
		this._timerInterval = null;

		// State flags
		this.isStarted = false;
		this.isFinished = false;

		// Time tracking for stable estimates
		this.lastTaskTime = null;
		this.bestAvgTimePerTask = null;
		this.lastEstimateTime = null;
		this.lastEstimateSeconds = 0;
	}

	start() {
		if (this.isStarted || this.isFinished) return;

		this.isStarted = true;
		this.startTime = Date.now();

		this.multibar = newMultiBar();

		// Time/tokens/priority status bar
		this.timeTokensBar = this.multibar.create(
			1,
			0,
			{},
			{
				format: `{clock} {elapsed} | ${PRIORITY_DOTS.high} {high}  ${PRIORITY_DOTS.medium} {medium}  ${PRIORITY_DOTS.low} {low} | Tokens (I/O): {in}/{out} | Est: {remaining}`,
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false
			}
		);

		// Main progress bar
		this.progressBar = this.multibar.create(
			this.numTasks,
			0,
			{},
			{
				format: 'Tasks {tasks} |{bar}| {percentage}%',
				barCompleteChar: '\u2588',
				barIncompleteChar: '\u2591'
			}
		);

		this._updateTimeTokensBar();
		this.progressBar.update(0, { tasks: `0/${this.numTasks}` });

		// Update timer every second
		this._timerInterval = setInterval(() => this._updateTimeTokensBar(), 1000);
	}

	updateTokens(tokensIn, tokensOut) {
		this.tokensIn = tokensIn || 0;
		this.tokensOut = tokensOut || 0;
		this._updateTimeTokensBar();
	}

	addTaskLine(taskNumber, title, priority = 'medium') {
		if (!this.multibar || this.isFinished) return;

		// Normalize priority
		const normalizedPriority = ['high', 'medium', 'low'].includes(priority)
			? priority
			: 'medium';

		// Update counters
		this.taskPriorities[normalizedPriority]++;
		this.completedTasks = taskNumber;

		// Track timing for better estimates
		const now = Date.now();
		if (this.completedTasks > 0) {
			const elapsed = (now - this.startTime) / 1000;
			const currentAvgTimePerTask = elapsed / this.completedTasks;

			// Use the best (most recent) average we've seen to avoid degrading estimates
			if (
				this.bestAvgTimePerTask === null ||
				currentAvgTimePerTask < this.bestAvgTimePerTask
			) {
				this.bestAvgTimePerTask = currentAvgTimePerTask;
			}
		}
		this.lastTaskTime = now;

		// Reset estimate timing for fresh calculation
		this.lastEstimateTime = null;
		this.lastEstimateSeconds = 0;

		// Update progress bar
		this.progressBar.update(this.completedTasks, {
			tasks: `${this.completedTasks}/${this.numTasks}`
		});

		// Create individual task display
		const displayTitle =
			title && title.length > 60
				? title.substring(0, 57) + '...'
				: title || `Task ${taskNumber}`;
		const priorityIndicator = getPriorityIndicator(normalizedPriority, false); // false = CLI context

		const taskBar = this.multibar.create(
			1,
			1,
			{},
			{
				format: `${priorityIndicator} Task ${taskNumber}/${this.numTasks}: {title}`,
				barsize: 1
			}
		);

		taskBar.update(1, { title: displayTitle });
		this._updateTimeTokensBar();
	}

	_updateTimeTokensBar() {
		if (!this.timeTokensBar || this.isFinished) return;

		const elapsed = this._formatElapsedTime();
		const remaining = this._estimateRemainingTime();

		this.timeTokensBar.update(1, {
			clock: '⏱️',
			elapsed,
			high: this.taskPriorities.high,
			medium: this.taskPriorities.medium,
			low: this.taskPriorities.low,
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
		if (!this.startTime || this.completedTasks === 0) return '~0m 00s';

		const remainingTasks = Math.max(0, this.numTasks - this.completedTasks);

		// If we're done, show completion
		if (remainingTasks === 0) {
			return '~0m 00s';
		}

		const now = Date.now();

		// If we have a previous estimate and it's recent, count down from it
		if (this.lastEstimateTime !== null && this.lastEstimateSeconds > 0) {
			const secondsSinceEstimate = Math.floor(
				(now - this.lastEstimateTime) / 1000
			);
			const countdownSeconds = Math.max(
				0,
				this.lastEstimateSeconds - secondsSinceEstimate
			);

			if (countdownSeconds > 0) {
				const minutes = Math.floor(countdownSeconds / 60);
				const seconds = countdownSeconds % 60;
				return `~${minutes}m ${seconds.toString().padStart(2, '0')}s`;
			}
		}

		// Calculate fresh estimate (either first time or countdown reached 0)
		let avgTimePerTask;
		if (this.bestAvgTimePerTask !== null) {
			avgTimePerTask = this.bestAvgTimePerTask;
		} else {
			// Fallback to current calculation
			const elapsed = (now - this.startTime) / 1000;
			avgTimePerTask = elapsed / this.completedTasks;
		}

		const estimatedRemainingSeconds = Math.max(
			0,
			Math.floor(avgTimePerTask * remainingTasks)
		);

		// Store this estimate for countdown
		this.lastEstimateTime = now;
		this.lastEstimateSeconds = estimatedRemainingSeconds;

		// If estimate is 0, show completion
		if (estimatedRemainingSeconds === 0) {
			return '~0m 00s';
		}

		const minutes = Math.floor(estimatedRemainingSeconds / 60);
		const seconds = estimatedRemainingSeconds % 60;
		return `~${minutes}m ${seconds.toString().padStart(2, '0')}s`;
	}

	getElapsedTime() {
		return this.startTime
			? Math.floor((Date.now() - this.startTime) / 1000)
			: 0;
	}

	stop() {
		if (this.isFinished) return;

		this.isFinished = true;

		if (this._timerInterval) {
			clearInterval(this._timerInterval);
			this._timerInterval = null;
		}

		if (this.multibar && this.isStarted) {
			this._updateTimeTokensBar();
			this.multibar = null;
			this.timeTokensBar = null;
			this.progressBar = null;
		}
	}

	getSummary() {
		return {
			taskPriorities: { ...this.taskPriorities },
			elapsedTime: this.getElapsedTime(),
			actionVerb: this.append ? 'appended' : 'generated'
		};
	}
}

export function createParsePrdTracker(options = {}) {
	return new ParsePrdTracker(options);
}
