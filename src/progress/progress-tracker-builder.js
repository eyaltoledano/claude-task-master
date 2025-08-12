/**
 * Configuration for progress tracker features
 */
class TrackerConfig {
	constructor() {
		this.features = new Set();
		this.spinnerFrames = null;
		this.unitName = 'unit';
		this.totalUnits = 100;
	}

	addFeature(feature) {
		this.features.add(feature);
	}

	hasFeature(feature) {
		return this.features.has(feature);
	}

	getOptions() {
		return {
			numUnits: this.totalUnits,
			unitName: this.unitName,
			spinnerFrames: this.spinnerFrames,
			features: Array.from(this.features)
		};
	}
}

/**
 * Builder for creating configured progress trackers
 */
export class ProgressTrackerBuilder {
	constructor() {
		this.config = new TrackerConfig();
	}

	withPercent() {
		this.config.addFeature('percent');
		return this;
	}

	withTokens() {
		this.config.addFeature('tokens');
		return this;
	}

	withTasks() {
		this.config.addFeature('tasks');
		return this;
	}

	withSpinner(messages) {
		if (!messages || !Array.isArray(messages)) {
			throw new Error('Spinner messages must be an array');
		}
		this.config.spinnerFrames = messages;
		return this;
	}

	withUnits(total, unitName = 'unit') {
		this.config.totalUnits = total;
		this.config.unitName = unitName;
		return this;
	}

	build() {
		return new ProgressTracker(this.config);
	}
}

/**
 * Base progress tracker with configurable features
 */
class ProgressTracker {
	constructor(config) {
		this.config = config;
		this.isActive = false;
		this.current = 0;
		this.spinnerIndex = 0;
		this.startTime = null;
	}

	start() {
		this.isActive = true;
		this.startTime = Date.now();
		this.current = 0;

		if (this.config.spinnerFrames) {
			this._startSpinner();
		}
	}

	update(data = {}) {
		if (!this.isActive) return;

		if (data.current !== undefined) {
			this.current = data.current;
		}

		const progress = this._buildProgressData(data);
		return progress;
	}

	finish() {
		this.isActive = false;

		if (this.spinnerInterval) {
			clearInterval(this.spinnerInterval);
			this.spinnerInterval = null;
		}

		return this._buildSummary();
	}

	_startSpinner() {
		this.spinnerInterval = setInterval(() => {
			this.spinnerIndex =
				(this.spinnerIndex + 1) % this.config.spinnerFrames.length;
		}, 100);
	}

	_buildProgressData(data) {
		const progress = { ...data };

		if (this.config.hasFeature('percent')) {
			progress.percentage = Math.round(
				(this.current / this.config.totalUnits) * 100
			);
		}

		if (this.config.hasFeature('tasks')) {
			progress.tasks = `${this.current}/${this.config.totalUnits}`;
		}

		if (this.config.spinnerFrames) {
			progress.spinner = this.config.spinnerFrames[this.spinnerIndex];
		}

		return progress;
	}

	_buildSummary() {
		const elapsed = Date.now() - this.startTime;
		return {
			total: this.config.totalUnits,
			completed: this.current,
			elapsedMs: elapsed,
			features: Array.from(this.config.features)
		};
	}
}
