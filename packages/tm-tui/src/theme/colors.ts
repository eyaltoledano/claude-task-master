/**
 * @fileoverview Task Master TUI Color System
 * Matches the color patterns from scripts/modules/ui.js and scripts/init.js
 */

/**
 * Cool gradient colors (used for main banner)
 * Original: gradient(['#00b4d8', '#0077b6', '#03045e'])
 */
export const coolGradient = ['#00b4d8', '#0096c7', '#0077b6', '#005a8c', '#03045e'] as const;

/**
 * Warm gradient colors (used for success)
 * Original: gradient(['#fb8b24', '#e36414', '#9a031e'])
 */
export const warmGradient = ['#fb8b24', '#f77f2a', '#e36414', '#c24a12', '#9a031e'] as const;

/**
 * Semantic colors matching the existing UI patterns
 */
export const colors = {
	// Primary brand colors
	primary: '#00b4d8', // Cyan - main brand color
	primaryDark: '#0077b6',
	primaryDarker: '#03045e',

	// Status colors (matching getStatusWithColor from ui.js)
	success: '#22c55e', // Green
	warning: '#f59e0b', // Yellow/Amber
	error: '#ef4444', // Red
	info: '#3b82f6', // Blue

	// Task status colors
	statusDone: '#22c55e', // Green
	statusInProgress: '#3b82f6', // Blue
	statusPending: '#f59e0b', // Amber
	statusBlocked: '#ef4444', // Red
	statusDeferred: '#a855f7', // Purple
	statusCancelled: '#6b7280', // Gray
	statusReview: '#06b6d4', // Cyan

	// Priority colors
	priorityHigh: '#ef4444', // Red
	priorityMedium: '#f59e0b', // Amber
	priorityLow: '#22c55e', // Green

	// UI colors
	text: '#ffffff',
	textDim: '#9ca3af',
	textMuted: '#6b7280',
	border: '#374151',
	borderActive: '#00b4d8',
	background: '#111827',
	backgroundAlt: '#1f2937',

	// Icon colors
	checkmark: '#22c55e',
	cross: '#ef4444',
	arrow: '#3b82f6',
	bullet: '#9ca3af',

	// Semantic colors (grouped for component use)
	semantic: {
		primary: '#00b4d8',
		success: '#22c55e',
		warning: '#f59e0b',
		error: '#ef4444',
		info: '#3b82f6',
		muted: '#6b7280',
	},

	// Accent colors (for highlights and emphasis)
	accent: {
		cyan: '#00b4d8',
		green: '#22c55e',
		yellow: '#f59e0b',
		red: '#ef4444',
		purple: '#a855f7',
		blue: '#3b82f6',
	},
} as const;

/**
 * Complexity score colors (matching getComplexityWithColor from ui.js)
 */
export function getComplexityColor(score: number): string {
	if (score >= 8) return '#ef4444'; // Red for very complex
	if (score >= 6) return '#f59e0b'; // Amber for complex
	if (score >= 4) return '#eab308'; // Yellow for moderate
	return '#22c55e'; // Green for simple
}

/**
 * Status to color mapping (matching getStatusWithColor from ui.js)
 */
export function getStatusColor(status: string): string {
	const statusLower = status.toLowerCase();
	switch (statusLower) {
		case 'done':
			return colors.statusDone;
		case 'in-progress':
		case 'in_progress':
		case 'inprogress':
			return colors.statusInProgress;
		case 'pending':
			return colors.statusPending;
		case 'blocked':
			return colors.statusBlocked;
		case 'deferred':
			return colors.statusDeferred;
		case 'cancelled':
		case 'canceled':
			return colors.statusCancelled;
		case 'review':
			return colors.statusReview;
		default:
			return colors.textDim;
	}
}

/**
 * Priority to color mapping (matching getPriorityWithColor from ui.js)
 */
export function getPriorityColor(priority: string): string {
	const priorityLower = priority.toLowerCase();
	switch (priorityLower) {
		case 'high':
			return colors.priorityHigh;
		case 'medium':
			return colors.priorityMedium;
		case 'low':
			return colors.priorityLow;
		default:
			return colors.textDim;
	}
}

export type ColorKey = keyof typeof colors;

