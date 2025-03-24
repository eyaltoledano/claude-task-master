/**
 * task-master MCP Server
 * Provides MCP access to task-master CLI functionality
 */

import { FastMCP } from "fastmcp";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { registerListTools } from "./tools/list-tools.js";
import { registerModifyTools } from "./tools/modify-tools.js";
import { registerExpandTools } from "./tools/expand-tools.js";
import { registerCreateTools } from "./tools/create-tools.js";

// Custom logger that writes to stderr instead of stdout
const logger = {
  info: (...args) => console.error("[INFO]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
  warn: (...args) => console.error("[WARN]", ...args),
  debug: (...args) => console.error("[DEBUG]", ...args),
};

// Determine the base directory for task-master CLI
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const basePath = resolve(__dirname, "../../");

// Create and configure FastMCP server
const server = new FastMCP({
  name: "Task Master MCP",
  version: "0.2.0",
});

// Initialize a custom tool registry
const registeredTools = [];

/**
 * Custom tool registration function that both registers with FastMCP and maintains our own registry
 * @param {FastMCP} mcpServer - The FastMCP server instance
 * @param {Object} toolDefinition - The tool definition object
 * @returns {Object} The registered tool
 */
function registerTool(mcpServer, toolDefinition) {
  // Add to our custom registry
  registeredTools.push({
    name: toolDefinition.name,
    description: toolDefinition.description,
    parameters: toolDefinition.parameters,
  });

  // Register with FastMCP
  return mcpServer.addTool(toolDefinition);
}

// Register all tools
logger.info("Registering List tools...");
registerListTools(server, registerTool);

logger.info("Registering Modify tools...");
registerModifyTools(server, registerTool);

logger.info("Registering Expand tools...");
registerExpandTools(server, registerTool);

logger.info("Registering Create tools...");
registerCreateTools(server, registerTool);

// Log the server's properties to understand its structure
logger.info("Server properties:", Object.keys(server));

// Setup event listeners
server.on("connect", (sessionId) => {
  logger.info(`Client connected! Session ID: ${sessionId || "undefined"}`);
});

server.on("disconnect", (sessionId) => {
  logger.info(`Client disconnected! Session ID: ${sessionId || "undefined"}`);
});

// Add a custom method to list all registered tools
server.listRegisteredTools = () => {
  return registeredTools;
};

// Configure transport options
const transportType = process.env.TRANSPORT_TYPE || "stdio";
const port = process.env.PORT || 8080;

// Create transport configuration based on FastMCP's examples
let transportConfig;

// Configure transport based on type
if (transportType === "sse") {
  transportConfig = {
    transportType: "sse",
    sse: {
      endpoint: "/sse",
      port: parseInt(port),
    },
  };
  logger.info(`Starting MCP server with SSE transport on port ${port}...`);
} else if (transportType === "stdio") {
  transportConfig = {
    transportType: "stdio",
  };
  logger.info("Starting MCP server with stdio transport...");
} else {
  logger.warn(
    `Unsupported transport type: ${transportType}, defaulting to stdio`
  );
  transportConfig = {
    transportType: "stdio",
  };
}

// Delay starting to ensure all tools are registered
setTimeout(() => {
  // Log the available tools before starting
  logger.info(
    "Registered tools in our custom registry:",
    registeredTools.length
  );

  registeredTools.forEach((tool) => {
    logger.info(`- ${tool.name}: ${tool.description}`);
  });

  // Start the server with configured transport
  server.start(transportConfig);

  // Display success message
  logger.info(`MCP server started! Listening for commands...`);
  if (transportType === "sse") {
    logger.info(`Server listening at http://localhost:${port}/sse`);
  }
}, 500);
