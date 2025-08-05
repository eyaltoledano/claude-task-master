import { useFlowAppStore } from './flow-app-store.js';

// === DOMAIN SELECTORS ===
// These subscribe to entire domains - use when you need multiple properties

export const useNavigation = () => useFlowAppStore(state => state.navigation);
export const useInput = () => useFlowAppStore(state => state.input);
export const useTasks = () => useFlowAppStore(state => state.tasks);
export const useUI = () => useFlowAppStore(state => state.ui);
export const useModals = () => useFlowAppStore(state => state.modals);
export const useGit = () => useFlowAppStore(state => state.git);
export const useAI = () => useFlowAppStore(state => state.ai);
export const useMeta = () => useFlowAppStore(state => state.meta);

// === SPECIFIC VALUE SELECTORS ===
// These subscribe to individual values - use for performance optimization

// Navigation Selectors
export const useCurrentScreen = () => useFlowAppStore(state => state.navigation.currentScreen);
export const useNavigationData = () => useFlowAppStore(state => state.navigation.navigationData);
export const useInputKey = () => useFlowAppStore(state => state.navigation.inputKey);

// Input Selectors
export const useInputValue = () => useFlowAppStore(state => state.input.value);
export const useSuggestions = () => useFlowAppStore(state => state.input.suggestions);
export const useSuggestionIndex = () => useFlowAppStore(state => state.input.suggestionIndex);
export const useWaitingForShortcut = () => useFlowAppStore(state => state.input.waitingForShortcut);

// Task Selectors
export const useTaskList = () => useFlowAppStore(state => state.tasks.list);
export const useCurrentTag = () => useFlowAppStore(state => state.tasks.currentTag);
export const useHasTasksFile = () => useFlowAppStore(state => state.tasks.hasFile);
export const useNextTask = () => useFlowAppStore(state => state.tasks.nextTask);

// UI Selectors
export const useIsLoading = () => useFlowAppStore(state => state.ui.loading);
export const useError = () => useFlowAppStore(state => state.ui.error);
export const useNotification = () => useFlowAppStore(state => state.ui.notification);
export const useCurrentTheme = () => useFlowAppStore(state => state.ui.currentTheme);

// Modal Selectors
export const useShowCommandPalette = () => useFlowAppStore(state => state.modals.showCommandPalette);
export const useShowNextTaskModal = () => useFlowAppStore(state => state.modals.showNextTaskModal);
export const useShowSettings = () => useFlowAppStore(state => state.modals.showSettings);
export const useShowWorktreePrompt = () => useFlowAppStore(state => state.modals.showWorktreePrompt);

// Git Selectors
export const useCurrentBranch = () => useFlowAppStore(state => state.git.currentBranch);
export const useRepositoryName = () => useFlowAppStore(state => state.git.repositoryName);
export const useBranchInfo = () => useFlowAppStore(state => state.git.branchInfo);
export const useRemoteInfo = () => useFlowAppStore(state => state.git.remoteInfo);
export const useWorktreePromptData = () => useFlowAppStore(state => state.git.worktreePromptData);

// AI Selectors
export const useMessages = () => useFlowAppStore(state => state.ai.messages);
export const useCurrentModel = () => useFlowAppStore(state => state.ai.currentModel);
export const useCurrentBackend = () => useFlowAppStore(state => state.ai.currentBackend);

// Meta Selectors
export const useVersion = () => useFlowAppStore(state => state.meta.version);

// === DERIVED STATE SELECTORS ===
// These compute values from the state

export const useHasError = () => useFlowAppStore(state => !!state.ui.error);
export const useTaskCount = () => useFlowAppStore(state => state.tasks.list.length);
export const useMessageCount = () => useFlowAppStore(state => state.ai.messages.length);
export const useHasNotification = () => useFlowAppStore(state => !!state.ui.notification);
export const useAnyModalOpen = () => useFlowAppStore(state => 
  Object.values(state.modals).some(isOpen => isOpen)
);

// Git-derived selectors
export const useFormattedRemoteUrl = () => useFlowAppStore(state => {
  const remoteInfo = state.git.remoteInfo;
  if (!remoteInfo || !remoteInfo.hasRemote || !remoteInfo.url) {
    return null;
  }

  let url = remoteInfo.url;
  
  // Remove .git suffix if present
  if (url.endsWith('.git')) {
    url = url.slice(0, -4);
  }

  // Handle different URL formats
  if (url.startsWith('git@')) {
    // git@github.com:user/repo -> github.com/user/repo
    url = url.replace('git@', '').replace(':', '/');
  } else if (url.startsWith('https://')) {
    // https://github.com/user/repo -> github.com/user/repo
    // https://username@github.com/user/repo -> github.com/user/repo
    url = url.replace('https://', '');
    
    // Remove username@ if present
    if (url.includes('@')) {
      url = url.split('@')[1];
    }
  }

  return url;
});

// === ACTION SELECTORS ===
// These return only the actions, preventing re-renders when state changes

// === INDIVIDUAL ACTION SELECTORS ===
// Navigation Actions
export const useSetCurrentScreen = () => useFlowAppStore(state => state.setCurrentScreen);
export const useSetNavigationData = () => useFlowAppStore(state => state.setNavigationData);
export const useIncrementInputKey = () => useFlowAppStore(state => state.incrementInputKey);

// Input Actions
export const useUpdateInput = () => useFlowAppStore(state => state.updateInput);
export const useSetInputValue = () => useFlowAppStore(state => state.setInputValue);
export const useSetSuggestions = () => useFlowAppStore(state => state.setSuggestions);
export const useSetSuggestionIndex = () => useFlowAppStore(state => state.setSuggestionIndex);
export const useSetWaitingForShortcut = () => useFlowAppStore(state => state.setWaitingForShortcut);
export const useResetInput = () => useFlowAppStore(state => state.resetInput);

// Task Actions
export const useUpdateTasks = () => useFlowAppStore(state => state.updateTasks);
export const useSetTasks = () => useFlowAppStore(state => state.setTasks);
export const useSetCurrentTag = () => useFlowAppStore(state => state.setCurrentTag);
export const useSetHasTasksFile = () => useFlowAppStore(state => state.setHasTasksFile);
export const useSetNextTask = () => useFlowAppStore(state => state.setNextTask);

// UI Actions
export const useUpdateUI = () => useFlowAppStore(state => state.updateUI);
export const useSetLoading = () => useFlowAppStore(state => state.setLoading);
export const useSetError = () => useFlowAppStore(state => state.setError);
export const useClearError = () => useFlowAppStore(state => state.clearError);
export const useSetNotification = () => useFlowAppStore(state => state.setNotification);
export const useClearNotification = () => useFlowAppStore(state => state.clearNotification);
export const useSetCurrentTheme = () => useFlowAppStore(state => state.setCurrentTheme);

// Modal Actions
export const useUpdateModals = () => useFlowAppStore(state => state.updateModals);
export const useSetShowCommandPalette = () => useFlowAppStore(state => state.setShowCommandPalette);
export const useSetShowNextTaskModal = () => useFlowAppStore(state => state.setShowNextTaskModal);
export const useSetShowSettings = () => useFlowAppStore(state => state.setShowSettings);
export const useSetShowWorktreePrompt = () => useFlowAppStore(state => state.setShowWorktreePrompt);
export const useToggleModal = () => useFlowAppStore(state => state.toggleModal);
export const useCloseAllModals = () => useFlowAppStore(state => state.closeAllModals);

// Git Actions
export const useUpdateGit = () => useFlowAppStore(state => state.updateGit);
export const useSetCurrentBranch = () => useFlowAppStore(state => state.setCurrentBranch);
export const useSetRepositoryName = () => useFlowAppStore(state => state.setRepositoryName);
export const useSetBranchInfo = () => useFlowAppStore(state => state.setBranchInfo);
export const useSetRemoteInfo = () => useFlowAppStore(state => state.setRemoteInfo);
export const useSetWorktreePromptData = () => useFlowAppStore(state => state.setWorktreePromptData);

// AI Actions
export const useUpdateAI = () => useFlowAppStore(state => state.updateAI);
export const useSetMessages = () => useFlowAppStore(state => state.setMessages);
export const useAddMessage = () => useFlowAppStore(state => state.addMessage);
export const useClearMessages = () => useFlowAppStore(state => state.clearMessages);
export const useSetCurrentModel = () => useFlowAppStore(state => state.setCurrentModel);
export const useSetCurrentBackend = () => useFlowAppStore(state => state.setCurrentBackend);

// Meta Actions
export const useSetVersion = () => useFlowAppStore(state => state.setVersion);

// Compound Actions
export const useResetAppState = () => useFlowAppStore(state => state.resetAppState);
export const useInitializeApp = () => useFlowAppStore(state => state.initializeApp);
export const useSyncFromLegacyState = () => useFlowAppStore(state => state.syncFromLegacyState);

// === COMBINED SELECTORS ===
// For components that need related state and actions together

export const useNavigationState = () => {
  const navigation = useNavigation();
  const actions = useNavigationActions();
  return { ...navigation, ...actions };
};

export const useInputState = () => {
  const input = useInput();
  const actions = useInputActions();
  return { ...input, ...actions };
};

export const useTaskState = () => {
  const tasks = useTasks();
  const actions = useTaskActions();
  return { ...tasks, ...actions };
};

export const useUIState = () => {
  const ui = useUI();
  const actions = useUIActions();
  return { ...ui, ...actions };
};

export const useModalState = () => {
  const modals = useModals();
  const actions = useModalActions();
  return { ...modals, ...actions };
};

export const useGitState = () => {
  const git = useGit();
  const actions = useGitActions();
  const formattedRemoteUrl = useFormattedRemoteUrl();
  return { ...git, formattedRemoteUrl, ...actions };
};

export const useAIState = () => {
  const ai = useAI();
  const actions = useAIActions();
  return { ...ai, ...actions };
};

// === MIGRATION HELPERS ===
// Temporary hooks to ease migration

export const useLegacyStateSync = () => {
  const { syncFromLegacyState } = useCompoundActions();
  return { syncFromLegacyState };
}; 