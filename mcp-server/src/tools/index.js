/**
 * index.js
 * 
 * This file registers all the Task Master tools with the MCP server.
 * When adding a new tool, import its register function and add it to the registerAllTools function.
 */

import { registerParseToolsTool } from './parse-prd.js';
import { registerExpandTaskTool } from './expand-task.js';
import { registerExpandAllTool } from './expand-all.js';
import { registerGetTasksTool } from './get-tasks.js';
import { registerGetTaskTool } from './get-task.js';
import { registerNextTaskTool } from './next-task.js';
import { registerSetTaskStatusTool } from './set-task-status.js';
import { registerAddTaskTool } from './add-task.js';
import { registerAddSubtaskTool } from './add-subtask.js';
import { registerRemoveTaskTool } from './remove-task.js';
import { registerRemoveSubtaskTool } from './remove-subtask.js';
import { registerClearSubtasksTool } from './clear-subtasks.js';
import { registerAddDependencyTool } from './add-dependency.js';
import { registerRemoveDependencyTool } from './remove-dependency.js';
import { registerValidateDependenciesTool } from './validate-dependencies.js';
import { registerFixDependenciesTool } from './fix-dependencies.js';
import { registerUpdateTaskTool } from './update-task.js';
import { registerUpdateSubtaskTool } from './update-subtask.js';
import { registerUpdateTool } from './update.js';
import { registerAnalyzeComplexityTool } from './analyze.js';
import { registerComplexityReportTool } from './complexity-report.js';
import { registerGenerateTaskFilesTool } from './generate.js';
import { registerScanWorkspaceTool } from './scan-workspace.js';
import { registerInitializeProjectTool } from './initialize-project.js';
import { registerListArchivesTool } from './list-archives.js';
import { registerRestoreArchiveTool } from './restore-archive.js';
import { registerClearCacheTool } from './clear-cache.js';

/**
 * Register all MCP tools with the provided server
 * @param {Object} server - MCP server instance or FastMCP instance
 */
export function registerAllTools(server) {
  // Determine which API we're working with
  const isLegacyAPI = server.registerTool !== undefined;
  const isNewAPI = server.tool !== undefined;
  
  if (!isLegacyAPI && !isNewAPI) {
    console.error("Unknown server API - can't register tools");
    return;
  }
  
  console.log(`Using ${isLegacyAPI ? 'legacy' : 'new'} FastMCP API for tool registration`);
  
  // Function to handle tool registration for both APIs
  const registerTool = (registerFn) => {
    if (isLegacyAPI) {
      registerFn(server); // Legacy API: pass server to the register function
    } else {
      // New API: the register function configures a tool on the FastMCP instance 
      // We might need to adapt each tool registration based on the actual API
      try {
        registerFn(server);
      } catch (error) {
        console.error(`Failed to register tool with new API: ${error.message}`);
      }
    }
  };
  
  // Task Creation and Generation
  registerTool(registerParseToolsTool);
  registerTool(registerScanWorkspaceTool);
  registerTool(registerAddTaskTool);
  registerTool(registerAddSubtaskTool);
  registerTool(registerInitializeProjectTool);
  
  // Task Retrieval and Navigation
  registerTool(registerGetTasksTool);
  registerTool(registerGetTaskTool);
  registerTool(registerNextTaskTool);
  registerTool(registerListArchivesTool);
  registerTool(registerRestoreArchiveTool);
  
  // Task Expansion and Analysis
  registerTool(registerExpandTaskTool);
  registerTool(registerExpandAllTool);
  registerTool(registerAnalyzeComplexityTool);
  registerTool(registerComplexityReportTool);
  
  // Task Management
  registerTool(registerSetTaskStatusTool);
  registerTool(registerUpdateTool);
  registerTool(registerUpdateTaskTool);
  registerTool(registerUpdateSubtaskTool);
  registerTool(registerRemoveTaskTool);
  registerTool(registerRemoveSubtaskTool);
  registerTool(registerClearSubtasksTool);
  registerTool(registerGenerateTaskFilesTool);
  
  // Dependency Management
  registerTool(registerAddDependencyTool);
  registerTool(registerRemoveDependencyTool);
  registerTool(registerValidateDependenciesTool);
  registerTool(registerFixDependenciesTool);
  
  // Utilities
  registerTool(registerClearCacheTool);
}
