/**
 * Task Master Flow - Sandbox Configuration Schema
 * Phase 1: Schema & Storage Layer
 *
 * Security-focused sandbox configuration with provider abstraction and resource management.
 * Simplified version for Phase 1 - using optional fields instead of defaults.
 */

import { Schema as S } from 'effect';

/**
 * Supported sandbox providers (research-backed)
 */
export const SandboxProvider = S.Literal('mock', 'e2b', 'northflank', 'modal');

/**
 * Resource configuration for sandbox environments
 * Includes security-focused limits and constraints
 */
export const SandboxResourceConfig = S.Struct({
	// Core resources
	cpu: S.Number.pipe(
		S.clamp(0.1, 16), // 0.1 to 16 CPU cores
		S.brand('CPUCores')
	),
	memory: S.Number.pipe(
		S.clamp(128, 32768), // 128MB to 32GB
		S.brand('MemoryMB')
	),
	disk: S.optional(
		S.Number.pipe(
			S.clamp(512, 102400), // 512MB to 100GB
			S.brand('DiskMB')
		)
	),

	// Time constraints
	timeout: S.optional(
		S.Number.pipe(
			S.clamp(30, 3600), // 30 seconds to 1 hour
			S.brand('TimeoutSeconds')
		)
	),

	// Network bandwidth (Mbps)
	networkBandwidth: S.optional(
		S.Number.pipe(S.clamp(1, 1000), S.brand('NetworkMbps'))
	)
});

/**
 * Networking configuration with security controls
 */
export const SandboxNetworking = S.Struct({
	// Network access controls
	blockInternal: S.optional(S.Boolean),
	allowedDomains: S.optional(S.Array(S.String)),
	blockedDomains: S.optional(S.Array(S.String)),

	// Port management
	allowedPorts: S.optional(S.Array(S.Number)),
	blockedPorts: S.optional(S.Array(S.Number))
});

/**
 * File system configuration
 */
export const SandboxFileSystem = S.Struct({
	// Access mode
	readOnly: S.optional(S.Boolean),

	// Allowed paths (whitelist)
	allowedPaths: S.optional(S.Array(S.String)),

	// Blocked paths (blacklist)
	blockedPaths: S.optional(S.Array(S.String)),

	// Mount points
	mountPoints: S.optional(
		S.Array(
			S.Struct({
				source: S.String,
				target: S.String,
				readonly: S.optional(S.Boolean)
			})
		)
	)
});

/**
 * Security configuration for sandbox isolation
 */
export const SandboxSecurity = S.Struct({
	// Linux capabilities to drop (security hardening)
	droppedCapabilities: S.optional(S.Array(S.String)),

	// System calls to block
	blockedSyscalls: S.optional(S.Array(S.String)),

	// Security features
	enableSeccomp: S.optional(S.Boolean),
	nonRootUser: S.optional(S.Boolean)
});

/**
 * Main sandbox configuration schema
 */
export const SandboxConfig = S.Struct({
	// Version tracking
	version: S.optional(S.String),

	// Provider identification
	provider: SandboxProvider,

	// Resource allocation
	resources: SandboxResourceConfig,

	// Security and access controls
	networking: S.optional(SandboxNetworking),
	fileSystem: S.optional(SandboxFileSystem),
	security: S.optional(SandboxSecurity),

	// Metadata
	name: S.String,
	description: S.optional(S.String),
	createdAt: S.optional(S.DateFromString),

	// Environment variables
	environment: S.optional(S.Record(S.String, S.String))
});

/**
 * JSDoc type definitions for JavaScript development
 *
 * @typedef {S.Schema.Type<typeof SandboxConfig>} SandboxConfigType
 * @typedef {S.Schema.Type<typeof SandboxProvider>} SandboxProviderType
 * @typedef {S.Schema.Type<typeof SandboxResourceConfig>} SandboxResourceConfigType
 */
