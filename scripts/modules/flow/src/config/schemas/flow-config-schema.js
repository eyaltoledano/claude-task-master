/**
 * Flow Configuration Schema
 * Defines the Zod schema for validating Flow configuration
 */

import { z } from 'zod';

/**
 * VibeKit Flow Configuration Schema
 * Defines the structure and validation for all Flow configuration
 */
export const FlowConfigSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // VibeKit Configuration  
  vibekit: z.object({
          enabled: z.boolean().default(true),
      defaultAgent: z.enum(['claude', 'codex', 'gemini', 'opencode']).default('claude'),
      streamingEnabled: z.boolean().default(true),
    githubIntegration: z.boolean().default(true),
    autoCreatePR: z.boolean().default(false),
    
    // Core VibeKit SDK settings
    sdk: z.object({
      version: z.string().default('latest'),
      timeout: z.number().min(1000).max(600000).default(120000), // 2 minutes
      retryAttempts: z.number().min(0).max(5).default(3),
      baseUrl: z.string().nullish(), // For custom VibeKit instances
    }).default({}),
    
    // Environment configurations (sandbox providers)
    environments: z.object({
      e2b: z.object({
        enabled: z.boolean().default(true),
        apiKey: z.string().nullish(), // Will use E2B_API_KEY from .env
        templateId: z.string().nullish(),
        region: z.string().default('us-east-1'),
        // Additional E2B config can be added here
      }).default({}),
      
      northflank: z.object({
        enabled: z.boolean().default(false),
        apiKey: z.string().nullish(), // Will use NORTHFLANK_API_KEY from .env
        projectId: z.string().nullish(), // Will use NORTHFLANK_PROJECT_ID from .env
        region: z.string().default('europe-west'),
      }).default({}),
      
      daytona: z.object({
        enabled: z.boolean().default(false),
        apiKey: z.string().nullish(), // Will use DAYTONA_API_KEY from .env
        workspaceId: z.string().nullish(), // Will use DAYTONA_WORKSPACE_ID from .env
        region: z.string().default('us-central'),
      }).default({})
    }).default({}),
    
    // Telemetry configuration (OpenTelemetry)
    telemetry: z.object({
      enabled: z.boolean().default(false),
      endpoint: z.string().nullish(), // Will use VIBEKIT_TELEMETRY_ENDPOINT from .env
      apiKey: z.string().nullish(), // Will use VIBEKIT_TELEMETRY_API_KEY from .env
      samplingRate: z.number().min(0).max(1).default(0.1),
      batchSize: z.number().min(1).max(1000).default(100),
      flushInterval: z.number().min(1000).default(30000), // milliseconds
      serviceName: z.string().default('taskmaster-flow'),
      serviceVersion: z.string().default('1.0.0'),
    }).default({}),
    
    // Session management
    sessionManagement: z.object({
      enabled: z.boolean().default(true),
      persistSessions: z.boolean().default(true),
      sessionDir: z.string().default('.taskmaster/flow/sessions'),
      maxSessionAge: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days in ms
      cleanupInterval: z.number().default(24 * 60 * 60 * 1000), // 24 hours in ms
      autoResume: z.boolean().default(true),
    }).default({}),
    
    // Secrets management
    secrets: z.object({
      enabled: z.boolean().default(true),
      provider: z.enum(['env', 'vault', 'aws-secrets']).default('env'),
      encryptionKey: z.string().nullish(), // Will use VIBEKIT_ENCRYPTION_KEY from .env
      vaultUrl: z.string().nullish(),
      awsRegion: z.string().nullish(),
    }).default({}),
    
    // Agent-specific settings (reusing existing Task Master API keys)
          agents: z.object({
        'claude': z.object({
        enabled: z.boolean().default(true),
        maxTokens: z.number().min(1).max(32000).default(4000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('claude-3-opus-20240229'),
        provider: z.string().default('anthropic'),
        apiKey: z.string().nullish(), // Will use ANTHROPIC_API_KEY from .env
      }).default({}),
      
      codex: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(2000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('gpt-4-turbo-preview'),
        provider: z.string().default('openai'),
        apiKey: z.string().nullish(), // Will use OPENAI_API_KEY from .env
      }).default({}),
      
              'gemini': z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(3000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('gemini-1.5-pro'),
        provider: z.string().default('gemini'),
        apiKey: z.string().nullish(), // Will use GOOGLE_API_KEY from .env
      }).default({}),
      
      opencode: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(2000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('deepseek-coder-v2'),
        provider: z.string().default('opencode'),
        apiKey: z.string().nullish(), // Will use custom OPENCODE_API_KEY from .env
      }).default({})
    }).default({}),
    
    // Working directory configuration
    workingDirectory: z.string().nullish(),
    
    // Ask Mode configuration
    askMode: z.object({
      enabled: z.boolean().default(true),
      defaultMode: z.enum(['interactive', 'batch', 'streaming']).default('interactive'),
      timeout: z.number().min(5000).max(300000).default(60000), // 1 minute
      maxQuestions: z.number().min(1).max(50).default(10),
    }).default({}),
    
    // Streaming configuration
    streaming: z.object({
      enabled: z.boolean().default(true),
      bufferSize: z.number().min(1).max(10000).default(1000),
      flushInterval: z.number().min(100).max(5000).default(500), // milliseconds
      compression: z.boolean().default(false),
    }).default({})
  }).default({}),

  // GitHub Integration (enhanced for VibeKit)
  github: z.object({
    enabled: z.boolean().default(true),
    autoDetectRepo: z.boolean().default(true),
    defaultBranch: z.string().default('main'),
    prTemplate: z.string().nullish(),
    token: z.string().nullish(), // Will use GITHUB_API_KEY from .env
    webhookSecret: z.string().nullish(), // Will use GITHUB_WEBHOOK_SECRET from .env
    autoSync: z.boolean().default(false),
    branchPrefix: z.string().default('taskmaster/'),
    
    // Additional GitHub config objects with defaults
    integration: z.object({
      enabled: z.boolean().default(true),
      autoCreatePR: z.boolean().default(false),
      autoMerge: z.boolean().default(false),
      requireReviews: z.boolean().default(true),
      deleteSourceBranch: z.boolean().default(false),
    }).default({}),
    
    pullRequest: z.object({
      template: z.string().nullish(),
      assignToCreator: z.boolean().default(true),
      addLabels: z.array(z.string()).default(['taskmaster', 'automated']),
      requestReviewers: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    }).default({}),
    
    commit: z.object({
      messageTemplate: z.string().default('[TaskMaster] {task_title}'),
      signCommits: z.boolean().default(false),
      author: z.object({
        name: z.string().nullish(),
        email: z.string().nullish(),
      }).default({}),
    }).default({}),
    
    webhooks: z.object({
      enabled: z.boolean().default(false),
      secret: z.string().nullish(),
      events: z.array(z.string()).default(['push', 'pull_request']),
    }).default({})
  }).default({}),

  // Execution Settings
  execution: z.object({
    timeout: z.number().min(1000).max(3600000).default(300000), // 5 minutes
    maxRetries: z.number().min(0).max(5).default(2),
    streamOutput: z.boolean().default(true),
    parallelTasks: z.number().min(1).max(10).default(3),
  }).default({}),

  // Logging
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    enableTelemetry: z.boolean().default(true),
    logFile: z.string().nullish(),
    maxLogSize: z.number().default(10 * 1024 * 1024), // 10MB
    
    // Additional logging config objects with defaults
    console: z.object({
      enabled: z.boolean().default(true),
      colorize: z.boolean().default(true),
      timestamp: z.boolean().default(true),
      format: z.string().default('simple'),
    }).default({}),
    
    file: z.object({
      enabled: z.boolean().default(false),
      path: z.string().default('.taskmaster/logs/flow.log'),
      maxSize: z.string().default('10MB'),
      maxFiles: z.number().default(5),
      rotateDaily: z.boolean().default(true),
    }).default({}),
    
    structured: z.object({
      enabled: z.boolean().default(false),
      format: z.string().default('json'),
      includeStackTrace: z.boolean().default(true),
      includeMetadata: z.boolean().default(true),
    }).default({}),
    
    filters: z.object({
      excludePatterns: z.array(z.string()).default(['token', 'password', 'secret', 'key']),
      sensitiveFields: z.array(z.string()).default(['apiKey', 'token', 'password', 'secret']),
    }).default({}),
    
    levels: z.object({
      error: z.boolean().default(true),
      warn: z.boolean().default(true),
      info: z.boolean().default(true),
      debug: z.boolean().default(false),
      verbose: z.boolean().default(false),
    }).default({}),
    
    performance: z.object({
      enabled: z.boolean().default(true),
      trackSlowOperations: z.boolean().default(true),
      slowOperationThreshold: z.number().default(1000),
      includeMemoryUsage: z.boolean().default(true),
    }).default({})
  }).default({}),

  // AST Configuration (if needed)
  ast: z.object({
    enabled: z.boolean().default(true),
  }).default({})
}); 