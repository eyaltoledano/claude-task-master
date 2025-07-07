/**
 * Simplified Flow configuration focused on VibeKit integration
 */

import { z } from 'zod';

const FlowConfigSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // VibeKit Configuration
  vibekit: z.object({
    enabled: z.boolean().default(true),
    defaultAgent: z.enum(['claude', 'codex', 'gemini', 'opencode']).default('claude'),
    streamingEnabled: z.boolean().default(true),
    githubIntegration: z.boolean().default(true),
    autoCreatePR: z.boolean().default(false),
    
    // Agent-specific settings
    agents: z.object({
      claude: z.object({
        enabled: z.boolean().default(true),
        maxTokens: z.number().default(4000),
        temperature: z.number().min(0).max(1).default(0.1)
      }).default({}),
      
      codex: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().default(2000),
        temperature: z.number().min(0).max(1).default(0.1)
      }).default({}),
      
      gemini: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().default(3000),
        temperature: z.number().min(0).max(1).default(0.1)
      }).default({}),
      
      opencode: z.object({
        enabled: z.boolean().default(false),
        maxTokens: z.number().default(2000),
        temperature: z.number().min(0).max(1).default(0.1)
      }).default({})
    }).default({})
  }).default({}),

  // GitHub Integration
  github: z.object({
    enabled: z.boolean().default(true),
    autoDetectRepo: z.boolean().default(true),
    defaultBranch: z.string().default('main'),
    prTemplate: z.string().optional()
  }).default({}),

  // Execution Settings
  execution: z.object({
    timeout: z.number().min(1000).max(3600000).default(300000), // 5 minutes
    maxRetries: z.number().min(0).max(5).default(2),
    streamOutput: z.boolean().default(true)
  }).default({}),

  // Logging
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    enableTelemetry: z.boolean().default(true)
  }).default({})
});

export { FlowConfigSchema };
