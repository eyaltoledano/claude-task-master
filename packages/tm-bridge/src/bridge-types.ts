/**
 * Shared types and interfaces for bridge functions
 */

import type { TmCore } from '@tm/core';

/**
 * Log levels used by bridge report functions
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

/**
 * Report function signature used by all bridges
 */
export type ReportFunction = (level: LogLevel, ...args: unknown[]) => void;

/**
 * Output format for bridge results
 */
export type OutputFormat = 'text' | 'json';

/**
 * Common parameters shared by all bridge functions
 */
export interface BaseBridgeParams {
	/** Project root directory */
	projectRoot: string;
	/** Whether called from MCP context (default: false) */
	isMCP?: boolean;
	/** Output format (default: 'text') */
	outputFormat?: OutputFormat;
	/** Logging function */
	report: ReportFunction;
	/** Optional tag for task organization */
	tag?: string;
}

/**
 * Result from checking if API storage should handle an operation
 */
export interface StorageCheckResult {
	/** Whether API storage is being used */
	isApiStorage: boolean;
	/** TmCore instance if initialization succeeded */
	tmCore?: TmCore;
	/** Error message if initialization failed */
	error?: string;
}
