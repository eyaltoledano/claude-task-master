/**
 * tools/index.js
 * Export all Task Master CLI tools for MCP server
 */

import { registerListTasksTool } from './get-tasks.js';
import logger from '../logger.js';
import { registerSetTaskStatusTool } from './set-task-status.js';
import { registerParsePRDTool } from './parse-prd.js';
import { registerUpdateTool } from './update.js';
import { registerUpdateTaskTool } from './update-task.js';
import { registerUpdateSubtaskTool } from './update-subtask.js';
import { registerGenerateTool } from './generate.js';
import { registerShowTaskTool } from './get-task.js';
import { registerNextTaskTool } from './next-task.js';
import { registerExpandTaskTool } from './expand-task.js';
import { registerAddTaskTool } from './add-task.js';
import { registerAddSubtaskTool } from './add-subtask.js';
import { registerRemoveSubtaskTool } from './remove-subtask.js';
import { registerAnalyzeTool } from './analyze.js';
import { registerClearSubtasksTool } from './clear-subtasks.js';
import { registerExpandAllTool } from './expand-all.js';
import { registerRemoveDependencyTool } from './remove-dependency.js';
import { registerValidateDependenciesTool } from './validate-dependencies.js';
import { registerFixDependenciesTool } from './fix-dependencies.js';
import { registerComplexityReportTool } from './complexity-report.js';
import { registerAddDependencyTool } from './add-dependency.js';
import { registerRemoveTaskTool } from './remove-task.js';
import { registerInitializeProjectTool } from './initialize-project.js';
import { asyncOperationManager } from '../core/utils/async-manager.js';

/**
 * Register all Task Master tools with the MCP server
 * @param {Object} server - FastMCP server instance
 * @param {asyncOperationManager} asyncManager - The async operation manager instance
 */
export function registerTaskMasterTools(server, asyncManager) {
	try {
		// Register each tool
		registerListTasksTool(server);
		registerSetTaskStatusTool(server);
		registerParsePRDTool(server);
		registerUpdateTool(server);
		registerUpdateTaskTool(server);
		registerUpdateSubtaskTool(server);
		registerGenerateTool(server);
		registerShowTaskTool(server);
		registerNextTaskTool(server);
		registerExpandTaskTool(server);
		registerAddTaskTool(server, asyncManager);
		registerAddSubtaskTool(server);
		registerRemoveSubtaskTool(server);
		registerAnalyzeTool(server);
		registerClearSubtasksTool(server);
		registerExpandAllTool(server);
		registerRemoveDependencyTool(server);
		registerValidateDependenciesTool(server);
		registerFixDependenciesTool(server);
		registerComplexityReportTool(server);
		registerAddDependencyTool(server);
		registerRemoveTaskTool(server);
		registerInitializeProjectTool(server);
	} catch (error) {
		logger.error(`Error registering Task Master tools: ${error.message}`);
		throw error;
	}
}

export default {
	registerTaskMasterTools
};
