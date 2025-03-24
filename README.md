# Task Master

### by [@eyaltoledano](https://x.com/eyaltoledano)

A task management system for AI-driven development with Claude, designed to work seamlessly with Cursor AI.

## Requirements

- Node.js 14.0.0 or higher
- Anthropic API key (Claude API)
- Anthropic SDK version 0.39.0 or higher
- OpenAI SDK (for Perplexity API integration, optional)

## Configuration

The script can be configured through environment variables in a `.env` file at the root of the project:

### Required Configuration

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude

### Optional Configuration

- `MODEL`: Specify which Claude model to use (default: "claude-3-7-sonnet-20250219")
- `MAX_TOKENS`: Maximum tokens for model responses (default: 4000)
- `TEMPERATURE`: Temperature for model responses (default: 0.7)
- `PERPLEXITY_API_KEY`: Your Perplexity API key for research-backed subtask generation
- `PERPLEXITY_MODEL`: Specify which Perplexity model to use (default: "sonar-medium-online")
- `DEBUG`: Enable debug logging (default: false)
- `LOG_LEVEL`: Log level - debug, info, warn, error (default: info)
- `DEFAULT_SUBTASKS`: Default number of subtasks when expanding (default: 3)
- `DEFAULT_PRIORITY`: Default priority for generated tasks (default: medium)
- `PROJECT_NAME`: Override default project name in tasks.json
- `PROJECT_VERSION`: Override default version in tasks.json

## Installation

```bash
# Install globally
npm install -g task-master-ai

# OR install locally within your project
npm install task-master-ai
```

## Model Context Protocol (MCP)

Task Master includes a Model Context Protocol (MCP) system that enables AI assistants to recognize and execute task-master commands through slash commands in user queries. This makes it easy to integrate Task Master with AI-powered tools and chatbots.

### Using the MCP Module

You can use the MCP functionality directly via the `task-master mcp` command:

```bash
# List all tasks
task-master mcp "/task list"

# Show specific task
task-master mcp "/task show 5"

# Get next task to work on
task-master mcp "/task next"

# Set task status
task-master mcp "/task set-status --id=5 --status=done"
```

### Using Slash Commands in MCP-compatible environments

```
/task list
/task show 5
/task next
```

You can use these commands in any MCP-compatible environment, including:

1. In the terminal using the `task-master mcp` command
2. In AI assistants that support MCP (like Cursor AI)

### Configuration

Task Master can be configured to use different execution methods:

1. **Direct Execution**: The default method when using slash commands
2. **Local Server**: For better process isolation (configured in `.cursor/mcp.json`)
3. **HTTP Server**: For remote execution (configured in `.cursor/mcp.json`)

See the [MCP Configuration](#mcp-configuration) section for more details.

### Declarative MCP Configuration

Task Master supports a declarative configuration system for MCP servers, allowing you to easily set up and configure different types of MCP servers. Configuration can be loaded from:

1. JSON configuration files (`mcp-config.json`)
2. Environment variables

#### Configuration File Example

Create an `mcp-config.json` file in your project root:

```json
{
  "mcpServers": {
    "task-master": {
      "command": "node",
      "args": ["path/to/mcp-server.js"],
      "type": "local"
    },
    "remote-server": {
      "type": "remote",
      "url": "https://my-mcp-server.example.com/mcp"
    }
  },
  "defaultServer": "task-master"
}
```

#### Environment Variables

You can also configure MCP servers using environment variables:

```
MCP_SERVER_TASKMASTER_COMMAND=node
MCP_SERVER_TASKMASTER_ARGS=["path/to/mcp-server.js"]
MCP_SERVER_TASKMASTER_TYPE=local
MCP_DEFAULT_SERVER=taskmaster
```

### MCP Server Types

Task Master supports different types of MCP servers:

1. **Local**: Runs as a child process on the same machine
2. **Remote**: Communicates with a remote HTTP/HTTPS server
3. **Custom**: Extensible server type for custom implementations

### Running the MCP Server

You can run the MCP server in two modes:

1. **Standard Input**: Processes commands from stdin/stdout (default)

   ```bash
   node path/to/mcp-server.js
   ```

2. **HTTP Server**: Listens for HTTP requests
   ```bash
   node path/to/mcp-server.js --http --port=3099
   ```

### Testing the MCP Configuration

You can test the MCP configuration by running commands directly:

```bash
task-master mcp "/task list"
task-master mcp "/task next"
task-master mcp "/task show 1"
```

These commands will use your configured MCP server to process the requests.

### Supported Slash Commands

The MCP module supports the following slash commands:

- `/task list`: List all tasks
- `/task next`: Show the next task to work on
- `/task show <id>`: Show details of a specific task
- `/task expand --id=<id>`: Expand a task with subtasks
- `/task set-status --id=<id> --status=<status>`: Update task status
- `/task add-task --prompt="<description>"`: Add a new task
- `/task help [command]`: Show help information

### Initialize a new project

```bash
# If installed globally
task-master init

# If installed locally
npx task-master-init
```

This will prompt you for project details and set up a new project with the necessary files and structure.

### Important Notes

1. This package uses ES modules. Your package.json should include `"type": "module"`.
2. The Anthropic SDK version should be 0.39.0 or higher.

## Quick Start with Global Commands

After installing the package globally, you can use these CLI commands from any directory:

```bash
# Initialize a new project
task-master init

# Parse a PRD and generate tasks
task-master parse-prd your-prd.txt

# List all tasks
task-master list

# Show the next task to work on
task-master next

# Generate task files
task-master generate
```

## Troubleshooting

### If `task-master init` doesn't respond:

Try running it with Node directly:

```bash
node node_modules/claude-task-master/scripts/init.js
```

Or clone the repository and run:

```bash
git clone https://github.com/eyaltoledano/claude-task-master.git
cd claude-task-master
node scripts/init.js
```

## Task Structure

Tasks in tasks.json have the following structure:

- `id`: Unique identifier for the task (Example: `1`)
- `title`: Brief, descriptive title of the task (Example: `"Initialize Repo"`)
- `description`: Concise description of what the task involves (Example: `"Create a new repository, set up initial structure."`)
- `status`: Current state of the task (Example: `"pending"`, `"done"`, `"deferred"`)
- `dependencies`: IDs of tasks that must be completed before this task (Example: `[1, 2]`)
  - Dependencies are displayed with status indicators (✅ for completed, ⏱️ for pending)
  - This helps quickly identify which prerequisite tasks are blocking work
- `priority`: Importance level of the task (Example: `"high"`, `"medium"`, `"low"`)
- `details`: In-depth implementation instructions (Example: `"Use GitHub client ID/secret, handle callback, set session token."`)
- `testStrategy`: Verification approach (Example: `"Deploy and call endpoint to confirm 'Hello World' response."`)
- `subtasks`: List of smaller, more specific tasks that make up the main task (Example: `[{"id": 1, "title": "Configure OAuth", ...}]`)

## Integrating with Cursor AI

Claude Task Master is designed to work seamlessly with [Cursor AI](https://www.cursor.so/), providing a structured workflow for AI-driven development.

### Setup with Cursor

1. After initializing your project, open it in Cursor
2. The `.cursor/rules/dev_workflow.mdc` file is automatically loaded by Cursor, providing the AI with knowledge about the task management system
3. Place your PRD document in the `scripts/` directory (e.g., `scripts/prd.txt`)
4. Open Cursor's AI chat and switch to Agent mode

### Initial Task Generation

In Cursor's AI chat, instruct the agent to generate tasks from your PRD:

```
Please use the task-master parse-prd command to generate tasks from my PRD. The PRD is located at scripts/prd.txt.
```

The agent will execute:

```bash
task-master parse-prd scripts/prd.txt
```

This will:

- Parse your PRD document
- Generate a structured `tasks.json` file with tasks, dependencies, priorities, and test strategies
- The agent will understand this process due to the Cursor rules

### Generate Individual Task Files

Next, ask the agent to generate individual task files:

```
Please generate individual task files from tasks.json
```

The agent will execute:

```bash
task-master generate
```

This creates individual task files in the `tasks/` directory (e.g., `task_001.txt`, `task_002.txt`), making it easier to reference specific tasks.

## AI-Driven Development Workflow

The Cursor agent is pre-configured (via the rules file) to follow this workflow:

### 1. Task Discovery and Selection

Ask the agent to list available tasks:

```
What tasks are available to work on next?
```

The agent will:

- Run `task-master list` to see all tasks
- Run `task-master next` to determine the next task to work on
- Analyze dependencies to determine which tasks are ready to be worked on
- Prioritize tasks based on priority level and ID order
- Suggest the next task(s) to implement

### 2. Task Implementation

When implementing a task, the agent will:

- Reference the task's details section for implementation specifics
- Consider dependencies on previous tasks
- Follow the project's coding standards
- Create appropriate tests based on the task's testStrategy

You can ask:

```
Let's implement task 3. What does it involve?
```

### 3. Task Verification

Before marking a task as complete, verify it according to:

- The task's specified testStrategy
- Any automated tests in the codebase
- Manual verification if required

### 4. Task Completion

When a task is completed, tell the agent:

```
Task 3 is now complete. Please update its status.
```

The agent will execute:

```bash
task-master set-status --id=3 --status=done
```

### 5. Handling Implementation Drift

If during implementation, you discover that:

- The current approach differs significantly from what was planned
- Future tasks need to be modified due to current implementation choices
- New dependencies or requirements have emerged

Tell the agent:

```
We've changed our approach. We're now using Express instead of Fastify. Please update all future tasks to reflect this change.
```

The agent will execute:

```bash
task-master update --from=4 --prompt="Now we are using Express instead of Fastify."
```

This will rewrite or re-scope subsequent tasks in tasks.json while preserving completed work.

### 6. Breaking Down Complex Tasks

For complex tasks that need more granularity:

```
Task 5 seems complex. Can you break it down into subtasks?
```

The agent will execute:

```bash
task-master expand --id=5 --num=3
```

You can provide additional context:

```
Please break down task 5 with a focus on security considerations.
```

The agent will execute:

```bash
task-master expand --id=5 --prompt="Focus on security aspects"
```

You can also expand all pending tasks:

```
Please break down all pending tasks into subtasks.
```

The agent will execute:

```bash
task-master expand --all
```

For research-backed subtask generation using Perplexity AI:

```
Please break down task 5 using research-backed generation.
```

The agent will execute:

```bash
task-master expand --id=5 --research
```

## Command Reference

Here's a comprehensive reference of all available commands:

### Parse PRD

```bash
# Parse a PRD file and generate tasks
task-master parse-prd <prd-file.txt>

# Limit the number of tasks generated
task-master parse-prd <prd-file.txt> --num-tasks=10
```

### List Tasks

```bash
# List all tasks
task-master list

# List tasks with a specific status
task-master list --status=<status>

# List tasks with subtasks
task-master list --with-subtasks

# List tasks with a specific status and include subtasks
task-master list --status=<status> --with-subtasks
```

### Show Next Task

```bash
# Show the next task to work on based on dependencies and status
task-master next
```

### Show Specific Task

```bash
# Show details of a specific task
task-master show <id>
# or
task-master show --id=<id>

# View a specific subtask (e.g., subtask 2 of task 1)
task-master show 1.2
```

### Update Tasks

```bash
# Update tasks from a specific ID and provide context
task-master update --from=<id> --prompt="<prompt>"
```

### Generate Task Files

```bash
# Generate individual task files from tasks.json
task-master generate
```

### Set Task Status

```bash
# Set status of a single task
task-master set-status --id=<id> --status=<status>

# Set status for multiple tasks
task-master set-status --id=1,2,3 --status=<status>

# Set status for subtasks
task-master set-status --id=1.1,1.2 --status=<status>
```

When marking a task as "done", all of its subtasks will automatically be marked as "done" as well.

### Expand Tasks

```bash
# Expand a specific task with subtasks
task-master expand --id=<id> --num=<number>

# Expand with additional context
task-master expand --id=<id> --prompt="<context>"

# Expand all pending tasks
task-master expand --all

# Force regeneration of subtasks for tasks that already have them
task-master expand --all --force

# Research-backed subtask generation for a specific task
task-master expand --id=<id> --research

# Research-backed generation for all tasks
task-master expand --all --research
```

### Clear Subtasks

```bash
# Clear subtasks from a specific task
task-master clear-subtasks --id=<id>

# Clear subtasks from multiple tasks
task-master clear-subtasks --id=1,2,3

# Clear subtasks from all tasks
task-master clear-subtasks --all
```

### Analyze Task Complexity

```

```

## Integrating with AI Assistants (MCP)

You can integrate Task Master with AI assistants that support the Model Context Protocol (MCP) to execute commands directly from the AI conversation interface.

### What is MCP?

The Model Context Protocol (MCP) is an open standard that enables AI assistants to connect to external data sources and tools. With MCP integration, you can use slash commands like `/task list` in your AI assistant, and it will execute the corresponding Task Master command.

### Setting up MCP Integration

1. **Start the MCP Server**

   ```bash
   # Start the MCP server
   npx task-master mcp
   ```

   This will start the MCP server on port 8888 by default. You can specify a different port with the `-p` option:

   ```bash
   npx task-master mcp -p 9999
   ```

2. **Configure Your AI Assistant**

   #### For Claude Desktop:

   1. Open Claude Desktop
   2. Go to Settings > MCP
   3. Add an MCP server with the following configuration:
      - Name: task-master
      - Type: command
      - Command: `npx task-master-ai mcp`

   #### For Other MCP-Compatible Assistants:

   - Configure the MCP server with the endpoint: `http://localhost:8888/mcp`
   - Use the format: `{"query": "/task command"}` for requests

### Available Commands

The following slash commands are available:

- `/task list` - List all tasks
- `/task next` - Show the next task to work on
- `/task show <id>` - Show details of a specific task
- `/task expand --id=<id>` - Expand a task with subtasks
- `/task set-status --id=<id> --status=<status>` - Set the status of a task
- `/task help` - Show help information

### Example Usage in AI Assistant

Once configured, you can use Task Master directly in your AI assistant conversation:

```
User: /task list
AI: [Displays the list of tasks]

User: /task next
AI: [Shows the next task to work on]

User: /task show 3
AI: [Displays details of task 3]
```

### Advanced Configuration

For advanced MCP configuration or to set up MCP for a custom AI assistant, refer to the MCP documentation and your AI assistant's integration guides.
