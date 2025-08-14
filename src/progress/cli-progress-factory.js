import cliProgress from 'cli-progress';

/**
 * Default configuration for progress bars
 * Extracted to avoid duplication and provide single source of truth
 */
const DEFAULT_CONFIG = {
	clearOnComplete: false,
	stopOnComplete: true,
	hideCursor: true,
	barsize: 40 // Standard terminal width for progress bar
};

/**
 * Available presets for progress bar styling
 * Makes it easy to see what options are available
 */
const PRESETS = {
	shades_classic: cliProgress.Presets.shades_classic,
	shades_grey: cliProgress.Presets.shades_grey,
	rect: cliProgress.Presets.rect,
	legacy: cliProgress.Presets.legacy
};

/**
 * Factory class for creating CLI progress bars
 * Provides a consistent interface for creating both single and multi-bar instances
 */
export class ProgressBarFactory {
	constructor(defaultOptions = {}, defaultPreset = PRESETS.shades_classic) {
		this.defaultOptions = { ...DEFAULT_CONFIG, ...defaultOptions };
		this.defaultPreset = defaultPreset;
	}

	/**
	 * Creates a new single progress bar
	 * @param {Object} opts - Custom options to override defaults
	 * @param {Object} preset - Progress bar preset for styling
	 * @returns {cliProgress.SingleBar} Configured single progress bar instance
	 */
	createSingleBar(opts = {}, preset = null) {
		const config = this._mergeConfig(opts);
		const barPreset = preset || this.defaultPreset;

		return new cliProgress.SingleBar(config, barPreset);
	}

	/**
	 * Creates a new multi-bar container
	 * @param {Object} opts - Custom options to override defaults
	 * @param {Object} preset - Progress bar preset for styling
	 * @returns {cliProgress.MultiBar} Configured multi-bar instance
	 */
	createMultiBar(opts = {}, preset = null) {
		const config = this._mergeConfig(opts);
		const barPreset = preset || this.defaultPreset;

		return new cliProgress.MultiBar(config, barPreset);
	}

	/**
	 * Merges custom options with defaults
	 * @private
	 * @param {Object} customOpts - Custom options to merge
	 * @returns {Object} Merged configuration
	 */
	_mergeConfig(customOpts) {
		return { ...this.defaultOptions, ...customOpts };
	}

	/**
	 * Updates the default configuration
	 * @param {Object} options - New default options
	 */
	setDefaultOptions(options) {
		this.defaultOptions = { ...this.defaultOptions, ...options };
	}

	/**
	 * Updates the default preset
	 * @param {Object} preset - New default preset
	 */
	setDefaultPreset(preset) {
		this.defaultPreset = preset;
	}
}

// Create a default factory instance for backward compatibility
const defaultFactory = new ProgressBarFactory();

/**
 * Legacy function for creating a single progress bar
 * @deprecated Use ProgressBarFactory.createSingleBar() instead
 * @param {Object} opts - Progress bar options
 * @returns {cliProgress.SingleBar} Single progress bar instance
 */
export function newSingle(opts = {}) {
	return defaultFactory.createSingleBar(opts);
}

/**
 * Legacy function for creating a multi-bar
 * @deprecated Use ProgressBarFactory.createMultiBar() instead
 * @param {Object} opts - Progress bar options
 * @returns {cliProgress.MultiBar} Multi-bar instance
 */
export function newMultiBar(opts = {}) {
	return defaultFactory.createMultiBar(opts);
}

// Export presets for easy access
export { PRESETS };

// Export the factory class as default
export default ProgressBarFactory;
