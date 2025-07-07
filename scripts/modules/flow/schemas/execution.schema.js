/**
 * Task Master Flow - Execution Configuration Schema
 * Phase 1: Schema & Storage Layer
 *
 * Execution configuration that combines sandbox and agent configurations for task execution.
 * Simplified version for Phase 1 - using optional fields instead of defaults.
 */

import { Schema as S } from 'effect';
import { SandboxConfig } from './sandbox.schema.js';
import { AgentConfig } from './agent.schema.js';

/**
 * Execution status enumeration
 */
export const ExecutionStatus = S.Literal(
	'pending',
	'queued',
	'running',
	'completed',
	'failed',
	'cancelled',
	'timeout'
);

/**
 * Execution priority levels
 */
export const ExecutionPriority = S.Literal('low', 'normal', 'high', 'urgent');

/**
 * Environment variables for execution
 * Separates sensitive and non-sensitive variables
 */
export const ExecutionEnvironment = S.Struct({
	// Non-sensitive environment variables
	variables: S.optional(S.Record(S.String, S.String)),

	// References to secret environment variables (stored securely)
	secrets: S.optional(S.Record(S.String, S.String))
});

/**
 * Input/Output configuration for execution
 */
export const ExecutionIO = S.Struct({
	// Output capture settings
	captureOutput: S.optional(S.Boolean),

	// Logging configuration
	logLevel: S.optional(S.Literal('error', 'warn', 'info', 'debug')),
	enableDetailedLogs: S.optional(S.Boolean),

	// Input data
	inputData: S.optional(S.String),

	// Expected output format
	outputFormat: S.optional(S.Literal('text', 'json', 'file'))
});

/**
 * Monitoring and observability configuration
 */
export const ExecutionMonitoring = S.Struct({
	// Enable monitoring features
	enableMetrics: S.optional(S.Boolean),
	enableHealthChecks: S.optional(S.Boolean),

	// Resource monitoring
	monitorCPU: S.optional(S.Boolean),
	monitorMemory: S.optional(S.Boolean),
	monitorDisk: S.optional(S.Boolean),
	monitorNetwork: S.optional(S.Boolean),

	// Performance metrics
	performanceThresholds: S.optional(
		S.Struct({
			maxCpuPercent: S.optional(S.Number.pipe(S.clamp(0, 100))),
			maxMemoryMB: S.optional(S.Number.pipe(S.clamp(1, 32768))),
			maxExecutionTime: S.optional(S.Number.pipe(S.clamp(1, 3600)))
		})
	)
});

/**
 * Error handling and recovery configuration
 */
export const ExecutionErrorHandling = S.Struct({
	// Recovery options
	enableRecovery: S.optional(S.Boolean),

	// Retry configuration
	retryOnFailure: S.optional(S.Boolean),
	retryOnTimeout: S.optional(S.Boolean),
	retryOnError: S.optional(S.Boolean),

	maxRetries: S.optional(S.Number.pipe(S.clamp(0, 5))),
	retryDelay: S.optional(S.Number.pipe(S.clamp(1, 300))) // seconds
});

/**
 * Execution result schema
 */
export const ExecutionResult = S.Struct({
	// Result metadata
	executionId: S.String,
	status: ExecutionStatus,

	// Timing information
	startTime: S.optional(S.DateFromString),
	endTime: S.optional(S.DateFromString),
	duration: S.optional(S.Number.pipe(S.brand('DurationMs'))),

	// Output and logs
	output: S.optional(S.String),
	errorOutput: S.optional(S.String),
	logs: S.optional(
		S.Array(
			S.Struct({
				timestamp: S.DateFromString,
				level: S.String,
				message: S.String
			})
		)
	),

	// Resource usage
	resourceUsage: S.optional(
		S.Struct({
			cpuTime: S.optional(S.Number),
			memoryPeak: S.optional(S.Number),
			diskUsage: S.optional(S.Number),
			networkUsage: S.optional(S.Number)
		})
	),

	// Error information
	error: S.optional(
		S.Struct({
			code: S.String,
			message: S.String,
			details: S.optional(S.String)
		})
	)
});

/**
 * Main execution configuration schema
 */
export const ExecutionConfig = S.Struct({
	// Version tracking
	version: S.optional(S.String),

	// Task identification
	taskId: S.String,

	// Configuration components
	sandbox: SandboxConfig,
	agent: AgentConfig,

	// Execution settings
	priority: S.optional(ExecutionPriority),
	status: S.optional(ExecutionStatus),

	// Environment and I/O
	environment: S.optional(ExecutionEnvironment),
	io: S.optional(ExecutionIO),

	// Monitoring and error handling
	monitoring: S.optional(ExecutionMonitoring),
	errorHandling: S.optional(ExecutionErrorHandling),

	// Metadata
	name: S.String,
	description: S.optional(S.String),
	createdAt: S.optional(S.DateFromString),

	// Custom configuration
	custom: S.optional(S.Record(S.String, S.Unknown))
});

/**
 * JSDoc type definitions for JavaScript development
 *
 * @typedef {S.Schema.Type<typeof ExecutionConfig>} ExecutionConfigType
 * @typedef {S.Schema.Type<typeof ExecutionStatus>} ExecutionStatusType
 * @typedef {S.Schema.Type<typeof ExecutionResult>} ExecutionResultType
 */
