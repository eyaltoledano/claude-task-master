import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../stores/ui-store.js';
import { useDataStore } from '../stores/data-store.js';
import { usePreferencesStore } from '../stores/preferences-store.js';
import { useNavigationStore } from '../stores/navigation-store.js';

// UI Selectors - prevent unnecessary re-renders
export const useCurrentScreen = () =>
	useNavigationStore((state) => state.getCurrentScreen());

export const useNotification = () => useUIStore((state) => state.notification);

export const useLoading = () => useUIStore((state) => state.loading);

export const useError = () => useUIStore((state) => state.error);

// Modal Selectors - using shallow comparison for object
export const useModals = () =>
	useUIStore(
		useShallow((state) => ({
			showCommandPalette: state.showCommandPalette,
			showNextTaskModal: state.showNextTaskModal,
			showSettings: state.showSettings,
			showWorktreePrompt: state.showWorktreePrompt
		}))
	);

// Input Selectors - using shallow comparison
export const useInputState = () =>
	useUIStore(
		useShallow((state) => ({
			inputValue: state.inputValue,
			inputKey: state.inputKey,
			waitingForShortcut: state.waitingForShortcut,
			suggestions: state.suggestions,
			suggestionIndex: state.suggestionIndex
		}))
	);

// Navigation Selectors
export const useNavigationState = () =>
	useNavigationStore(
		useShallow((state) => ({
			currentScreen: state.getCurrentScreen(),
			canGoBack: state.canGoBack,
			canGoForward: state.canGoForward,
			navigationData: state.navigationData
		}))
	);

// Data Selectors
export const useTasks = () => useDataStore((state) => state.tasks);

export const useCurrentTag = () => useDataStore((state) => state.currentTag);

export const useNextTask = () => useDataStore((state) => state.nextTask);

export const useHasTasksFile = () =>
	useDataStore((state) => state.hasTasksFile);

// Git Info Selectors - using shallow comparison
export const useGitInfo = () =>
	useDataStore(
		useShallow((state) => ({
			currentBranch: state.currentBranch,
			repositoryName: state.repositoryName,
			branchInfo: state.branchInfo,
			remoteInfo: state.remoteInfo,
			hasRepository: state.hasGitRepository()
		}))
	);

// AI/Chat Selectors
export const useMessages = () => useDataStore((state) => state.messages);

export const useCurrentModel = () =>
	useDataStore((state) => state.currentModel);

export const useVersion = () => useDataStore((state) => state.version);

// Preferences Selectors
export const useTheme = () =>
	usePreferencesStore((state) => state.currentTheme);

export const useEffectiveTheme = () =>
	usePreferencesStore((state) => state.getEffectiveTheme());

export const useCurrentBackend = () =>
	usePreferencesStore((state) => state.currentBackend);

export const usePerformanceSettings = () =>
	usePreferencesStore(
		useShallow((state) => ({
			enablePerformanceTracking: state.enablePerformanceTracking,
			enableMemoryMonitoring: state.enableMemoryMonitoring,
			showRenderCount: state.showRenderCount
		}))
	);

export const useUIPreferences = () =>
	usePreferencesStore(
		useShallow((state) => ({
			enableAnimations: state.enableAnimations,
			compactMode: state.compactMode,
			showNotifications: state.showNotifications,
			notificationDuration: state.notificationDuration
		}))
	);

// Store Action Selectors - these return stable references
export const useUIActions = () =>
	useUIStore(
		useShallow((state) => ({
			setCurrentScreen: state.setCurrentScreen,
			setNavigationData: state.setNavigationData,
			setNotification: state.setNotification,
			clearNotification: state.clearNotification,
			setLoading: state.setLoading,
			setError: state.setError,
			clearError: state.clearError,
			resetUIState: state.resetUIState,
			setShowCommandPalette: state.setShowCommandPalette,
			setShowNextTaskModal: state.setShowNextTaskModal,
			setShowSettings: state.setShowSettings,
			setShowWorktreePrompt: state.setShowWorktreePrompt,
			setInputValue: state.setInputValue,
			setWaitingForShortcut: state.setWaitingForShortcut,
			setSuggestions: state.setSuggestions,
			setSuggestionIndex: state.setSuggestionIndex
		}))
	);

export const useDataActions = () =>
	useDataStore(
		useShallow((state) => ({
			setTasks: state.setTasks,
			setCurrentTag: state.setCurrentTag,
			setNextTask: state.setNextTask,
			setHasTasksFile: state.setHasTasksFile,
			setBranchInfo: state.setBranchInfo,
			setRemoteInfo: state.setRemoteInfo,
			setCurrentBranch: state.setCurrentBranch,
			setRepositoryName: state.setRepositoryName,
			setWorktreePromptData: state.setWorktreePromptData,
			addMessage: state.addMessage,
			setMessages: state.setMessages,
			clearMessages: state.clearMessages,
			setCurrentModel: state.setCurrentModel,
			setVersion: state.setVersion,
			resetTaskData: state.resetTaskData,
			resetGitData: state.resetGitData
		}))
	);

export const useNavigationActions = () =>
	useNavigationStore(
		useShallow((state) => ({
			navigateTo: state.navigateTo,
			goBack: state.goBack,
			goForward: state.goForward,
			replaceCurrent: state.replaceCurrent,
			resetNavigation: state.resetNavigation,
			setNavigationData: state.setNavigationData,
			clearNavigationData: state.clearNavigationData
		}))
	);

export const usePreferencesActions = () =>
	usePreferencesStore(
		useShallow((state) => ({
			setCurrentTheme: state.setCurrentTheme,
			setCurrentBackend: state.setCurrentBackend,
			setPerformanceTracking: state.setPerformanceTracking,
			setMemoryMonitoring: state.setMemoryMonitoring,
			setAnimations: state.setAnimations,
			setCompactMode: state.setCompactMode,
			setShowNotifications: state.setShowNotifications,
			setDebugMode: state.setDebugMode,
			resetToDefaults: state.resetToDefaults
		}))
	);

// Computed Selectors - memoized and optimized
export const useTaskStats = () =>
	useDataStore((state) => {
		const tasks = state.tasks;
		if (!tasks.length)
			return { total: 0, pending: 0, completed: 0, inProgress: 0 };

		return tasks.reduce(
			(stats, task) => {
				stats.total++;
				switch (task.status) {
					case 'pending':
						stats.pending++;
						break;
					case 'done':
					case 'completed':
						stats.completed++;
						break;
					case 'in-progress':
						stats.inProgress++;
						break;
				}
				return stats;
			},
			{ total: 0, pending: 0, completed: 0, inProgress: 0 }
		);
	});

export const useAvailableTasks = () =>
	useDataStore((state) =>
		state.tasks.filter((task) => task.status === 'pending')
	);

export const useCompletedTasks = () =>
	useDataStore((state) =>
		state.tasks.filter(
			(task) => task.status === 'done' || task.status === 'completed'
		)
	);

// Combined selectors for complex UI states
export const useAppState = () => {
	const loading = useLoading();
	const error = useError();
	const currentScreen = useCurrentScreen();
	const hasTasksFile = useHasTasksFile();

	return {
		loading,
		error,
		currentScreen,
		hasTasksFile,
		isReady: !loading && !error
	};
};
