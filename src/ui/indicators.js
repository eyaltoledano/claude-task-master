/**
 * indicators.js
 * UI functions for displaying priority and complexity indicators in different contexts
 */

import chalk from 'chalk';
import { TASK_PRIORITY_OPTIONS } from '../constants/task-priority.js';

// Extract priority values for cleaner object keys
const [HIGH, MEDIUM, LOW] = TASK_PRIORITY_OPTIONS;

// Cache for generated indicators
const INDICATOR_CACHE = new Map();

/**
 * Base configuration for indicator systems
 */
class IndicatorConfig {
	constructor(name, levels, colors, thresholds = null) {
		this.name = name;
		this.levels = levels;
		this.colors = colors;
		this.thresholds = thresholds;
	}

	getColor(level) {
		return this.colors[level] || chalk.gray;
	}

	getLevelFromScore(score) {
		if (!this.thresholds) {
			throw new Error(`${this.name} does not support score-based levels`);
		}

		if (score >= 7) return this.levels[0]; // high
		if (score <= 3) return this.levels[2]; // low
		return this.levels[1]; // medium
	}
}

/**
 * Visual style definitions
 */
const VISUAL_STYLES = {
	cli: {
		filled: '●', // ●
		empty: '○' // ○
	},
	statusBar: {
		high: '⋮', // ⋮
		medium: ':', // :
		low: '.' // .
	},
	mcp: {
		high: '🔴', // 🔴
		medium: '🟠', // 🟠
		low: '🟢' // 🟢
	}
};

/**
 * Priority configuration
 */
const PRIORITY_CONFIG = new IndicatorConfig('priority', [HIGH, MEDIUM, LOW], {
	[HIGH]: chalk.hex('#CC0000'),
	[MEDIUM]: chalk.hex('#FF8800'),
	[LOW]: chalk.yellow
});

/**
 * Generates CLI indicator with intensity
 */
function generateCliIndicator(intensity, color) {
	const filled = VISUAL_STYLES.cli.filled;
	const empty = VISUAL_STYLES.cli.empty;

	let indicator = '';
	for (let i = 0; i < 3; i++) {
		if (i < intensity) {
			indicator += color(filled);
		} else {
			indicator += chalk.white(empty);
		}
	}
	return indicator;
}

/**
 * Get intensity level from priority/complexity level
 */
function getIntensityFromLevel(level, levels) {
	const index = levels.indexOf(level);
	return 3 - index; // high=3, medium=2, low=1
}

/**
 * Generic cached indicator getter
 * @param {string} cacheKey - Cache key for the indicators
 * @param {Function} generator - Function to generate the indicators
 * @returns {Object} Cached or newly generated indicators
 */
function getCachedIndicators(cacheKey, generator) {
	if (INDICATOR_CACHE.has(cacheKey)) {
		return INDICATOR_CACHE.get(cacheKey);
	}

	const indicators = generator();
	INDICATOR_CACHE.set(cacheKey, indicators);
	return indicators;
}

/**
 * Get priority indicators for MCP context (single emojis)
 * @returns {Object} Priority to emoji mapping
 */
export function getMcpPriorityIndicators() {
	return getCachedIndicators('mcp-priority-all', () => ({
		[HIGH]: VISUAL_STYLES.mcp.high,
		[MEDIUM]: VISUAL_STYLES.mcp.medium,
		[LOW]: VISUAL_STYLES.mcp.low
	}));
}

/**
 * Get priority indicators for CLI context (colored dots with visual hierarchy)
 * @returns {Object} Priority to colored dot string mapping
 */
export function getCliPriorityIndicators() {
	return getCachedIndicators('cli-priority-all', () => {
		const indicators = {};
		PRIORITY_CONFIG.levels.forEach((level) => {
			const intensity = getIntensityFromLevel(level, PRIORITY_CONFIG.levels);
			const color = PRIORITY_CONFIG.getColor(level);
			indicators[level] = generateCliIndicator(intensity, color);
		});
		return indicators;
	});
}

/**
 * Get priority indicators for status bars (simplified single character versions)
 * @returns {Object} Priority to single character indicator mapping
 */
export function getStatusBarPriorityIndicators() {
	return getCachedIndicators('statusbar-priority-all', () => {
		const indicators = {};
		PRIORITY_CONFIG.levels.forEach((level, index) => {
			const style =
				index === 0
					? VISUAL_STYLES.statusBar.high
					: index === 1
						? VISUAL_STYLES.statusBar.medium
						: VISUAL_STYLES.statusBar.low;
			const color = PRIORITY_CONFIG.getColor(level);
			indicators[level] = color(style);
		});
		return indicators;
	});
}

/**
 * Get priority colors for consistent styling
 * @returns {Object} Priority to chalk color function mapping
 */
export function getPriorityColors() {
	return {
		[HIGH]: PRIORITY_CONFIG.colors[HIGH],
		[MEDIUM]: PRIORITY_CONFIG.colors[MEDIUM],
		[LOW]: PRIORITY_CONFIG.colors[LOW]
	};
}

/**
 * Get priority indicators based on context
 * @param {boolean} isMcp - Whether this is for MCP context (true) or CLI context (false)
 * @returns {Object} Priority to indicator mapping
 */
export function getPriorityIndicators(isMcp = false) {
	return isMcp ? getMcpPriorityIndicators() : getCliPriorityIndicators();
}

/**
 * Get a specific priority indicator
 * @param {string} priority - The priority level ('high', 'medium', 'low')
 * @param {boolean} isMcp - Whether this is for MCP context
 * @returns {string} The indicator string for the priority
 */
export function getPriorityIndicator(priority, isMcp = false) {
	const indicators = getPriorityIndicators(isMcp);
	return indicators[priority] || indicators[MEDIUM];
}

// ============================================================================
// Complexity Indicators
// ============================================================================

/**
 * Complexity configuration
 */
const COMPLEXITY_CONFIG = new IndicatorConfig(
	'complexity',
	['high', 'medium', 'low'],
	{
		high: chalk.hex('#CC0000'),
		medium: chalk.hex('#FF8800'),
		low: chalk.green
	},
	{
		high: (score) => score >= 7,
		medium: (score) => score >= 4 && score <= 6,
		low: (score) => score <= 3
	}
);

/**
 * Get complexity indicators for CLI context (colored dots with visual hierarchy)
 * Complexity scores: 1-3 (low), 4-6 (medium), 7-10 (high)
 * @returns {Object} Complexity level to colored dot string mapping
 */
export function getCliComplexityIndicators() {
	return getCachedIndicators('cli-complexity-all', () => {
		const indicators = {};
		COMPLEXITY_CONFIG.levels.forEach((level) => {
			const intensity = getIntensityFromLevel(level, COMPLEXITY_CONFIG.levels);
			const color = COMPLEXITY_CONFIG.getColor(level);
			indicators[level] = generateCliIndicator(intensity, color);
		});
		return indicators;
	});
}

/**
 * Get complexity indicators for status bars (simplified single character versions)
 * @returns {Object} Complexity level to single character indicator mapping
 */
export function getStatusBarComplexityIndicators() {
	return getCachedIndicators('statusbar-complexity-all', () => {
		const indicators = {};
		COMPLEXITY_CONFIG.levels.forEach((level, index) => {
			const style =
				index === 0
					? VISUAL_STYLES.statusBar.high
					: index === 1
						? VISUAL_STYLES.statusBar.medium
						: VISUAL_STYLES.statusBar.low;
			const color = COMPLEXITY_CONFIG.getColor(level);
			indicators[level] = color(style);
		});
		return indicators;
	});
}

/**
 * Get complexity colors for consistent styling
 * @returns {Object} Complexity level to chalk color function mapping
 */
export function getComplexityColors() {
	return { ...COMPLEXITY_CONFIG.colors };
}

/**
 * Get a specific complexity indicator based on score
 * @param {number} score - The complexity score (1-10)
 * @param {boolean} statusBar - Whether to return status bar version (single char)
 * @returns {string} The indicator string for the complexity level
 */
export function getComplexityIndicator(score, statusBar = false) {
	const level = COMPLEXITY_CONFIG.getLevelFromScore(score);
	const indicators = statusBar
		? getStatusBarComplexityIndicators()
		: getCliComplexityIndicators();
	return indicators[level];
}
