/**
 * @fileoverview Complexity formatting utilities
 * Provides colored complexity displays with labels and scores
 */

import chalk from 'chalk';

/**
 * Get complexity color and label based on score thresholds
 */
function getComplexityLevel(score: number): {
	color: (text: string) => string;
	label: string;
} {
	if (score >= 7) {
		return { color: chalk.hex('#CC0000'), label: 'High' };
	} else if (score >= 4) {
		return { color: chalk.hex('#FF8800'), label: 'Medium' };
	} else {
		return { color: chalk.green, label: 'Low' };
	}
}

/**
 * Get colored complexity display with dot indicator (simple format)
 */
export function getComplexityWithColor(complexity: number | string): string {
	const score =
		typeof complexity === 'string' ? Number(complexity.trim()) : complexity;

	if (isNaN(score)) {
		return chalk.gray('N/A');
	}

	const { color } = getComplexityLevel(score);
	return color(`● ${score}`);
}

/**
 * Get colored complexity display with /10 format (for dashboards)
 */
export function getComplexityWithScore(complexity: number | undefined): string {
	if (typeof complexity !== 'number') {
		return chalk.gray('N/A');
	}

	const { color, label } = getComplexityLevel(complexity);
	return color(`${complexity}/10 (${label})`);
}
