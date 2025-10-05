import { newMultiBar } from './cli-progress-factory.js';

/**
 * Base class for progress trackers, handling common logic for time, tokens, estimation, and multibar management.
 */
export class BaseProgressTracker {
	constructor(options = {}) {
		this.numUnits = options.numUnits || 1;
		this.unitName = options.unitName || 'unit'; // e.g., 'task', 'subtask'
		this.startTime = null;
		this.completedUnits = 0;
		this.tokensIn = 0;
		this.tokensOut = 0;
		this.isEstimate = true; // For token display

		// Time estimation properties
		this.bestAvgTimePerUnit = null;
		this.lastEstimateTime = null;
		this.lastEstimateSeconds = 0;

		// UI components
		this.multibar = null;
		this.timeTokensBar = null;
		this.progressBar = null;
		this._timerInterval = null;

		// State flags
		this.isStarted = false;
		this.isFinished = false;

		// Allow subclasses to define custom properties
		this._initializeCustomProperties(options);
	}

	/**
	 * Protected method for subclasses to initialize custom properties.
	 * @protected
	 */
	_initializeCustomProperties(options) {
		// Subclasses can override this
	}

	/**
	 * Get the pluralized form of the unit name for safe property keys.
	 * @returns {string} Pluralized unit name
	 */
	get unitNamePlural() {
		return `${this.unitName}s`;
	}

	start() {
		if (this.isStarted || this.isFinished) return;

		this.isStarted = true;
		this.startTime = Date.now();

		this.multibar = newMultiBar();

		// Create time/tokens bar using subclass-provided format
		this.timeTokensBar = this.multibar.create(
			1,
			0,
			{},
			{
				format: this._getTimeTokensBarFormat(),
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false
			}
		);

		// Create main progress bar using subclass-provided format
		this.progressBar = this.multibar.create(
			this.numUnits,
			0,
			{},
			{
				format: this._getProgressBarFormat(),
				barCompleteChar: '\u2588',
				barIncompleteChar: '\u2591'
			}
		);

		this._updateTimeTokensBar();
		this.progressBar.update(0, { [this.unitNamePlural]: `0/${this.numUnits}` });

		// Start timer
		this._timerInterval = setInterval(() => this._updateTimeTokensBar(), 1000);

		// Allow subclasses to add custom bars or setup
		this._setupCustomUI();
	}

	/**
	 * Protected method for subclasses to add custom UI elements after start.
	 * @protected
	 */
	_setupCustomUI() {
		// Subclasses can override this
	}

	/**
	 * Protected method to get the format for the time/tokens bar.
	 * @protected
	 * @returns {string} Format string for the time/tokens bar.
	 */
	_getTimeTokensBarFormat() {
		return `{clock} {elapsed} | Tokens (I/O): {in}/{out} | Est: {remaining}`;
	}

	/**
	 * Protected method to get the format for the main progress bar.
	 * @protected
	 * @returns {string} Format string for the progress bar.
	 */
	_getProgressBarFormat() {
		return `${this.unitName.charAt(0).toUpperCase() + this.unitName.slice(1)}s {${this.unitNamePlural}} |{bar}| {percentage}%`;
	}

	updateTokens(tokensIn, tokensOut, isEstimate = false) {
		this.tokensIn = tokensIn || 0;
		this.tokensOut = tokensOut || 0;
		this.isEstimate = isEstimate;
		this._updateTimeTokensBar();
	}

	_updateTimeTokensBar() {
		if (!this.timeTokensBar || this.isFinished) return;

		const elapsed = this._formatElapsedTime();
		const remaining = this._estimateRemainingTime();
		const tokensLabel = this.isEstimate ? '~ Tokens (I/O)' : 'Tokens (I/O)';

		this.timeTokensBar.update(1, {
			clock: '⏱️',
			elapsed,
			in: this.tokensIn,
			out: this.tokensOut,
			remaining,
			tokensLabel,
			// Subclasses can add more payload here via override
			...this._getCustomTimeTokensPayload()
		});
	}

	/**
	 * Protected method for subclasses to provide custom payload for time/tokens bar.
	 * @protected
	 * @returns {Object} Custom payload object.
	 */
	_getCustomTimeTokensPayload() {
		return {};
	}

	_formatElapsedTime() {
		if (!this.startTime) return '0m 00s';
		const seconds = Math.floor((Date.now() - this.startTime) / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
	}

	_estimateRemainingTime() {
		const progress = this._getProgressFraction();
		if (progress >= 1) return '~0s';

		const now = Date.now();
		const elapsed = (now - this.startTime) / 1000;

		if (progress === 0) return '~calculating...';

		const avgTimePerUnit = elapsed / progress;

		if (
			this.bestAvgTimePerUnit === null ||
			avgTimePerUnit < this.bestAvgTimePerUnit
		) {
			this.bestAvgTimePerUnit = avgTimePerUnit;
		}

		const remainingUnits = this.numUnits * (1 - progress);
		let estimatedSeconds = Math.ceil(remainingUnits * this.bestAvgTimePerUnit);

		// Stabilization logic
		if (this.lastEstimateTime) {
			const elapsedSinceEstimate = Math.floor(
				(now - this.lastEstimateTime) / 1000
			);
			const countdownSeconds = Math.max(
				0,
				this.lastEstimateSeconds - elapsedSinceEstimate
			);
			if (countdownSeconds === 0) return '~0s';
			estimatedSeconds = Math.min(estimatedSeconds, countdownSeconds);
		}

		this.lastEstimateTime = now;
		this.lastEstimateSeconds = estimatedSeconds;

		return `~${this._formatDuration(estimatedSeconds)}`;
	}

	/**
	 * Protected method for subclasses to calculate current progress fraction (0-1).
	 * Defaults to simple completedUnits / numUnits.
	 * @protected
	 * @returns {number} Progress fraction (can be fractional for subtasks).
	 */
	_getProgressFraction() {
		return this.completedUnits / this.numUnits;
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
		return this.startTime ? Date.now() - this.startTime : 0;
	}

	stop() {
		if (this.isFinished) return;

		this.isFinished = true;

		if (this._timerInterval) {
			clearInterval(this._timerInterval);
			this._timerInterval = null;
		}

		if (this.multibar) {
			this._updateTimeTokensBar();
			this.multibar.stop();
		}

		// Ensure cleanup is called to prevent memory leaks
		this.cleanup();
	}

	getSummary() {
		return {
			completedUnits: this.completedUnits,
			elapsedTime: this.getElapsedTime()
			// Subclasses should extend this
		};
	}

	/**
	 * Cleanup method to ensure proper resource disposal and prevent memory leaks.
	 * Should be called when the progress tracker is no longer needed.
	 */
	cleanup() {
		// Stop any active timers
		if (this._timerInterval) {
			clearInterval(this._timerInterval);
			this._timerInterval = null;
		}

		// Stop and clear multibar
		if (this.multibar) {
			try {
				this.multibar.stop();
			} catch (error) {
				// Ignore errors during cleanup
			}
			this.multibar = null;
		}

		// Clear progress bar references
		this.timeTokensBar = null;
		this.progressBar = null;

		// Reset state
		this.isStarted = false;
		this.isFinished = true;

		// Allow subclasses to perform custom cleanup
		this._performCustomCleanup();
	}

	/**
	 * Protected method for subclasses to perform custom cleanup.
	 * @protected
	 */
	_performCustomCleanup() {
		// Subclasses can override this
	}
}
