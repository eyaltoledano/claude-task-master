import { newMultiBar } from './cliProgressFactory.js';
import chalk from 'chalk';

/**
 * Tracks progress for PRD parsing operations with multibar display
 */
export class PrdParseTracker {
	constructor(options = {}) {
		this.numTasks = options.numTasks || 10;
		this.append = options.append || false;
		this.multibar = null;
		this.progressBars = {};
		this.isStarted = false;
		this.isFinished = false;
		this.startTime = null;
		this.taskPriorities = { high: 0, medium: 0, low: 0 };
		this.streamedTasksCount = 0;
		this.actionVerb = this.append ? 'Appending' : 'Generating';
	}

	/**
	 * Start the progress tracking with multibar
	 */
	start() {
		if (this.isStarted) return;

		this.isStarted = true;
		this.startTime = Date.now();

		// Create multibar
		this.multibar = newMultiBar({
			clearOnComplete: false,
			hideCursor: true,
			format: '{bar} | {percentage}% | {label} | {value}/{total}'
		});

		// Create progress bars for each phase
		this.progressBars.analyzing = this.multibar.create(100, 0, {
			label: chalk.cyan('Analyzing PRD')
		});

		this.progressBars.generating = this.multibar.create(this.numTasks, 0, {
			label: chalk.yellow(`${this.actionVerb} Tasks`)
		});

		this.progressBars.finalizing = this.multibar.create(100, 0, {
			label: chalk.green('Finalizing')
		});
	}

	/**
	 * Update analyzing phase progress
	 */
	updateAnalyzing(progress, label) {
		if (this.progressBars.analyzing) {
			this.progressBars.analyzing.update(progress, {
				label: chalk.cyan(label || 'Analyzing PRD')
			});
		}
	}

	/**
	 * Update generating phase progress
	 */
	updateGenerating(progress, label) {
		if (this.progressBars.generating) {
			this.progressBars.generating.update(progress, {
				label: chalk.yellow(label || `${this.actionVerb} Tasks`)
			});
		}
	}

	/**
	 * Complete generating phase
	 */
	completeGenerating() {
		if (this.progressBars.generating) {
			this.progressBars.generating.update(this.numTasks, {
				label: chalk.yellow(`${this.actionVerb} Tasks`)
			});
		}
	}

	/**
	 * Update finalizing phase progress
	 */
	updateFinalizing(progress, label) {
		if (this.progressBars.finalizing) {
			this.progressBars.finalizing.update(progress, {
				label: chalk.green(label || 'Finalizing')
			});
		}
	}

	/**
	 * Complete finalizing phase
	 */
	completeFinalizing() {
		if (this.progressBars.finalizing) {
			this.progressBars.finalizing.update(100, {
				label: chalk.green('Complete')
			});
		}
	}

	/**
	 * Update from streamed JSON content (real-time task detection)
	 */
	updateStreamedJson(jsonChunk) {
		// Simple task detection in streamed JSON
		const taskMatches = jsonChunk.match(/"title"\s*:\s*"/g);
		if (taskMatches) {
			this.streamedTasksCount += taskMatches.length;
			const progress = Math.min(this.streamedTasksCount, this.numTasks);
			this.updateGenerating(
				progress,
				`${this.actionVerb} Tasks (${progress}/${this.numTasks})`
			);
		}
	}

	/**
	 * Track task priorities for summary
	 */
	trackTaskPriority(priority) {
		if (this.taskPriorities[priority]) {
			this.taskPriorities[priority]++;
		} else {
			this.taskPriorities.medium++; // Default to medium
		}
	}

	/**
	 * Get elapsed time in seconds
	 */
	getElapsedTime() {
		if (!this.startTime) return 0;
		return Math.floor((Date.now() - this.startTime) / 1000);
	}

	/**
	 * Stop and clean up the progress tracker
	 */
	stop() {
		if (this.multibar && this.isStarted && !this.isFinished) {
			this.isFinished = true;
			this.multibar.stop();
		}
	}

	/**
	 * Get summary data for display
	 */
	getSummary() {
		return {
			taskPriorities: this.taskPriorities,
			elapsedTime: this.getElapsedTime(),
			actionVerb: this.append ? 'appended' : 'generated'
		};
	}
}

/**
 * Factory function to create a PRD parse tracker
 * @param {Object} options - Configuration options
 * @returns {PrdParseTracker} New tracker instance
 */
export function createPrdParseTracker(options = {}) {
	return new PrdParseTracker(options);
}
