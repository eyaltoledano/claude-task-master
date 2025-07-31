/**
 * Shared constants for TaskDetails components
 */

/**
 * Status color definitions for visual indicators
 */
export const STATUS_DOT_COLORS = {
	done: '#22c55e', // Green
	'in-progress': '#3b82f6', // Blue
	review: '#a855f7', // Purple
	deferred: '#ef4444', // Red
	cancelled: '#6b7280', // Gray
	pending: '#eab308' // Yellow (default)
} as const;

export type TaskStatus = keyof typeof STATUS_DOT_COLORS;

/**
 * Get the color for a status dot indicator
 * @param status - The task status
 * @returns The hex color code for the status
 */
export function getStatusDotColor(status: string): string {
	return STATUS_DOT_COLORS[status as TaskStatus] || STATUS_DOT_COLORS.pending;
}
