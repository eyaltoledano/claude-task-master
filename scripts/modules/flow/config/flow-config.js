/**
 * Default Flow Configuration for Task Master Flow
 * Contains only configuration values - no schemas, managers, or validation logic
 */

/**
 * Default Flow Configuration Values
 * Defines the structure and default values for all Flow configuration
 */
export const DEFAULT_FLOW_CONFIG = {
  // Environment
  nodeEnv: 'development',

  // VibeKit Configuration  
  vibekit: {
    enabled: true,
    defaultAgent: 'claude-code',
    streamingEnabled: true,
    githubIntegration: true,
    autoCreatePR: false,
    
    // Core VibeKit SDK settings
    sdk: {
      version: 'latest',
      timeout: 120000, // 2 minutes
      retryAttempts: 3,
      baseUrl: undefined, // For custom VibeKit instances
    },
    
    // Environment configurations (sandbox providers)
    environments: {
      e2b: {
        enabled: true,
        apiKey: undefined, // Will use E2B_API_KEY from .env
        templateId: undefined,
        region: 'us-east-1',
      },
      
      northflank: {
        enabled: false,
        apiKey: undefined, // Will use NORTHFLANK_API_KEY from .env
        projectId: undefined, // Will use NORTHFLANK_PROJECT_ID from .env
        region: 'europe-west',
      },
      
      daytona: {
        enabled: false,
        apiKey: undefined, // Will use DAYTONA_API_KEY from .env
        workspaceId: undefined, // Will use DAYTONA_WORKSPACE_ID from .env
        region: 'us-central',
      }
    },
    
    // Telemetry configuration (OpenTelemetry)
    telemetry: {
      enabled: false,
      endpoint: undefined, // Will use VIBEKIT_TELEMETRY_ENDPOINT from .env
      apiKey: undefined, // Will use VIBEKIT_TELEMETRY_API_KEY from .env
      samplingRate: 0.1,
      batchSize: 100,
      flushInterval: 30000, // milliseconds
      serviceName: 'taskmaster-flow',
      serviceVersion: '1.0.0',
    },
    
    // Session management
    sessionManagement: {
      enabled: true,
      persistSessions: true,
      sessionDir: '.taskmaster/flow/sessions',
      maxSessionAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours in ms
      autoResume: true,
    },
    
    // Secrets management
    secrets: {
      enabled: true,
      provider: 'env',
      encryptionKey: undefined, // Will use VIBEKIT_ENCRYPTION_KEY from .env
      vaultUrl: undefined,
      awsRegion: undefined,
    },
    
    // Agent-specific settings (reusing existing Task Master API keys)
    agents: {
      'claude-code': {
        enabled: true,
        maxTokens: 4000,
        temperature: 0.1,
        modelName: 'claude-3-opus-20240229',
        provider: 'anthropic',
        apiKey: undefined, // Will use ANTHROPIC_API_KEY from .env
      },
      
      codex: {
        enabled: false,
        maxTokens: 2000,
        temperature: 0.1,
        modelName: 'gpt-4-turbo-preview',
        provider: 'openai',
        apiKey: undefined, // Will use OPENAI_API_KEY from .env
      },
      
      'gemini-cli': {
        enabled: false,
        maxTokens: 3000,
        temperature: 0.1,
        modelName: 'gemini-1.5-pro',
        provider: 'gemini',
        apiKey: undefined, // Will use GOOGLE_API_KEY from .env
      },
      
      opencode: {
        enabled: false,
        maxTokens: 2000,
        temperature: 0.1,
        modelName: 'deepseek-coder-v2',
        provider: 'opencode',
        apiKey: undefined, // Will use custom OPENCODE_API_KEY from .env
      }
    },
    
    // Working directory configuration
    workingDirectory: undefined,
    
    // Ask Mode configuration
    askMode: {
      enabled: true,
      defaultMode: 'interactive',
      timeout: 60000, // 1 minute
      maxQuestions: 10,
    },
    
    // Streaming configuration
    streaming: {
      enabled: true,
      bufferSize: 1000,
      flushInterval: 500, // milliseconds
      compression: false,
    }
  },

  // GitHub Integration (enhanced for VibeKit)
  github: {
    enabled: true,
    autoDetectRepo: true,
    defaultBranch: 'main',
    prTemplate: undefined,
    token: undefined, // Will use GITHUB_API_KEY from .env
    webhookSecret: undefined, // Will use GITHUB_WEBHOOK_SECRET from .env
    autoSync: false,
    branchPrefix: 'taskmaster/',
  },

  // Execution Settings
  execution: {
    timeout: 300000, // 5 minutes
    maxRetries: 2,
    streamOutput: true,
    parallelTasks: 3,
  },

  // Logging
  logging: {
    level: 'info',
    enableTelemetry: true,
    logFile: undefined,
    maxLogSize: 10 * 1024 * 1024, // 10MB
  }
};

// Re-export from other modules for backward compatibility
export { FlowConfigSchema } from './schemas/flow-config-schema.js';
export { FlowConfigManager, flowConfig, FlowConfig } from './managers/flow-config-manager.js';
export { applyEnvironmentOverrides } from './utils/env-overrides.js';
