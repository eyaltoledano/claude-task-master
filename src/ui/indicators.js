/**
 * indicators.js
 * UI functions for displaying priority and complexity indicators in different contexts
 */

import chalk from 'chalk';
import { TASK_PRIORITY_OPTIONS } from '../constants/task-priority.js';

// Extract priority values for cleaner object keys
const [HIGH, MEDIUM, LOW] = TASK_PRIORITY_OPTIONS;

/**
 * Get priority indicators for MCP context (single emojis)
 * @returns {Object} Priority to emoji mapping
 */
export function getMcpPriorityIndicators() {
	return {
		[HIGH]: '🔴',
		[MEDIUM]: '🟠',
		[LOW]: '🟢'
	};
}

/**
 * Get priority indicators for CLI context (colored dots with visual hierarchy)
 * @returns {Object} Priority to colored dot string mapping
 */
export function getCliPriorityIndicators() {
	return {
		[HIGH]: chalk.red('●') + chalk.red('●') + chalk.red('●'), // ●●● (all filled)
		[MEDIUM]:
			chalk.hex('#FF8800')('●') + chalk.hex('#FF8800')('●') + chalk.white('○'), // ●●○ (two filled, one empty)
		[LOW]: chalk.yellow('●') + chalk.white('○') + chalk.white('○') // ●○○ (one filled, two empty)
	};
}

/**
 * Get priority indicators for status bars (simplified single character versions)
 * @returns {Object} Priority to single character indicator mapping
 */
export function getStatusBarPriorityIndicators() {
	return {
		[HIGH]: chalk.red('⋮'),
		[MEDIUM]: chalk.hex('#FF8800')(':'),
		[LOW]: chalk.yellow('.')
	};
}

/**
 * Get priority colors for consistent styling
 * @returns {Object} Priority to chalk color function mapping
 */
export function getPriorityColors() {
	return {
		[HIGH]: chalk.hex('#CC0000'),
		[MEDIUM]: chalk.hex('#FF8800'),
		[LOW]: chalk.yellow
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
	return indicators[priority] || indicators[MEDIUM]; // Default to medium if invalid priority
}

// ============================================================================
// Complexity Indicators
// ============================================================================

/**
 * Get complexity indicators for CLI context (colored dots with visual hierarchy)
 * Complexity scores: 1-3 (low), 4-6 (medium), 7-10 (high)
 * @returns {Object} Complexity level to colored dot string mapping
 */
export function getCliComplexityIndicators() {
	return {
		high: chalk.red('●') + chalk.red('●') + chalk.red('●'), // ●●● (7+)
		medium:
			chalk.hex('#FF8800')('●') + chalk.hex('#FF8800')('●') + chalk.white('○'), // ●●○ (4-6)
		low: chalk.green('●') + chalk.white('○') + chalk.white('○') // ●○○ (1-3)
	};
}

/**
 * Get complexity indicators for status bars (simplified single character versions)
 * @returns {Object} Complexity level to single character indicator mapping
 */
export function getStatusBarComplexityIndicators() {
	return {
		high: chalk.red('⋮'),
		medium: chalk.hex('#FF8800')(':'),
		low: chalk.green('.')
	};
}

/**
 * Get complexity colors for consistent styling
 * @returns {Object} Complexity level to chalk color function mapping
 */
export function getComplexityColors() {
	return {
		high: chalk.hex('#CC0000'),
		medium: chalk.hex('#FF8800'),
		low: chalk.green
	};
}

/**
 * Get a specific complexity indicator based on score
 * @param {number} score - The complexity score (1-10)
 * @param {boolean} statusBar - Whether to return status bar version (single char)
 * @returns {string} The indicator string for the complexity level
 */
export function getComplexityIndicator(score, statusBar = false) {
	const indicators = statusBar
		? getStatusBarComplexityIndicators()
		: getCliComplexityIndicators();

	if (score >= 7) return indicators.high;
	if (score <= 3) return indicators.low;
	return indicators.medium;
}
