#!/usr/bin/env node

/**
 * MCP Server Initialization Script
 * 
 * This script initializes the MCP server with the appropriate options
 * based on the user's choices during project initialization.
 */

import TaskMasterMCPServer from '../mcp-server/src/index.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize the MCP server with the appropriate options
 * @param {Object} options - Configuration options
 * @param {string} options.projectName - The project name
 * @param {boolean} options.enableRooResources - Whether to enable Roo resources
 * @returns {Promise<Object>} - The initialized MCP server
 */
export async function initMcpServer(options = {}) {
  const { projectName, enableRooResources = true } = options;
  
  // Create the MCP server with the appropriate options
  const server = new TaskMasterMCPServer({
    projectName,
    enableRooResources
  });
  
  // Initialize and start the server
  try {
    await server.init();
    await server.start();
    
    console.log(`MCP server started with options:
- Project Name: ${projectName}
- Roo Resources: ${enableRooResources ? 'Enabled' : 'Disabled'}
- Web Interface: http://localhost:${server.webPort}
`);
    
    return server;
  } catch (error) {
    console.error(`Failed to start MCP server: ${error.message}`);
    throw error;
  }
}

/**
 * Create an MCP server configuration file
 * @param {Object} options - Configuration options
 * @param {string} options.targetDir - The target directory
 * @param {string} options.projectName - The project name
 * @param {boolean} options.enableRooResources - Whether to enable Roo resources
 */
export function createMcpConfig(options) {
  const { targetDir, projectName, enableRooResources = true } = options;
  
  // Create the configuration file
  const configPath = path.join(targetDir, 'mcp-config.json');
  const config = {
    projectName,
    enableRooResources
  };
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`MCP configuration saved to ${configPath}`);
  
  // Create a script to start the MCP server
  const scriptPath = path.join(targetDir, 'start-mcp-server.js');
  const scriptContent = `#!/usr/bin/env node

/**
 * Start the Task Master MCP Server
 */

import { initMcpServer } from './node_modules/task-master-ai/scripts/init-mcp-server.js';
import fs from 'fs';
import path from 'path';

// Load the configuration
const configPath = path.join(process.cwd(), 'mcp-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Start the server
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
    console.error(\`Failed to start MCP server: \${error.message}\`);
    process.exit(1);
  });
`;
  
  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, '755'); // Make the script executable
  console.log(`MCP server start script saved to ${scriptPath}`);
  
  // Add a script to package.json
  try {
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Add the script to start the MCP server
      packageJson.scripts = packageJson.scripts || {};
      packageJson.scripts['start-mcp'] = 'node start-mcp-server.js';
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(`Added 'start-mcp' script to package.json`);
    }
  } catch (error) {
    console.warn(`Could not update package.json: ${error.message}`);
  }
}

// If this script is run directly, start the server
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Check if a configuration file is provided
  const configPath = process.argv[2] || path.join(process.cwd(), 'mcp-config.json');
  
  try {
    // Load the configuration
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Start the server
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
  } catch (error) {
    console.error(`Failed to load configuration from ${configPath}: ${error.message}`);
    console.log('Using default configuration');
    
    // Start with default configuration
    initMcpServer()
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
  }
}