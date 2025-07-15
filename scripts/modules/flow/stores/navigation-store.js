import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export const useNavigationStore = create(
  subscribeWithSelector((set, get) => ({
    // Navigation State
    history: ['welcome'],
    currentIndex: 0,
    navigationData: null,
    
    // Navigation metadata
    canGoBack: false,
    canGoForward: false,
    
    // Actions
    navigateTo: (screen, data = null) => set(state => {
      // If navigating to the same screen, just update data
      if (state.history[state.currentIndex] === screen) {
        return { navigationData: data };
      }
      
      // Create new history by removing any forward history and adding new screen
      const newHistory = state.history.slice(0, state.currentIndex + 1);
      newHistory.push(screen);
      const newIndex = newHistory.length - 1;
      
      return {
        history: newHistory,
        currentIndex: newIndex,
        navigationData: data,
        canGoBack: newIndex > 0,
        canGoForward: false // Always false when navigating to new screen
      };
    }),
    
    goBack: () => set(state => {
      if (state.currentIndex > 0) {
        const newIndex = state.currentIndex - 1;
        return { 
          currentIndex: newIndex,
          navigationData: null, // Clear navigation data when going back
          canGoBack: newIndex > 0,
          canGoForward: true
        };
      }
      return state;
    }),
    
    goForward: () => set(state => {
      if (state.currentIndex < state.history.length - 1) {
        const newIndex = state.currentIndex + 1;
        return { 
          currentIndex: newIndex,
          navigationData: null, // Clear navigation data when going forward
          canGoBack: true,
          canGoForward: newIndex < state.history.length - 1
        };
      }
      return state;
    }),
    
    // Replace current screen in history (useful for redirects)
    replaceCurrent: (screen, data = null) => set(state => {
      const newHistory = [...state.history];
      newHistory[state.currentIndex] = screen;
      
      return {
        history: newHistory,
        navigationData: data
      };
    }),
    
    // Clear navigation history and start fresh
    resetNavigation: (initialScreen = 'welcome') => set({
      history: [initialScreen],
      currentIndex: 0,
      navigationData: null,
      canGoBack: false,
      canGoForward: false
    }),
    
    // Set navigation data without changing screen
    setNavigationData: (data) => set({ navigationData: data }),
    
    // Clear navigation data
    clearNavigationData: () => set({ navigationData: null }),
    
    // Getters - these need to access state correctly
    getCurrentScreen: () => {
      const state = get();
      return state.history[state.currentIndex] || 'welcome';
    },
    
    getPreviousScreen: () => {
      const state = get();
      if (state.currentIndex > 0) {
        return state.history[state.currentIndex - 1];
      }
      return null;
    },
    
    getNextScreen: () => {
      const state = get();
      if (state.currentIndex < state.history.length - 1) {
        return state.history[state.currentIndex + 1];
      }
      return null;
    },
    
    getHistoryLength: () => {
      const state = get();
      return state.history.length;
    },
    
    // Check if we're on a specific screen  
    isCurrentScreen: (screen) => {
      const state = get();
      const currentScreen = state.history[state.currentIndex] || 'welcome';
      return currentScreen === screen;
    },
    
    // Get breadcrumb trail (useful for UI)
    getBreadcrumb: () => {
      const state = get();
      return state.history.slice(0, state.currentIndex + 1);
    }
  }))
) 