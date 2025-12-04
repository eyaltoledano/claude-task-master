/**
 * Snowflake Cortex Built-in Tools
 *
 * Provides Cortex Code CLI-like capabilities for the Native Cortex REST provider:
 * - Skills loading with progressive context
 * - Web research (no API key required)
 * - File operations (search, read, grep, tree)
 * - TaskMaster integration
 * - Optional MCP server bridge
 *
 * All tools are designed to work without additional API keys.
 */

// Export types
export * from './types.js';

// Export individual tools
export { listSkillsTool } from './skills-loader.js';
export { webSearchTool, fetchUrlTool } from './web-research.js';
export {
	projectTreeTool,
	fileSearchTool,
	fileReadTool,
	grepTool
} from './file-operations.js';
export {
	listTasksTool,
	getTaskTool,
	getNextTaskTool,
	getCurrentContextTool
} from './taskmaster.js';

// Export MCP bridge
export {
	isMcpAvailable,
	createMcpTools,
	convertMcpToolsToCortexFormat,
	createSnowflakeMcpTools,
	type McpServerConfig,
	type McpTool,
	type McpClient
} from './mcp-bridge.js';

// Import for convenience sets
import { listSkillsTool } from './skills-loader.js';
import { webSearchTool, fetchUrlTool } from './web-research.js';
import {
	projectTreeTool,
	fileSearchTool,
	fileReadTool,
	grepTool
} from './file-operations.js';
import {
	listTasksTool,
	getTaskTool,
	getNextTaskTool,
	getCurrentContextTool
} from './taskmaster.js';

/**
 * Full research tool set - all built-in tools
 *
 * Includes:
 * - listSkills: List available skills with metadata and file inventory
 * - webSearch: Search the web using DuckDuckGo
 * - fetchUrl: Fetch URL content and convert to markdown
 * - projectTree: Generate project structure tree
 * - fileSearch: Search for files by pattern
 * - fileRead: Read file contents
 * - grep: Search for patterns in files
 * - listTasks: List TaskMaster tasks
 * - getTask: Get detailed task information
 * - getNextTask: Get next task to work on
 * - getCurrentContext: Get current TaskMaster context
 */
export const snowflakeResearchTools = {
	listSkills: listSkillsTool,
	webSearch: webSearchTool,
	fetchUrl: fetchUrlTool,
	projectTree: projectTreeTool,
	fileSearch: fileSearchTool,
	fileRead: fileReadTool,
	grep: grepTool,
	listTasks: listTasksTool,
	getTask: getTaskTool,
	getNextTask: getNextTaskTool,
	getCurrentContext: getCurrentContextTool
};

/**
 * Minimal tool set for simple research tasks
 *
 * Includes only the most essential tools:
 * - webSearch: Search the web
 * - fetchUrl: Fetch and extract URL content
 * - fileRead: Read file contents
 */
export const snowflakeMinimalTools = {
	webSearch: webSearchTool,
	fetchUrl: fetchUrlTool,
	fileRead: fileReadTool
};

/**
 * File-focused tool set for codebase exploration
 *
 * Includes:
 * - projectTree: Generate project structure tree
 * - fileSearch: Search for files by pattern
 * - fileRead: Read file contents
 * - grep: Search for patterns in files
 */
export const snowflakeFileTools = {
	projectTree: projectTreeTool,
	fileSearch: fileSearchTool,
	fileRead: fileReadTool,
	grep: grepTool
};

/**
 * TaskMaster-focused tool set
 *
 * Includes:
 * - listTasks: List TaskMaster tasks
 * - getTask: Get detailed task information
 * - getNextTask: Get next task to work on
 * - getCurrentContext: Get current TaskMaster context
 */
export const snowflakeTaskTools = {
	listTasks: listTasksTool,
	getTask: getTaskTool,
	getNextTask: getNextTaskTool,
	getCurrentContext: getCurrentContextTool
};

/**
 * Web research tool set
 *
 * Includes:
 * - webSearch: Search the web using DuckDuckGo
 * - fetchUrl: Fetch URL content and convert to markdown
 */
export const snowflakeWebTools = {
	webSearch: webSearchTool,
	fetchUrl: fetchUrlTool
};

/**
 * Default export with all tool sets
 */
export default {
	// Full tool set
	research: snowflakeResearchTools,

	// Focused tool sets
	minimal: snowflakeMinimalTools,
	file: snowflakeFileTools,
	task: snowflakeTaskTools,
	web: snowflakeWebTools,

	// Individual tools
	tools: {
		listSkills: listSkillsTool,
		webSearch: webSearchTool,
		fetchUrl: fetchUrlTool,
		projectTree: projectTreeTool,
		fileSearch: fileSearchTool,
		fileRead: fileReadTool,
		grep: grepTool,
		listTasks: listTasksTool,
		getTask: getTaskTool,
		getNextTask: getNextTaskTool,
		getCurrentContext: getCurrentContextTool
	}
};
