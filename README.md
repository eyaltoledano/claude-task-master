<a name="readme-top"></a>

<div align='center'>
<a href="https://trendshift.io/repositories/13971" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13971" alt="eyaltoledano%2Fclaude-task-master | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</div>

<p align="center">
  <a href="https://task-master.dev"><img src="./images/logo.png?raw=true" alt="Taskmaster logo"></a>
</p>

<p align="center">
<b>Taskmaster</b>: A task management system for AI-driven development, designed to work seamlessly with any AI chat.
</p>

<p align="center">
  <a href="https://discord.gg/taskmasterai" target="_blank"><img src="https://dcbadge.limes.pink/api/server/https://discord.gg/taskmasterai?style=flat" alt="Discord"></a> |
  <a href="https://docs.task-master.dev" target="_blank">Docs</a>
</p>

<p align="center">
  <a href="https://github.com/eyaltoledano/claude-task-master/actions/workflows/ci.yml"><img src="https://github.com/eyaltoledano/claude-task-master/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/eyaltoledano/claude-task-master/stargazers"><img src="https://img.shields.io/github/stars/eyaltoledano/claude-task-master?style=social" alt="GitHub stars"></a>
  <a href="https://badge.fury.io/js/task-master-ai"><img src="https://badge.fury.io/js/task-master-ai.svg" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT%20with%20Commons%20Clause-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/task-master-ai"><img src="https://img.shields.io/npm/d18m/task-master-ai?style=flat" alt="NPM Downloads"></a>
  <a href="https://www.npmjs.com/package/task-master-ai"><img src="https://img.shields.io/npm/dm/task-master-ai?style=flat" alt="NPM Downloads"></a>
  <a href="https://www.npmjs.com/package/task-master-ai"><img src="https://img.shields.io/npm/dw/task-master-ai?style=flat" alt="NPM Downloads"></a>
</p>

## By [@eyaltoledano](https://x.com/eyaltoledano) & [@RalphEcom](https://x.com/RalphEcom)

[![Twitter Follow](https://img.shields.io/twitter/follow/eyaltoledano)](https://x.com/eyaltoledano)
[![Twitter Follow](https://img.shields.io/twitter/follow/RalphEcom)](https://x.com/RalphEcom)

A task management system for AI-driven development with Claude, designed to work seamlessly with Cursor AI.

## Documentation

📚 **[View Full Documentation](https://docs.task-master.dev)**

For detailed guides, API references, and comprehensive examples, visit our documentation site.

### Quick Reference

The following documentation is also available in the `docs` directory:

- [Configuration Guide](docs/configuration.md) - Set up environment variables and customize Task Master
- [Tutorial](docs/tutorial.md) - Step-by-step guide to getting started with Task Master
- [Command Reference](docs/command-reference.md) - Complete list of all available commands
- [Task Structure](docs/task-structure.md) - Understanding the task format and features
- [Example Interactions](docs/examples.md) - Common Cursor AI interaction examples
- [Migration Guide](docs/migration-guide.md) - Guide to migrating to the new project structure

#### Quick Install for Cursor 1.0+ (One-Click)

[![Add task-master-ai MCP server to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=task-master-ai&config=eyJjb21tYW5kIjoibnB4IC15IC0tcGFja2FnZT10YXNrLW1hc3Rlci1haSB0YXNrLW1hc3Rlci1haSIsImVudiI6eyJBTlRIUk9QSUNfQVBJX0tFWSI6IllPVVJfQU5USFJPUElDX0FQSV9LRVlfSEVSRSIsIlBFUlBMRVhJVFlfQVBJX0tFWSI6IllPVVJfUEVSUExFWElUWV9BUElfS0VZX0hFUkUiLCJPUEVOQUlfQVBJX0tFWSI6IllPVVJfT1BFTkFJX0tFWV9IRVJFIiwiR09PR0xFX0FQSV9LRVkiOiJZT1VSX0dPT0dMRV9LRVlfSEVSRSIsIk1JU1RSQUxfQVBJX0tFWSI6IllPVVJfTUlTVFJBTF9LRVlfSEVSRSIsIkdST1FfQVBJX0tFWSI6IllPVVJfR1JPUV9LRVlfSEVSRSIsIk9QRU5ST1VURVJfQVBJX0tFWSI6IllPVVJfT1BFTlJPVVRFUl9LRVlfSEVSRSIsIlhBSV9BUElfS0VZIjoiWU9VUl9YQUlfS0VZX0hFUkUiLCJBWlVSRV9PUEVOQUlfQVBJX0tFWSI6IllPVVJfQVpVUkVfS0VZX0hFUkUiLCJPTExBTUFfQVBJX0tFWSI6IllPVVJfT0xMQU1BX0FQSV9LRVlfSEVSRSJ9fQ%3D%3D)

> **Note:** After clicking the link, you'll still need to add your API keys to the configuration. The link installs the MCP server with placeholder keys that you'll need to replace with your actual API keys.

## Requirements

Taskmaster utilizes AI across several commands, and those require a separate API key. You can use a variety of models from different AI providers provided you add your API keys. For example, if you want to use Claude 3.7, you'll need an Anthropic API key.

You can define 3 types of models to be used: the main model, the research model, and the fallback model (in case either the main or research fail). Whatever model you use, its provider API key must be present in either mcp.json or .env.

At least one (1) of the following is required:

- Anthropic API key (Claude API)
- OpenAI API key
- Google Gemini API key
- Perplexity API key (for research model)
- xAI API Key (for research or main model)
- OpenRouter API Key (for research or main model)
- Claude Code (no API key required - requires Claude Code CLI)

Using the research model is optional but highly recommended. You will need at least ONE API key (unless using Claude Code). Adding all API keys enables you to seamlessly switch between model providers at will.

## Quick Start

### Option 1: MCP (Recommended)

MCP (Model Control Protocol) lets you run Task Master directly from your editor.

#### 1. Add your MCP config at the following path depending on your editor

| Editor       | Scope   | Linux/macOS Path                      | Windows Path                                      | Key          |
| ------------ | ------- | ------------------------------------- | ------------------------------------------------- | ------------ |
| **Cursor**   | Global  | `~/.cursor/mcp.json`                  | `%USERPROFILE%\.cursor\mcp.json`                  | `mcpServers` |
|              | Project | `<project_folder>/.cursor/mcp.json`   | `<project_folder>\.cursor\mcp.json`               | `mcpServers` |
| **Windsurf** | Global  | `~/.codeium/windsurf/mcp_config.json` | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | `mcpServers` |
| **VS Code**  | Project | `<project_folder>/.vscode/mcp.json`   | `<project_folder>\.vscode\mcp.json`               | `servers`    |

##### Manual Configuration

###### Cursor & Windsurf (`mcpServers`)

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_API_KEY_HERE",
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY_HERE",
        "OPENAI_API_KEY": "YOUR_OPENAI_KEY_HERE",
        "GOOGLE_API_KEY": "YOUR_GOOGLE_KEY_HERE",
        "MISTRAL_API_KEY": "YOUR_MISTRAL_KEY_HERE",
        "GROQ_API_KEY": "YOUR_GROQ_KEY_HERE",
        "OPENROUTER_API_KEY": "YOUR_OPENROUTER_KEY_HERE",
        "XAI_API_KEY": "YOUR_XAI_KEY_HERE",
        "AZURE_OPENAI_API_KEY": "YOUR_AZURE_KEY_HERE",
        "OLLAMA_API_KEY": "YOUR_OLLAMA_API_KEY_HERE"
      }
    }
  }
}
```

> 🔑 Replace `YOUR_…_KEY_HERE` with your real API keys. You can remove keys you don't use.

> **Note**: If you see `0 tools enabled` in the MCP settings, try removing the `--package=task-master-ai` flag from `args`.

###### VS Code (`servers` + `type`)

```json
{
  "servers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_API_KEY_HERE",
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY_HERE",
        "OPENAI_API_KEY": "YOUR_OPENAI_KEY_HERE",
        "GOOGLE_API_KEY": "YOUR_GOOGLE_KEY_HERE",
        "MISTRAL_API_KEY": "YOUR_MISTRAL_KEY_HERE",
        "GROQ_API_KEY": "YOUR_GROQ_KEY_HERE",
        "OPENROUTER_API_KEY": "YOUR_OPENROUTER_KEY_HERE",
        "XAI_API_KEY": "YOUR_XAI_KEY_HERE",
        "AZURE_OPENAI_API_KEY": "YOUR_AZURE_KEY_HERE",
        "OLLAMA_API_KEY": "YOUR_OLLAMA_API_KEY_HERE"
      },
      "type": "stdio"
    }
  }
}
```

> 🔑 Replace `YOUR_…_KEY_HERE` with your real API keys. You can remove keys you don't use.

#### 2. (Cursor-only) Enable Taskmaster MCP

Open Cursor Settings (Ctrl+Shift+J) ➡ Click on MCP tab on the left ➡ Enable task-master-ai with the toggle

#### 3. (Optional) Configure the models you want to use

In your editor's AI chat pane, say:

```txt
Change the main, research and fallback models to <model_name>, <model_name> and <model_name> respectively.
```

For example, to use Claude Code (no API key required):
```txt
Change the main model to claude-code/sonnet
```

[Table of available models](docs/models.md) | [Claude Code setup](docs/examples/claude-code-usage.md)

#### 4. Initialize Task Master

In your editor's AI chat pane, say:

```txt
Initialize taskmaster-ai in my project
```

#### 5. Make sure you have a PRD (Recommended)

For **new projects**: Create your PRD at `.taskmaster/docs/prd.txt`  
For **existing projects**: You can use `scripts/prd.txt` or migrate with `task-master migrate`

An example PRD template is available after initialization in `.taskmaster/templates/example_prd.txt`.

> [!NOTE]
> While a PRD is recommended for complex projects, you can always create individual tasks by asking "Can you help me implement [description of what you want to do]?" in chat.

**Always start with a detailed PRD.**

The more detailed your PRD, the better the generated tasks will be.

> 💡 **Pro Tip**: Use the `--auto` flag when parsing your PRD to automatically analyze task complexity and expand high-complexity tasks into detailed subtasks. This saves time and ensures complex tasks are properly broken down from the start.

#### 6. Common Commands

Use your AI assistant to:

- Parse requirements: `Can you parse my PRD at scripts/prd.txt?`
- Parse with auto-expansion: `Can you parse my PRD at scripts/prd.txt with automatic complexity analysis and task expansion?`
- Plan next step: `What's the next task I should work on?`
- Implement a task: `Can you help me implement task 3?`
- View multiple tasks: `Can you show me tasks 1, 3, and 5?`
- Expand a task: `Can you help me expand task 4?`
- **Research fresh information**: `Research the latest best practices for implementing JWT authentication with Node.js`
- **Research with context**: `Research React Query v5 migration strategies for our current API implementation in src/api.js`

[More examples on how to use Task Master in chat](docs/examples.md)

#### 7. Automated Execution Mode

Task Master now includes a powerful **automated execution mode** that can run the complete development pipeline from PRD to task completion:

```bash
# Run the complete automated pipeline
task-master auto

# Check your auto configuration
task-master auto --check-config

# Run in silent mode (minimal output)
task-master auto --silent

# Use custom config file
task-master auto --config .taskmaster/config-alt.json

# Limit iterations for testing
task-master auto --max-iterations 5
```

**What `task-master auto` does:**

1. **📋 Parse PRD**: Automatically parses your PRD file and generates tasks
2. **🔍 Analyze & Expand**: Runs complexity analysis and expands complex tasks into subtasks
3. **🤖 Launch Agent**: Spawns cursor-agent to execute tasks automatically
4. **📊 Monitor Progress**: Updates task statuses in real-time as the agent works
5. **🔄 Feedback Loop**: Detects when new tasks are needed and adds them automatically
6. **✅ Complete**: Continues until all tasks are done or max iterations reached

**Configuration:**

Add this to your `.taskmaster/config.json`:

```json
{
  "auto": {
    "agent": "cursor-agent",
    "mode": "standard",
    "prd_path": "scripts/prd.txt"
  }
}
```

- `agent`: Which agent to use (currently supports `cursor-agent`)
- `mode`: `"silent"` for minimal output, `"standard"` for detailed progress
- `prd_path`: Path to your PRD file (relative to project root)

**Example Output:**

```
🚀 Starting automated task execution pipeline...

📋 Parsing PRD and generating tasks...
✅ Generated 8 tasks from PRD

🔍 Analyzing task complexity and expanding...
✅ Expanded tasks. Total tasks: 12

🤖 Running cursor-agent on 12 pending tasks...
📊 Task 1 status: in-progress
📊 Task 2 status: done
📊 Task 3 status: in-progress
📊 New task detected: Add error handling for API failures

🎉 Automated execution completed successfully!

📊 Execution Statistics:
  • Total tasks: 12
  • Completed: 10
  • Failed: 1
  • New tasks added: 2
  • Iterations: 3
  • Duration: 4m 32s
```

### Option 2: Using Command Line

#### Installation

```bash
# Install globally
npm install -g task-master-ai

# OR install locally within your project
npm install task-master-ai
```

#### Initialize a new project

```bash
# If installed globally
task-master init

# If installed locally
npx task-master init

# Initialize project with specific rules
task-master init --rules cursor,windsurf,vscode
```

This will prompt you for project details and set up a new project with the necessary files and structure.

#### Common Commands

```bash
# Initialize a new project
task-master init

# Parse a PRD and generate tasks
task-master parse-prd your-prd.txt

# Parse PRD with automatic complexity analysis and task expansion
task-master parse-prd your-prd.txt --auto

# Parse PRD with custom complexity threshold for auto-expansion
task-master parse-prd your-prd.txt --auto --auto-threshold 8

# List all tasks
task-master list

# Show the next task to work on
task-master next

# Show specific task(s) - supports comma-separated IDs
task-master show 1,3,5

# Research fresh information with project context
task-master research "What are the latest best practices for JWT authentication?"

# Move tasks between tags (cross-tag movement)
task-master move --from=5 --from-tag=backlog --to-tag=in-progress
task-master move --from=5,6,7 --from-tag=backlog --to-tag=done --with-dependencies
task-master move --from=5 --from-tag=backlog --to-tag=in-progress --ignore-dependencies

# Generate task files
task-master generate

# Run automated execution pipeline
task-master auto

# Check auto configuration
task-master auto --check-config

# Run auto in silent mode
task-master auto --silent

# Add rules after initialization
task-master rules add windsurf,roo,vscode

# Run Cursor Agent to automatically execute tasks
task-master cursor-agent

# Run Cursor Agent in silent mode (minimal output)
task-master cursor-agent --silent

# Run Cursor Agent with custom tasks file
task-master cursor-agent ./custom-tasks.json
```

### Cursor Agent Integration

Task Master now includes integration with [Cursor Agent](https://cursor.com/agent), allowing you to automatically execute tasks using AI-powered code generation.

#### Prerequisites

- Install [Cursor Agent](https://cursor.com/agent) CLI tool
- Ensure `cursor-agent` is available in your PATH
- Have tasks defined in your `tasks.json` file

#### Usage Examples

```bash
# Basic usage - execute all pending tasks
task-master cursor-agent

# Silent mode - minimal output with spinner
task-master cursor-agent --silent

# Use custom tasks file
task-master cursor-agent ./my-tasks.json

# Combine with other Task Master features
task-master parse-prd requirements.txt
task-master cursor-agent --silent
```

#### How It Works

1. **Task Loading**: Cursor Agent loads tasks from your `tasks.json` file
2. **Sequential Execution**: Tasks are executed in dependency order
3. **Status Updates**: Task statuses are automatically updated (pending → in_progress → done)
4. **Progress Display**: Real-time progress updates show current task and activity
5. **Error Handling**: Failed tasks are marked appropriately, execution continues with other tasks

#### Features

- **Automatic Task Discovery**: Cursor Agent can create new tasks/subtasks as needed
- **Dependency Management**: Respects task dependencies and execution order
- **Real-time Progress**: Live updates on current task and implementation progress
- **Silent Mode**: Minimal output with rotating spinner for automated workflows
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Error Recovery**: Continues execution even if individual tasks fail

### Automatic Task Expansion

Task Master can automatically analyze task complexity and expand high-complexity tasks after parsing your PRD:

```bash
# Automatically analyze complexity and expand tasks above threshold 7
task-master parse-prd your-prd.txt --auto

# Use custom complexity threshold (tasks with complexity ≥ 8 will be expanded)
task-master parse-prd your-prd.txt --auto --auto-threshold 8

# Combine with research mode for more informed analysis
task-master parse-prd your-prd.txt --auto --research
```

**How it works:**
1. **Parses your PRD** and generates initial tasks
2. **Analyzes complexity** of each task (1-10 scale)
3. **Automatically expands** tasks above the threshold into detailed subtasks
4. **Provides summary** of expanded vs skipped tasks

This is equivalent to running `task-master analyze-complexity` followed by `task-master expand --all`, but with intelligent filtering based on complexity scores.

## Claude Code Support

Task Master now supports Claude models through the Claude Code CLI, which requires no API key:

- **Models**: `claude-code/opus` and `claude-code/sonnet`
- **Requirements**: Claude Code CLI installed
- **Benefits**: No API key needed, uses your local Claude instance

[Learn more about Claude Code setup](docs/examples/claude-code-usage.md)

## LM Studio Integration

Task Master supports LM Studio for local AI model hosting. This allows you to run Task Master with locally hosted models without requiring external API keys.

### LM Studio Setup

1. **Install LM Studio**: Download and install [LM Studio](https://lmstudio.ai/)
2. **Download a model**: Choose and download a compatible model (e.g., GPT-OSS models)
3. **Start the server**: Launch LM Studio and start the local server (typically on `http://127.0.0.1:1234`)

### Configuration Example

Here's a complete `.taskmaster/config.json` example for LM Studio integration:

```json
{
  "models": {
    "main": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:20b",
      "maxTokens": 32000,
      "temperature": 0.2
    },
    "research": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:20b",
      "maxTokens": 32000,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:20b",
      "maxTokens": 32000,
      "temperature": 0.3
    }
  },
  "global": {
    "logLevel": "info",
    "debug": false,
    "defaultNumTasks": 10,
    "defaultSubtasks": 5,
    "defaultPriority": "medium",
    "projectName": "Task Master with LM Studio",
    "ollamaBaseURL": "http://localhost:11434/api",
    "lmstudioBaseURL": "http://127.0.0.1:1234/v1",
    "bedrockBaseURL": "https://bedrock.us-east-1.amazonaws.com",
    "responseLanguage": "English",
    "enableCodebaseAnalysis": true,
    "userId": "lmstudio-user",
    "azureBaseURL": "https://your-endpoint.azure.com/",
    "defaultTag": "master"
  },
  "claudeCode": {}
}
```

### Key Configuration Points

- **`lmstudioBaseURL`**: Set to your LM Studio server URL (default: `http://127.0.0.1:1234/v1`)
- **`modelId`**: Use the model identifier from LM Studio (e.g., `gpt-oss:20b`)
- **`provider`**: Set to `"lmstudio"` for all model roles
- **No API keys required**: LM Studio runs locally without external API dependencies

### Benefits of LM Studio Integration

- **Privacy**: All AI processing happens locally on your machine
- **Cost-effective**: No per-token charges for API usage
- **Offline capability**: Works without internet connection
- **Model flexibility**: Use any compatible model available in LM Studio

[Learn more about LM Studio integration](docs/lmstudio-integration.md)

## Troubleshooting

### If `task-master init` doesn't respond

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

## Contributors

<a href="https://github.com/eyaltoledano/claude-task-master/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=eyaltoledano/claude-task-master" alt="Task Master project contributors" />
</a>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=eyaltoledano/claude-task-master&type=Timeline)](https://www.star-history.com/#eyaltoledano/claude-task-master&Timeline)

## Licensing

Task Master is licensed under the MIT License with Commons Clause. This means you can:

✅ **Allowed**:

- Use Task Master for any purpose (personal, commercial, academic)
- Modify the code
- Distribute copies
- Create and sell products built using Task Master

❌ **Not Allowed**:

- Sell Task Master itself
- Offer Task Master as a hosted service
- Create competing products based on Task Master

See the [LICENSE](LICENSE) file for the complete license text and [licensing details](docs/licensing.md) for more information.
