/**
 * priority-indicators.js
 * UI functions for displaying priority indicators in different contexts
 */

import chalk from 'chalk';
import { TASK_PRIORITY_OPTIONS } from '../constants/task-priorities.js';

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
