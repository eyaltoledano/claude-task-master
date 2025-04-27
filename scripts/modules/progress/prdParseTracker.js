import EventEmitter from 'events';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { log, LOG_LEVELS } from '../utils.js';
import { displayPRDParsingSummary } from '../ui.js'; // Keep for potential direct use if needed
import { newMultiBar } from './cliProgressFactory.js';
// No need for external spinner library - using cli-progress multibar

// Spinner + progress bar mode for PRD parsing

const PRIORITY_DOTS = {
	high: chalk.red('⋮'), // vertical ellipsis for 3 dots
	medium: chalk.keyword('orange')(':'), // colon for 2 dots
	low: chalk.yellow('.') // period for 1 dot
};

const PRIORITY_DOTS_HORIZONTAL = {
	high: chalk.red('●') + chalk.red('●') + chalk.red('●'), // ●●● (all filled)
	medium:
		chalk.keyword('orange')('●') +
		chalk.keyword('orange')('●') +
		chalk.white('○'), // ●●○ (two filled, one empty)
	low: chalk.yellow('●') + chalk.white('○') + chalk.white('○') // ●○○ (one filled, two empty)
};

class PrdParseTracker extends EventEmitter {
	constructor(options = {}) {
		super();
		this._jsonBuffer = ''; // Buffer for streamed JSON
		this._tasksDetected = 0;
		this._seenTaskIds = new Set();
		this._bufferedLogs = [];
		this._isTrackingActive = false;
		this.options = {
			logLevel: options.logLevel || 'info',
			stream: process.stdout,
			...options
		};
		this.startTime = null;
		this.totalTasks = 0;
		this.completedTasks = 0;
		this.tokensIn = 0;
		this.tokensOut = 0;
		this.stats = {
			prdPath: '',
			outputPath: '',
			startTime: null,
			endTime: null,
			error: null
		};
		this.taskBars = [];

		// Spinner frames for multibar spinner
		this._spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
		this._spinnerIndex = 0;
		this.priorityCounts = { high: 0, medium: 0, low: 0 }; // High, Medium, Low

		// Log function specific to this tracker instance
		this.log = (level, message) => {
			if (LOG_LEVELS[level] >= LOG_LEVELS[this.options.logLevel]) {
				// In spinner-only mode, suppress logs except for errors after finish
				if (!this._isTrackingActive) {
					log(level, `[PrdParseTracker] ${message}`);
				}
			}
		};

		this.log('debug', 'PrdParseTracker initialized.');
	}

	// --- Public Methods ---

	/**
	 * Update the JSON buffer with streamed chunk and detect complete top-level tasks.
	 * Calls tick() for each new complete task found.
	 * @param {string} chunk - The streamed JSON chunk
	 */
	updateStreamedJson(chunk) {
		// tokensIn is set once at initialization, not incrementally
		if (!chunk) return;

		// Log chunk for debugging (uncomment if needed)
		// this.log('debug', `Received chunk: ${chunk.substring(0, 50)}...`);

		// Estimate tokens out based on the chunk size (char count / 4)
		this.tokensOut += Math.round(chunk.length / 4);

		this._jsonBuffer += chunk;

		// Try multiple detection strategies

		// Strategy 1: Look for complete task objects
		let taskRegex = /\{[^{}]*?"id"\s*:\s*\d+[^{}]*?\}/g;

		// Only process complete JSON objects for tasks. Incomplete objects are buffered until finished, preventing truncated titles.
		let match;
		let newTasks = [];
		while ((match = taskRegex.exec(this._jsonBuffer)) !== null) {
			try {
				let taskObj = JSON.parse(match[0]);
				if (taskObj && typeof taskObj.id === 'number' && taskObj.title) {
					if (!this._seenTaskIds.has(taskObj.id)) {
						this._seenTaskIds.add(taskObj.id);
						this.tick(taskObj);
						newTasks.push(taskObj);
						this.log(
							'debug',
							`Detected streamed task: ${taskObj.id} - ${taskObj.title}`
						);
					}
				}
			} catch (e) {
				// Ignore parse errors for incomplete objects
			}
		}

		// Remove parsed tasks from buffer (leave any partial/incomplete at the end)
		if (newTasks.length > 0) {
			// Remove up to the last parsed object
			let lastMatch = match ? match.index + match[0].length : 0;
			this._jsonBuffer = this._jsonBuffer.slice(lastMatch);
		}
	}

	/**
	 * Helper to format elapsed time as Xm YYs
	 * @param {number} startTime - The start time in ms
	 * @returns {string}
	 */
	_formatElapsedTime(startTime) {
		const elapsedMs = Date.now() - startTime;
		const seconds = Math.floor(elapsedMs / 1000) % 60;
		const minutes = Math.floor(elapsedMs / (1000 * 60));
		return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
	}

	/**
	 * Start the tracking process.
	 * @param {number} totalTasks - The total number of tasks expected.
	 * @param {object} initialStats - Initial stats like prdPath, outputPath etc.
	 * @param {number} [initialTokensIn=0] - Initial input tokens.
	 * @param {number} [initialTokensOut=0] - Initial output tokens.
	 */
	start(
		totalTasks = 0,
		initialStats = {},
		initialTokensIn = 0,
		initialTokensOut = 0
	) {
		this.startTime = Date.now();
		this.stats.startTime = this.startTime;
		this.totalTasks = totalTasks;
		this.completedTasks = 0;
		// If initialTokensIn is provided, use it, otherwise estimate from PRD file
		if (initialTokensIn > 0) {
			this.tokensIn = initialTokensIn;
		} else if (initialStats.prdPath) {
			try {
				// Estimate tokens from PRD file content
				const prdContent = fs.readFileSync(initialStats.prdPath, 'utf8');
				this.tokensIn = Math.round(prdContent.length / 4); // Approx 4 chars/token
			} catch (e) {
				this.tokensIn = 0;
				this.log('error', `Could not read PRD file: ${e.message}`);
			}
		} else {
			this.tokensIn = 0;
		}
		this.tokensOut = initialTokensOut;
		this._bufferedLogs = []; // Clear buffered logs
		this._isTrackingActive = true; // Enable log buffering

		// Merge initial stats
		this.stats = { ...this.stats, ...initialStats }; // Collect prdPath, outputPath etc.
		this.stats.taskCount = totalTasks; // Store total task count in stats as well

		// Start MultiBar for spinner and progress bar
		this.multiBar = newMultiBar();

		// Spinner line ALWAYS CREATED FIRST to ensure it appears at the top
		this.spinnerBar = this.multiBar.create(
			1,
			0,
			{},
			{
				format: '{spinner} {text}',
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false,
				forceRedraw: true // Force redraw to ensure visibility
			}
		);
		this._spinnerText = 'Generating tasks from PRD...';
		this.spinnerBar.update(1, {
			spinner: this._spinnerFrames[this._spinnerIndex],
			text: this._spinnerText
		});

		// Combined Time + Tokens line
		this.timeTokensBar = this.multiBar.create(
			1,
			0,
			{},
			{
				format: `{clock} {elapsed}  ${PRIORITY_DOTS.high} {high}  ${PRIORITY_DOTS.medium} {medium}  ${PRIORITY_DOTS.low} {low}  Tokens (I/O): {in}/{out} | Est: {remaining}`,
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false
			}
		);
		this.timeTokensBar.update(1, {
			tasks: `${this.completedTasks}/${this.totalTasks}`,
			clock: '⏱️',
			elapsed: '0m 00s',
			in: this.tokensIn,
			out: this.tokensOut,
			remaining: '~0m 00s'
		});

		// Progress bar line - strictly visual, no spinner, no task generation text
		// This is the ONLY progress bar line. No spinner, no duplication.
		this.progressBar = this.multiBar.create(
			this.totalTasks,
			0,
			{},
			{
				format: 'Tasks {tasks} |{bar}| {percentage}%',
				barCompleteChar: '\u2588',
				barIncompleteChar: '\u2591',
				hideCursor: true,
				clearOnComplete: false, // Never clear on complete
				barsize: 40,
				forceRedraw: true, // Force redraw to ensure visibility
				noSpinner: true // Prevent any spinner from appearing on this line
			}
		);
		// Display initial progress of 0 immediately
		this.progressBar.update(0, { tasks: `0/${this.totalTasks}` });

		// Animate spinner, elapsed, tokens, and priorities
		this._spinnerInterval = setInterval(() => {
			// Update spinner animation
			this._spinnerIndex =
				(this._spinnerIndex + 1) % this._spinnerFrames.length;
			this.spinnerBar.update(1, {
				spinner: this._spinnerFrames[this._spinnerIndex],
				text: this._spinnerText
			});
			// Elapsed time and tokens
			let estRemaining = '';
			if (this.completedTasks > 0 && this.completedTasks < this.totalTasks) {
				const elapsedMs = Date.now() - this.startTime;
				const avgMsPerTask = elapsedMs / this.completedTasks;
				const remainingTasks = this.totalTasks - this.completedTasks;
				const msRemaining = avgMsPerTask * remainingTasks;
				const min = Math.floor(msRemaining / 60000);
				const sec = Math.floor((msRemaining % 60000) / 1000);
				estRemaining = `~${min}m ${sec.toString().padStart(2, '0')}s`;
			} else if (
				this.completedTasks === this.totalTasks &&
				this.totalTasks > 0
			) {
				estRemaining = '~0m 00s';
			} else {
				estRemaining = '...';
			}
			this.timeTokensBar.update(1, {
				tasks: `${this.completedTasks}/${this.totalTasks}`,
				clock: '⏱️',
				elapsed: this._formatElapsedTime(this.startTime),
				in: this.tokensIn,
				out: this.tokensOut,
				high: this.priorityCounts.high,
				medium: this.priorityCounts.medium,
				low: this.priorityCounts.low,
				remaining: estRemaining
			});

			// Progress bar update (live)
			if (this.progressBar) {
				this.progressBar.update(Math.min(this.completedTasks, this.totalTasks));
			}
			// Don't change spinner text - keep it static
		}, 100);
	}

	tick(task, deltaTokensIn = 0, deltaTokensOut = 0) {
		// Show the task with horizontal dots as it comes in
		if (this.multiBar && task && task.title) {
			let priorityKey = 'low';
			if (task.priority) {
				const p = task.priority.toLowerCase();
				if (p.includes('high') || p === 'h') priorityKey = 'high';
				else if (p.includes('medium') || p === 'm') priorityKey = 'medium';
			}
			const dots = PRIORITY_DOTS_HORIZONTAL[priorityKey];
			const taskNum = this.completedTasks + 1; // Show 1-based index
			const total = this.totalTasks;
			const bar = this.multiBar.create(
				1,
				1,
				{},
				{
					format: `${dots} Task ${taskNum}/${total}: {title}`,
					barsize: 1,
					hideCursor: true,
					clearOnComplete: false,
					forceRedraw: true
				}
			);
			bar.update(1, { title: task.title });
			this.taskBars.push(bar);
		}
		// Record a completed task (spinner-only mode: do nothing visible)
		this.completedTasks++;
		this.tokensIn += deltaTokensIn;
		this.tokensOut += deltaTokensOut;
		// Update priority distribution
		if (task && task.priority) {
			const p = task.priority.toLowerCase();
			if (p.includes('high') || p === 'h') this.priorityCounts.high++;
			else if (p.includes('medium') || p === 'm') this.priorityCounts.medium++;
			else if (p.includes('low') || p === 'l') this.priorityCounts.low++;
		}
		// Update progress bar if present
		if (this.progressBar) {
			this.progressBar.update(Math.min(this.completedTasks, this.totalTasks), {
				tasks: `${this.completedTasks}/${this.totalTasks}`
			});
		}
		// Don't change spinner text - keep it static
	}

	/**
	 * Finish the tracking process.
	 * @param {boolean} success - Whether the process was successful.
	 * @param {object} finalStats - Any final stats to merge (e.g., error message).
	 * @param {function} [summaryCallback] - Optional callback to display summary.
	 */
	finish(success = true, finalStats = {}, summaryCallback = null) {
		if (!this.startTime) {
			// finish() called before start()
			return;
		}

		// Disable log buffering before finishing
		this._isTrackingActive = false;

		this.stats.endTime = Date.now();
		// Merge final stats
		this.stats = { ...this.stats, ...finalStats };

		// First stop spinner animation interval
		if (this._spinnerInterval) {
			clearInterval(this._spinnerInterval);
			this._spinnerInterval = null;
		}

		// Update progress bar to 100% if successful
		if (this.progressBar && success) {
			this.progressBar.update(this.totalTasks);
		}

		// Stop and remove MultiBar last (handles stopping all bars)
		if (this.multiBar) {
			this.multiBar.stop();
			this.multiBar = null; // Prevent multiple stops
		}
		// Print summary
		const elapsedTime = this._formatElapsedTime(this.startTime);
	}
}

export function createPrdParseTracker(options) {
	return new PrdParseTracker(options);
}

export { PrdParseTracker };
