import { newSingle } from './cliProgressFactory.js';
import ora from 'ora';
import chalk from 'chalk';
import { EventEmitter } from 'events';

/**
 * PrdParseTracker - Handles tracking, reporting and UI for PRD parsing progress
 * Emits events: 'thinking', 'token', 'task', 'progress', 'complete'
 */
export class PrdParseTracker {
	constructor(options = {}) {
		const { reportProgress, mcpLog } = options;

		this.emitter = new EventEmitter();
		this.reportProgress = reportProgress; // MCP progress reporting function
		this.mcpLog = mcpLog; // MCP logger

		this.spinnerFrames = [
			'Analyzing PRD structure...',
			'Identifying key features...',
			'Generating task breakdown...',
			'Refining task details...'
		];

		this.progressBar = null;
		this.spinner = null;
		this.spinnerInterval = null;
		this.stats = {
			total: 100,
			current: 0,
			tokens: 0,
			tasks: 0,
			taskCount: 0,
			startTime: null,
			endTime: null,
			outputPath: null,
			taskCategories: { high: 0, medium: 0, low: 0 }
		};
		this.isActive = false;

		// State tracking
		this.latestTaskInfo = null;
		this.thinkingState = null;
		this.lastTaskId = 0;
	}

	/**
	 * Start tracking progress for PRD parsing
	 * @param {string} prdPath - Path to the PRD file being parsed
	 * @param {number} numTasks - Number of tasks to generate
	 */
	start(prdPath, numTasks = 0) {
		this.stats.startTime = Date.now();
		this.stats.prdPath = prdPath;
		this.stats.numTasks = numTasks;
		this.isActive = true;

		// Only create progress bar for CLI (non-MCP) mode
		if (!this.mcpLog) {
			this.progressBar = newSingle({
				format: 'Parsing PRD |{bar}| {percentage}% || {value}/{total}'
			});
			this.progressBar.start(this.stats.total, 0);

			this.spinner = ora({
				text: this.spinnerFrames[0],
				spinner: 'dots'
			}).start();

			let frameIndex = 0;
			this.spinnerInterval = setInterval(() => {
				frameIndex = (frameIndex + 1) % this.spinnerFrames.length;
				this.spinner.text = this.spinnerFrames[frameIndex];

				// Emit thinking event for anyone listening
				this.emitter.emit('thinking', {
					message: this.spinnerFrames[frameIndex],
					elapsed: Date.now() - this.stats.startTime
				});
			}, 2000);
		}

		return this; // For chaining
	}

	/**
	 * Process update from AI streaming - detects tokens, tasks, and progress
	 * @param {Object} data - Data update from the streaming parser
	 */
	update(data) {
		if (!this.isActive) return;

		// Update internal stats
		if (data.tokens) {
			this.stats.tokens = data.tokens;
			this.emitter.emit('token', { count: data.tokens });
		}

		if (data.percent !== undefined) {
			this.stats.current = Math.min(
				Math.floor((data.percent / 100) * this.stats.total),
				this.stats.total
			);

			// Update progress bar if in CLI mode
			if (this.progressBar) {
				this.progressBar.update(this.stats.current);
			}

			// Report progress to MCP if available
			if (this.reportProgress) {
				this.reportProgress({
					type: 'prd-parsing',
					percent: data.percent,
					message: data.message || `Processing PRD (${data.percent}%)`
				});
			}

			// Emit progress event
			this.emitter.emit('progress', {
				percent: data.percent,
				message: data.message,
				tokens: this.stats.tokens
			});
		}

		// Handle detected tasks
		if (data.task) {
			this.stats.tasks++;

			// Update spinner with task info in CLI mode
			if (this.spinner) {
				this.spinner.text = `Detected task ${this.stats.tasks}: ${data.task.substr(0, 40)}...`;
			}

			// Emit task event
			this.emitter.emit('task', {
				taskNum: this.stats.tasks,
				taskPreview: data.task
			});
		}

		// Handle thinking message updates
		if (data.thinkingMsg && this.spinner) {
			this.spinner.text = data.thinkingMsg;
		}
	}

	/**
	 * Finish parsing and clean up resources
	 * @param {boolean} success - Whether parsing completed successfully
	 * @param {Object} stats - Final statistics about the parsing
	 * @param {Function} summaryCallback - Optional callback to display summary
	 */
	finish(success = true, stats = {}, summaryCallback = null) {
		if (!this.isActive) return;

		this.isActive = false;
		this.stats.endTime = Date.now();

		// Ensure taskCount is set based on the lastTaskId if not provided
		if (!stats.taskCount && this.lastTaskId > 0) {
			stats.taskCount = this.lastTaskId;
		}

		// Merge stats with existing stats
		this.stats = { ...this.stats, ...stats };

		// Clean up progress bar if in CLI mode
		if (this.progressBar) {
			this.progressBar.update(this.stats.total);
			this.progressBar.stop();
			this.progressBar = null;
		}

		// Clean up spinner if in CLI mode
		if (this.spinner) {
			clearInterval(this.spinnerInterval);

			if (success) {
				this.spinner.succeed(
					chalk.green(
						`PRD parsing complete! Generated ${this.stats.taskCount || 0} tasks`
					)
				);
			} else {
				this.spinner.fail(
					chalk.red(
						`PRD parsing failed: ${this.stats.error || 'Unknown error'}`
					)
				);
			}

			this.spinner = null;
		}

		// Clean up interval
		if (this.spinnerInterval) {
			clearInterval(this.spinnerInterval);
			this.spinnerInterval = null;
		}

		// If a summary callback is provided, call it with the stats
		if (summaryCallback && typeof summaryCallback === 'function') {
			summaryCallback({
				totalTasks: this.stats.taskCount || 0,
				prdFilePath: this.stats.prdPath,
				outputPath: this.stats.outputPath || 'tasks/tasks.json',
				elapsedTime: (this.stats.endTime - this.stats.startTime) / 1000, // Convert to seconds
				taskCategories: this.stats.taskCategories || {
					high: 0,
					medium: 0,
					low: 0
				},
				recoveryMode: this.stats.recoveryMode || false,
				taskFilesGenerated: this.stats.taskFilesGenerated || false,
				actionVerb: this.stats.actionVerb || 'created'
			});
		}

		// Emit complete event
		this.emitter.emit('complete', {
			success,
			stats: this.stats,
			elapsed: this.stats.endTime - this.stats.startTime
		});
	}

	/**
	 * Register event listener
	 * @param {string} event - Event name ('thinking', 'token', 'task', 'progress', 'complete')
	 * @param {Function} callback - Callback function
	 */
	on(event, callback) {
		this.emitter.on(event, callback);
		return this;
	}

	/**
	 * Helper to create a tracker function for AI streaming
	 * @param {number} numTasksHint - Hint for the number of tasks
	 * @returns {Function} Streaming tracker function
	 */
	createStreamingTracker(numTasksHint = 0) {
		// Maintain internal state for this tracker closure
		const seenTaskIds = new Set();
		let buffer = '';
		let numTasks = numTasksHint || 10; // fallback if the caller doesn't know yet
		let estimatedTotalTokens = 6000; // heuristic – will be updated as we stream
		let percentComplete = 0;

		/**
		 * Helper function to calculate tokens from text content – heuristic approximation.
		 * Borrowed from prior implementation.
		 * @param {string} text
		 * @returns {number}
		 */
		function calculateTokens(text) {
			if (!text) return 0;
			const words = text.split(/\s+/).filter((w) => w.length > 0);
			const wordTokens = words.length * 1.3;
			const digits = (text.match(/\d/g) || []).length;
			const digitTokens = digits * 0.25; // ~4 digits per token
			const specialChars = (text.match(/[^\w\s]/g) || []).length;
			const jsonBias = Math.min(500, text.length * 0.05);
			const rawTotal = Math.ceil(
				wordTokens + digitTokens + specialChars - jsonBias
			);
			const minTokens = Math.ceil(text.length / 5);
			const maxTokens = Math.ceil(text.length / 2);
			return Math.min(maxTokens, Math.max(minTokens, rawTotal));
		}

		/**
		 * Detect new tasks from the accumulating buffer and emit them via tracker.
		 * Returns array of newly detected taskInfo objects.
		 */
		const detectTasks = (content) => {
			const titleRegex = /"title"\s*:\s*"([^\"]+)"/g;
			const idRegex = /"id"\s*:\s*(\d+)/g;
			const priorityRegex = /"priority"\s*:\s*"?(high|medium|low)"?/i;
			const descriptionRegex = /"description"\s*:\s*"([^\"]+)"/g;

			let match;
			const newTasks = [];
			const matchedTasks = new Map();

			// Pass 1 – find ids we haven't seen
			while ((match = idRegex.exec(content)) !== null) {
				const taskId = parseInt(match[1], 10);
				if (!seenTaskIds.has(taskId)) {
					matchedTasks.set(taskId, { pos: match.index, id: taskId });
				}
			}

			// Pass 2 – for each new id try to extract title / priority / description
			for (const [taskId, info] of matchedTasks.entries()) {
				const slice = content.slice(info.pos);
				const titleMatch = titleRegex.exec(slice);
				if (!titleMatch) continue; // need title at minimum

				const priorityMatch = priorityRegex.exec(slice);
				const priority = priorityMatch
					? priorityMatch[1].toLowerCase()
					: undefined;
				if (!priority) continue; // wait until we have priority too

				const descMatch = descriptionRegex.exec(slice);
				const description = descMatch ? descMatch[1] : undefined;

				const taskInfo = {
					taskId,
					title: titleMatch[1],
					priority,
					description,
					taskCount: seenTaskIds.size + 1 // optimistic
				};

				newTasks.push(taskInfo);
				seenTaskIds.add(taskId);
				// propagate to outer tracker
				this.trackTask(taskInfo);
			}
			return newTasks;
		};

		// Streaming callback returned to caller
		return (content, chunkInfo = {}) => {
			buffer += content;

			// Detect tasks & update numTasks if we observe higher ids
			const newTasks = detectTasks(buffer);
			if (newTasks.length) {
				const maxId = Math.max(...Array.from(seenTaskIds));
				if (maxId > numTasks) numTasks = maxId;
			}

			// Determine current token count – prefer exact counts from chunkInfo if provided
			const tokenCount = chunkInfo.totalTokens || calculateTokens(buffer);

			// Simple progress estimation – combine token and task signals
			const tokenBased = Math.min(
				99,
				Math.floor((tokenCount / estimatedTotalTokens) * 100)
			);
			const taskBased =
				seenTaskIds.size > 0
					? Math.min(90, Math.floor((seenTaskIds.size / numTasks) * 100))
					: 0;
			const calculated = Math.max(
				tokenBased * 0.5 + taskBased * 0.5,
				percentComplete
			);
			percentComplete = Math.min(99, Math.round(calculated));

			// Thinking message – basic phase reporting
			const thinkingMsg =
				seenTaskIds.size === 0
					? 'Analyzing PRD...'
					: percentComplete < 90
						? `Defining task ${seenTaskIds.size + 1}...`
						: 'Finalizing...';
			this.updateThinkingState({
				message: thinkingMsg,
				state: percentComplete < 90 ? 'processing' : 'finalizing'
			});

			// Finally update main stats & emit progress
			this.update({
				tokens: tokenCount,
				percent: percentComplete,
				message: thinkingMsg
			});

			return true; // keep streaming
		};
	}

	/**
	 * Track task information
	 * @param {Object} taskInfo - Task information
	 */
	trackTask(taskInfo) {
		if (!taskInfo) return;

		this.latestTaskInfo = taskInfo;

		// Update last task id
		if (taskInfo.taskId && taskInfo.taskId > this.lastTaskId) {
			this.lastTaskId = taskInfo.taskId;
		}

		// Emit task event
		this.emitter.emit('task', taskInfo);
	}

	/**
	 * Update thinking state
	 * @param {Object} thinkingState - Thinking state information
	 */
	updateThinkingState(thinkingState) {
		if (!thinkingState) return;

		this.thinkingState = thinkingState;

		// Emit thinking event
		this.emitter.emit('thinking', thinkingState);
	}

	/**
	 * Get current thinking state
	 * @returns {Object} Current thinking state
	 */
	getThinkingState() {
		return this.thinkingState;
	}

	/**
	 * Get latest task info
	 * @returns {Object} Latest task info
	 */
	getLatestTaskInfo() {
		return this.latestTaskInfo;
	}

	/**
	 * Get last task ID
	 * @returns {number} Last task ID
	 */
	getLastTaskId() {
		return this.lastTaskId;
	}
}

/**
 * Create a PRD parsing tracker with the provided options
 * @param {Object} options - Options for the tracker
 * @param {Function} options.reportProgress - Function to report progress to MCP server
 * @param {Object} options.mcpLog - MCP logger object
 * @returns {PrdParseTracker} A configured tracker instance
 */
export function createPrdParseTracker(options = {}) {
	return new PrdParseTracker(options);
}
