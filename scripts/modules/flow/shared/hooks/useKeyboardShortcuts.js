import { useEffect, useCallback, useRef, useState, useMemo } from 'react';

// Default keyboard shortcuts configuration
const DEFAULT_SHORTCUTS = {
	// Global shortcuts
	global: {
		'cmd+k': 'openCommandPalette',
		'ctrl+k': 'openCommandPalette',
		'?': 'showHelp',
		esc: 'closeModal',
		'cmd+z': 'undo',
		'ctrl+z': 'undo',
		'cmd+shift+z': 'redo',
		'ctrl+shift+z': 'redo',
		'cmd+/': 'toggleShortcuts',
		'ctrl+/': 'toggleShortcuts'
	},

	// Task management shortcuts
	taskManagement: {
		n: 'newTask',
		e: 'editTask',
		d: 'deleteTask',
		c: 'copyTask',
		r: 'refreshTasks',
		f: 'filterTasks',
		s: 'searchTasks',
		space: 'toggleTaskStatus',
		enter: 'openTask',
		'shift+enter': 'openTaskInNewWindow',
		1: 'setStatusPending',
		2: 'setStatusInProgress',
		3: 'setStatusDone',
		4: 'setStatusBlocked'
	},

	// Workflow shortcuts
	workflow: {
		w: 'openWorkflowModal',
		c: 'openCommitAssistant',
		p: 'createPullRequest',
		m: 'mergeLocally',
		g: 'openGitStatus',
		b: 'switchBranch',
		l: 'viewLogs',
		'shift+c': 'commitChanges',
		'shift+p': 'pushChanges'
	},

	// Navigation shortcuts
	navigation: {
		j: 'moveDown',
		k: 'moveUp',
		h: 'moveLeft',
		l: 'moveRight',
		'g g': 'goToTop',
		'shift+g': 'goToBottom',
		'cmd+1': 'goToTab1',
		'cmd+2': 'goToTab2',
		'cmd+3': 'goToTab3',
		'cmd+4': 'goToTab4',
		'ctrl+1': 'goToTab1',
		'ctrl+2': 'goToTab2',
		'ctrl+3': 'goToTab3',
		'ctrl+4': 'goToTab4'
	},

	// Modal shortcuts
	modal: {
		esc: 'closeModal',
		enter: 'confirmModal',
		'cmd+enter': 'submitForm',
		'ctrl+enter': 'submitForm',
		tab: 'nextField',
		'shift+tab': 'previousField'
	}
};

// Key mapping for cross-platform compatibility
const KEY_MAPPINGS = {
	cmd:
		navigator.platform.toUpperCase().indexOf('MAC') >= 0
			? 'metaKey'
			: 'ctrlKey',
	ctrl: 'ctrlKey',
	alt: 'altKey',
	shift: 'shiftKey',
	meta: 'metaKey'
};

// Parse keyboard shortcut string into modifier and key
const parseShortcut = (shortcut) => {
	const parts = shortcut.toLowerCase().split('+');
	const key = parts[parts.length - 1];
	const modifiers = parts.slice(0, -1);

	return {
		key,
		modifiers: modifiers.reduce((acc, mod) => {
			const mappedKey = KEY_MAPPINGS[mod];
			if (mappedKey) {
				acc[mappedKey] = true;
			}
			return acc;
		}, {})
	};
};

// Check if event matches shortcut
const matchesShortcut = (event, shortcut) => {
	const { key, modifiers } = parseShortcut(shortcut);

	// Check if all required modifiers are pressed
	for (const [modifierKey, required] of Object.entries(modifiers)) {
		if (event[modifierKey] !== required) {
			return false;
		}
	}

	// Check if any unrequired modifiers are pressed
	const allModifiers = ['ctrlKey', 'altKey', 'shiftKey', 'metaKey'];
	for (const modifier of allModifiers) {
		if (!modifiers[modifier] && event[modifier]) {
			return false;
		}
	}

	// Check key match
	return event.key.toLowerCase() === key;
};

// Main keyboard shortcuts hook
export const useKeyboardShortcuts = (config = {}) => {
	const {
		context = 'global',
		shortcuts = {},
		enabled = true,
		preventDefault = true,
		stopPropagation = true
	} = config;

	const shortcutsRef = useRef({});
	const sequenceRef = useRef('');
	const sequenceTimeoutRef = useRef(null);

	// Merge default shortcuts with custom shortcuts
	const mergedShortcuts = useMemo(
		() => ({
			...DEFAULT_SHORTCUTS[context],
			...shortcuts
		}),
		[context, shortcuts]
	);

	const handleKeyDown = useCallback(
		(event) => {
			if (!enabled) return;

			// Skip if target is an input field (unless explicitly allowed)
			if (
				event.target.tagName === 'INPUT' ||
				event.target.tagName === 'TEXTAREA' ||
				event.target.contentEditable === 'true'
			) {
				return;
			}

			// Handle key sequences (like 'g g')
			const currentKey = event.key.toLowerCase();

			// Clear sequence timeout
			if (sequenceTimeoutRef.current) {
				clearTimeout(sequenceTimeoutRef.current);
			}

			// Add to sequence
			sequenceRef.current += currentKey;

			// Check for sequence matches
			for (const [shortcut, action] of Object.entries(mergedShortcuts)) {
				if (shortcut.includes(' ')) {
					// Multi-key sequence
					const sequence = shortcut.replace(/ /g, '');
					if (sequenceRef.current === sequence) {
						const handler = shortcutsRef.current[action];
						if (handler) {
							if (preventDefault) event.preventDefault();
							if (stopPropagation) event.stopPropagation();
							handler(event);
							sequenceRef.current = '';
							return;
						}
					}
				} else {
					// Single key or modifier combination
					if (matchesShortcut(event, shortcut)) {
						const handler = shortcutsRef.current[action];
						if (handler) {
							if (preventDefault) event.preventDefault();
							if (stopPropagation) event.stopPropagation();
							handler(event);
							sequenceRef.current = '';
							return;
						}
					}
				}
			}

			// Set timeout to clear sequence
			sequenceTimeoutRef.current = setTimeout(() => {
				sequenceRef.current = '';
			}, 1000);
		},
		[enabled, mergedShortcuts, preventDefault, stopPropagation]
	);

	const registerShortcut = useCallback((action, handler) => {
		shortcutsRef.current[action] = handler;
	}, []);

	const unregisterShortcut = useCallback((action) => {
		delete shortcutsRef.current[action];
	}, []);

	const getShortcutForAction = useCallback(
		(action) => {
			for (const [shortcut, shortcutAction] of Object.entries(
				mergedShortcuts
			)) {
				if (shortcutAction === action) {
					return shortcut;
				}
			}
			return null;
		},
		[mergedShortcuts]
	);

	useEffect(() => {
		if (enabled) {
			document.addEventListener('keydown', handleKeyDown);
			return () => document.removeEventListener('keydown', handleKeyDown);
		}
	}, [handleKeyDown, enabled]);

	return {
		registerShortcut,
		unregisterShortcut,
		getShortcutForAction,
		shortcuts: mergedShortcuts
	};
};

// Hook for managing shortcut help overlay
export const useShortcutHelp = (context = 'global') => {
	const [isVisible, setIsVisible] = useState(false);

	const { registerShortcut, unregisterShortcut, shortcuts } =
		useKeyboardShortcuts({
			context: 'global',
			shortcuts: {
				'?': 'showHelp',
				esc: 'hideHelp'
			}
		});

	useEffect(() => {
		registerShortcut('showHelp', () => setIsVisible(true));
		registerShortcut('hideHelp', () => setIsVisible(false));

		return () => {
			unregisterShortcut('showHelp');
			unregisterShortcut('hideHelp');
		};
	}, [registerShortcut, unregisterShortcut]);

	const toggleHelp = useCallback(() => {
		setIsVisible((prev) => !prev);
	}, []);

	const hideHelp = useCallback(() => {
		setIsVisible(false);
	}, []);

	// Get shortcuts for current context
	const contextShortcuts = DEFAULT_SHORTCUTS[context] || {};

	return {
		isVisible,
		toggleHelp,
		hideHelp,
		shortcuts: contextShortcuts
	};
};

// Hook for command palette functionality
export const useCommandPalette = () => {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');

	const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts({
		context: 'global'
	});

	useEffect(() => {
		registerShortcut('openCommandPalette', () => setIsOpen(true));

		return () => {
			unregisterShortcut('openCommandPalette');
		};
	}, [registerShortcut, unregisterShortcut]);

	const closeCommandPalette = useCallback(() => {
		setIsOpen(false);
		setQuery('');
	}, []);

	return {
		isOpen,
		query,
		setQuery,
		closeCommandPalette
	};
};

// Utility function to format shortcut for display
export const formatShortcut = (shortcut) => {
	const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

	return shortcut
		.split('+')
		.map((key) => {
			switch (key.toLowerCase()) {
				case 'cmd':
					return isMac ? '⌘' : 'Ctrl';
				case 'ctrl':
					return isMac ? '⌃' : 'Ctrl';
				case 'alt':
					return isMac ? '⌥' : 'Alt';
				case 'shift':
					return isMac ? '⇧' : 'Shift';
				case 'meta':
					return isMac ? '⌘' : 'Win';
				case 'enter':
					return '↵';
				case 'space':
					return '␣';
				case 'esc':
					return 'Esc';
				case 'tab':
					return '⇥';
				case 'backspace':
					return '⌫';
				case 'delete':
					return '⌦';
				case 'arrowup':
					return '↑';
				case 'arrowdown':
					return '↓';
				case 'arrowleft':
					return '←';
				case 'arrowright':
					return '→';
				default:
					return key.toUpperCase();
			}
		})
		.join(isMac ? '' : '+');
};

// Export action constants for consistency
export const ACTIONS = {
	// Global actions
	OPEN_COMMAND_PALETTE: 'openCommandPalette',
	SHOW_HELP: 'showHelp',
	CLOSE_MODAL: 'closeModal',
	UNDO: 'undo',
	REDO: 'redo',
	TOGGLE_SHORTCUTS: 'toggleShortcuts',

	// Task management actions
	NEW_TASK: 'newTask',
	EDIT_TASK: 'editTask',
	DELETE_TASK: 'deleteTask',
	COPY_TASK: 'copyTask',
	REFRESH_TASKS: 'refreshTasks',
	FILTER_TASKS: 'filterTasks',
	SEARCH_TASKS: 'searchTasks',
	TOGGLE_TASK_STATUS: 'toggleTaskStatus',
	OPEN_TASK: 'openTask',

	// Workflow actions
	OPEN_WORKFLOW_MODAL: 'openWorkflowModal',
	OPEN_COMMIT_ASSISTANT: 'openCommitAssistant',
	CREATE_PULL_REQUEST: 'createPullRequest',
	MERGE_LOCALLY: 'mergeLocally',
	OPEN_GIT_STATUS: 'openGitStatus',

	// Navigation actions
	MOVE_DOWN: 'moveDown',
	MOVE_UP: 'moveUp',
	MOVE_LEFT: 'moveLeft',
	MOVE_RIGHT: 'moveRight',
	GO_TO_TOP: 'goToTop',
	GO_TO_BOTTOM: 'goToBottom'
};

export default useKeyboardShortcuts;
