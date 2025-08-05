import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const useUIStore = create(
	subscribeWithSelector((set, get) => ({
		// Screen Management
		currentScreen: 'welcome',
		navigationData: null,

		// Modal States
		showCommandPalette: false,
		showNextTaskModal: false,
		showSettings: false,
		showWorktreePrompt: false,

		// Input States
		inputValue: '',
		inputKey: 0,
		waitingForShortcut: false,

		// Suggestions & UI Feedback
		suggestions: [],
		suggestionIndex: 0,
		notification: null,
		loading: true,
		error: null,

		// Actions
		setCurrentScreen: (screen) => set({ currentScreen: screen }),
		setNavigationData: (data) => set({ navigationData: data }),

		// Modal Actions
		setShowCommandPalette: (show) => set({ showCommandPalette: show }),
		setShowNextTaskModal: (show) => set({ showNextTaskModal: show }),
		setShowSettings: (show) => set({ showSettings: show }),
		setShowWorktreePrompt: (show) => set({ showWorktreePrompt: show }),

		// Input Actions
		setInputValue: (value) => set({ inputValue: value }),
		setInputKey: (key) => set({ inputKey: key }),
		setWaitingForShortcut: (waiting) => set({ waitingForShortcut: waiting }),

		// Suggestion Actions
		setSuggestions: (suggestions) => set({ suggestions }),
		setSuggestionIndex: (index) => set({ suggestionIndex: index }),

		// Notification Actions
		setNotification: (notification) => set({ notification }),
		clearNotification: () => set({ notification: null }),

		// Loading and Error Actions
		setLoading: (loading) => set({ loading }),
		setError: (error) => set({ error }),
		clearError: () => set({ error: null }),

		// Additional Notification Actions
		showNotification: (message, type = 'info', duration = 3000) => {
			set({ notification: { message, type, timestamp: Date.now() } });

			// Auto-clear notification after duration
			setTimeout(() => {
				const current = get().notification;
				if (current && current.message === message) {
					set({ notification: null });
				}
			}, duration);
		},

		// Utility Actions
		resetUIState: () =>
			set({
				currentScreen: 'welcome',
				navigationData: null,
				showCommandPalette: false,
				showNextTaskModal: false,
				showSettings: false,
				showWorktreePrompt: false,
				waitingForShortcut: false,
				suggestions: [],
				suggestionIndex: 0,
				inputValue: '',
				notification: null,
				loading: true,
				error: null
			}),

		resetModalStates: () =>
			set({
				showCommandPalette: false,
				showNextTaskModal: false,
				showSettings: false,
				showWorktreePrompt: false
			})
	}))
);
