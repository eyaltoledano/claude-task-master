/**
 * Simple MCP Test Server
 *
 * This is a minimal MCP server for testing purposes.
 * It only has a single tool to verify the MCP protocol is working.
 */

import { FastMCP } from "fastmcp";
import { z } from "zod";

// Create a simple server
const server = new FastMCP({
  name: "Simple MCP Test",
  version: "0.1.0",
});

// Initialize a custom tool registry
const registeredTools = [];

/**
 * Custom tool registration function
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

// Add a simple greeting tool
registerTool(server, {
  name: "hello",
  description: "A simple greeting tool",
  parameters: z.object({
    name: z.string().default("world").describe("Name to greet"),
  }),
  execute: async (args, { log }) => {
    log.info("Greeting", args);
    return {
      message: `Hello, ${args.name}!`,
      timestamp: new Date().toISOString(),
    };
  },
});

// Setup event listeners
server.on("connection", ({ sessionId }) => {
  console.error(`Client connected! Session ID: ${sessionId || "undefined"}`);
});

server.on("disconnection", ({ sessionId }) => {
  console.error(`Client disconnected! Session ID: ${sessionId || "undefined"}`);
});

// Configure transport options
const transportType = process.env.TRANSPORT_TYPE || "stdio";
const port = process.env.PORT || 8080;

// Create transport configuration based on FastMCP's expected format
let transportConfig;

// Configure transport based on type
if (transportType === "sse") {
  transportConfig = {
    type: "sse",
    options: {
      endpoint: "/sse",
      port: parseInt(port),
    },
  };
  console.error(
    `Starting simple MCP server with SSE transport on port ${port}...`
  );
} else if (transportType === "stdio") {
  transportConfig = {
    type: "stdio",
  };
  console.error("Starting simple MCP server with stdio transport...");
} else {
  console.error(
    `Unsupported transport type: ${transportType}, defaulting to stdio`
  );
  transportConfig = {
    type: "stdio",
  };
}

// Get the registered tools from server
const registeredToolsFromServer = server.getTools?.() || [];
console.error("Registered tools:", registeredToolsFromServer.length);
registeredToolsFromServer.forEach((tool) => {
  console.error(`- ${tool.name}: ${tool.description}`);
});

// Log the server keys for debugging
console.error(
  `Server keys: ${Object.keys(server)
    .filter((k) => typeof server[k] !== "function")
    .join(", ")}`
);

// Log server properties for debugging
console.error(
  "Server properties:",
  Object.keys(server).filter((key) => !key.startsWith("_"))
);

// Start the server
server.start(transportConfig);
console.error(`Simple MCP server started!`);
if (transportType === "sse") {
  console.error(`Server listening at http://localhost:${port}/sse`);
}

console.error(
  `Server methods: ${Object.keys(server)
    .filter((k) => typeof server[k] === "function")
    .join(", ")}`
);
