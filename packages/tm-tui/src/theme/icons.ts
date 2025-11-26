/**
 * @fileoverview Task Master TUI Icon System
 * Matches the icon patterns from scripts/modules/ui.js and scripts/init.js
 */

/**
 * Log level icons (matching log function icons from init.js)
 */
export const logIcons = {
	debug: '•',
	info: '→',
	warn: '!',
	error: '✗',
	success: '✓'
} as const;

/**
 * Status icons (matching getStatusWithColor patterns from ui.js)
 */
export const statusIcons = {
	done: '✓',
	pending: '○',
	inProgress: '◐',
	blocked: '✗',
	deferred: '◌',
	cancelled: '⊘',
	review: '◉'
} as const;

/**
 * Dependency status icons (matching formatDependenciesWithStatus from ui.js)
 */
export const dependencyIcons = {
	completed: '✅',
	pending: '⏱️'
} as const;

/**
 * Action icons
 */
export const actionIcons = {
	expand: '⤵',
	collapse: '⤴',
	add: '+',
	remove: '-',
	edit: '✎',
	view: '👁',
	start: '▶',
	stop: '■',
	refresh: '↻',
	settings: '⚙',
	help: '?'
} as const;

/**
 * Tag/context icons
 */
export const contextIcons = {
	tag: '🏷️',
	brief: '📋',
	folder: '📁',
	file: '📄',
	task: '☐',
	subtask: '└─'
} as const;

/**
 * Loading/progress icons
 */
export const progressIcons = {
	spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
	dots: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
	line: ['|', '/', '-', '\\'],
	circle: ['◐', '◓', '◑', '◒'],
	bar: ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']
} as const;

/**
 * Decorative icons
 */
export const decorativeIcons = {
	arrow: '→',
	arrowRight: '→',
	arrowLeft: '←',
	arrowUp: '↑',
	arrowDown: '↓',
	bullet: '•',
	star: '★',
	checkmark: '✓',
	cross: '✗',
	warning: '⚠',
	info: 'ℹ',
	question: '?'
} as const;

export type LogIconKey = keyof typeof logIcons;
export type StatusIconKey = keyof typeof statusIcons;

/**
 * Combined icons object for convenient access
 */
export const icons = {
	log: logIcons,
	status: statusIcons,
	dependency: dependencyIcons,
	action: actionIcons,
	context: contextIcons,
	progress: progressIcons,
	decorative: decorativeIcons,
} as const;

