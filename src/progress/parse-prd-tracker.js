import chalk from 'chalk';
import { newMultiBar } from './cli-progress-factory.js';
import { BaseProgressTracker } from './base-progress-tracker.js';
import {
	createProgressHeader,
	createProgressRow,
	createBorder
} from './tracker-ui.js';
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
class ParsePrdTracker extends BaseProgressTracker {
	_initializeCustomProperties(options) {
		this.append = options.append;
		this.taskPriorities = { high: 0, medium: 0, low: 0 };
		// Time tracking for stable estimates (now in base)
		// Removed: lastTaskTime, bestAvgTimePerTask, lastEstimateTime, lastEstimateSeconds
	}

	_getTimeTokensBarFormat() {
		return `{clock} {elapsed} | ${PRIORITY_DOTS.high} {high}  ${PRIORITY_DOTS.medium} {medium}  ${PRIORITY_DOTS.low} {low} | Tokens (I/O): {in}/{out} | Est: {remaining}`;
	}

	_getProgressBarFormat() {
		return 'Tasks {tasks} |{bar}| {percentage}%';
	}

	_getCustomTimeTokensPayload() {
		return {
			high: this.taskPriorities.high,
			medium: this.taskPriorities.medium,
			low: this.taskPriorities.low
		};
	}

	addTaskLine(taskNumber, title, priority = 'medium') {
		if (!this.multibar || this.isFinished) return;

		// Show header on first task using UI utility
		if (!this.headerShown) {
			this.headerShown = true;
			createProgressHeader(
				this.multibar,
				' TASK | PRI | TITLE',
				'------+-----+----------------------------------------------------------------'
			);
		}

		// Normalize priority
		const normalizedPriority = ['high', 'medium', 'low'].includes(priority)
			? priority
			: 'medium';

		// Update counters
		this.taskPriorities[normalizedPriority]++;
		this.completedUnits = taskNumber; // Use base completedUnits

		// Update progress bar
		this.progressBar.update(this.completedUnits, {
			tasks: `${this.completedUnits}/${this.numUnits}`
		});

		// Create individual task display
		const displayTitle =
			title && title.length > 57
				? title.substring(0, 54) + '...'
				: title || `Task ${taskNumber}`;
		const priorityDisplay = getPriorityIndicator(
			normalizedPriority,
			false
		).padEnd(3, ' ');
		const taskIdCentered = taskNumber
			.toString()
			.padStart(3, ' ')
			.padEnd(4, ' ');

		createProgressRow(
			this.multibar,
			` ${taskIdCentered} | ${priorityDisplay} | {title}`,
			{ title: displayTitle }
		);

		// Add border line after each task using UI utility
		createBorder(
			this.multibar,
			'------+-----+----------------------------------------------------------------'
		);

		this._updateTimeTokensBar();
	}

	getSummary() {
		return {
			...super.getSummary(),
			taskPriorities: { ...this.taskPriorities },
			actionVerb: this.append ? 'appended' : 'generated'
		};
	}
}

export function createParsePrdTracker(options = {}) {
	return new ParsePrdTracker(options);
}
