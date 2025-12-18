/**
 * @fileoverview Time utilities for formatting timestamps
 * Shared across CLI, MCP, extension, and other interfaces
 */

import { format, formatDistanceToNow } from 'date-fns';

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

/**
 * Format a date as a time string (e.g., "02:30:45 PM")
 * @param date - Date object to format
 * @returns Formatted time string in 12-hour format with seconds
 */
export function formatTime(date: Date): string {
	return format(date, 'hh:mm:ss a');
}
