#!/usr/bin/env node

/**
 * Installation script for task-master-mcp
 * Helps users install and configure the package
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.error("📦 Task Master MCP Installer");
console.error("============================");
console.error("");

// Helper function to run commands
function runCommand(command) {
  try {
    console.error(`> ${command}`);
    execSync(command, { stdio: "inherit" });
    return true;
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    return false;
  }
}

// Install the package globally
console.error("Installing task-master-mcp globally...");
if (!runCommand("npm install -g")) {
  console.error("Failed to install package globally.");
  process.exit(1);
}

// Configure Cursor
console.error("\nConfiguring Cursor integration...");
try {
  execSync("task-master-mcp install", { stdio: "inherit" });
} catch (error) {
  console.error("Failed to configure Cursor integration.");
  console.error(error.message);
}

console.error("\n✅ Installation complete!");
console.error("\nYou can now use the task-master-mcp command:");
console.error(
  "  task-master-mcp start              # Start the server with stdio transport"
);
console.error(
  "  TRANSPORT_TYPE=sse task-master-mcp start   # Start with SSE transport"
);
console.error("\nOr use npx:");
console.error("  npx -y task-master-mcp start");
console.error(
  '\nCursor should now have "Task Master MCP" available in its MCP tools.'
);
