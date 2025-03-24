#!/usr/bin/env node

/**
 * Command-line interface for task-master-mcp
 * Handles various commands like 'start', 'install', etc.
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command-line arguments
const [, , command, ...args] = process.argv;

// Handle different commands
async function main() {
  switch (command) {
    case "start":
      // Start the MCP server
      console.error("Starting Task Master MCP server...");

      try {
        // Instead of dynamic import, require the server module directly
        // This ensures the process stays alive as long as the server is running
        await import("./src/index.js");

        // Add this to prevent the process from exiting
        // The server will keep running until manually terminated
        process.stdin.resume();

        console.error("Server started successfully. Press Ctrl+C to stop.");
      } catch (err) {
        console.error("Failed to start MCP server:", err);
        process.exit(1);
      }
      break;

    case "install":
      // Install the MCP server in Cursor configuration
      console.error(
        "Installing Task Master MCP server in Cursor configuration..."
      );
      installInCursor();
      break;

    default:
      if (!command) {
        // Default to starting the server if no command is provided
        console.error("Starting Task Master MCP server (default command)...");
        try {
          await import("./src/index.js");

          // Keep process alive
          process.stdin.resume();

          console.error("Server started successfully. Press Ctrl+C to stop.");
        } catch (err) {
          console.error("Failed to start MCP server:", err);
          process.exit(1);
        }
      } else {
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
      }
  }
}

// Show help information
function showHelp() {
  console.error(`
Task Master MCP - CLI Interface

Usage:
  npx task-master-mcp [command] [options]

Commands:
  start             Start the MCP server (default)
  install           Install the MCP server in Cursor configuration

Environment Variables:
  TRANSPORT_TYPE    Set the transport type (stdio, sse)
  PORT              Set the port for SSE transport (default: 8080)
  
Examples:
  npx task-master-mcp start
  TRANSPORT_TYPE=sse npx task-master-mcp start
  npx task-master-mcp install
`);
}

// Install the MCP server in Cursor configuration
function installInCursor() {
  // Try to find the Cursor configuration file
  const homedir = process.env.HOME || process.env.USERPROFILE;
  const cursorConfigPaths = [
    resolve(homedir, ".cursor", "mcp.json"),
    resolve(homedir, "Library", "Application Support", "Cursor", "mcp.json"),
    resolve(homedir, "AppData", "Roaming", "Cursor", "mcp.json"),
  ];

  let configPath = null;
  for (const path of cursorConfigPaths) {
    if (fs.existsSync(path)) {
      configPath = path;
      break;
    }
  }

  if (!configPath) {
    console.error("Could not find Cursor configuration file.");
    console.error("Creating a local .cursor/mcp.json file instead.");
    configPath = resolve(process.cwd(), ".cursor", "mcp.json");

    // Create .cursor directory if it doesn't exist
    if (!fs.existsSync(dirname(configPath))) {
      fs.mkdirSync(dirname(configPath), { recursive: true });
    }
  }

  // Read existing configuration or create a new one
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, "utf8");
      config = JSON.parse(configContent);
    } catch (err) {
      console.error("Error reading Cursor configuration:", err);
      config = {};
    }
  }

  // Make sure mcpServers exists
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Add or update Task Master configuration
  config.mcpServers.TaskMaster = {
    name: "Task Master MCP",
    transport: "command",
    command: "npx",
    args: ["-y", "task-master-mcp", "start"],
    description: "MCP server for Task Master CLI integration",
  };

  // Write the updated configuration
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    console.error(`Successfully updated Cursor configuration at ${configPath}`);
    console.error("Task Master MCP server is now available in Cursor.");
  } catch (err) {
    console.error("Error writing Cursor configuration:", err);
    process.exit(1);
  }
}

// Run the main function
main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
