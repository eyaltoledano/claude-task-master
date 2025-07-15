import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Creates a standardized persistence configuration for Zustand stores
 * @param {string} name - Storage key name
 * @param {function} partialize - Function to select which state to persist
 * @param {number} version - Current version for migration support
 * @param {function} migrate - Migration function for version upgrades
 * @param {object} options - Additional options
 */
export const createPersistentStore = (name, partialize, version = 1, migrate = null, options = {}) => {
  const {
    storage = 'localStorage',
    onRehydrateStorage,
    skipHydration = false,
    merge = undefined
  } = options;

  // Choose storage type
  const storageProvider = storage === 'sessionStorage' ? sessionStorage : localStorage;

  return persist(
    // This will be the store implementation
    {},
    {
      name,
      storage: createJSONStorage(() => storageProvider),
      partialize,
      version,
      migrate: migrate || defaultMigrate,
      skipHydration,
      merge,
      onRehydrateStorage: onRehydrateStorage || defaultOnRehydrateStorage
    }
  );
};

/**
 * Default migration function - logs but doesn't modify state
 */
const defaultMigrate = (persistedState, version) => {
  console.log(`[State Migration] Migrating ${persistedState?.name || 'store'} from version ${version}`);
  return persistedState;
};

/**
 * Default rehydration callback
 */
const defaultOnRehydrateStorage = (name) => {
  return (state, error) => {
    if (error) {
      console.error(`[State Persistence] Failed to rehydrate ${name}:`, error);
    } else {
      console.log(`[State Persistence] Successfully rehydrated ${name}`);
    }
  };
};

/**
 * Migration utilities for common state transformations
 */
export const migrationUtils = {
  // Add new fields with default values
  addFields: (state, fields) => ({
    ...state,
    ...fields
  }),

  // Remove deprecated fields
  removeFields: (state, fieldNames) => {
    const newState = { ...state };
    fieldNames.forEach(field => delete newState[field]);
    return newState;
  },

  // Rename fields
  renameFields: (state, mappings) => {
    const newState = { ...state };
    Object.entries(mappings).forEach(([oldName, newName]) => {
      if (oldName in newState) {
        newState[newName] = newState[oldName];
        delete newState[oldName];
      }
    });
    return newState;
  },

  // Transform field values
  transformFields: (state, transformations) => {
    const newState = { ...state };
    Object.entries(transformations).forEach(([fieldName, transformer]) => {
      if (fieldName in newState) {
        newState[fieldName] = transformer(newState[fieldName]);
      }
    });
    return newState;
  }
};

/**
 * Specific migration functions for different store versions
 */
export const storeMigrations = {
  // Preferences store migrations
  preferences: {
    // Version 1 -> 2: Add new UI preferences
    v1_to_v2: (state) => migrationUtils.addFields(state, {
      enableAnimations: true,
      compactMode: false,
      showNotifications: true,
      notificationDuration: 3000
    }),

    // Version 2 -> 3: Add developer preferences
    v2_to_v3: (state) => migrationUtils.addFields(state, {
      enableDebugMode: false,
      showRenderCount: false,
      logStateChanges: false
    })
  },

  // Data store migrations
  data: {
    // Version 1 -> 2: Restructure task data
    v1_to_v2: (state) => {
      if (state.tasks && Array.isArray(state.tasks)) {
        const transformedTasks = state.tasks.map(task => ({
          ...task,
          // Ensure all tasks have required fields
          id: task.id || Math.random().toString(36),
          status: task.status || 'pending',
          createdAt: task.createdAt || new Date().toISOString()
        }));
        
        return {
          ...state,
          tasks: transformedTasks
        };
      }
      return state;
    }
  },

  // UI store migrations (typically doesn't need persistence)
  ui: {
    // UI state is usually ephemeral, but if needed:
    v1_to_v2: (state) => state
  },

  // Navigation store migrations (usually ephemeral)
  navigation: {
    v1_to_v2: (state) => state
  }
};

/**
 * Creates a migration function that handles multiple version upgrades
 * @param {object} migrations - Object with version upgrade functions
 * @param {string} storeName - Name of the store for logging
 */
export const createMigrationChain = (migrations, storeName) => {
  return (persistedState, version) => {
    let state = persistedState;
    let currentVersion = version;

    // Apply migrations in sequence
    const migrationKeys = Object.keys(migrations).sort();
    
    for (const migrationKey of migrationKeys) {
      const [fromVersion, toVersion] = migrationKey.split('_to_').map(v => parseInt(v.replace('v', '')));
      
      if (currentVersion === fromVersion) {
        console.log(`[${storeName}] Migrating from v${fromVersion} to v${toVersion}`);
        state = migrations[migrationKey](state);
        currentVersion = toVersion;
      }
    }

    return state;
  };
};

/**
 * Storage utilities
 */
export const storageUtils = {
  // Clear all persisted state
  clearAll: () => {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('taskmaster-') || key.startsWith('tm-')
    );
    keys.forEach(key => localStorage.removeItem(key));
    console.log(`[Storage] Cleared ${keys.length} persisted state entries`);
  },

  // Clear specific store
  clearStore: (storeName) => {
    localStorage.removeItem(storeName);
    console.log(`[Storage] Cleared ${storeName} store`);
  },

  // Get all persisted stores
  getPersistedStores: () => {
    const stores = {};
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('taskmaster-') || key.startsWith('tm-')) {
        try {
          stores[key] = JSON.parse(localStorage.getItem(key));
        } catch (error) {
          console.warn(`[Storage] Failed to parse ${key}:`, error);
        }
      }
    });
    return stores;
  },

  // Export state for backup
  exportState: () => {
    const stores = storageUtils.getPersistedStores();
    return {
      timestamp: new Date().toISOString(),
      version: '1.0',
      stores
    };
  },

  // Import state from backup
  importState: (backup) => {
    if (!backup.stores) {
      throw new Error('Invalid backup format');
    }

    Object.entries(backup.stores).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });

    console.log(`[Storage] Imported ${Object.keys(backup.stores).length} stores`);
    
    // Reload page to trigger rehydration
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
};

/**
 * Performance monitoring for persistence
 */
export const persistenceMonitor = {
  timers: new Map(),

  startTimer: (operation, storeName) => {
    const key = `${storeName}-${operation}`;
    persistenceMonitor.timers.set(key, performance.now());
  },

  endTimer: (operation, storeName) => {
    const key = `${storeName}-${operation}`;
    const startTime = persistenceMonitor.timers.get(key);
    if (startTime) {
      const duration = performance.now() - startTime;
      console.log(`[Persistence] ${storeName} ${operation} took ${duration.toFixed(2)}ms`);
      persistenceMonitor.timers.delete(key);
      return duration;
    }
    return 0;
  },

  // Monitor storage usage
  getStorageUsage: () => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate().then(estimate => ({
        quota: estimate.quota,
        usage: estimate.usage,
        usageBreakdown: estimate.usageDetails,
        percentUsed: (estimate.usage / estimate.quota) * 100
      }));
    }
    
    // Fallback for browsers without storage API
    const total = JSON.stringify(localStorage).length;
    return Promise.resolve({
      usage: total,
      quota: 5 * 1024 * 1024, // Assume 5MB default
      percentUsed: (total / (5 * 1024 * 1024)) * 100
    });
  }
};

/**
 * Higher-order function to add performance tracking to any store
 */
export const withPerformanceTracking = (storeCreator) => (set, get, api) => {
  const store = storeCreator(
    (...args) => {
      persistenceMonitor.startTimer('setState', api.name || 'Unknown');
      const result = set(...args);
      persistenceMonitor.endTimer('setState', api.name || 'Unknown');
      return result;
    },
    get,
    api
  );

  return {
    ...store,
    _performanceTracking: true
  };
};