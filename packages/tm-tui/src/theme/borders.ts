/**
 * @fileoverview Task Master TUI Border Styles
 * Matches the border patterns from boxen usage in ui.js
 */

/**
 * Border style definitions matching boxen's borderStyle options
 */
export const borderStyles = {
	round: {
		topLeft: '╭',
		topRight: '╮',
		bottomLeft: '╰',
		bottomRight: '╯',
		horizontal: '─',
		vertical: '│'
	},
	single: {
		topLeft: '┌',
		topRight: '┐',
		bottomLeft: '└',
		bottomRight: '┘',
		horizontal: '─',
		vertical: '│'
	},
	double: {
		topLeft: '╔',
		topRight: '╗',
		bottomLeft: '╚',
		bottomRight: '╝',
		horizontal: '═',
		vertical: '║'
	},
	bold: {
		topLeft: '┏',
		topRight: '┓',
		bottomLeft: '┗',
		bottomRight: '┛',
		horizontal: '━',
		vertical: '┃'
	},
	classic: {
		topLeft: '+',
		topRight: '+',
		bottomLeft: '+',
		bottomRight: '+',
		horizontal: '-',
		vertical: '|'
	},
	arrow: {
		topLeft: '↘',
		topRight: '↙',
		bottomLeft: '↗',
		bottomRight: '↖',
		horizontal: '↔',
		vertical: '↕'
	}
} as const;

export type BorderStyle = keyof typeof borderStyles;

/**
 * Default box width matching scripts/init.js BOX_WIDTH constant
 */
export const DEFAULT_BOX_WIDTH = 95;

/**
 * Get responsive box width
 */
export function getBoxWidth(maxWidth: number = DEFAULT_BOX_WIDTH): number {
	const terminalWidth = process.stdout.columns || 80;
	return Math.min(maxWidth, terminalWidth - 4);
}

/**
 * Table border characters matching cli-table3 patterns
 */
export const tableBorders = {
	default: {
		top: '─',
		topMid: '┬',
		topLeft: '┌',
		topRight: '┐',
		bottom: '─',
		bottomMid: '┴',
		bottomLeft: '└',
		bottomRight: '┘',
		left: '│',
		leftMid: '├',
		mid: '─',
		midMid: '┼',
		right: '│',
		rightMid: '┤',
		middle: '│'
	},
	minimal: {
		top: '',
		topMid: '',
		topLeft: '',
		topRight: '',
		bottom: '',
		bottomMid: '',
		bottomLeft: '',
		bottomRight: '',
		left: '',
		leftMid: '',
		mid: '─',
		midMid: '─',
		right: '',
		rightMid: '',
		middle: '│'
	},
	none: {
		top: '',
		topMid: '',
		topLeft: '',
		topRight: '',
		bottom: '',
		bottomMid: '',
		bottomLeft: '',
		bottomRight: '',
		left: '',
		leftMid: '',
		mid: '',
		midMid: '',
		right: '',
		rightMid: '',
		middle: ''
	}
} as const;

export type TableBorderStyle = keyof typeof tableBorders;

