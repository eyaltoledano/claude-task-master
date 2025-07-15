import React, { createContext, useContext, useState, useEffect } from 'react';
import { Text } from 'ink';
import { flowLogger } from '../logging/flow-logger.js';
import { FlowConfigManager } from '../config/managers/flow-config-manager.js';
import { ASTConfigManager } from '../config/managers/ast-config-manager.js';
import { globalRegistry } from '../providers/registry.js';
import { BranchAwarenessManager } from '../services/BranchAwarenessManager.js';
import { getHookManager } from '../hooks/index.js';

/**
 * Service Context for Dependency Injection
 * Provides centralized access to all application services
 */
const ServiceContext = createContext();

/**
 * Service Provider Component
 * Initializes and provides all services to child components
 */
export function ServiceProvider({ children, backend, projectRoot }) {
  const [services, setServices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize logger
        const logger = flowLogger;
        logger.info('Initializing services...');

        // Initialize configuration managers
        const configManager = new FlowConfigManager({ projectRoot });
        const astConfigManager = new ASTConfigManager({ projectRoot });

        // Initialize branch awareness manager
        const branchManager = new BranchAwarenessManager(projectRoot, { backend });

        // Initialize hook manager
        const hookManager = await getHookManager();

        // Get provider registry
        const providerRegistry = globalRegistry;

        // Create unified service container
        const serviceContainer = {
          backend,
          logger,
          configManager,
          astConfigManager,
          branchManager,
          hookManager,
          providerRegistry,
          projectRoot
        };

        logger.info('All services initialized successfully');
        setServices(serviceContainer);
        setLoading(false);
      } catch (err) {
        logger.error('Service initialization failed:', err);
        setError(err);
        setLoading(false);
      }
    };

    initializeServices();
  }, [backend, projectRoot]);

  if (loading) {
    return <Text>Initializing services...</Text>;
  }

  if (error) {
    return <Text color="red">Service initialization failed: {error.message}</Text>;
  }

  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
}

/**
 * Hook to access services from any component
 * @returns {Object} Service container with all services
 */
export function useServices() {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within ServiceProvider');
  }
  return context;
}

/**
 * Hook to access a specific service
 * @param {string} serviceName - Name of the service to access
 * @returns {*} The requested service
 */
export function useService(serviceName) {
  const services = useServices();
  const service = services[serviceName];
  
  if (!service) {
    throw new Error(`Service '${serviceName}' not found in service container`);
  }
  
  return service;
} 