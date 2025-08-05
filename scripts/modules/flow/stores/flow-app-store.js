import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const useFlowAppStore = create(
  subscribeWithSelector((set, get) => ({
    // === STATE DOMAINS ===
    
    // Navigation & Screen State
    navigation: {
      currentScreen: 'welcome',
      navigationData: null,
      inputKey: 0,
    },
    
    // Input & Interaction State
    input: {
      value: '',
      suggestions: [],
      suggestionIndex: 0,
      waitingForShortcut: false,
    },
    
    // Task Data State
    tasks: {
      list: [],
      currentTag: 'master',
      hasFile: false,
      nextTask: null,
    },
    
    // UI State
    ui: {
      loading: true,
      error: null,
      notification: null,
      currentTheme: 'auto',
    },
    
    // Modal State
    modals: {
      showCommandPalette: false,
      showNextTaskModal: false,
      showSettings: false,
      showWorktreePrompt: false,
    },
    
    // Git State
    git: {
      currentBranch: null,
      repositoryName: null,
      branchInfo: null,
      remoteInfo: null,
      worktreePromptData: null,
    },
    
    // AI/Chat State
    ai: {
      messages: [],
      currentModel: 'claude-3-5-sonnet-20241022',
      currentBackend: null,
    },
    
    // App Meta State
    meta: {
      version: '',
    },

    // === ATOMIC ACTIONS ===
    
    // Navigation Actions
    setCurrentScreen: (screen, data = null) => set(state => ({
      navigation: {
        ...state.navigation,
        currentScreen: screen,
        navigationData: data
      }
    })),
    
    setNavigationData: (data) => set(state => ({
      navigation: { ...state.navigation, navigationData: data }
    })),
    
    incrementInputKey: () => set(state => ({
      navigation: { ...state.navigation, inputKey: state.navigation.inputKey + 1 }
    })),
    
    // Input Actions
    updateInput: (updates) => set(state => ({
      input: { ...state.input, ...updates }
    })),
    
    setInputValue: (value) => set(state => ({
      input: { ...state.input, value }
    })),
    
    setSuggestions: (suggestions, index = 0) => set(state => ({
      input: { 
        ...state.input, 
        suggestions, 
        suggestionIndex: index 
      }
    })),
    
    setSuggestionIndex: (index) => set(state => ({
      input: { ...state.input, suggestionIndex: index }
    })),
    
    setWaitingForShortcut: (waiting) => set(state => ({
      input: { ...state.input, waitingForShortcut: waiting }
    })),
    
    resetInput: () => set(state => ({
      input: { 
        ...state.input, 
        value: '', 
        suggestions: [], 
        suggestionIndex: 0 
      },
      navigation: { 
        ...state.navigation, 
        inputKey: state.navigation.inputKey + 1 
      }
    })),
    
    // Task Actions
    updateTasks: (updates) => set(state => ({
      tasks: { ...state.tasks, ...updates }
    })),
    
    setTasks: (list) => set(state => ({
      tasks: { ...state.tasks, list }
    })),
    
    setCurrentTag: (tag) => set(state => ({
      tasks: { ...state.tasks, currentTag: tag }
    })),
    
    setHasTasksFile: (hasFile) => set(state => ({
      tasks: { ...state.tasks, hasFile }
    })),
    
    setNextTask: (task) => set(state => ({
      tasks: { ...state.tasks, nextTask: task }
    })),
    
    // UI Actions
    updateUI: (updates) => set(state => ({
      ui: { ...state.ui, ...updates }
    })),
    
    setLoading: (loading) => set(state => ({
      ui: { ...state.ui, loading }
    })),
    
    setError: (error) => set(state => ({
      ui: { ...state.ui, error }
    })),
    
    clearError: () => set(state => ({
      ui: { ...state.ui, error: null }
    })),
    
    setNotification: (notification) => set(state => ({
      ui: { ...state.ui, notification }
    })),
    
    clearNotification: () => set(state => ({
      ui: { ...state.ui, notification: null }
    })),
    
    setCurrentTheme: (theme) => set(state => ({
      ui: { ...state.ui, currentTheme: theme }
    })),
    
    // Modal Actions
    updateModals: (updates) => set(state => ({
      modals: { ...state.modals, ...updates }
    })),
    
    setShowCommandPalette: (show) => set(state => ({
      modals: { ...state.modals, showCommandPalette: show }
    })),
    
    setShowNextTaskModal: (show) => set(state => ({
      modals: { ...state.modals, showNextTaskModal: show }
    })),
    
    setShowSettings: (show) => set(state => ({
      modals: { ...state.modals, showSettings: show }
    })),
    
    setShowWorktreePrompt: (show) => set(state => ({
      modals: { ...state.modals, showWorktreePrompt: show }
    })),
    
    toggleModal: (modalName) => set(state => ({
      modals: {
        ...state.modals,
        [modalName]: !state.modals[modalName]
      }
    })),
    
    closeAllModals: () => set(state => ({
      modals: {
        showCommandPalette: false,
        showNextTaskModal: false,
        showSettings: false,
        showWorktreePrompt: false,
      }
    })),
    
    // Git Actions
    updateGit: (updates) => set(state => ({
      git: { ...state.git, ...updates }
    })),
    
    setCurrentBranch: (branch) => set(state => ({
      git: { ...state.git, currentBranch: branch }
    })),
    
    setRepositoryName: (name) => set(state => ({
      git: { ...state.git, repositoryName: name }
    })),
    
    setBranchInfo: (branchInfo) => set(state => ({
      git: {
        ...state.git,
        branchInfo,
        currentBranch: branchInfo?.name || null
      }
    })),
    
    setRemoteInfo: (remoteInfo) => set(state => ({
      git: { ...state.git, remoteInfo }
    })),
    
    setWorktreePromptData: (data) => set(state => ({
      git: { ...state.git, worktreePromptData: data }
    })),
    
    // AI Actions
    updateAI: (updates) => set(state => ({
      ai: { ...state.ai, ...updates }
    })),
    
    setMessages: (messages) => set(state => ({
      ai: { ...state.ai, messages }
    })),
    
    addMessage: (message) => set(state => ({
      ai: {
        ...state.ai,
        messages: [...state.ai.messages, message]
      }
    })),
    
    clearMessages: () => set(state => ({
      ai: { ...state.ai, messages: [] }
    })),
    
    setCurrentModel: (model) => set(state => ({
      ai: { ...state.ai, currentModel: model }
    })),
    
    setCurrentBackend: (backend) => set(state => ({
      ai: { ...state.ai, currentBackend: backend }
    })),
    
    // Meta Actions
    setVersion: (version) => set(state => ({
      meta: { ...state.meta, version }
    })),
    
    // === COMPOUND ACTIONS (update multiple domains atomically) ===
    
    resetAppState: () => set(state => ({
      tasks: { 
        ...state.tasks, 
        list: [], 
        nextTask: null, 
        hasFile: false 
      },
      ui: { 
        ...state.ui, 
        loading: true, 
        error: null,
        notification: null
      },
      ai: { 
        ...state.ai, 
        messages: [] 
      },
      git: { 
        currentBranch: null,
        repositoryName: null,
        branchInfo: null,
        remoteInfo: null,
        worktreePromptData: null
      },
      navigation: {
        ...state.navigation,
        currentScreen: 'welcome',
        navigationData: null
      }
    })),
    
    initializeApp: (initialData) => set(state => ({
      meta: { 
        ...state.meta, 
        version: initialData.version || '' 
      },
      ai: { 
        ...state.ai, 
        currentBackend: initialData.backend 
      },
      ui: { 
        ...state.ui, 
        loading: false 
      }
    })),
    
    // Sync action for migration (temporary)
    syncFromLegacyState: (legacyState) => set(state => ({
      navigation: {
        currentScreen: legacyState.currentScreen || state.navigation.currentScreen,
        navigationData: legacyState.navigationData || state.navigation.navigationData,
        inputKey: legacyState.inputKey || state.navigation.inputKey,
      },
      input: {
        value: legacyState.inputValue || state.input.value,
        suggestions: legacyState.suggestions || state.input.suggestions,
        suggestionIndex: legacyState.suggestionIndex || state.input.suggestionIndex,
        waitingForShortcut: legacyState.waitingForShortcut || state.input.waitingForShortcut,
      },
      tasks: {
        list: legacyState.tasks || state.tasks.list,
        currentTag: legacyState.currentTag || state.tasks.currentTag,
        hasFile: legacyState.hasTasksFile !== undefined ? legacyState.hasTasksFile : state.tasks.hasFile,
        nextTask: legacyState.nextTask || state.tasks.nextTask,
      },
      ui: {
        loading: legacyState.loading !== undefined ? legacyState.loading : state.ui.loading,
        error: legacyState.error || state.ui.error,
        notification: legacyState.notification || state.ui.notification,
        currentTheme: legacyState.currentTheme || state.ui.currentTheme,
      },
      modals: {
        showCommandPalette: legacyState.showCommandPalette !== undefined ? legacyState.showCommandPalette : state.modals.showCommandPalette,
        showNextTaskModal: legacyState.showNextTaskModal !== undefined ? legacyState.showNextTaskModal : state.modals.showNextTaskModal,
        showSettings: legacyState.showSettings !== undefined ? legacyState.showSettings : state.modals.showSettings,
        showWorktreePrompt: legacyState.showWorktreePrompt !== undefined ? legacyState.showWorktreePrompt : state.modals.showWorktreePrompt,
      },
      git: {
        currentBranch: legacyState.currentBranch || state.git.currentBranch,
        repositoryName: legacyState.repositoryName || state.git.repositoryName,
        branchInfo: legacyState.branchInfo || state.git.branchInfo,
        remoteInfo: legacyState.remoteInfo || state.git.remoteInfo,
        worktreePromptData: legacyState.worktreePromptData || state.git.worktreePromptData,
      },
      ai: {
        messages: legacyState.messages || state.ai.messages,
        currentModel: legacyState.currentModel || state.ai.currentModel,
        currentBackend: legacyState.currentBackend || state.ai.currentBackend,
      },
      meta: {
        version: legacyState.version || state.meta.version,
      }
    }))
  }))
);

// Utility to get current state outside React components
export const getFlowAppState = () => useFlowAppStore.getState();

// Debug helper for development
export const logFlowAppState = () => {
  console.log('FlowApp State:', getFlowAppState());
}; 