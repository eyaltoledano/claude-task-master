import { useRef } from 'react';
import { useTerminalSize } from '../useTerminalSize.js';
import { useComponentTheme } from '../useTheme.js';
import { useKeypress } from '../useKeypress.js';
import { getColor } from '../../theme/theme.js';

/**
 * Base modal hook providing common modal functionality
 * @param {Object} options - Modal configuration
 * @param {Function} options.onClose - Close callback
 * @param {string} options.title - Modal title
 * @param {string|number} options.width - Modal width (default: '80%')
 * @param {string|number} options.height - Modal height (default: 'auto')
 * @param {string} options.preset - Theme preset: 'default', 'error', 'warning', 'info', 'success'
 * @param {boolean} options.showCloseHint - Show ESC close hint (default: true)
 * @param {boolean} options.autoFocus - Enable auto focus management (default: true)
 */
export function useBaseModal({
	onClose,
	title,
	width = '80%',
	height = 'auto',
	preset = 'default',
	showCloseHint = true,
	autoFocus = true
}) {
	const {
		width: terminalWidth,
		height: terminalHeight,
		isNarrow
	} = useTerminalSize();
	const { theme } = useComponentTheme('modal');
	const modalRef = useRef(null);

	// Theme presets - resolve theme paths to actual colors
	const themePresets = {
		default: {
			borderColor: getColor(theme.border),
			titleColor: getColor(theme.accent),
			backgroundColor: getColor(theme.background)
		},
		error: {
			borderColor: getColor(theme.error),
			titleColor: getColor(theme.error),
			backgroundColor: getColor(theme.background)
		},
		warning: {
			borderColor: getColor(theme.warning),
			titleColor: getColor(theme.warning),
			backgroundColor: getColor(theme.background)
		},
		info: {
			borderColor: getColor(theme.info),
			titleColor: getColor(theme.info),
			backgroundColor: getColor(theme.background)
		},
		success: {
			borderColor: getColor(theme.success),
			titleColor: getColor(theme.success),
			backgroundColor: getColor(theme.background)
		}
	};

	const currentTheme = themePresets[preset] || themePresets.default;

	// Handle close
	const handleClose = () => {
		if (onClose && typeof onClose === 'function') {
			onClose();
		}
	};

	// Keyboard handlers
	const modalHandlers = {
		escape: handleClose
	};
	useKeypress(modalHandlers);

	// Calculate responsive dimensions
	const getResponsiveWidth = () => {
		if (typeof width === 'string' && width.endsWith('%')) {
			const percentage = parseInt(width) / 100;
			const calculatedWidth = Math.floor(terminalWidth * percentage);
			return isNarrow
				? Math.min(calculatedWidth, terminalWidth - 4)
				: calculatedWidth;
		}
		return isNarrow ? Math.min(width, terminalWidth - 4) : width;
	};

	const getResponsiveHeight = () => {
		if (height === 'auto') return undefined;
		if (typeof height === 'string' && height.endsWith('%')) {
			const percentage = parseInt(height) / 100;
			return Math.floor(terminalHeight * percentage);
		}
		return height;
	};

	const modalProps = {
		ref: modalRef,
		width: getResponsiveWidth(),
		height: getResponsiveHeight(),
		borderStyle: 'round',
		borderColor: currentTheme.borderColor,
		backgroundColor: currentTheme.backgroundColor,
		padding: 1
	};

	return {
		modalProps,
		theme: currentTheme,
		baseTheme: theme,
		isNarrow,
		terminalWidth,
		terminalHeight,
		handleClose,
		title,
		showCloseHint
	};
}
