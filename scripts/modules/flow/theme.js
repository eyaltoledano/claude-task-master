/**
 * Task Master Flow TUI Theme
 * Consistent with Task Master branding colors
 */

import { execSync } from 'child_process';

// Theme configuration for Task Master Flow

// Light mode theme - dark text on light background (for light/white terminals)
export const lightModeTheme = {
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

// Dark mode theme - light text on dark background (for dark terminals)
export const darkModeTheme = {
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

// Keep old names for backward compatibility
export const darkTheme = lightModeTheme;
export const lightTheme = darkModeTheme;

/**
 * Detect if the terminal has a dark background
 * @returns {boolean} true if terminal has dark background, false if light
 */
function detectTerminalIsDark() {
	// Check for explicit theme environment variables
	if (process.env.TASKMASTER_THEME) {
		return process.env.TASKMASTER_THEME === 'dark';
	}

	// Check macOS appearance setting
	if (process.platform === 'darwin') {
		try {
			const result = execSync(
				'defaults read -g AppleInterfaceStyle 2>/dev/null',
				{ encoding: 'utf8' }
			).trim();
			// If AppleInterfaceStyle is set to 'Dark', the system is in dark mode
			// But don't return early - terminal theme might differ from system theme
			if (result === 'Dark') {
				// System is in dark mode, terminal likely is too
				return true;
			}
			// System is in light mode, but continue checking terminal-specific settings
		} catch (e) {
			// If the command fails, AppleInterfaceStyle is not set (light mode)
			// Don't return here, continue with other checks
		}
	}

	// Check for terminal-specific environment variables
	const termProgram = process.env.TERM_PROGRAM || '';
	const termProgramVersion = process.env.TERM_PROGRAM_VERSION || '';

	// VS Code integrated terminal
	if (termProgram === 'vscode') {
		// VS Code defaults to dark themes
		return true;
	}

	// iTerm2
	if (termProgram === 'iTerm.app') {
		// iTerm2 typically uses dark themes
		return true;
	}

	// Hyper terminal
	if (termProgram === 'Hyper') {
		// Hyper defaults to dark theme
		return true;
	}

	// Windows Terminal
	if (process.env.WT_SESSION || process.env.WSLENV) {
		// Windows Terminal and WSL typically use dark themes
		return true;
	}

	// Check COLORFGBG environment variable
	// Format is typically "foreground;background" with ANSI color codes
	const colorFgBg = process.env.COLORFGBG || '';
	if (colorFgBg) {
		const parts = colorFgBg.split(';');
		if (parts.length >= 2) {
			const bg = parseInt(parts[1], 10);
			// ANSI colors: 0-7 are dark colors, 8-15 are bright colors
			// 0 = black, 7 = white, 15 = bright white
			if (!isNaN(bg)) {
				// Background colors 0-6 and 8-14 are considered dark
				// 7 (white) and 15 (bright white) are considered light
				return bg !== 7 && bg !== 15;
			}
		}
	}

	// Check for common terminal color scheme indicators
	if (
		process.env.COLORTERM === 'truecolor' ||
		process.env.COLORTERM === '24bit'
	) {
		// Modern terminals with true color support typically use dark themes
		return true;
	}

	/**
	 * Detect Apple Terminal theme by reading the default profile
	 * @returns {boolean|null} true if dark, false if light, null if unknown
	 */
	function detectAppleTerminalTheme() {
		try {
			const profile = execSync(
				'defaults read com.apple.Terminal "Default Window Settings" 2>/dev/null',
				{ encoding: 'utf8' }
			).trim();

			// Map built-in Terminal.app profiles to light/dark
			const profileMap = {
				// Dark profiles
				Pro: 'dark',
				Novel: 'dark',
				'Red Sands': 'dark',
				'Silver Aerogel': 'dark',
				'Solid Colors': 'dark',

				// Light profiles
				Basic: 'light',
				Homebrew: 'light',
				'Man Page': 'light',
				Ocean: 'light',
				Grass: 'light'
				// Users can extend this mapping in their config if needed
			};

			if (profile && profileMap[profile]) {
				return profileMap[profile] === 'dark';
			}

			return null; // Unknown profile, fall through to other heuristics
		} catch (e) {
			return null; // Command failed, fall through
		}
	}

	// Apple Terminal specific check
	if (termProgram === 'Apple_Terminal') {
		// Check for Terminal appearance
		if (process.env.TERM_APPEARANCE === 'dark') {
			return true;
		} else if (process.env.TERM_APPEARANCE === 'light') {
			return false;
		}

		// Try to detect theme from Terminal profile
		const profileTheme = detectAppleTerminalTheme();
		if (profileTheme !== null) {
			return profileTheme;
		}

		// If TERM_APPEARANCE is not set, check if we detected macOS dark mode earlier
		if (process.platform === 'darwin') {
			try {
				const result = execSync(
					'defaults read -g AppleInterfaceStyle 2>/dev/null',
					{ encoding: 'utf8' }
				).trim();
				if (result === 'Dark') {
					return true;
				}
			} catch (e) {
				// Ignore error
			}
		}

		// If we couldn't determine the appearance, assume light on systems
		// where AppleInterfaceStyle is not set (e.g., daytime/light mode)
		// and TERM_APPEARANCE is undefined.
		return false;
	}

	// Check for theme-related environment variables
	const themeEnvVars = ['TERMINAL_THEME', 'TERM_THEME', 'COLOR_THEME', 'THEME'];

	for (const envVar of themeEnvVars) {
		const value = process.env[envVar];
		if (value) {
			const lowerValue = value.toLowerCase();
			if (lowerValue.includes('dark')) return true;
			if (lowerValue.includes('light')) return false;
		}
	}

	// Default to dark terminal (most common)
	return true;
}

// Get theme based on environment or user preference
export function getTheme(userPreference) {
	// Check user preference first
	if (userPreference === 'dark') return darkModeTheme;
	if (userPreference === 'light') return lightModeTheme;

	// Auto-detect based on terminal
	const isDarkTerminal = detectTerminalIsDark();

	// Return appropriate theme based on terminal background
	return isDarkTerminal ? darkModeTheme : lightModeTheme;
}

// Export a mutable theme object that can be updated
export let theme = null;

// Initialize theme on first access
export function getCurrentTheme() {
	if (!theme) {
		theme = getTheme('auto');
	}
	return theme;
}

// Function to update theme
export function setTheme(newTheme) {
	if (newTheme === 'auto') {
		theme = getTheme('auto');
	} else {
		theme = newTheme === 'dark' ? darkModeTheme : lightModeTheme;
	}
}

// Initialize theme immediately
theme = getTheme('auto');

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
