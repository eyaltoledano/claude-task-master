#!/usr/bin/env node

/**
 * MCP Server Module
 *
 * Standalone server for processing MCP commands
 * Can be run directly as a child process or via network
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import http from 'http';
import { parse as parseUrl } from 'url';
import {
  detectTaskCommand,
  parseTaskCommand,
  validateCommand,
  executeCommand
} from './mcp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Path to task-master bin script
const taskMasterPath = resolve(__dirname, '../bin/task-master.js');

// Process standard input to handle commands in pipe mode
function startStdinProcessor() {
  process.stdin.setEncoding('utf8');
  let buffer = '';

  process.stdin.on('data', async (chunk) => {
    buffer += chunk;

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const command = JSON.parse(line);
        const result = await processCommand(command);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (error) {
        process.stdout.write(
          JSON.stringify({
            error: `Failed to process command: ${error.message}`
          }) + '\n'
        );
      }
    }
  });

  process.stdin.on('end', () => {
    // Process any remaining data
    if (buffer.trim()) {
      try {
        const command = JSON.parse(buffer);
        processCommand(command)
          .then((result) => {
            process.stdout.write(JSON.stringify(result) + '\n');
          })
          .catch((error) => {
            process.stdout.write(
              JSON.stringify({
                error: `Failed to process command: ${error.message}`
              }) + '\n'
            );
          });
      } catch (error) {
        process.stdout.write(
          JSON.stringify({
            error: `Failed to process command: ${error.message}`
          }) + '\n'
        );
      }
    }
  });
}

// Start HTTP server to handle commands over HTTP
function startHttpServer(port = 3099) {
  const server = http.createServer(async (req, res) => {
    const { pathname } = parseUrl(req.url, true);

    // Only accept POST requests to /mcp endpoint
    if (req.method !== 'POST' || pathname !== '/mcp') {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    // Parse request body
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const command = JSON.parse(body);
        const result = await processCommand(command);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: `Failed to process command: ${error.message}`
          })
        );
      }
    });
  });

  server.listen(port, () => {
    console.log(`MCP HTTP Server running at http://localhost:${port}/`);
  });

  return server;
}

/**
 * Process a command object
 * @param {object} command - Command object { query: string }
 * @returns {Promise<object>} Processing result
 */
async function processCommand(command) {
  if (!command || typeof command !== 'object') {
    throw new Error('Invalid command format');
  }

  if (!command.query || typeof command.query !== 'string') {
    throw new Error('Command must include a query string');
  }

  const { query } = command;

  if (!detectTaskCommand(query)) {
    return {
      processed: false,
      message: 'No task command detected'
    };
  }

  const parsedCommand = parseTaskCommand(query);
  const validation = validateCommand(parsedCommand);

  if (!validation.success) {
    return {
      processed: true,
      success: false,
      error: validation.error,
      suggestedCommands: validation.suggestedCommands
    };
  }

  try {
    const output = await executeCommand(parsedCommand);
    return {
      processed: true,
      success: true,
      command: parsedCommand,
      output
    };
  } catch (error) {
    return {
      processed: true,
      success: false,
      command: parsedCommand,
      error: error.message
    };
  }
}

// Main function to start the server
function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const mode = args.includes('--http') ? 'http' : 'stdin';
  const port = args.includes('--port')
    ? parseInt(args[args.indexOf('--port') + 1], 10)
    : 3099;

  // Start in appropriate mode
  if (mode === 'http') {
    console.log(`Starting MCP server in HTTP mode on port ${port}`);
    startHttpServer(port);
  } else {
    // Console output would interfere with stdin/stdout processing, so suppress it
    // console.log('Starting MCP server in stdin mode');
    startStdinProcessor();
  }
}

// Execute main function if this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Function to start the server programmatically
export async function startServer(port = 3099) {
  return new Promise((resolve) => {
    console.log(`Starting MCP server in HTTP mode on port ${port}`);
    const server = startHttpServer(port);
    // Also start stdin processor for pipe mode
    startStdinProcessor();
    resolve(server);
  });
}

export { startStdinProcessor, startHttpServer, processCommand };
