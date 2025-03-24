/**
 * Utility functions for task-master MCP server
 */

import { UserError } from "fastmcp";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import chalk from "chalk";

// Determine the base directory for task-master CLI
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const basePath = resolve(__dirname, "../../");
const devScriptPath = resolve(basePath, "./scripts/dev.js");

// MCP JSONRPC Error Codes
export const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32000,
  SERVER_ERROR_END: -32099,
  USER_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
};

/**
 * Execute a task-master CLI command
 * @param {string} command - The CLI command to execute
 * @param {string[]} args - Command arguments
 * @returns {Promise<{stdout: string, stderr: string}>} - Command output
 */
export function executeCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    // Print the command being executed
    console.error(
      chalk.blue(`Executing command: ${command} ${args.join(" ")}`)
    );

    let stdout = "";
    let stderr = "";

    const childProcess = spawn("node", [devScriptPath, command, ...args], {
      cwd: basePath,
    });

    childProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    childProcess.on("close", (code) => {
      if (code !== 0) {
        reject(
          new UserError(`Command failed with exit code ${code}: ${stderr}`)
        );
      } else {
        resolve({ stdout, stderr });
      }
    });

    childProcess.on("error", (err) => {
      reject(new UserError(`Failed to execute command: ${err.message}`));
    });
  });
}

/**
 * Parse boolean parameter from string or boolean
 * @param {string|boolean} value - The value to parse
 * @returns {boolean} - Parsed boolean value
 */
export function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  return false;
}

/**
 * Format error for MCP response
 * @param {Error} error - The error to format
 * @returns {object} - Formatted error object
 */
export function formatError(error) {
  // Handle UserError specifically
  if (error instanceof UserError) {
    return {
      error: {
        code: error.code || ErrorCodes.USER_ERROR,
        message: error.message,
        data: error.data,
      },
    };
  }

  // Check if it's a known error type
  if (error.name === "InvalidParams") {
    return {
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: error.message,
        data: error.data,
      },
    };
  }

  if (error.name === "MethodNotFound") {
    return {
      error: {
        code: ErrorCodes.METHOD_NOT_FOUND,
        message: error.message,
        data: error.data,
      },
    };
  }

  // Default to internal error
  return {
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message || "Unknown error",
      data: error.stack,
    },
  };
}

/**
 * Create a standard MCP response object
 * @param {string|object} result - The result data
 * @returns {object} - Formatted response object
 */
export function formatResponse(result) {
  // If result is already an object with content property, return it
  if (result && typeof result === "object" && result.content) {
    return result;
  }

  // If result is a string, wrap it in a text content object
  if (typeof result === "string") {
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }

  // Otherwise, try to stringify the result
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

/**
 * Adapter function to handle Cursor MCP client specifics
 * @param {object} response - The standard MCP response
 * @returns {object} - Cursor-compatible response
 */
export function cursorAdapter(response) {
  // Cursor expects a specific format for errors
  if (response.error) {
    return {
      error: {
        code: response.error.code,
        message: response.error.message,
        data: {
          details: response.error.data,
        },
      },
    };
  }

  // For successful responses, ensure content is properly formatted
  if (response.content) {
    // Cursor handles content arrays well, but we can add special handling if needed
    return response;
  }

  return response;
}
