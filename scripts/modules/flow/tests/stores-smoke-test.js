#!/usr/bin/env node

/**
 * Smoke test for Zustand stores
 * Verifies that all stores can be imported and basic operations work
 */

import { 
  useUIStore, 
  useDataStore, 
  usePreferencesStore, 
  useNavigationStore,
  resetAllStores 
} from '../stores/index.js';

console.log('🧪 Running Zustand Stores Smoke Test...\n');

(async () => {
try {
  // Test 1: Store Imports
  console.log('✅ 1. All stores imported successfully');

  // Test 2: UI Store Basic Operations
  const uiStore = useUIStore.getState();
  uiStore.setCurrentScreen('test-screen');
  uiStore.setLoading(false);
  uiStore.showNotification('Test notification', 'success');
  
  const currentScreen = useUIStore.getState().currentScreen;
  const loading = useUIStore.getState().loading;
  const notification = useUIStore.getState().notification;
  
  if (currentScreen === 'test-screen' && !loading && notification?.message === 'Test notification') {
    console.log('✅ 2. UI Store operations working correctly');
  } else {
    throw new Error('UI Store operations failed');
  }

  // Test 3: Data Store Basic Operations
  const dataStore = useDataStore.getState();
  const testTasks = [
    { id: '1', title: 'Test Task 1', status: 'pending' },
    { id: '2', title: 'Test Task 2', status: 'done' }
  ];
  
  dataStore.setTasks(testTasks);
  dataStore.setCurrentTag('test-tag');
  dataStore.setCurrentBranch('test-branch');
  
  const tasks = useDataStore.getState().tasks;
  const currentTag = useDataStore.getState().currentTag;
  const currentBranch = useDataStore.getState().currentBranch;
  
  if (tasks.length === 2 && currentTag === 'test-tag' && currentBranch === 'test-branch') {
    console.log('✅ 3. Data Store operations working correctly');
  } else {
    throw new Error('Data Store operations failed');
  }

  // Test 4: Preferences Store Basic Operations
  const prefsStore = usePreferencesStore.getState();
  prefsStore.setCurrentTheme('dark');
  prefsStore.setCurrentBackend('mcp');
  
  const theme = usePreferencesStore.getState().currentTheme;
  const backend = usePreferencesStore.getState().currentBackend;
  
  if (theme === 'dark' && backend === 'mcp') {
    console.log('✅ 4. Preferences Store operations working correctly');
  } else {
    throw new Error('Preferences Store operations failed');
  }

  // Test 5: Navigation Store Basic Operations
  const navStore = useNavigationStore.getState();
  navStore.navigateTo('screen1');
  navStore.navigateTo('screen2');
  navStore.goBack();
  
  const navState = useNavigationStore.getState();
  const currentScreenFromNav = navState.history[navState.currentIndex];
  const canGoBack = navState.canGoBack;
  const canGoForward = navState.canGoForward;
  
  // After navigating welcome -> screen1 -> screen2 -> goBack()
  // We should be at screen1 (index 1), can go back to welcome, can go forward to screen2
  if (currentScreenFromNav === 'screen1' && canGoBack && canGoForward) {
    console.log('✅ 5. Navigation Store operations working correctly');
  } else {
    console.log(`Debug: current screen: ${currentScreenFromNav}, canGoBack: ${canGoBack}, canGoForward: ${canGoForward}`);
    console.log(`Debug: history: ${JSON.stringify(navState.history)}, currentIndex: ${navState.currentIndex}`);
    throw new Error('Navigation Store operations failed');
  }

  // Test 6: Store Reset
  console.log('About to reset all stores...');
  await resetAllStores();
  console.log('Reset completed, getting states...');
  
  const resetUIState = useUIStore.getState();
  const resetDataState = useDataStore.getState();
  const resetPrefsState = usePreferencesStore.getState();
  const resetNavState = useNavigationStore.getState();
  
  const resetUIScreen = resetUIState.currentScreen;
  const resetTasks = resetDataState.tasks;
  const resetTheme = resetPrefsState.currentTheme;
  const resetNavHistory = resetNavState.history;
  
  if (resetUIScreen === 'welcome' && resetTasks.length === 0 && 
      resetTheme === 'auto' && resetNavHistory.length === 1) {
    console.log('✅ 6. Store reset functionality working correctly');
  } else {
    throw new Error('Store reset failed');
  }

  console.log('\n🎉 All smoke tests passed! Zustand state refactor is working correctly.\n');

  // Performance Test
  console.log('⚡ Running performance test...');
  const startTime = performance.now();
  
  // Simulate rapid state changes
  const uiActions = useUIStore.getState();
  const dataActions = useDataStore.getState();
  const prefsActions = usePreferencesStore.getState();
  
  for (let i = 0; i < 1000; i++) {
    uiActions.setInputValue(`test-${i}`);
    dataActions.setCurrentTag(`tag-${i % 10}`);
    prefsActions.setCurrentTheme(i % 2 === 0 ? 'dark' : 'light');
  }
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`✅ Performance test: 3000 state changes completed in ${duration.toFixed(2)}ms`);
  
  if (duration < 100) {
    console.log('✅ Excellent performance!');
  } else if (duration < 500) {
    console.log('✅ Good performance');
  } else {
    console.log('⚠️  Performance could be improved');
  }

} catch (error) {
  console.error('❌ Smoke test failed:', error.message);
  process.exit(1);
}
})();