/**
 * Task Master Flow Hooks
 * Centralized exports for all custom hooks
 * Based on Gemini CLI hook architecture patterns
 */

// Core infrastructure hooks
export { useTerminalSize } from './useTerminalSize.js';
export { useStateAndRef } from './useStateAndRef.js';
export { useKeypress, createKeyHandlers } from './useKeypress.js';

// UI enhancement hooks
export { usePhraseCycler, PhraseCollections } from './usePhraseCycler.js';
export { useConsoleMessages, MessageFormatters } from './useConsoleMessages.js';

// Context-aware hooks
export { useGitBranchName } from './useGitBranchName.js';

// Theme system hooks
export {
	ThemeProvider,
	useTheme,
	useResponsiveTheme,
	useComponentTheme,
	useThemedStyles,
	useThemeTransitions,
	useThemePersistence
} from './useTheme.jsx';

// Re-export hook utilities for convenience
export const HookUtils = {
	// Terminal utilities
	getTerminalInfo: () => ({
		width: process.stdout.columns || 80,
		height: process.stdout.rows || 24,
		hasColor: process.stdout.hasColors && process.stdout.hasColors(),
		isTTY: process.stdout.isTTY
	}),

	// Common key handler presets
	createNavigationHandlers: (callbacks) => ({
		up: callbacks.onUp,
		down: callbacks.onDown,
		left: callbacks.onLeft,
		right: callbacks.onRight,
		k: callbacks.onUp, // vim-style
		j: callbacks.onDown, // vim-style
		h: callbacks.onLeft, // vim-style
		l: callbacks.onRight, // vim-style
		'ctrl+p': callbacks.onUp, // emacs-style
		'ctrl+n': callbacks.onDown // emacs-style
	}),

	// Common modal handlers
	createModalHandlers: (callbacks) => ({
		escape: callbacks.onClose,
		'ctrl+c': callbacks.onClose,
		return: callbacks.onConfirm,
		tab: callbacks.onNext,
		'shift+tab': callbacks.onPrevious
	}),

	// Search handlers
	createSearchHandlers: (callbacks) => ({
		'ctrl+f': callbacks.onSearch,
		'/': callbacks.onSearch,
		'ctrl+k': callbacks.onClear,
		escape: callbacks.onClearSearch
	})
};
