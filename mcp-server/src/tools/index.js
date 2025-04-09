/**
 * tools/index.js
 * Export all Task Master CLI tools for MCP server
 */

import logger from "../logger.js";
import { registerListTasksTool } from "./listTasks.js";
import { registerShowTaskTool } from "./showTask.js";
import { registerSetTaskStatusTool } from "./setTaskStatus.js";
import { registerExpandTaskTool } from "./expandTask.js";
import { registerNextTaskTool } from "./nextTask.js";
import { registerAddTaskTool } from "./addTask.js";
import { registerScanWorkspaceTool } from "./scanWorkspace.js";

/**
 * Register all Task Master tools with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerTaskMasterTools(server) {
  registerListTasksTool(server);
  registerShowTaskTool(server);
  registerSetTaskStatusTool(server);
  registerExpandTaskTool(server);
  registerNextTaskTool(server);
  registerAddTaskTool(server);
  registerScanWorkspaceTool(server);
}

export default {
  registerTaskMasterTools,
};
