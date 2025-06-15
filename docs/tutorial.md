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

5. Place your PRD document in the `.taskmaster/docs/` directory (e.g., `.taskmaster/docs/prd.txt`)

6. **Use natural language commands** to interact with Task Master:

```
Can you parse my PRD at .taskmaster/docs/prd.txt?
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
3. Place your PRD document in the `.taskmaster/docs/` directory (e.g., `.taskmaster/docs/prd.txt`)
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
Please use the task-master parse-prd command to generate tasks from my PRD. The PRD is located at .taskmaster/docs/prd.txt.
```

The agent will execute:

```bash
task-master parse-prd .taskmaster/docs/prd.txt
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

```
Can you show me tasks 1, 3, and 5 to understand their current status?
```

The agent will:

- Run `task-master list` to see all tasks
- Run `task-master next` to determine the next task to work on
- Run `task-master show 1,3,5` to display multiple tasks with interactive options
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

### 2.1. Viewing Multiple Tasks

For efficient context gathering and batch operations:

```
Show me tasks 5, 7, and 9 so I can plan my implementation approach.
```

The agent will:

- Run `task-master show 5,7,9` to display a compact summary table
- Show task status, priority, and progress indicators
- Provide an interactive action menu with batch operations
- Allow you to perform group actions like marking multiple tasks as in-progress

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

### 6. Reorganizing Tasks

If you need to reorganize your task structure:

```
I think subtask 5.2 would fit better as part of task 7 instead. Can you move it there?
```

The agent will execute:

```bash
task-master move --from=5.2 --to=7.3
```

You can reorganize tasks in various ways:

- Moving a standalone task to become a subtask: `--from=5 --to=7`
- Moving a subtask to become a standalone task: `--from=5.2 --to=7`
- Moving a subtask to a different parent: `--from=5.2 --to=7.3`
- Reordering subtasks within the same parent: `--from=5.2 --to=5.4`
- Moving a task to a new ID position: `--from=5 --to=25` (even if task 25 doesn't exist yet)
- Moving multiple tasks at once: `--from=10,11,12 --to=16,17,18` (must have same number of IDs, Taskmaster will look through each position)

When moving tasks to new IDs:

- The system automatically creates placeholder tasks for non-existent destination IDs
- This prevents accidental data loss during reorganization
- Any tasks that depend on moved tasks will have their dependencies updated
- When moving a parent task, all its subtasks are automatically moved with it and renumbered

This is particularly useful as your project understanding evolves and you need to refine your task structure.

### 7. Resolving Merge Conflicts with Tasks

When working with a team, you might encounter merge conflicts in your tasks.json file if multiple team members create tasks on different branches. The move command makes resolving these conflicts straightforward:

```
I just merged the main branch and there's a conflict with tasks.json. My teammates created tasks 10-15 while I created tasks 10-12 on my branch. Can you help me resolve this?
```

The agent will help you:

1. Keep your teammates' tasks (10-15)
2. Move your tasks to new positions to avoid conflicts:

```bash
# Move your tasks to new positions (e.g., 16-18)
task-master move --from=10 --to=16
task-master move --from=11 --to=17
task-master move --from=12 --to=18
```

This approach preserves everyone's work while maintaining a clean task structure, making it much easier to handle task conflicts than trying to manually merge JSON files.

### 8. Breaking Down Complex Tasks

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
I've just initialized a new project with Claude Task Master. I have a PRD at .taskmaster/docs/prd.txt.
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

### Research-Driven Development

Task Master includes a powerful research tool that provides fresh, up-to-date information beyond the AI's knowledge cutoff. This is particularly valuable for:

#### Getting Current Best Practices

```
Before implementing task 5 (authentication), research the latest JWT security recommendations.
```

The agent will execute:

```bash
task-master research "Latest JWT security recommendations 2024" --id=5
```

#### Research with Project Context

```
Research React Query v5 migration strategies for our current API implementation.
```

The agent will execute:

```bash
task-master research "React Query v5 migration strategies" --files=src/api.js,src/hooks.js
```

#### Research and Update Pattern

A powerful workflow is to research first, then update tasks with findings:

```
Research the latest Node.js performance optimization techniques and update task 12 with the findings.
```

The agent will:

1. Run research: `task-master research "Node.js performance optimization 2024" --id=12`
2. Update the task: `task-master update-subtask --id=12.2 --prompt="Updated with latest performance findings: [research results]"`

#### When to Use Research

- **Before implementing any new technology**
- **When encountering security-related tasks**
- **For performance optimization tasks**
- **When debugging complex issues**
- **Before making architectural decisions**
- **When updating dependencies**

The research tool automatically includes relevant project context and provides fresh information that can significantly improve implementation quality.

## Git Integration and Tag Management

Task Master supports tagged task lists for multi-context development, which is particularly useful when working with git branches or different project phases.

### Working with Tags

Tags provide isolated task contexts, allowing you to maintain separate task lists for different features, branches, or experiments:

```
I'm starting work on a new feature branch. Can you create a new tag for this work?
```

The agent will execute:

```bash
# Create a tag based on your current git branch
task-master add-tag --from-branch
```

Or you can create a tag with a specific name:

```
Create a new tag called 'user-auth' for authentication-related tasks.
```

The agent will execute:

```bash
task-master add-tag user-auth --description="User authentication feature tasks"
```

### Switching Between Contexts

When working on different features or branches:

```
Switch to the 'user-auth' tag context so I can work on authentication tasks.
```

The agent will execute:

```bash
task-master use-tag user-auth
```

### Copying Tasks Between Tags

When you need to duplicate work across contexts:

```
Copy all tasks from the current tag to a new 'testing' tag for QA work.
```

The agent will execute:

```bash
task-master add-tag testing --copy-from-current --description="QA and testing tasks"
```

### Tag Management

View and manage your tag contexts:

```
Show me all available tags and their current status.
```

The agent will execute:

```bash
task-master tags --show-metadata
```

### Benefits of Tagged Task Lists

- **Branch Isolation**: Each git branch can have its own task context
- **Merge Conflict Prevention**: Tasks in different tags don't interfere with each other
- **Parallel Development**: Multiple team members can work on separate contexts
- **Context Switching**: Easily switch between different project phases or features
- **Experimentation**: Create experimental task lists without affecting main work

### Git Workflow Integration

A typical git workflow with Task Master tags:

1. **Create feature branch**: `git checkout -b feature/user-auth`
2. **Create matching tag**: Ask agent to run `task-master add-tag --from-branch`
3. **Work in isolated context**: All task operations work within the new tag
4. **Switch contexts as needed**: Use `task-master use-tag <name>` to switch between different work streams
5. **Merge and cleanup**: After merging the branch, optionally delete the tag with `task-master delete-tag <name>`

This workflow ensures your task management stays organized and conflicts are minimized when working with teams or multiple features simultaneously.
