# Task Master MCP Server

This directory contains the MCP (Machine Conversation Protocol) server implementation for Task Master, allowing integration with AI tools like Cursor.

## Overview

The MCP server provides a standardized way for AI tools to interact with Task Master functionality through a set of well-defined tools. This enables AI assistants to help manage tasks, generate subtasks, and perform other operations without directly accessing the CLI.

## Getting Started

### Prerequisites

- Node.js 14.x or higher (recommended: Node.js 20.x+)
- npm or yarn

### Installation

The fastest way to get started is to use our setup script, which will automatically try multiple versions of fastmcp and start the server:

```bash
npm run start-server
```

This script:
1. Checks for required dependencies
2. Attempts to install fastmcp with several different version options
3. Starts the MCP server on your local network

### Manual Setup

If you prefer to set up manually:

1. Install the required dependencies:
   ```bash
   npm install
   ```

2. Install fastmcp (using latest version):
   ```bash
   npm run install-fastmcp
   ```

3. Start the MCP server:
   ```bash
   npm run start-mcp
   ```

## Testing the Server

We provide several scripts to test the MCP server:

1. Basic connectivity test (recommended):
   ```bash
   npm run test-server
   ```
   This uses built-in Node.js modules to test connectivity and basic functionality.

2. Test using Commander CLI (requires more dependencies):
   ```bash
   npm run test-mcp
   ```

3. List available tools:
   ```bash
   npm run test-mcp-list
   ```

4. Test getting tasks:
   ```bash
   npm run test-mcp-tasks
   ```

## Server Implementation Details

The server supports two modes:

1. **Full Mode**: Uses the fastmcp library to provide complete functionality with actual task files
2. **Fallback Mode**: Uses a simple HTTP server implementation with mock data for testing when fastmcp cannot be loaded

### Fallback Server Features

The fallback server provides a lightweight implementation with mock data:

- Mock tasks with realistic fields (id, title, description, status, etc.)
- Core functionality for the most important Task Master operations
- Support for multiple tools like get_tasks, get_task, and set_task_status
- Proper error handling and CORS support for browser clients
- Status code and response format matching the full implementation

### Available Tools

The MCP server exposes the following tools:

- `mcp_Task_Master_get_tasks`: List all tasks, optionally filtering by status
- `mcp_Task_Master_get_task`: Get detailed information about a specific task
- `mcp_Task_Master_next_task`: Find the next task to work on
- `mcp_Task_Master_set_task_status`: Update the status of tasks
- `mcp_Task_Master_add_task`: Add a new task using AI

In Full Mode, additional tools are available:
- `mcp_Task_Master_parse_prd`: Generate tasks from a PRD
- `mcp_Task_Master_expand_task`: Break down a task into subtasks
- ... and many more

### Network Configuration

By default, the server listens on:
- Host: 0.0.0.0 (all network interfaces)
- Port: 7777

You can modify these settings in the `.env` file:

```
MCP_PORT=7777
MCP_HOST=0.0.0.0
```

## Development

For development with auto-reload:

```bash
npm run start-mcp-dev
```

This uses nodemon to automatically restart the server when files change.

## Troubleshooting

### Module Import Issues

If you encounter issues with the fastmcp module:

1. **The server will automatically fall back to the built-in HTTP server** with mock data for testing purposes.

2. You can try running the clean install script:
   ```bash
   npm run clean-install
   ```

3. Or try installing a specific version manually:
   ```bash
   npm install fastmcp@latest
   ```

### Network Issues

Make sure port 7777 is not in use by another application. You can change the port in the `.env` file.

To check if the server is running and accessible:

```bash
curl http://localhost:7777/api/tools
```

This should return a JSON array of available tools.

## Integrating with AI Tools

To integrate with AI tools like Cursor, you'll need to:

1. Ensure the MCP server is running on a network-accessible address
2. Configure the AI tool to connect to your server's address and port
3. Set up the proper authentication if required (not implemented in the current version)

## Example API Calls

### List Tools

```bash
curl http://localhost:7777/api/tools
```

### Get All Tasks

```bash
curl -X POST -H "Content-Type: application/json" -d '{"tool":"mcp_Task_Master_get_tasks","parameters":{"projectRoot":"/path/to/project"}}' http://localhost:7777/api/invoke
```

### Get Task by ID

```bash
curl -X POST -H "Content-Type: application/json" -d '{"tool":"mcp_Task_Master_get_task","parameters":{"projectRoot":"/path/to/project","id":"1"}}' http://localhost:7777/api/invoke
```

### Set Task Status

```bash
curl -X POST -H "Content-Type: application/json" -d '{"tool":"mcp_Task_Master_set_task_status","parameters":{"projectRoot":"/path/to/project","id":"1","status":"done"}}' http://localhost:7777/api/invoke
```

## License

This software is licensed under the MIT License with Commons Clause. 