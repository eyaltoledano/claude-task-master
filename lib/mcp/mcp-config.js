/**
 * MCP Configuration Module
 *
 * Handles loading and validating MCP configuration from various sources:
 * - JSON configuration files
 * - Environment variables
 * - Command-line parameters
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Default configuration paths to check
const DEFAULT_CONFIG_PATHS = [
  "mcp-config.json",
  ".mcp/config.json",
  "config/mcp.json",
];

// Default configuration
const DEFAULT_CONFIG = {
  mcpServers: {
    "task-master": {
      command: "node",
      args: [path.resolve(__dirname, "mcp-server.js")],
      type: "local",
    },
  },
  defaultServer: "task-master",
};

/**
 * Configuration schema for validation
 */
const CONFIG_SCHEMA = {
  mcpServers: {
    type: "object",
    required: true,
    properties: {
      "*": {
        type: "object",
        properties: {
          command: { type: "string", required: true },
          args: { type: "array", items: { type: "string" } },
          type: { type: "string", enum: ["local", "remote", "custom"] },
          // Additional properties for specific server types
          connectionString: { type: "string" },
          url: { type: "string" },
          options: { type: "object" },
        },
      },
    },
  },
  defaultServer: { type: "string" },
};

/**
 * Validates configuration against schema
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result with success and errors
 */
function validateConfig(config) {
  const errors = [];

  // Check if mcpServers exists and is an object
  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    errors.push('Configuration must include "mcpServers" object');
    return { success: false, errors };
  }

  // Check each server configuration
  Object.entries(config.mcpServers).forEach(([name, serverConfig]) => {
    if (!serverConfig.command) {
      errors.push(`Server "${name}" must specify a "command"`);
    }

    if (serverConfig.args && !Array.isArray(serverConfig.args)) {
      errors.push(`Server "${name}" args must be an array`);
    }

    if (
      serverConfig.type &&
      !["local", "remote", "custom"].includes(serverConfig.type)
    ) {
      errors.push(
        `Server "${name}" type must be one of: local, remote, custom`
      );
    }
  });

  // Check if defaultServer exists in mcpServers
  if (config.defaultServer && !config.mcpServers[config.defaultServer]) {
    errors.push(
      `Default server "${config.defaultServer}" not defined in mcpServers`
    );
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Loads configuration from a file
 * @param {string} filePath - Path to the configuration file
 * @returns {Promise<object|null>} Configuration object or null if file not found
 */
async function loadConfigFromFile(filePath) {
  try {
    const fileContents = await fs.readFile(filePath, "utf8");
    return JSON.parse(fileContents);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null; // File not found
    }
    throw new Error(`Error loading config from ${filePath}: ${error.message}`);
  }
}

/**
 * Loads configuration from environment variables
 * @returns {object} Configuration object from environment variables
 */
function loadConfigFromEnv() {
  const config = {
    mcpServers: {},
  };

  // Parse MCP_SERVERS environment variable if it exists
  if (process.env.MCP_SERVERS) {
    try {
      config.mcpServers = JSON.parse(process.env.MCP_SERVERS);
    } catch (error) {
      throw new Error(
        `Invalid JSON in MCP_SERVERS environment variable: ${error.message}`
      );
    }
  }

  // Parse individual server configurations from environment variables
  // Format: MCP_SERVER_<NAME>_<PROPERTY>=value
  // Example: MCP_SERVER_TASKMASTER_COMMAND=node
  Object.keys(process.env).forEach((key) => {
    const match = key.match(/^MCP_SERVER_([A-Z0-9_]+)_([A-Z0-9_]+)$/i);
    if (match) {
      const [_, serverName, propName] = match;
      const normalizedServerName = serverName.toLowerCase();
      const normalizedPropName = propName.toLowerCase();

      if (!config.mcpServers[normalizedServerName]) {
        config.mcpServers[normalizedServerName] = {};
      }

      if (normalizedPropName === "args") {
        // Parse args as JSON array
        try {
          config.mcpServers[normalizedServerName].args = JSON.parse(
            process.env[key]
          );
        } catch (error) {
          throw new Error(
            `Invalid JSON in ${key} environment variable: ${error.message}`
          );
        }
      } else {
        config.mcpServers[normalizedServerName][normalizedPropName] =
          process.env[key];
      }
    }
  });

  // Set default server if environment variable exists
  if (process.env.MCP_DEFAULT_SERVER) {
    config.defaultServer = process.env.MCP_DEFAULT_SERVER;
  }

  return config;
}

/**
 * Merges configurations from multiple sources
 * @param {...object} configs - Configuration objects to merge
 * @returns {object} Merged configuration
 */
function mergeConfigs(...configs) {
  const merged = { mcpServers: {} };

  // Merge configurations in order (later ones override earlier ones)
  configs.forEach((config) => {
    if (!config) return;

    // Merge mcpServers
    if (config.mcpServers) {
      Object.entries(config.mcpServers).forEach(([name, serverConfig]) => {
        merged.mcpServers[name] = {
          ...(merged.mcpServers[name] || {}),
          ...serverConfig,
        };
      });
    }

    // Merge defaultServer
    if (config.defaultServer) {
      merged.defaultServer = config.defaultServer;
    }
  });

  // If no default server is set, use the first server in mcpServers
  if (!merged.defaultServer) {
    const serverNames = Object.keys(merged.mcpServers);
    if (serverNames.length > 0) {
      merged.defaultServer = serverNames[0];
    }
  }

  return merged;
}

/**
 * Loads MCP configuration from all available sources
 * @param {object} options - Configuration options
 * @returns {Promise<object>} Loaded and merged configuration
 */
export async function loadConfig(options = {}) {
  // Start with default configuration
  let config = DEFAULT_CONFIG;

  // Check for configuration files
  const configPaths = [...DEFAULT_CONFIG_PATHS];
  if (options.configPath) {
    configPaths.unshift(options.configPath);
  }

  for (const configPath of configPaths) {
    const fileConfig = await loadConfigFromFile(configPath);
    if (fileConfig) {
      config = mergeConfigs(config, fileConfig);
      break; // Stop after the first found config file
    }
  }

  // Load environment variables
  const envConfig = loadConfigFromEnv();

  // Merge with options passed in code
  const mergedConfig = mergeConfigs(config, envConfig, options.config);

  // Validate final configuration
  const validation = validateConfig(mergedConfig);
  if (!validation.success) {
    throw new Error(
      `Invalid MCP configuration: ${validation.errors.join(", ")}`
    );
  }

  return mergedConfig;
}

/**
 * Simple setup function for MCP
 * @param {string} name - Server name
 * @param {string} type - Server type ('local', 'remote', 'custom')
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Additional options
 * @returns {Promise<object>} Loaded configuration
 */
export async function setupMCP(name, type, command, args = [], options = {}) {
  const config = {
    mcpServers: {
      [name]: {
        command,
        args,
        type,
        ...options,
      },
    },
    defaultServer: name,
  };

  return loadConfig({ config });
}

export default {
  loadConfig,
  setupMCP,
  validateConfig,
  DEFAULT_CONFIG,
};
