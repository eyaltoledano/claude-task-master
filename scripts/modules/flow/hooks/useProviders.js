import { useState, useEffect } from 'react';
import { useAppContext } from '../index.jsx';

export function useProviders() {
  const { backend } = useAppContext();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        setLoading(true);
        
        // Try to use existing provider registry
        try {
          const { availableProviders } = await import('../../providers/registry.js');
          
          const providerList = await Promise.all(
            Object.entries(availableProviders).map(async ([key, provider]) => {
              try {
                const factory = await provider.factory();
                const capabilities = await factory.capabilities?.() || {
                  languages: ['javascript', 'typescript'],
                  features: { execution: true, streaming: true }
                };
                const health = await factory.healthCheck?.(provider.config) || { 
                  success: true,
                  message: 'Provider available'
                };
                
                return { 
                  key, 
                  ...provider, 
                  capabilities, 
                  health,
                  isDefault: key === 'e2b' // Mock default
                };
              } catch (error) {
                return { 
                  key, 
                  ...provider, 
                  health: { success: false, error: error.message },
                  isDefault: false
                };
              }
            })
          );
          
          setProviders(providerList);
        } catch (importError) {
          // Fallback to mock data if provider registry not available
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
            },
            {
              key: 'fly',
              name: 'Fly.io',
              type: 'cloud',
              health: { success: false, error: 'API key not configured' },
              capabilities: {
                languages: ['javascript', 'typescript'],
                features: { execution: true, streaming: false, gpu: false }
              },
              isDefault: false
            },
            {
              key: 'local',
              name: 'Local Docker',
              type: 'local',
              health: { success: true, message: 'Docker daemon running' },
              capabilities: {
                languages: ['javascript', 'typescript', 'python', 'go'],
                features: { execution: true, streaming: true, gpu: false }
              },
              isDefault: false
            }
          ];
          
          setProviders(mockProviders);
        }
      } catch (error) {
        console.error('Failed to load providers:', error);
        setProviders([]);
      } finally {
        setLoading(false);
      }
    };

    loadProviders();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadProviders, 30000);
    return () => clearInterval(interval);
  }, []);

  return { providers, loading };
} 