/**
 * Service Factory
 * Factory functions for creating and configuring services
 */

import { flowLogger } from '../logging/flow-logger.js';
import { FlowConfigManager } from '../config/managers/flow-config-manager.js';
import { ASTConfigManager } from '../config/managers/ast-config-manager.js';
import { globalRegistry } from '../providers/registry.js';
import { BranchAwarenessManager } from './BranchAwarenessManager.js';
import { getHookManager } from '../hooks/index.js';
import { validateServices, createTypedServiceContainer } from './index.js';

/**
 * Service configuration options
 * @typedef {Object} ServiceConfig
 * @property {Object} backend - Backend service instance
 * @property {string} projectRoot - Project root directory
 * @property {Object} [loggerConfig] - Logger configuration
 * @property {Object} [configOverrides] - Configuration overrides
 */

/**
 * Create a configured logger service
 * @param {Object} [config={}] - Logger configuration
 * @returns {LoggerService} Configured logger
 */
export function createLogger(config = {}) {
  const logger = flowLogger.child({
    module: 'flow',
    ...config
  });
  
  // Add success method if not present
  if (!logger.success) {
    logger.success = (message, ...args) => logger.info(`✅ ${message}`, ...args);
  }
  
  return logger;
}

/**
 * Create a configured branch manager
 * @param {string} projectRoot - Project root directory
 * @param {Object} backend - Backend service
 * @returns {Promise<BranchManagerService>} Configured branch manager
 */
export async function createBranchManager(projectRoot, backend) {
  const manager = new BranchAwarenessManager(projectRoot, { backend });
  await manager.initialize();
  return manager;
}

/**
 * Create all services for the application
 * @param {ServiceConfig} config - Service configuration
 * @returns {Promise<Object>} Service container
 */
export async function createServices(config) {
  const { backend, projectRoot, loggerConfig = {}, configOverrides = {} } = config;
  
  if (!backend) {
    throw new Error('Backend service is required');
  }
  
  if (!projectRoot) {
    throw new Error('Project root is required');
  }
  
  // Create logger first for use by other services
  const logger = createLogger(loggerConfig);
  
  logger.info('Creating application services', { projectRoot });
  
  try {
    // Create configuration managers
    const configManager = FlowConfigManager;
    const astConfigManager = ASTConfigManager;
    
    // Apply any config overrides
    if (Object.keys(configOverrides).length > 0) {
      logger.debug('Applying configuration overrides', configOverrides);
      Object.entries(configOverrides).forEach(([key, value]) => {
        configManager.set(key, value);
      });
    }
    
    // Create other services
    const [branchManager, hookManager] = await Promise.all([
      createBranchManager(projectRoot, backend),
      getHookManager()
    ]);
    
    // Get provider registry
    const providerRegistry = globalRegistry;
    
    // Create service container
    const services = {
      backend,
      logger,
      configManager,
      astConfigManager,
      branchManager,
      hookManager,
      providerRegistry,
      projectRoot
    };
    
    // Validate all services
    validateServices(services);
    
    // Create typed container
    const typedServices = createTypedServiceContainer(services);
    
    logger.success('All services created successfully');
    
    return typedServices;
  } catch (error) {
    logger.error('Failed to create services', { error: error.message });
    throw error;
  }
}

/**
 * Create a minimal service container for testing
 * @param {Object} [overrides={}] - Service overrides
 * @returns {Object} Test service container
 */
export function createTestServices(overrides = {}) {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
    child: jest.fn(() => mockLogger)
  };
  
  const mockBackend = {
    getTasks: jest.fn(() => Promise.resolve({ tasks: [] })),
    getTask: jest.fn(() => Promise.resolve(null)),
    setTaskStatus: jest.fn(() => Promise.resolve()),
    addTask: jest.fn(() => Promise.resolve({ id: '1' })),
    updateTask: jest.fn(() => Promise.resolve()),
    removeTask: jest.fn(() => Promise.resolve()),
    addSubtask: jest.fn(() => Promise.resolve({ id: '1.1' })),
    updateSubtask: jest.fn(() => Promise.resolve()),
    removeSubtask: jest.fn(() => Promise.resolve()),
    getTags: jest.fn(() => Promise.resolve([])),
    addTag: jest.fn(() => Promise.resolve()),
    deleteTag: jest.fn(() => Promise.resolve()),
    useTag: jest.fn(() => Promise.resolve()),
    parsePRD: jest.fn(() => Promise.resolve({ tasksCreated: 0 })),
    analyzeComplexity: jest.fn(() => Promise.resolve({ tasks: [] })),
    expandTask: jest.fn(() => Promise.resolve({ subtasksCreated: 0 })),
    getComplexityReport: jest.fn(() => Promise.resolve(null)),
    projectRoot: '/test/project'
  };
  
  const mockConfigManager = {
    load: jest.fn(() => Promise.resolve({})),
    save: jest.fn(() => Promise.resolve()),
    get: jest.fn(() => null),
    set: jest.fn(),
    getAll: jest.fn(() => ({})),
    validate: jest.fn(() => true)
  };
  
  const mockBranchManager = {
    getCurrentBranch: jest.fn(() => Promise.resolve('main')),
    hasUncommittedChanges: jest.fn(() => Promise.resolve(false)),
    getStatus: jest.fn(() => Promise.resolve({})),
    checkout: jest.fn(() => Promise.resolve()),
    startWatching: jest.fn(),
    stopWatching: jest.fn()
  };
  
  const mockHookManager = {
    register: jest.fn(),
    execute: jest.fn(() => Promise.resolve()),
    getHooks: jest.fn(() => []),
    unregister: jest.fn(),
    listHooks: jest.fn(() => [])
  };
  
  const mockProviderRegistry = {
    register: jest.fn(),
    get: jest.fn(() => null),
    list: jest.fn(() => []),
    has: jest.fn(() => false),
    unregister: jest.fn()
  };
  
  return {
    backend: mockBackend,
    logger: mockLogger,
    configManager: mockConfigManager,
    astConfigManager: mockConfigManager,
    branchManager: mockBranchManager,
    hookManager: mockHookManager,
    providerRegistry: mockProviderRegistry,
    projectRoot: '/test/project',
    ...overrides
  };
} 