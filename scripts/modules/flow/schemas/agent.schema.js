/**
 * Task Master Flow - Agent Configuration Schema
 * Phase 1: Schema & Storage Layer
 * 
 * AI agent configuration with provider abstraction and model parameters.
 * Simplified version for Phase 1 - using optional fields instead of defaults.
 */

import { Schema as S } from "effect";

/**
 * Supported AI agent providers (research-backed)
 */
export const AgentProvider = S.Literal("mock", "claude", "codex", "gemini", "claude-code");

/**
 * Model configuration for AI agents
 */
export const AgentModelConfig = S.Struct({
  // Model identification
  name: S.String,
  
  // Generation parameters
  temperature: S.optional(
    S.Number.pipe(
      S.clamp(0.0, 2.0), // Standard temperature range
      S.brand("Temperature")
    )
  ),
  
  maxTokens: S.optional(
    S.Number.pipe(
      S.clamp(1, 200000), // 1 to 200k tokens
      S.brand("MaxTokens")
    )
  ),
  
  // Model-specific settings
  topP: S.optional(S.Number.pipe(S.clamp(0.0, 1.0))),
  frequencyPenalty: S.optional(S.Number.pipe(S.clamp(-2.0, 2.0))),
  presencePenalty: S.optional(S.Number.pipe(S.clamp(-2.0, 2.0)))
});

/**
 * Provider-specific configuration
 */
export const AgentProviderConfig = S.Struct({
  // Claude/Anthropic specific options
  claude: S.optional(S.Struct({
    apiKey: S.optional(S.String), // Reference to env var
    baseUrl: S.optional(S.String),
    version: S.optional(S.String),
    enableCaching: S.optional(S.Boolean)
  })),
  
  // OpenAI Codex specific options
  codex: S.optional(S.Struct({
    apiKey: S.optional(S.String),
    organization: S.optional(S.String),
    baseUrl: S.optional(S.String)
  })),
  
  // Google Gemini specific options
  gemini: S.optional(S.Struct({
    apiKey: S.optional(S.String),
    projectId: S.optional(S.String),
    location: S.optional(S.String)
  })),
  
  // Claude Code specific options
  claudeCode: S.optional(S.Struct({
    sessionId: S.optional(S.String),
    workspaceId: S.optional(S.String),
    enableDeepAnalysis: S.optional(S.Boolean)
  }))
});

/**
 * Agent capabilities configuration
 */
export const AgentCapabilities = S.Struct({
  // Core capabilities
  codeGeneration: S.optional(S.Boolean),
  codeAnalysis: S.optional(S.Boolean),
  taskExecution: S.optional(S.Boolean),
  fileOperations: S.optional(S.Boolean),
  
  // Advanced features
  multiStep: S.optional(S.Boolean),
  contextAware: S.optional(S.Boolean),
  streaming: S.optional(S.Boolean),
  
  // Supported languages
  supportedLanguages: S.optional(S.Array(S.String))
});

/**
 * Agent behavior configuration
 */
export const AgentBehavior = S.Struct({
  // Communication style
  verbosity: S.optional(S.Literal("minimal", "normal", "verbose")),
  codeStyle: S.optional(S.Literal("minimal", "readable", "documented")),
  errorHandling: S.optional(S.Literal("strict", "adaptive", "permissive")),
  
  // Testing preferences
  testingStrategy: S.optional(S.Literal("none", "unit", "integration", "comprehensive")),
  documentationLevel: S.optional(S.Literal("none", "minimal", "standard", "detailed"))
});

/**
 * Main agent configuration schema
 */
export const AgentConfig = S.Struct({
  // Version tracking
  version: S.optional(S.String),
  
  // Provider and model
  provider: AgentProvider,
  model: AgentModelConfig,
  
  // Capabilities and behavior
  capabilities: S.optional(AgentCapabilities),
  behavior: S.optional(AgentBehavior),
  
  // Metadata
  name: S.String,
  description: S.optional(S.String),
  createdAt: S.optional(S.DateFromString),
  
  // Environment-specific settings
  environment: S.optional(S.Record(S.String, S.String))
});

/**
 * JSDoc type definitions for JavaScript development
 * 
 * @typedef {S.Schema.Type<typeof AgentConfig>} AgentConfigType
 * @typedef {S.Schema.Type<typeof AgentProvider>} AgentProviderType  
 * @typedef {S.Schema.Type<typeof AgentModelConfig>} AgentModelConfigType
 */ 