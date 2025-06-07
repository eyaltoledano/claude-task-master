# Taskmaster AI Installation Guide

This guide helps AI assistants install and configure Taskmaster for users in their development projects.

## What is Taskmaster?

Taskmaster is an AI-driven task management system designed for development workflows. It helps break down projects into manageable tasks, track dependencies, and maintain development momentum through structured, AI-enhanced planning.

## Installation Steps

### Step 1: Add MCP Configuration

Add the following configuration to the user's MCP settings file (`.cursor/mcp.json` for Cursor, or equivalent for other editors):

```json
{
	"mcpServers": {
		"taskmaster-ai": {
			"command": "npx",
			"args": ["-y", "--package=task-master-ai", "task-master-ai"],
			"env": {
				"ANTHROPIC_API_KEY": "user_will_add_their_key_here",
				"PERPLEXITY_API_KEY": "user_will_add_their_key_here",
				"OPENAI_API_KEY": "user_will_add_their_key_here",
				"GOOGLE_API_KEY": "user_will_add_their_key_here",
				"MISTRAL_API_KEY": "user_will_add_their_key_here",
				"OPENROUTER_API_KEY": "user_will_add_their_key_here",
				"XAI_API_KEY": "user_will_add_their_key_here"
			}
		}
	}
}
```

### Step 2: API Key Requirements

Inform the user they need **at least one** API key from the following providers:

- **Anthropic** (for Claude models) - Recommended
- **OpenAI** (for GPT models)
- **Google** (for Gemini models)
- **Perplexity** (for research features) - Highly recommended
- **Mistral** (for Mistral models)
- **OpenRouter** (access to multiple models)
- **xAI** (for Grok models)

The user will be able to define 3 separate roles (can be the same provider or separate providers) for main AI operations, research operations (research providers/models only), and a fallback model in case of errors.

### Step 3: Initialize Project

Once the MCP server is configured and API keys are added, initialize Taskmaster in the user's project:

> Can you initialize Task Master in my project?

This will run the `initialize_project` tool to set up the basic file structure.

### Step 4: Create Initial Tasks

Users have two options for creating initial tasks:

**Option A: Parse a PRD (Recommended)**
If they have a Product Requirements Document:

> Can you parse my PRD file at [path/to/prd.txt] to generate initial tasks?

If the user does not have a PRD, the AI agent can help them create one and store it in scripts/prd.txt for parsing.

**Option B: Start from scratch**

> Can you help me add my first task: [describe the task]

## Common Usage Patterns

### Daily Workflow

> What's the next task I should work on?
> Can you show me the details for task [ID]?
> Can you mark task [ID] as done?

### Task Management

> Can you break down task [ID] into subtasks?
> Can you add a new task: [description]
> Can you analyze the complexity of my tasks?

### Project Organization

> Can you show me all my pending tasks?
> Can you move task [ID] to become a subtask of [parent ID]?
> Can you update task [ID] with this new information: [details]

## Verification Steps

After installation, verify everything is working:

1. **Check MCP Connection**: The AI should be able to access Task Master tools
2. **Test Basic Commands**: Try `get_tasks` to list current tasks
3. **Verify API Keys**: Ensure AI-powered commands work (like `add_task`)

Note: An API key fallback exists that allows the MCP server to read API keys from `.env` instead of the MCP JSON config. It is recommended to have keys in both places in case the MCP server is unable to read keys from its environment for whatever reason.

When adding keys to `.env` only, the `models` tool will explain that the keys are not OK for MCP. Despite this, the fallback should kick in and the API keys will be read from the `.env` file.

## Troubleshooting

**If MCP server doesn't start:**

- Verify the JSON configuration is valid
- Check that Node.js is installed
- Ensure API keys are properly formatted

**If AI commands fail:**

- Verify at least one API key is configured
- Check API key permissions and quotas
- Try using a different model via the `models` tool

## CLI Fallback

Taskmaster is also available via CLI commands, by installing with `npm install task-master-ai@latest` in a terminal. Running `task-master help` will show all available commands, which offer a 1:1 experience with the MCP server. As the AI agent, you should refer to the system prompts and rules provided to you to identify Taskmaster-specific rules that help you understand how and when to use it.

## Next Steps

Once installed, users can:

- Create new tasks with `add-task` or parse a PRD (scripts/prd.txt) into tasks with `parse-prd`
- Set up model preferences with `models` tool
- Expand tasks into subtasks with `expand-all` and `expand-task`
- Explore advanced features like research mode and complexity analysis

For detailed documentation, refer to the Task Master docs directory.``
