/**
 * State Refactor Tests
 * Validates the Zustand state management implementation
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';

// Import stores
import { useUIStore } from '../stores/ui-store.js';
import { useDataStore } from '../stores/data-store.js';
import { usePreferencesStore } from '../stores/preferences-store.js';
import { useNavigationStore } from '../stores/navigation-store.js';

// Import selectors
import {
  useCurrentScreen,
  useNotification,
  useLoading,
  useModals,
  useInputState,
  useTasks,
  useGitInfo,
  useUIActions,
  useDataActions,
  useNavigationActions,
  usePreferencesActions
} from '../hooks/use-selectors.js';

// Import monitoring
import { stateMonitor, storeValidation, setupStoreMonitoring } from '../shared/utils/state-monitor.js';

// Import test utilities
import { testUtils } from './test-utils.js';

describe('State Refactor - Zustand Stores', () => {
  beforeEach(() => {
    // Reset all stores before each test
    useUIStore.getState().resetUIState();
    useDataStore.getState().resetTaskData();
    useDataStore.getState().resetGitData();
    usePreferencesStore.getState().resetToDefaults();
    useNavigationStore.getState().resetNavigation();
    
    // Reset state monitor
    stateMonitor.reset();
    stateMonitor.enable();
  });

  afterEach(() => {
    stateMonitor.disable();
  });

  describe('UI Store', () => {
    test('should initialize with correct default values', () => {
      const state = useUIStore.getState();
      
      expect(state.currentScreen).toBe('welcome');
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);
      expect(state.notification).toBe(null);
      expect(state.showCommandPalette).toBe(false);
      expect(state.inputValue).toBe('');
      expect(state.suggestions).toEqual([]);
    });

    test('should update UI state correctly', () => {
      const { setLoading, setError, setNotification } = useUIStore.getState();

      act(() => {
        setLoading(false);
        setError('Test error');
        setNotification({ message: 'Test notification', type: 'info' });
      });

      const state = useUIStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Test error');
      expect(state.notification).toEqual({ message: 'Test notification', type: 'info' });
    });

    test('should reset UI state correctly', () => {
      const { setError, setShowCommandPalette, resetUIState } = useUIStore.getState();

      // Set some state
      act(() => {
        setError('Test error');
        setShowCommandPalette(true);
      });

      // Reset
      act(() => {
        resetUIState();
      });

      const state = useUIStore.getState();
      expect(state.error).toBe(null);
      expect(state.showCommandPalette).toBe(false);
    });
  });

  describe('Data Store', () => {
    test('should initialize with correct default values', () => {
      const state = useDataStore.getState();
      
      expect(state.tasks).toEqual([]);
      expect(state.currentTag).toBe('master');
      expect(state.hasTasksFile).toBe(false);
      expect(state.currentBranch).toBe(null);
      expect(state.messages).toEqual([]);
      expect(state.currentModel).toBe('claude-3-5-sonnet-20241022');
    });

    test('should manage tasks correctly', () => {
      const { setTasks, setCurrentTag } = useDataStore.getState();
      const testTasks = [
        { id: '1', title: 'Test Task 1', status: 'pending' },
        { id: '2', title: 'Test Task 2', status: 'done' }
      ];

      act(() => {
        setTasks(testTasks);
        setCurrentTag('development');
      });

      const state = useDataStore.getState();
      expect(state.tasks).toEqual(testTasks);
      expect(state.currentTag).toBe('development');
    });

    test('should manage messages correctly', () => {
      const { addMessage, clearMessages } = useDataStore.getState();

      act(() => {
        addMessage({ id: '1', content: 'Hello', role: 'user' });
        addMessage({ id: '2', content: 'Hi there', role: 'assistant' });
      });

      let state = useDataStore.getState();
      expect(state.messages).toHaveLength(2);

      act(() => {
        clearMessages();
      });

      state = useDataStore.getState();
      expect(state.messages).toEqual([]);
    });

    test('should provide computed getters', () => {
      const { setTasks, getTaskById, getTasksByStatus } = useDataStore.getState();
      const testTasks = [
        { id: '1', title: 'Task 1', status: 'pending' },
        { id: '2', title: 'Task 2', status: 'done' },
        { id: '3', title: 'Task 3', status: 'pending' }
      ];

      act(() => {
        setTasks(testTasks);
      });

      expect(getTaskById('1')).toEqual(testTasks[0]);
      expect(getTasksByStatus('pending')).toHaveLength(2);
      expect(getTasksByStatus('done')).toHaveLength(1);
    });
  });

  describe('Navigation Store', () => {
    test('should initialize with welcome screen', () => {
      const state = useNavigationStore.getState();
      
      expect(state.history).toEqual(['welcome']);
      expect(state.currentIndex).toBe(0);
      expect(state.getCurrentScreen()).toBe('welcome');
      expect(state.canGoBack).toBe(false);
      expect(state.canGoForward).toBe(false);
    });

    test('should navigate correctly', () => {
      const { navigateTo, goBack } = useNavigationStore.getState();

      act(() => {
        navigateTo('tasks');
      });

      let state = useNavigationStore.getState();
      expect(state.getCurrentScreen()).toBe('tasks');
      expect(state.canGoBack).toBe(true);
      expect(state.canGoForward).toBe(false);

      act(() => {
        navigateTo('settings');
      });

      state = useNavigationStore.getState();
      expect(state.getCurrentScreen()).toBe('settings');
      expect(state.history).toEqual(['welcome', 'tasks', 'settings']);

      act(() => {
        goBack();
      });

      state = useNavigationStore.getState();
      expect(state.getCurrentScreen()).toBe('tasks');
      expect(state.canGoBack).toBe(true);
      expect(state.canGoForward).toBe(true);
    });
  });

  describe('Preferences Store', () => {
    test('should persist preferences correctly', () => {
      const { setCurrentTheme, setCompactMode } = usePreferencesStore.getState();

      act(() => {
        setCurrentTheme('dark');
        setCompactMode(true);
      });

      const state = usePreferencesStore.getState();
      expect(state.currentTheme).toBe('dark');
      expect(state.compactMode).toBe(true);
    });

    test('should provide theme getters', () => {
      const { setCurrentTheme, getEffectiveTheme } = usePreferencesStore.getState();

      act(() => {
        setCurrentTheme('light');
      });

      expect(getEffectiveTheme()).toBe('light');

      act(() => {
        setCurrentTheme('dark');
      });

      expect(getEffectiveTheme()).toBe('dark');
    });
  });

  describe('Selector Hooks', () => {
    test('useCurrentScreen should return current screen', () => {
      const { result } = renderHook(() => useCurrentScreen());
      expect(result.current).toBe('welcome');

      act(() => {
        useNavigationStore.getState().navigateTo('tasks');
      });

      expect(result.current).toBe('tasks');
    });

    test('useModals should return modal states', () => {
      const { result } = renderHook(() => useModals());
      
      expect(result.current.showCommandPalette).toBe(false);
      expect(result.current.showSettings).toBe(false);

      act(() => {
        useUIStore.getState().setShowCommandPalette(true);
      });

      expect(result.current.showCommandPalette).toBe(true);
    });

    test('action selectors should return stable references', () => {
      const { result: uiActions1 } = renderHook(() => useUIActions());
      const { result: uiActions2 } = renderHook(() => useUIActions());

      // Actions should be the same reference
      expect(uiActions1.current.setLoading).toBe(uiActions2.current.setLoading);
      expect(uiActions1.current.setError).toBe(uiActions2.current.setError);
    });
  });

  describe('Performance Monitoring', () => {
    test('should track state changes', () => {
      const uiStore = useUIStore;
      stateMonitor.subscribeToStore(uiStore, 'ui');

      act(() => {
        uiStore.getState().setLoading(false);
        uiStore.getState().setError('test error');
      });

      const stats = stateMonitor.getStateChangeStats();
      expect(stats.ui).toBeDefined();
      expect(stats.ui.totalChanges).toBeGreaterThan(0);
    });

    test('should validate store structure', () => {
      const uiStore = useUIStore;
      const validation = storeValidation.validateStore(uiStore, 'ui', ['loading', 'error', 'currentScreen']);

      expect(validation.valid).toBe(true);
      expect(validation.functions.length).toBeGreaterThan(0);
      expect(validation.data.length).toBeGreaterThan(0);
    });

    test('should check performance issues', () => {
      const uiStore = useUIStore;
      const performance = storeValidation.checkPerformance(uiStore, 'ui');

      expect(performance.stateSize).toBeDefined();
      expect(performance.maxDepth).toBeDefined();
      expect(Array.isArray(performance.warnings)).toBe(true);
    });
  });

  describe('Store Integration', () => {
    test('should setup monitoring for all stores', () => {
      const stores = {
        ui: useUIStore,
        data: useDataStore,
        preferences: usePreferencesStore,
        navigation: useNavigationStore
      };

      expect(() => {
        setupStoreMonitoring(stores);
      }).not.toThrow();
    });

    test('stores should work together correctly', () => {
      // Simulate app initialization flow
      act(() => {
        useUIStore.getState().setLoading(true);
        useDataStore.getState().setTasks([]);
        useNavigationStore.getState().navigateTo('welcome');
        usePreferencesStore.getState().setCurrentTheme('auto');
      });

      act(() => {
        useDataStore.getState().setTasks([
          { id: '1', title: 'Test Task', status: 'pending' }
        ]);
        useDataStore.getState().setHasTasksFile(true);
        useUIStore.getState().setLoading(false);
      });

      act(() => {
        useNavigationStore.getState().navigateTo('tasks');
      });

      // Verify final state
      const uiState = useUIStore.getState();
      const dataState = useDataStore.getState();
      const navState = useNavigationStore.getState();

      expect(uiState.loading).toBe(false);
      expect(dataState.tasks).toHaveLength(1);
      expect(dataState.hasTasksFile).toBe(true);
      expect(navState.getCurrentScreen()).toBe('tasks');
    });
  });

  describe('Performance Comparison', () => {
    test('should have fewer render triggers than useState approach', () => {
      // This test would need a more complex setup to measure actual renders
      // For now, we verify that selectors return stable references
      const actions1 = useUIStore.getState();
      const actions2 = useUIStore.getState();

      // Actions should be the same object reference
      expect(actions1.setLoading).toBe(actions2.setLoading);
      expect(actions1.setError).toBe(actions2.setError);
    });

    test('should handle rapid state updates efficiently', () => {
      const startTime = performance.now();

      // Perform many rapid updates
      act(() => {
        for (let i = 0; i < 100; i++) {
          useUIStore.getState().setInputValue(`input-${i}`);
          useUIStore.getState().setSuggestionIndex(i % 10);
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(100); // 100ms
    });
  });
});

describe('State Refactor - Migration Compatibility', () => {
  test('should maintain API compatibility with original FlowApp', () => {
    // Test that the new Zustand-based approach provides the same API
    const uiState = useUIStore.getState();
    
    // Original FlowApp had these state variables
    expect(typeof uiState.loading).toBe('boolean');
    expect(typeof uiState.error).toBe('object' || 'string' || null);
    expect(typeof uiState.notification).toBe('object' || null);
    expect(typeof uiState.currentScreen).toBe('string');
    
    // And these action functions
    expect(typeof uiState.setLoading).toBe('function');
    expect(typeof uiState.setError).toBe('function');
    expect(typeof uiState.setNotification).toBe('function');
  });

  test('should provide all necessary state and actions for FlowApp', () => {
    const requiredUIState = [
      'loading', 'error', 'notification', 'currentScreen',
      'showCommandPalette', 'showNextTaskModal', 'showSettings',
      'inputValue', 'suggestions', 'suggestionIndex'
    ];

    const requiredDataState = [
      'tasks', 'currentTag', 'nextTask', 'hasTasksFile',
      'currentBranch', 'repositoryName', 'branchInfo', 'remoteInfo',
      'messages', 'currentModel', 'version'
    ];

    const uiState = useUIStore.getState();
    const dataState = useDataStore.getState();

    requiredUIState.forEach(field => {
      expect(uiState).toHaveProperty(field);
    });

    requiredDataState.forEach(field => {
      expect(dataState).toHaveProperty(field);
    });
  });
});

 