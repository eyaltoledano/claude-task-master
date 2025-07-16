import { useState, useEffect, useCallback, useRef } from 'react';
import { getSyncService, SyncTriggers } from '../services/sync-service.js';

/**
 * Hook for sync status monitoring
 */
export function useSyncStatus(projectRoot, options = {}) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const { refreshInterval = 5000, autoRefresh = true } = options;

  const refreshStatus = useCallback(async () => {
    try {
      setError(null);
      const syncService = getSyncService(projectRoot);
      const currentStatus = await syncService.getStatus();
      setStatus(currentStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectRoot]);

  useEffect(() => {
    refreshStatus();

    if (autoRefresh) {
      intervalRef.current = setInterval(refreshStatus, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshStatus, autoRefresh, refreshInterval]);

  return {
    status,
    loading,
    error,
    refresh: refreshStatus
  };
}

/**
 * Hook for executing sync operations
 */
export function useSync(projectRoot, options = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const executeSync = useCallback(async (direction = 'auto', syncOptions = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await SyncTriggers.manual(projectRoot, direction, {
        ...options,
        ...syncOptions
      });
      
      setLastResult(result);
      return result;
    } catch (err) {
      const errorResult = {
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      };
      setError(err.message);
      setLastResult(errorResult);
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  }, [projectRoot, options]);

  const dryRun = useCallback(async (direction = 'auto') => {
    try {
      const syncService = getSyncService(projectRoot);
      const syncCmd = await syncService.getSyncCommand();
      return await syncCmd.dryRun(direction);
    } catch (err) {
      setError(err.message);
      return { error: err.message };
    }
  }, [projectRoot]);

  return {
    executeSync,
    dryRun,
    isLoading,
    lastResult,
    error
  };
}

/**
 * Hook for auto-sync after operations
 */
export function useAutoSync(projectRoot, options = {}) {
  const syncServiceRef = useRef(null);

  useEffect(() => {
    syncServiceRef.current = getSyncService(projectRoot, options);
  }, [projectRoot, options]);

  const triggerAfterOperation = useCallback(async (operation, context = {}) => {
    if (!syncServiceRef.current) return;
    
    return await syncServiceRef.current.syncAfterOperation(operation, context);
  }, []);

  const triggerAfterTask = useCallback(async (operation, taskData = {}) => {
    return await SyncTriggers.afterTaskOperation(projectRoot, operation, taskData);
  }, [projectRoot]);

  const triggerAfterBulk = useCallback(async (operation, count = 0) => {
    return await SyncTriggers.afterBulkOperation(projectRoot, operation, count);
  }, [projectRoot]);

  const triggerAfterFile = useCallback(async (operation, filePath = '') => {
    return await SyncTriggers.afterFileOperation(projectRoot, operation, filePath);
  }, [projectRoot]);

  const updateConfig = useCallback((newConfig) => {
    if (syncServiceRef.current) {
      syncServiceRef.current.updateConfig(newConfig);
    }
  }, []);

  const setAutoSync = useCallback((enabled) => {
    if (syncServiceRef.current) {
      syncServiceRef.current.setAutoSync(enabled);
    }
  }, []);

  return {
    triggerAfterOperation,
    triggerAfterTask,
    triggerAfterBulk,
    triggerAfterFile,
    updateConfig,
    setAutoSync
  };
}

/**
 * Hook for sync queue monitoring
 */
export function useSyncQueue(projectRoot) {
  const [queueStatus, setQueueStatus] = useState(null);
  const intervalRef = useRef(null);

  const refreshQueue = useCallback(async () => {
    try {
      const syncService = getSyncService(projectRoot);
      const status = await syncService.getQueueStatus();
      setQueueStatus(status);
    } catch (err) {
      console.warn('Failed to refresh sync queue:', err.message);
    }
  }, [projectRoot]);

  useEffect(() => {
    refreshQueue();
    
    // Refresh queue status every 2 seconds
    intervalRef.current = setInterval(refreshQueue, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshQueue]);

  const clearQueue = useCallback(async () => {
    try {
      const syncService = getSyncService(projectRoot);
      syncService.clearQueue();
      await refreshQueue();
    } catch (err) {
      console.warn('Failed to clear sync queue:', err.message);
    }
  }, [projectRoot, refreshQueue]);

  return {
    queueStatus,
    clearQueue,
    refresh: refreshQueue
  };
}

/**
 * Higher-order component for automatic sync after operations
 */
export function withSyncTrigger(projectRoot, operation) {
  return function SyncTriggerWrapper(WrappedComponent) {
    return function SyncTriggerComponent(props) {
      const { triggerAfterOperation } = useAutoSync(projectRoot);

      const handleOperation = useCallback(async (operationFn, context = {}) => {
        const result = await operationFn();
        
        // Trigger sync after successful operation
        if (result && !result.error) {
          await triggerAfterOperation(operation, {
            ...context,
            operationResult: result
          });
        }
        
        return result;
      }, [triggerAfterOperation, operation]);

      return (
        <WrappedComponent
          {...props}
          handleOperation={handleOperation}
        />
      );
    };
  };
}

/**
 * Custom hook for conflict resolution
 */
export function useConflictResolution(projectRoot) {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(false);

  const detectConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const syncService = getSyncService(projectRoot);
      const syncEngine = await syncService.initialize();
      const detectedConflicts = await syncEngine.detectConflicts();
      setConflicts(detectedConflicts);
      return detectedConflicts;
    } catch (error) {
      console.error('Failed to detect conflicts:', error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectRoot]);

  const resolveConflict = useCallback(async (conflictId, resolution, direction = 'auto') => {
    try {
      const result = await SyncTriggers.manual(projectRoot, direction, {
        conflictResolution: resolution,
        conflictId
      });
      
      // Refresh conflicts after resolution
      await detectConflicts();
      
      return result;
    } catch (error) {
      console.error('Failed to resolve conflict:', error.message);
      return { success: false, error: error.message };
    }
  }, [projectRoot, detectConflicts]);

  useEffect(() => {
    detectConflicts();
  }, [detectConflicts]);

  return {
    conflicts,
    loading,
    detectConflicts,
    resolveConflict
  };
} 