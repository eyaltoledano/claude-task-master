#!/usr/bin/env node

/**
 * This is a simple test script for the MCP server tools.
 * It sends HTTP requests directly to the MCP server to test if tools are working.
 */

import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Set up file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure the MCP server URL
const MCP_HOST = process.env.MCP_HOST || 'localhost';
const MCP_PORT = process.env.MCP_PORT || 7777;
const MCP_URL = `http://${MCP_HOST}:${MCP_PORT}`;

// Get the project root
const projectRoot = resolve(__dirname);

/**
 * Invoke an MCP tool
 * 
 * @param {string} toolName - Name of the tool to invoke
 * @param {Object} params - Parameters for the tool
 * @returns {Promise<Object>} - Tool response
 */
async function invokeTool(toolName, params) {
  try {
    console.log(`Invoking tool: ${toolName}`);
    console.log(`Parameters: ${JSON.stringify(params, null, 2)}`);
    
    const response = await fetch(`${MCP_URL}/api/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: toolName,
        parameters: params
      }),
      timeout: 60000 // 60 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error invoking tool ${toolName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get the list of available tools
 * 
 * @returns {Promise<Array>} - List of available tools
 */
async function getTools() {
  try {
    const response = await fetch(`${MCP_URL}/api/tools`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting tools:', error.message);
    return [];
  }
}

/**
 * Main function to test the tools
 */
async function testTools() {
  try {
    console.log('Testing MCP tools...');
    
    // First, get the list of available tools
    console.log('Getting available tools...');
    const tools = await getTools();
    console.log(`Found ${tools.length} tools.`);
    
    // Test tools that were previously failing
    console.log('\n----- Testing add_dependency -----');
    const addDependencyResult = await invokeTool('mcp_Task_Master_add_dependency', {
      projectRoot,
      id: '11',
      dependsOn: '7'
    });
    console.log('Result:', JSON.stringify(addDependencyResult, null, 2));
    
    console.log('\n----- Testing validate_dependencies -----');
    const validateDependenciesResult = await invokeTool('mcp_Task_Master_validate_dependencies', {
      projectRoot
    });
    console.log('Result:', JSON.stringify(validateDependenciesResult, null, 2));
    
    console.log('\n----- Testing generate -----');
    const generateResult = await invokeTool('mcp_Task_Master_generate', {
      projectRoot
    });
    console.log('Result:', JSON.stringify(generateResult, null, 2));
    
    console.log('\n----- Testing remove_dependency -----');
    const removeDependencyResult = await invokeTool('mcp_Task_Master_remove_dependency', {
      projectRoot,
      id: '11',
      dependsOn: '7'
    });
    console.log('Result:', JSON.stringify(removeDependencyResult, null, 2));
    
    console.log('\n----- Testing analyze_project_complexity -----');
    const analyzeResult = await invokeTool('mcp_Task_Master_analyze_project_complexity', {
      projectRoot,
      threshold: 7
    });
    console.log('Result:', JSON.stringify(analyzeResult, null, 2));
    
  } catch (error) {
    console.error('Error testing tools:', error.message);
  }
}

// Run the tests
testTools().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 