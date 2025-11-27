/**
 * Shared types for MCP tools
 */

import type { TmCore } from '@tm/core';

export interface MCPResponse<T = any> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
		suggestion?: string;
		details?: any;
	};
	version?: {
		version: string;
		name: string;
	};
	tag?: {
		currentTag: string;
		availableTags: string[];
	};
}

export interface MCPContext {
	log: {
		info: (message: string) => void;
		warn: (message: string) => void;
		error: (message: string) => void;
		debug: (message: string) => void;
	};
	session: any;
}

/**
 * Enhanced MCP context with tmCore instance
 */
export interface ToolContext {
	/** Logger instance (matches fastmcp's Context.log signature) */
	log: {
		info: (message: string, data?: any) => void;
		warn: (message: string, data?: any) => void;
		error: (message: string, data?: any) => void;
		debug: (message: string, data?: any) => void;
	};
	/** MCP session */
	session?: {
		roots?: Array<{ uri: string; name?: string }>;
		env?: Record<string, string>;
		clientCapabilities?: {
			sampling?: Record<string, unknown>;
		};
	};
	/** TmCore instance (already initialized) */
	tmCore: TmCore;
}

export interface WithProjectRoot {
	projectRoot: string;
}
