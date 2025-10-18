/**
 * Shared types for MCP tools
 */

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

export interface WithProjectRoot {
	projectRoot: string;
}
