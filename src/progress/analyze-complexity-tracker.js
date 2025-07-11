import chalk from 'chalk';
import { newMultiBar } from './cli-progress-factory.js';
import { BaseProgressTracker } from './base-progress-tracker.js';
import {
	createProgressHeader,
	createProgressRow,
	createBorder
} from './tracker-ui.js';
import {
	getCliComplexityIndicators,
	getStatusBarComplexityIndicators,
	getComplexityColors,
	getComplexityIndicator
} from '../ui/indicators.js';

// Get centralized complexity indicators
const COMPLEXITY_DOTS = getCliComplexityIndicators();
const COMPLEXITY_STATUS_DOTS = getStatusBarComplexityIndicators();
const COMPLEXITY_COLORS = getComplexityColors();

/**
 * Tracks progress for complexity analysis operations with individual task bars
 */
class AnalyzeComplexityTracker extends BaseProgressTracker {
	_initializeCustomProperties(options) {
		this.complexityBuckets = { high: 0, medium: 0, low: 0 };
		this.analysisResults = [];
		this.headerShown = false;
		// Removed: completedAnalyses (use completedUnits from base)
	}

	_getTimeTokensBarFormat() {
		return `{clock} {elapsed} | ${COMPLEXITY_STATUS_DOTS.high} {high}  ${COMPLEXITY_STATUS_DOTS.medium} {medium}  ${COMPLEXITY_STATUS_DOTS.low} {low} | Tokens (I/O): {in}/{out} | Est: {remaining}`;
	}

	_getProgressBarFormat() {
		return 'Analysis {analyses} |{bar}| {percentage}%';
	}

	_getCustomTimeTokensPayload() {
		return {
			high: this.complexityBuckets.high,
			medium: this.complexityBuckets.medium,
			low: this.complexityBuckets.low
		};
	}

	addAnalysisLine(
		taskId,
		title,
		complexityScore = 5,
		recommendedSubtasks = null
	) {
		if (!this.multibar || this.isFinished) return;

		// Show header on first task using UI utility
		if (!this.headerShown) {
			this.headerShown = true;
			createProgressHeader(
				this.multibar,
				' TASK | SCORE | SUB | TITLE',
				'------+-------+-----+--------------------------------------------------'
			);
		}

		// Determine complexity bucket
		let complexityLevel = 'medium';
		if (complexityScore >= 7) complexityLevel = 'high';
		else if (complexityScore <= 3) complexityLevel = 'low';

		// Update counters
		this.complexityBuckets[complexityLevel]++;
		this.completedUnits++;

		// Update progress bar
		this.progressBar.update(this.completedUnits, {
			analyses: `${this.completedUnits}/${this.numUnits}`
		});

		// Create individual task display
		const displayTitle =
			title && title.length > 50
				? `${title.substring(0, 47)}...`
				: title || `Task ${taskId}`;
		const complexityIndicator = this._getComplexityIndicator(complexityScore);
		const subtasksDisplay =
			recommendedSubtasks !== null && recommendedSubtasks !== undefined
				? recommendedSubtasks.toString()
				: 'N/A';

		// Store for final summary
		this.analysisResults.push({
			priority: complexityIndicator,
			id: taskId.toString(),
			score: complexityScore.toString(),
			subtasks: subtasksDisplay,
			title: displayTitle
		});

		// Format row data
		const taskIdCentered = taskId.toString().padStart(3, ' ').padEnd(4, ' ');
		const scorePadded = complexityScore.toString().padStart(1, ' ');
		const subtasksPadded = `${subtasksDisplay} `.padStart(3, ' ');

		createProgressRow(
			this.multibar,
			` ${taskIdCentered} | ${complexityIndicator} ${scorePadded} | ${subtasksPadded} | {title}`,
			{ title: displayTitle }
		);

		// Add border
		createBorder(
			this.multibar,
			'------+-------+-----+--------------------------------------------------'
		);

		this._updateTimeTokensBar();
	}

	_getComplexityIndicator(score) {
		return getComplexityIndicator(score, false); // false = not status bar version
	}

	getSummary() {
		return {
			...super.getSummary(),
			totalAnalyzed: this.completedUnits,
			highComplexity: this.complexityBuckets.high,
			mediumComplexity: this.complexityBuckets.medium,
			lowComplexity: this.complexityBuckets.low
		};
	}
}

export function createAnalyzeComplexityTracker(options = {}) {
	return new AnalyzeComplexityTracker(options);
}
