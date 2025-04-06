#!/usr/bin/env node

import TaskMasterMCPServer from "./src/index.js";
import dotenv from "dotenv";
import logger from "./src/logger.js";

// Load environment variables
dotenv.config();

/**
 * Start the MCP server
 */
async function startServer() {
  // Get port from environment variable or use default
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  
  const server = new TaskMasterMCPServer({
    port: port
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start();
  } catch (error) {
    logger.error(`Failed to start MCP server: ${error.message}`);
    process.exit(1);
  }
}

// Start the server
startServer();
