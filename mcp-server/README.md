# Task Master MCP Server

An MCP (Machine Conversation Protocol) server for interacting with the Task Master CLI. This server enables AI assistants like Cursor to manage tasks and projects through a standardized protocol.

## Features

- Complete integration with Task Master CLI
- JSON-RPC compatible API
- Tools organized by category:
  - **List Tools**: Display and query tasks
  - **Modify Tools**: Create, update, and delete tasks
  - **Expand Tools**: Generate reports and analyze complexity
  - **Create Tools**: Initialize projects and work with templates

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm or yarn
- Task Master CLI installed (typically as a dev dependency)

### Installation

```bash
cd mcp-server
npm install
```

### Running the Server

#### Standard mode (stdio)

```bash
npm start
```

#### With Server-Sent Events (SSE) - Recommended for Cursor integration

```bash
TRANSPORT_TYPE=sse npm start
```

#### Debug mode

```bash
npm run debug
```

## Available Tools

The MCP server registers tools grouped by functionality:

### List Tools

- `list-tasks`: List all tasks in the project
- `next-task`: Show the next task to work on based on dependencies and status
- `show-task`: Show details of a specific task by ID

### Modify Tools

- `create-task`: Create a new task in the project
- `update-task`: Update an existing task in the project
- `delete-task`: Delete a task from the project
- `set-task-status`: Change the status of a task
- `add-dependency`: Add a dependency relationship between two tasks
- `remove-dependency`: Remove a dependency relationship between two tasks
- `generate-tasks`: Generate individual task files from tasks.json

### Expand Tools

- `expand-task`: Expand a task into multiple subtasks
- `generate-report`: Generate a Markdown report of tasks
- `complexity-report`: Generate a complexity report for the project codebase

### Create Tools

- `init-tasks`: Initialize a new tasks project
- `create-template`: Create a new task template
- `list-templates`: List available task templates

## Transport Options

The server supports different transport mechanisms:

- **stdio**: Standard I/O (default)
- **sse**: Server-Sent Events - useful for web-based clients like Cursor

Set the transport type using the `TRANSPORT_TYPE` environment variable.

## Development

### Running Tests

```bash
npm test
```

### Simple Test Server

For testing purposes, you can run a simplified version of the server:

```bash
npm run simple
```

## Troubleshooting

If you encounter issues:

1. Try running in debug mode: `npm run debug`
2. Check that the Task Master CLI is properly installed
3. Verify that the transport configuration matches your client's expectations

## License

MIT
