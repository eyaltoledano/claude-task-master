/**
 * Type definitions for Snowflake Cortex built-in tools
 */

/**
 * File metadata returned by skills loader and file operations
 */
export interface FileInfo {
	/** Relative path to the file */
	path: string;
	/** File size in bytes */
	size: number;
	/** File type based on extension */
	type: string;
	/** Last modified timestamp */
	modified?: Date;
}

/**
 * Skill metadata parsed from YAML front-matter
 */
export interface SkillMetadata {
	/** Skill name from front-matter */
	name: string;
	/** Skill description from front-matter */
	description: string;
	/** Path to the skill directory */
	path: string;
	/** All files in the skill directory (including subdirectories) */
	files: FileInfo[];
}

/**
 * Result from list_skills tool
 */
export interface ListSkillsResult {
	skills: SkillMetadata[];
	totalSkills: number;
	searchedDirectories: string[];
}

/**
 * Web search result item
 */
export interface SearchResult {
	/** Page title */
	title: string;
	/** Page URL */
	url: string;
	/** Search result snippet */
	snippet: string;
}

/**
 * Result from web_search tool
 */
export interface WebSearchResult {
	query: string;
	results: SearchResult[];
	totalResults: number;
}

/**
 * Result from fetch_url tool
 */
export interface FetchUrlResult {
	url: string;
	title: string;
	/** Content in markdown or plain text format */
	content: string;
	/** Length of the content */
	contentLength: number;
	/** Format of the returned content */
	format: 'markdown' | 'text';
}

/**
 * Project tree node
 */
export interface TreeNode {
	name: string;
	type: 'file' | 'directory';
	path: string;
	children?: TreeNode[];
	size?: number;
}

/**
 * Result from project_tree tool
 */
export interface ProjectTreeResult {
	root: string;
	tree: TreeNode[];
	totalFiles: number;
	totalDirectories: number;
}

/**
 * Result from file_search tool
 */
export interface FileSearchResult {
	pattern: string;
	directory: string;
	matches: FileInfo[];
	totalMatches: number;
	truncated: boolean;
}

/**
 * Result from file_read tool
 */
export interface FileReadResult {
	path: string;
	content: string;
	startLine?: number;
	endLine?: number;
	totalLines: number;
}

/**
 * Match result from grep tool
 */
export interface GrepMatch {
	file: string;
	line: number;
	content: string;
	context: {
		before: string[];
		after: string[];
	};
}

/**
 * Result from grep tool
 */
export interface GrepResult {
	pattern: string;
	directory: string;
	matches: GrepMatch[];
	totalMatches: number;
	truncated: boolean;
}

/**
 * TaskMaster task summary
 */
export interface TaskSummary {
	id: string;
	title: string;
	status: string;
	priority: string;
	dependencies: string[];
	hasSubtasks: boolean;
}

/**
 * Full TaskMaster task details (as loaded from tasks.json)
 * Note: subtasks in tasks.json also have full details, not just summaries
 */
export interface TaskDetails extends TaskSummary {
	description: string;
	details?: string;
	testStrategy?: string;
	subtasks?: TaskDetails[]; // Changed from TaskSummary[] - subtasks have full details in JSON
}

/**
 * Result from list_tasks tool
 */
export interface ListTasksResult {
	tasks: TaskSummary[];
	totalTasks: number;
	tag?: string;
}

/**
 * Result from get_current_context tool
 */
export interface CurrentContextResult {
	currentTag: string;
	inProgressTasks: TaskSummary[];
	recentlyCompleted: TaskSummary[];
	projectRoot: string;
}

/**
 * Cortex REST API tool format
 */
export interface CortexToolSpec {
	tool_spec: {
		type: 'generic';
		name: string;
		description: string;
		input_schema: Record<string, unknown>;
	};
	cache_control?: {
		type: 'ephemeral';
	};
}

/**
 * Tool call from Cortex API response
 */
export interface CortexToolCall {
	id: string;
	type: 'tool_use';
	name: string;
	input: Record<string, unknown>;
}

/**
 * Tool result to send back to Cortex API
 */
export interface CortexToolResult {
	type: 'tool_result';
	tool_use_id: string;
	content: string;
}

