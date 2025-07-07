/**
 * Task Master Flow - Metadata and Versioning Schema
 * Phase 1: Schema & Storage Layer
 * 
 * Metadata schemas for versioning, compatibility, and system information.
 */

import { Schema as S } from "effect";

/**
 * Schema version for backward compatibility tracking
 */
export const SchemaVersion = S.Struct({
  major: S.Number.pipe(S.clamp(0, 999)),
  minor: S.Number.pipe(S.clamp(0, 999)),
  patch: S.Number.pipe(S.clamp(0, 999)),
  prerelease: S.optional(S.String),
  build: S.optional(S.String)
});

/**
 * System information schema
 */
export const SystemInfo = S.Struct({
  // Platform information
  platform: S.String,
  arch: S.String,
  nodeVersion: S.String,
  
  // Task Master information
  taskMasterVersion: S.String,
  flowModuleVersion: S.String,
  
  // Effect ecosystem versions
  effectVersion: S.String,
  platformVersion: S.optional(S.String),
  schemaVersion: S.optional(S.String),
  
  // Environment information
  environment: S.optional(S.Literal("development", "staging", "production")),
  projectRoot: S.optional(S.String),
  configPath: S.optional(S.String)
});

/**
 * User and context information
 */
export const UserContext = S.Struct({
  // User identification (non-sensitive)
  userId: S.optional(S.String),
  username: S.optional(S.String),
  
  // Workspace information
  workspaceId: S.optional(S.String),
  workspaceName: S.optional(S.String),
  projectName: S.optional(S.String),
  
  // Session information
  sessionId: S.optional(S.String),
  sessionStartTime: S.optional(S.DateFromString),
  
  // Preferences
  preferences: S.optional(S.Record(S.String, S.Unknown)),
  settings: S.optional(S.Record(S.String, S.Unknown))
});

/**
 * Audit and tracking information
 */
export const AuditInfo = S.Struct({
  // Creation information
  createdBy: S.optional(S.String),
  createdAt: S.DateFromString,
  createdFrom: S.optional(S.String), // Source: cli, api, ui, etc.
  
  // Modification information
  lastModifiedBy: S.optional(S.String),
  lastModifiedAt: S.optional(S.DateFromString),
  modificationReason: S.optional(S.String),
  
  // Version tracking
  version: S.Number.pipe(S.clamp(1, 999999)),
  previousVersion: S.optional(S.Number),
  
  // Access tracking
  lastAccessedAt: S.optional(S.DateFromString),
  accessCount: S.optional(S.Number.pipe(S.clamp(0, 999999))),
  
  // Lifecycle tracking
  status: S.optional(S.Literal("active", "archived", "deprecated", "deleted")),
  lifecycle: S.optional(S.Array(S.Struct({
    action: S.String,
    timestamp: S.DateFromString,
    actor: S.optional(S.String),
    details: S.optional(S.String)
  })))
});

/**
 * Performance and metrics metadata
 */
export const PerformanceMetrics = S.Struct({
  // Timing metrics
  executionTime: S.optional(S.Number.pipe(S.brand("ExecutionTimeMs"))),
  validationTime: S.optional(S.Number.pipe(S.brand("ValidationTimeMs"))),
  serializationTime: S.optional(S.Number.pipe(S.brand("SerializationTimeMs"))),
  
  // Resource metrics
  memoryUsage: S.optional(S.Number.pipe(S.brand("MemoryUsageBytes"))),
  diskUsage: S.optional(S.Number.pipe(S.brand("DiskUsageBytes"))),
  
  // Error metrics
  errorCount: S.optional(S.Number.pipe(S.clamp(0, 999999))),
  warningCount: S.optional(S.Number.pipe(S.clamp(0, 999999))),
  validationErrors: S.optional(S.Number.pipe(S.clamp(0, 999999))),
  
  // Quality metrics
  successRate: S.optional(S.Number.pipe(S.clamp(0, 1))),
  reliability: S.optional(S.Number.pipe(S.clamp(0, 1))),
  
  // Usage statistics
  usageFrequency: S.optional(S.Number.pipe(S.clamp(0, 999999))),
  avgUsageTime: S.optional(S.Number.pipe(S.brand("AvgUsageTimeMs")))
});

/**
 * Dependency and compatibility information
 */
export const DependencyInfo = S.Struct({
  // Required dependencies
  requiredDependencies: S.optional(S.Array(S.Struct({
    name: S.String,
    version: S.String,
    type: S.Literal("npm", "system", "service"),
    required: S.Boolean
  }))),
  
  // Optional dependencies
  optionalDependencies: S.optional(S.Array(S.Struct({
    name: S.String,
    version: S.String,
    type: S.Literal("npm", "system", "service"),
    fallback: S.optional(S.String)
  }))),
  
  // Compatibility requirements
  minNodeVersion: S.optional(S.String),
  maxNodeVersion: S.optional(S.String),
  supportedPlatforms: S.optional(S.Array(S.String)),
  
  // Feature compatibility
  requiredFeatures: S.optional(S.Array(S.String)),
  optionalFeatures: S.optional(S.Array(S.String)),
  experimentalFeatures: S.optional(S.Array(S.String))
});

/**
 * Complete metadata schema for Flow configurations
 * Provides comprehensive tracking and system information
 */
export const FlowMetadata = S.Struct({
  // Core metadata
  id: S.String,
  type: S.Literal("sandbox", "agent", "execution", "config"),
  
  // Versioning
  schemaVersion: SchemaVersion,
  dataVersion: S.String.withDefault("1.0.0"),
  
  // System context
  systemInfo: S.optional(SystemInfo),
  userContext: S.optional(UserContext),
  
  // Audit trail
  audit: AuditInfo,
  
  // Performance tracking
  metrics: S.optional(PerformanceMetrics),
  
  // Dependencies
  dependencies: S.optional(DependencyInfo),
  
  // Custom metadata
  custom: S.optional(S.Record(S.String, S.Unknown)),
  
  // Validation metadata
  lastValidated: S.optional(S.DateFromString),
  validationErrors: S.optional(S.Array(S.String)),
  validationWarnings: S.optional(S.Array(S.String)),
  
  // Migration metadata
  migrationHistory: S.optional(S.Array(S.Struct({
    fromVersion: S.String,
    toVersion: S.String,
    migratedAt: S.DateFromString,
    migrationNotes: S.optional(S.String)
  })))
});

/**
 * Configuration file wrapper with metadata
 */
export const ConfigurationFile = S.Struct({
  // File metadata
  metadata: FlowMetadata,
  
  // Configuration data (flexible)
  data: S.Unknown,
  
  // File integrity
  checksum: S.optional(S.String),
  signature: S.optional(S.String)
});

/**
 * JSDoc type definitions for JavaScript development
 * 
 * @typedef {S.Schema.Type<typeof FlowMetadata>} FlowMetadataType
 * @typedef {S.Schema.Type<typeof SchemaVersion>} SchemaVersionType
 * @typedef {S.Schema.Type<typeof ConfigurationFile>} ConfigurationFileType
 * @typedef {S.Schema.Type<typeof SystemInfo>} SystemInfoType
 */ 