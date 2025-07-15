// Zustand Stores Index
// Centralized exports for all state management stores

export { useUIStore } from './ui-store.js';
export { useDataStore } from './data-store.js';
export { usePreferencesStore } from './preferences-store.js';
export { useNavigationStore } from './navigation-store.js';

// Middleware exports
export { createPersistentStore, withPerformanceTracking } from './middleware/persistence.js';

// Store reset utilities
export const resetAllStores = async () => {
  // Import the actual store hooks to avoid circular imports
  const { useUIStore } = await import('./ui-store.js');
  const { useDataStore } = await import('./data-store.js');
  const { usePreferencesStore } = await import('./preferences-store.js');
  const { useNavigationStore } = await import('./navigation-store.js');
  
  useUIStore.getState().resetUIState();
  useDataStore.getState().resetTaskData();
  useDataStore.getState().resetGitData();
  usePreferencesStore.getState().resetToDefaults();
  useNavigationStore.getState().resetNavigation();
};

// Store hydration check
export const checkStoreHydration = async () => {
  const stores = [
    { name: 'Data', store: useDataStore },
    { name: 'Preferences', store: usePreferencesStore }
  ];

  const hydrationStatus = await Promise.allSettled(
    stores.map(({ name, store }) => 
      new Promise((resolve, reject) => {
        const unsubscribe = store.persist?.onFinishHydration?.(() => {
          unsubscribe?.();
          resolve(name);
        });
        
        // Fallback timeout
        setTimeout(() => {
          unsubscribe?.();
          reject(new Error(`${name} store hydration timeout`));
        }, 5000);
      })
    )
  );

  return hydrationStatus;
}; 