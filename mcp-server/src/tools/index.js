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
import { registerAddTagTool } from './add-tag.js';
import { registerDeleteTagTool } from './delete-tag.js';
import { registerListTagsTool } from './list-tags.js';
import { registerUseTagTool } from './use-tag.js';
import { registerRenameTagTool } from './rename-tag.js';
import { registerCopyTagTool } from './copy-tag.js';
import { registerResearchTool } from './research.js';

/**
 * Register all Task Master tools with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerTaskMasterTools(server) {
	try {
		// Register each tool in a logical workflow order

		// Group 1: Initialization & Setup
		registerInitializeProjectTool(server);
		registerModelsTool(server);
		registerParsePRDTool(server);

		// Group 2: Task Analysis & Expansion
		registerAnalyzeProjectComplexityTool(server);
		registerExpandTaskTool(server);
		registerExpandAllTool(server);

		// Group 3: Task Listing & Viewing
		registerListTasksTool(server);
		registerShowTaskTool(server);
		registerNextTaskTool(server);
		registerComplexityReportTool(server);

		// Group 4: Task Status & Management
		registerSetTaskStatusTool(server);
		registerGenerateTool(server);

		// Group 5: Task Creation & Modification
		registerAddTaskTool(server);
		registerAddSubtaskTool(server);
		registerUpdateTool(server);
		registerUpdateTaskTool(server);
		registerUpdateSubtaskTool(server);
		registerRemoveTaskTool(server);
		registerRemoveSubtaskTool(server);
		registerClearSubtasksTool(server);
		registerMoveTaskTool(server);

		// Group 6: Dependency Management
		registerAddDependencyTool(server);
		registerRemoveDependencyTool(server);
		registerValidateDependenciesTool(server);
		registerFixDependenciesTool(server);

		// Group 7: Tag Management
		registerListTagsTool(server);
		registerAddTagTool(server);
		registerDeleteTagTool(server);
		registerUseTagTool(server);
		registerRenameTagTool(server);
		registerCopyTagTool(server);

		// Group 8: Research Features
		registerResearchTool(server);
	} catch (error) {
		logger.error(`Error registering Task Master tools: ${error.message}`);
		throw error;
	}
}

export default {
	registerTaskMasterTools
};
