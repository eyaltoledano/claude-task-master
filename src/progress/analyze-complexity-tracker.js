import chalk from 'chalk';
import { newMultiBar } from './cli-progress-factory.js';

// Complexity display dots for status bar (using proper dot indicators like priority system)
const COMPLEXITY_DOTS = {
	high: chalk.red('●') + chalk.red('●') + chalk.red('●'), // ●●● (7+)
	medium:
		chalk.hex('#FF8800')('●') + chalk.hex('#FF8800')('●') + chalk.white('○'), // ●●○ (4-6)
	low: chalk.green('●') + chalk.white('○') + chalk.white('○') // ●○○ (1-3)
};

// Simplified single character versions for status bar
const COMPLEXITY_STATUS_DOTS = {
	high: chalk.red('⋮'),
	medium: chalk.hex('#FF8800')(':'),
	low: chalk.green('.')
};

const COMPLEXITY_COLORS = {
	high: chalk.hex('#CC0000'),
	medium: chalk.hex('#FF8800'),
	low: chalk.green
};

/**
 * Tracks progress for complexity analysis operations with individual task bars
 */
export class AnalyzeComplexityTracker {
	constructor(options = {}) {
		this.numTasks = options.numTasks || 0;
		this.startTime = null;
		this.complexityBuckets = { high: 0, medium: 0, low: 0 };
		this.completedAnalyses = 0;
		this.tokensIn = 0;
		this.tokensOut = 0;

		// UI components
		this.multibar = null;
		this.timeTokensBar = null;
		this.progressBar = null;
		this._timerInterval = null;

		// Table for displaying results (for final summary only)
		this.analysisResults = [];

		// State flags
		this.isStarted = false;
		this.isFinished = false;
		this.headerShown = false;

		// Time tracking for stable estimates
		this.lastAnalysisTime = null;
		this.bestAvgTimePerAnalysis = null;
		this.lastEstimateTime = null;
		this.lastEstimateSeconds = 0;
	}

	start() {
		if (this.isStarted || this.isFinished) return;

		this.isStarted = true;
		this.startTime = Date.now();

		this.multibar = newMultiBar();

		// Time/tokens/complexity status bar
		this.timeTokensBar = this.multibar.create(
			1,
			0,
			{},
			{
				format: `{clock} {elapsed} | ${COMPLEXITY_STATUS_DOTS.high} {high}  ${COMPLEXITY_STATUS_DOTS.medium} {medium}  ${COMPLEXITY_STATUS_DOTS.low} {low} | Tokens (I/O): {in}/{out} | Est: {remaining}`,
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
				format: 'Analysis {analyses} |{bar}| {percentage}%',
				barCompleteChar: '\u2588',
				barIncompleteChar: '\u2591'
			}
		);

		this._updateTimeTokensBar();
		this.progressBar.update(0, { analyses: `0/${this.numTasks}` });

		// Update timer every second
		this._timerInterval = setInterval(() => this._updateTimeTokensBar(), 1000);
	}

	updateTokens(tokensIn, tokensOut) {
		this.tokensIn = tokensIn || 0;
		this.tokensOut = tokensOut || 0;
		this._updateTimeTokensBar();
	}

	addAnalysisLine(
		taskId,
		title,
		complexityScore = 5,
		recommendedSubtasks = null
	) {
		if (!this.multibar || this.isFinished) return;

		// Show header on first task
		if (!this.headerShown) {
			this.headerShown = true;

			// Top border
			const topBorderBar = this.multibar.create(
				1,
				1,
				{},
				{
					format: chalk.dim(
						'------+-------+-----+--------------------------------------------------'
					),
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
					format: chalk.dim(' TASK | SCORE | SUB | TITLE'),
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
					format: chalk.dim(
						'------+-------+-----+--------------------------------------------------'
					),
					barsize: 1
				}
			);
			bottomBorderBar.update(1);
		}

		// Determine complexity bucket based on score (1-3 low, 4-6 medium, 7+ high)
		let complexityLevel = 'medium';
		if (complexityScore >= 7) {
			complexityLevel = 'high';
		} else if (complexityScore <= 3) {
			complexityLevel = 'low';
		}

		// Update counters
		this.complexityBuckets[complexityLevel]++;
		this.completedAnalyses++;

		// Track timing for better estimates
		const now = Date.now();
		if (this.completedAnalyses > 0) {
			const elapsed = (now - this.startTime) / 1000;
			const currentAvgTimePerAnalysis = elapsed / this.completedAnalyses;

			// Use the best (most recent) average we've seen to avoid degrading estimates
			if (
				this.bestAvgTimePerAnalysis === null ||
				currentAvgTimePerAnalysis < this.bestAvgTimePerAnalysis
			) {
				this.bestAvgTimePerAnalysis = currentAvgTimePerAnalysis;
			}
		}
		this.lastAnalysisTime = now;

		// Reset estimate timing for fresh calculation
		this.lastEstimateTime = null;
		this.lastEstimateSeconds = 0;

		// Update progress bar
		this.progressBar.update(this.completedAnalyses, {
			analyses: `${this.completedAnalyses}/${this.numTasks}`
		});

		// Create individual task display (same pattern as parse-prd)
		const displayTitle =
			title && title.length > 50
				? title.substring(0, 47) + '...'
				: title || `Task ${taskId}`;

		const complexityIndicator = this._getComplexityIndicator(complexityScore);
		const subtasksDisplay =
			recommendedSubtasks !== null && recommendedSubtasks !== undefined
				? recommendedSubtasks.toString()
				: 'N/A';

		// Store for final summary table
		this.analysisResults.push({
			priority: complexityIndicator,
			id: taskId.toString(),
			score: complexityScore.toString(),
			subtasks: subtasksDisplay,
			title: displayTitle
		});

		// Create individual task bar with monospace-style formatting
		const taskIdCentered = taskId.toString().padStart(3, ' ').padEnd(4, ' '); // Center in 4-char width
		const scorePadded = complexityScore.toString().padStart(1, ' ');
		const subtasksPadded = (subtasksDisplay + ' ').padStart(3, ' ');

		const taskBar = this.multibar.create(
			1,
			1,
			{},
			{
				format: ` ${taskIdCentered} | ${complexityIndicator} ${scorePadded} | ${subtasksPadded} | {title}`,
				barsize: 1
			}
		);

		taskBar.update(1, { title: displayTitle });
		this._updateTimeTokensBar();
	}

	_getComplexityIndicator(score) {
		if (score >= 7) return COMPLEXITY_DOTS.high;
		if (score <= 3) return COMPLEXITY_DOTS.low;
		return COMPLEXITY_DOTS.medium;
	}

	_updateTimeTokensBar() {
		if (!this.timeTokensBar || this.isFinished) return;

		const elapsed = this._formatElapsedTime();
		const remaining = this._estimateRemainingTime();

		this.timeTokensBar.update(1, {
			clock: '⏱️',
			elapsed,
			high: this.complexityBuckets.high,
			medium: this.complexityBuckets.medium,
			low: this.complexityBuckets.low,
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
		if (this.completedAnalyses === 0 || !this.bestAvgTimePerAnalysis) {
			return '~calculating...';
		}

		const remainingTasks = this.numTasks - this.completedAnalyses;
		if (remainingTasks <= 0) return '~0s';

		const estimatedSeconds = Math.ceil(
			remainingTasks * this.bestAvgTimePerAnalysis
		);

		// Stabilize the estimate to avoid rapid changes
		const now = Date.now();
		if (
			this.lastEstimateTime &&
			now - this.lastEstimateTime < 3000 && // Less than 3 seconds since last estimate
			Math.abs(estimatedSeconds - this.lastEstimateSeconds) < 10 // Less than 10 second difference
		) {
			// Use the previous estimate to avoid jitter
			return this._formatDuration(this.lastEstimateSeconds);
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

	getSummary() {
		return {
			totalAnalyzed: this.completedAnalyses,
			highComplexity: this.complexityBuckets.high,
			mediumComplexity: this.complexityBuckets.medium,
			lowComplexity: this.complexityBuckets.low,
			elapsedTime: this.getElapsedTime()
		};
	}
}

export function createAnalyzeComplexityTracker(options = {}) {
	return new AnalyzeComplexityTracker(options);
}
