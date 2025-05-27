/**
 * @typedef {'standard' | 'balanced' | 'advanced'} ComplexityMode
 */

/**
 * Complexity analysis mode options
 * @type {ComplexityMode[]}
 * @description Defines available complexity analysis modes:
 * - standard: Ultra-compressed prompt for cost efficiency (783 chars)
 * - balanced: Mid-length prompt balancing cost and detail (2,100 chars)
 * - advanced: Full detailed prompt for comprehensive analysis (5,711 chars)
 */
export const COMPLEXITY_MODE_OPTIONS = [
	'standard',
	'balanced', 
	'advanced'
];

/**
 * Default complexity mode
 * @type {ComplexityMode}
 */
export const DEFAULT_COMPLEXITY_MODE = 'balanced';

/**
 * Check if a given mode is a valid complexity mode
 * @param {string} mode - The mode to check
 * @returns {boolean} True if the mode is valid, false otherwise
 */
export function isValidComplexityMode(mode) {
	return COMPLEXITY_MODE_OPTIONS.includes(mode);
}

/**
 * Get complexity mode with fallback to default
 * @param {string} mode - The requested mode
 * @returns {ComplexityMode} Valid complexity mode
 */
export function getValidComplexityMode(mode) {
	return isValidComplexityMode(mode) ? mode : DEFAULT_COMPLEXITY_MODE;
}