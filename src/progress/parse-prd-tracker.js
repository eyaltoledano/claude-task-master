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

// Constants
const CONSTANTS = {
	DEBOUNCE_DELAY: 100,
	MAX_TITLE_LENGTH: 57,
	TRUNCATED_LENGTH: 54,
	TASK_ID_PAD_START: 3,
	TASK_ID_PAD_END: 4,
	PRIORITY_PAD_END: 3,
	VALID_PRIORITIES: ['high', 'medium', 'low'],
	DEFAULT_PRIORITY: 'medium'
};

/**
 * Helper class to manage update debouncing
 */
class UpdateDebouncer {
	constructor(delay = CONSTANTS.DEBOUNCE_DELAY) {
		this.delay = delay;
		this.pendingTimeout = null;
	}

	debounce(callback) {
		this.clear();
		this.pendingTimeout = setTimeout(() => {
			callback();
			this.pendingTimeout = null;
		}, this.delay);
	}

	clear() {
		if (this.pendingTimeout) {
			clearTimeout(this.pendingTimeout);
			this.pendingTimeout = null;
		}
	}

	hasPending() {
		return this.pendingTimeout !== null;
	}
}

/**
 * Helper class to manage priority counts
 */
class PriorityManager {
	constructor() {
		this.priorities = { high: 0, medium: 0, low: 0 };
	}

	increment(priority) {
		const normalized = this.normalize(priority);
		this.priorities[normalized]++;
		return normalized;
	}

	normalize(priority) {
		const lowercased = priority
			? priority.toLowerCase()
			: CONSTANTS.DEFAULT_PRIORITY;
		return CONSTANTS.VALID_PRIORITIES.includes(lowercased)
			? lowercased
			: CONSTANTS.DEFAULT_PRIORITY;
	}

	getCounts() {
		return { ...this.priorities };
	}
}

/**
 * Helper class for formatting task display elements
 */
class TaskFormatter {
	static formatTitle(title, taskNumber) {
		if (!title) return `Task ${taskNumber}`;
		return title.length > CONSTANTS.MAX_TITLE_LENGTH
			? title.substring(0, CONSTANTS.TRUNCATED_LENGTH) + '...'
			: title;
	}

	static formatPriority(priority) {
		return getPriorityIndicator(priority, false).padEnd(
			CONSTANTS.PRIORITY_PAD_END,
			' '
		);
	}

	static formatTaskId(taskNumber) {
		return taskNumber
			.toString()
			.padStart(CONSTANTS.TASK_ID_PAD_START, ' ')
			.padEnd(CONSTANTS.TASK_ID_PAD_END, ' ');
	}
}

/**
 * Tracks progress for PRD parsing operations with multibar display
 */
class ParsePrdTracker extends BaseProgressTracker {
	_initializeCustomProperties(options) {
		this.append = options.append;
		this.priorityManager = new PriorityManager();
		this.debouncer = new UpdateDebouncer();
		this.headerShown = false;
	}

	_getTimeTokensBarFormat() {
		return `{clock} {elapsed} | ${PRIORITY_DOTS.high} {high}  ${PRIORITY_DOTS.medium} {medium}  ${PRIORITY_DOTS.low} {low} | Tokens (I/O): {in}/{out} | Est: {remaining}`;
	}

	_getProgressBarFormat() {
		return 'Tasks {tasks} |{bar}| {percentage}%';
	}

	_getCustomTimeTokensPayload() {
		return this.priorityManager.getCounts();
	}

	addTaskLine(taskNumber, title, priority = 'medium') {
		if (!this.multibar || this.isFinished) return;

		this._ensureHeaderShown();
		const normalizedPriority = this._updateTaskCounters(taskNumber, priority);

		// Immediately update the time/tokens bar to show the new priority count
		this._updateTimeTokensBar();

		this.debouncer.debounce(() => {
			this._updateProgressDisplay(taskNumber, title, normalizedPriority);
		});
	}

	_ensureHeaderShown() {
		if (!this.headerShown) {
			this.headerShown = true;
			createProgressHeader(
				this.multibar,
				' TASK | PRI | TITLE',
				'------+-----+----------------------------------------------------------------'
			);
		}
	}

	_updateTaskCounters(taskNumber, priority) {
		const normalizedPriority = this.priorityManager.increment(priority);
		this.completedUnits = taskNumber;
		return normalizedPriority;
	}

	_updateProgressDisplay(taskNumber, title, normalizedPriority) {
		this.progressBar.update(this.completedUnits, {
			tasks: `${this.completedUnits}/${this.numUnits}`
		});

		const displayTitle = TaskFormatter.formatTitle(title, taskNumber);
		const priorityDisplay = TaskFormatter.formatPriority(normalizedPriority);
		const taskIdCentered = TaskFormatter.formatTaskId(taskNumber);

		createProgressRow(
			this.multibar,
			` ${taskIdCentered} | ${priorityDisplay} | {title}`,
			{ title: displayTitle }
		);

		createBorder(
			this.multibar,
			'------+-----+----------------------------------------------------------------'
		);

		this._updateTimeTokensBar();
	}

	finish() {
		// Flush any pending updates before finishing
		if (this.debouncer.hasPending()) {
			this.debouncer.clear();
			this._updateTimeTokensBar();
		}
		this.cleanup();
		super.finish();
	}

	/**
	 * Override cleanup to handle pending updates
	 */
	_performCustomCleanup() {
		this.debouncer.clear();
	}

	getSummary() {
		return {
			...super.getSummary(),
			taskPriorities: this.priorityManager.getCounts(),
			actionVerb: this.append ? 'appended' : 'generated'
		};
	}
}

export function createParsePrdTracker(options = {}) {
	return new ParsePrdTracker(options);
}
