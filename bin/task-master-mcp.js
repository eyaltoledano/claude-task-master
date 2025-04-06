#!/usr/bin/env node

/**
 * Task Master MCP Server
 * 
 * This script starts the MCP server for Task Master.
 * It's designed to be used with the npx command:
 * npx -y --package task-master-ai task-master-mcp
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { initMcpServer } from '../scripts/init-mcp-server.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the project root directory
// If running from node_modules, go up two levels
// If running from the project, use the current directory
let projectRoot = process.cwd();

// Check if we're running from node_modules
if (projectRoot.includes('node_modules')) {
  // Try to find the project root by looking for package.json
  let currentDir = projectRoot;
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      projectRoot = currentDir;
      break;
    }
    currentDir = path.dirname(currentDir);
  }
}

// Check if there's a mcp-config.json file in the project root
const configPath = path.join(projectRoot, 'mcp-config.json');
let config = {};

if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`Loaded MCP configuration from ${configPath}`);
  } catch (error) {
    console.warn(`Failed to parse MCP configuration from ${configPath}: ${error.message}`);
    console.log('Using default configuration');
  }
} else {
  console.log('No MCP configuration found, using default configuration');
  
  // Try to determine the project name from package.json
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      config.projectName = packageJson.name || 'Task Master';
    } catch (error) {
      console.warn(`Failed to parse package.json: ${error.message}`);
    }
  }
  
  // Set default configuration
  config.projectName = config.projectName || 'Task Master';
  config.enableRooResources = true;
}

// Start the MCP server
console.log(`Starting MCP server for ${config.projectName}...`);
console.log(`Roo Resources: ${config.enableRooResources ? 'Enabled' : 'Disabled'}`);

initMcpServer(config)
  .then(server => {
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await server.stop();
      process.exit(0);
    });
  })
  .catch(error => {
    console.error(`Failed to start MCP server: ${error.message}`);
    process.exit(1);
  });