import { newMultiBar } from './cli-progress-factory.js';
import chalk from 'chalk';

// Priority display dots and colors
const PRIORITY_DOTS = {
	high: chalk.red('⋮'),
	medium: chalk.hex('#FF8800')(':'),
	low: chalk.yellow('.')
};

const PRIORITY_COLORS = {
	high: chalk.hex('#CC0000'),
	medium: chalk.hex('#FF8800'),
	low: chalk.yellow
};

/**
 * Tracks progress for PRD parsing operations with multibar display
 */
export class PrdParseTracker {
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
	}

	start() {
		if (this.isStarted || this.isFinished) return;

		this.isStarted = true;
		this.startTime = Date.now();

		this.multibar = newMultiBar({
			clearOnComplete: false,
			hideCursor: true,
			stopOnComplete: false
		});

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
				barIncompleteChar: '\u2591',
				hideCursor: true,
				clearOnComplete: false,
				barsize: 40,
				forceRedraw: true,
				noSpinner: true
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

		// Update progress bar
		this.progressBar.update(this.completedTasks, {
			tasks: `${this.completedTasks}/${this.numTasks}`
		});

		// Create individual task display
		const displayTitle =
			title && title.length > 60
				? title.substring(0, 57) + '...'
				: title || `Task ${taskNumber}`;
		const priorityColor = PRIORITY_COLORS[normalizedPriority];

		const taskBar = this.multibar.create(
			1,
			1,
			{},
			{
				format: `${priorityColor('●●●')} Task ${taskNumber}/${this.numTasks}: {title}`,
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false,
				forceRedraw: true
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

		const elapsed = (Date.now() - this.startTime) / 1000;
		const avgTimePerTask = elapsed / this.completedTasks;
		const remainingTasks = Math.max(0, this.numTasks - this.completedTasks);
		const estimatedSeconds = Math.floor(avgTimePerTask * remainingTasks);

		const minutes = Math.floor(estimatedSeconds / 60);
		const seconds = estimatedSeconds % 60;
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
			this.multibar.stop();
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

export function createPrdParseTracker(options = {}) {
	return new PrdParseTracker(options);
}
