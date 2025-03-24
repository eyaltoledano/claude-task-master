/**
 * MCP Client Module
 *
 * Handles communication with MCP servers based on configuration
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import http from "http";
import https from "https";
import { loadConfig } from "./mcp-config.js";

/**
 * Creates an MCP client for the specified server
 * @param {string} serverName - Name of the server to connect to
 * @param {object} config - MCP configuration
 * @returns {object} MCP client instance
 */
export async function createClient(serverName, config) {
  if (!config) {
    config = await loadConfig();
  }

  const defaultServerName =
    config.defaultServer || Object.keys(config.mcpServers)[0];
  serverName = serverName || defaultServerName;

  if (!serverName) {
    throw new Error("No MCP server specified and no default server configured");
  }

  const serverConfig = config.mcpServers[serverName];
  if (!serverConfig) {
    throw new Error(`MCP server "${serverName}" not found in configuration`);
  }

  const { type = "local" } = serverConfig;

  if (type === "local") {
    return createLocalClient(serverConfig);
  } else if (type === "remote") {
    return createRemoteClient(serverConfig);
  } else if (type === "custom") {
    // Custom client can be implemented by plugins
    throw new Error(`Custom client type not yet implemented`);
  } else {
    throw new Error(`Unknown MCP server type: ${type}`);
  }
}

/**
 * Creates a client for local MCP server (child process)
 * @param {object} serverConfig - Server configuration
 * @returns {object} Local MCP client
 */
function createLocalClient(serverConfig) {
  const { command, args = [] } = serverConfig;

  let childProcess = null;
  let rl = null;

  return {
    /**
     * Processes a query using the local MCP server
     * @param {string} query - User query containing commands
     * @returns {Promise<object>} Processing result
     */
    async processQuery(query) {
      return new Promise((resolve, reject) => {
        if (!childProcess) {
          // Start the child process if not already running
          childProcess = spawn(command, [...args], {
            stdio: ["pipe", "pipe", "pipe"],
          });

          rl = createInterface({
            input: childProcess.stdout,
            terminal: false,
          });

          childProcess.on("error", (error) => {
            reject(new Error(`Failed to start MCP server: ${error.message}`));
          });

          childProcess.stderr.on("data", (data) => {
            console.error(`MCP server error: ${data.toString()}`);
          });
        }

        // Set up a one-time listener for this specific response
        const listener = (line) => {
          try {
            const response = JSON.parse(line);
            // Remove the listener
            rl.removeListener("line", listener);
            resolve(response);
          } catch (error) {
            reject(
              new Error(`Failed to parse MCP server response: ${error.message}`)
            );
          }
        };

        rl.on("line", listener);

        // Send the command to the server
        childProcess.stdin.write(JSON.stringify({ query }) + "\n");
      });
    },

    /**
     * Closes the client connection
     */
    close() {
      if (childProcess) {
        childProcess.kill();
        childProcess = null;
      }
      if (rl) {
        rl.close();
        rl = null;
      }
    },
  };
}

/**
 * Creates a client for remote MCP server (HTTP/HTTPS)
 * @param {object} serverConfig - Server configuration
 * @returns {object} Remote MCP client
 */
function createRemoteClient(serverConfig) {
  const { url, options = {} } = serverConfig;

  if (!url) {
    throw new Error("Remote MCP server requires a URL");
  }

  // Parse the URL to determine if it's HTTP or HTTPS
  const isHttps = url.startsWith("https://");
  const client = isHttps ? https : http;

  return {
    /**
     * Processes a query using the remote MCP server
     * @param {string} query - User query containing commands
     * @returns {Promise<object>} Processing result
     */
    async processQuery(query) {
      return new Promise((resolve, reject) => {
        const requestData = JSON.stringify({ query });

        const requestOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(requestData),
            ...options.headers,
          },
          ...options,
        };

        const req = client.request(url, requestOptions, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const response = JSON.parse(data);
                resolve(response);
              } catch (error) {
                reject(
                  new Error(
                    `Failed to parse MCP server response: ${error.message}`
                  )
                );
              }
            } else {
              reject(
                new Error(
                  `MCP server returned status code ${res.statusCode}: ${data}`
                )
              );
            }
          });
        });

        req.on("error", (error) => {
          reject(new Error(`Error connecting to MCP server: ${error.message}`));
        });

        req.write(requestData);
        req.end();
      });
    },

    /**
     * Closes the client connection (no-op for HTTP)
     */
    close() {
      // HTTP client doesn't need to be closed
    },
  };
}

/**
 * Processes a query using the configured MCP server
 * @param {string} query - User query containing commands
 * @param {string} serverName - Name of server to use (optional)
 * @param {object} config - MCP configuration (optional)
 * @returns {Promise<object>} Processing result
 */
export async function processQuery(query, serverName, config) {
  const client = await createClient(serverName, config);
  try {
    return await client.processQuery(query);
  } finally {
    client.close();
  }
}

export default {
  createClient,
  processQuery,
};
