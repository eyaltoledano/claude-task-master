/**
 * Theme hooks - JavaScript implementation for Node.js compatibility
 */

// Default theme configuration
const defaultTheme = {
	colors: {
		primary: '#007acc',
		secondary: '#6c757d',
		success: '#28a745',
		warning: '#ffc107',
		error: '#dc3545',
		info: '#17a2b8',
		light: '#f8f9fa',
		dark: '#343a40',
		background: '#ffffff',
		text: '#212529',
		border: '#dee2e6'
	},
	spacing: {
		xs: 1,
		sm: 2,
		md: 3,
		lg: 4,
		xl: 5
	},
	typography: {
		fontSize: {
			xs: 12,
			sm: 14,
			md: 16,
			lg: 18,
			xl: 20
		},
		fontWeight: {
			light: 300,
			normal: 400,
			medium: 500,
			bold: 700
		}
	},
	components: {
		modal: {
			backgroundColor: '#ffffff',
			borderColor: '#dee2e6',
			padding: 3,
			borderRadius: 1
		},
		taskList: {
			backgroundColor: '#f8f9fa',
			itemPadding: 2,
			itemMargin: 1
		},
		taskDetails: {
			backgroundColor: '#ffffff',
			padding: 3,
			borderColor: '#dee2e6'
		},
		taskFilters: {
			backgroundColor: '#f8f9fa',
			padding: 2,
			borderColor: '#dee2e6'
		},
		taskActions: {
			padding: 1,
			spacing: 2
		},
		taskStats: {
			backgroundColor: '#f8f9fa',
			padding: 2,
			borderColor: '#dee2e6'
		},
		overflowIndicator: {
			color: '#6c757d',
			fontSize: 12,
			indicator: '#94a3b8',
			text: '#64748b',
			background: 'transparent',
			border: '#374151'
		},
		showMore: {
			color: '#007acc',
			fontSize: 14
		},
		claudeSessionList: {
			backgroundColor: '#f8f9fa',
			itemPadding: 2
		},
		claudeActiveSession: {
			backgroundColor: '#e7f3ff',
			borderColor: '#007acc',
			padding: 2
		},
		claudeSessionActions: {
			padding: 1,
			spacing: 2
		},
		claudeCodeScreen: {
			backgroundColor: '#ffffff',
			padding: 3
		}
	}
};

// Simple theme context simulation
let currentTheme = defaultTheme;

/**
 * Get color value from path (e.g., 'text.primary' -> '#212529')
 * Enhanced with better error handling
 */
function getColorFromPath(path, theme = currentTheme) {
	try {
		if (!path || typeof path !== 'string') {
			return path; // Return as-is if not a string path
		}

		// Handle direct color values (hex, rgb, etc.)
		if (
			path.startsWith('#') ||
			path.startsWith('rgb') ||
			path.startsWith('hsl')
		) {
			return path;
		}

		// Split path and traverse theme object
		const pathParts = path.split('.');
		let value = theme.colors || theme;

		for (const part of pathParts) {
			if (value && typeof value === 'object' && part in value) {
				value = value[part];
			} else {
				// Path not found, return fallback or original path
				return path;
			}
		}

		return value || path;
	} catch (error) {
		console.warn('getColorFromPath error:', error);
		return path || '#000000'; // Fallback color
	}
}

/**
 * Hook to get the current theme
 */
export function useTheme() {
	try {
		return {
			theme: currentTheme,
			setTheme: (newTheme) => {
				currentTheme = { ...currentTheme, ...newTheme };
			},
			getColor: getColorFromPath
		};
	} catch (error) {
		console.warn('useTheme error:', error);
		return {
			theme: defaultTheme,
			setTheme: () => {},
			getColor: () => '#000000'
		};
	}
}

/**
 * Hook to get component-specific theme
 * Enhanced with better error handling and fallbacks
 */
export function useComponentTheme(componentName, overrides = {}) {
	try {
		const componentTheme =
			(currentTheme.components && currentTheme.components[componentName]) || {};

		// Merge component theme with overrides and return directly
		const theme = {
			...componentTheme,
			...overrides
		};

		return {
			theme,
			getColor: getColorFromPath,
			getThemedProps: (props = {}) => ({
				...props,
				theme
			})
		};
	} catch (error) {
		console.warn(`useComponentTheme error for ${componentName}:`, error);
		return {
			theme: {},
			getColor: () => '#000000',
			getThemedProps: (props = {}) => props
		};
	}
}

/**
 * Hook for responsive theme based on terminal size
 */
export function useResponsiveTheme() {
	try {
		const { theme } = useTheme();

		// Simple responsive logic based on process.stdout.columns
		const isSmall = (process.stdout.columns || 80) < 80;
		const isMedium = (process.stdout.columns || 80) < 120;

		const responsiveTheme = {
			...theme,
			responsive: {
				isSmall,
				isMedium,
				isLarge: !isSmall && !isMedium
			}
		};

		return {
			theme: responsiveTheme,
			isSmall,
			isMedium,
			isLarge: !isSmall && !isMedium
		};
	} catch (error) {
		console.warn('useResponsiveTheme error:', error);
		return {
			theme: defaultTheme,
			isSmall: false,
			isMedium: true,
			isLarge: false
		};
	}
}

/**
 * Hook for themed styles
 */
export function useThemedStyles(componentName) {
	try {
		const { theme } = useComponentTheme(componentName);

		return {
			theme,
			styles: theme.component || {}
		};
	} catch (error) {
		console.warn(`useThemedStyles error for ${componentName}:`, error);
		return {
			theme: {},
			styles: {}
		};
	}
}

/**
 * Hook for theme transitions (simplified for CLI)
 */
export function useThemeTransitions() {
	try {
		return {
			transition: (duration = 200) => ({
				// In CLI context, transitions are instantaneous
				duration: 0
			})
		};
	} catch (error) {
		console.warn('useThemeTransitions error:', error);
		return {
			transition: () => ({ duration: 0 })
		};
	}
}

/**
 * Hook for theme persistence (simplified)
 */
export function useThemePersistence() {
	try {
		return {
			saveTheme: (theme) => {
				// In CLI context, theme is session-based
				currentTheme = { ...currentTheme, ...theme };
			},
			loadTheme: () => currentTheme,
			clearTheme: () => {
				currentTheme = defaultTheme;
			}
		};
	} catch (error) {
		console.warn('useThemePersistence error:', error);
		return {
			saveTheme: () => {},
			loadTheme: () => defaultTheme,
			clearTheme: () => {}
		};
	}
}

/**
 * Theme Provider (simplified for CLI)
 */
export function ThemeProvider({ children, theme = defaultTheme }) {
	try {
		currentTheme = { ...defaultTheme, ...theme };
		return children;
	} catch (error) {
		console.warn('ThemeProvider error:', error);
		return children;
	}
}

// Export default theme and utilities
export { defaultTheme };
export const getColor = getColorFromPath;
