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
    defaultAgent: z.enum(['claude-code', 'codex', 'gemini-cli', 'opencode']).default('claude-code'),
    streamingEnabled: z.boolean().default(true),
    githubIntegration: z.boolean().default(true),
    autoCreatePR: z.boolean().default(false),
    
    // Core VibeKit SDK settings
    sdk: z.object({
      version: z.string().default('latest'),
      timeout: z.number().min(1000).max(600000).default(120000), // 2 minutes
      retryAttempts: z.number().min(0).max(5).default(3),
      baseUrl: z.string().optional(), // For custom VibeKit instances
    }).default({}),
    
    // Environment configurations (sandbox providers)
    environments: z.object({
      e2b: z.object({
        enabled: z.boolean().default(true),
        apiKey: z.string().optional(), // Will use E2B_API_KEY from .env
        templateId: z.string().optional(),
        region: z.string().default('us-east-1'),
        // Additional E2B config can be added here
      }).default({}),
      
      northflank: z.object({
        enabled: z.boolean().default(false),
        apiKey: z.string().optional(), // Will use NORTHFLANK_API_KEY from .env
        projectId: z.string().optional(), // Will use NORTHFLANK_PROJECT_ID from .env
        region: z.string().default('europe-west'),
      }).default({}),
      
      daytona: z.object({
        enabled: z.boolean().default(false),
        apiKey: z.string().optional(), // Will use DAYTONA_API_KEY from .env
        workspaceId: z.string().optional(), // Will use DAYTONA_WORKSPACE_ID from .env
        region: z.string().default('us-central'),
      }).default({})
    }).default({}),
    
    // Telemetry configuration (OpenTelemetry)
    telemetry: z.object({
      enabled: z.boolean().default(false),
      endpoint: z.string().optional(), // Will use VIBEKIT_TELEMETRY_ENDPOINT from .env
      apiKey: z.string().optional(), // Will use VIBEKIT_TELEMETRY_API_KEY from .env
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
      encryptionKey: z.string().optional(), // Will use VIBEKIT_ENCRYPTION_KEY from .env
      vaultUrl: z.string().optional(),
      awsRegion: z.string().optional(),
    }).default({}),
    
    // Agent-specific settings (reusing existing Task Master API keys)
    agents: z.object({
      'claude-code': z.object({
        enabled: z.boolean().default(true),
        maxTokens: z.number().min(1).max(32000).default(4000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('claude-3-opus-20240229'),
        provider: z.string().default('anthropic'),
        apiKey: z.string().optional(), // Will use ANTHROPIC_API_KEY from .env
      }).default({}),
      
      codex: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(2000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('gpt-4-turbo-preview'),
        provider: z.string().default('openai'),
        apiKey: z.string().optional(), // Will use OPENAI_API_KEY from .env
      }).default({}),
      
      'gemini-cli': z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(3000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('gemini-1.5-pro'),
        provider: z.string().default('gemini'),
        apiKey: z.string().optional(), // Will use GOOGLE_API_KEY from .env
      }).default({}),
      
      opencode: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().min(1).max(8000).default(2000),
        temperature: z.number().min(0).max(1).default(0.1),
        modelName: z.string().default('deepseek-coder-v2'),
        provider: z.string().default('opencode'),
        apiKey: z.string().optional(), // Will use custom OPENCODE_API_KEY from .env
      }).default({})
    }).default({}),
    
    // Working directory configuration
    workingDirectory: z.string().optional(),
    
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
    prTemplate: z.string().optional(),
    token: z.string().optional(), // Will use GITHUB_API_KEY from .env
    webhookSecret: z.string().optional(), // Will use GITHUB_WEBHOOK_SECRET from .env
    autoSync: z.boolean().default(false),
    branchPrefix: z.string().default('taskmaster/'),
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
    logFile: z.string().optional(),
    maxLogSize: z.number().default(10 * 1024 * 1024), // 10MB
  }).default({})
}); 