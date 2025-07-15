import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'

export const usePreferencesStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // User Preferences
        currentTheme: 'auto',
        currentBackend: null,
        
        // Performance Preferences
        enablePerformanceTracking: false,
        enableMemoryMonitoring: false,
        
        // UI Preferences
        enableAnimations: true,
        compactMode: false,
        showNotifications: true,
        notificationDuration: 3000,
        
        // Developer Preferences
        enableDebugMode: false,
        showRenderCount: false,
        logStateChanges: false,
        
        // Actions
        setCurrentTheme: (theme) => set({ currentTheme: theme }),
        setCurrentBackend: (backend) => set({ currentBackend: backend }),
        
        // Performance Actions
        setPerformanceTracking: (enabled) => set({ enablePerformanceTracking: enabled }),
        setMemoryMonitoring: (enabled) => set({ enableMemoryMonitoring: enabled }),
        
        // UI Actions
        setAnimations: (enabled) => set({ enableAnimations: enabled }),
        setCompactMode: (enabled) => set({ compactMode: enabled }),
        setShowNotifications: (enabled) => set({ showNotifications: enabled }),
        setNotificationDuration: (duration) => set({ notificationDuration: duration }),
        
        // Developer Actions
        setDebugMode: (enabled) => set({ enableDebugMode: enabled }),
        setShowRenderCount: (enabled) => set({ showRenderCount: enabled }),
        setLogStateChanges: (enabled) => set({ logStateChanges: enabled }),
        
        // Utility Actions
        resetToDefaults: () => set({
          currentTheme: 'auto',
          enablePerformanceTracking: false,
          enableMemoryMonitoring: false,
          enableAnimations: true,
          compactMode: false,
          showNotifications: true,
          notificationDuration: 3000,
          enableDebugMode: false,
          showRenderCount: false,
          logStateChanges: false
        }),
        
        // Getters
        isLightTheme: () => {
          const state = get();
          if (state.currentTheme === 'light') return true;
          if (state.currentTheme === 'dark') return false;
          // Auto mode - detect system preference
          if (typeof window !== 'undefined' && window.matchMedia) {
            return !window.matchMedia('(prefers-color-scheme: dark)').matches;
          }
          return true; // Default to light
        },
        
        isDarkTheme: () => {
          const state = get();
          return !state.isLightTheme();
        },
        
        getEffectiveTheme: () => {
          const state = get();
          if (state.currentTheme === 'auto') {
            return state.isLightTheme() ? 'light' : 'dark';
          }
          return state.currentTheme;
        }
      }),
      {
        name: 'taskmaster-preferences',
        version: 1,
        // Persist all preference data
        partialize: (state) => ({
          currentTheme: state.currentTheme,
          enablePerformanceTracking: state.enablePerformanceTracking,
          enableMemoryMonitoring: state.enableMemoryMonitoring,
          enableAnimations: state.enableAnimations,
          compactMode: state.compactMode,
          showNotifications: state.showNotifications,
          notificationDuration: state.notificationDuration,
          enableDebugMode: state.enableDebugMode,
          showRenderCount: state.showRenderCount,
          logStateChanges: state.logStateChanges
        })
      }
    )
  )
) 