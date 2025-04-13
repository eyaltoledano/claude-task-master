#!/usr/bin/env node

/**
 * Task Master MCP Server
 * This script starts the MCP server for Task Master, making it available
 * on the local network for testing and development.
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import os from 'os';

// Set up file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Load environment variables
dotenv.config({ path: resolve(rootDir, '.env') });

// Initialize console with color
console.log('\x1b[36m%s\x1b[0m', '🚀 Starting Task Master MCP Server...');

// Get local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // Default to localhost if no external IP found
}

// Mock data for the fallback server
const mockTasks = [
  {
    id: '1',
    title: 'Initialize project',
    description: 'Set up project structure and basic files',
    status: 'done',
    priority: 'high',
    details: 'Create package.json, README.md, and directory structure',
    testStrategy: 'Manual verification of files',
    dependencies: []
  },
  {
    id: '2',
    title: 'MCP Server implementation',
    description: 'Create an MCP server for AI tool integration',
    status: 'in-progress',
    priority: 'high',
    details: 'Implement server with fastmcp, create fallback implementation',
    testStrategy: 'Run server locally and test with test-server.js',
    dependencies: ['1']
  },
  {
    id: '3',
    title: 'Task management CLI',
    description: 'Create CLI for task management',
    status: 'pending',
    priority: 'medium',
    details: 'Implement commands for task creation, listing, and updating',
    testStrategy: 'Unit tests and manual testing',
    dependencies: ['1']
  }
];

// Mock tools for the fallback server
const mockTools = [
  { 
    name: 'mcp_Task_Master_get_tasks', 
    description: 'Get all tasks from Task Master, optionally filtering by status and including subtasks.'
  },
  { 
    name: 'mcp_Task_Master_get_task', 
    description: 'Get detailed information about a specific task.'
  },
  { 
    name: 'mcp_Task_Master_next_task', 
    description: 'Find the next task to work on based on dependencies and status.'
  },
  { 
    name: 'mcp_Task_Master_set_task_status', 
    description: 'Set the status of one or more tasks or subtasks.'
  },
  { 
    name: 'mcp_Task_Master_add_task', 
    description: 'Add a new task using AI.'
  }
];

// Simple HTTP server fallback in case fastmcp isn't available
async function createFallbackServer(port, host) {
  try {
    console.log('\x1b[33m%s\x1b[0m', 'Using fallback server implementation');
    
    // Import required core modules
    console.log('Loading Task Master core modules...');
    const { 
      addDependencyDirect, 
      removeDependencyDirect,
      validateDependenciesDirect,
      generateTaskFilesDirect,
      analyzeTaskComplexityDirect,
      getTasksDirect,
      getTaskDirect,
      getNextTaskDirect,
      expandTaskDirect 
    } = await import('./src/core/task-master-core.js');
    
    const http = await import('http');
    
    console.log('Initializing fallback server with core functionality...');
    
    // Create a more comprehensive list of supported tools
    const supportedTools = [
      'mcp_Task_Master_get_tasks',
      'mcp_Task_Master_get_task',
      'mcp_Task_Master_next_task',
      'mcp_Task_Master_set_task_status',
      'mcp_Task_Master_add_task',
      'mcp_Task_Master_add_dependency',
      'mcp_Task_Master_remove_dependency',
      'mcp_Task_Master_validate_dependencies',
      'mcp_Task_Master_generate',
      'mcp_Task_Master_analyze_project_complexity'
    ];
    
    // Create the fallback tools list
    const fallbackTools = supportedTools.map(name => ({ 
      name, 
      description: `Task Master tool: ${name.replace('mcp_Task_Master_', '')}`
    }));
    
    const server = http.createServer((req, res) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      // Handle OPTIONS request for CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      // API endpoint for getting the list of available tools
      if (req.url === '/api/tools') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(fallbackTools));
      } 
      // API endpoint for invoking tools
      else if (req.url === '/api/invoke' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const toolName = data.tool;
            const params = data.parameters || {};
            
            console.log(`Tool invocation: ${toolName}`);
            console.log(`Parameters: ${JSON.stringify(params)}`);
            
            // Simple logger for the fallback implementation
            const log = {
              info: (msg) => console.log(`[INFO] ${msg}`),
              error: (msg) => console.error(`[ERROR] ${msg}`),
              debug: (msg) => console.log(`[DEBUG] ${msg}`)
            };
            
            // Handle progress reporting
            const reportProgress = ({ progress }) => {
              console.log(`Progress: ${progress}%`);
            };
            
            // Define timeout for operations
            const timeout = process.env.MCP_TIMEOUT ? parseInt(process.env.MCP_TIMEOUT) : 60000;
            
            // This function will safely execute operations with timeout
            const safeExecute = async (operation) => {
              return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                  reject(new Error(`Operation timed out after ${timeout}ms`));
                }, timeout);
                
                operation()
                  .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                  })
                  .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                  });
              });
            };
            
            // New unified handling for all supported tools
            try {
              let result = { success: false, message: `Tool '${toolName}' not supported` };
              
              // Route to the correct implementation based on tool name
              if (toolName === 'mcp_Task_Master_get_tasks') {
                result = await safeExecute(() => getTasksDirect(params, log));
              } 
              else if (toolName === 'mcp_Task_Master_get_task') {
                result = await safeExecute(() => getTaskDirect(params, log));
              }
              else if (toolName === 'mcp_Task_Master_next_task') {
                result = await safeExecute(() => getNextTaskDirect(params, log));
              }
              else if (toolName === 'mcp_Task_Master_add_dependency') {
                result = await safeExecute(() => addDependencyDirect(params, log, { reportProgress }));
              }
              else if (toolName === 'mcp_Task_Master_remove_dependency') {
                result = await safeExecute(() => removeDependencyDirect(params, log, { reportProgress }));
              }
              else if (toolName === 'mcp_Task_Master_validate_dependencies') {
                result = await safeExecute(() => validateDependenciesDirect(params, log, { reportProgress }));
              }
              else if (toolName === 'mcp_Task_Master_generate') {
                result = await safeExecute(() => generateTaskFilesDirect(params, log, { reportProgress }));
              }
              else if (toolName === 'mcp_Task_Master_analyze_project_complexity') {
                result = await safeExecute(() => analyzeTaskComplexityDirect(params, log, { reportProgress }));
              }
              else if (toolName === 'mcp_Task_Master_expand_task') {
                result = await safeExecute(() => expandTaskDirect(params, log, { reportProgress }));
              }
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (error) {
              console.error(`Error executing tool ${toolName}:`, error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                success: false, 
                error: { message: error.message } 
              }));
            }
          } catch (parseError) {
            console.error('Error parsing request:', parseError);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              error: { message: 'Invalid JSON in request body' } 
            }));
          }
        });
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });
    
    return new Promise((resolve, reject) => {
      server.listen(port, host, () => {
        console.log('\x1b[32m%s\x1b[0m', `✅ Fallback server started at http://${host}:${port}`);
        console.log('This server implements core Task Master functionality.');
        console.log('Available endpoints:');
        console.log('  GET  /api/tools  - List available tools');
        console.log('  POST /api/invoke - Invoke a tool');
        resolve(true);
      });
      
      server.on('error', (err) => {
        console.error('\x1b[31m%s\x1b[0m', `Failed to start fallback server: ${err.message}`);
        reject(err);
      });
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `Error creating fallback server: ${error.message}`);
    throw error;
  }
}

// Try to dynamically import fastmcp with multiple strategies
async function importFastMCP() {
  const strategies = [
    // Strategy 1: Direct ES module import
    async () => {
      try {
        const module = await import('fastmcp');
        return module;
      } catch (e) {
        console.log('ES Module import failed:', e.message);
        return null;
      }
    },
    
    // Strategy 2: Try require() with createRequire
    async () => {
      try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const fastmcp = require('fastmcp');
        return fastmcp;
      } catch (e) {
        console.log('CommonJS require import failed:', e.message);
        return null;
      }
    },
    
    // Strategy 3: Try direct path import
    async () => {
      try {
        const nodePath = await import('path');
        const localPath = nodePath.resolve(process.cwd(), 'node_modules/fastmcp/index.js');
        const module = await import(localPath);
        return module;
      } catch (e) {
        console.log('Local path import failed:', e.message);
        return null;
      }
    },
    
    // Strategy 4: Try the new MCP SDK
    async () => {
      try {
        const module = await import('@modelcontextprotocol/sdk');
        return module;
      } catch (e) {
        console.log('MCP SDK import failed:', e.message);
        return null;
      }
    }
  ];
  
  for (const strategy of strategies) {
    const result = await strategy();
    if (result) {
      return result;
    }
  }
  
  throw new Error('Unable to import fastmcp module using any strategy');
}

// Initialize the MCP server
async function startServer() {
  try {
    const port = process.env.MCP_PORT || 7777;
    const host = process.env.MCP_HOST || getLocalIpAddress();
    
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Host IP: ${host}, Port: ${port}`);
    
    try {
      // Try to import fastmcp with multiple strategies
      console.log('Attempting to load fastmcp module...');
      const FastMCP = await importFastMCP();
      
      // Try different API patterns based on what's available
      if (FastMCP.Config && FastMCP.Server) {
        // Original API pattern
        console.log('Using original FastMCP API pattern');
        const { Config, Server } = FastMCP;
        
        // Configure the server
        console.log('Initializing MCP server configuration...');
        const config = new Config();
        
        // Create the server
        console.log('Creating MCP server instance...');
        const server = new Server({
          port: port,
          host: host
        });
        
        // Register all Task Master tools
        console.log('Registering Task Master tools...');
        try {
          const { registerAllTools } = await import('./src/tools/index.js');
          registerAllTools(server);
          console.log('Successfully registered all tools');
        } catch (toolError) {
          console.error('Failed to register tools:', toolError);
          console.log('Server will start with limited functionality');
        }
        
        // Start the server
        console.log('Starting MCP server...');
        await server.start();
        
        console.log('\x1b[32m%s\x1b[0m', `✅ MCP Server started successfully at http://${host}:${port}`);
        console.log('Press Ctrl+C to stop the server');
        
        // Print all registered tools for debugging
        console.log('\nRegistered MCP tools:');
        server.tools.forEach(tool => {
          console.log(`- ${tool.name}`);
        });
      } 
      // New API pattern with FastMCP constructor
      else if (typeof FastMCP.default === 'function' || typeof FastMCP === 'function') {
        console.log('Using new FastMCP API pattern');
        const MCPConstructor = FastMCP.default || FastMCP;
        
        // Create FastMCP instance
        const mcp = new MCPConstructor("Task Master");
        
        // Register all Task Master tools
        console.log('Registering Task Master tools...');
        try {
          const { registerAllTools } = await import('./src/tools/index.js');
          registerAllTools(mcp);
          console.log('Successfully registered all tools');
        } catch (toolError) {
          console.error('Failed to register tools:', toolError);
          console.log('Server will start with limited functionality');
        }
        
        // Start the server
        console.log('Starting MCP server...');
        mcp.run({
          port: port,
          host: host
        });
        
        console.log('\x1b[32m%s\x1b[0m', `✅ MCP Server started successfully at http://${host}:${port}`);
        console.log('Press Ctrl+C to stop the server');
      }
      else {
        throw new Error('FastMCP module loaded but compatible API not found');
      }
      
    } catch (importError) {
      console.error('Failed to load fastmcp module:', importError.message);
      console.log('Using fallback HTTP server implementation...');
      await createFallbackServer(port, host);
    }
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Failed to start server:');
    console.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down MCP server...');
  process.exit(0);
});

// Start the server
startServer();
