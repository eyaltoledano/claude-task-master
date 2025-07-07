import { useState, useEffect, useRef, useCallback } from 'react';

export function useProviders(options = {}) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [healthCheckProgress, setHealthCheckProgress] = useState(0);
  const [lastHealthCheck, setLastHealthCheck] = useState(null);
  const [error, setError] = useState(null);
  
  const isMountedRef = useRef(true);
  const healthCheckIntervalRef = useRef(null);
  
  // Configuration with your existing registry defaults
  const healthCheckInterval = options.healthCheckInterval || 30000; // From registryConfig
  const enableAutoHealthCheck = options.enableAutoHealthCheck !== false;

  const performHealthChecks = useCallback(async (providerList) => {
    if (!isMountedRef.current) return;
    
    try {
      setHealthCheckProgress(0);
      
      // Use existing registry health check method
      const { globalRegistry } = await import('../providers/registry.js');
      const healthResults = await globalRegistry.checkAllProvidersHealth();
      
      if (!isMountedRef.current) return;
      
      // Update providers with health results
      setProviders(prevProviders => {
        return prevProviders.map(provider => {
          const healthResult = healthResults.find(r => r.provider === provider.key);
          return {
            ...provider,
            health: healthResult,
            lastHealthCheck: healthResult?.checkedAt
          };
        });
      });
      
      setHealthCheckProgress(100);
      setLastHealthCheck(new Date().toISOString());
      
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Health check failed:', err);
        setError(`Health check failed: ${err.message}`);
      }
    }
  }, []);

  const loadProvidersWithHealth = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get available providers from existing registry
      const { listAvailableProviders } = await import('../providers/registry.js');
      const availableProviders = listAvailableProviders();
      setProviders(availableProviders);
      
      // Perform health checks if enabled
      if (enableAutoHealthCheck) {
        await performHealthChecks(availableProviders);
      }
      
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Failed to load providers:', err);
        setError(err.message);
        
        // Fallback to mock data
        const mockProviders = [
          {
            key: 'e2b',
            name: 'E2B',
            type: 'cloud',
            health: { success: true, message: 'Operational' },
            capabilities: {
              languages: ['javascript', 'typescript', 'python'],
              features: { execution: true, streaming: true, gpu: false }
            },
            isDefault: true
          },
          {
            key: 'modal',
            name: 'Modal Labs',
            type: 'cloud',
            health: { success: true, message: 'Operational' },
            capabilities: {
              languages: ['python', 'javascript'],
              features: { execution: true, streaming: true, gpu: true }
            },
            isDefault: false
          }
        ];
        setProviders(mockProviders);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [enableAutoHealthCheck, performHealthChecks]);

  const refreshProviderHealth = useCallback(async (providerKey = null) => {
    if (!isMountedRef.current) return;
    
    try {
      const { checkProviderHealth } = await import('../providers/registry.js');
      
      if (providerKey) {
        // Check single provider
        const healthResult = await checkProviderHealth(providerKey);
        
        if (isMountedRef.current) {
          setProviders(prev => prev.map(p => 
            p.key === providerKey 
              ? { ...p, health: healthResult, lastHealthCheck: healthResult.checkedAt }
              : p
          ));
        }
      } else {
        // Check all providers
        await performHealthChecks(providers);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Provider health refresh failed:', err);
        setError(`Health refresh failed: ${err.message}`);
      }
    }
  }, [providers, performHealthChecks]);

  // Load providers on mount and set up periodic health checks
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial load
    loadProvidersWithHealth();
    
    // Set up periodic health checks
    if (enableAutoHealthCheck && healthCheckInterval > 0) {
      healthCheckIntervalRef.current = setInterval(() => {
        if (isMountedRef.current && providers.length > 0) {
          performHealthChecks(providers);
        }
      }, healthCheckInterval);
    }
    
    return () => {
      isMountedRef.current = false;
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [loadProvidersWithHealth, enableAutoHealthCheck, healthCheckInterval, providers, performHealthChecks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    providers,
    loading,
    healthCheckProgress,
    lastHealthCheck,
    error,
    refreshHealth: refreshProviderHealth,
    refetch: loadProvidersWithHealth
  };
} 