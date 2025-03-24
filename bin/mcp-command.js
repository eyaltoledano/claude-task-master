#!/usr/bin/env node

/**
 * MCP Command Runner
 *
 * Utility script for executing MCP commands directly
 * Usage: node mcp-command.js "/task list"
 *        ./mcp-command.js "/task list"
 */

import { processMCPCommand } from "../lib/mcp/mcp.js";
import { loadConfig } from "../lib/mcp/mcp-config.js";

async function main() {
  try {
    // Get the command from command line arguments
    const args = process.argv.slice(2);
    let command = args.join(" ");

    // Handle case where no command is provided
    if (!command) {
      // Check if piped input is available
      if (!process.stdin.isTTY) {
        // Read from stdin
        let data = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => {
          data += chunk;
        });

        await new Promise((resolve) => {
          process.stdin.on("end", () => {
            command = data.trim();
            resolve();
          });
        });
      } else {
        // No input provided
        console.error("Error: No command provided");
        console.error('Usage: mcp-command.js "/task list"');
        process.exit(1);
      }
    }

    // Load the MCP configuration
    const config = await loadConfig();

    // Process the command
    const result = await processMCPCommand(command, null, config);

    if (!result.processed) {
      console.error("Error: Not a valid MCP command");
      process.exit(1);
    }

    if (!result.success) {
      if (result.error) {
        console.error(`Error: ${result.error}`);
      }

      if (result.suggestedCommands) {
        console.log("\nSuggested commands:");
        result.suggestedCommands.forEach((cmd) => {
          console.log(`  /task ${cmd}`);
        });
      }

      process.exit(1);
    }

    // If successfully processed, output the result
    if (result.output) {
      console.log(result.output);
    } else {
      console.log("Command processed successfully");
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
