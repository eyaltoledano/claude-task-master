#!/usr/bin/env node

/**
 * Simple Test Script for Task Master MCP Server
 * This script tests connectivity to the MCP server using only built-in Node.js modules
 */

import http from 'http';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFile } from 'fs/promises';

// Get file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Load environment variables from .env file
async function loadEnv() {
  try {
    const envPath = resolve(__dirname, '.env');
    const data = await readFile(envPath, 'utf8');
    const envVars = {};
    
    data.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) return;
      
      // Extract key=value
      const match = line.match(/^\s*([^=]+?)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove comments at the end of the line
        const commentPos = value.indexOf('#');
        if (commentPos !== -1) {
          value = value.substring(0, commentPos).trim();
        }
        
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        
        envVars[key] = value;
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error loading .env file:', error.message);
    return {};
  }
}

// Simple HTTP request function
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ statusCode: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Main function
async function main() {
  try {
    console.log('🔍 Testing Task Master MCP Server connectivity...');
    
    // Load environment variables
    const env = await loadEnv();
    const port = env.MCP_PORT || 7777;
    const host = env.MCP_HOST || getLocalIpAddress();
    
    console.log(`Server address: http://${host}:${port}`);
    
    // Test 1: Get tools list
    console.log('\n📋 Test 1: Retrieving tools list...');
    const toolsOptions = {
      hostname: host,
      port: port,
      path: '/api/tools',
      method: 'GET'
    };
    
    try {
      const toolsResponse = await makeRequest(toolsOptions);
      console.log(`Status: ${toolsResponse.statusCode === 200 ? '✅ Success' : '❌ Failed'}`);
      if (toolsResponse.statusCode === 200) {
        console.log(`Found ${toolsResponse.data.length} tools`);
        
        // Show first 5 tools
        if (toolsResponse.data.length > 0) {
          console.log('\nSample tools:');
          toolsResponse.data.slice(0, 5).forEach(tool => {
            console.log(`- ${tool.name}`);
          });
        }
      } else {
        console.log('Failed to retrieve tools');
      }
    } catch (error) {
      console.log('❌ Error connecting to server:', error.message);
      console.log('Make sure the MCP server is running (npm run start-mcp)');
      process.exit(1);
    }
    
    // Test 2: Invoke a simple tool
    console.log('\n🧪 Test 2: Invoking mcp_Task_Master_get_tasks...');
    const invokeOptions = {
      hostname: host,
      port: port,
      path: '/api/invoke',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const invokeData = JSON.stringify({
      tool: 'mcp_Task_Master_get_tasks',
      parameters: {
        projectRoot: process.cwd(),
        withSubtasks: true
      }
    });
    
    try {
      const invokeResponse = await makeRequest(invokeOptions, invokeData);
      console.log(`Status: ${invokeResponse.statusCode === 200 ? '✅ Success' : '❌ Failed'}`);
      
      // Summarize the response
      if (invokeResponse.statusCode === 200) {
        if (invokeResponse.data.success === false) {
          console.log(`❌ Tool invocation error: ${invokeResponse.data.message || 'Unknown error'}`);
        } else {
          console.log('✅ Tool invocation successful');
          console.log('Response summary:', 
                     typeof invokeResponse.data === 'object' ? 
                     JSON.stringify(invokeResponse.data).substring(0, 150) + '...' : 
                     'Non-object response');
        }
      } else {
        console.log('Failed to invoke tool');
      }
    } catch (error) {
      console.log('❌ Error invoking tool:', error.message);
    }
    
    console.log('\n🏁 Testing complete!');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the script
main(); 