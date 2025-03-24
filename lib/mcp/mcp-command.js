#!/usr/bin/env node

/**
 * MCP Command Runner
 *
 * Utility script for executing MCP commands directly
 * Usage: node mcp-command.js "/task list"
 *        ./mcp-command.js "/task list"
 */

import { processMCPCommand } from '../lib/mcp/mcp.js';
import { loadConfig } from '../lib/mcp/mcp-config.js';
import {
  parseTaskCommand,
  validateCommand,
  executeCommand
} from '../lib/mcp/mcp.js';

/**
 * Execute a command directly without starting a server
 * This can be used for simple one-off command execution
 *
 * @param {string} command The command string to execute (e.g., "/task list")
 * @returns {Promise<string>} The command output
 */
async function executeDirectCommand(command) {
  try {
    if (!command.startsWith('/task')) {
      throw new Error('Command must start with /task');
    }

    const parsedCommand = parseTaskCommand(command);
    if (!parsedCommand) {
      throw new Error('Failed to parse command');
    }

    const validation = validateCommand(parsedCommand);
    if (!validation.success) {
      throw new Error(`Invalid command: ${validation.error}`);
    }

    return await executeCommand(parsedCommand);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  try {
    // Get the command from command line arguments
    const args = process.argv.slice(2);

    // Check if this is being called in direct execution mode
    const directModeFlags = ['type', 'exec', 'run'];
    if (directModeFlags.some((flag) => args.includes(flag))) {
      // Find the index of the flag
      let flagIndex = -1;
      for (const flag of directModeFlags) {
        const index = args.indexOf(flag);
        if (index !== -1) {
          flagIndex = index;
          break;
        }
      }

      // Extract the command after the flag
      const cmdArgs = args.slice(flagIndex + 1);
      const command = cmdArgs.join(' ');

      if (!command) {
        console.error('Error: No command provided after the execution flag');
        console.error('Usage: mcp-command.js type "/task list"');
        process.exit(1);
      }

      // Execute the command directly and output the result
      const output = await executeDirectCommand(command);
      console.log(output);
      process.exit(0);
    }

    // Otherwise, process as before for server/client mode
    let command = args.join(' ');

    // Handle case where no command is provided
    if (!command) {
      // Check if piped input is available
      if (!process.stdin.isTTY) {
        // Read from stdin
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
          data += chunk;
        });

        await new Promise((resolve) => {
          process.stdin.on('end', () => {
            command = data.trim();
            resolve();
          });
        });
      } else {
        // No input provided
        console.error('Error: No command provided');
        console.error('Usage: mcp-command.js "/task list"');
        console.error('       mcp-command.js type "/task list"');
        process.exit(1);
      }
    }

    // Load the MCP configuration
    const config = await loadConfig();

    // Process the command
    const result = await processMCPCommand(command, null, config);

    if (!result.processed) {
      console.error('Error: Not a valid MCP command');
      process.exit(1);
    }

    if (!result.success) {
      if (result.error) {
        console.error(`Error: ${result.error}`);
      }

      if (result.suggestedCommands) {
        console.log('\nSuggested commands:');
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
      console.log('Command processed successfully');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
