/**
 * Task Master Flow TUI Theme
 * Consistent with Task Master branding colors
 */

// Theme configuration for Task Master Flow

// Dark theme (for light/white terminals)
export const darkTheme = {
	// Primary colors
	background: '#000000',
	foreground: '#000000',
	accent: '#0066cc', // Blue that works on white

	// Text colors
	text: '#000000',
	textDim: '#666666',
	textBright: '#000000',

	// UI elements
	border: '#333333',
	selection: '#e0e0e0', // Light gray selection for white terminals
	selectionText: '#000000',

	// Status colors (work well on white)
	success: '#008800',
	error: '#cc0000',
	warning: '#cc6600',
	info: '#0066cc',

	// Task status colors
	statusDone: '#008800',
	statusInProgress: '#0066cc',
	statusPending: '#cc6600',
	statusBlocked: '#cc0000',
	statusDeferred: '#666666',

	// Priority colors
	priorityHigh: '#cc0000',
	priorityMedium: '#cc6600',
	priorityLow: '#0066cc'
};

// Light theme (for dark terminals)
export const lightTheme = {
	// Primary colors
	background: '#1a1a1a',
	foreground: '#ffffff',
	accent: '#00d7ff', // Cyan

	// Text colors
	text: '#e0e0e0',
	textDim: '#808080',
	textBright: '#ffffff',

	// UI elements
	border: '#404040',
	selection: '#333333',
	selectionText: '#ffffff',

	// Status colors
	success: '#00ff00',
	error: '#ff3333',
	warning: '#ffaa00',
	info: '#00aaff',

	// Task status colors
	statusDone: '#00ff00',
	statusInProgress: '#00aaff',
	statusPending: '#ffaa00',
	statusBlocked: '#ff3333',
	statusDeferred: '#808080',

	// Priority colors
	priorityHigh: '#ff3333',
	priorityMedium: '#ffaa00',
	priorityLow: '#00d7ff'
};

// Get theme based on environment or user preference
export function getTheme(userPreference) {
	// Check user preference first
	if (userPreference === 'dark') return darkTheme;
	if (userPreference === 'light') return lightTheme;

	// Try to detect terminal theme
	// Check common environment variables
	const colorScheme = process.env.COLORFGBG || process.env.TERM_PROGRAM || '';
	const termProgram = process.env.TERM_PROGRAM || '';

	// Some heuristics for detection
	if (colorScheme.includes('0;15') || colorScheme.includes('15;0')) {
		// Light background detected
		return darkTheme;
	}

	// Check for known light terminal programs
	if (termProgram === 'Apple_Terminal' && !process.env.TERM_APPEARANCE) {
		// Default macOS Terminal is usually light
		return darkTheme;
	}

	// Check if running in VS Code's integrated terminal
	if (process.env.TERM_PROGRAM === 'vscode') {
		// VS Code terminal theme detection would require more complex logic
		// Default to light theme for dark terminals
		return lightTheme;
	}

	// Default to light theme (for dark terminals) as it's more common
	return lightTheme;
}

// Export a mutable theme object that can be updated
export let theme = getTheme();

// Function to update theme
export function setTheme(newTheme) {
	theme = newTheme === 'dark' ? darkTheme : lightTheme;
}

/**
 * Helper to get theme color with chalk
 */
export function getThemeColor(colorPath) {
	const parts = colorPath.split('.');
	let value = theme;
	for (const part of parts) {
		value = value[part];
		if (!value) return '#ffffff';
	}
	return value;
}
