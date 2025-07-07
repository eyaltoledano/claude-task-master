/**
 * Task Master Flow - Schema Definitions
 * Phase 1: Schema & Storage Layer
 * 
 * Modern Effect Schema definitions for Flow module following 2024-2025 best practices.
 */

export { SandboxConfig, SandboxProvider, SandboxResourceConfig } from './sandbox.schema.js';
export { AgentConfig, AgentProvider, AgentModelConfig } from './agent.schema.js';
export { ExecutionConfig, ExecutionEnvironment, ExecutionResult } from './execution.schema.js';
export { FlowMetadata, SchemaVersion } from './metadata.schema.js';

/**
 * Schema version for backward compatibility
 */
export const FLOW_SCHEMA_VERSION = "1.0.0";

/**
 * Validation utilities
 */
export { validateSchema, parseWithSchema, encodeWithSchema } from './validation.js';

/**
 * Schema type guards for runtime checks
 */
export {
  isSandboxConfig,
  isAgentConfig,
  isExecutionConfig,
  isValidProvider
} from './guards.js'; 