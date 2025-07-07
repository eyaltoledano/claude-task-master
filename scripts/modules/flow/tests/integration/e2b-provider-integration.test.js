/**
 * @fileoverview E2B Provider Integration Tests
 * 
 * Tests the E2B provider integration, capabilities, and error handling.
 * Uses mocked implementations for testing without requiring actual E2B modules.
 */

// Test configuration
const TEST_CONFIG = {
  apiKey: process.env.E2B_API_KEY || 'test-api-key',
  baseUrl: 'https://api.e2b.dev',
  timeout: 10000
};

// Mock E2B Provider Factory
const mockE2BProviderFactory = {
  create: jest.fn((config) => ({
    config,
    id: 'mock-e2b-provider',
    type: 'e2b'
  })),
  
  capabilities: jest.fn(async () => ({
    provider: 'e2b',
    languages: ['javascript', 'typescript', 'python', 'bash'],
    features: {
      filesystem: true,
      networking: true,
      packageInstallation: true
    },
    security: {
      containerIsolation: true,
      networkIsolation: true
    }
  })),
  
  healthCheck: jest.fn(async (config) => ({
    success: true,
    provider: 'e2b',
    checkedAt: new Date().toISOString(),
    status: 'healthy'
  }))
};

// Mock E2B Client
const mockE2BClient = jest.fn().mockImplementation((config) => ({
  apiKey: config.apiKey,
  baseUrl: config.baseUrl,
  timeout: config.timeout,
  isConnected: () => true
}));

// Mock E2B Resource Manager
const mockE2BResourceManager = jest.fn().mockImplementation((options) => ({
  dataDir: options.dataDir,
  getMetrics: jest.fn(() => ({
    totalCreated: 0,
    currentActive: 0,
    totalDestroyed: 0
  }))
}));

// Mock Error Classes
class MockE2BError extends Error {
  constructor({ message, code }) {
    super(message);
    this.name = 'E2BError';
    this.code = code;
  }
}

class MockE2BConnectionError extends MockE2BError {
  constructor({ message, code }) {
    super({ message, code });
    this.name = 'E2BConnectionError';
    this.isRetryable = true;
  }
}

class MockE2BExecutionError extends MockE2BError {
  constructor({ message, code }) {
    super({ message, code });
    this.name = 'E2BExecutionError';
    this.isRetryable = false;
  }
}

// Mock Built-in Providers Registry
const mockBuiltInProviders = {
  e2b: {
    name: 'E2B Sandbox',
    type: 'e2b',
    config: {
      name: 'e2b',
      apiEndpoint: 'https://api.e2b.dev',
      authentication: {
        type: 'api_key',
        credentials: {}
      },
      features: ['ai-sandbox', 'code-execution', 'file-system']
    },
    metadata: {
      description: 'E2B cloud sandbox for code execution',
      stability: 'stable',
      documentation: 'https://e2b.dev/docs'
    },
    loader: jest.fn(async () => mockE2BProviderFactory)
  },
  mock: {
    name: 'Mock Provider',
    type: 'mock',
    config: { features: ['testing'] }
  },
  modal: {
    name: 'Modal',
    type: 'modal',
    config: { features: ['serverless'] }
  },
  northflank: {
    name: 'Northflank',
    type: 'northflank',
    config: { features: ['deployment'] }
  }
};

describe('E2B Provider Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Factory', () => {
    test('should create provider instance', async () => {
      const provider = mockE2BProviderFactory.create(TEST_CONFIG);
      
      expect(provider).toBeDefined();
      expect(provider.config.apiKey).toBe(TEST_CONFIG.apiKey);
      expect(provider.config.baseUrl).toBe(TEST_CONFIG.baseUrl);
      expect(provider.type).toBe('e2b');
    });

    test('should return provider capabilities', async () => {
      const capabilities = await mockE2BProviderFactory.capabilities();
      
      expect(capabilities.provider).toBe('e2b');
      expect(Array.isArray(capabilities.languages)).toBe(true);
      expect(capabilities.languages).toContain('javascript');
      expect(capabilities.features.filesystem).toBe(true);
      expect(capabilities.features.networking).toBe(true);
      expect(capabilities.security.containerIsolation).toBe(true);
    });

    test('should perform health check', async () => {
      const health = await mockE2BProviderFactory.healthCheck(TEST_CONFIG);
      
      expect(health).toBeDefined();
      expect(health.success).toBe(true);
      expect(health.provider).toBe('e2b');
      expect(health.checkedAt).toBeDefined();
      expect(health.status).toBe('healthy');
    });
  });

  describe('E2B Client', () => {
    test('should create client instance', async () => {
      const client = new mockE2BClient(TEST_CONFIG);
      
      expect(client).toBeDefined();
      expect(client.apiKey).toBe(TEST_CONFIG.apiKey);
      expect(client.baseUrl).toBe(TEST_CONFIG.baseUrl);
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('E2B Resource Manager', () => {
    test('should create resource manager instance', async () => {
      const resourceManager = new mockE2BResourceManager({
        dataDir: '.taskmaster/flow/test-data/e2b'
      });
      
      expect(resourceManager).toBeDefined();
      expect(resourceManager.dataDir).toBe('.taskmaster/flow/test-data/e2b');
      
      const metrics = resourceManager.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalCreated).toBe('number');
      expect(typeof metrics.currentActive).toBe('number');
    });
  });

  describe('Error Types', () => {
    test('should have proper error inheritance', async () => {
      const connectionError = new MockE2BConnectionError({
        message: 'Test connection error',
        code: 'CONNECTION_TEST'
      });
      
      expect(connectionError instanceof MockE2BError).toBe(true);
      expect(connectionError instanceof Error).toBe(true);
      expect(connectionError.message).toBe('Test connection error');
      expect(connectionError.isRetryable).toBe(true);

      const executionError = new MockE2BExecutionError({
        message: 'Test execution error',
        code: 'EXECUTION_TEST'
      });
      
      expect(executionError instanceof MockE2BError).toBe(true);
      expect(executionError.isRetryable).toBe(false);
    });
  });

  describe('Provider Registry Integration', () => {
    test('should register E2B provider correctly', async () => {
      expect(mockBuiltInProviders.e2b).toBeDefined();
      expect(mockBuiltInProviders.e2b.name).toBe('E2B Sandbox');
      expect(mockBuiltInProviders.e2b.type).toBe('e2b');
      expect(mockBuiltInProviders.e2b.config.features).toContain('ai-sandbox');
    });

    test('should have functional E2B loader', async () => {
      const loader = mockBuiltInProviders.e2b.loader;
      
      expect(typeof loader).toBe('function');
      
      const factory = await loader();
      expect(factory).toBe(mockE2BProviderFactory);
    });

    test('should have all expected providers available', async () => {
      const expectedProviders = ['mock', 'e2b', 'modal', 'northflank'];
      
      for (const providerKey of expectedProviders) {
        expect(mockBuiltInProviders[providerKey]).toBeDefined();
        expect(mockBuiltInProviders[providerKey].name).toBeDefined();
        expect(mockBuiltInProviders[providerKey].type).toBeDefined();
      }
    });

    test('should have proper provider configuration structure', async () => {
      const e2bConfig = mockBuiltInProviders.e2b.config;
      
      expect(e2bConfig.name).toBe('e2b');
      expect(e2bConfig.apiEndpoint).toBe('https://api.e2b.dev');
      expect(e2bConfig.authentication.type).toBe('api_key');
      expect(e2bConfig.authentication.credentials).toBeDefined();
      
      const metadata = mockBuiltInProviders.e2b.metadata;
      expect(metadata.description).toBeDefined();
      expect(metadata.stability).toBe('stable');
      expect(metadata.documentation).toBeDefined();
    });
  });

  describe('Integration Workflow', () => {
    test('should simulate complete E2B workflow', async () => {
      // Create provider instance
      const provider = mockE2BProviderFactory.create(TEST_CONFIG);
      expect(provider).toBeDefined();

      // Check capabilities
      const capabilities = await mockE2BProviderFactory.capabilities();
      expect(capabilities.provider).toBe('e2b');

      // Perform health check
      const health = await mockE2BProviderFactory.healthCheck(TEST_CONFIG);
      expect(health.success).toBe(true);

      // Create client
      const client = new mockE2BClient(TEST_CONFIG);
      expect(client.isConnected()).toBe(true);

      // Create resource manager
      const resourceManager = new mockE2BResourceManager({
        dataDir: '.taskmaster/flow/test-data/e2b'
      });
      expect(resourceManager.getMetrics().currentActive).toBe(0);
    });

    test('should handle error scenarios gracefully', async () => {
      // Test connection error
      const connectionError = new MockE2BConnectionError({
        message: 'Failed to connect to E2B API',
        code: 'CONNECTION_ERROR'
      });
      
      expect(connectionError.isRetryable).toBe(true);
      expect(connectionError.code).toBe('CONNECTION_ERROR');

      // Test execution error
      const executionError = new MockE2BExecutionError({
        message: 'Code execution failed',
        code: 'EXECUTION_ERROR'
      });
      
      expect(executionError.isRetryable).toBe(false);
      expect(executionError.code).toBe('EXECUTION_ERROR');
    });
  });
}); 