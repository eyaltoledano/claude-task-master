# Task Master Tutorial

This tutorial will guide you through setting up and using Task Master for AI-driven development.

## Initial Setup

There are two ways to set up Task Master: using MCP (recommended) or via npm installation.

### Option 1: Using MCP (Recommended)

MCP (Model Control Protocol) provides the easiest way to get started with Task Master directly in your editor.

1. **Install the package**

```bash
npm i -g task-master-ai
```

2. **Add the MCP config to your IDE/MCP Client** (Cursor is recommended, but it works with other clients):

```json
{
	"mcpServers": {
		"taskmaster-ai": {
			"command": "npx",
			"args": ["-y", "--package=task-master-ai", "task-master-ai"],
			"env": {
				"ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_API_KEY_HERE",
				"PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY_HERE",
				"OPENAI_API_KEY": "YOUR_OPENAI_KEY_HERE",
				"GOOGLE_API_KEY": "YOUR_GOOGLE_KEY_HERE",
				"MISTRAL_API_KEY": "YOUR_MISTRAL_KEY_HERE",
				"OPENROUTER_API_KEY": "YOUR_OPENROUTER_KEY_HERE",
				"XAI_API_KEY": "YOUR_XAI_KEY_HERE",
				"AZURE_OPENAI_API_KEY": "YOUR_AZURE_KEY_HERE"
			}
		}
	}
}
```

**IMPORTANT:** An API key is _required_ for each AI provider you plan on using. Run the `task-master models` command to see your selected models and the status of your API keys across .env and mcp.json

**To use AI commands in CLI** you MUST have API keys in the .env file
**To use AI commands in MCP** you MUST have API keys in the .mcp.json file (or MCP config equivalent)

We recommend having keys in both places and adding mcp.json to your gitignore so your API keys aren't checked into git.

3. **Enable the MCP** in your editor settings

4. **Prompt the AI** to initialize Task Master:

```
Can you please initialize taskmaster-ai into my project?
```

The AI will:

- Create necessary project structure
- Set up initial configuration files
- Guide you through the rest of the process

5. Place your PRD document in the `scripts/` directory (e.g., `scripts/prd.txt`)

6. **Use natural language commands** to interact with Task Master:

```
Can you parse my PRD at scripts/prd.txt?
What's the next task I should work on?
Can you help me implement task 3?
```

### Option 2: Manual Installation

If you prefer to use the command line interface directly:

```bash
# Install globally
npm install -g task-master-ai

# OR install locally within your project
npm install task-master-ai
```

Initialize a new project:

```bash
# If installed globally
task-master init

# If installed locally
npx task-master init
```

This will prompt you for project details and set up a new project with the necessary files and structure.

## Common Commands

After setting up Task Master, you can use these commands (either via AI prompts or CLI):

```bash
# Parse a PRD and generate tasks
task-master parse-prd your-prd.txt

# List all tasks
task-master list

# Show the next task to work on
task-master next

# Generate task files
task-master generate
```

## Setting up Cursor AI Integration

Task Master is designed to work seamlessly with [Cursor AI](https://www.cursor.so/), providing a structured workflow for AI-driven development.

### Using Cursor with MCP (Recommended)

If you've already set up Task Master with MCP in Cursor, the integration is automatic. You can simply use natural language to interact with Task Master:

```
What tasks are available to work on next?
Can you analyze the complexity of our tasks?
I'd like to implement task 4. What does it involve?
```

### Manual Cursor Setup

If you're not using MCP, you can still set up Cursor integration:

1. After initializing your project, open it in Cursor
2. The `.cursor/rules/dev_workflow.mdc` file is automatically loaded by Cursor, providing the AI with knowledge about the task management system
3. Place your PRD document in the `scripts/` directory (e.g., `scripts/prd.txt`)
4. Open Cursor's AI chat and switch to Agent mode

### Alternative MCP Setup in Cursor

You can also set up the MCP server in Cursor settings:

1. Go to Cursor settings
2. Navigate to the MCP section
3. Click on "Add New MCP Server"
4. Configure with the following details:
   - Name: "Task Master"
   - Type: "Command"
   - Command: "npx -y --package=task-master-ai task-master-ai"
5. Save the settings

Once configured, you can interact with Task Master's task management commands directly through Cursor's interface, providing a more integrated experience.

## Initial Task Generation

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
We've decided to use MongoDB instead of PostgreSQL. Can you update all future tasks (from ID 4) to reflect this change?
```

The agent will execute:

```bash
task-master update --from=4 --prompt="Now we are using MongoDB instead of PostgreSQL."

# OR, if research is needed to find best practices for MongoDB:
task-master update --from=4 --prompt="Update to use MongoDB, researching best practices" --research
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

For research-backed subtask generation using the configured research model:

```
Please break down task 5 using research-backed generation.
```

The agent will execute:

```bash
task-master expand --id=5 --research
```

## Example Cursor AI Interactions

### Starting a new project

```
I've just initialized a new project with Claude Task Master. I have a PRD at scripts/prd.txt.
Can you help me parse it and set up the initial tasks?
```

### Working on tasks

```
What's the next task I should work on? Please consider dependencies and priorities.
```

### Implementing a specific task

```
I'd like to implement task 4. Can you help me understand what needs to be done and how to approach it?
```

### Managing subtasks

```
I need to regenerate the subtasks for task 3 with a different approach. Can you help me clear and regenerate them?
```

### Handling changes

```
We've decided to use MongoDB instead of PostgreSQL. Can you update all future tasks to reflect this change?
```

### Completing work

```
I've finished implementing the authentication system described in task 2. All tests are passing.
Please mark it as complete and tell me what I should work on next.
```

### Analyzing complexity

```
Can you analyze the complexity of our tasks to help me understand which ones need to be broken down further?
```

### Viewing complexity report

```
Can you show me the complexity report in a more readable format?
```
