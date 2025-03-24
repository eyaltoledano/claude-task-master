/**
 * Model Context Protocol (MCP) for Task Master
 *
 * This module provides functionality to detect and process slash commands
 * for task-master operations within AI assistant conversations.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createRequire } from "module";
import { setupMCP } from "./mcp-config.js";
import { processQuery } from "./mcp-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Path to task-master bin script
const taskMasterPath = resolve(__dirname, "../../bin/task-master.js");

/**
 * Regular expression to match slash commands for task-master
 * Matches patterns like:
 * - /task list
 * - /task show 3
 * - /task expand --id=5
 * - /tasks next
 */
const TASK_COMMAND_REGEX = /^\/(task|tasks)\s+([a-z-]+)(\s+.+)?$/i;

/**
 * Map of supported task-master commands and their parameters
 */
const SUPPORTED_COMMANDS = {
  list: {
    description: "List all tasks",
    options: [
      { name: "status", flag: "-s", description: "Filter by status" },
      {
        name: "with-subtasks",
        flag: "--with-subtasks",
        description: "Show subtasks for each task",
      },
      {
        name: "file",
        flag: "-f",
        description: "Path to the tasks file",
        default: "tasks/tasks.json",
      },
    ],
  },
  next: {
    description: "Show the next task to work on",
    options: [
      {
        name: "file",
        flag: "-f",
        description: "Path to the tasks file",
        default: "tasks/tasks.json",
      },
    ],
  },
  show: {
    description: "Show details of a specific task",
    parameters: [
      { name: "id", description: "Task ID to show", required: true },
    ],
    options: [
      {
        name: "file",
        flag: "-f",
        description: "Path to the tasks file",
        default: "tasks/tasks.json",
      },
    ],
  },
  expand: {
    description: "Expand a task with subtasks",
    options: [
      {
        name: "id",
        flag: "--id",
        description: "Task ID to expand",
        required: true,
      },
      {
        name: "num",
        flag: "--num",
        description: "Number of subtasks to generate",
      },
      {
        name: "research",
        flag: "--research",
        description: "Use Perplexity AI for research-backed generation",
      },
      {
        name: "file",
        flag: "-f",
        description: "Path to the tasks file",
        default: "tasks/tasks.json",
      },
    ],
  },
  "set-status": {
    description: "Set the status of a task",
    options: [
      { name: "id", flag: "--id", description: "Task ID", required: true },
      {
        name: "status",
        flag: "--status",
        description: "New status",
        required: true,
      },
      {
        name: "file",
        flag: "-f",
        description: "Path to the tasks file",
        default: "tasks/tasks.json",
      },
    ],
  },
  "add-task": {
    description: "Add a new task",
    options: [
      {
        name: "prompt",
        flag: "--prompt",
        description: "Description of the task to add",
        required: true,
      },
      {
        name: "dependencies",
        flag: "--dependencies",
        description: "Comma-separated list of task IDs this task depends on",
      },
      {
        name: "priority",
        flag: "--priority",
        description: "Task priority (high, medium, low)",
        default: "medium",
      },
      {
        name: "file",
        flag: "-f",
        description: "Path to the tasks file",
        default: "tasks/tasks.json",
      },
    ],
  },
  help: {
    description: "Show help information for MCP commands",
    parameters: [
      {
        name: "command",
        description: "Command to show help for",
        required: false,
      },
    ],
  },
};

/**
 * Detects if a user query contains a task-master slash command
 * @param {string} userQuery - The user query to check
 * @returns {boolean} True if a slash command is detected
 */
export function detectTaskCommand(userQuery) {
  return TASK_COMMAND_REGEX.test(userQuery.trim());
}

/**
 * Parses a task-master slash command from a user query
 * @param {string} userQuery - The user query containing a slash command
 * @returns {object|null} Command object or null if invalid
 */
export function parseTaskCommand(userQuery) {
  const trimmedQuery = userQuery.trim();
  const match = trimmedQuery.match(TASK_COMMAND_REGEX);

  if (!match) return null;

  const [_, prefix, command, argsStr] = match;
  const args = argsStr ? argsStr.trim().split(/\s+/) : [];

  return {
    prefix,
    command,
    args,
    raw: trimmedQuery,
  };
}

/**
 * Validates a parsed command against supported commands
 * @param {object} parsedCommand - The parsed command object
 * @returns {object} Validation result with success and error properties
 */
export function validateCommand(parsedCommand) {
  if (!parsedCommand) {
    return { success: false, error: "Invalid command format" };
  }

  const { command } = parsedCommand;

  if (!SUPPORTED_COMMANDS[command]) {
    return {
      success: false,
      error: `Unknown command: ${command}`,
      suggestedCommands: Object.keys(SUPPORTED_COMMANDS),
    };
  }

  return { success: true };
}

/**
 * Executes a task-master command and returns the output
 * @param {object} parsedCommand - The parsed command object
 * @returns {Promise<string>} Command output
 */
export function executeCommand(parsedCommand) {
  return new Promise((resolve, reject) => {
    if (parsedCommand.command === "help") {
      // Special handling for help command
      const helpOutput = generateHelpOutput(parsedCommand.args[0]);
      return resolve(helpOutput);
    }

    const args = [parsedCommand.command, ...parsedCommand.args];

    const child = spawn("node", [taskMasterPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Generates help output for MCP commands
 * @param {string} [command] - Specific command to get help for
 * @returns {string} Help text
 */
function generateHelpOutput(command) {
  if (command && SUPPORTED_COMMANDS[command]) {
    const cmd = SUPPORTED_COMMANDS[command];
    let helpText = `## Help: /${command}\n\n`;
    helpText += `**Description**: ${cmd.description}\n\n`;

    if (cmd.parameters && cmd.parameters.length > 0) {
      helpText += "**Parameters**:\n";
      cmd.parameters.forEach((param) => {
        helpText += `- \`${param.name}\`: ${param.description}${
          param.required ? " (Required)" : ""
        }\n`;
      });
      helpText += "\n";
    }

    if (cmd.options && cmd.options.length > 0) {
      helpText += "**Options**:\n";
      cmd.options.forEach((option) => {
        helpText += `- \`${option.flag}\`: ${option.description}`;
        if (option.default) helpText += ` (Default: ${option.default})`;
        if (option.required) helpText += " (Required)";
        helpText += "\n";
      });
    }

    return helpText;
  }

  // Generate general help
  let helpText = "## Task Master MCP Commands\n\n";
  helpText += "Use slash commands to interact with Task Master:\n\n";

  Object.entries(SUPPORTED_COMMANDS).forEach(([cmd, info]) => {
    helpText += `- \`/task ${cmd}\`: ${info.description}\n`;
  });

  helpText +=
    "\nFor detailed help on a specific command, use `/task help <command>`";

  return helpText;
}

/**
 * Main function to process a user query for MCP commands
 * Uses the configured MCP server if available, falls back to direct execution
 * @param {string} userQuery - The user query
 * @param {string} serverName - Name of server to use (optional)
 * @param {object} config - MCP configuration (optional)
 * @returns {Promise<object>} Processing result
 */
export async function processMCPCommand(userQuery, serverName, config) {
  if (!detectTaskCommand(userQuery)) {
    return {
      processed: false,
      message: "No task command detected",
    };
  }

  try {
    // Try to use the configured MCP server
    return await processQuery(userQuery, serverName, config);
  } catch (error) {
    // Fall back to direct execution if the server isn't available
    console.warn(
      `MCP server error, falling back to direct execution: ${error.message}`
    );

    const parsedCommand = parseTaskCommand(userQuery);
    const validation = validateCommand(parsedCommand);

    if (!validation.success) {
      return {
        processed: true,
        success: false,
        error: validation.error,
        suggestedCommands: validation.suggestedCommands,
      };
    }

    try {
      const output = await executeCommand(parsedCommand);
      return {
        processed: true,
        success: true,
        command: parsedCommand,
        output,
      };
    } catch (error) {
      return {
        processed: true,
        success: false,
        command: parsedCommand,
        error: error.message,
      };
    }
  }
}

/**
 * Simplified setup function for MCP
 * @param {string} name - Server name
 * @param {string} type - Server type ('local', 'remote', 'custom')
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Additional options
 * @returns {Promise<object>} MCP configuration
 */
export async function setupTaskMasterMCP(
  name,
  type,
  command,
  args = [],
  options = {}
) {
  return setupMCP(name, type, command, args, options);
}

/**
 * Middleware for integrating MCP with AI assistants
 * @param {string} userQuery - The user query
 * @param {Function} next - Next function to call if not processed
 * @returns {Promise<object>} Processing result or next() result
 */
export async function mcpMiddleware(userQuery, next) {
  const result = await processMCPCommand(userQuery);

  if (result.processed) {
    return result;
  }

  return next();
}

export default {
  detectTaskCommand,
  parseTaskCommand,
  validateCommand,
  executeCommand,
  processMCPCommand,
  mcpMiddleware,
  setupTaskMasterMCP,
  SUPPORTED_COMMANDS,
};
