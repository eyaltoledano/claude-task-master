/**
 * tool-registry.js
 * Tool Registry - Maps tool names to registration functions
 */

import { registerSetTaskStatusTool } from './set-task-status.js';
import { registerParsePRDTool } from './parse-prd.js';
import { registerUpdateTool } from './update.js';
import { registerUpdateTaskTool } from './update-task.js';
import { registerUpdateSubtaskTool } from './update-subtask.js';
import { registerGenerateTool } from './generate.js';
import { registerNextTaskTool } from './next-task.js';
import { registerExpandTaskTool } from './expand-task.js';
import { registerAddTaskTool } from './add-task.js';
import { registerAddSubtaskTool } from './add-subtask.js';
import { registerRemoveSubtaskTool } from './remove-subtask.js';
import { registerAnalyzeProjectComplexityTool } from './analyze.js';
import { registerClearSubtasksTool } from './clear-subtasks.js';
import { registerExpandAllTool } from './expand-all.js';
import { registerRemoveDependencyTool } from './remove-dependency.js';
import { registerValidateDependenciesTool } from './validate-dependencies.js';
import { registerFixDependenciesTool } from './fix-dependencies.js';
import { registerComplexityReportTool } from './complexity-report.js';
import { registerAddDependencyTool } from './add-dependency.js';
import { registerRemoveTaskTool } from './remove-task.js';
import { registerInitializeProjectTool } from './initialize-project.js';
import { registerModelsTool } from './models.js';
import { registerMoveTaskTool } from './move-task.js';
import { registerResponseLanguageTool } from './response-language.js';
import { registerAddTagTool } from './add-tag.js';
import { registerDeleteTagTool } from './delete-tag.js';
import { registerListTagsTool } from './list-tags.js';
import { registerUseTagTool } from './use-tag.js';
import { registerRenameTagTool } from './rename-tag.js';
import { registerCopyTagTool } from './copy-tag.js';
import { registerResearchTool } from './research.js';
import { registerRulesTool } from './rules.js';
import { registerScopeUpTool } from './scope-up.js';
import { registerScopeDownTool } from './scope-down.js';

// Import TypeScript tools from apps/mcp
import {
	registerAutopilotStartTool,
	registerAutopilotResumeTool,
	registerAutopilotNextTool,
	registerAutopilotStatusTool,
	registerAutopilotCompleteTool,
	registerAutopilotCommitTool,
	registerAutopilotFinalizeTool,
	registerAutopilotAbortTool,
	registerGetTasksTool,
	registerGetTaskTool
} from '@tm/mcp';

/**
 * Comprehensive tool registry mapping all 44 tool names to their registration functions
 * Used for dynamic tool registration and validation
 */
export const toolRegistry = {
	initialize_project: registerInitializeProjectTool,
	models: registerModelsTool,
	rules: registerRulesTool,
	parse_prd: registerParsePRDTool,
	'response-language': registerResponseLanguageTool,
	analyze_project_complexity: registerAnalyzeProjectComplexityTool,
	expand_task: registerExpandTaskTool,
	expand_all: registerExpandAllTool,
	scope_up_task: registerScopeUpTool,
	scope_down_task: registerScopeDownTool,
	get_tasks: registerGetTasksTool,
	get_task: registerGetTaskTool,
	next_task: registerNextTaskTool,
	complexity_report: registerComplexityReportTool,
	set_task_status: registerSetTaskStatusTool,
	generate: registerGenerateTool,
	add_task: registerAddTaskTool,
	add_subtask: registerAddSubtaskTool,
	update: registerUpdateTool,
	update_task: registerUpdateTaskTool,
	update_subtask: registerUpdateSubtaskTool,
	remove_task: registerRemoveTaskTool,
	remove_subtask: registerRemoveSubtaskTool,
	clear_subtasks: registerClearSubtasksTool,
	move_task: registerMoveTaskTool,
	add_dependency: registerAddDependencyTool,
	remove_dependency: registerRemoveDependencyTool,
	validate_dependencies: registerValidateDependenciesTool,
	fix_dependencies: registerFixDependenciesTool,
	list_tags: registerListTagsTool,
	add_tag: registerAddTagTool,
	delete_tag: registerDeleteTagTool,
	use_tag: registerUseTagTool,
	rename_tag: registerRenameTagTool,
	copy_tag: registerCopyTagTool,
	research: registerResearchTool,
	autopilot_start: registerAutopilotStartTool,
	autopilot_resume: registerAutopilotResumeTool,
	autopilot_next: registerAutopilotNextTool,
	autopilot_status: registerAutopilotStatusTool,
	autopilot_complete: registerAutopilotCompleteTool,
	autopilot_commit: registerAutopilotCommitTool,
	autopilot_finalize: registerAutopilotFinalizeTool,
	autopilot_abort: registerAutopilotAbortTool
};

/**
 * Core tools array containing the 7 essential tools for daily development
 * These represent the minimal set needed for basic task management operations
 */
export const coreTools = [
	'get_tasks',
	'next_task',
	'get_task',
	'set_task_status',
	'update_subtask',
	'parse_prd',
	'expand_task'
];

/**
 * Standard tools array containing the 15 most commonly used tools
 * Includes all core tools plus frequently used additional tools
 */
export const standardTools = [
	...coreTools,
	'initialize_project',
	'analyze_project_complexity',
	'expand_all',
	'add_subtask',
	'remove_task',
	'generate',
	'add_task',
	'complexity_report'
];

/**
 * Get all available tool names
 * @returns {string[]} Array of tool names
 */
export function getAvailableTools() {
	return Object.keys(toolRegistry);
}

/**
 * Get tool counts for all categories
 * @returns {Object} Object with core, standard, and total counts
 */
export function getToolCounts() {
	return {
		core: coreTools.length,
		standard: standardTools.length,
		total: Object.keys(toolRegistry).length
	};
}

/**
 * Get tool arrays organized by category
 * @returns {Object} Object with arrays for each category
 */
export function getToolCategories() {
	const allTools = Object.keys(toolRegistry);
	return {
		core: [...coreTools],
		standard: [...standardTools],
		all: [...allTools],
		extended: allTools.filter((t) => !standardTools.includes(t))
	};
}

/**
 * Get registration function for a specific tool
 * @param {string} toolName - Name of the tool
 * @returns {Function|null} Registration function or null if not found
 */
export function getToolRegistration(toolName) {
	return toolRegistry[toolName] || null;
}

/**
 * Validate if a tool exists in the registry
 * @param {string} toolName - Name of the tool
 * @returns {boolean} True if tool exists
 */
export function isValidTool(toolName) {
	return toolName in toolRegistry;
}

export default toolRegistry;
