/**
 * scanWorkspace.js
 * MCP tool to scan a workspace and generate tasks based on codebase analysis
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import logger from "../logger.js";
import { findModulePath } from "./utils.js";

/**
 * Register the scanWorkspace tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerScanWorkspaceTool(server) {
  server.addTool({
    name: "Task_Master_scanWorkspace",
    description: "Scan a workspace folder and generate tasks based on codebase analysis",
    schema: {
      type: "object",
      properties: {
        projectRoot: {
          description: "Root directory of the project (default: current working directory)",
          type: "string",
          required: true,
        },
        file: {
          description: "Path to save the tasks file",
          type: "string",
        },
        excludeDirs: {
          description: "Directories to exclude (comma-separated)",
          type: "string",
        },
        includeExtensions: {
          description: "File extensions to include (comma-separated)",
          type: "string",
        },
        name: {
          description: "Project name",
          type: "string",
        },
        version: {
          description: "Project version",
          type: "string",
        },
      },
      required: ["projectRoot"],
      additionalProperties: false,
    },
    handler: async (data, client) => {
      try {
        const projectRoot = data.projectRoot;
        const modulePath = await findModulePath("task-master-ai");
        
        // If no tasks directory exists, create it
        const tasksDir = path.join(projectRoot, "tasks");
        if (!fs.existsSync(tasksDir)) {
          fs.mkdirSync(tasksDir, { recursive: true });
        }

        const args = ["scan-workspace"];
        
        // Add directory argument
        args.push(projectRoot);
        
        // Add output file if specified
        if (data.file) {
          args.push("--output", data.file);
        }
        
        // Add excluded directories if specified
        if (data.excludeDirs) {
          args.push("--exclude", data.excludeDirs);
        }
        
        // Add included extensions if specified
        if (data.includeExtensions) {
          args.push("--include", data.includeExtensions);
        }
        
        // Add project name if specified
        if (data.name) {
          args.push("--name", data.name);
        }
        
        // Add project version if specified
        if (data.version) {
          args.push("--version", data.version);
        }
        
        // Log the command that will be run
        logger.debug(`Running: task-master ${args.join(" ")}`);
        
        // Run the command
        const child = spawn("task-master", args, {
          cwd: process.cwd(),
        });
        
        let stdout = "";
        let stderr = "";
        
        child.stdout.on("data", (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });
        
        return new Promise((resolve, reject) => {
          child.on("close", (code) => {
            if (code === 0) {
              resolve({
                success: true,
                message: "Workspace scanned successfully",
                stdout,
                stderr,
              });
            } else {
              reject(new Error(`Command failed with exit code ${code}\n${stderr}`));
            }
          });
          
          child.on("error", (err) => {
            reject(new Error(`Failed to run command: ${err.message}`));
          });
        });
      } catch (error) {
        logger.error(`Error scanning workspace: ${error.message}`);
        throw error;
      }
    },
  });
}

export default {
  registerScanWorkspaceTool,
}; 