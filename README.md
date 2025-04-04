# Claude Task Master

[![CI](https://github.com/eyaltoledano/claude-task-master/actions/workflows/ci.yml/badge.svg)](https://github.com/eyaltoledano/claude-task-master/actions/workflows/ci.yml)
[![License: MIT with Commons Clause](https://img.shields.io/badge/license-MIT%20with%20Commons%20Clause-blue.svg)](LICENSE)
[![npm version](https://badge.fury.io/js/task-master-ai.svg)](https://badge.fury.io/js/task-master-ai)

<div align="center">
  <img src="assets/task-master-logo.png" alt="Claude Task Master Logo" width="200">
  <p><em>An AI-driven task management system for structured software development</em></p>
</div>

## What is Claude Task Master?

Claude Task Master is an intelligent task management system that leverages LLM capabilities (Claude, Perplexity) to transform high-level project descriptions into structured, executable development tasks. It enables a seamless workflow between human developers and AI assistants, particularly designed to work with Cursor AI.

### Why Task Master?

- **🔄 Streamlined Development**: Convert project requirements into detailed tasks with dependencies, priorities, and test strategies
- **🧠 AI-Powered**: Leverage Claude and Perplexity AI for task generation, expansion, and adaptation
- **🧩 Adaptive Planning**: Handle implementation changes by automatically updating subsequent tasks
- **🔍 Complexity Analysis**: Identify complex tasks and optimally break them down
- **🤝 Cursor Integration**: Seamless integration with Cursor AI for guided implementation
- **🖥️ MCP Support**: Model Context Protocol integration for enhanced AI capabilities

## Getting Started

### Installation

```bash
# Install globally
npm install -g task-master-ai

# OR install locally within your project
npm install task-master-ai
```

### Required Configuration

Create a `.env` file in your project root with your API key:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Optional configs:

```
# API Model Selection
MODEL=claude-3-7-sonnet-20250219  # Default model
PERPLEXITY_API_KEY=your_key_here   # For research-backed generation
PERPLEXITY_MODEL=sonar-medium-online

# System Settings
DEBUG=false                        # Enable debug logging
LOG_LEVEL=info                     # debug, info, warn, error
DEFAULT_SUBTASKS=3                 # Default subtasks when expanding
```

### Initialize a Project

```bash
# With global installation
task-master init

# With local installation
npx task-master-init
```

This will guide you through setup and create necessary project files.

## Core Workflow

Task Master follows a structured workflow to manage development tasks:

1. **Initialize Project** → Create project structure & config files
2. **Parse PRD** → Convert requirements to structured tasks
3. **Generate Task Files** → Create individual task definition files
4. **Analyze Complexity** → Identify & break down complex tasks
5. **Implement with Cursor** → Use AI to complete tasks following guidelines
6. **Update Tasks** → Handle implementation changes and update task chain

### Example Workflow

```bash
# Initialize a new project
task-master init

# Parse PRD and generate tasks
task-master parse-prd scripts/prd.txt

# Generate individual task files
task-master generate

# Analyze task complexity
task-master analyze-complexity

# View the complexity report
task-master complexity-report

# Expand complex tasks into subtasks
task-master expand --all

# Show the next task to work on
task-master next
```

## Task Structure

Tasks in Task Master have a rich structure that captures all aspects of implementation:

```json
{
  "id": 1,
  "title": "Implement User Authentication",
  "description": "Create secure user authentication with OAuth",
  "status": "pending",  // pending, in-progress, done, deferred
  "dependencies": [3, 4],  // Task IDs this task depends on
  "priority": "high",  // high, medium, low
  "details": "Detailed implementation steps...",
  "testStrategy": "Unit tests should verify...",
  "subtasks": [  // Optional smaller implementation units
    {
      "id": 1,
      "title": "Setup OAuth Configuration",
      "description": "...",
      "status": "pending",
      "dependencies": [],
      "details": "..."
    }
  ]
}
```

## Command Reference

### Task Generation & Management

| Command | Description | Example |
|---------|-------------|--------|
| `init` | Initialize a new project | `task-master init` |
| `parse-prd` | Generate tasks from PRD | `task-master parse-prd scripts/prd.txt` |
| `generate` | Create task files | `task-master generate` |
| `list` | List all tasks | `task-master list [--status=pending] [--with-subtasks]` |
| `show` | Show task details | `task-master show 3` |
| `next` | Show next task to work on | `task-master next` |
| `set-status` | Update task status | `task-master set-status --id=3 --status=done` |
| `add-task` | Add a new task | `task-master add-task --prompt="Create login UI"` |

### Task Refinement & Analysis

| Command | Description | Example |
|---------|-------------|--------|
| `expand` | Break task into subtasks | `task-master expand --id=3 --num=5` |
| `expand --all` | Expand all pending tasks | `task-master expand --all` |
| `update` | Update tasks based on changes | `task-master update --from=4 --prompt="Using Express instead of Fastify"` |
| `update-task` | Update a specific task | `task-master update-task --id=5 --prompt="Update with new info"` |
| `update-subtask` | Update a specific subtask | `task-master update-subtask --id=3.2 --prompt="Add more details"` |
| `analyze-complexity` | Analyze task complexity | `task-master analyze-complexity` |
| `complexity-report` | View complexity report | `task-master complexity-report` |

### Advanced Task Management

| Command | Description | Example |
|---------|-------------|--------|
| `add-dependency` | Add task dependency | `task-master add-dependency --id=3 --depends-on=2` |
| `remove-dependency` | Remove dependency | `task-master remove-dependency --id=3 --depends-on=2` |
| `validate-dependencies` | Verify dependencies | `task-master validate-dependencies` |
| `fix-dependencies` | Fix invalid dependencies | `task-master fix-dependencies` |
| `add-subtask` | Add subtask to a task | `task-master add-subtask --parent=3 --title="Add validation"` |
| `remove-subtask` | Remove a subtask | `task-master remove-subtask --id=3.2` |
| `clear-subtasks` | Clear all subtasks | `task-master clear-subtasks --id=5` |

## Cursor AI Integration

Claude Task Master is designed to work seamlessly with [Cursor AI](https://www.cursor.so/), providing a structured workflow for AI-driven development.

### Basic Setup

1. After initializing your project with `task-master init`, open it in Cursor
2. The `.cursor/rules/` directory contains rules to guide the AI
3. Place your PRD document in the `scripts/` directory (e.g., `scripts/prd.txt`)
4. Open Cursor's AI chat and interact with the agent

### MCP Server Integration

Task Master includes an MCP (Model Context Protocol) server for enhanced Cursor integration:

1. Go to Cursor settings → MCP section
2. Click on "Add New MCP Server"
3. Configure with these details:
   - Name: "Task Master"
   - Type: "Command"
   - Command: `npx -y --package task-master-ai task-master-mcp`

This enables direct task management through Cursor's interface.

### Example Cursor Interactions

```
# Start a new project
"I've just initialized a new project with Claude Task Master. I have a PRD at scripts/prd.txt. Can you help me parse it and set up the initial tasks?"

# Find the next task
"What's the next task I should work on? Please consider dependencies and priorities."

# Implement a task
"I'd like to implement task 4. Can you help me understand what needs to be done?"

# Complete a task
"I've finished implementing the authentication system in task 2. All tests are passing. Please mark it as complete and tell me what to work on next."
```

## Advanced Usage

### Research-Backed Generation

Task Master can leverage AI research capabilities (via Perplexity API) for more informed task management:

```bash
# Generate research-backed subtasks
task-master expand --id=5 --research

# Update a task with research-backed content
task-master update-task --id=7 --prompt="Add security best practices" --research

# Analyze complexity with research integration
task-master analyze-complexity --research
```

### Context Integration

Provide additional context to improve AI understanding:

```bash
# Expand a task with specific context
task-master expand --id=8 --prompt="Focus on accessibility requirements"

# Update tasks with implementation context
task-master update --from=5 --prompt="We've switched to PostgreSQL instead of MongoDB"
```

### Handling Implementation Changes

As your implementation evolves, keep future tasks in sync:

```bash
# Update all remaining tasks when architecture changes
task-master update --from=4 --prompt="Now using microservices instead of monolith"

# Update a specific task with new information
task-master update-task --id=6 --prompt="Implement with GraphQL instead of REST"
```

## Contributing

We welcome contributions to Claude Task Master! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Setting up the development environment
- Running tests
- Submitting pull requests
- Code style guidelines
- Feature request process

## License

Claude Task Master is licensed under the MIT License with Commons Clause. This means you can:

✅ **Allowed**:
- Use Task Master for any purpose (personal, commercial, academic)
- Modify the code
- Distribute copies
- Create and sell products built using Task Master

❌ **Not Allowed**:
- Sell Task Master itself
- Offer Task Master as a hosted service
- Create competing products based on Task Master

See the [LICENSE](LICENSE) file for the complete license text.

## Credits

Developed by [@eyaltoledano](https://x.com/eyaltoledano) and [contributors](https://github.com/eyaltoledano/claude-task-master/graphs/contributors).