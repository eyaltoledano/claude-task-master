/**
 * Cursor MCP Integration Setup
 *
 * This file configures Cursor to recognize /task commands and execute them via task-master
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Sets up Cursor MCP integration for task-master
 *
 * @param {string} workingDir - The directory to set up cursor integration in
 * @param {boolean} silent - Whether to silence log messages
 * @returns {boolean} - Whether the setup was successful
 */
export async function setupCursorIntegration(
  workingDir = process.cwd(),
  silent = false
) {
  try {
    // Ensure the .cursor directory exists
    const cursorDir = path.join(workingDir, ".cursor");
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
      if (!silent) console.log("Created .cursor directory");
    }

    // Create or update the settings.json file
    const settingsPath = path.join(cursorDir, "settings.json");
    let settings = {};

    // If the file exists, read it first
    if (fs.existsSync(settingsPath)) {
      try {
        const fileContent = fs.readFileSync(settingsPath, "utf8");
        settings = JSON.parse(fileContent);
        if (!silent) console.log("Found existing Cursor settings file");
      } catch (err) {
        if (!silent)
          console.log("Error reading settings file, creating new one");
        settings = {};
      }
    }

    // Add or update the MCP command configuration
    if (!settings.mcp) {
      settings.mcp = {};
    }

    // Add the task command
    settings.mcp.commands = settings.mcp.commands || {};
    settings.mcp.commands.task = {
      name: "task",
      description: "Run task-master commands directly",
      execute: ["npx", "task-master", "mcp", "/task {input}"],
      suggest: [
        "list",
        "next",
        "show",
        "expand",
        "set-status",
        "add-task",
        "help",
      ],
    };

    // Write the updated settings file
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    if (!silent)
      console.log("Successfully set up Cursor integration for task-master!");
    if (!silent)
      console.log("You can now use /task commands directly in Cursor");

    return true;
  } catch (err) {
    if (!silent)
      console.error("Error setting up Cursor integration:", err.message);
    return false;
  }
}

// If this file is run directly, execute the setup
if (import.meta.url === `file://${process.argv[1]}`) {
  setupCursorIntegration()
    .then((success) => {
      if (success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Unhandled error:", err);
      process.exit(1);
    });
}
