#!/usr/bin/env node

/**
 * Task Master CLI MCP
 *
 * Single-command executor for Task Master MCP
 * Designed to be used like browser tools MCP with a simple command:
 * npx task-master-cli-mcp type "/task list"
 */

import {
  parseTaskCommand,
  validateCommand,
  executeCommand
} from '../lib/mcp/mcp.js';

async function main() {
  try {
    const args = process.argv.slice(2);

    // Check if 'type' command is present
    if (args.length === 0 || args[0] !== 'type') {
      console.error('Error: Missing "type" command');
      console.error('Usage: npx task-master-cli-mcp type "/task list"');
      process.exit(1);
    }

    // Get the command after 'type'
    const cmdArgs = args.slice(1);
    const command = cmdArgs.join(' ');

    if (!command) {
      console.error('Error: No command provided after "type"');
      console.error('Usage: npx task-master-cli-mcp type "/task list"');
      process.exit(1);
    }

    if (!command.startsWith('/task')) {
      console.error('Error: Command must start with /task');
      console.error('Usage: npx task-master-cli-mcp type "/task list"');
      process.exit(1);
    }

    const parsedCommand = parseTaskCommand(command);
    if (!parsedCommand) {
      console.error('Error: Failed to parse command');
      process.exit(1);
    }

    const validation = validateCommand(parsedCommand);
    if (!validation.success) {
      console.error(`Error: Invalid command: ${validation.error}`);
      if (validation.suggestedCommands) {
        console.log('\nSuggested commands:');
        validation.suggestedCommands.forEach((cmd) => {
          console.log(`  /task ${cmd}`);
        });
      }
      process.exit(1);
    }

    // Execute the command and print the output
    const output = await executeCommand(parsedCommand);
    console.log(output);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
