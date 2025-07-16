// Using Jest for testing
import { useFlowAppStore, getFlowAppState } from '../../scripts/modules/flow/stores/flow-app-store.js';

describe('FlowApp Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useFlowAppStore.getState().resetAppState();
  });

  describe('State initialization', () => {
    it('should initialize with correct default values', () => {
      const state = getFlowAppState();
      
      expect(state.navigation.currentScreen).toBe('welcome');
      expect(state.input.value).toBe('');
      expect(state.tasks.list).toEqual([]);
      expect(state.tasks.currentTag).toBe('master');
      expect(state.ui.loading).toBe(true);
      expect(state.ui.error).toBe(null);
      expect(state.modals.showCommandPalette).toBe(false);
      expect(state.ai.currentModel).toBe('claude-3-5-sonnet-20241022');
    });
  });

  describe('Navigation actions', () => {
    it('should update current screen and navigation data', () => {
      const { setCurrentScreen } = useFlowAppStore.getState();
      
      setCurrentScreen('tasks', { taskId: '123' });
      
      const state = getFlowAppState();
      expect(state.navigation.currentScreen).toBe('tasks');
      expect(state.navigation.navigationData).toEqual({ taskId: '123' });
    });
  });

  describe('Input actions', () => {
    it('should update input value', () => {
      const { setInputValue } = useFlowAppStore.getState();
      
      setInputValue('test command');
      
      const state = getFlowAppState();
      expect(state.input.value).toBe('test command');
    });

    it('should reset input correctly', () => {
      const { setInputValue, setSuggestions, resetInput } = useFlowAppStore.getState();
      
      // Set some input state
      setInputValue('test');
      setSuggestions(['option1', 'option2'], 1);
      
      let state = getFlowAppState();
      expect(state.input.value).toBe('test');
      expect(state.input.suggestions).toEqual(['option1', 'option2']);
      expect(state.input.suggestionIndex).toBe(1);
      
      // Reset input
      resetInput();
      
      state = getFlowAppState();
      expect(state.input.value).toBe('');
      expect(state.input.suggestions).toEqual([]);
      expect(state.input.suggestionIndex).toBe(0);
    });
  });

  describe('Task actions', () => {
    it('should update task list', () => {
      const { setTasks } = useFlowAppStore.getState();
      
      const mockTasks = [
        { id: 1, title: 'Test task 1', status: 'pending' },
        { id: 2, title: 'Test task 2', status: 'done' }
      ];
      
      setTasks(mockTasks);
      
      const state = getFlowAppState();
      expect(state.tasks.list).toEqual(mockTasks);
    });

    it('should update task metadata atomically', () => {
      const { updateTasks } = useFlowAppStore.getState();
      
      updateTasks({
        currentTag: 'feature-branch',
        hasFile: true,
        nextTask: { id: 5, title: 'Next task' }
      });
      
      const state = getFlowAppState();
      expect(state.tasks.currentTag).toBe('feature-branch');
      expect(state.tasks.hasFile).toBe(true);
      expect(state.tasks.nextTask).toEqual({ id: 5, title: 'Next task' });
    });
  });

  describe('Modal actions', () => {
    it('should toggle modal state', () => {
      const { toggleModal } = useFlowAppStore.getState();
      
      // Initially false
      let state = getFlowAppState();
      expect(state.modals.showCommandPalette).toBe(false);
      
      // Toggle to true
      toggleModal('showCommandPalette');
      state = getFlowAppState();
      expect(state.modals.showCommandPalette).toBe(true);
      
      // Toggle back to false
      toggleModal('showCommandPalette');
      state = getFlowAppState();
      expect(state.modals.showCommandPalette).toBe(false);
    });

    it('should close all modals', () => {
      const { updateModals, closeAllModals } = useFlowAppStore.getState();
      
      // Open multiple modals
      updateModals({
        showCommandPalette: true,
        showSettings: true,
        showNextTaskModal: true
      });
      
      let state = getFlowAppState();
      expect(state.modals.showCommandPalette).toBe(true);
      expect(state.modals.showSettings).toBe(true);
      expect(state.modals.showNextTaskModal).toBe(true);
      
      // Close all
      closeAllModals();
      
      state = getFlowAppState();
      expect(state.modals.showCommandPalette).toBe(false);
      expect(state.modals.showSettings).toBe(false);
      expect(state.modals.showNextTaskModal).toBe(false);
      expect(state.modals.showWorktreePrompt).toBe(false);
    });
  });

  describe('Git actions', () => {
    it('should update branch info and sync current branch', () => {
      const { setBranchInfo } = useFlowAppStore.getState();
      
      const branchInfo = {
        name: 'feature/new-feature',
        upstream: 'origin/feature/new-feature',
        ahead: 2,
        behind: 0
      };
      
      setBranchInfo(branchInfo);
      
      const state = getFlowAppState();
      expect(state.git.branchInfo).toEqual(branchInfo);
      expect(state.git.currentBranch).toBe('feature/new-feature');
    });
  });

  describe('Compound actions', () => {
    it('should reset app state correctly', () => {
      const { 
        setTasks, 
        setError, 
        addMessage, 
        setCurrentBranch,
        resetAppState 
      } = useFlowAppStore.getState();
      
      // Set some state
      setTasks([{ id: 1, title: 'Test' }]);
      setError('Test error');
      addMessage({ id: 1, content: 'Test message' });
      setCurrentBranch('test-branch');
      
      // Reset
      resetAppState();
      
      const state = getFlowAppState();
      expect(state.tasks.list).toEqual([]);
      expect(state.tasks.nextTask).toBe(null);
      expect(state.tasks.hasFile).toBe(false);
      expect(state.ui.loading).toBe(true);
      expect(state.ui.error).toBe(null);
      expect(state.ui.notification).toBe(null);
      expect(state.ai.messages).toEqual([]);
      expect(state.git.currentBranch).toBe(null);
      expect(state.navigation.currentScreen).toBe('welcome');
    });

    it('should sync from legacy state correctly', () => {
      const { syncFromLegacyState } = useFlowAppStore.getState();
      
      const legacyState = {
        currentScreen: 'tasks',
        inputValue: 'test input',
        tasks: [{ id: 1, title: 'Legacy task' }],
        loading: false,
        error: 'Legacy error',
        showCommandPalette: true,
        currentBranch: 'legacy-branch'
      };
      
      syncFromLegacyState(legacyState);
      
      const state = getFlowAppState();
      expect(state.navigation.currentScreen).toBe('tasks');
      expect(state.input.value).toBe('test input');
      expect(state.tasks.list).toEqual([{ id: 1, title: 'Legacy task' }]);
      expect(state.ui.loading).toBe(false);
      expect(state.ui.error).toBe('Legacy error');
      expect(state.modals.showCommandPalette).toBe(true);
      expect(state.git.currentBranch).toBe('legacy-branch');
    });
  });
}); 