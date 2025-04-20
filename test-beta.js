#!/usr/bin/env node

/**
 * Test script for the beta version of claude-task-master
 * This script demonstrates connecting to and using the local MCP server.
 */

import fetch from 'node-fetch';
import os from 'os';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { Command } from 'commander';

// Load environment variables
dotenv.config();

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

const program = new Command();
program
  .name('task-master-test')
  .description('Test the beta version of claude-task-master with the local MCP server')
  .version('0.1.0');

program
  .command('list-tools')
  .description('List all available MCP tools')
  .action(async () => {
    try {
      const host = process.env.MCP_HOST || getLocalIpAddress();
      const port = process.env.MCP_PORT || 7777;
      const url = `http://${host}:${port}/api/tools`;
      
      console.log(`Connecting to MCP server at ${url}...`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const tools = await response.json();
      console.log('\nAvailable MCP tools:');
      tools.forEach(tool => {
        console.log(`- ${tool.name}: ${tool.description}`);
      });
    } catch (error) {
      console.error('Error connecting to MCP server:', error.message);
      console.error('Make sure the MCP server is running (npm run start-mcp)');
    }
  });

program
  .command('get-tasks')
  .description('List all tasks using the MCP server')
  .action(async () => {
    try {
      const host = process.env.MCP_HOST || getLocalIpAddress();
      const port = process.env.MCP_PORT || 7777;
      const url = `http://${host}:${port}/api/invoke`;
      
      console.log(`Connecting to MCP server at ${host}:${port}...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'mcp_Task_Master_get_tasks',
          parameters: {
            projectRoot: process.cwd(),
            withSubtasks: true
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('\nTasks:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error fetching tasks:', error.message);
      console.error('Make sure the MCP server is running (npm run start-mcp)');
    }
  });

program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 