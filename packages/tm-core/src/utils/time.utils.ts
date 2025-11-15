/**
 * @fileoverview Time utilities for formatting relative timestamps
 * Shared across CLI, MCP, extension, and other interfaces
 */

import { formatDistanceToNow } from 'date-fns';

/**
 * Format a date as relative time from now (e.g., "2 hours ago", "3 days ago")
 * @param date - Date string or Date object to format
 * @returns Relative time string (e.g., "less than a minute ago", "5 minutes ago", "2 weeks ago")
 */
export function formatRelativeTime(date: string | Date): string {
	const dateObj = typeof date === 'string' ? new Date(date) : date;

	// Use date-fns for robust formatting with proper edge case handling
	return formatDistanceToNow(dateObj, { addSuffix: true });
}
